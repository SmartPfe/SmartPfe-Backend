const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { EventEmitter } = require('node:events');
const User = require('../src/models/User');
const google = require('../src/services/googleIdentityService');
const email = require('../src/services/emailService');
const credits = require('../src/services/creditService');
const { creditGate } = require('../src/middleware/creditMiddleware');
const { passwordPolicyError } = require('../src/lib/passwordPolicy');

async function serve(t, app) {
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return (path, options = {}) => fetch('http://127.0.0.1:' + server.address().port + path, options);
}
async function authApi(t, role = 'etudiant') {
  const user = { _id: '64b64c8f4a7d2c0012345678', fullName: 'Existing name', email: 'same@example.com',
    password: 'existing-password-hash', emailVerified: true, hasCompletedOnboarding: true, role,
    sessionVersion: '0', save: async () => {}, matchPassword: async value => value === 'old-password' };
  t.mock.method(User, 'findById', () => ({ select: async () => user, then: (resolve, reject) => Promise.resolve(user).then(resolve, reject) }));
  t.mock.method(email, 'sendEmailVerificationCode', async () => ({ sent: true }));
  delete require.cache[require.resolve('../src/controllers/authController')];
  delete require.cache[require.resolve('../src/routes/authRoutes')];
  const app = express(); app.use('/auth', require('../src/routes/authRoutes'));
  const request = await serve(t, app);
  const token = jwt.sign({ id: user._id, sv: '0' }, process.env.JWT_SECRET || 'default_super_secret_key');
  const post = (path, body, authenticated = true) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(authenticated ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  return { user, post, request, token };
}
const identity = { googleId: 'immutable-google-sub', email: 'same@example.com', fullName: 'Google name', authoritativeEmail: true };

test('Google collisions cannot log into or rewrite existing student/admin accounts', async t => {
  for (const role of ['etudiant', 'admin']) await t.test(role, async t => {
    const { user, post } = await authApi(t, role);
    t.mock.method(google, 'verifyGoogleIdentity', async () => identity);
    t.mock.method(User, 'findOne', async () => null);
    t.mock.method(User, 'exists', async () => ({ _id: user._id }));
    t.mock.method(User, 'create', () => assert.fail('Must not create a duplicate'));
    const response = await post('/auth/google', { credential: 'valid-fixture' }, false);
    assert.equal(response.status, 409);
    const data = await response.json(); assert.equal(data.code, 'GOOGLE_LINK_REQUIRED'); assert.equal(data.token, undefined);
    assert.equal(user.googleId, undefined); assert.equal(user.fullName, 'Existing name');
  });
});
test('Google connection requires a valid session and the current password', async t => {
  const { post } = await authApi(t);
  t.mock.method(google, 'verifyGoogleIdentity', () => assert.fail('No Google verification before account proof'));
  assert.equal((await post('/auth/google/connect', { currentPassword: 'old-password', credential: 'fixture' }, false)).status, 401);
  assert.equal((await post('/auth/google/connect', { currentPassword: 'wrong', credential: 'fixture' })).status, 401);
});
test('connecting Google retains the password, account ID and role and revokes old sessions', async t => {
  const { user, post, request, token } = await authApi(t, 'admin');
  t.mock.method(google, 'verifyGoogleIdentity', async () => identity);
  t.mock.method(User, 'findOneAndUpdate', async (filter, update) => {
    assert.equal(filter.password, 'existing-password-hash'); assert.equal(filter.emailVerified, true);
    assert.ok(filter.$and); Object.assign(user, update.$set); return user;
  });
  const response = await post('/auth/google/connect', { currentPassword: 'old-password', credential: 'fixture' });
  assert.equal(response.status, 200);
  const data = await response.json(); assert.equal(data._id, user._id); assert.equal(data.role, 'admin');
  assert.equal(data.hasPassword, true); assert.equal(data.googleConnected, true); assert.equal(data.password, undefined);
  assert.equal(user.password, 'existing-password-hash'); assert.equal(user.fullName, 'Existing name');
  assert.equal((await request('/auth/profile', { headers: { Authorization: 'Bearer ' + token } })).status, 401);
  assert.equal((await request('/auth/profile', { headers: { Authorization: 'Bearer ' + data.token } })).status, 200);
});
test('a different email or Google subject cannot replace an existing link', async t => {
  const { user, post } = await authApi(t);
  t.mock.method(User, 'findOneAndUpdate', () => assert.fail('Must not change the link'));
  t.mock.method(google, 'verifyGoogleIdentity', async () => ({ ...identity, email: 'other@example.com' }));
  assert.equal((await post('/auth/google/connect', { currentPassword: 'old-password', credential: 'fixture' })).status, 409);
  user.googleId = 'different-sub';
  google.verifyGoogleIdentity.mock.mockImplementation(async () => identity);
  assert.equal((await post('/auth/google/connect', { currentPassword: 'old-password', credential: 'fixture' })).status, 409);
});
test('linked Google login uses its immutable subject even when Google email changes', async t => {
  const { user, post } = await authApi(t); user.googleId = identity.googleId;
  t.mock.method(google, 'verifyGoogleIdentity', async () => ({ ...identity, email: 'changed@example.com' }));
  t.mock.method(User, 'findOne', async filter => { assert.equal(filter.googleId, identity.googleId); return user; });
  t.mock.method(User, 'exists', () => assert.fail('Must not match by email'));
  const response = await post('/auth/google', { credential: 'fixture' }, false);
  assert.equal(response.status, 200); const data = await response.json(); assert.equal(data._id, user._id); assert.equal(data.email, 'same@example.com'); assert.equal(data.hasPassword, true);
});
test('a new external-email Google account must verify its mailbox before any session is issued', async t => {
  const { user, post } = await authApi(t);
  t.mock.method(google, 'verifyGoogleIdentity', async () => ({ ...identity, authoritativeEmail: false }));
  t.mock.method(User, 'findOne', async () => null); t.mock.method(User, 'exists', async () => null);
  t.mock.method(User, 'create', async fields => { assert.equal(fields.role, 'etudiant'); assert.equal(fields.emailVerified, false); return { ...user, ...fields, password: undefined }; });
  const response = await post('/auth/google', { credential: 'fixture' }, false);
  assert.equal(response.status, 403); const data = await response.json(); assert.equal(data.requiresEmailVerification, true); assert.equal(data.token, undefined);
});
test('Google verification fails closed without an audience and rejects unverified email', async t => {
  const oldId = process.env.GOOGLE_CLIENT_ID; t.after(() => { if (oldId === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = oldId; });
  delete process.env.GOOGLE_CLIENT_ID;
  await assert.rejects(google.verifyGoogleIdentity('fixture'), /unavailable/);
  process.env.GOOGLE_CLIENT_ID = 'configured-client-id';
  const { OAuth2Client } = require('google-auth-library');
  t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async options => {
    assert.equal(options.audience, 'configured-client-id');
    return { getPayload: () => ({ sub: 'sub', email: 'same@gmail.com', email_verified: false }) };
  });
  await assert.rejects(google.verifyGoogleIdentity('fixture'), /verified email/);
});
test('register, reset and change reject the same weak/overlong passwords before any write', async t => {
  const { post, request, token } = await authApi(t);
  t.mock.method(User, 'findOne', () => assert.fail('Invalid password must be rejected before lookup'));
  for (const password of ['Short1!', 'x'.repeat(73), 'é'.repeat(37)]) {
    const key = passwordPolicyError(password); assert.ok(key);
    for (const path of ['/auth/register', '/auth/reset-password']) {
      const response = await post(path, { fullName: 'Test', email: 'test@example.com', token: 'fixture', password }, false);
      assert.equal(response.status, 400); assert.equal((await response.json()).messageKey, key);
    }
    const response = await request('/auth/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ currentPassword: 'old-password', newPassword: password }) });
    assert.equal(response.status, 400); assert.equal((await response.json()).messageKey, key);
  }
  assert.equal(passwordPolicyError('a long simple passphrase'), null);
  assert.equal(passwordPolicyError('🙂'.repeat(14)), 'auth.passwordTooShort');
  assert.equal(passwordPolicyError('🙂'.repeat(18)), null);
  assert.equal(passwordPolicyError('🙂'.repeat(19)), 'auth.passwordTooLong');
});

function response() {
  return Object.assign(new EventEmitter(), { statusCode: 200, destroyed: false, headersSent: false, writableEnded: false, events: [],
    status(code) { this.statusCode = code; return this; }, json(payload) { this.events.push(payload); return this; },
    setHeader() {}, flushHeaders() {}, write(value) { this.events.push(value); }, end() { this.writableEnded = true; } });
}
async function creditFixture(t, manual = false) {
  const counters = { settled: 0, refunded: 0, released: 0, active: 1 };
  t.mock.method(credits, 'reserveCreditCharge', async () => ({ requestId: 'request', userId: 'user' }));
  t.mock.method(credits, 'settleCreditCharge', async (_charge, options) => { counters.settled++; if (options.releaseSlot) counters.active--; return { charged: 10 }; });
  t.mock.method(credits, 'refundCreditCharge', async (_charge, _reason, options) => { counters.refunded++; if (options.releaseSlot) counters.active--; });
  t.mock.method(credits, 'releaseCreditSlot', async () => { counters.released++; counters.active--; });
  const req = { user: { _id: 'user' }, body: {}, headers: {} }, res = response();
  await creditGate('report_section', { manualSettlement: manual })(req, res, error => { if (error) throw error; });
  return { counters, req, res };
}
test('closing a normal AI request neither refunds credits nor releases its slot; successful work still charges', async t => {
  const { counters, req, res } = await creditFixture(t); res.destroyed = true; res.emit('close');
  assert.equal(counters.refunded, 0); assert.equal(counters.active, 1);
  res.json({ generated: 'saved result' }); await req.finalizeCredits(true); await new Promise(setImmediate);
  assert.equal(counters.settled, 1); assert.equal(counters.refunded, 0); assert.equal(counters.active, 0); assert.deepEqual(res.events, []);
});
test('genuine failure after disconnect refunds once, only when processing has ended', async t => {
  const { counters, req, res } = await creditFixture(t); res.destroyed = true; res.emit('close');
  assert.equal(counters.refunded, 0); res.status(500).json({ message: 'provider failed' });
  await req.finalizeCredits(false); await req.finalizeCredits(false);
  assert.equal(counters.refunded, 1); assert.equal(counters.active, 0);
});
test('settlement failure cannot refund or expose a successfully generated result', async t => {
  const { counters, req, res } = await creditFixture(t);
  credits.settleCreditCharge.mock.mockImplementation(async () => { throw new Error('database temporarily unavailable'); });
  res.json({ secretGeneratedResult: 'must not be delivered free' });
  await assert.rejects(req.finalizeCredits(true), /database/); await new Promise(setImmediate);
  assert.equal(counters.refunded, 0); assert.equal(res.events[0].code, 'CREDIT_SETTLEMENT_FAILED'); assert.equal(res.events[0].secretGeneratedResult, undefined);
});
async function streamingFixture(t, stream, rag = async () => '') {
  const fixture = await creditFixture(t, true);
  t.mock.method(require('../src/services/geminiService'), 'streamGemini', stream);
  t.mock.method(require('../src/services/reportStudioRagService'), 'getSectionRagContext', rag);
  delete require.cache[require.resolve('../src/services/reportStudioService')];
  const { generateChapterStream } = require('../src/services/reportStudioService');
  fixture.run = () => generateChapterStream({ basics: { title: 'Test', language: 'English' }, reportStructure: [{ id: 'section', title: 'Intro' }] }, 'section', 'standard', [], fixture.res, fixture.req);
  return fixture;
}
test('stream settles before the first text and keeps its slot until abort processing finishes', async t => {
  let fixture;
  fixture = await streamingFixture(t, async (_prompt, _unused, onChunk, options) => {
    await onChunk('generated partial text');
    assert.equal(fixture.counters.settled, 1); assert.equal(fixture.counters.active, 1);
    assert.ok(fixture.res.events.some(value => value.includes('event: chunk')));
    fixture.res.destroyed = true; fixture.res.emit('close');
    assert.equal(options.signal.aborted, true); assert.equal(fixture.counters.refunded, 0); assert.equal(fixture.counters.active, 1);
    throw new Error('provider stopped after cancellation');
  });
  await fixture.run(); assert.equal(fixture.counters.refunded, 0); assert.equal(fixture.counters.settled, 1); assert.equal(fixture.counters.released, 1); assert.equal(fixture.counters.active, 0);
});
test('disconnect before generated text refunds only after RAG stops and never starts the provider', async t => {
  let stopRag; const ragDone = new Promise(resolve => { stopRag = resolve; });
  const fixture = await streamingFixture(t, () => assert.fail('Provider must not start after cancellation'), () => ragDone);
  const running = fixture.run(); fixture.res.destroyed = true; fixture.res.emit('close');
  assert.equal(fixture.counters.refunded, 0); assert.equal(fixture.counters.active, 1);
  stopRag(''); await running; assert.equal(fixture.counters.refunded, 1); assert.equal(fixture.counters.active, 0);
});
test('empty provider output is refunded without exposing generated text', async t => {
  const fixture = await streamingFixture(t, async () => ''); await fixture.run();
  assert.equal(fixture.counters.refunded, 1); assert.equal(fixture.counters.settled, 0);
  assert.ok(!fixture.res.events.some(value => typeof value === 'string' && value.includes('event: chunk')));
});

test('the real provider reader awaits accounting callbacks and stops instead of falling back on accounting errors', async t => {
  const previous = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = 'test-only-fixture';
  t.after(() => { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; });
  let requests = 0;
  t.mock.method(global, 'fetch', async () => {
    requests++;
    return new Response('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'first chunk' }] } }] }) + '\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
  });
  const gemini = require('../src/services/geminiService');
  let acknowledge; const accounting = new Promise(resolve => { acknowledge = resolve; }); let callbackStarted;
  const started = new Promise(resolve => { callbackStarted = resolve; }); let finished = false;
  const generation = gemini.streamGeminiMessages([{ role: 'user', content: 'fixture' }], async () => { callbackStarted(); await accounting; }, { models: ['first', 'second'] }).then(() => { finished = true; });
  await started; assert.equal(finished, false); acknowledge(); await generation; assert.equal(finished, true);
  requests = 0;
  await assert.rejects(gemini.streamGeminiMessages([{ role: 'user', content: 'fixture' }], async () => { throw new Error('accounting unavailable'); }, { models: ['first', 'second'] }), /accounting unavailable/);
  assert.equal(requests, 1);
  const abort = new AbortController(); abort.abort(); requests = 0;
  await assert.rejects(gemini.streamGeminiMessages([{ role: 'user', content: 'fixture' }], () => {}, { models: ['first', 'second'], signal: abort.signal }));
  assert.equal(requests, 0);
});
test('a real disconnected HTTP request keeps its AI slot until the controller finishes', async t => {
  const counters = { settled: 0, refunded: 0, active: 0 };
  t.mock.method(credits, 'reserveCreditCharge', async () => { counters.active++; return { requestId: 'http-abort', userId: 'user' }; });
  t.mock.method(credits, 'settleCreditCharge', async () => { counters.settled++; counters.active--; return { charged: 5 }; });
  t.mock.method(credits, 'refundCreditCharge', async () => { counters.refunded++; counters.active--; });
  let started, finish, finalized, closed;
  const began = new Promise(resolve => { started = resolve; }); const work = new Promise(resolve => { finish = resolve; });
  const done = new Promise(resolve => { finalized = resolve; }); const disconnected = new Promise(resolve => { closed = resolve; });
  const app = express();
  app.post('/ai', (req, _res, next) => { req.user = { _id: 'user' }; next(); }, creditGate('problem_statement'), async (req, res) => {
    res.once('close', closed); started(); await work; res.json({ result: 'stored generation' }); await req.finalizeCredits(true); finalized();
  });
  const request = await serve(t, app); const abort = new AbortController();
  const pending = request('/ai', { method: 'POST', signal: abort.signal }).catch(() => null);
  await began; abort.abort(); await pending; await disconnected;
  assert.equal(counters.refunded, 0); assert.equal(counters.active, 1);
  finish(); await done; assert.equal(counters.settled, 1); assert.equal(counters.refunded, 0); assert.equal(counters.active, 0);
});
test('database settlement consumes credits and free quota without releasing an active stream slot', async t => {
  const Transaction = require('../src/models/CreditTransaction'), Wallet = require('../src/models/CreditWallet');
  const FreeUsage = require('../src/models/CreditFreeUsage'), Locks = require('../src/models/AiConcurrencyLock');
  const tx = { _id: 'tx', user: 'user', requestId: 'req', status: 'reserved', chargedCost: 5, freeQuotaUsed: true, actionKey: 'report_section', save: async () => {} };
  let markedComplete = false, slotReleases = 0;
  t.mock.method(Transaction, 'updateOne', async (_filter, update) => { markedComplete = update.$set['metadata.aiCompleted'] === true; });
  t.mock.method(Transaction, 'findOne', async () => tx);
  t.mock.method(Wallet, 'findOne', async () => ({ promotionalBalance: 90, purchasedBalance: 0 }));
  t.mock.method(Wallet, 'findOneAndUpdate', async (_filter, update) => { assert.equal(update.$inc.promotionalBalance, undefined); assert.equal(update.$pull.reservations.requestId, 'req'); return { promotionalBalance: 90, purchasedBalance: 0 }; });
  t.mock.method(FreeUsage, 'updateOne', async (_filter, update) => { assert.equal(update.$inc, undefined); });
  t.mock.method(Locks, 'updateOne', async () => { slotReleases++; });
  await credits.settleCreditCharge({ requestId: 'req', userId: 'user' }, { releaseSlot: false });
  assert.equal(markedComplete, true); assert.equal(tx.status, 'settled'); assert.equal(slotReleases, 0);
  await credits.releaseCreditSlot({ requestId: 'req', userId: 'user' }); assert.equal(slotReleases, 1);
  await credits.refundCreditCharge({ requestId: 'req', userId: 'user' }, 'disconnect'); assert.equal(tx.status, 'settled');
});

test('existing passwords remain usable and linked accounts can still change their native password', async t => {
  const { user, post, request, token } = await authApi(t); user.googleId = identity.googleId;
  t.mock.method(User, 'findOne', async () => user);
  t.mock.method(require('../src/models/Notification'), 'create', async data => data);
  const login = await post('/auth/login', { email: user.email, password: 'old-password' }, false);
  assert.equal(login.status, 200); assert.equal((await login.json()).hasPassword, true);
  const response = await request('/auth/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ currentPassword: 'old-password', newPassword: 'a long simple passphrase' }) });
  assert.equal(response.status, 200); assert.equal((await response.json()).googleConnected, true);
  assert.equal(user.password, 'a long simple passphrase'); assert.equal(user.googleId, identity.googleId);
});
test('a new authoritative Google identity creates only a student account', async t => {
  let walletCreated = false;
  t.mock.method(credits, 'getWalletForUser', async () => { walletCreated = true; });
  t.mock.method(require('../src/services/notificationService'), 'createAdminNotification', async () => {});
  const { user, post } = await authApi(t);
  t.mock.method(google, 'verifyGoogleIdentity', async () => identity);
  t.mock.method(User, 'findOne', async () => null); t.mock.method(User, 'exists', async () => null);
  t.mock.method(User, 'create', async fields => { assert.equal(fields.role, 'etudiant'); assert.equal(fields.emailVerified, true); return { ...user, ...fields, password: undefined }; });
  const response = await post('/auth/google', { credential: 'fixture', role: 'admin' }, false);
  assert.equal(response.status, 200); const data = await response.json(); assert.equal(data.role, 'etudiant'); assert.equal(data.hasPassword, false); assert.equal(data.googleConnected, true); assert.ok(data.token); assert.equal(walletCreated, true);
});
test('credit leases renew the database lock, transaction and wallet independently of client sockets', async t => {
  const updates = [];
  for (const name of ['AiConcurrencyLock', 'CreditTransaction', 'CreditWallet']) t.mock.method(require('../src/models/' + name), 'updateOne', async (filter, update) => { updates.push({ name, filter, update }); });
  await credits.renewCreditChargeLease({ requestId: 'still-running', userId: 'user' });
  assert.equal(updates.length, 3); assert.equal(updates[0].filter['activeRequests.requestId'], 'still-running');
  assert.ok(updates[0].update.$set['activeRequests.$.expiresAt'] > new Date());
  assert.equal(updates[1].filter.requestId, 'still-running'); assert.ok(updates[1].update.$set.updatedAt instanceof Date);
  assert.equal(updates[2].filter['reservations.requestId'], 'still-running');
});
test('completed work with a pending accounting record cannot subsequently be refunded', async t => {
  t.mock.method(require('../src/models/CreditTransaction'), 'findOne', async () => ({ status: 'reserved', metadata: { aiCompleted: true } }));
  t.mock.method(require('../src/models/CreditWallet'), 'findOne', () => assert.fail('Must not refund completed work'));
  assert.equal(await credits.refundCreditCharge({ requestId: 'completed-but-unfinalized' }, 'disconnect'), null);
});
