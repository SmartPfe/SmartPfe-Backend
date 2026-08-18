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
  console.info("  SELF-CORRECTING RAG (CRAG) BENCHMARK: CASES 1-8");
  console.info("=================================================");

  const casesToTest = dataset.slice(0, 8);
  console.info(`Running Self-Correcting RAG on ${casesToTest.length} cases...`);

  await mongoose.connect(process.env.MONGO_URI);
  console.info("MongoDB connected.");

  const cragRuns = [];

  for (let i = 0; i < casesToTest.length; i++) {
    const testCase = casesToTest[i];
    console.info(`\n-------------------------------------------------`);
    console.info(`[${i + 1}/${casesToTest.length}] ${testCase.id}: ${testCase.title} (${testCase.language})`);
    
    const startTime = Date.now();
    const query = buildRetrievalQuery(testCase.project);
    
    console.info(`  -> Running CRAG Pipeline with Self-Correction Grader...`);
    const { context: ragContext, trace } = await getReportStructureRagContext(
      testCase.project,
      `crag-eval-${testCase.id}`,
      { returnTrace: true }
    );
    const retrievalTimeMs = Date.now() - startTime;
    
    console.info(`  -> CRAG Trace: Pass 1 Score = ${trace.pass1?.score} (${trace.pass1?.status}) | Triggered CRAG Rewrite = ${trace.cragTriggered ? "YES (Score < 0.65)" : "NO (Passed on 1st query)"}`);
    if (trace.cragTriggered) {
      console.info(`  -> Pass 2 Score = ${trace.pass2?.score} (${trace.pass2?.status}) | Adopted Pass = ${trace.adoptedPass}`);
    }
    console.info(`  -> Final Retrieved Context: ${ragContext.length} chars (retrieved in ${retrievalTimeMs}ms)`);

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
      console.info(`  -> Generated ${parsedSections.length} top-level chapters in ${genTimeMs}ms`);
    } catch (e) {
      console.error(`  -> Generation error:`, e.message);
    }

    cragRuns.push({
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
      crag_trace: trace,
      ground_truth: testCase.ground_truth,
    });
  }

  await mongoose.disconnect();
  console.info("\nMongoDB disconnected. Running Python comparison evaluator...");

  const cragRunsPath = path.join(__dirname, "crag_runs_subset.json");
  fs.writeFileSync(cragRunsPath, JSON.stringify(cragRuns, null, 2), "utf-8");

  const pythonScript = path.join(__dirname, "compare_crag_results.py");
  
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
  console.error("Benchmark error:", err);
  process.exit(1);
});
