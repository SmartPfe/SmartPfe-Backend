const Project = require("../models/Project");
const { callOpenRouter } = require("./openRouterService");
const {
  buildActorGenerationPrompt,
  buildActorRefinementPrompt,
  buildActorTranslationPrompt,
} = require("./actorPromptBuilder");

const VALID_TYPES = new Set(["primary", "external"]);

const normalizeType = (type) => {
  if (type === "external" || type === "system") return "external";
  return "primary";
};

const normalizeActors = (actors) => {
  if (!Array.isArray(actors)) {
    return [];
  }

  return actors
    .map((actor) => ({
      name: String(actor?.name || "").trim(),
      description: String(actor?.description || "").trim(),
      type: VALID_TYPES.has(actor?.type) ? actor.type : normalizeType(actor?.type),
      icon: String(actor?.icon || (normalizeType(actor?.type) === "external" ? "api" : "person")).trim(),
    }))
    .filter((actor) => actor.name && actor.description);
};

const parseActorsResponse = (content) => {
  const cleaned = String(content || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new Error("AI returned invalid actor JSON. Please try again.");
  }

  const actors = normalizeActors(parsed.actors);
  if (actors.length === 0) {
    throw new Error("AI did not return any valid actors. Please try again.");
  }

  return actors;
};

const getProjectForUser = async (userId, projectId = null) => {
  const query = projectId ? { _id: projectId, user: userId } : { user: userId };
  const project = await Project.findOne(query);
  if (!project) {
    throw new Error("Project not found for this user.");
  }
  return project;
};

const generateActors = async (project) => {
  const prompt = buildActorGenerationPrompt(project);
  const response = await callOpenRouter(prompt);
  return parseActorsResponse(response);
};

const refineActors = async (project, currentActors, instructions = "") => {
  const actors = normalizeActors(currentActors);
  if (actors.length === 0) {
    throw new Error("Current actors are required to refine.");
  }

  const prompt = buildActorRefinementPrompt(project, actors, instructions);
  const response = await callOpenRouter(prompt);
  return parseActorsResponse(response);
};

const translateActors = async (project, currentActors) => {
  const actors = normalizeActors(currentActors);
  if (actors.length === 0) {
    throw new Error("Current actors are required to translate.");
  }

  const prompt = buildActorTranslationPrompt(project, actors);
  const response = await callOpenRouter(prompt);
  return parseActorsResponse(response);
};

const getActors = async (userId, projectId) => {
  const project = await getProjectForUser(userId, projectId);
  return project.actors || [];
};

const saveActors = async (userId, projectId, actors, language) => {
  const normalizedActors = normalizeActors(actors);
  const updates = { actors: normalizedActors };
  if (language !== undefined) {
    updates.actorsLanguage = language;
  }

  const project = await Project.findOneAndUpdate(
    { _id: projectId, user: userId },
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!project) {
    throw new Error("Project not found for this user.");
  }

  return {
    actors: project.actors,
    language: project.actorsLanguage,
  };
};

module.exports = {
  generateActors,
  refineActors,
  translateActors,
  getActors,
  saveActors,
  getProjectForUser,
  normalizeActors,
};
