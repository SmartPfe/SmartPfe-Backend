const Project = require("../models/Project");
const { callGemini } = require("./geminiService");
const { getSourceFingerprint, normalizePresentation } = require("./presentationService");
const {
  buildPitchGenerationPrompt,
  buildPitchRefinementPrompt,
  buildPitchSlideGenerationPrompt,
  buildPitchSlideRefinementPrompt,
  buildPitchSlideTranslationPrompt,
} = require("./pitchPromptBuilder");

const VALID_DURATIONS = new Set([5, 10, 15, 20]);

const normalizeDuration = (value) => {
  const duration = Number(value);
  return VALID_DURATIONS.has(duration) ? duration : 10;
};

const normalizeLanguage = (language = "") => {
  const value = String(language || "").trim();
  if (!value) return "";
  const codes = { english: "en", french: "fr", arabic: "ar", en: "en", fr: "fr", ar: "ar" };
  return codes[value.toLowerCase()] || value.toLowerCase();
};

const getProjectLanguage = (project) => normalizeLanguage(project?.basics?.language || project?.language);

const normalizeTips = (tips) =>
  Array.isArray(tips)
    ? tips.map((tip) => String(tip || "").trim()).filter(Boolean).slice(0, 6)
    : String(tips || "")
      .split(/\r?\n/)
      .map((tip) => tip.replace(/^\s*[-*\u2022]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 6);

const estimateSecondsFromSpeech = (speech, fallbackSeconds = 60) => {
  const words = String(speech || "").trim().split(/\s+/).filter(Boolean).length;
  if (!words) return Math.max(15, Math.round(fallbackSeconds));
  return Math.max(15, Math.round((words / 130) * 60));
};

const hasPitchSpeech = (pitch = {}) =>
  Array.isArray(pitch.slides) && pitch.slides.some((slide) => String(slide?.speech || "").trim());

const emptySlideForPresentation = (slide, index, presentation) => {
  const fallbackSeconds = presentation.slides.length
    ? Math.round((presentation.durationMinutes * 60) / presentation.slides.length)
    : 60;

  return {
    slideId: String(slide.id || `slide-${index + 1}`).trim(),
    title: String(slide.title || `Slide ${index + 1}`).trim(),
    estimatedSeconds: fallbackSeconds,
    speech: "",
    tips: [],
    language: "",
  };
};

const normalizeSlide = (slide = {}, presentationSlide, index, presentation, fallbackLanguage = "") => {
  const base = emptySlideForPresentation(presentationSlide || slide, index, presentation);
  const speech = String(slide.speech || "").trim();
  return {
    slideId: String(slide.slideId || presentationSlide?.id || base.slideId).trim(),
    title: String(presentationSlide?.title || slide.title || base.title).trim(),
    estimatedSeconds: estimateSecondsFromSpeech(
      speech,
      Number(slide.estimatedSeconds) || base.estimatedSeconds
    ),
    speech,
    tips: normalizeTips(slide.tips),
    language: normalizeLanguage(slide.language || fallbackLanguage),
  };
};

const normalizePitch = (pitch = {}, project = null, fallbackLanguage = "") => {
  const presentation = normalizePresentation(project?.presentation || pitch.presentation || {});
  const currentSlides = Array.isArray(pitch.slides) ? pitch.slides : [];
  const pitchBySlideId = new Map(currentSlides.map((slide) => [String(slide.slideId || ""), slide]));
  const presentationSlides = presentation.slides;
  const durationMinutes = normalizeDuration(
    project && presentationSlides.length
      ? presentation.durationMinutes
      : pitch.durationMinutes || presentation.durationMinutes
  );
  const presentationForFallback = {
    ...presentation,
    durationMinutes,
    slides: presentationSlides.length ? presentationSlides : currentSlides,
  };
  const usedCurrentSlideIds = new Set();

  const alignedSlides = presentationSlides.length
    ? presentationSlides.map((presentationSlide, index) => {
      const currentSlide = pitchBySlideId.get(presentationSlide.id) || currentSlides[index] || {};
      if (currentSlide?.slideId) usedCurrentSlideIds.add(String(currentSlide.slideId));
      return normalizeSlide(
        {
          ...currentSlide,
          slideId: presentationSlide.id,
          language: currentSlide?.language || fallbackLanguage,
        },
        presentationSlide,
        index,
        presentationForFallback,
        fallbackLanguage
      );
    })
    : currentSlides.map((slide, index) =>
      normalizeSlide(slide, null, index, presentationForFallback, fallbackLanguage)
    );

  const preservedUnmatchedSlides = presentationSlides.length
    ? currentSlides
      .filter((slide) => slide?.slideId && !usedCurrentSlideIds.has(String(slide.slideId)))
      .map((slide, index) =>
        normalizeSlide(
          slide,
          null,
          alignedSlides.length + index,
          {
            ...presentationForFallback,
            slides: [...presentationForFallback.slides, ...currentSlides],
          },
          fallbackLanguage
        )
      )
    : [];

  return {
    durationMinutes,
    slides: [...alignedSlides, ...preservedUnmatchedSlides],
    sourceFingerprint: String(pitch.sourceFingerprint || (project ? getSourceFingerprint(project) : "")).trim(),
    version: Number(pitch.version) || (Array.isArray(pitch.slides) && pitch.slides.length ? 1 : 0),
    updatedAt: pitch.updatedAt || new Date(),
  };
};

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

const parsePitchResponse = (content, project, language = getProjectLanguage(project)) => {
  let parsed;
  try {
    parsed = JSON.parse(extractJsonPayload(content));
  } catch (error) {
    console.error("[pitch] Invalid AI JSON response:", String(content || "").slice(0, 1000));
    throw new Error("AI returned invalid pitch JSON. Please try again.");
  }

  const pitch = normalizePitch(parsed.pitch || parsed, project, language);
  if (pitch.slides.length === 0 || pitch.slides.every((slide) => !slide.speech)) {
    throw new Error("AI did not return any valid speech. Please try again.");
  }

  return pitch;
};

const parsePitchSlideResponse = (content, project, slideId, fallbackSlide = null) => {
  let parsed;
  try {
    parsed = JSON.parse(extractJsonPayload(content));
  } catch (error) {
    console.error("[pitch] Invalid AI slide JSON response:", String(content || "").slice(0, 1000));
    throw new Error("AI returned invalid slide speech JSON. Please try again.");
  }

  const presentation = normalizePresentation(project.presentation || {}, project);
  const presentationSlide = presentation.slides.find((slide) => slide.id === slideId) || (
    fallbackSlide
      ? { id: slideId, title: fallbackSlide.title || "Selected slide" }
      : null
  );
  if (!presentationSlide) throw new Error("Selected presentation slide was not found.");

  const slide = normalizeSlide({
    ...(parsed.slide || parsed),
    slideId,
  }, presentationSlide, 0, presentation, getProjectLanguage(project));
  if (!slide.speech) {
    throw new Error("AI did not return valid speech for this slide. Please try again.");
  }

  return slide;
};

const getProjectForUser = async (userId, projectId = null) => {
  const query = projectId ? { _id: projectId, user: userId } : { user: userId };
  const project = await Project.findOne(query);
  if (!project) throw new Error("Project not found for this user.");
  return project;
};

const getPitch = async (userId, projectId) => {
  const project = await getProjectForUser(userId, projectId);
  if (hasPitchSpeech(project.pitch || {})) {
    return normalizePitch(project.pitch || {});
  }

  return normalizePitch(project.pitch || {}, project);
};

const savePitch = async (userId, projectId, pitch) => {
  const project = await getProjectForUser(userId, projectId);
  const normalized = normalizePitch(pitch, project);
  const existing = normalizePitch(project.pitch || {});

  if (!hasPitchSpeech(normalized) && hasPitchSpeech(existing)) {
    return existing;
  }

  const existingVersion = Number(project.pitch?.version) || (project.pitch?.slides?.length ? 1 : 0);
  normalized.sourceFingerprint = getSourceFingerprint(project);
  normalized.version = hasPitchSpeech(normalized) ? existingVersion + 1 : 0;
  normalized.updatedAt = new Date();

  await Project.updateOne(
    { _id: project._id, user: userId },
    { $set: { pitch: normalized } },
    { runValidators: false }
  );

  return normalized;
};

const ensurePresentationReady = (project) => {
  const presentation = normalizePresentation(project.presentation || {}, project);
  if (presentation.slides.length === 0) {
    throw new Error("Generate the presentation before generating the pitch.");
  }
  return presentation;
};

const generatePitch = async (project) => {
  const presentation = ensurePresentationReady(project);
  const prompt = buildPitchGenerationPrompt(project, presentation);
  const response = await callGemini(prompt);
  return parsePitchResponse(response, project);
};

const refinePitch = async (project, currentPitch, instructions = "") => {
  const presentation = ensurePresentationReady(project);
  const pitch = normalizePitch(currentPitch, project);
  if (pitch.slides.every((slide) => !slide.speech)) {
    throw new Error("Current pitch is required to refine.");
  }

  const prompt = buildPitchRefinementPrompt(project, presentation, pitch, instructions);
  const response = await callGemini(prompt);
  return parsePitchResponse(response, project);
};

const generatePitchSlide = async (project, currentPitch, slideId) => {
  const presentation = ensurePresentationReady(project);
  const pitch = normalizePitch(currentPitch, project);
  const prompt = buildPitchSlideGenerationPrompt(project, presentation, pitch, slideId);
  const response = await callGemini(prompt);
  const slide = parsePitchSlideResponse(response, project, slideId);
  return normalizePitch({
    ...pitch,
    slides: pitch.slides.map((item) => (item.slideId === slideId ? slide : item)),
  }, project);
};

const refinePitchSlide = async (project, currentPitch, slideId, instructions = "") => {
  const presentation = ensurePresentationReady(project);
  const pitch = normalizePitch(currentPitch, project);
  const currentSlide = pitch.slides.find((slide) => slide.slideId === slideId);
  if (!currentSlide?.speech) {
    throw new Error("Current slide speech is required to refine.");
  }

  const prompt = buildPitchSlideRefinementPrompt(project, presentation, pitch, slideId, currentSlide, instructions);
  const response = await callGemini(prompt);
  const slide = parsePitchSlideResponse(response, project, slideId);
  return normalizePitch({
    ...pitch,
    slides: pitch.slides.map((item) => (item.slideId === slideId ? slide : item)),
  }, project);
};

const translatePitchSlide = async (project, currentPitch, slideId) => {
  const presentation = normalizePresentation(project.presentation || {}, project);
  const pitch = normalizePitch(currentPitch, project);
  const currentSlide = pitch.slides.find((slide) => slide.slideId === slideId);
  if (!currentSlide?.speech) {
    throw new Error("Current slide speech is required to translate.");
  }

  const prompt = buildPitchSlideTranslationPrompt(project, presentation, pitch, slideId, currentSlide);
  const response = await callGemini(prompt, null, { tier: "fast" });
  const slide = parsePitchSlideResponse(response, project, slideId, currentSlide);
  return normalizePitch({
    ...pitch,
    slides: pitch.slides.map((item) => (item.slideId === slideId ? slide : item)),
  }, project);
};

module.exports = {
  getPitch,
  savePitch,
  generatePitch,
  refinePitch,
  generatePitchSlide,
  refinePitchSlide,
  translatePitchSlide,
  normalizePitch,
};
