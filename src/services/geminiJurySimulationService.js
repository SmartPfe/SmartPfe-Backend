const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const GEMINI_JURY_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

const stringArraySchema = {
  type: "array",
  items: { type: "string" },
};

const JURY_ANALYSIS_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    overallScore: { type: "integer" },
    overallLabel: { type: "string" },
    categoryScores: {
      type: "object",
      properties: {
        delivery: { type: "integer" },
        clarity: { type: "integer" },
        content: { type: "integer" },
        timing: { type: "integer" },
        structure: { type: "integer" },
      },
      required: ["delivery", "clarity", "content", "timing", "structure"],
    },
    timing: {
      type: "object",
      properties: {
        targetSeconds: { type: "integer" },
        actualSeconds: { type: "integer" },
        differenceSeconds: { type: "integer" },
        assessment: { type: "string" },
      },
      required: ["targetSeconds", "actualSeconds", "differenceSeconds", "assessment"],
    },
    fillerWords: {
      type: "object",
      properties: {
        total: { type: "integer" },
        mostFrequent: stringArraySchema,
        examples: stringArraySchema,
      },
      required: ["total", "mostFrequent", "examples"],
    },
    strengths: stringArraySchema,
    improvements: stringArraySchema,
    sectionFeedback: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slideNumber: { type: "integer" },
          slideTitle: { type: "string" },
          strengths: stringArraySchema,
          improvements: stringArraySchema,
          observations: stringArraySchema,
        },
        required: ["slideNumber", "slideTitle", "strengths", "improvements", "observations"],
      },
    },
    actionPlan: stringArraySchema,
  },
  required: [
    "overallScore",
    "overallLabel",
    "categoryScores",
    "timing",
    "fillerWords",
    "strengths",
    "improvements",
    "sectionFeedback",
    "actionPlan",
  ],
};

const stringList = stringArraySchema;

const JURY_ANSWER_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    transcript: { type: "string" },
    score: { type: "integer" },
    scores: {
      type: "object",
      properties: {
        correctness: { type: "integer" },
        relevance: { type: "integer" },
        clarity: { type: "integer" },
        depth: { type: "integer" },
        justification: { type: "integer" },
      },
      required: ["correctness", "relevance", "clarity", "depth", "justification"],
    },
    strengths: stringList,
    weaknesses: stringList,
    missingPoints: stringList,
    feedback: { type: "string" },
    idealAnswer: { type: "string" },
    shouldAskFollowUp: { type: "boolean" },
    followUpReason: { type: "string" },
  },
  required: [
    "transcript",
    "score",
    "scores",
    "strengths",
    "weaknesses",
    "missingPoints",
    "feedback",
    "idealAnswer",
    "shouldAskFollowUp",
    "followUpReason",
  ],
};

const normalizeGeminiAudioMimeType = (mimeType = "") => {
  const cleanMimeType = String(mimeType || "").split(";")[0].trim().toLowerCase();
  if (cleanMimeType === "audio/mpeg") return "audio/mp3";
  return cleanMimeType || "audio/webm";
};

const getGeminiText = (data = {}) =>
  (data.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => part?.text || "")
    .join("")
    .trim();

const callGeminiModel = async ({ model, system, userText, audioBase64, mimeType }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const audioMimeType = normalizeGeminiAudioMimeType(mimeType);

  const response = await fetch(`${GEMINI_BASE_URL}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: `${system}\n\n${userText}` },
            {
              inlineData: {
                mimeType: audioMimeType,
                data: audioBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseFormat: {
          text: {
            mimeType: "APPLICATION_JSON",
            schema: JURY_ANALYSIS_RESPONSE_SCHEMA,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini model ${model} failed with status ${response.status}: ${errorText.slice(0, 500)}`);
  }

  const data = await response.json();
  const text = getGeminiText(data);
  if (!text) {
    throw new Error(`Gemini model ${model} returned an empty response.`);
  }

  return text;
};

const callGeminiAudioJsonModel = async ({ model, system, userText, audioBase64, mimeType, responseSchema, temperature = 0.2 }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const audioMimeType = normalizeGeminiAudioMimeType(mimeType);

  const response = await fetch(`${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: `${system}\n\n${userText}` },
            {
              inlineData: {
                mimeType: audioMimeType,
                data: audioBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini model ${model} failed with status ${response.status}: ${errorText.slice(0, 500)}`);
  }

  const data = await response.json();
  const text = getGeminiText(data);
  if (!text) {
    throw new Error(`Gemini model ${model} returned an empty response.`);
  }

  return text;
};

const callGeminiJuryAnalysis = async ({ system, userText, audioBase64, mimeType }) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("AI defense analysis is not configured on the server.");
  }

  const failures = [];

  for (const model of GEMINI_JURY_MODELS) {
    try {
      const text = await callGeminiModel({ model, system, userText, audioBase64, mimeType });
      console.info(`[jurySimulation] Gemini analysis succeeded with ${model}.`);
      return { text, model };
    } catch (error) {
      failures.push(`${model}: ${error.message}`);
      console.warn(`[jurySimulation] Gemini model ${model} failed; trying next fallback.`);
    }
  }

  console.error("[jurySimulation] All Gemini jury analysis models failed:", failures.join(" | "));
  throw new Error("AI defense analysis is temporarily unavailable. Please try again in a few minutes.");
};

const callGeminiJuryAnswerEvaluation = async ({ system, userText, audioBase64, mimeType }) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("AI jury answer evaluation is not configured on the server.");
  }

  const failures = [];

  for (const model of GEMINI_JURY_MODELS) {
    try {
      const text = await callGeminiAudioJsonModel({
        model,
        system,
        userText,
        audioBase64,
        mimeType,
        responseSchema: JURY_ANSWER_RESPONSE_SCHEMA,
      });
      console.info(`[juryQA] Gemini answer evaluation succeeded with ${model}.`);
      return { text, model };
    } catch (error) {
      failures.push(`${model}: ${error.message}`);
      console.warn(`[juryQA] Gemini model ${model} failed; trying next fallback.`);
    }
  }

  console.error("[juryQA] All Gemini jury answer models failed:", failures.join(" | "));
  throw new Error("AI jury answer evaluation is temporarily unavailable. Please try again in a few minutes.");
};

module.exports = {
  callGeminiJuryAnalysis,
  callGeminiJuryAnswerEvaluation,
  GEMINI_JURY_MODELS,
};
