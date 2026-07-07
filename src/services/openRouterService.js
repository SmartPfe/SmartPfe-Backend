const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "openai/gpt-oss-120b:free",
  "openrouter/owl-alpha",
];

// --- Context Builder ---

const buildProjectContext = (project) => {
  const filterEmpty = (arr) =>
    Array.isArray(arr) ? arr.filter((v) => v && v.trim() !== "") : [];

  return {
    projectTitle:        project.basics?.title || "",
    projectType:         project.basics?.type || "",
    domain:              project.basics?.domain || "",
    outputLanguage:      project.basics?.language || "English",
    university:          project.basics?.university || "",
    academicYear:        project.basics?.academicYear || "",
    problemStatement:    project.description?.problemStatement || "",
    objective:           project.description?.objective || "",
    detailedDescription: project.description?.detailedDescription || "",
    deliverables:        filterEmpty(project.description?.deliverables).join(", "),
    company:             project.description?.company || null,
    industry:            project.description?.industry || "",
    stakeholders:        filterEmpty(project.description?.stakeholders).join(", "),
    developmentTypes:    filterEmpty(project.technicalContext?.developmentTypes).join(", "),
    technologies:        filterEmpty(project.technicalContext?.technologies).join(", "),
    methodology:         project.technicalContext?.methodology || "",
    targetUsers:         filterEmpty(project.technicalContext?.targetUsers).join(", "),
    teamSize:            project.technicalContext?.teamSize || "",
    duration:            project.technicalContext?.duration || "",
  };
};

const formatContextString = (ctx) =>
  [
    `- Title: ${ctx.projectTitle}`,
    `- Project type: ${ctx.projectType}`,
    `- Domain: ${ctx.domain}`,
    `- University: ${ctx.university} | Academic Year: ${ctx.academicYear}`,
    ctx.industry     ? `- Industry: ${ctx.industry}` : null,
    ctx.company      ? `- Company partner: ${ctx.company}` : null,
    ctx.problemStatement ? `- Problem statement: ${ctx.problemStatement}` : null,
    ctx.objective    ? `- Objective: ${ctx.objective}` : null,
    ctx.detailedDescription ? `- Detailed description: ${ctx.detailedDescription}` : null,
    ctx.deliverables ? `- Deliverables: ${ctx.deliverables}` : null,
    ctx.stakeholders ? `- Stakeholders: ${ctx.stakeholders}` : null,
    ctx.targetUsers  ? `- Target users: ${ctx.targetUsers}` : null,
    ctx.developmentTypes ? `- Solution type: ${ctx.developmentTypes}` : null,
    ctx.technologies ? `- Technologies: ${ctx.technologies}` : null,
    ctx.methodology  ? `- Methodology: ${ctx.methodology}` : null,
    ctx.teamSize     ? `- Team size: ${ctx.teamSize} person(s)` : null,
    ctx.duration     ? `- Duration: ${ctx.duration} months` : null,
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
};

// --- OpenRouter HTTP call with model fallback ---

const callOpenRouterModel = async (model, messages, retryCount = 0) => {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:3000",
      "X-Title": "PfeMentor",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });

  if (response.status === 429 && retryCount < 1) {
    console.warn(`[openRouter] Model ${model} rate limited (429). Retrying in 2s...`);
    await new Promise((r) => setTimeout(r, 2000));
    return callOpenRouterModel(model, messages, retryCount + 1);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[openRouter] Model ${model} API error ${response.status}:`, errorText);
    throw new Error(`Model ${model} failed with status ${response.status}.`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`Model ${model} returned an empty response.`);
  }

  return content;
};

const callOpenRouter = async (systemPrompt, userPrompt = null) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OpenRouter API key is not configured on the server.");
  }

  const messages = [{ role: "system", content: systemPrompt }];
  if (userPrompt) {
    messages.push({ role: "user", content: userPrompt });
  }

  const failures = [];
  for (const model of OPENROUTER_MODELS) {
    try {
      return await callOpenRouterModel(model, messages);
    } catch (error) {
      failures.push(`${model}: ${error.message}`);
      console.warn(`[openRouter] Falling back after ${model} failed.`);
    }
  }

  console.error("[openRouter] All fallback models failed:", failures.join(" | "));
  throw new Error("All AI models are currently unavailable. Please wait a moment and try again.");
};

// --- Public API ---

/**
 * @param {"generate"|"refine"} type
 * @param {object} project - Mongoose Project document
 * @param {string|null} currentText - Plain text of current editor content (for refine)
 */
const callAI = async (type, project, currentText = null) => {
  if (!PROMPTS[type]) {
    throw new Error(`Unknown AI action type: "${type}"`);
  }
  const ctx = buildProjectContext(project);
  const systemPrompt = PROMPTS[type](ctx);
  const userPrompt = currentText ? `CURRENT TEXT:\n${currentText}` : null;
  return callOpenRouter(systemPrompt, userPrompt);
};

module.exports = { callAI, callOpenRouter, formatContextString, getProjectContext };
