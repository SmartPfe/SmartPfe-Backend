const Project = require("../models/Project");
const { callOpenRouter } = require("./openRouterService");
const {
  buildUmlPreparationGenerationPrompt,
  buildUmlPreparationRefinementPrompt,
} = require("./umlPreparationPromptBuilder");

const RELATIONSHIP_TYPES = new Set(["association", "inheritance", "composition", "aggregation", "dependency"]);

const normalizeList = (value) => (Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : []);

const sanitizeClassName = (value, fallback) => {
  const cleaned = String(value || "").replace(/[^a-zA-Z0-9_]/g, "").trim();
  if (!cleaned) return fallback;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const normalizeClasses = (classes) => {
  if (!Array.isArray(classes)) return [];
  return classes
    .map((umlClass, index) => ({
      name: sanitizeClassName(umlClass?.name, `Class${index + 1}`),
      type: String(umlClass?.type || "Class").trim(),
      description: String(umlClass?.description || "").trim(),
      attributes: normalizeList(umlClass?.attributes),
      methods: normalizeList(umlClass?.methods),
    }))
    .filter((umlClass) => umlClass.name);
};

const normalizeRelationships = (relationships, classNames) => {
  if (!Array.isArray(relationships)) return [];
  const knownClasses = new Set(classNames);
  return relationships
    .map((relationship) => ({
      source: sanitizeClassName(relationship?.source, ""),
      target: sanitizeClassName(relationship?.target, ""),
      type: RELATIONSHIP_TYPES.has(relationship?.type) ? relationship.type : "association",
      label: String(relationship?.label || "").trim(),
      sourceMultiplicity: String(relationship?.sourceMultiplicity || "").trim(),
      targetMultiplicity: String(relationship?.targetMultiplicity || "").trim(),
    }))
    .filter((relationship) => relationship.source && relationship.target && knownClasses.has(relationship.source) && knownClasses.has(relationship.target));
};

const normalizeUseCase = (useCase = {}) => {
  const actors = normalizeList(useCase.actors);
  const useCases = normalizeList(useCase.useCases);
  const links = Array.isArray(useCase.links)
    ? useCase.links
        .map((link) => ({
          actor: String(link?.actor || "").trim(),
          useCase: String(link?.useCase || "").trim(),
        }))
        .filter((link) => link.actor && link.useCase)
    : [];
  return { actors, useCases, links };
};

const normalizeSequence = (sequence = {}) => {
  const participants = normalizeList(sequence.participants);
  const messages = Array.isArray(sequence.messages)
    ? sequence.messages
        .map((message) => ({
          source: String(message?.source || "").trim(),
          target: String(message?.target || "").trim(),
          message: String(message?.message || "").trim(),
          response: Boolean(message?.response),
        }))
        .filter((message) => message.source && message.target && message.message)
    : [];
  return { participants, messages };
};

const normalizeActivity = (activity = {}) => {
  const transitions = Array.isArray(activity.transitions)
    ? activity.transitions
        .map((transition) => ({
          from: String(transition?.from || "").trim(),
          to: String(transition?.to || "").trim(),
          label: String(transition?.label || "").trim(),
        }))
        .filter((transition) => transition.from && transition.to)
    : [];
  return { transitions };
};

const normalizeUmlPreparation = (payload) => {
  const source = payload?.umlPreparation || payload || {};
  const classes = normalizeClasses(source.classes);
  const relationships = normalizeRelationships(source.relationships, classes.map((umlClass) => umlClass.name));

  return {
    classes,
    relationships,
    useCase: normalizeUseCase(source.useCase),
    sequence: normalizeSequence(source.sequence),
    activity: normalizeActivity(source.activity),
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

const parseUmlPreparationResponse = (content) => {
  let parsed;
  try {
    parsed = JSON.parse(extractJsonPayload(content));
  } catch (error) {
    console.error("[uml] Invalid AI JSON response:", String(content || "").slice(0, 1000));
    throw new Error("AI returned invalid UML preparation JSON. Please try again.");
  }

  const umlPreparation = normalizeUmlPreparation(parsed);
  if (umlPreparation.classes.length === 0) {
    throw new Error("AI did not return any valid UML classes. Please try again.");
  }
  return umlPreparation;
};

const getProjectForUser = async (userId, projectId = null) => {
  const query = projectId ? { _id: projectId, user: userId } : { user: userId };
  const project = await Project.findOne(query);
  if (!project) throw new Error("Project not found for this user.");
  return project;
};

const generateUmlPreparation = async (project) => {
  const prompt = buildUmlPreparationGenerationPrompt(project);
  const response = await callOpenRouter(prompt);
  return parseUmlPreparationResponse(response);
};

const refineUmlPreparation = async (project, currentUmlPreparation) => {
  const umlPreparation = normalizeUmlPreparation(currentUmlPreparation);
  if (umlPreparation.classes.length === 0) {
    throw new Error("Current UML preparation is required to refine.");
  }

  const prompt = buildUmlPreparationRefinementPrompt(project, umlPreparation);
  const response = await callOpenRouter(prompt);
  return parseUmlPreparationResponse(response);
};

const getUmlPreparation = async (userId, projectId) => {
  const project = await getProjectForUser(userId, projectId);
  return normalizeUmlPreparation(project.umlPreparation || {});
};

const saveUmlPreparation = async (userId, projectId, umlPreparation) => {
  const normalized = normalizeUmlPreparation(umlPreparation);
  const project = await Project.findOneAndUpdate(
    { _id: projectId, user: userId },
    { $set: { umlPreparation: normalized } },
    { new: true, runValidators: true }
  );

  if (!project) throw new Error("Project not found for this user.");
  return normalizeUmlPreparation(project.umlPreparation || {});
};

module.exports = {
  generateUmlPreparation,
  refineUmlPreparation,
  getUmlPreparation,
  saveUmlPreparation,
  normalizeUmlPreparation,
};
