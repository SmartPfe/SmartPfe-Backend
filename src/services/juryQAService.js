const crypto = require("crypto");
const Project = require("../models/Project");
const { normalizePresentation } = require("./presentationService");
const { normalizePitch } = require("./pitchService");
const { callGemini } = require("./geminiService");
const { callGeminiJuryAnswerEvaluation } = require("./geminiJurySimulationService");
const { getReportStructureRagContext } = require("./reportStructureRagService");
const {
  buildJuryQuestionGenerationPrompt,
  buildJuryAnswerEvaluationPrompt,
  buildJuryFollowUpPrompt,
  buildFinalJuryReportPrompt,
} = require("./juryQAPromptBuilder");
const {
  calculateFinalJuryScores,
  clampScore,
  readinessFromScore,
} = require("./juryEvaluationWeights");

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_ANSWER_SECONDS = 5 * 60;
const MIN_ANSWER_SECONDS = 2;
const MAX_TOTAL_QUESTIONS = 10;

const cleanString = (value, limit = 4000) => String(value || "").trim().slice(0, limit);

const cleanStringList = (items, limit = 6) =>
  (Array.isArray(items) ? items : [])
    .map((item) => cleanString(item, 700))
    .filter(Boolean)
    .slice(0, limit);

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

const parseJson = (content, fallbackMessage = "AI returned malformed jury Q&A JSON. Please retry.") => {
  try {
    return JSON.parse(extractJsonPayload(content));
  } catch (error) {
    console.error("[juryQA] Invalid AI JSON response:", String(content || "").slice(0, 1000));
    throw new Error(fallbackMessage);
  }
};

const getProjectForUser = async (userId, projectId) => {
  const project = await Project.findOne({ _id: projectId, user: userId });
  if (!project) throw new Error("Project not found for this user.");
  return project;
};

const getCurrentVersions = (project) => {
  const presentationSlides = project.presentation?.slides || [];
  const pitchSlides = project.pitch?.slides || [];
  return {
    presentationVersion: Number(project.presentation?.version) || (presentationSlides.length ? 1 : 0),
    pitchVersion: Number(project.pitch?.version) || (pitchSlides.length ? 1 : 0),
    reportVersion: Number(project.finalReport?.generatedAt ? new Date(project.finalReport.generatedAt).getTime() : 0),
  };
};

const hasPitchSpeech = (pitch = {}) =>
  Array.isArray(pitch.slides) && pitch.slides.some((slide) => cleanString(slide?.speech));

const getPitchLikePitchPage = (project) => {
  if (hasPitchSpeech(project.pitch || {})) {
    return normalizePitch(project.pitch || {});
  }

  return normalizePitch(project.pitch || {}, project);
};

const getPitchForContext = (project, presentation, submittedPitch = null) => {
  const persistedPitch = getPitchLikePitchPage(project);
  const requestPitch = submittedPitch && typeof submittedPitch === "object"
    ? normalizePitch(submittedPitch, { ...project.toObject(), presentation })
    : null;

  return hasPitchSpeech(requestPitch) ? requestPitch : persistedPitch;
};

const normalizeQuestion = (question = {}, index = 0, followUpFor = "") => {
  const difficulty = ["easy", "medium", "hard"].includes(String(question.difficulty || "").toLowerCase())
    ? String(question.difficulty).toLowerCase()
    : "medium";
  const source = ["report", "presentation", "defense", "cross-analysis"].includes(question.source)
    ? question.source
    : "cross-analysis";

  return {
    id: cleanString(question.id, 80) || `q-${Date.now()}-${index + 1}-${crypto.randomBytes(3).toString("hex")}`,
    question: cleanString(question.question, 1200),
    category: cleanString(question.category, 80) || "Project Understanding",
    difficulty,
    source,
    reason: cleanString(question.reason, 900),
    relatedSlide: Number.isFinite(Number(question.relatedSlide)) ? Math.max(1, Math.round(Number(question.relatedSlide))) : undefined,
    relatedSection: cleanString(question.relatedSection, 120),
    followUpFor: typeof followUpFor === "string" ? cleanString(followUpFor, 120) : "",
  };
};

const normalizeQuestions = (questions = []) =>
  (Array.isArray(questions) ? questions : [])
    .map((question, index) => normalizeQuestion(question, index))
    .filter((question) => question.question)
    .slice(0, MAX_TOTAL_QUESTIONS);

const normalizeEvaluation = (evaluation = {}) => {
  const scores = evaluation.scores || {};
  return {
    transcript: cleanString(evaluation.transcript, 12000),
    score: clampScore(evaluation.score),
    scores: {
      correctness: clampScore(scores.correctness),
      relevance: clampScore(scores.relevance),
      clarity: clampScore(scores.clarity),
      depth: clampScore(scores.depth),
      justification: clampScore(scores.justification),
    },
    strengths: cleanStringList(evaluation.strengths, 5),
    weaknesses: cleanStringList(evaluation.weaknesses, 5),
    missingPoints: cleanStringList(evaluation.missingPoints, 5),
    feedback: cleanString(evaluation.feedback, 1800),
    idealAnswer: cleanString(evaluation.idealAnswer, 4000),
    shouldAskFollowUp: Boolean(evaluation.shouldAskFollowUp),
    followUpReason: cleanString(evaluation.followUpReason, 800),
  };
};

const normalizeFinalEvaluation = (evaluation = {}, weightedDraft = {}) => {
  const categories = evaluation.categoryScores || {};
  return {
    overallScore: clampScore(evaluation.overallScore || weightedDraft.overallScore),
    overallLabel: cleanString(evaluation.overallLabel, 160) || "Final jury evaluation",
    readinessLevel: ["Not Ready", "Needs More Practice", "Almost Ready", "Ready", "Highly Ready"].includes(evaluation.readinessLevel)
      ? evaluation.readinessLevel
      : readinessFromScore(evaluation.overallScore || weightedDraft.overallScore),
    readinessPercent: clampScore(evaluation.readinessPercent || weightedDraft.readinessPercent || evaluation.overallScore),
    readinessExplanation: cleanString(evaluation.readinessExplanation, 1600),
    categoryScores: {
      presentationDelivery: clampScore(categories.presentationDelivery || weightedDraft.categoryScores?.presentationDelivery),
      contentMastery: clampScore(categories.contentMastery || weightedDraft.categoryScores?.contentMastery),
      technicalKnowledge: clampScore(categories.technicalKnowledge || weightedDraft.categoryScores?.technicalKnowledge),
      qaPerformance: clampScore(categories.qaPerformance || weightedDraft.categoryScores?.qaPerformance),
      clarity: clampScore(categories.clarity || weightedDraft.categoryScores?.clarity),
      criticalThinking: clampScore(categories.criticalThinking || weightedDraft.categoryScores?.criticalThinking),
    },
    weights: weightedDraft.weights || {},
    strengths: cleanStringList(evaluation.strengths, 5),
    weaknesses: cleanStringList(evaluation.weaknesses, 5),
    defenseVsQA: cleanString(evaluation.defenseVsQA, 2600),
    revisionTopics: (Array.isArray(evaluation.revisionTopics) ? evaluation.revisionTopics : [])
      .map((item) => ({
        topic: cleanString(item?.topic || item, 160),
        reason: cleanString(item?.reason, 700),
      }))
      .filter((item) => item.topic)
      .slice(0, 5),
    actionPlan: cleanStringList(evaluation.actionPlan, 6),
  };
};

const getAttemptById = (project, juryAttemptId) => {
  const attempts = project.jurySimulation?.attempts || [];
  const attempt = attempts.id?.(juryAttemptId) || attempts.find((item) => String(item._id) === String(juryAttemptId));
  if (!attempt || attempt.status !== "completed") {
    throw new Error("A completed defense analysis is required before starting Jury Q&A.");
  }
  return attempt;
};

const findQASession = (project, sessionId) => {
  const sessions = project.jurySimulation?.qaSessions || [];
  return sessions.id?.(sessionId) || sessions.find((item) => String(item._id) === String(sessionId));
};

const toObject = (item) => (typeof item?.toObject === "function" ? item.toObject() : item);

const sortSessions = (sessions = []) =>
  sessions
    .map(toObject)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

const getJuryQASessions = async (userId, projectId) => {
  const project = await getProjectForUser(userId, projectId);
  return {
    sessions: sortSessions(project.jurySimulation?.qaSessions || []),
  };
};

const getJuryQASession = async (userId, projectId, sessionId) => {
  const project = await getProjectForUser(userId, projectId);
  const session = findQASession(project, sessionId);
  if (!session) throw new Error("Jury Q&A session was not found.");
  return { session: toObject(session) };
};

const generateJuryQA = async ({ userId, projectId, juryAttemptId, submittedPresentation = null, submittedPitch = null }) => {
  const project = await getProjectForUser(userId, projectId);
  const attempt = getAttemptById(project, juryAttemptId);
  const existing = (project.jurySimulation?.qaSessions || []).find(
    (session) => String(session.juryAttemptId) === String(juryAttemptId) && ["generated", "in-progress", "completed"].includes(session.status)
  );
  if (existing) return { session: toObject(existing), resumed: true };

  const presentation = submittedPresentation && typeof submittedPresentation === "object"
    ? normalizePresentation(submittedPresentation, project)
    : normalizePresentation(project.presentation || {}, project);
  const pitch = getPitchForContext(project, presentation, submittedPitch);
  if (!presentation.slides.length) throw new Error("Generate your presentation before starting Jury Q&A.");
  if (!hasPitchSpeech(pitch)) throw new Error("Generate your pitch before starting Jury Q&A.");

  const versions = getCurrentVersions(project);
  const ragContext = await getReportStructureRagContext(project, "jury-qa-generate");
  const prompt = buildJuryQuestionGenerationPrompt({ project, presentation, pitch, attempt, ragContext });
  const response = await callGemini(prompt.system, prompt.userText, { tier: "reasoning", responseMimeType: "application/json" });
  const parsed = parseJson(response, "AI could not generate jury questions. Please retry.");
  const questions = normalizeQuestions(parsed.questions);
  if (questions.length < 3) throw new Error("AI did not return enough jury questions. Please retry.");

  const session = {
    projectId: project._id,
    juryAttemptId: attempt._id,
    attemptNumber: attempt.attemptNumber,
    presentationVersion: attempt.presentationVersion || versions.presentationVersion,
    pitchVersion: attempt.pitchVersion || versions.pitchVersion,
    reportVersion: versions.reportVersion,
    questions,
    status: "generated",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  project.jurySimulation = {
    attempts: project.jurySimulation?.attempts || [],
    qaSessions: [...(project.jurySimulation?.qaSessions || []), session],
  };
  await project.save();

  const savedSession = project.jurySimulation.qaSessions[project.jurySimulation.qaSessions.length - 1];
  return { session: toObject(savedSession), resumed: false };
};

const maybeAddFollowUpQuestion = async ({ project, session, question, evaluation }) => {
  if (!evaluation.shouldAskFollowUp || evaluation.score >= 62) return null;
  if ((session.questions || []).length >= MAX_TOTAL_QUESTIONS) return null;
  if (question.followUpFor) return null;
  const existingFollowUp = (session.questions || []).some((item) => item.followUpFor === question.id);
  if (existingFollowUp) return null;

  const prompt = buildJuryFollowUpPrompt({ project, question, evaluation });
  const response = await callGemini(prompt.system, prompt.userText, { tier: "default", responseMimeType: "application/json" });
  const parsed = parseJson(response, "AI could not generate a follow-up question.");
  const followUp = normalizeQuestion(parsed, session.questions.length, question.id);
  if (!followUp.question) return null;
  session.questions.push(followUp);
  return followUp;
};

const answerJuryQAQuestion = async ({ userId, projectId, sessionId, questionId, audioFile, durationSeconds }) => {
  const project = await getProjectForUser(userId, projectId);
  const session = findQASession(project, sessionId);
  if (!session) throw new Error("Jury Q&A session was not found.");
  if (session.status === "completed") throw new Error("This Jury Q&A session is already completed.");

  const question = (session.questions || []).find((item) => item.id === questionId);
  if (!question) throw new Error("Selected jury question was not found.");

  if (question.answer?.transcript && question.evaluation?.score !== undefined) {
    return { session: toObject(session), question: toObject(question), duplicate: true };
  }

  if (!audioFile?.buffer?.length) throw new Error("No answer recording was received.");
  if (audioFile.buffer.length > MAX_AUDIO_BYTES) throw new Error("The answer recording is too large.");
  const safeDuration = Math.max(0, Math.round(Number(durationSeconds) || 0));
  if (safeDuration < MIN_ANSWER_SECONDS) throw new Error("The answer recording is empty or too short.");
  if (safeDuration > MAX_ANSWER_SECONDS) throw new Error("Please keep each answer under 5 minutes.");

  const attempt = getAttemptById(project, session.juryAttemptId);
  const presentation = normalizePresentation(project.presentation || {}, project);
  const pitch = getPitchLikePitchPage(project);
  const ragContext = await getReportStructureRagContext(project, `jury-qa-answer-${question.category || "question"}`);
  const prompt = buildJuryAnswerEvaluationPrompt({ project, presentation, pitch, attempt, session, question, ragContext });

  const { text } = await callGeminiJuryAnswerEvaluation({
    ...prompt,
    audioBase64: audioFile.buffer.toString("base64"),
    mimeType: audioFile.mimetype || "audio/webm",
  });

  const evaluation = normalizeEvaluation(parseJson(text, "AI could not evaluate the recorded answer. Please retry."));
  question.answer = {
    transcript: evaluation.transcript,
    audioMetadata: {
      mimeType: audioFile.mimetype || "",
      sizeBytes: audioFile.size || audioFile.buffer.length,
    },
    durationSeconds: safeDuration,
    answeredAt: new Date(),
  };
  question.evaluation = evaluation;
  session.status = "in-progress";
  session.updatedAt = new Date();

  const followUp = await maybeAddFollowUpQuestion({ project, session, question, evaluation });
  await project.save();

  return {
    session: toObject(session),
    question: toObject(question),
    followUp: followUp ? toObject(followUp) : null,
  };
};

const finalizeJuryQA = async ({ userId, projectId, sessionId }) => {
  const project = await getProjectForUser(userId, projectId);
  const session = findQASession(project, sessionId);
  if (!session) throw new Error("Jury Q&A session was not found.");
  if (session.status === "completed" && session.finalEvaluation?.overallScore) {
    return { session: toObject(session), resumed: true };
  }

  const unanswered = (session.questions || []).filter((question) => !question.answer?.transcript || !question.evaluation);
  if (unanswered.length) {
    throw new Error("Answer all jury questions before generating the final report.");
  }

  const attempt = getAttemptById(project, session.juryAttemptId);
  const presentation = normalizePresentation(project.presentation || {}, project);
  const pitch = getPitchLikePitchPage(project);
  const ragContext = await getReportStructureRagContext(project, "jury-qa-final-report");
  const weightedDraft = calculateFinalJuryScores({
    defenseAnalysis: attempt.analysis || {},
    questions: session.questions || [],
  });

  const prompt = buildFinalJuryReportPrompt({ project, presentation, pitch, attempt, session, weightedDraft, ragContext });
  const response = await callGemini(prompt.system, prompt.userText, { tier: "reasoning", responseMimeType: "application/json" });
  const parsed = parseJson(response, "AI could not generate the final jury report. Please retry.");

  session.finalEvaluation = normalizeFinalEvaluation(parsed, weightedDraft);
  session.status = "completed";
  session.completedAt = new Date();
  session.updatedAt = new Date();
  await project.save();

  return { session: toObject(session), resumed: false };
};

module.exports = {
  getJuryQASessions,
  getJuryQASession,
  generateJuryQA,
  answerJuryQAQuestion,
  finalizeJuryQA,
};
