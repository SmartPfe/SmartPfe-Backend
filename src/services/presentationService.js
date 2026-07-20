const crypto = require("crypto");
const Project = require("../models/Project");
const { callOpenRouter } = require("./openRouterService");
const {
  buildPresentationGenerationPrompt,
  buildPresentationRefinementPrompt,
} = require("./presentationPromptBuilder");

const VALID_DURATIONS = new Set([5, 10, 15, 20]);

const createSlideId = (index) => `slide-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;

const normalizeDuration = (value) => {
  const duration = Number(value);
  return VALID_DURATIONS.has(duration) ? duration : 10;
};

const normalizeBullets = (items) =>
  Array.isArray(items)
    ? items.map((item) => String(item || "").trim()).filter(Boolean)
    : String(items || "")
      .split(/\r?\n/)
      .map((item) => item.replace(/^\s*[-*•]\s*/, "").trim())
      .filter(Boolean);

const normalizeSlides = (slides = []) =>
  Array.isArray(slides)
    ? slides
      .map((slide, index) => ({
        id: String(slide.id || createSlideId(index)).trim(),
        title: String(slide.title || `Slide ${index + 1}`).trim(),
        bullets: normalizeBullets(slide.bullets),
        notes: String(slide.notes || slide.speakerNotes || "").trim(),
      }))
      .filter((slide) => slide.title)
    : [];

const getSourceSnapshot = (project) => ({
  basics: project.basics,
  description: project.description,
  technicalContext: project.technicalContext,
  actors: project.actors,
  existingSolutions: project.existingSolutions,
  functionalRequirements: project.functionalRequirements,
  nonFunctionalRequirements: project.nonFunctionalRequirements,
  productBacklog: project.productBacklog,
  userStories: project.userStories,
  umlPreparation: project.umlPreparation,
  reportStructure: project.reportStructure,
  reportChapters: project.reportChapters,
  finalReport: project.finalReport,
});

const getSourceFingerprint = (project) =>
  crypto.createHash("sha256").update(JSON.stringify(getSourceSnapshot(project))).digest("hex");

const normalizePresentation = (presentation = {}, project = null) => ({
  durationMinutes: normalizeDuration(presentation.durationMinutes),
  slides: normalizeSlides(presentation.slides),
  sourceFingerprint: String(presentation.sourceFingerprint || (project ? getSourceFingerprint(project) : "")).trim(),
  updatedAt: presentation.updatedAt || new Date(),
});

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

const parsePresentationResponse = (content, project, durationMinutes) => {
  let parsed;
  try {
    parsed = JSON.parse(extractJsonPayload(content));
  } catch (error) {
    console.error("[presentation] Invalid AI JSON response:", String(content || "").slice(0, 1000));
    throw new Error("AI returned invalid presentation JSON. Please try again.");
  }

  const presentation = normalizePresentation({
    ...(parsed.presentation || parsed),
    durationMinutes: parsed.presentation?.durationMinutes || parsed.durationMinutes || durationMinutes,
  }, project);

  if (presentation.slides.length === 0) {
    throw new Error("AI did not return any valid slides. Please try again.");
  }

  return presentation;
};

const getProjectForUser = async (userId, projectId = null) => {
  const query = projectId ? { _id: projectId, user: userId } : { user: userId };
  const project = await Project.findOne(query);
  if (!project) throw new Error("Project not found for this user.");
  return project;
};

const getPresentation = async (userId, projectId) => {
  const project = await getProjectForUser(userId, projectId);
  return normalizePresentation(project.presentation || {}, project);
};

const savePresentation = async (userId, projectId, presentation) => {
  const project = await getProjectForUser(userId, projectId);
  const normalized = normalizePresentation(presentation, project);
  normalized.sourceFingerprint = getSourceFingerprint(project);
  normalized.updatedAt = new Date();

  project.presentation = normalized;
  await project.save();
  return normalizePresentation(project.presentation || {}, project);
};

const generatePresentation = async (project, durationMinutes) => {
  const duration = normalizeDuration(durationMinutes);
  const prompt = buildPresentationGenerationPrompt(project, duration);
  const response = await callOpenRouter(prompt);
  return parsePresentationResponse(response, project, duration);
};

const refinePresentation = async (project, currentPresentation) => {
  const presentation = normalizePresentation(currentPresentation, project);
  if (presentation.slides.length === 0) {
    throw new Error("Current presentation is required to refine.");
  }

  const prompt = buildPresentationRefinementPrompt(project, presentation);
  const response = await callOpenRouter(prompt);
  return parsePresentationResponse(response, project, presentation.durationMinutes);
};

module.exports = {
  getPresentation,
  savePresentation,
  generatePresentation,
  refinePresentation,
  normalizePresentation,
  getSourceFingerprint,
};
