const Project = require("../models/Project");
const { callOpenRouter } = require("./openRouterService");
const {
  buildProductBacklogGenerationPrompt,
  buildProductBacklogRefinementPrompt,
} = require("./productBacklogPromptBuilder");

const VALID_PRIORITIES = new Set(["High", "Medium", "Low"]);

const normalizePriority = (priority) => {
  const cleaned = String(priority || "").trim().toLowerCase();
  if (["haute", "élevée", "elevee", "high"].includes(cleaned)) return "High";
  if (["basse", "faible", "low"].includes(cleaned)) return "Low";
  if (VALID_PRIORITIES.has(priority)) return priority;
  return "Medium";
};

const buildCode = (index, code) => {
  const cleaned = String(code || "").trim().toUpperCase();
  if (/^PB-\d{2,3}$/.test(cleaned)) return cleaned;
  return `PB-${String(index + 1).padStart(2, "0")}`;
};

const normalizeDuration = (durationDays) => {
  const value = Number.parseInt(String(durationDays || "").replace(",", "."), 10);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.round(value);
};

const normalizeProductBacklog = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => ({
      code: buildCode(index, item?.code || item?.id),
      epic: String(item?.epic || item?.phase || "Project").trim(),
      task: String(item?.task || item?.title || item?.description || "").trim(),
      priority: normalizePriority(item?.priority),
      durationDays: normalizeDuration(item?.durationDays || item?.duration || item?.days),
      sprint: String(item?.sprint || item?.phase || "").trim(),
      notes: String(item?.notes || "").trim(),
    }))
    .filter((item) => item.epic && item.task && item.durationDays > 0)
    .map((item, index) => ({
      ...item,
      code: buildCode(index, item.code),
    }));
};

const parseProductBacklogResponse = (content) => {
  const cleaned = extractJsonPayload(content);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new Error("AI returned invalid product backlog JSON. Please try again.");
  }

  const productBacklog = normalizeProductBacklog(Array.isArray(parsed) ? parsed : parsed.productBacklog);
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
  return parseProductBacklogResponse(response);
};

const refineProductBacklog = async (project, currentBacklog) => {
  const productBacklog = normalizeProductBacklog(currentBacklog);
  if (productBacklog.length === 0) {
    throw new Error("Current product backlog is required to refine.");
  }

  const prompt = buildProductBacklogRefinementPrompt(project, productBacklog);
  const response = await callOpenRouter(prompt);
  return parseProductBacklogResponse(response);
};

const getProductBacklog = async (userId, projectId) => {
  const project = await getProjectForUser(userId, projectId);
  return project.productBacklog || [];
};

const saveProductBacklog = async (userId, projectId, productBacklog) => {
  const normalizedBacklog = normalizeProductBacklog(productBacklog);
  const project = await Project.findOneAndUpdate(
    { _id: projectId, user: userId },
    { $set: { productBacklog: normalizedBacklog } },
    { new: true, runValidators: true }
  );

  if (!project) {
    throw new Error("Project not found for this user.");
  }

  return project.productBacklog;
};

module.exports = {
  generateProductBacklog,
  refineProductBacklog,
  getProductBacklog,
  saveProductBacklog,
  normalizeProductBacklog,
};
