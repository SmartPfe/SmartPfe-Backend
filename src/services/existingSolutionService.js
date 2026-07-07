const Project = require("../models/Project");
const { callOpenRouter } = require("./openRouterService");
const {
  buildExistingSolutionGenerationPrompt,
  buildExistingSolutionRefinementPrompt,
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
    throw new Error("AI returned invalid existing solution JSON. Please try again.");
  }

  const solutions = normalizeExistingSolutions(parsed.existingSolutions);
  if (solutions.length === 0) {
    throw new Error("AI did not return any valid existing solutions. Please try again.");
  }

  return solutions;
};

const getProjectForUser = async (userId, projectId = null) => {
  const query = projectId ? { _id: projectId, user: userId } : { user: userId };
  const project = await Project.findOne(query);
  if (!project) {
    throw new Error("Project not found for this user.");
  }
  return project;
};

const generateExistingSolutions = async (project) => {
  const prompt = buildExistingSolutionGenerationPrompt(project);
  const response = await callOpenRouter(prompt);
  return parseExistingSolutionsResponse(response);
};

const refineExistingSolutions = async (project, currentSolutions) => {
  const solutions = normalizeExistingSolutions(currentSolutions);
  if (solutions.length === 0) {
    throw new Error("Current existing solutions are required to refine.");
  }

  const prompt = buildExistingSolutionRefinementPrompt(project, solutions);
  const response = await callOpenRouter(prompt);
  return parseExistingSolutionsResponse(response);
};

const getExistingSolutions = async (userId, projectId) => {
  const project = await getProjectForUser(userId, projectId);
  return project.existingSolutions || [];
};

const saveExistingSolutions = async (userId, projectId, existingSolutions) => {
  const normalizedSolutions = normalizeExistingSolutions(existingSolutions);
  const project = await Project.findOneAndUpdate(
    { _id: projectId, user: userId },
    { $set: { existingSolutions: normalizedSolutions } },
    { new: true, runValidators: true }
  );

  if (!project) {
    throw new Error("Project not found for this user.");
  }

  return project.existingSolutions;
};

module.exports = {
  generateExistingSolutions,
  refineExistingSolutions,
  getExistingSolutions,
  saveExistingSolutions,
  normalizeExistingSolutions,
};
