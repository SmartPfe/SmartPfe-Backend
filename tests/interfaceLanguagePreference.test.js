const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../src/models/User");
const Notification = require("../src/models/Notification");
const authRoutes = require("../src/routes/authRoutes");

const userId = "64b64c8f4a7d2c0012345678";

async function makeApi(t, userOverrides = {}) {
  const user = {
    _id: userId,
    fullName: "Test User",
    email: "test@example.invalid",
    role: "etudiant",
    ...userOverrides,
  };
  const writes = [];
  const notifications = [];
  const query = {
    select: async () => user,
    then: (resolve, reject) => Promise.resolve(user).then(resolve, reject),
  };

  t.mock.method(User, "findById", () => query);
  t.mock.method(User, "findByIdAndUpdate", async (...args) => {
    writes.push(args);
    user.uiLanguage = args[1].$set.uiLanguage;
    return user;
  });
  t.mock.method(Notification, "create", async (payload) => {
    notifications.push(payload);
    return payload;
  });

  const app = express();
  app.use(express.json());
  app.use("/auth", authRoutes);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  t.after(() => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  }));

  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET || "default_super_secret_key");
  const api = async (path, options = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/auth${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    return { status: response.status, data: await response.json() };
  };

  return { api, user, writes, notifications };
}

test("preference schema allows only en/fr and defaults to French", () => {
  const path = User.schema.path("uiLanguage");
  assert.deepEqual(path.enumValues, ["en", "fr"]);
  assert.equal(path.defaultValue, "fr");
});

test("GET preferences defaults missing preferences to French, including Google accounts", async (t) => {
  const { api } = await makeApi(t, { googleId: "google-user-id" });
  const result = await api("/preferences");
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { uiLanguage: "fr" });
});

test("GET preferences preserves an existing English choice without writing", async (t) => {
  const { api, writes } = await makeApi(t, { uiLanguage: "en" });
  const result = await api("/preferences");
  assert.deepEqual(result.data, { uiLanguage: "en" });
  assert.equal(writes.length, 0);
});

test("PUT preferences updates only uiLanguage and supports Google accounts without notifications", async (t) => {
  const { api, user, writes, notifications } = await makeApi(t, { googleId: "google-user-id" });
  const result = await api("/preferences", {
    method: "PUT",
    body: JSON.stringify({ uiLanguage: "fr", fullName: "Changed", role: "admin" }),
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { uiLanguage: "fr" });
  assert.equal(user.fullName, "Test User");
  assert.equal(user.role, "etudiant");
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], userId);
  assert.deepEqual(writes[0][1], { $set: { uiLanguage: "fr" } });
  assert.deepEqual(writes[0][2], { new: true, runValidators: true });
  assert.equal(notifications.length, 0);
});

test("PUT preferences rejects unsupported values without writing", async (t) => {
  const { api, writes } = await makeApi(t);
  const result = await api("/preferences", {
    method: "PUT",
    body: JSON.stringify({ uiLanguage: "ar" }),
  });

  assert.equal(result.status, 400);
  assert.equal(writes.length, 0);
});
