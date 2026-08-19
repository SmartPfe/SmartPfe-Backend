const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Semantic Model Tiers
const MODEL_TIERS = {
  // Tier 1: Complex reasoning, UML diagram modeling, RAG chapter synthesis, complete thesis
  reasoning: [
    "gemini-3.7-flash",
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-3.6-flash",
  ],

  // Tier 2: Standard generation (Problem statement, requirements, backlog, pitch, slides)
  default: [
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-3.7-flash",
    "gemini-2.5-flash-lite",
  ],

  // Tier 3: Sub-second micro-actions (Floating dock, in-place translations, simplify/expand)
  fast: [
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
  ],
};

// --- Context Builder ---

const buildProjectContext = (project) => {
  const filterEmpty = (arr) =>
    Array.isArray(arr) ? arr.filter((v) => v && v.trim() !== "") : [];

  return {
    projectTitle: project?.basics?.title || "",
    projectType: project?.basics?.type || "",
    domain: project?.basics?.domain || "",
    outputLanguage: project?.basics?.language || "English",
    university: project?.basics?.university || "",
    academicYear: project?.basics?.academicYear || "",
    problemStatement: project?.description?.problemStatement || "",
    objective: project?.description?.objective || "",
    detailedDescription: project?.description?.detailedDescription || "",
    deliverables: filterEmpty(project?.description?.deliverables).join(", "),
    company: project?.description?.company || null,
    industry: project?.description?.industry || "",
    stakeholders: filterEmpty(project?.description?.stakeholders).join(", "),
    developmentTypes: filterEmpty(project?.technicalContext?.developmentTypes).join(", "),
    technologies: filterEmpty(project?.technicalContext?.technologies).join(", "),
    methodology: project?.technicalContext?.methodology || "",
    targetUsers: filterEmpty(project?.technicalContext?.targetUsers).join(", "),
    teamSize: project?.technicalContext?.teamSize || "",
    duration: project?.technicalContext?.duration || "",
  };
};

const formatContextString = (ctx) =>
  [
    `- Title: ${ctx.projectTitle}`,
    `- Project type: ${ctx.projectType}`,
    `- Domain: ${ctx.domain}`,
    `- University: ${ctx.university} | Academic Year: ${ctx.academicYear}`,
    ctx.industry ? `- Industry: ${ctx.industry}` : null,
    ctx.company ? `- Company partner: ${ctx.company}` : null,
    ctx.problemStatement ? `- Problem statement: ${ctx.problemStatement}` : null,
    ctx.objective ? `- Objective: ${ctx.objective}` : null,
    ctx.detailedDescription ? `- Detailed description: ${ctx.detailedDescription}` : null,
    ctx.deliverables ? `- Deliverables: ${ctx.deliverables}` : null,
    ctx.stakeholders ? `- Stakeholders: ${ctx.stakeholders}` : null,
    ctx.targetUsers ? `- Target users: ${ctx.targetUsers}` : null,
    ctx.developmentTypes ? `- Solution type: ${ctx.developmentTypes}` : null,
    ctx.technologies ? `- Technologies: ${ctx.technologies}` : null,
    ctx.methodology ? `- Methodology: ${ctx.methodology}` : null,
    ctx.teamSize ? `- Team size: ${ctx.teamSize} person(s)` : null,
    ctx.duration ? `- Duration: ${ctx.duration} months` : null,
  ]
    .filter(Boolean)
    .join("\n");

const getProjectContext = (project) => buildProjectContext(project);

// --- Prompt Definitions ---

const PROMPTS = {
  generate: (ctx) => `
You are an academic writing assistant helping a student write their final year project report (PFE/Mémoire).

Your task: Write a well-structured Problem Statement based on the project context below.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
You MUST write entirely in ${ctx.outputLanguage}. This is non-negotiable.

Structure (4 paragraphs, no headings, no bullet points):
1. General domain and its current importance
2. The specific gap, inefficiency, or unmet need
3. Why solving it matters — reference industry, stakeholders, or target users
4. What this project proposes as a solution

Tone: Formal academic writing. Do NOT use phrases like "In conclusion" or "In summary".
Return ONLY the plain text of the problem statement. No commentary, no preamble.

PROJECT CONTEXT:
${formatContextString(ctx)}
`.trim(),

  refine: (ctx) => `
You are an academic writing assistant.
Improve the following Problem Statement for a final year university project report.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
You MUST write entirely in ${ctx.outputLanguage}.

Rules:
- Preserve the student's original intent and structure
- Improve: clarity, academic tone, logical flow, and completeness
- You may expand the text if it is too short, but stay on topic
- Do NOT add topics the student has not mentioned
- Do NOT use bullet points or headings
- Return ONLY the improved text — no commentary, no explanation

PROJECT CONTEXT:
${formatContextString(ctx)}
`.trim(),

  translate: (ctx) => `
You are an academic translation assistant.
Translate the following Problem Statement to ${ctx.outputLanguage}.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
You MUST write entirely in ${ctx.outputLanguage}.

Rules:
- Translate only the provided Problem Statement content
- Do NOT regenerate, rewrite from project context, or add new ideas
- Preserve the student's manual edits, meaning, paragraph structure, and academic tone as much as possible
- If the input contains lightweight HTML tags, keep the same HTML structure and translate text nodes only
- Do NOT use bullet points or headings unless they already exist in the input
- Return ONLY the translated text — no commentary, no explanation

PROJECT CONTEXT:
${formatContextString(ctx)}
`.trim(),
};

// --- Gemini Content Extraction Helper ---

const getGeminiText = (data = {}) =>
  (data.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => part?.text || "")
    .join("")
    .trim();

// --- Low-level Gemini HTTP Call with Retry ---

const callGeminiModel = async ({ model, systemInstruction, contents, retryCount = 0, options = {} }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  const requestBody = {
    contents,
    ...(systemInstruction ? { systemInstruction } : {}),
    generationConfig: {
      temperature: options.temperature !== undefined ? options.temperature : 0.3,
      maxOutputTokens: options.max_tokens || options.maxOutputTokens || 8192,
      ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
      ...(options.responseSchema ? { responseSchema: options.responseSchema } : {}),
    },
  };

  const response = await fetch(`${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  // Handle rate limits (429) with exponential retry
  if (response.status === 429 && retryCount < 1) {
    console.warn(`[gemini] Model ${model} rate limited (429). Retrying in 2s...`);
    await new Promise((r) => setTimeout(r, 2000));
    return callGeminiModel({ model, systemInstruction, contents, retryCount: retryCount + 1, options });
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[gemini] Model ${model} API error ${response.status}:`, errorText.slice(0, 500));
    throw new Error(`Gemini model ${model} failed with status ${response.status}.`);
  }

  const data = await response.json();
  const text = getGeminiText(data);
  if (!text) {
    throw new Error(`Gemini model ${model} returned an empty response.`);
  }

  return text;
};

// --- Multi-Model Fallback Executor ---

const callGeminiMessages = async (messages, options = {}) => {
  const tier = options.tier && MODEL_TIERS[options.tier] ? options.tier : "default";
  const models = Array.isArray(options.models) && options.models.length
    ? options.models
    : MODEL_TIERS[tier];

  // Separate system instruction from conversational turns
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  const systemInstruction = systemMessages.length > 0
    ? {
        parts: [{ text: systemMessages.map((m) => m.content).join("\n\n") }],
      }
    : null;

  let contents = nonSystemMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // Ensure contents is never empty (Gemini requires at least one user content item)
  if (contents.length === 0) {
    if (systemInstruction) {
      contents = [{ role: "user", parts: [{ text: "Please generate the requested response according to the instructions." }] }];
    } else {
      throw new Error("No prompt content provided to Gemini.");
    }
  }

  const failures = [];
  for (const model of models) {
    try {
      return await callGeminiModel({ model, systemInstruction, contents, retryCount: 0, options });
    } catch (error) {
      failures.push(`${model}: ${error.message}`);
      if (models.length > 1) {
        console.warn(`[gemini] Falling back after ${model} failed: ${error.message}`);
      }
    }
  }

  console.error("[gemini] All fallback models failed:", failures.join(" | "));
  throw new Error("All AI models are currently unavailable. Please wait a moment and try again.");
};

// --- Primary Text Generation Caller ---

/**
 * @param {string} systemPrompt
 * @param {string|null} userPrompt
 * @param {object} options - Options including tier: 'reasoning'|'default'|'fast'
 */
const callGemini = async (systemPrompt, userPrompt = null, options = {}) => {
  if (userPrompt) {
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];
    return callGeminiMessages(messages, options);
  }

  // When a single unified prompt is provided, pass as user content
  const messages = [{ role: "user", content: systemPrompt }];
  return callGeminiMessages(messages, options);
};

// --- Public API for Problem Statement ---

/**
 * @param {"generate"|"refine"|"translate"} type
 * @param {object} project - Mongoose Project document
 * @param {string|null} currentText - Current editor content (for refine or translate)
 * @param {object} options
 */
const callAI = async (type, project, currentText = null, options = {}) => {
  if (!PROMPTS[type]) {
    throw new Error(`Unknown AI action type: "${type}"`);
  }
  const ctx = buildProjectContext(project);
  const systemPrompt = PROMPTS[type](ctx);
  const instructions = typeof options.instructions === "string" ? options.instructions.trim() : "";
  const userPrompt = currentText
    ? [
        instructions
          ? `STUDENT INSTRUCTIONS (highest priority, while still respecting the rules above):\n${instructions}`
          : null,
        `CURRENT TEXT:\n${currentText}`,
      ]
        .filter(Boolean)
        .join("\n\n")
    : null;

  const tier = type === "translate" ? "fast" : "default";
  return callGemini(systemPrompt, userPrompt, { tier, ...options });
};

module.exports = {
  callAI,
  callGemini,
  callGeminiMessages,
  callOpenRouter: callGemini,
  callOpenRouterMessages: callGeminiMessages,
  formatContextString,
  getProjectContext,
  buildProjectContext,
  MODEL_TIERS,
};
