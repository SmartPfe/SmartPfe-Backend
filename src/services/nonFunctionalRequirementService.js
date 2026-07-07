const Project = require("../models/Project");
const { callOpenRouter } = require("./openRouterService");
const {
  buildNonFunctionalRequirementGenerationPrompt,
  buildNonFunctionalRequirementRefinementPrompt,
} = require("./nonFunctionalRequirementPromptBuilder");

const VALID_PRIORITIES = new Set(["Must Have", "Should Have", "Could Have", "Won't Have"]);
const VALID_STATUSES = new Set(["Draft", "In Review", "Approved"]);

const normalizePriority = (priority) => (VALID_PRIORITIES.has(priority) ? priority : "Should Have");
const normalizeStatus = (status) => (VALID_STATUSES.has(status) ? status : "Draft");

const buildCode = (index, code) => {
  const cleaned = String(code || "").trim().toUpperCase();
  if (/^NFR-\d{2,3}$/.test(cleaned)) return cleaned;
  return `NFR-${String(index + 1).padStart(2, "0")}`;
};

const normalizeNonFunctionalRequirements = (requirements) => {
  if (!Array.isArray(requirements)) return [];

  return requirements
    .map((requirement, index) => ({
      code: buildCode(index, requirement?.code || requirement?.id),
      category: String(requirement?.category || "Quality").trim(),
      title: String(requirement?.title || "").trim(),
      description: String(requirement?.description || "").trim(),
      priority: normalizePriority(requirement?.priority),
      status: normalizeStatus(requirement?.status),
    }))
    .filter((requirement) => requirement.category && requirement.title && requirement.description)
    .map((requirement, index) => ({
      ...requirement,
      code: buildCode(index, requirement.code),
    }));
};

const extractJsonPayload = (content) => {
  const text = String(content || "").trim();
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : text;

  if (candidate.startsWith("{") || candidate.startsWith("[")) {
    return candidate;
  }

  const objectStart = candidate.indexOf("{");
  const objectEnd = candidate.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    return candidate.slice(objectStart, objectEnd + 1);
  }

  const arrayStart = candidate.indexOf("[");
  const arrayEnd = candidate.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    return candidate.slice(arrayStart, arrayEnd + 1);
  }

  return candidate;
};

const getRequirementsPayload = (parsed) => {
  if (Array.isArray(parsed)) return parsed;
  return (
    parsed?.nonFunctionalRequirements ||
    parsed?.non_functional_requirements ||
    parsed?.requirements ||
    parsed?.nfrs ||
    []
  );
};

const parseNonFunctionalRequirementsResponse = (content) => {
  const cleaned = extractJsonPayload(content);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    console.error("[nfr] Invalid AI JSON response:", String(content || "").slice(0, 1000));
    throw new Error("AI returned invalid non-functional requirement JSON. Please try again.");
  }

  const requirements = normalizeNonFunctionalRequirements(getRequirementsPayload(parsed));
  if (requirements.length === 0) {
    throw new Error("AI did not return any valid non-functional requirements. Please try again.");
  }

  return requirements;
};

const getProjectForUser = async (userId, projectId = null) => {
  const query = projectId ? { _id: projectId, user: userId } : { user: userId };
  const project = await Project.findOne(query);
  if (!project) {
    throw new Error("Project not found for this user.");
  }
  return project;
};

const generateNonFunctionalRequirements = async (project) => {
  const prompt = buildNonFunctionalRequirementGenerationPrompt(project);
  const response = await callOpenRouter(prompt);
  return parseNonFunctionalRequirementsResponse(response);
};

const refineNonFunctionalRequirements = async (project, currentRequirements) => {
  const requirements = normalizeNonFunctionalRequirements(currentRequirements);
  if (requirements.length === 0) {
    throw new Error("Current non-functional requirements are required to refine.");
  }

  const prompt = buildNonFunctionalRequirementRefinementPrompt(project, requirements);
  const response = await callOpenRouter(prompt);
  return parseNonFunctionalRequirementsResponse(response);
};

const getNonFunctionalRequirements = async (userId, projectId) => {
  const project = await getProjectForUser(userId, projectId);
  return project.nonFunctionalRequirements || [];
};

const saveNonFunctionalRequirements = async (userId, projectId, nonFunctionalRequirements) => {
  const normalizedRequirements = normalizeNonFunctionalRequirements(nonFunctionalRequirements);
  const project = await Project.findOneAndUpdate(
    { _id: projectId, user: userId },
    { $set: { nonFunctionalRequirements: normalizedRequirements } },
    { new: true, runValidators: true }
  );

  if (!project) {
    throw new Error("Project not found for this user.");
  }

  return project.nonFunctionalRequirements;
};

module.exports = {
  generateNonFunctionalRequirements,
  refineNonFunctionalRequirements,
  getNonFunctionalRequirements,
  saveNonFunctionalRequirements,
  normalizeNonFunctionalRequirements,
};
