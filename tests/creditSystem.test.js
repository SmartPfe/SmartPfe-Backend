const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DEFAULT_CREDIT_POLICIES, DEFAULT_CREDIT_SETTINGS, POLICY_BY_KEY } = require("../src/config/creditDefaults");
const CreditPolicy = require("../src/models/CreditPolicy");
const CreditWallet = require("../src/models/CreditWallet");

test("production launch economy matches the approved credit model", () => {
  assert.equal(DEFAULT_CREDIT_SETTINGS.welcomeCredits, 110);
  assert.equal(DEFAULT_CREDIT_SETTINGS.dailyPromotionalRefill, 20);
  assert.equal(DEFAULT_CREDIT_SETTINGS.timezone, "Africa/Tunis");

  const costs = Object.fromEntries(DEFAULT_CREDIT_POLICIES.map((policy) => [policy.key, policy.cost]));
  assert.equal(costs.problem_statement, 5);
  assert.equal(costs.actors, 5);
  assert.equal(costs.existing_solutions, 5);
  assert.equal(costs.functional_requirements, 5);
  assert.equal(costs.nonfunctional_requirements, 5);
  assert.equal(costs.product_backlog, 5);
  assert.equal(costs.uml_preparation, 5);
  assert.equal(costs.report_structure, 12);
  assert.equal(costs.report_section, 10);
  assert.equal(costs.presentation_full, 8);
  assert.equal(costs.pitch_full, 6);
  assert.equal(costs.jury_simulation, 20);
  assert.equal(costs.jury_qa_session, 10);
  assert.equal(costs.translation, 0);
  assert.equal(costs.final_report_compile, 0);
});

test("policy keys are unique and internal jury steps cannot be repriced", () => {
  const keys = DEFAULT_CREDIT_POLICIES.map((policy) => policy.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(POLICY_BY_KEY.jury_qa_included.editable, false);
  assert.equal(POLICY_BY_KEY.report_polish_contextual.freeUsesPerDay, 2);
});

test("wallet and policy schemas reject invalid negative balances and costs", async () => {
  const wallet = new CreditWallet({ user: "64b64c8f4a7d2c0012345678", promotionalBalance: -1 });
  await assert.rejects(wallet.validate(), /promotionalBalance/);

  const policy = new CreditPolicy({ key: "test", label: "Test", group: "Test", cost: -1 });
  await assert.rejects(policy.validate(), /cost/);
});

test("every AI POST route is protected by the credit gate", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "routes", "aiRoutes.js"), "utf8");
  const routes = source.split(/\r?\n/).filter((line) => line.trim().startsWith("router.post("));
  assert.ok(routes.length >= 35, `expected broad AI route coverage, found ${routes.length}`);
  for (const route of routes) {
    assert.match(route, /creditGate\(/, `missing credit gate: ${route.trim()}`);
  }
});

test("all static credit gates point to registered policies", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "routes", "aiRoutes.js"), "utf8");
  const staticKeys = [...source.matchAll(/creditGate\("([a-z_]+)"/g)].map((match) => match[1]);
  for (const key of staticKeys) assert.ok(POLICY_BY_KEY[key], `unregistered policy: ${key}`);
});
