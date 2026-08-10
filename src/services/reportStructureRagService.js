const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const mongoose = require("mongoose");
const { getProjectContext } = require("./openRouterService");

const EMBEDDING_MODEL_NAME =
  process.env.RAG_EMBEDDING_MODEL ||
  "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2";
const EMBEDDING_DIMENSIONS = 384;
const DEFAULT_VECTOR_INDEX_NAMES = ["pfe_chunks_vector_index", "vector_index", "default"];
const PYTHON_EMBEDDING_SCRIPT = path.join(__dirname, "ragEmbeddingQuery.py");
const RAG_LOG_PREFIX = "[report-structure-rag]";

const toArray = (value) => (Array.isArray(value) ? value : []);

const cleanText = (value, maxLength = 240) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const logStep = (action, message, details = "") => {
  const suffix = details ? ` ${details}` : "";
  console.info(`${RAG_LOG_PREFIX}[${action}] ${message}${suffix}`);
};

const logWarn = (action, message, details = "") => {
  const suffix = details ? ` ${details}` : "";
  console.warn(`${RAG_LOG_PREFIX}[${action}] ${message}${suffix}`);
};

const joinList = (items, formatter, limit = 6) =>
  toArray(items)
    .slice(0, limit)
    .map(formatter)
    .map((item) => cleanText(item, 220))
    .filter(Boolean)
    .join("; ");

const normalizeForSearch = (value) =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const STOP_WORDS = new Set([
  "avec",
  "dans",
  "des",
  "for",
  "from",
  "les",
  "pour",
  "project",
  "rapport",
  "report",
  "software",
  "structure",
  "table",
  "that",
  "the",
  "this",
  "toc",
  "une",
  "using",
]);

const getSearchTokens = (value) =>
  [...new Set(normalizeForSearch(value).split(/\s+/).filter((token) => token.length > 3 && !STOP_WORDS.has(token)))];

const isLowValueTocTitle = (title) => {
  const text = cleanText(title, 220);
  const normalized = normalizeForSearch(text);
  const wordCount = normalized ? normalized.split(/\s+/).length : 0;
  if (!normalized) return true;
  if (/\.pdf$/i.test(text)) return true;
  if (/[a-f0-9]{32,}/i.test(text)) return true;
  if (text.length > 115) return true;
  if (wordCount > 12 && !/chapitre|chapter/i.test(text)) return true;
  if (/^[•\-*]/.test(text)) return true;
  if (/^(figure|table|fig\.|tab\.)\s*\d*/i.test(text)) return true;
  if (/^(chapter|chapitre)\s*\d+\s*:?\s*$/i.test(text)) return true;
  return [
    "acknowledgment",
    "acknowledgements",
    "among the applications",
    "acronyms and abbreviations",
    "bibliographie",
    "dedicace",
    "dedication",
    "dedications",
    "for businesses",
    "in this chapter",
    "in this section",
    "liste des abreviations",
    "liste des figures",
    "liste des tableaux",
    "referring to",
    "remerciement",
    "resume",
    "our project is",
    "table des matieres",
    "we begin",
    "we identify",
    "we present",
  ].some((noise) => normalized.includes(noise));
};

const getUsableTocEntries = (toc, limit = 28) => {
  const seen = new Set();
  return toArray(toc)
    .filter((item) => item && !isLowValueTocTitle(item.title))
    .map((item) => ({
      ...item,
      level: Math.max(1, Math.min(Number(item.level || 1), 3)),
      title: cleanText(item.title, 140),
      number: cleanText(item.number, 20),
    }))
    .filter((item) => {
      const key = `${item.level}:${normalizeForSearch(item.title)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
};

const scoreStructureReference = (item, queryTokens) => {
  const tocEntries = getUsableTocEntries(item.toc, 40);
  const searchableText = normalizeForSearch(
    [
      item.subject,
      item.filename,
      tocEntries.map((entry) => entry.title).join(" "),
    ].join(" ")
  );
  const overlap = queryTokens.filter((token) => searchableText.includes(token)).length;
  const chapterSignals = tocEntries.filter((entry) => /chapitre|chapter|contexte|context|analyse|design|conception|implementation|realisation|test|validation|conclusion/i.test(entry.title)).length;
  const quality = Math.min(tocEntries.length, 35) + chapterSignals * 1.5;
  return overlap * 10 + quality;
};

const buildRetrievalQuery = (project) => {
  const ctx = getProjectContext(project);
  const actors = joinList(project.actors, (actor) => `${actor.name}: ${actor.description}`, 5);
  const existingSolutions = joinList(
    project.existingSolutions,
    (solution) => `${solution.name}: ${solution.solvedProblem || solution.description}`,
    4
  );
  const functionalRequirements = joinList(
    project.functionalRequirements,
    (requirement) => `${requirement.title}: ${requirement.description}`,
    8
  );
  const nonFunctionalRequirements = joinList(
    project.nonFunctionalRequirements,
    (requirement) => `${requirement.title}: ${requirement.description}`,
    5
  );
  const backlog = joinList(
    project.productBacklog,
    (item) => `${item.epic || item.code}: ${item.task} ${item.notes || ""}`,
    8
  );
  const umlClasses = joinList(project.umlPreparation?.classes, (item) => item.name, 8);
  const umlUseCases = toArray(project.umlPreparation?.useCase?.useCases).slice(0, 10).join("; ");

  return [
    "Find academically realistic PFE report table of contents examples for a software engineering project.",
    ctx.projectTitle ? `Project title: ${ctx.projectTitle}` : null,
    ctx.projectType ? `Project type: ${ctx.projectType}` : null,
    ctx.domain ? `Domain: ${ctx.domain}` : null,
    ctx.problemStatement ? `Problem statement: ${ctx.problemStatement}` : null,
    ctx.objective ? `Objective: ${ctx.objective}` : null,
    ctx.developmentTypes ? `Solution type: ${ctx.developmentTypes}` : null,
    ctx.technologies ? `Technologies: ${ctx.technologies}` : null,
    ctx.methodology ? `Methodology: ${ctx.methodology}` : null,
    ctx.targetUsers ? `Target users: ${ctx.targetUsers}` : null,
    actors ? `Actors: ${actors}` : null,
    existingSolutions ? `Existing solutions: ${existingSolutions}` : null,
    functionalRequirements ? `Functional requirements: ${functionalRequirements}` : null,
    nonFunctionalRequirements ? `Non-functional requirements: ${nonFunctionalRequirements}` : null,
    backlog ? `Product backlog user stories: ${backlog}` : null,
    umlClasses ? `UML classes: ${umlClasses}` : null,
    umlUseCases ? `UML use cases: ${umlUseCases}` : null,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 3200);
};

const parseJsonFromStdout = (stdout) => {
  const text = String(stdout || "").trim();
  const start = text.lastIndexOf("{");
  if (start === -1) throw new Error("Embedding process returned no JSON payload.");
  return JSON.parse(text.slice(start));
};

const resolvePythonCommand = () => {
  if (process.env.RAG_PYTHON_COMMAND) return process.env.RAG_PYTHON_COMMAND;

  const workspaceRoot = path.resolve(__dirname, "..", "..", "..");
  const candidates = [
    path.join(workspaceRoot, "rag-ingestion", "venv", "Scripts", "python.exe"),
    path.join(workspaceRoot, "rag-ingestion", "venv", "bin", "python"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || process.env.PYTHON || "python";
};

const generateQueryEmbedding = (text, action = "generate") =>
  new Promise((resolve, reject) => {
    const pythonCommand = resolvePythonCommand();
    const timeoutMs = Number(process.env.RAG_EMBEDDING_TIMEOUT_MS || 120000);
    const startTime = Date.now();
    logStep(action, "Embedding generation started.", `model="${EMBEDDING_MODEL_NAME}" python="${pythonCommand}"`);
    const child = spawn(pythonCommand, [PYTHON_EMBEDDING_SCRIPT], {
      cwd: path.resolve(__dirname, "..", ".."),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`Embedding generation timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        reject(new Error(cleanText(stderr || stdout || `Embedding process exited with code ${code}.`, 500)));
        return;
      }

      try {
        const payload = parseJsonFromStdout(stdout);
        if (!Array.isArray(payload.embedding) || payload.embedding.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(`Expected ${EMBEDDING_DIMENSIONS} embedding values, got ${payload.dimension || "unknown"}.`);
        }
        logStep(action, "Embedding generation completed.", `dimension=${payload.embedding.length} durationMs=${Date.now() - startTime}`);
        resolve(payload.embedding);
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.end(JSON.stringify({ text, model: EMBEDDING_MODEL_NAME }));
  });

const getSearchIndexNames = async (chunksCollection) => {
  const configured = process.env.RAG_VECTOR_INDEX_NAME;
  const detected = [];
  let listedIndexes = 0;

  try {
    const indexes = await chunksCollection.listSearchIndexes().toArray();
    listedIndexes = indexes.length;
    indexes.forEach((index) => {
      const definition = index.latestDefinition || index.definition || {};
      if (JSON.stringify(definition).toLowerCase().includes("embedding")) {
        detected.push(index.name);
      }
    });
  } catch (error) {
    console.warn(`${RAG_LOG_PREFIX} Could not list Atlas search indexes:`, error.message);
  }
  if (listedIndexes === 0) {
    console.warn(`${RAG_LOG_PREFIX} No Atlas Search indexes were listed for pfe_chunks. Verify the Vector Search index exists and is queryable.`);
  }

  return [configured, ...detected, ...DEFAULT_VECTOR_INDEX_NAMES].filter(
    (name, index, all) => name && all.indexOf(name) === index
  );
};

const runVectorSearch = async (chunksCollection, embedding, action = "generate") => {
  const limit = Number(process.env.RAG_VECTOR_LIMIT || 8);
  const numCandidates = Number(process.env.RAG_VECTOR_NUM_CANDIDATES || 60);
  const indexNames = await getSearchIndexNames(chunksCollection);
  let lastError = null;
  logStep(action, "Vector search indexes prepared.", `indexes=${indexNames.join(", ")} limit=${limit} numCandidates=${numCandidates}`);

  for (const indexName of indexNames) {
    try {
      logStep(action, "Vector search started.", `index="${indexName}"`);
      const chunks = await chunksCollection
        .aggregate([
          {
            $vectorSearch: {
              index: indexName,
              path: "embedding",
              queryVector: embedding,
              numCandidates,
              limit,
            },
          },
          {
            $project: {
              _id: 0,
              document_id: 1,
              filename: 1,
              subject: 1,
              language: 1,
              section_number: 1,
              section_title: 1,
              page_start: 1,
              page_end: 1,
              content: { $substrCP: ["$content", 0, 700] },
              score: { $meta: "vectorSearchScore" },
            },
          },
        ])
        .toArray();

      const topScore = chunks.length ? Math.max(...chunks.map((chunk) => Number(chunk.score || 0))).toFixed(3) : "none";
      logStep(action, "Vector search completed.", `index="${indexName}" chunks=${chunks.length} topScore=${topScore}`);
      return { chunks, indexName };
    } catch (error) {
      lastError = error;
      logWarn(action, "Vector search failed.", `index="${indexName}" error="${error.message}"`);
    }
  }

  if (lastError) throw lastError;
  return { chunks: [], indexName: indexNames[0] || "none" };
};

const formatToc = (toc, limit = 22) =>
  getUsableTocEntries(toc, limit)
    .map((item) => {
      const level = item.level;
      const indent = "  ".repeat(level - 1);
      const number = item.number;
      const title = item.title;
      return title ? `${indent}- ${number ? `${number} ` : ""}${title}` : null;
    })
    .filter(Boolean)
    .join("\n");

const buildContextFromResults = (chunks, documents, structures) => {
  const documentMap = new Map(documents.map((doc) => [doc.document_id, doc]));
  const structureMap = new Map(structures.map((structure) => [structure.document_id, structure]));
  const grouped = new Map();

  chunks.forEach((chunk) => {
    if (!chunk.document_id) return;
    const current = grouped.get(chunk.document_id) || {
      documentId: chunk.document_id,
      subject: chunk.subject,
      filename: chunk.filename,
      language: chunk.language,
      maxScore: 0,
      chunks: [],
    };
    current.maxScore = Math.max(current.maxScore, Number(chunk.score || 0));
    current.chunks.push(chunk);
    grouped.set(chunk.document_id, current);
  });

  const topDocuments = Array.from(grouped.values())
    .sort((a, b) => b.maxScore - a.maxScore)
    .slice(0, Number(process.env.RAG_STRUCTURE_LIMIT || 3));

  const lines = ["Retrieved PFE report references for internal academic guidance:"];

  topDocuments.forEach((group, index) => {
    const metadata = documentMap.get(group.documentId) || {};
    const structure = structureMap.get(group.documentId) || {};
    const subject = cleanText(metadata.subject || group.subject || metadata.filename || group.filename || "Untitled PFE report", 180);
    const toc = formatToc(structure.toc);
    const chunksForDoc = group.chunks
      .slice(0, 2)
      .map((chunk) => {
        const section = cleanText(chunk.section_title || "Unlabeled section", 120);
        const content = cleanText(chunk.content, 360);
        const score = Number(chunk.score || 0).toFixed(3);
        return `  - Relevant section: ${section} (score ${score})${content ? ` - ${content}` : ""}`;
      })
      .join("\n");

    lines.push(
      [
        `Reference ${index + 1}: ${subject}`,
        metadata.language || group.language ? `Language: ${metadata.language || group.language}` : null,
        `Best similarity: ${group.maxScore.toFixed(3)}`,
        toc ? `Table of contents:\n${toc}` : null,
        chunksForDoc ? `Matched excerpts:\n${chunksForDoc}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    );
  });

  return {
    context: lines.join("\n\n").slice(0, Number(process.env.RAG_CONTEXT_MAX_CHARS || 6500)),
    topDocuments,
  };
};

const buildContextFromStructureReferences = (references) => {
  const lines = ["Retrieved PFE report structures for internal academic guidance:"];

  references.forEach((reference, index) => {
    const subject = cleanText(reference.subject || reference.filename || "Untitled PFE report", 180);
    const toc = formatToc(reference.toc, 24);
    lines.push(
      [
        `Reference ${index + 1}: ${subject}`,
        reference.language ? `Language: ${reference.language}` : null,
        `Structure relevance score: ${reference.score.toFixed(1)}`,
        toc ? `Table of contents:\n${toc}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    );
  });

  return lines.join("\n\n").slice(0, Number(process.env.RAG_CONTEXT_MAX_CHARS || 6500));
};

const getStructureFallbackContext = async (db, retrievalQuery, action = "generate") => {
  const limit = Number(process.env.RAG_STRUCTURE_FALLBACK_LIMIT || 4);
  const queryTokens = getSearchTokens(retrievalQuery);

  logStep(action, "Structure fallback started.", `queryTokens=${queryTokens.length} limit=${limit}`);

  const structures = await db
    .collection("pfe_structures")
    .aggregate([
      {
        $lookup: {
          from: "pfe_documents",
          localField: "document_id",
          foreignField: "document_id",
          as: "document",
        },
      },
      { $unwind: { path: "$document", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          document_id: 1,
          toc: 1,
          filename: "$document.filename",
          subject: "$document.subject",
          language: "$document.language",
        },
      },
    ])
    .toArray();

  const ranked = structures
    .map((item) => ({
      ...item,
      usableTocEntries: getUsableTocEntries(item.toc, 40).length,
      score: scoreStructureReference(item, queryTokens),
    }))
    .filter((item) => item.usableTocEntries >= 8)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (!ranked.length) {
    logStep(action, "Structure fallback found no usable TOCs.");
    return "";
  }

  const context = buildContextFromStructureReferences(ranked);
  logStep(
    action,
    "Structure fallback ready.",
    `reports=${ranked.length} contextChars=${context.length} references=${ranked
      .map((item) => `${cleanText(item.subject || item.filename || item.document_id, 60)} score=${item.score.toFixed(1)}`)
      .join(" | ")}`
  );
  return context;
};

const getReportStructureRagContext = async (project, action = "generate") => {
  try {
    if (!mongoose.connection?.db) {
      throw new Error("MongoDB connection is not ready.");
    }

    const ctx = getProjectContext(project);
    logStep(
      action,
      "Retrieval started.",
      `project="${cleanText(ctx.projectTitle || "Untitled", 80)}" domain="${cleanText(ctx.domain || "unknown", 60)}"`
    );
    const retrievalQuery = buildRetrievalQuery(project);
    logStep(action, "Semantic query built.", `chars=${retrievalQuery.length} preview="${cleanText(retrievalQuery, 420)}"`);
    const embedding = await generateQueryEmbedding(retrievalQuery, action);
    const db = mongoose.connection.db;
    const chunksCollection = db.collection("pfe_chunks");
    const { chunks, indexName } = await runVectorSearch(chunksCollection, embedding, action);

    if (!chunks.length) {
      logStep(action, "No relevant chunks found. Trying structure-first TOC fallback.");
      return getStructureFallbackContext(db, retrievalQuery, action);
    }

    const documentIds = [...new Set(chunks.map((chunk) => chunk.document_id).filter(Boolean))];
    logStep(action, "Loading matched document metadata and TOC structures.", `documentIds=${documentIds.length}`);
    const [documents, structures] = await Promise.all([
      db.collection("pfe_documents").find({ document_id: { $in: documentIds } }).toArray(),
      db.collection("pfe_structures").find({ document_id: { $in: documentIds } }).toArray(),
    ]);

    const { context, topDocuments } = buildContextFromResults(chunks, documents, structures);
    logStep(
      action,
      "Retrieved references ready.",
      `chunks=${chunks.length} reports=${topDocuments.length} structures=${structures.length} contextChars=${context.length} index="${indexName}"`
    );
    logStep(
      action,
      "Top references:",
      topDocuments
        .map((doc) => `${cleanText(doc.subject || doc.filename || doc.documentId, 90)} score=${doc.maxScore.toFixed(3)}`)
        .join(" | ")
    );

    return context;
  } catch (error) {
    logWarn(action, "Retrieval unavailable. Falling back to standard prompt.", `reason="${error.message}"`);
    return "";
  }
};

module.exports = {
  buildRetrievalQuery,
  getReportStructureRagContext,
};
