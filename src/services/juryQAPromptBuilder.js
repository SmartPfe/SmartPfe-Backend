const { formatContextString, getProjectContext } = require("./geminiService");

const cleanText = (value, limit = 12000) =>
  String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);

const formatList = (items = [], fallback = "None documented") => {
  const values = (Array.isArray(items) ? items : []).map((item) => cleanText(item, 500)).filter(Boolean);
  return values.length ? values.map((item) => `- ${item}`).join("\n") : fallback;
};

const formatPresentation = (presentation = {}) =>
  (presentation.slides || [])
    .map((slide, index) =>
      [
        `Slide ${index + 1}: ${slide.title || "Untitled slide"}`,
        Array.isArray(slide.bullets) && slide.bullets.length ? `Bullets: ${slide.bullets.join(" | ")}` : null,
        slide.notes ? `Speaker notes: ${slide.notes}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");

const formatPitch = (pitch = {}) =>
  (pitch.slides || [])
    .map((slide, index) =>
      [
        `Slide ${index + 1}: ${slide.title || "Untitled slide"}`,
        `Expected seconds: ${Math.round(Number(slide.estimatedSeconds) || 0)}`,
        `Expected speech: ${slide.speech || ""}`,
      ].join("\n")
    )
    .join("\n\n");

const formatReportChapters = (project = {}, limit = 10000) => {
  const chapters = Array.isArray(project.reportChapters) ? project.reportChapters : [];
  const rendered = chapters
    .filter((chapter) => cleanText(chapter.contentMarkdown || chapter.contentHtml || chapter.contentLatex, 400))
    .map((chapter) => `Section: ${chapter.title}\n${cleanText(chapter.contentMarkdown || chapter.contentHtml || chapter.contentLatex, 1800)}`)
    .join("\n\n");
  return rendered.slice(0, limit);
};

const formatDefenseAnalysis = (attempt = {}) => {
  const analysis = attempt.analysis || {};
  const sectionFeedback = Array.isArray(analysis.sectionFeedback) ? analysis.sectionFeedback : [];
  return [
    `Defense score: ${analysis.overallScore || 0}/100`,
    `Label: ${analysis.overallLabel || ""}`,
    `Strengths:\n${formatList(analysis.strengths)}`,
    `Improvements:\n${formatList(analysis.improvements)}`,
    `Action plan:\n${formatList(analysis.actionPlan)}`,
    sectionFeedback.length
      ? `Slide feedback:\n${sectionFeedback
          .map((item) =>
            [
              `Slide ${item.slideNumber}: ${item.slideTitle}`,
              `Improvements: ${formatList(item.improvements, "None").replace(/\n/g, " ")}`,
              `Observations: ${formatList(item.observations, "None").replace(/\n/g, " ")}`,
            ].join("\n")
          )
          .join("\n\n")}`
      : "Slide feedback: None recorded",
  ].join("\n\n");
};

const juryQuestionContract = `Return ONLY valid JSON. No markdown fences.
{
  "questions": [
    {
      "question": "Precise jury question",
      "category": "Project Understanding | Technical | Methodology | Architecture | Results | Critical Thinking | Weak Point Follow-up | Future Improvements",
      "difficulty": "easy | medium | hard",
      "source": "report | presentation | defense | cross-analysis",
      "reason": "Internal reason explaining the source and weakness/context targeted",
      "relatedSlide": 1,
      "relatedSection": "Architecture"
    }
  ]
}`;

const buildJuryQuestionGenerationPrompt = ({ project, presentation, pitch, attempt, ragContext = "" }) => {
  const ctx = getProjectContext(project);
  const system = `
You are a professional PFE defense jury.
Generate personalized post-defense jury questions after listening to the student's presentation.
Ask questions that verify real project understanding, technical ownership, reasoning, and ability to recover from weak presentation sections.
Do not invent project facts. If documentation is missing, ask reasoning-based questions.
Use the student's output language where possible: ${ctx.outputLanguage}.
`.trim();

  const userText = `
PROJECT CONTEXT:
${formatContextString(ctx)}

REPORT / RAG CONTEXT:
${cleanText(ragContext, 8500) || "No retrieved external report context available."}

GENERATED REPORT CHAPTER EXCERPTS:
${formatReportChapters(project) || "No generated report chapters available."}

PRESENTATION:
${formatPresentation(presentation)}

EXPECTED PITCH:
${formatPitch(pitch)}

DEFENSE PERFORMANCE:
${formatDefenseAnalysis(attempt)}

QUESTION STRATEGY:
- Generate 6 to 10 questions depending on project complexity.
- Include easy, medium, and hard questions.
- Prefer weak point follow-up questions when the defense analysis shows unclear, skipped, or shallow sections.
- Cover report, presentation, and cross-analysis gaps where available.
- Do not ask generic interview questions when project-specific context exists.
- Never reveal answers.

${juryQuestionContract}
`.trim();

  return { system, userText };
};

const buildJuryAnswerEvaluationPrompt = ({ project, presentation, pitch, attempt, session, question, ragContext = "" }) => {
  const ctx = getProjectContext(project);
  const answeredQuestions = (session.questions || [])
    .filter((item) => item.answer?.transcript && item.id !== question.id)
    .map((item, index) => `Previous Q${index + 1}: ${item.question}\nTranscript: ${item.answer.transcript}\nScore: ${item.evaluation?.score || 0}`)
    .join("\n\n");

  const system = `
You are Smart PFE's AI jury evaluator.
Transcribe the student's spoken answer and evaluate it against the actual project context.
Evaluate correctness, relevance, technical accuracy, completeness, clarity, depth, and justification.
Do not invent project facts. If the documentation does not contain a specific answer, evaluate the student's reasoning and clearly say what cannot be verified.
Do not penalize grammar alone; focus on whether the answer addresses the jury question.
`.trim();

  const userText = `
PROJECT CONTEXT:
${formatContextString(ctx)}

REPORT / RAG CONTEXT:
${cleanText(ragContext, 7000) || "No retrieved external report context available."}

GENERATED REPORT CHAPTER EXCERPTS:
${formatReportChapters(project, 7000) || "No generated report chapters available."}

PRESENTATION:
${formatPresentation(presentation)}

EXPECTED PITCH:
${formatPitch(pitch)}

DEFENSE PERFORMANCE:
${formatDefenseAnalysis(attempt)}

CURRENT QUESTION:
ID: ${question.id}
Category: ${question.category}
Difficulty: ${question.difficulty}
Source: ${question.source}
Reason: ${question.reason}
Question: ${question.question}

PREVIOUS ANSWERS IN THIS Q&A:
${answeredQuestions || "No previous answers yet."}

RESPONSE REQUIREMENTS:
- First transcribe the audio answer as accurately as possible.
- Return only the JSON object matching the schema.
- idealAnswer must be a suggested strong answer grounded in documented project context; avoid unsupported facts.
- shouldAskFollowUp should be true only when the answer is weak or incomplete on an important point and a single targeted follow-up would help.
- Do not include the full ideal answer in the live UI; it is for the final report.
`.trim();

  return { system, userText };
};

const buildJuryFollowUpPrompt = ({ project, question, evaluation }) => {
  const ctx = getProjectContext(project);
  const system = `
You are a PFE jury member generating one concise follow-up question.
The follow-up must challenge the student's weak or incomplete answer without revealing the answer.
Use the student's output language where possible: ${ctx.outputLanguage}.
Return ONLY valid JSON: {"question":"...","category":"Weak Point Follow-up","difficulty":"medium | hard","source":"defense","reason":"...","relatedSlide":1,"relatedSection":"..."}.
`.trim();

  const userText = `
PROJECT CONTEXT:
${formatContextString(ctx)}

ORIGINAL QUESTION:
${question.question}

ANSWER TRANSCRIPT:
${evaluation.transcript}

WEAKNESSES:
${formatList(evaluation.weaknesses)}

MISSING POINTS:
${formatList(evaluation.missingPoints)}

FOLLOW-UP REASON:
${evaluation.followUpReason || "The answer needs a more precise explanation."}
`.trim();

  return { system, userText };
};

const buildFinalJuryReportPrompt = ({ project, presentation, pitch, attempt, session, weightedDraft, ragContext = "" }) => {
  const ctx = getProjectContext(project);
  const qaSummary = (session.questions || [])
    .map((item, index) =>
      [
        `Question ${index + 1}: ${item.question}`,
        `Category: ${item.category} | Difficulty: ${item.difficulty} | Source: ${item.source}`,
        `Transcript: ${item.answer?.transcript || ""}`,
        `Score: ${item.evaluation?.score || 0}/100`,
        `Strengths: ${formatList(item.evaluation?.strengths, "None").replace(/\n/g, " ")}`,
        `Weaknesses: ${formatList(item.evaluation?.weaknesses, "None").replace(/\n/g, " ")}`,
        `Missing: ${formatList(item.evaluation?.missingPoints, "None").replace(/\n/g, " ")}`,
      ].join("\n")
    )
    .join("\n\n");

  const system = `
You are the final PFE jury evaluation committee.
Create a comprehensive final evaluation by combining defense performance and jury Q&A performance.
Do not blindly average scores; respect the provided weighted draft and improve the qualitative assessment.
Do not invent project facts. Recognize when Q&A answers compensate for weak presentation sections.
Use the student's output language where possible: ${ctx.outputLanguage}.
`.trim();

  const userText = `
PROJECT CONTEXT:
${formatContextString(ctx)}

REPORT / RAG CONTEXT:
${cleanText(ragContext, 6500) || "No retrieved external report context available."}

PRESENTATION:
${formatPresentation(presentation)}

EXPECTED PITCH:
${formatPitch(pitch)}

DEFENSE PERFORMANCE:
${formatDefenseAnalysis(attempt)}

Q&A PERFORMANCE:
${qaSummary}

WEIGHTED SCORE DRAFT:
${JSON.stringify(weightedDraft, null, 2)}

Return ONLY valid JSON:
{
  "overallScore": 0,
  "overallLabel": "Very Good Defense - Ready with Minor Improvements",
  "readinessLevel": "Not Ready | Needs More Practice | Almost Ready | Ready | Highly Ready",
  "readinessPercent": 0,
  "readinessExplanation": "Personalized readiness assessment",
  "categoryScores": {
    "presentationDelivery": 0,
    "contentMastery": 0,
    "technicalKnowledge": 0,
    "qaPerformance": 0,
    "clarity": 0,
    "criticalThinking": 0
  },
  "strengths": ["3 to 5 final strengths"],
  "weaknesses": ["3 to 5 final weaknesses"],
  "defenseVsQA": "Cross-analysis comparing presentation and Q&A performance",
  "revisionTopics": [
    { "topic": "Architecture justification", "reason": "What to revise and why" }
  ],
  "actionPlan": ["4 to 6 prioritized actions before the real defense"]
}
`.trim();

  return { system, userText };
};

module.exports = {
  buildJuryQuestionGenerationPrompt,
  buildJuryAnswerEvaluationPrompt,
  buildJuryFollowUpPrompt,
  buildFinalJuryReportPrompt,
};
