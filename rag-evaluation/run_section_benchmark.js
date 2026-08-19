const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { spawn } = require("child_process");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { sectionDataset } = require("./section_dataset");
const { getSectionRagContext, buildSectionRetrievalQuery } = require("../src/services/reportStudioRagService");
const { buildChapterGenerationPrompt } = require("../src/services/reportStudioPromptBuilder");
const { callGemini } = require("../src/services/geminiService");
const { normalizeChapter } = require("../src/services/reportStudioService");

const extractJsonPayload = (content) => {
  const text = String(content || "").trim();
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : text;
  const objectStart = candidate.indexOf("{");
  const objectEnd = candidate.lastIndexOf("}");
  const json = objectStart !== -1 && objectEnd > objectStart ? candidate.slice(objectStart, objectEnd + 1) : candidate;

  try {
    const parsed = JSON.parse(json);
    return parsed.chapter || parsed;
  } catch (error) {
    return { contentMarkdown: text, contentHtml: `<p>${text}</p>` };
  }
};

const normalizeChapterLocal = (ch = {}) => {
  const contentMarkdown = String(ch.contentMarkdown || "").trim();
  const contentHtml = String(ch.contentHtml || (contentMarkdown ? `<p>${contentMarkdown}</p>` : "")).trim();
  return {
    contentMarkdown,
    contentHtml,
    sectionId: String(ch.sectionId || "").trim(),
    title: String(ch.title || "").trim(),
  };
};

async function main() {
  console.info("=================================================");
  console.info("  REPORT BUILDER: SECTION-LEVEL CRAG BENCHMARK");
  console.info("=================================================");
  console.info(`Evaluating ${sectionDataset.length} diverse PFE section test cases...`);

  await mongoose.connect(process.env.MONGO_URI);
  console.info("MongoDB connected.");

  const sectionRuns = [];

  for (let i = 0; i < sectionDataset.length; i++) {
    const testCase = sectionDataset[i];
    console.info(`\n-------------------------------------------------`);
    console.info(`[${i + 1}/${sectionDataset.length}] ${testCase.id}: "${testCase.targetSection.title}" (${testCase.language})`);
    console.info(`  Domain: ${testCase.project.basics.domain}`);

    const startTime = Date.now();
    const query = buildSectionRetrievalQuery(testCase.project, testCase.targetSection);

    console.info(`  -> Running Section CRAG Pipeline...`);
    const { context: ragContext, trace } = await getSectionRagContext(
      testCase.project,
      testCase.targetSection,
      `benchmark-${testCase.id}`,
      { returnTrace: true }
    );
    const retrievalTimeMs = Date.now() - startTime;

    console.info(`  -> CRAG Trace: Pass 1 Score = ${trace.pass1?.score} (${trace.pass1?.status}) | Top Vector = ${trace.pass1?.topVectorScore}`);
    console.info(`  -> CRAG Rewrite Triggered: ${trace.cragTriggered ? "YES" : "NO"}`);
    if (trace.cragTriggered) {
      console.info(`  -> Pass 2 Score = ${trace.pass2?.score} (${trace.pass2?.status}) | Adopted Pass = ${trace.adoptedPass}`);
    }
    console.info(`  -> Context Size: ${ragContext.length} chars (retrieved in ${retrievalTimeMs}ms)`);

    console.info(`  -> Generating section content via Gemini LLM...`);
    const prompt = buildChapterGenerationPrompt(
      testCase.project,
      testCase.targetSection,
      "standard",
      [],
      ragContext
    );

    let rawResponse = "";
    let parsedChapter = {};
    let genTimeMs = 0;

    try {
      const genStart = Date.now();
      rawResponse = await callGemini(prompt, null, { tier: "reasoning" });
      genTimeMs = Date.now() - genStart;
      parsedChapter = normalizeChapterLocal({
        ...extractJsonPayload(rawResponse),
        sectionId: testCase.targetSection.id,
        title: testCase.targetSection.title,
      });
      console.info(`  -> Generated ${parsedChapter.contentMarkdown.length} chars of draft in ${genTimeMs}ms`);
    } catch (e) {
      console.error(`  -> Generation error:`, e.message);
      parsedChapter = { contentMarkdown: "", contentHtml: "" };
    }

    sectionRuns.push({
      id: testCase.id,
      title: testCase.targetSection.title,
      sectionType: testCase.sectionType,
      domain: testCase.project.basics.domain,
      language: testCase.language,
      query,
      retrieved_context: ragContext,
      retrieval_chars: ragContext.length,
      retrieval_time_ms: retrievalTimeMs,
      generation_time_ms: genTimeMs,
      generated_markdown: parsedChapter.contentMarkdown,
      generated_html: parsedChapter.contentHtml,
      crag_trace: trace,
      ground_truth: testCase.ground_truth,
    });
  }

  await mongoose.disconnect();
  console.info("\nMongoDB disconnected. Computing metrics via Python evaluation engine...");

  const rawRunsPath = path.join(__dirname, "results", "section_raw_runs.json");
  fs.writeFileSync(rawRunsPath, JSON.stringify(sectionRuns, null, 2), "utf-8");

  const pythonScript = path.join(__dirname, "evaluate_section_rag.py");

  await new Promise((resolve, reject) => {
    const py = spawn("python", [pythonScript], {
      cwd: __dirname,
      stdio: "inherit",
      windowsHide: true,
    });

    py.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Python evaluation script exited with code ${code}`));
    });

    py.on("error", (err) => reject(err));
  });
}

main().catch((err) => {
  console.error("Section benchmark error:", err);
  process.exit(1);
});
