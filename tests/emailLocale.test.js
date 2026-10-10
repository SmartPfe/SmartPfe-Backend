const assert = require("node:assert/strict");
const test = require("node:test");
const nodemailer = require("nodemailer");
const { normalizeEmailLocale } = require("../src/services/emailLocale");

const originalCreateTransport = nodemailer.createTransport;
const originalEnvironment = {
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM,
  ADMIN_CREDIT_REQUEST_EMAIL: process.env.ADMIN_CREDIT_REQUEST_EMAIL,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL,
  FRONTEND_URL: process.env.FRONTEND_URL,
  NODE_ENV: process.env.NODE_ENV,
};
const sentMessages = [];

nodemailer.createTransport = () => ({
  sendMail: async (message) => {
    sentMessages.push(message);
    return { accepted: [message.to] };
  },
});

const emailService = require("../src/services/emailService");

const configureMail = () => {
  process.env.EMAIL_USER = "sender@example.test";
  process.env.EMAIL_PASS = "test-password";
  process.env.EMAIL_FROM = "noreply@example.test";
  process.env.ADMIN_CREDIT_REQUEST_EMAIL = "admin@example.test";
  process.env.FRONTEND_URL = "https://smartpfe.example.test";
  process.env.NODE_ENV = "test";
  sentMessages.length = 0;
};

test.beforeEach(configureMail);
test.after(() => {
  nodemailer.createTransport = originalCreateTransport;
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("normalizes supported UI languages and defaults missing or unsupported values to French", () => {
  assert.equal(normalizeEmailLocale("fr"), "fr");
  assert.equal(normalizeEmailLocale(" FR-fr "), "fr");
  assert.equal(normalizeEmailLocale("fr_CA"), "fr");
  assert.equal(normalizeEmailLocale("en"), "en");
  assert.equal(normalizeEmailLocale(" EN-us "), "en");
  assert.equal(normalizeEmailLocale("ar"), "fr");
  assert.equal(normalizeEmailLocale(undefined), "fr");
  assert.equal(normalizeEmailLocale(12), "fr");
});

test("credit-request recipient helper preserves configured inbox precedence and missing-recipient fallback", () => {
  const recipientVariables = [
    "ADMIN_CREDIT_REQUEST_EMAIL",
    "ADMIN_EMAIL",
    "CONTACT_TO_EMAIL",
    "EMAIL_FROM",
    "EMAIL_USER",
  ];
  const originalValues = Object.fromEntries(recipientVariables.map((key) => [key, process.env[key]]));

  try {
    for (let index = 0; index < recipientVariables.length; index += 1) {
      for (const key of recipientVariables) process.env[key] = "";
      for (let prior = index; prior < recipientVariables.length; prior += 1) {
        process.env[recipientVariables[prior]] = `${recipientVariables[prior].toLowerCase()}@example.test`;
      }
      assert.equal(
        emailService.getCreditPurchaseRequestRecipient(),
        `${recipientVariables[index].toLowerCase()}@example.test`
      );
    }

    for (const key of recipientVariables) process.env[key] = "";
    assert.equal(emailService.getCreditPurchaseRequestRecipient(), "");

    process.env.ADMIN_CREDIT_REQUEST_EMAIL = "unmatched-inbox@example.test";
    assert.equal(emailService.getCreditPurchaseRequestRecipient(), "unmatched-inbox@example.test");
  } finally {
    for (const [key, value] of Object.entries(originalValues)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("reset and verification messages follow UI language while preserving links and codes", async () => {
  await emailService.sendResetPasswordEmail("student@example.test", "reset-token", "en");
  await emailService.sendResetPasswordEmail("etudiant@example.test", "jeton-reset", "fr-FR");
  await emailService.sendEmailVerificationCode("student@example.test", "<123&>", "fr");
  await emailService.sendEmailVerificationCode("student@example.test", "654321", "unsupported");

  assert.equal(sentMessages[0].subject, "Reset your password");
  assert.match(sentMessages[0].html, /You requested a password reset\./);
  assert.match(sentMessages[0].html, /href="https:\/\/smartpfe\.example\.test\/reset-password\/reset-token"/);
  assert.equal(sentMessages[1].subject, "Réinitialiser votre mot de passe");
  assert.match(sentMessages[1].html, /Réinitialiser mon mot de passe/);
  assert.match(sentMessages[1].html, /href="https:\/\/smartpfe\.example\.test\/reset-password\/jeton-reset"/);
  assert.equal(sentMessages[2].subject, "Vérifiez votre adresse e-mail");
  assert.match(sentMessages[2].html, /&lt;123&amp;&gt;/);
  assert.equal(sentMessages[3].subject, "Vérifiez votre adresse e-mail");
  assert.match(sentMessages[3].html, /654321/);
});

test("admin request and student acknowledgment localize labels but preserve request content", async () => {
  const request = {
    _id: "request/42?x=1",
    studentName: "Mayssen <Admin>",
    email: "mayssen@example.test",
    phone: "+216 12 345 678",
    requestedCredits: 500,
    packageLabel: "Starter <Premium>",
    price: 125,
    currency: "TND",
    createdAt: "2026-09-12T10:30:00.000Z",
  };

  await emailService.sendCreditPurchaseRequestEmail({ request, uiLanguage: "fr" });
  await emailService.sendCreditPurchaseReceiptEmail({ request, uiLanguage: "fr-CA" });

  const adminMessage = sentMessages[0];
  assert.equal(adminMessage.to, "admin@example.test");
  assert.equal(adminMessage.replyTo, request.email);
  assert.equal(adminMessage.subject, "Nouvelle demande d’achat de crédits");
  assert.match(adminMessage.html, /Nom de l’étudiant/);
  assert.match(adminMessage.html, /Mayssen &lt;Admin&gt;/);
  assert.match(adminMessage.html, /Starter &lt;Premium&gt;/);
  assert.match(adminMessage.html, /125 TND/);

  const receipt = sentMessages[1];
  assert.equal(receipt.to, request.email);
  assert.equal(receipt.subject, "Nous avons reçu votre demande de 500 crédits SmartPFE");
  assert.match(receipt.html, /Votre demande de crédits a bien été reçue/);
  assert.match(receipt.html, /Starter &lt;Premium&gt;/);
  assert.match(receipt.html, /125 TND/);
  assert.match(receipt.html, /href="https:\/\/smartpfe\.example\.test\/workspace\/settings\/credits\?request=request%2F42%3Fx%3D1"/);
  assert.match(receipt.text, /Starter <Premium>/);
  assert.match(receipt.text, /125 TND/);
  assert.match(receipt.text, /Mayssen <Admin>/);
});

test("credit-ready notice localizes copy and escapes recipient name without changing amounts", async () => {
  await emailService.sendPurchasedCreditsEmail({
    email: "student@example.test", fullName: "Alex <b>Student</b>", amount: 1250, balance: 1400, uiLanguage: "fr",
  });
  await emailService.sendPurchasedCreditsEmail({
    email: "student@example.test", fullName: "Alex", amount: 25, balance: 100, uiLanguage: "en",
  });

  assert.equal(sentMessages[0].subject, "1250 crédits SmartPFE sont prêts pour votre projet");
  assert.match(sentMessages[0].html, /Vos crédits sont prêts, Alex &lt;b&gt;Student&lt;\/b&gt;\./);
  assert.match(sentMessages[0].html, /\+1250/);
  assert.match(sentMessages[0].html, /Solde acheté : 1400 crédits/);
  assert.equal(sentMessages[1].subject, "25 SmartPFE credits are ready for your project");
  assert.match(sentMessages[1].html, /Your purchase has been confirmed/);
});

test("transactional mail without a language preference defaults to French", async () => {
  await emailService.sendEmailVerificationCode("student@example.test", "123456");
  await emailService.sendResetPasswordEmail("student@example.test", "reset-token");
  await emailService.sendPurchasedCreditsEmail({ email: "student@example.test", amount: 25, balance: 100 });
  assert.equal(sentMessages[0].subject, "Vérifiez votre adresse e-mail");
  assert.equal(sentMessages[1].subject, "Réinitialiser votre mot de passe");
  assert.equal(sentMessages[2].subject, "25 crédits SmartPFE sont prêts pour votre projet");
});

test("missing SMTP configuration preserves existing development fallback results", async () => {
  process.env.EMAIL_USER = "";
  process.env.EMAIL_PASS = "";
  process.env.NODE_ENV = "development";

  assert.deepEqual(await emailService.sendResetPasswordEmail("a@example.test", "token", "fr"), {
    devFallback: true,
    resetLink: "https://smartpfe.example.test/reset-password/token",
  });
  assert.deepEqual(await emailService.sendEmailVerificationCode("a@example.test", "123456", "fr"), {
    devFallback: true,
    verificationCode: "123456",
  });
  assert.deepEqual(await emailService.sendPurchasedCreditsEmail({ email: "a@example.test", amount: 2, balance: 2, uiLanguage: "fr" }), {
    devFallback: true,
    sent: false,
  });
  assert.deepEqual(await emailService.sendCreditPurchaseRequestEmail({ request: { _id: "r1" }, uiLanguage: "fr" }), {
    devFallback: true,
    sent: false,
  });
  assert.deepEqual(await emailService.sendCreditPurchaseReceiptEmail({ request: {}, uiLanguage: "fr" }), { sent: false });
});
