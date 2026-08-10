const Project = require("../models/Project");
const { callOpenRouter } = require("./openRouterService");
const {
  buildReportStructureGenerationPrompt,
  buildReportStructureRefinementPrompt,
  buildReportStructureTranslationPrompt,
} = require("./reportStructurePromptBuilder");
const { getReportStructureRagContext } = require("./reportStructureRagService");

const MAX_DEPTH = 3;

const createId = (path) => `section-${path.join("-")}`;

const normalizeSections = (sections, depth = 1, path = []) => {
  if (!Array.isArray(sections) || depth > MAX_DEPTH) return [];

  return sections
    .map((section, index) => {
      const currentPath = [...path, index + 1];
      const title = String(section?.title || section?.name || "").trim();
      return {
        id: String(section?.id || createId(currentPath)).trim(),
        title,
        collapsed: Boolean(section?.collapsed),
        children: normalizeSections(section?.children || section?.sections || [], depth + 1, currentPath),
      };
    })
    .filter((section) => section.title)
    .map((section, index) => ({
      ...section,
      id: section.id || createId([...path, index + 1]),
    }));
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

const parseReportStructureResponse = (content) => {
  let parsed;
  try {
    parsed = JSON.parse(extractJsonPayload(content));
  } catch (error) {
    console.error("[report-structure] Invalid AI JSON response:", String(content || "").slice(0, 1000));
    throw new Error("AI returned invalid report structure JSON. Please try again.");
  }

  const reportStructure = normalizeSections(Array.isArray(parsed) ? parsed : parsed.reportStructure);
  if (reportStructure.length === 0) {
    throw new Error("AI did not return a valid report structure. Please try again.");
  }
  return reportStructure;
};

const getProjectForUser = async (userId, projectId = null) => {
  const query = projectId ? { _id: projectId, user: userId } : { user: userId };
  const project = await Project.findOne(query);
  if (!project) throw new Error("Project not found for this user.");
  return project;
};

const generateReportStructure = async (project) => {
  const ragContext = await getReportStructureRagContext(project, "generate");
  const prompt = buildReportStructureGenerationPrompt(project, ragContext);
  console.info(
    `[report-structure][generate] RAG context injected: ${ragContext ? "yes" : "no"} contextChars=${ragContext.length} promptChars=${prompt.length}`
  );
  const response = await callOpenRouter(prompt);
  return parseReportStructureResponse(response);
};

const refineReportStructure = async (project, currentStructure, instructions = "") => {
  const reportStructure = normalizeSections(currentStructure);
  if (reportStructure.length === 0) throw new Error("Current report structure is required to refine.");
  const ragContext = await getReportStructureRagContext(project, "refine");
  const prompt = buildReportStructureRefinementPrompt(project, reportStructure, instructions, ragContext);
  console.info(
    `[report-structure][refine] RAG context injected: ${ragContext ? "yes" : "no"} contextChars=${ragContext.length} promptChars=${prompt.length}`
  );
  const response = await callOpenRouter(prompt);
  return parseReportStructureResponse(response);
};

const translateReportStructure = async (project, currentStructure) => {
  const reportStructure = normalizeSections(currentStructure);
  if (reportStructure.length === 0) throw new Error("Current report structure is required to translate.");
  const prompt = buildReportStructureTranslationPrompt(project, reportStructure);
  const response = await callOpenRouter(prompt);
  return parseReportStructureResponse(response);
};

const getReportStructure = async (userId, projectId) => {
  const project = await getProjectForUser(userId, projectId);
  return normalizeSections(project.reportStructure || []);
};

const saveReportStructure = async (userId, projectId, reportStructure, language) => {
  const normalized = normalizeSections(reportStructure);
  const updates = { reportStructure: normalized };
  if (language !== undefined) {
    updates.reportStructureLanguage = language;
  }

  const project = await Project.findOneAndUpdate(
    { _id: projectId, user: userId },
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!project) throw new Error("Project not found for this user.");
  return {
    reportStructure: normalizeSections(project.reportStructure || []),
    language: project.reportStructureLanguage,
  };
};

module.exports = {
  generateReportStructure,
  refineReportStructure,
  translateReportStructure,
  getReportStructure,
  saveReportStructure,
  normalizeSections,
};
