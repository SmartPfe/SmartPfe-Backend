const { interfaceError } = require("../lib/interfaceMessages");
const Project = require("../models/Project");
const { callGemini } = require("./geminiService");
const {
  buildExistingSolutionGenerationPrompt,
  buildExistingSolutionRefinementPrompt,
  buildExistingSolutionTranslationPrompt,
} = require("./existingSolutionPromptBuilder");

const normalizeList = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
};

const normalizeExistingSolutions = (solutions) => {
  if (!Array.isArray(solutions)) {
    return [];
  }

  return solutions
    .map((solution) => ({
      name: String(solution?.name || "").trim(),
      category: String(solution?.category || "Existing Solution").trim(),
      icon: String(solution?.icon || "search").trim(),
      description: String(solution?.description || "").trim(),
      solvedProblem: String(solution?.solvedProblem || "").trim(),
      strengths: normalizeList(solution?.strengths),
      weaknesses: normalizeList(solution?.weaknesses),
      differentiation: String(solution?.differentiation || "").trim(),
    }))
    .filter(
      (solution) =>
        solution.name &&
        solution.description &&
        solution.solvedProblem &&
        solution.differentiation
    );
};

const parseExistingSolutionsResponse = (content) => {
  const cleaned = String(content || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw interfaceError("AI returned invalid existing solution JSON. Please try again.", "ai.existingSolutionGenerationFailed");
  }

  const solutions = normalizeExistingSolutions(parsed.existingSolutions);
  if (solutions.length === 0) {
    throw interfaceError("AI did not return any valid existing solutions. Please try again.", "ai.existingSolutionGenerationFailed");
  }

  return solutions;
};

const getProjectForUser = async (userId, projectId = null) => {
  const query = projectId ? { _id: projectId, user: userId } : { user: userId };
  const project = await Project.findOne(query);
  if (!project) {
    throw interfaceError("Project not found for this user.", "project.notFound");
  }
  return project;
};

const generateExistingSolutions = async (project) => {
  const prompt = buildExistingSolutionGenerationPrompt(project);
  const response = await callGemini(prompt);
  return parseExistingSolutionsResponse(response);
};

const refineExistingSolutions = async (project, currentSolutions, instructions = "") => {
  const solutions = normalizeExistingSolutions(currentSolutions);
  if (solutions.length === 0) {
    throw interfaceError("Current existing solutions are required to refine.", "ai.currentSolutionsRequiredToRefine");
  }

  const prompt = buildExistingSolutionRefinementPrompt(project, solutions, instructions);
  const response = await callGemini(prompt);
  return parseExistingSolutionsResponse(response);
};

const translateExistingSolutions = async (project, currentSolutions) => {
  const solutions = normalizeExistingSolutions(currentSolutions);
  if (solutions.length === 0) {
    throw interfaceError("Current existing solutions are required to translate.", "ai.currentSolutionsRequiredToTranslate");
  }

  const prompt = buildExistingSolutionTranslationPrompt(project, solutions);
  const response = await callGemini(prompt, null, { tier: "fast" });
  return parseExistingSolutionsResponse(response);
};

const getExistingSolutions = async (userId, projectId) => {
  const project = await getProjectForUser(userId, projectId);
  return project.existingSolutions || [];
};

const saveExistingSolutions = async (userId, projectId, existingSolutions, language) => {
  const normalizedSolutions = normalizeExistingSolutions(existingSolutions);
  const updates = { existingSolutions: normalizedSolutions };
  if (language !== undefined) {
    updates.existingSolutionsLanguage = language;
  }

  const project = await Project.findOneAndUpdate(
    { _id: projectId, user: userId },
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!project) {
    throw interfaceError("Project not found for this user.", "project.notFound");
  }

  return {
    existingSolutions: project.existingSolutions,
    language: project.existingSolutionsLanguage,
  };
};

module.exports = {
  generateExistingSolutions,
  refineExistingSolutions,
  translateExistingSolutions,
  getExistingSolutions,
  saveExistingSolutions,
  normalizeExistingSolutions,
};
