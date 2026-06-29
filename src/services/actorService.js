const Project = require("../models/Project");
const { callOpenRouter } = require("./openRouterService");
const {
  buildActorGenerationPrompt,
  buildActorRefinementPrompt,
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

const refineActors = async (project, currentActors) => {
  const actors = normalizeActors(currentActors);
  if (actors.length === 0) {
    throw new Error("Current actors are required to refine.");
  }

  const prompt = buildActorRefinementPrompt(project, actors);
  const response = await callOpenRouter(prompt);
  return parseActorsResponse(response);
};

const getActors = async (userId, projectId) => {
  const project = await getProjectForUser(userId, projectId);
  return project.actors || [];
};

const saveActors = async (userId, projectId, actors) => {
  const normalizedActors = normalizeActors(actors);
  const project = await Project.findOneAndUpdate(
    { _id: projectId, user: userId },
    { $set: { actors: normalizedActors } },
    { new: true, runValidators: true }
  );

  if (!project) {
    throw new Error("Project not found for this user.");
  }

  return project.actors;
};

module.exports = {
  generateActors,
  refineActors,
  getActors,
  saveActors,
  getProjectForUser,
  normalizeActors,
};
