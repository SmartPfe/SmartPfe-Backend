const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const User = require('../src/models/User');
const { registerUser, forgotPassword } = require('../src/controllers/authController');

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function mailFixture(t) {
  const mails = [];
  const previous = Object.fromEntries(['EMAIL_USER', 'EMAIL_PASS', 'FRONTEND_URL'].map(key => [key, process.env[key]]));
  Object.assign(process.env, { EMAIL_USER: 'test@example.invalid', EMAIL_PASS: 'mock-only', FRONTEND_URL: 'http://localhost:3000' });
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async mail => { mails.push(mail); return {}; } }));
  return mails;
}

test('new registration uses validated interface header for preference and verification mail without touching content fields', async t => {
  const mails = mailFixture(t);
  t.mock.method(User, 'findOne', async () => null);
  const writes = [];
  t.mock.method(User, 'create', async payload => {
    writes.push(payload);
    return { ...payload, _id: 'mock-account', save: async () => undefined };
  });
  for (const [header, language] of [['fr', 'fr'], ['en', 'en'], ['Arabic', 'fr'], [undefined, 'fr']]) {
    const res = response();
    await registerUser({ body: { fullName: 'Existing English name', email: 'demo@example.invalid', password: 'test-placeholder', language: 'Arabic' }, headers: { 'x-ui-language': header } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(writes.at(-1).uiLanguage, language);
    assert.equal(writes.at(-1).fullName, 'Existing English name');
    assert.equal('language' in writes.at(-1), false);
    assert.equal(mails.at(-1).to, 'demo@example.invalid');
    assert.equal(mails.at(-1).subject, language === 'fr' ? 'Vérifiez votre adresse e-mail' : 'Verify your email');
    assert.equal(res.body.messageKey, 'auth.accountCreatedVerificationSent');
    assert.equal(res.body.message, 'Account created. Verification code sent to your email.');
  }
});

test('reset keeps its anti-enumeration message and recipient preference despite a different requesting interface', async t => {
  const mails = mailFixture(t);
  let user = null;
  t.mock.method(User, 'findOne', async () => user);
  const missing = response();
  await forgotPassword({ body: { email: 'demo@example.invalid' }, headers: { 'x-ui-language': 'fr' } }, missing);
  assert.equal(mails.length, 0);
  user = { email: 'demo@example.invalid', uiLanguage: 'en', save: async () => undefined };
  const existing = response();
  await forgotPassword({ body: { email: user.email }, headers: { 'x-ui-language': 'fr' } }, existing);
  assert.equal(existing.statusCode, missing.statusCode);
  assert.equal(existing.body.message, missing.body.message);
  assert.equal(existing.body.messageKey, missing.body.messageKey);
  assert.equal(mails[0].subject, 'Reset your password');
  assert.ok(mails[0].html.includes(`/reset-password/${user.resetToken}`));
  assert.ok(user.resetTokenExpiry instanceof Date);
});

test('credit request mail keeps each recipient preference and preserves request values with mocked delivery', async t => {
  const mails = mailFixture(t);
  const previousInbox = process.env.ADMIN_CREDIT_REQUEST_EMAIL;
  process.env.ADMIN_CREDIT_REQUEST_EMAIL = 'Admin@example.invalid';
  t.after(() => { if (previousInbox === undefined) delete process.env.ADMIN_CREDIT_REQUEST_EMAIL; else process.env.ADMIN_CREDIT_REQUEST_EMAIL = previousInbox; });
  const CreditPurchaseRequest = require('../src/models/CreditPurchaseRequest');
  const Notification = require('../src/models/Notification');
  const { createCreditPurchaseRequest } = require('../src/services/creditPurchaseRequestService');
  const stored = [];
  let savedRequest;
  t.mock.method(CreditPurchaseRequest, 'create', async payload => {
    savedRequest = { ...payload, _id: 'mock-request', createdAt: new Date('2026-10-08T12:00:00Z'), save: async () => undefined, toObject() { return { ...this }; } };
    return savedRequest;
  });
  const notifications = [];
  t.mock.method(Notification, 'create', async payload => { notifications.push(payload); return payload; });
  t.mock.method(User, 'findOne', query => {
    stored.push(query);
    return { select: async () => ({ uiLanguage: 'fr' }) };
  });
  const result = await createCreditPurchaseRequest({ user: { _id: 'mock-user', fullName: 'Original English name', email: 'student@example.invalid', role: 'etudiant', uiLanguage: 'en', language: 'French' }, phone: '+216 12345678', credits: 100 });
  assert.deepEqual(stored, [{ email: 'admin@example.invalid', role: 'admin' }]);
  assert.equal(mails.find(mail => mail.to === 'Admin@example.invalid').subject, 'Nouvelle demande d’achat de crédits');
  assert.ok(mails.find(mail => mail.to === 'student@example.invalid').subject.startsWith("We've received your request"));
  assert.equal(result.request.requestedCredits, 100);
  assert.equal(result.request.price, savedRequest.price);
  assert.equal(result.request.currency, savedRequest.currency);
  assert.equal(result.request.status, 'PENDING');
  assert.equal(result.request.studentName, 'Original English name');
  assert.equal(notifications[0].messageKey, 'credits.submitted.message');
  assert.deepEqual(notifications[0].messageParams, { credits: 100 });
});
