const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../src/models/User");
const Notification = require("../src/models/Notification");
const CreditPurchaseRequest = require("../src/models/CreditPurchaseRequest");
const CreditTransaction = require("../src/models/CreditTransaction");
const { buildHistoryQuery } = require("../src/services/studentCreditHistoryService");
const creditRoutes = require("../src/routes/creditRoutes");

const student = { _id: "64b64c8f4a7d2c0012345678", fullName: "Student <example>", email: "student@example.invalid", role: "etudiant" };
const requestId = "64b64c8f4a7d2c0012345679";

async function fixtureServer(t) {
  t.mock.method(User, "findOne", () => ({ select: async () => null }));
  t.mock.method(User, "findById", () => ({ select: async () => student }));
  const app = express(); app.use(express.json()); app.use("/api/credits", creditRoutes);
  const server = await new Promise((resolve) => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const token = jwt.sign({ id: student._id }, process.env.JWT_SECRET || "default_super_secret_key");
  return async (path, options = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/credits${path}`, {
      ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
    });
    return { status: response.status, data: await response.json() };
  };
}

function mockRequestStorage(t) {
  const saved = [];
  t.mock.method(CreditPurchaseRequest, "create", async (payload) => {
    const doc = {
      ...payload, _id: requestId, createdAt: new Date("2026-10-03T12:00:00Z"),
      toObject() { const { save, toObject, ...plain } = this; return plain; },
      async save() { saved.push(this.toObject()); },
    };
    return doc;
  });
  return saved;
}

function configuredEmail(t, sendMail) {
  const previous = { EMAIL_USER: process.env.EMAIL_USER, EMAIL_PASS: process.env.EMAIL_PASS, EMAIL_FROM: process.env.EMAIL_FROM };
  Object.assign(process.env, { EMAIL_USER: "admin@example.invalid", EMAIL_PASS: "test-only-password", EMAIL_FROM: "admin@example.invalid" });
  t.after(() => Object.entries(previous).forEach(([key, value]) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; }));
  t.mock.method(nodemailer, "createTransport", () => ({ sendMail }));
}

test("submission persists a receipt, sends both emails and a linked student notification", async (t) => {
  const saved = mockRequestStorage(t); const mails = []; const notifications = [];
  configuredEmail(t, async (mail) => { mails.push(mail); });
  t.mock.method(Notification, "create", async (payload) => { notifications.push(payload); return payload; });
  const api = await fixtureServer(t);
  const result = await api("/requests", { method: "POST", body: JSON.stringify({ phone: "+216 20 123 456", packageKey: "credits_250" }) });
  assert.equal(result.status, 201);
  assert.equal(result.data.request.requestedCredits, 250);
  assert.equal(result.data.request.price, 12.5);
  assert.equal(result.data.request.status, "PENDING");
  assert.equal(result.data.studentEmailSent, true);
  assert.equal(result.data.notificationSent, true);
  assert.equal(saved[0].receiptEmailStatus, "sent");
  assert.ok(saved[0].receiptEmailSentAt instanceof Date);
  assert.equal(mails.length, 2);
  const receipt = mails.find((mail) => mail.to === student.email);
  assert.ok(receipt);
  assert.match(receipt.text, /team member will contact you/);
  assert.match(receipt.text, /After your payment is verified/);
  assert.match(receipt.text, /250/);
  assert.match(receipt.text, /12.5 TND/);
  assert.match(receipt.text, new RegExp(requestId));
  assert.ok(receipt.html.includes("Student &lt;example&gt;"));
  assert.equal(notifications[0].user, student._id);
  assert.equal(notifications[0].link, `/workspace/settings/credits?request=${requestId}`);
});

test("SMTP failure still returns the saved request, notification and honest receipt status", async (t) => {
  const saved = mockRequestStorage(t);
  configuredEmail(t, async () => { throw new Error("simulated SMTP outage"); });
  t.mock.method(Notification, "create", async (payload) => payload);
  const api = await fixtureServer(t);
  const result = await api("/requests", { method: "POST", body: JSON.stringify({ phone: "20123456", credits: 125 }) });
  assert.equal(result.status, 201);
  assert.equal(result.data.request.status, "PENDING");
  assert.equal(result.data.studentEmailSent, false);
  assert.equal(result.data.emailDeliveryWarning, true);
  assert.equal(result.data.notificationSent, true);
  assert.equal(saved[0].receiptEmailStatus, "failed");
});

test("history applies ownership, filters and stable pagination at the API boundary", async (t) => {
  let captured; let offset; let countQuery; let ordering;
  t.mock.method(CreditPurchaseRequest, "find", (query) => {
    captured = query;
    const chain = { sort(value) { ordering = value; return this; }, skip(value) { offset = value; return this; }, limit() { return this; }, async lean() { return [{ _id: requestId, user: student._id, status: "PENDING" }]; } };
    return chain;
  });
  t.mock.method(CreditPurchaseRequest, "countDocuments", async (query) => { countQuery = query; return 25; });
  const api = await fixtureServer(t);
  const result = await api("/history?section=requests&page=2&limit=10&status=PENDING&dateFrom=2026-10-01&dateTo=2026-10-03&search=250&userId=someone-else");
  assert.equal(result.status, 200);
  assert.equal(captured.user, student._id);
  assert.equal(captured.status, "PENDING");
  assert.equal(captured.createdAt.$gte.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(captured.createdAt.$lt.toISOString(), "2026-10-04T00:00:00.000Z");
  assert.ok(captured.$or.some((condition) => condition.requestedCredits === 250));
  assert.deepEqual(countQuery, captured);
  assert.deepEqual(ordering, { createdAt: -1, _id: -1 });
  assert.equal(offset, 10);
  assert.equal(result.data.total, 25);
  assert.equal(result.data.pages, 3);
  assert.equal(result.data.page, 2);
});

test("transaction history selects its own model and validates kind/status filters", async (t) => {
  let captured;
  t.mock.method(CreditTransaction, "find", (query) => {
    captured = query;
    return { sort() { return this; }, skip() { return this; }, limit() { return this; }, async lean() { return []; } };
  });
  t.mock.method(CreditTransaction, "countDocuments", async () => 0);
  const api = await fixtureServer(t);
  const result = await api("/history?section=transactions&status=settled&kind=usage");
  assert.equal(result.status, 200);
  assert.deepEqual(captured, { user: student._id, status: "settled", kind: "usage" });
  assert.equal((await api("/history?section=transactions&status=COMPLETED")).status, 400);
});

test("request detail cannot expose another student's request and requires authentication", async (t) => {
  let captured;
  t.mock.method(CreditPurchaseRequest, "findOne", (query) => { captured = query; return { lean: async () => null }; });
  const api = await fixtureServer(t);
  assert.equal((await api(`/requests/${requestId}`)).status, 404);
  assert.deepEqual(captured, { _id: requestId, user: student._id });
  assert.equal((await api("/requests/not-an-id")).status, 404);
  assert.equal((await api("/history", { headers: { Authorization: "" } })).status, 401);
});

test("invalid dates are rejected and search punctuation is treated literally", () => {
  assert.throws(() => buildHistoryQuery({ userId: student._id, dateFrom: "2026-02-30" }), /valid date/);
  assert.throws(() => buildHistoryQuery({ userId: student._id, dateFrom: "2026-10-03", dateTo: "2026-10-01" }), /end date/);
  const query = buildHistoryQuery({ userId: student._id, search: "[.*]" });
  assert.ok(query.$or[0].packageLabel.test("[.*]"));
  assert.equal(query.$or[0].packageLabel.test("anything"), false);
});
