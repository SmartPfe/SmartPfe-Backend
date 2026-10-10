const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { EventEmitter } = require('node:events');
const contactRoutes = require('../src/routes/contactRoutes');
const { uploadCapacity, validateAudio, runAudio } = require('../src/middleware/audioGuard');

async function serve(t, app) {
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return (path, options = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
}

test('contact bodies are limited before parsing and repeated attempts are blocked', async t => {
  const app = express(); app.use('/contact', contactRoutes);
  const request = await serve(t, app);
  assert.equal((await request('/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'x'.repeat(17000) }) })).status, 413);
  for (let i = 0; i < 4; i++) assert.equal((await request('/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
  assert.equal((await request('/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 429);
});

test('audio is detected from bytes and a fake audio MIME label cannot admit an image', async t => {
  const app = express();
  app.post('/audio', express.raw({ type: '*/*' }), (req, _res, next) => { req.file = { buffer: req.body, mimetype: 'audio/webm' }; next(); }, validateAudio, (req, res) => res.json({ mime: req.file.mimetype }));
  const request = await serve(t, app);
  assert.equal((await request('/audio', { method: 'POST', headers: { 'Content-Type': 'audio/webm' }, body: Buffer.from('not an audio container') })).status, 400);
  const wav = Buffer.alloc(44); wav.write('RIFF'); wav.writeUInt32LE(36, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.write('data', 36);
  const response = await request('/audio', { method: 'POST', headers: { 'Content-Type': 'audio/webm' }, body: wav });
  assert.equal(response.status, 200); assert.equal((await response.json()).mime, 'audio/wav');
});

test('an aborted audio response keeps capacity reserved until processing actually stops', async () => {
  const req = { user: { _id: 'audio-test' }, audioValidated: true };
  const res = new EventEmitter();
  let admitted = false;
  uploadCapacity(req, res, () => { admitted = true; });
  assert.ok(admitted);
  res.emit('close');
  let code;
  const denied = { status(value) { code = value; return this; }, json() {} };
  uploadCapacity({ user: req.user }, denied, () => assert.fail('Must deny concurrent audio'));
  assert.equal(code, 429);
  await runAudio(async () => {})(req, res, () => {});
  const nextResponse = new EventEmitter();
  uploadCapacity({ user: req.user }, nextResponse, () => { admitted = true; });
  nextResponse.emit('finish');
});

test('API security headers prevent framing and MIME sniffing without forcing local HTTP to HTTPS', async t => {
  const app = express(); app.use(require('helmet')({ contentSecurityPolicy: false, strictTransportSecurity: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.get('/', (_req, res) => res.json({ ok: true }));
  const response = await (await serve(t, app))('/');
  assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('strict-transport-security'), null);
});
