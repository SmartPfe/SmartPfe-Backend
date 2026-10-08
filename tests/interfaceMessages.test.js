const test = require("node:test");
const assert = require("node:assert/strict");
const Project = require("../src/models/Project");
const juryQAService = require("../src/services/juryQAService");
const reportStudioService = require("../src/services/reportStudioService");
const {
  CREDIT_ERROR_KEYS,
  creditErrorMetadata,
  interfaceError,
  withCreditErrorMetadata,
  withErrorMessageMetadata,
  withMessageMetadata,
} = require("../src/lib/interfaceMessages");

test("static message metadata is additive and leaves legacy response fields intact", () => {
  const body = { message: "Legacy response text", code: "INVALID", detail: "kept" };
  assert.deepEqual(withMessageMetadata(body, "auth.invalidCredentials"), {
    message: "Legacy response text",
    code: "INVALID",
    detail: "kept",
    messageKey: "auth.invalidCredentials",
  });
  assert.deepEqual(withMessageMetadata(body, "contact.sent", { name: "Ada" }), {
    message: "Legacy response text",
    code: "INVALID",
    detail: "kept",
    messageKey: "contact.sent",
    messageParams: { name: "Ada" },
  });
});

test("known CreditError codes receive explicit keys and only allowlisted display parameters", () => {
  const error = {
    code: "INSUFFICIENT_CREDITS",
    message: "Not enough credits for this action.",
    details: { required: 7, balance: 2, actionKey: "report_section", internal: "do not expose" },
  };
  const body = withCreditErrorMetadata({ message: error.message, code: error.code }, error);
  assert.deepEqual(body, {
    message: error.message,
    code: error.code,
    messageKey: "credits.insufficientCredits",
    messageParams: { required: 7, balance: 2, actionKey: "report_section" },
  });
  assert.ok(Object.keys(CREDIT_ERROR_KEYS).length > 20);
});

test("unknown errors do not receive metadata or alter their raw message", () => {
  const error = { code: "PROVIDER_CUSTOM_ERROR", message: "A provider supplied this exact message." };
  assert.equal(creditErrorMetadata(error), null);
  assert.deepEqual(withCreditErrorMetadata({ message: error.message }, error), { message: error.message });
  assert.deepEqual(withMessageMetadata({ message: error.message }, undefined), { message: error.message });
});

test("explicit interface errors keep legacy text and pass only trusted metadata through", () => {
  const error = interfaceError("Jury session missing.", "jury.sessionNotFound", { section: "saved title" });
  assert.ok(error instanceof Error);
  assert.equal(error.message, "Jury session missing.");
  assert.deepEqual(withErrorMessageMetadata({ message: error.message }, error), {
    message: "Jury session missing.",
    messageKey: "jury.sessionNotFound",
    messageParams: { section: "saved title" },
  });

  const unknown = new Error("Unrecognized provider text");
  assert.deepEqual(withErrorMessageMetadata({ message: unknown.message }, unknown, "ai.generationFailed"), {
    message: "Unrecognized provider text",
  });
});

test("known jury and report validation errors carry keys without writing project data", async (t) => {
  let projectResult = { jurySimulation: { qaSessions: [] } };
  const findOne = t.mock.method(Project, "findOne", async () => projectResult);

  await assert.rejects(
    juryQAService.getJuryQASession("user-id", "project-id", "missing-session"),
    (error) => error.messageKey === "jury.sessionNotFound" && error.message === "Jury Q&A session was not found."
  );

  projectResult = null;
  await assert.rejects(
    reportStudioService.getReportChapters("user-id", "project-id"),
    (error) => error.messageKey === "project.notFound" && error.message === "Project not found for this user."
  );
  assert.equal(findOne.mock.calls.length, 2);
});
