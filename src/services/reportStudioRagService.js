const path = require("path");
const { spawn } = require("child_process");
const mongoose = require("mongoose");
const { getProjectContext } = require("./openRouterService");

const EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2";
const PYTHON_SCRIPT_PATH = path.join(__dirname, "ragEmbeddingQuery.py");
const VECTOR_INDEX_NAME = "pfe_chunks_vector_index";

const cleanText = (value = "", maxChars = 2000) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);

const normalizeForSearch = (value = "") =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getSearchTokens = (value = "") => {
  const normalized = normalizeForSearch(value);
  if (!normalized) return [];
  return [...new Set(normalized.split(" ").filter((t) => t.length >= 3))];
};

const logStep = (action, step, details = "") => {
  const extra = details ? ` ${details}` : "";
  console.info(`[report-studio-rag][${action}] ${step}${extra}`);
};

const logWarn = (action, step, details = "") => {
  const extra = details ? ` ${details}` : "";
  console.warn(`[report-studio-rag][${action}] WARN: ${step}${extra}`);
};

/**
 * Generate 384-dimensional query embedding via python sentence-transformers
 */
const generateQueryEmbedding = async (queryText, action = "generate") => {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python", [PYTHON_SCRIPT_PATH], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString("utf-8");
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString("utf-8");
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Embedding process failed (code ${code}): ${errorOutput || "Unknown error"}`));
      }

      try {
        const parsed = JSON.parse(output.trim());
        if (!parsed.embedding || !Array.isArray(parsed.embedding)) {
          return reject(new Error("Python script did not return a valid embedding array."));
        }
        logStep(action, "Embedding generation completed.", `dimension=${parsed.embedding.length} durationMs=${Date.now() - start}`);
        resolve(parsed.embedding);
      } catch (e) {
        reject(new Error(`Failed to parse embedding output: ${output.slice(0, 300)}`));
      }
    });

    pythonProcess.on("error", (err) => reject(err));
    pythonProcess.stdin.write(JSON.stringify({ text: queryText, query: queryText }));
    pythonProcess.stdin.end();
  });
};

/**
 * Build a focused, domain-dense retrieval query for a specific section
 */
const buildSectionRetrievalQuery = (project, section) => {
  const ctx = getProjectContext(project);
  const sectionTitle = cleanText(section?.title || "", 150);
  const domain = cleanText(ctx.domain || ctx.projectType || "software engineering", 120);
  const techStack = cleanText(ctx.technologies || ctx.developmentTypes || "", 150);
  
  // Find related requirements or UML entities if relevant to this section
  const sectionTokens = getSearchTokens(sectionTitle);
  const relatedReqs = (project.functionalRequirements || [])
    .filter((r) => sectionTokens.some((tok) => normalizeForSearch(r.title || "").includes(tok)))
    .slice(0, 3)
    .map((r) => r.title)
    .join(", ");

  const relatedClasses = (project.umlPreparation?.classes || [])
    .filter((c) => sectionTokens.some((tok) => normalizeForSearch(c.name || "").includes(tok)))
    .slice(0, 4)
    .map((c) => c.name)
    .join(", ");

  return [
    `PFE report thesis technical section: ${sectionTitle}`,
    `Domain: ${domain}`,
    techStack ? `Technologies and Architecture: ${techStack}` : null,
    relatedReqs ? `Specific Requirements: ${relatedReqs}` : null,
    relatedClasses ? `Related UML Entities: ${relatedClasses}` : null,
    "Academic software engineering explanation, methodologies, technical specifications, and system realization.",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
};

/**
 * Run Atlas Vector Search on pfe_chunks
 */
const runVectorSearch = async (chunksCollection, queryVector, action = "generate", limit = 4) => {
  try {
    const pipeline = [
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: "embedding",
          queryVector,
          numCandidates: 40,
          limit,
        },
      },
      {
        $project: {
          _id: 0,
          chunk_id: 1,
          document_id: 1,
          content: 1,
          section: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    const results = await chunksCollection.aggregate(pipeline).toArray();
    logStep(action, "Vector search completed.", `chunks=${results.length} topScore=${results[0]?.score ? results[0].score.toFixed(3) : "N/A"}`);
    return results;
  } catch (error) {
    logWarn(action, "Vector search failed.", `reason="${error.message}"`);
    return [];
  }
};

/**
 * Evaluates retrieved chunks for technical relevance to the target section
 */
const evaluateSectionContext = (project, section, chunks = []) => {
  if (!chunks || chunks.length === 0) {
    return { status: "REWRITE", score: 0, reason: "No chunks returned." };
  }

  const combinedContent = chunks.map((c) => c.content || "").join(" ");
  const normalizedContent = normalizeForSearch(combinedContent);

  const sectionTokens = getSearchTokens(section?.title || "");
  const ctx = getProjectContext(project);
  const domainTokens = getSearchTokens(ctx.domain || "");
  const techTokens = getSearchTokens(ctx.technologies || "");

  const sectionMatches = sectionTokens.filter((t) => normalizedContent.includes(t));
  const domainMatches = domainTokens.filter((t) => normalizedContent.includes(t));
  const techMatches = techTokens.filter((t) => normalizedContent.includes(t));

  const sectionScore = sectionTokens.length > 0 ? Math.min(1.0, sectionMatches.length / Math.min(sectionTokens.length, 3)) : 0.6;
  const domainScore = domainTokens.length > 0 ? Math.min(1.0, domainMatches.length / Math.min(domainTokens.length, 3)) : 0.5;
  const techScore = techTokens.length > 0 ? Math.min(1.0, techMatches.length / Math.min(techTokens.length, 4)) : 0.5;

  const topVectorScore = chunks[0]?.score || 0.5;

  // Composite Section Relevance Score
  const compositeScore = Number(
    ((topVectorScore * 0.4) + (sectionScore * 0.3) + (domainScore * 0.15) + (techScore * 0.15)).toFixed(3)
  );

  const status = compositeScore >= 0.65 ? "ACCEPT" : "REWRITE";

  return {
    status,
    score: compositeScore,
    topVectorScore: Number(topVectorScore.toFixed(3)),
    sectionScore: Number(sectionScore.toFixed(3)),
    techScore: Number(techScore.toFixed(3)),
    chunksCount: chunks.length,
  };
};

/**
 * Rewrites the section query to focus on core technical concepts and engineering methodology
 */
const rewriteSectionRetrievalQuery = (project, section, evalResult) => {
  const ctx = getProjectContext(project);
  const sectionTitle = cleanText(section?.title || "", 150);
  const domain = cleanText(ctx.domain || ctx.projectType || "software engineering", 120);
  const techStack = cleanText(ctx.technologies || ctx.developmentTypes || "", 150);

  return [
    `Software engineering thesis chapter section: ${sectionTitle}`,
    `Technical implementation and system design: ${domain} ${techStack}`,
    "Detailed technical concepts, system architecture, database design, API design, workflows, and academic methodology.",
  ]
    .join("\n")
    .slice(0, 1800);
};

const formatRetrievedChunks = (chunks = []) => {
  if (!chunks.length) return "";
  return chunks
    .map((chunk, index) => {
      const sectionInfo = chunk.section ? ` [Section: ${chunk.section}]` : "";
      const scoreInfo = chunk.score ? ` (similarity: ${chunk.score.toFixed(3)})` : "";
      return `--- Reference Excerpt ${index + 1}${sectionInfo}${scoreInfo} ---\n${cleanText(chunk.content, 1200)}`;
    })
    .join("\n\n");
};

/**
 * Section-Level Self-Correcting RAG (CRAG) Pipeline
 */
const getSectionRagContext = async (project, section, action = "generate", options = {}) => {
  const trace = {
    pass1: null,
    pass2: null,
    cragTriggered: false,
    adoptedPass: 1,
  };

  try {
    if (!mongoose.connection?.db) {
      throw new Error("MongoDB connection is not ready.");
    }

    const db = mongoose.connection.db;
    const chunksCollection = db.collection("pfe_chunks");

    logStep(action, `[CRAG] Section retrieval started for "${cleanText(section?.title || "Untitled", 60)}"`);

    // --- PASS 1 ---
    const initialQuery = buildSectionRetrievalQuery(project, section);
    logStep(action, "Pass 1 query built.", `preview="${cleanText(initialQuery, 250)}"`);
    const embedding1 = await generateQueryEmbedding(initialQuery, `${action}-pass1`);
    const chunks1 = await runVectorSearch(chunksCollection, embedding1, `${action}-pass1`, 4);

    const eval1 = evaluateSectionContext(project, section, chunks1);
    trace.pass1 = eval1;
    logStep(action, `[CRAG] Pass 1 Evaluation Grade: ${eval1.status}`, `score=${eval1.score} topVectorScore=${eval1.topVectorScore}`);

    let selectedChunks = chunks1;

    // --- PASS 2 (Self-Correction if needed) ---
    if (eval1.status === "REWRITE" && chunks1.length > 0) {
      trace.cragTriggered = true;
      logStep(action, "[CRAG] Section context had gaps. Triggering Query Rewriter for 2nd pass...");
      const rewrittenQuery = rewriteSectionRetrievalQuery(project, section, eval1);
      logStep(action, "[CRAG] Query Rewritten.", `preview="${cleanText(rewrittenQuery, 250)}"`);

      const embedding2 = await generateQueryEmbedding(rewrittenQuery, `${action}-pass2`);
      const chunks2 = await runVectorSearch(chunksCollection, embedding2, `${action}-pass2`, 4);
      const eval2 = evaluateSectionContext(project, section, chunks2);
      trace.pass2 = eval2;

      logStep(action, `[CRAG] Pass 2 Evaluation Grade: ${eval2.status}`, `score=${eval2.score}`);

      if (eval2.score >= eval1.score && chunks2.length > 0) {
        selectedChunks = chunks2;
        trace.adoptedPass = 2;
        logStep(action, "[CRAG] Adopted Pass 2 context (higher quality score).");
      } else {
        trace.adoptedPass = 1;
        logStep(action, "[CRAG] Kept Pass 1 context.");
      }
    } else {
      logStep(action, "[CRAG] Pass 1 context ACCEPTED without query rewrite.");
    }

    const formattedContext = formatRetrievedChunks(selectedChunks);
    logStep(action, "[CRAG] Section retrieval completed.", `chunks=${selectedChunks.length} contextChars=${formattedContext.length}`);

    return options.returnTrace ? { context: formattedContext, trace } : formattedContext;
  } catch (error) {
    logWarn(action, "[CRAG] Section retrieval unavailable. Falling back to standard prompt.", `reason="${error.message}"`);
    return options.returnTrace ? { context: "", trace } : "";
  }
};

module.exports = {
  buildSectionRetrievalQuery,
  rewriteSectionRetrievalQuery,
  evaluateSectionContext,
  getSectionRagContext,
};
