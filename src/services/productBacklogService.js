const Project = require("../models/Project");
const { callOpenRouter } = require("./openRouterService");
const {
  buildProductBacklogGenerationPrompt,
  buildProductBacklogRefinementPrompt,
  buildProductBacklogTranslationPrompt,
} = require("./productBacklogPromptBuilder");

const VALID_PRIORITIES = new Set(["High", "Medium", "Low"]);

const normalizePriority = (priority) => {
  const cleaned = String(priority || "").trim().toLowerCase();
  if (["must", "must have", "high"].includes(cleaned)) return "High";
  if (["could", "could have", "won't", "wont", "will not", "won't have", "wont have", "low"].includes(cleaned)) return "Low";
  if (["should", "should have", "medium"].includes(cleaned)) return "Medium";
  if (["haute", "élevée", "elevee", "high"].includes(cleaned)) return "High";
  if (["basse", "faible", "low"].includes(cleaned)) return "Low";
  if (VALID_PRIORITIES.has(priority)) return priority;
  return "Medium";
};

const buildCode = (index, code) => {
  const cleaned = String(code || "").trim();
  if (/^\d+\.\d+$/.test(cleaned)) return cleaned;
  return `1.${index + 1}`;
};

const normalizeDuration = (durationDays) => {
  const value = Number.parseInt(String(durationDays || "").replace(",", "."), 10);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.round(value);
};

const normalizeSprint = (item, index) =>
  String(item?.sprint || item?.iteration || item?.phase || `Sprint ${Math.floor(index / 4) + 1}`).trim();

const looksLikeUserStory = (value = "") => {
  const cleaned = String(value || "").trim().toLowerCase();
  return cleaned.startsWith("en tant") || cleaned.startsWith("as a ") || cleaned.startsWith("as an ");
};

const getPrimaryActorNames = (project = {}) =>
  (project.actors || [])
    .filter((actor) => actor?.type !== "external" && String(actor?.name || "").trim())
    .map((actor) => String(actor.name).trim());

const extractActorFromStory = (value = "") => {
  const match = String(value || "").trim().match(/^as an?\s+([^,]+),?\s+i want/i);
  return match?.[1]?.trim() || "";
};

const normalizeActors = (item, project) => {
  const primaryActors = getPrimaryActorNames(project);
  const rawActors = Array.isArray(item?.actors)
    ? item.actors
    : item?.actor || item?.asA
      ? [item.actor || item.asA]
      : [];

  const storyActor = extractActorFromStory(item?.notes || item?.task || item?.description || "");
  const candidates = [...rawActors, storyActor]
    .flatMap((actor) => String(actor || "").split(/[,;\n]/))
    .map((actor) => actor.trim())
    .filter(Boolean);

  if (primaryActors.length === 0) {
    return candidates.length ? Array.from(new Set(candidates)) : ["User"];
  }

  const matchedActors = candidates
    .map((actor) => primaryActors.find((primaryActor) => primaryActor.toLowerCase() === actor.toLowerCase()))
    .filter(Boolean);

  return matchedActors.length ? Array.from(new Set(matchedActors)) : [primaryActors[0]];
};

const normalizeStoryTitle = (item, index) => {
  const task = String(item?.task || item?.title || "").trim();
  if (task && !looksLikeUserStory(task)) return task;
  const theme = String(item?.theme || item?.userStory || item?.epic || "").trim();
  if (theme && theme !== "Project") return theme;
  return `User Story ${index + 1}`;
};

const normalizeStoryDescription = (item) => {
  const description = String(item?.notes || item?.description || "").trim();
  if (description) return description;
  const task = String(item?.task || item?.title || "").trim();
  if (looksLikeUserStory(task)) return task;
  return task ? `Goal: ${task}` : "";
};

const renumberProductBacklog = (items) => {
  const epicOrder = new Map();
  const epicCounts = new Map();

  return items.map((item) => {
    const epic = item.epic || "Project";
    if (!epicOrder.has(epic)) {
      epicOrder.set(epic, epicOrder.size + 1);
    }

    const nextCount = (epicCounts.get(epic) || 0) + 1;
    epicCounts.set(epic, nextCount);

    return {
      ...item,
      code: `${epicOrder.get(epic)}.${nextCount}`,
    };
  });
};

const normalizeProductBacklog = (items, project = {}) => {
  if (!Array.isArray(items)) {
    return [];
  }

  const normalizedItems = items
    .map((item, index) => ({
      code: buildCode(index, item?.code || item?.id),
      epic: String(item?.epic || item?.phase || "Project").trim(),
      actors: normalizeActors(item, project),
      task: normalizeStoryTitle(item, index),
      priority: normalizePriority(item?.priority),
      durationDays: normalizeDuration(item?.durationDays || item?.duration || item?.days),
      sprint: normalizeSprint(item, index),
      notes: normalizeStoryDescription(item),
    }))
    .filter((item) => item.epic && item.actors.length > 0 && item.task && item.sprint && item.durationDays > 0);

  return renumberProductBacklog(normalizedItems);
};

const parseProductBacklogResponse = (content, project) => {
  const cleaned = extractJsonPayload(content);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new Error("AI returned invalid product backlog JSON. Please try again.");
  }

  const productBacklog = normalizeProductBacklog(Array.isArray(parsed) ? parsed : parsed.productBacklog, project);
  if (productBacklog.length === 0) {
    throw new Error("AI did not return any valid product backlog tasks. Please try again.");
  }

  return productBacklog;
};

const extractJsonPayload = (content) => {
  const text = String(content || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (text.startsWith("{") || text.startsWith("[")) {
    return text;
  }

  const firstObjectIndex = text.indexOf("{");
  if (firstObjectIndex === -1) {
    return text;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = firstObjectIndex; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;

    if (depth === 0) {
      return text.slice(firstObjectIndex, index + 1);
    }
  }

  return text.slice(firstObjectIndex);
};

const getProjectForUser = async (userId, projectId = null) => {
  const query = projectId ? { _id: projectId, user: userId } : { user: userId };
  const project = await Project.findOne(query);
  if (!project) {
    throw new Error("Project not found for this user.");
  }
  return project;
};

const generateProductBacklog = async (project) => {
  const prompt = buildProductBacklogGenerationPrompt(project);
  const response = await callOpenRouter(prompt);
  return parseProductBacklogResponse(response, project);
};

const refineProductBacklog = async (project, currentBacklog, instructions = "") => {
  const productBacklog = normalizeProductBacklog(currentBacklog, project);
  if (productBacklog.length === 0) {
    throw new Error("Current product backlog is required to refine.");
  }

  const prompt = buildProductBacklogRefinementPrompt(project, productBacklog, instructions);
  const response = await callOpenRouter(prompt);
  return parseProductBacklogResponse(response, project);
};

const translateProductBacklog = async (project, currentBacklog) => {
  const productBacklog = normalizeProductBacklog(currentBacklog, project);
  if (productBacklog.length === 0) {
    throw new Error("Current product backlog is required to translate.");
  }

  const prompt = buildProductBacklogTranslationPrompt(project, productBacklog);
  const response = await callOpenRouter(prompt);
  return parseProductBacklogResponse(response, project);
};

const getProductBacklog = async (userId, projectId) => {
  const project = await getProjectForUser(userId, projectId);
  return normalizeProductBacklog(project.productBacklog || [], project);
};

const saveProductBacklog = async (userId, projectId, productBacklog, language) => {
  const currentProject = await getProjectForUser(userId, projectId);
  const normalizedBacklog = normalizeProductBacklog(productBacklog, currentProject);
  const updates = { productBacklog: normalizedBacklog };
  if (language !== undefined) {
    updates.productBacklogLanguage = language;
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
    productBacklog: project.productBacklog,
    language: project.productBacklogLanguage,
  };
};

module.exports = {
  generateProductBacklog,
  refineProductBacklog,
  translateProductBacklog,
  getProductBacklog,
  saveProductBacklog,
  normalizeProductBacklog,
};
