const Project = require("../models/Project");
const { callGemini } = require("./geminiService");
const {
  buildFunctionalRequirementGenerationPrompt,
  buildFunctionalRequirementRefinementPrompt,
  buildFunctionalRequirementTranslationPrompt,
} = require("./functionalRequirementPromptBuilder");

const VALID_PRIORITIES = new Set(["Must Have", "Should Have", "Could Have", "Won't Have"]);
const VALID_STATUSES = new Set(["Draft", "In Review", "Approved"]);

const normalizePriority = (priority) => {
  if (VALID_PRIORITIES.has(priority)) return priority;
  return "Should Have";
};

const normalizeStatus = (status) => {
  if (VALID_STATUSES.has(status)) return status;
  return "Draft";
};

const buildCode = (index, code) => {
  const cleaned = String(code || "").trim().toUpperCase();
  if (/^FR-\d{2,3}$/.test(cleaned)) return cleaned;
  return `FR-${String(index + 1).padStart(2, "0")}`;
};

const normalizeFunctionalRequirements = (requirements) => {
  if (!Array.isArray(requirements)) {
    return [];
  }

  return requirements
    .map((requirement, index) => ({
      code: buildCode(index, requirement?.code || requirement?.id),
      module: String(requirement?.module || "Core").trim(),
      title: String(requirement?.title || "").trim(),
      description: String(requirement?.description || "").trim(),
      priority: normalizePriority(requirement?.priority),
      status: normalizeStatus(requirement?.status),
    }))
    .filter((requirement) => requirement.module && requirement.title && requirement.description)
    .map((requirement, index) => ({
      ...requirement,
      code: buildCode(index, requirement.code),
    }));
};

const parseFunctionalRequirementsResponse = (content) => {
  const cleaned = String(content || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new Error("AI returned invalid functional requirement JSON. Please try again.");
  }

  const requirements = normalizeFunctionalRequirements(parsed.functionalRequirements);
  if (requirements.length === 0) {
    throw new Error("AI did not return any valid functional requirements. Please try again.");
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

const generateFunctionalRequirements = async (project) => {
  const prompt = buildFunctionalRequirementGenerationPrompt(project);
  const response = await callGemini(prompt);
  return parseFunctionalRequirementsResponse(response);
};

const refineFunctionalRequirements = async (project, currentRequirements, instructions = "") => {
  const requirements = normalizeFunctionalRequirements(currentRequirements);
  if (requirements.length === 0) {
    throw new Error("Current functional requirements are required to refine.");
  }

  const prompt = buildFunctionalRequirementRefinementPrompt(project, requirements, instructions);
  const response = await callGemini(prompt);
  return parseFunctionalRequirementsResponse(response);
};

const translateFunctionalRequirements = async (project, currentRequirements) => {
  const requirements = normalizeFunctionalRequirements(currentRequirements);
  if (requirements.length === 0) {
    throw new Error("Current functional requirements are required to translate.");
  }

  const prompt = buildFunctionalRequirementTranslationPrompt(project, requirements);
  const response = await callGemini(prompt, null, { tier: "fast" });
  return parseFunctionalRequirementsResponse(response);
};

const getFunctionalRequirements = async (userId, projectId) => {
  const project = await getProjectForUser(userId, projectId);
  return project.functionalRequirements || [];
};

const saveFunctionalRequirements = async (userId, projectId, functionalRequirements, language) => {
  const normalizedRequirements = normalizeFunctionalRequirements(functionalRequirements);
  const updates = { functionalRequirements: normalizedRequirements };
  if (language !== undefined) {
    updates.functionalRequirementsLanguage = language;
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
    functionalRequirements: project.functionalRequirements,
    language: project.functionalRequirementsLanguage,
  };
};

module.exports = {
  generateFunctionalRequirements,
  refineFunctionalRequirements,
  translateFunctionalRequirements,
  getFunctionalRequirements,
  saveFunctionalRequirements,
  normalizeFunctionalRequirements,
};
