const Project = require("../models/Project");
const { normalizePresentation } = require("./presentationService");
const { normalizePitch } = require("./pitchService");
const { callGeminiJuryAnalysis } = require("./geminiJurySimulationService");
const { buildJurySimulationAnalysisPrompt } = require("./jurySimulationPromptBuilder");

const MAX_AUDIO_BYTES = 40 * 1024 * 1024;
const MAX_DEFENSE_SECONDS = 25 * 60;
const MIN_DEFENSE_SECONDS = 120; // Minimum 2 minutes required for meaningful evaluation

const clampScore = (value) => {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
};

const cleanString = (value) => String(value || "").trim();

const cleanStringList = (items, limit = 6) =>
  (Array.isArray(items) ? items : [])
    .map(cleanString)
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

const parseJson = (content) => {
  try {
    return JSON.parse(extractJsonPayload(content));
  } catch (error) {
    console.error("[jurySimulation] Invalid AI JSON response:", String(content || "").slice(0, 1000));
    throw new Error("AI returned a malformed assessment. Please try the analysis again.");
  }
};

const normalizeAnalysis = (analysis = {}, targetSeconds = 0, actualSeconds = 0, presentation = {}) => {
  const categoryScores = analysis.categoryScores || {};
  const timing = analysis.timing || {};
  const fillerWords = analysis.fillerWords || {};
  const knownSlides = presentation.slides || [];

  return {
    overallScore: clampScore(analysis.overallScore),
    overallLabel: cleanString(analysis.overallLabel) || "Defense assessment",
    categoryScores: {
      delivery: clampScore(categoryScores.delivery),
      clarity: clampScore(categoryScores.clarity),
      content: clampScore(categoryScores.content),
      timing: clampScore(categoryScores.timing),
      structure: clampScore(categoryScores.structure),
    },
    timing: {
      targetSeconds: Math.max(0, Math.round(Number(timing.targetSeconds) || targetSeconds)),
      actualSeconds: Math.max(0, Math.round(Number(timing.actualSeconds) || actualSeconds)),
      differenceSeconds: Math.round(Number(timing.differenceSeconds) || actualSeconds - targetSeconds),
      assessment: cleanString(timing.assessment) || "Timing was assessed against the selected defense duration.",
    },
    fillerWords: {
      total: Math.max(0, Math.round(Number(fillerWords.total) || 0)),
      mostFrequent: cleanStringList(fillerWords.mostFrequent, 5),
      examples: cleanStringList(fillerWords.examples, 5),
    },
    strengths: cleanStringList(analysis.strengths, 4),
    improvements: cleanStringList(analysis.improvements, 4),
    sectionFeedback: (Array.isArray(analysis.sectionFeedback) ? analysis.sectionFeedback : [])
      .map((item, index) => {
        const slideNumber = Math.max(1, Math.round(Number(item?.slideNumber) || index + 1));
        const fallbackTitle = knownSlides[slideNumber - 1]?.title || `Slide ${slideNumber}`;
        return {
          slideNumber,
          slideTitle: cleanString(item?.slideTitle) || fallbackTitle,
          strengths: cleanStringList(item?.strengths, 3),
          improvements: cleanStringList(item?.improvements, 3),
          observations: cleanStringList(item?.observations, 4),
        };
      })
      .filter((item) => item.slideNumber > 0)
      .slice(0, knownSlides.length || 20),
    actionPlan: cleanStringList(analysis.actionPlan, 4),
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

const getCurrentVersions = (project) => {
  const presentationSlides = project.presentation?.slides || [];
  const pitchSlides = project.pitch?.slides || [];
  return {
    presentationVersion: Number(project.presentation?.version) || (presentationSlides.length ? 1 : 0),
    pitchVersion: Number(project.pitch?.version) || (pitchSlides.length ? 1 : 0),
  };
};

const withCurrentMarkers = (attempts = [], versions) =>
  attempts
    .map((attempt) => {
      const item = typeof attempt.toObject === "function" ? attempt.toObject() : attempt;
      return {
        ...item,
        isCurrent:
          item.status === "completed" &&
          Number(item.presentationVersion) === versions.presentationVersion &&
          Number(item.pitchVersion) === versions.pitchVersion,
      };
    })
    .sort((a, b) => Number(b.attemptNumber || 0) - Number(a.attemptNumber || 0));

const getProjectForUser = async (userId, projectId) => {
  const project = await Project.findOne({ _id: projectId, user: userId });
  if (!project) throw new Error("Project not found for this user.");
  return project;
};

const getJurySimulation = async (userId, projectId) => {
  const project = await getProjectForUser(userId, projectId);
  const versions = getCurrentVersions(project);
  return {
    ...versions,
    attempts: withCurrentMarkers(project.jurySimulation?.attempts || [], versions),
  };
};

const analyzeJurySimulation = async ({
  userId,
  projectId,
  audioFile,
  actualSeconds,
  objectiveMetrics = {},
  presentation: submittedPresentation = null,
  pitch: submittedPitch = null,
}) => {
  const project = await getProjectForUser(userId, projectId);
  const persistedPresentation = normalizePresentation(project.presentation || {}, project);
  const presentation = submittedPresentation && typeof submittedPresentation === "object"
    ? normalizePresentation(submittedPresentation, project)
    : persistedPresentation;
  const persistedPitch = getPitchLikePitchPage(project);
  const pitchFromRequest = submittedPitch && typeof submittedPitch === "object"
    ? normalizePitch(submittedPitch, { ...project.toObject(), presentation })
    : null;
  const pitch = hasPitchSpeech(pitchFromRequest) ? pitchFromRequest : persistedPitch;
  const versions = getCurrentVersions(project);
  const attemptVersions = {
    presentationVersion: Number(presentation.version) || versions.presentationVersion,
    pitchVersion: Number(pitch.version) || versions.pitchVersion,
  };

  if (!presentation.slides.length) {
    throw new Error("Generate your presentation before starting Jury Simulation.");
  }

  if (!hasPitchSpeech(pitch)) {
    throw new Error("Generate your pitch before starting Jury Simulation.");
  }

  if (!audioFile?.buffer?.length) {
    throw new Error("No recording was received. Please record your defense again.");
  }

  if (audioFile.buffer.length > MAX_AUDIO_BYTES) {
    throw new Error("The recording is too large. Please keep the defense under the selected target duration.");
  }

  const safeActualSeconds = Math.max(0, Math.round(Number(actualSeconds) || 0));
  if (safeActualSeconds < MIN_DEFENSE_SECONDS) {
    throw new Error("The defense recording is too short (less than 2 minutes). Please record at least 2 minutes to receive an accurate jury evaluation.");
  }

  if (safeActualSeconds > MAX_DEFENSE_SECONDS) {
    throw new Error("The recording is longer than the safety limit. Please keep the attempt under 25 minutes.");
  }

  const targetSeconds = Math.round((presentation.durationMinutes || pitch.durationMinutes || 10) * 60);
  const audioBase64 = audioFile.buffer.toString("base64");
  const prompt = buildJurySimulationAnalysisPrompt({
    project,
    presentation: { ...presentation, version: attemptVersions.presentationVersion },
    pitch: { ...pitch, version: attemptVersions.pitchVersion },
    targetSeconds,
    actualSeconds: safeActualSeconds,
    objectiveMetrics,
  });

  const { text: response } = await callGeminiJuryAnalysis({
    ...prompt,
    audioBase64,
    mimeType: audioFile.mimetype || "audio/webm",
  });

  const analysis = normalizeAnalysis(parseJson(response), targetSeconds, safeActualSeconds, presentation);
  const attempts = project.jurySimulation?.attempts || [];
  const attempt = {
    attemptNumber: attempts.length + 1,
    presentationVersion: attemptVersions.presentationVersion,
    pitchVersion: attemptVersions.pitchVersion,
    targetSeconds,
    actualSeconds: safeActualSeconds,
    audio: {
      mimeType: audioFile.mimetype || "",
      sizeBytes: audioFile.size || audioFile.buffer.length,
    },
    objectiveMetrics,
    analysis,
    status: "completed",
    createdAt: new Date(),
  };

  project.jurySimulation = {
    attempts: [...attempts, attempt],
  };
  await project.save();

  const savedAttempt = project.jurySimulation.attempts[project.jurySimulation.attempts.length - 1];
  return {
    attempt: {
      ...(typeof savedAttempt.toObject === "function" ? savedAttempt.toObject() : savedAttempt),
      isCurrent:
        attemptVersions.presentationVersion === versions.presentationVersion &&
        attemptVersions.pitchVersion === versions.pitchVersion,
    },
    presentationVersion: versions.presentationVersion,
    pitchVersion: versions.pitchVersion,
  };
};

module.exports = {
  getJurySimulation,
  analyzeJurySimulation,
};
