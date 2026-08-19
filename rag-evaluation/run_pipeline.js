const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { spawn } = require("child_process");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { dataset } = require("./dataset");
const { getReportStructureRagContext, buildRetrievalQuery } = require("../src/services/reportStructureRagService");
const { buildReportStructureGenerationPrompt } = require("../src/services/reportStructurePromptBuilder");
const { callGemini } = require("../src/services/geminiService");
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
  console.info("  SMARTPFE RAG BASELINE EVALUATION PIPELINE");
  console.info("=================================================");

  // 1. Save dataset.json
  const datasetJsonPath = path.join(__dirname, "dataset.json");
  fs.writeFileSync(datasetJsonPath, JSON.stringify(dataset, null, 2), "utf-8");
  console.info(`[Step 1/4] Saved dataset with ${dataset.length} test cases to ${datasetJsonPath}`);

  // 2. Connect to DB
  console.info(`[Step 2/4] Connecting to MongoDB to run CURRENT RAG retrieval...`);
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in .env");
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.info("MongoDB connected successfully.");

  const evaluationRuns = [];

  for (let i = 0; i < dataset.length; i++) {
    const testCase = dataset[i];
    console.info(`\n-------------------------------------------------`);
    console.info(`[Case ${i + 1}/${dataset.length}] ${testCase.id}: ${testCase.title} (${testCase.language})`);
    
    const startTime = Date.now();
    const query = buildRetrievalQuery(testCase.project);
    
    console.info(`-> Running Current RAG Retrieval...`);
    const ragContext = await getReportStructureRagContext(testCase.project, `eval-${testCase.id}`);
    const retrievalTimeMs = Date.now() - startTime;
    
    console.info(`-> RAG Context: ${ragContext.length} chars (retrieved in ${retrievalTimeMs}ms)`);

    // Build Prompt & Call LLM
    console.info(`-> Generating report structure via Gemini LLM...`);
    const prompt = buildReportStructureGenerationPrompt(testCase.project, ragContext);
    let rawResponse = "";
    let parsedSections = [];
    let generationTimeMs = 0;
    
    try {
      const genStart = Date.now();
      rawResponse = await callGemini(prompt);
      generationTimeMs = Date.now() - genStart;
      parsedSections = parseReportStructure(rawResponse);
      console.info(`-> Generated ${parsedSections.length} top-level chapters in ${generationTimeMs}ms`);
    } catch (genErr) {
      console.error(`-> Generation error for ${testCase.id}:`, genErr.message);
    }

    evaluationRuns.push({
      id: testCase.id,
      title: testCase.title,
      domain: testCase.domain,
      language: testCase.language,
      query,
      retrieved_context: ragContext,
      retrieval_chars: ragContext.length,
      retrieval_time_ms: retrievalTimeMs,
      generation_time_ms: generationTimeMs,
      generated_response: rawResponse,
      generated_sections: parsedSections,
      ground_truth: testCase.ground_truth,
    });
  }

  await mongoose.disconnect();
  console.info("\n[Step 3/4] MongoDB disconnected. Running Ragas / Python Evaluation Engine...");

  // Save intermediate retrieval data
  const rawResultsPath = path.join(__dirname, "results", "raw_runs.json");
  fs.writeFileSync(rawResultsPath, JSON.stringify(evaluationRuns, null, 2), "utf-8");

  // 3. Run Python evaluation script
  const pythonScript = path.join(__dirname, "evaluate_ragas.py");
  
  await new Promise((resolve, reject) => {
    const py = spawn("python", [pythonScript], {
      cwd: __dirname,
      stdio: "inherit",
      windowsHide: true,
    });

    py.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Python evaluation exited with code ${code}`));
      }
    });

    py.on("error", (err) => reject(err));
  });

  console.info("\n[Step 4/4] Evaluation Completed Successfully!");
  console.info(`Outputs saved in: ${__dirname}`);
}

main().catch((err) => {
  console.error("FATAL ERROR in evaluation pipeline:", err);
  process.exit(1);
});
