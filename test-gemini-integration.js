const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { callGemini, callAI, MODEL_TIERS } = require("./src/services/geminiService");
const { callOpenRouter } = require("./src/services/openRouterService");
const { generateActors } = require("./src/services/actorService");
const { generateFunctionalRequirements } = require("./src/services/functionalRequirementService");
const { generateUmlPreparation } = require("./src/services/umlPreparationService");
const { generateReportStructure } = require("./src/services/reportStructureService");

const mockProject = {
  basics: {
    title: "SmartPFE: Plateforme Intelligente d'Accompagnement des Projets de Fin d'Études",
    type: "Web Application & SaaS",
    domain: "Génie Logiciel & Intelligence Artificielle",
    language: "French",
    university: "École Supérieure d'Ingénieurs",
    academicYear: "2025-2026",
  },
  description: {
    problemStatement: "Les étudiants en ingénierie rencontrent des difficultés méthodologiques et rédactionnelles lors de la rédaction de leurs mémoires de PFE.",
    objective: "Fournir un mentor virtuel IA pour guider la rédaction, la modélisation UML et la préparation de la soutenance.",
    deliverables: ["Application Web", "Rapport de PFE", "Code Source"],
  },
  technicalContext: {
    technologies: ["Node.js", "Express", "MongoDB", "React", "TypeScript", "Tailwind CSS"],
    developmentTypes: ["Fullstack Web Application", "REST API"],
    methodology: "Scrum",
    teamSize: "2",
    duration: "6",
  },
};

async function runTests() {
  console.log("=================================================");
  console.log("🚀 STARTING SMARTPFE GEMINI INTEGRATION TESTS");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Fast Tier
  try {
    console.log("▶ TEST 1: Fast Tier (gemini-2.5-flash-lite / gemini-3.5-flash-lite)...");
    const t0 = Date.now();
    const res = await callGemini("Traduire en anglais : 'Bonjour le monde'", null, { tier: "fast" });
    const dt = Date.now() - t0;
    console.log(`  ✅ Fast Tier Response (${dt}ms): "${res.trim()}"`);
    passed++;
  } catch (err) {
    console.error(`  ❌ Fast Tier Failed:`, err.message);
    failed++;
  }

  // Test 2: Default Tier
  try {
    console.log("\n▶ TEST 2: Default Tier (gemini-2.5-flash / gemini-3.5-flash)...");
    const t0 = Date.now();
    const res = await callGemini("Donne une brève définition académique du concept de RAG en 2 phrases.", null, { tier: "default" });
    const dt = Date.now() - t0;
    console.log(`  ✅ Default Tier Response (${dt}ms):\n${res.trim()}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ Default Tier Failed:`, err.message);
    failed++;
  }

  // Test 3: Reasoning Tier
  try {
    console.log("\n▶ TEST 3: Reasoning Tier (gemini-3.7-flash / gemini-2.5-flash)...");
    const t0 = Date.now();
    const res = await callGemini("Explique brièvement la différence entre composition et agrégation en UML.", null, { tier: "reasoning" });
    const dt = Date.now() - t0;
    console.log(`  ✅ Reasoning Tier Response (${dt}ms):\n${res.trim()}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ Reasoning Tier Failed:`, err.message);
    failed++;
  }

  // Test 4: Backwards Compatibility Bridge
  try {
    console.log("\n▶ TEST 4: Backwards-Compatibility Bridge (openRouterService.callOpenRouter)...");
    const t0 = Date.now();
    const res = await callOpenRouter("Say 'Compatibility Verified' if you receive this.");
    const dt = Date.now() - t0;
    console.log(`  ✅ Bridge Response (${dt}ms): "${res.trim()}"`);
    passed++;
  } catch (err) {
    console.error(`  ❌ Bridge Failed:`, err.message);
    failed++;
  }

  // Test 5: Problem Statement Generation (callAI)
  try {
    console.log("\n▶ TEST 5: Problem Statement Generation via callAI('generate', project)...");
    const t0 = Date.now();
    const res = await callAI("generate", mockProject);
    const dt = Date.now() - t0;
    console.log(`  ✅ Problem Statement (${dt}ms, length=${res.length} chars):\n${res.slice(0, 300)}...`);
    passed++;
  } catch (err) {
    console.error(`  ❌ Problem Statement Generation Failed:`, err.message);
    failed++;
  }

  // Test 6: Actor Generation & JSON Parsing
  try {
    console.log("\n▶ TEST 6: Actor Generation & JSON Schema Normalization...");
    const t0 = Date.now();
    const actors = await generateActors(mockProject);
    const dt = Date.now() - t0;
    console.log(`  ✅ Generated ${actors.length} actors (${dt}ms):`);
    actors.forEach((a, i) => console.log(`    ${i + 1}. [${a.type}] ${a.name} (${a.icon}): ${a.description}`));
    if (actors.length > 0) passed++;
    else throw new Error("0 actors returned");
  } catch (err) {
    console.error(`  ❌ Actor Generation Failed:`, err.message);
    failed++;
  }

  // Test 7: Functional Requirements Generation
  try {
    console.log("\n▶ TEST 7: Functional Requirements Generation...");
    const t0 = Date.now();
    const reqs = await generateFunctionalRequirements(mockProject);
    const dt = Date.now() - t0;
    console.log(`  ✅ Generated ${reqs.length} functional requirements (${dt}ms):`);
    reqs.slice(0, 3).forEach((r) => console.log(`    - ${r.code || "RF"}: ${r.title} [${r.priority}]`));
    if (reqs.length > 0) passed++;
    else throw new Error("0 requirements returned");
  } catch (err) {
    console.error(`  ❌ Functional Requirements Generation Failed:`, err.message);
    failed++;
  }

  // Test 8: UML Preparation & Diagrams (Reasoning Tier)
  try {
    console.log("\n▶ TEST 8: UML Preparation (Classes & Relationships)...");
    const t0 = Date.now();
    const uml = await generateUmlPreparation(mockProject, "class");
    const dt = Date.now() - t0;
    console.log(`  ✅ Generated ${uml.classes?.length || 0} classes & ${uml.relationships?.length || 0} relationships (${dt}ms):`);
    (uml.classes || []).slice(0, 3).forEach((c) => console.log(`    - Class: ${c.name} (${c.attributes?.length || 0} attrs, ${c.methods?.length || 0} methods)`));
    if (uml.classes?.length > 0) passed++;
    else throw new Error("0 UML classes returned");
  } catch (err) {
    console.error(`  ❌ UML Preparation Failed:`, err.message);
    failed++;
  }

  console.log("\n=================================================");
  console.log(`🏁 TEST SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
