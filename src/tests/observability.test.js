/**
 * Test: Langfuse User Context Tracking
 * ------------------------------------
 * Verifies that observabilityContextMiddleware correctly captures req.user
 * from a simulated Express request, and that createTrace() uses the real
 * user identity (email) instead of "anonymous".
 *
 * Run with: node src/tests/observability.test.js
 * (No test framework needed — plain Node assertions)
 */

"use strict";

const assert = require("assert");

// ─── 1. Minimal .env shim (no real keys needed for this test) ───────────────
process.env.LANGFUSE_SECRET_KEY = "sk-test-fake";
process.env.LANGFUSE_PUBLIC_KEY = "pk-test-fake";
process.env.LANGFUSE_BASE_URL = "http://localhost:9999"; // unreachable on purpose

// ─── 2. Mock Langfuse so we capture what gets sent without real API calls ───
let lastTraceCall = null;

// Intercept the `langfuse` module
const Module = require("module");
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "langfuse") {
    return {
      Langfuse: class MockLangfuse {
        constructor(cfg) { this.cfg = cfg; }
        trace(params) {
          lastTraceCall = params;
          return {
            generation: () => ({ end: () => {} }),
            span: () => ({ end: () => {} }),
            event: () => {},
            update: () => {},
          };
        }
        async flushAsync() {}
      },
    };
  }
  return originalLoad.call(this, request, ...rest);
};

// ─── 3. Load the real service AFTER the mock is in place ────────────────────
const {
  observabilityContextMiddleware,
  getCurrentUserContext,
  createTrace,
} = require("../services/observabilityService");

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeFakeReq(user) {
  return { user };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

async function test_noContext_returnsNull() {
  // Called OUTSIDE of any middleware → should return null
  const ctx = getCurrentUserContext();
  assert.strictEqual(ctx, null, "Outside middleware context should be null");
  console.log("  ✅ test_noContext_returnsNull passed");
}

async function test_withUser_capturesEmail() {
  const fakeUser = {
    _id: "64abc123def456",
    email: "student@essat.tn",
    fullName: "Ahmed Ben Ali",
    role: "student",
  };

  await new Promise((resolve) => {
    observabilityContextMiddleware(makeFakeReq(fakeUser), {}, () => {
      const ctx = getCurrentUserContext();
      assert.ok(ctx, "Context should not be null inside middleware");
      assert.strictEqual(ctx.userId, "student@essat.tn", `userId should be email, got: ${ctx.userId}`);
      assert.strictEqual(ctx.userName, "Ahmed Ben Ali");
      assert.strictEqual(ctx.userRole, "student");
      assert.strictEqual(ctx.userMongoId, "64abc123def456");
      resolve();
    });
  });

  console.log("  ✅ test_withUser_capturesEmail passed");
}

async function test_createTrace_usesEmailAsUserId() {
  const fakeUser = {
    _id: "64abc999xyz789",
    email: "hamza@smartpfe.io",
    fullName: "Hamza Recruiter",
    role: "student",
  };

  lastTraceCall = null;

  await new Promise((resolve) => {
    observabilityContextMiddleware(makeFakeReq(fakeUser), {}, () => {
      createTrace({
        name: "test-chapter-generation",
        metadata: { chapter: "Introduction" },
        tags: ["test"],
      });
      resolve();
    });
  });

  assert.ok(lastTraceCall, "Langfuse.trace() should have been called");
  assert.strictEqual(
    lastTraceCall.userId,
    "hamza@smartpfe.io",
    `userId in Langfuse trace should be email, got: ${lastTraceCall?.userId}`
  );
  assert.strictEqual(lastTraceCall.name, "test-chapter-generation");
  assert.strictEqual(lastTraceCall.metadata?.userName, "Hamza Recruiter");
  assert.strictEqual(lastTraceCall.metadata?.userRole, "student");
  console.log("  ✅ test_createTrace_usesEmailAsUserId passed");
}

async function test_createTrace_fallsBackToAnonymous() {
  // No middleware → no user in store
  lastTraceCall = null;

  createTrace({ name: "no-user-trace" });

  assert.ok(lastTraceCall, "Langfuse.trace() should still be called");
  assert.strictEqual(
    lastTraceCall.userId,
    "anonymous",
    `userId should fall back to 'anonymous', got: ${lastTraceCall?.userId}`
  );
  console.log("  ✅ test_createTrace_fallsBackToAnonymous passed");
}

async function test_userWithoutEmail_usesMongoId() {
  const fakeUser = {
    _id: "64bbb111ccc222",
    // no email field
    fullName: "Ghost User",
    role: "student",
  };

  await new Promise((resolve) => {
    observabilityContextMiddleware(makeFakeReq(fakeUser), {}, () => {
      const ctx = getCurrentUserContext();
      assert.strictEqual(
        ctx.userId,
        "64bbb111ccc222",
        `Without email, userId should fall back to _id string, got: ${ctx?.userId}`
      );
      resolve();
    });
  });

  console.log("  ✅ test_userWithoutEmail_usesMongoId passed");
}

// ─── Runner ──────────────────────────────────────────────────────────────────

(async () => {
  console.log("\n🔬 Running Langfuse User Context Tests...\n");
  let passed = 0;
  let failed = 0;

  const tests = [
    test_noContext_returnsNull,
    test_withUser_capturesEmail,
    test_createTrace_usesEmailAsUserId,
    test_createTrace_fallsBackToAnonymous,
    test_userWithoutEmail_usesMongoId,
  ];

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (err) {
      console.error(`  ❌ ${test.name} FAILED:`, err.message);
      failed++;
    }
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`─────────────────────────────────────\n`);

  process.exit(failed > 0 ? 1 : 0);
})();
