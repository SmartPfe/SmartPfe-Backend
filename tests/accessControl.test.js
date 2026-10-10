const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../src/models/User");
const Project = require("../src/models/Project");
const Notification = require("../src/models/Notification");
const adminRoutes = require("../src/routes/adminRoutes");
const projectRoutes = require("../src/routes/projectRoutes");
const aiRoutes = require("../src/routes/aiRoutes");
const authRoutes = require("../src/routes/authRoutes");
const notificationRoutes = require("../src/routes/notificationRoutes");

async function api(t, role = "etudiant") {
  const user = { _id: "64b64c8f4a7d2c0012345678", role, emailVerified: true,
    resetToken: "must-not-leak", password: "must-not-leak", emailVerificationCodeHash: "must-not-leak" };
  t.mock.method(User, "findById", () => ({ select: async () => user, then: (resolve, reject) => Promise.resolve(user).then(resolve, reject) }));
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRoutes);
  app.use("/projects", projectRoutes);
  app.use("/ai", aiRoutes);
  app.use("/auth", authRoutes);
  app.use("/notifications", notificationRoutes);
  const server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  // An attacker-controlled role claim must not override the database role.
  const token = jwt.sign({ id: user._id, role: "admin" }, process.env.JWT_SECRET || "default_super_secret_key");
  const request = async (path, method = "GET", body, bearer = token) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method, headers: { "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  request.user = user;
  return request;
}

test("sign out everywhere invalidates existing tokens", async t => {
  const request = await api(t);
  t.mock.method(User, 'updateOne', async (_filter, update) => { request.user.sessionVersion = update.$set.sessionVersion; });
  assert.equal((await request('/auth/profile')).status, 200);
  assert.equal((await request('/auth/logout-all', 'POST', {})).status, 200);
  assert.equal((await request('/auth/profile')).status, 401);
});

test("notification streaming requires an authorization header and rejects URL-only tokens", async t => {
  const request = await api(t);
  assert.equal((await request('/notifications/stream?token=some-token', 'GET', undefined, null)).status, 401);
  const response = await request('/notifications/stream');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /event: connected/);
  await reader.cancel();
});

test("password reset revokes old sessions", async t => {
  const request = await api(t);
  request.user.save = async () => {};
  t.mock.method(User, 'findOne', async () => request.user);
  assert.equal((await request('/auth/reset-password', 'POST', { token: 'reset-fixture', password: 'Strong-fixture-test1' })).status, 200);
  assert.ok(request.user.sessionVersion);
  assert.equal((await request('/auth/profile')).status, 401);
});

test("password change returns a usable replacement token and revokes the previous token", async t => {
  const request = await api(t);
  request.user.save = async () => {};
  request.user.matchPassword = async () => true;
  t.mock.method(Notification, 'create', async data => data);
  const response = await request('/auth/profile', 'PUT', { currentPassword: 'old-password', newPassword: 'New-fixture-password1' });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.token);
  assert.equal((await request('/auth/profile')).status, 401);
  assert.equal((await request('/auth/profile', 'GET', undefined, data.token)).status, 200);
});

test("all admin read/write endpoints deny students even with a signed admin role claim", async t => {
  const request = await api(t);
  for (const [method, path] of [
    ["GET", "/dashboard"], ["GET", "/users"], ["GET", "/projects"], ["GET", "/credits/economy"],
    ["PATCH", "/credits/policies/a"], ["PATCH", "/credits/settings"], ["POST", "/users/a/credits/adjust"],
    ["GET", "/users/a/credits"], ["GET", "/credit-requests"], ["GET", "/credit-requests/a"],
    ["PATCH", "/credit-requests/a/status"], ["POST", "/credit-requests/a/add-credits"],
  ]) assert.equal((await request(`/admin${path}`, method, method === "GET" ? undefined : {})).status, 403);
  assert.equal((await request("/admin/users", "GET", undefined, null)).status, 401);
  assert.equal((await request("/admin/users", "GET", undefined, "forged")).status, 401);
});

test("admins cannot use student project or AI APIs", async t => {
  const request = await api(t, "admin");
  assert.equal((await request("/projects/my-project")).status, 403);
  assert.equal((await request("/projects/onboarding", "POST", {})).status, 403);
  assert.equal((await request("/ai/actors/generate", "POST", {})).status, 403);
});

test("project IDs cannot access another student's data", async t => {
  const request = await api(t);
  let query;
  t.mock.method(Project, "findOne", async value => { query = value; return null; });
  assert.equal((await request("/projects/64b64c8f4a7d2c0012345679/actors")).status, 404);
  assert.deepEqual(query, { _id: "64b64c8f4a7d2c0012345679", user: "64b64c8f4a7d2c0012345678" });
});

test("completed onboarding cannot create another project", async t => {
  const request = await api(t);
  t.mock.method(Project, "exists", async () => true);
  const create = t.mock.method(Project, "create", async () => { throw new Error("Must not write"); });
  assert.equal((await request("/projects/onboarding", "POST", {})).status, 409);
  assert.equal(create.mock.callCount(), 0);
});

test("concurrent onboarding claims cannot both proceed and failure releases the claim", async t => {
  const request = await api(t);
  t.mock.method(Project, "exists", async () => false);
  let claimed = false;
  t.mock.method(User, "findOneAndUpdate", async filter => {
    assert.deepEqual(filter.hasCompletedOnboarding, { $ne: true });
    if (claimed) return null;
    claimed = true;
    return { _id: filter._id };
  });
  const release = t.mock.method(User, "updateOne", async () => { claimed = false; });
  const create = t.mock.method(Project, "create", async () => {
    // Keep the first claim held while another submission arrives.
    assert.equal((await request("/projects/onboarding", "POST", {})).status, 409);
    throw new Error("Simulated project validation failure");
  });
  assert.equal((await request("/projects/onboarding", "POST", {})).status, 500);
  assert.equal(create.mock.callCount(), 1);
  assert.equal(release.mock.callCount(), 1);
  assert.equal(claimed, false);
});

test("database administrator roles pass the admin gate", () => {
  const { adminOnly } = require("../src/middleware/authMiddleware");
  let passed = false;
  adminOnly({ user: { role: "admin" } }, {}, () => { passed = true; });
  assert.equal(passed, true);
});

test("profile omits secrets and structured authentication credentials are rejected", async t => {
  const request = await api(t);
  const profile = await (await request("/auth/profile")).json();
  for (const field of ["password", "resetToken", "emailVerificationCodeHash"]) assert.equal(field in profile, false);
  for (const [path, body] of [["/reset-password", { token: { $ne: null }, password: "test-password" }], ["/forgot-password", { email: { $ne: null } }]]) {
    assert.equal((await request(`/auth${path}`, "POST", body)).status, 400);
  }
});

test("public authentication attempts are rate limited", async t => {
  const request = await api(t);
  let response;
  for (let i = 0; i < 31; i++) response = await request("/auth/login", "POST", { email: {} });
  assert.equal(response.status, 429);
});
