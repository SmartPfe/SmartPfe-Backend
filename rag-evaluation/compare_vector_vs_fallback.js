const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { spawn } = require("child_process");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { dataset } = require("./dataset");
const { getReportStructureRagContext, buildRetrievalQuery } = require("../src/services/reportStructureRagService");
const { buildReportStructureGenerationPrompt } = require("../src/services/reportStructurePromptBuilder");
const { callOpenRouter } = require("../src/services/openRouterService");
const { normalizeSections } = require("../src/services/reportStructureService");

const extractJsonPayload = (content) => {
  const text = String(content || "").trim();
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : text;
  if (candidate.startsWith("{")) return candidate;
  const objectStart = candidate.indexOf("{");
  const objectEnd = candidate.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) return candidate.slice(objectStart, objectEnd + 1);
  return candidate;
};

const parseReportStructure = (content) => {
  try {
    const raw = JSON.parse(extractJsonPayload(content));
    return normalizeSections(Array.isArray(raw) ? raw : raw.reportStructure || []);
  } catch (e) {
    return [];
  }
};

async function main() {
  console.info("=================================================");
  console.info("  VECTOR SEARCH VS FALLBACK COMPARISON (CASES 1-8)");
  console.info("=================================================");

  const casesToTest = dataset.slice(0, 8);
  console.info(`Testing ${casesToTest.length} cases with native Atlas Vector Search...`);

  await mongoose.connect(process.env.MONGO_URI);
  console.info("MongoDB connected.");

  const vectorRuns = [];

  for (let i = 0; i < casesToTest.length; i++) {
    const testCase = casesToTest[i];
    console.info(`\n[${i + 1}/${casesToTest.length}] ${testCase.id}: ${testCase.title}`);
    
    const startTime = Date.now();
    const query = buildRetrievalQuery(testCase.project);
    
    console.info(`  -> Running Native Vector Search...`);
    const ragContext = await getReportStructureRagContext(testCase.project, `vector-eval-${testCase.id}`);
    const retrievalTimeMs = Date.now() - startTime;
    
    console.info(`  -> Retrieved ${ragContext.length} chars in ${retrievalTimeMs}ms`);

    console.info(`  -> Generating LLM report structure...`);
    const prompt = buildReportStructureGenerationPrompt(testCase.project, ragContext);
    let rawResponse = "";
    let parsedSections = [];
    let genTimeMs = 0;

    try {
      const genStart = Date.now();
      rawResponse = await callOpenRouter(prompt);
      genTimeMs = Date.now() - genStart;
      parsedSections = parseReportStructure(rawResponse);
      console.info(`  -> Generated ${parsedSections.length} chapters in ${genTimeMs}ms`);
    } catch (e) {
      console.error(`  -> Generation error:`, e.message);
    }

    vectorRuns.push({
      id: testCase.id,
      title: testCase.title,
      domain: testCase.domain,
      language: testCase.language,
      query,
      retrieved_context: ragContext,
      retrieval_chars: ragContext.length,
      retrieval_time_ms: retrievalTimeMs,
      generation_time_ms: genTimeMs,
      generated_response: rawResponse,
      generated_sections: parsedSections,
      ground_truth: testCase.ground_truth,
    });
  }

  await mongoose.disconnect();
  console.info("\nMongoDB disconnected. Computing metrics comparison...");

  // Save intermediate vector runs
  const vectorRunsPath = path.join(__dirname, "vector_runs_subset.json");
  fs.writeFileSync(vectorRunsPath, JSON.stringify(vectorRuns, null, 2), "utf-8");

  // Run Python evaluator on the vector runs
  const pythonScript = path.join(__dirname, "compare_metrics.py");
  
  await new Promise((resolve, reject) => {
    const py = spawn("python", [pythonScript], {
      cwd: __dirname,
      stdio: "inherit",
      windowsHide: true,
    });

    py.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Python script exited with code ${code}`));
    });

    py.on("error", (err) => reject(err));
  });
}

main().catch((err) => {
  console.error("Comparison error:", err);
  process.exit(1);
});
