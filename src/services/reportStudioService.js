const crypto = require("crypto");
const Project = require("../models/Project");
const { callOpenRouter } = require("./openRouterService");
const {
  buildChapterGenerationPrompt,
  buildChapterActionPrompt,
  buildCompleteReportPrompt,
} = require("./reportStudioPromptBuilder");

const VALID_STATUSES = new Set(["not-started", "in-progress", "completed"]);
const VALID_DETAIL_LEVELS = new Set(["summary", "standard", "detailed"]);

const stripHtml = (html = "") =>
  String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

const markdownToHtml = (markdown = "") => {
  const lines = String(markdown).split(/\r?\n/);
  return lines
    .map((line) => {
      if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
      if (/^\s*[-*]\s+/.test(line)) return `<ul><li>${line.replace(/^\s*[-*]\s+/, "")}</li></ul>`;
      if (!line.trim()) return "";
      return `<p>${line}</p>`;
    })
    .join("\n")
    .replace(/<\/ul>\n<ul>/g, "");
};

const htmlToMarkdown = (html = "") =>
  String(html)
    .replace(/<h1[^>]*>(.*?)<\/h1>/gis, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gis, "## $1\n\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gis, "### $1\n\n")
    .replace(/<li[^>]*>(.*?)<\/li>/gis, "- $1\n")
    .replace(/<\/(ul|ol)>/gis, "\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gis, "$1\n\n")
    .replace(/<strong[^>]*>(.*?)<\/strong>/gis, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gis, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gis, "_$1_")
    .replace(/<i[^>]*>(.*?)<\/i>/gis, "_$1_")
    .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, "```\n$1\n```\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const escapeLatex = (value = "") =>
  String(value)
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([#$%&_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");

const markdownToLatex = (markdown = "") =>
  String(markdown)
    .split(/\r?\n/)
    .map((line) => {
      if (line.startsWith("### ")) return `\\subsubsection{${escapeLatex(line.slice(4))}}`;
      if (line.startsWith("## ")) return `\\subsection{${escapeLatex(line.slice(3))}}`;
      if (line.startsWith("# ")) return `\\section{${escapeLatex(line.slice(2))}}`;
      if (/^\s*[-*]\s+/.test(line)) return `\\item ${escapeLatex(line.replace(/^\s*[-*]\s+/, ""))}`;
      return escapeLatex(line);
    })
    .join("\n");

const normalizeGeneratedFrom = (items) =>
  Array.isArray(items) ? items.map((item) => String(item || "").trim()).filter(Boolean) : [];

const normalizeChapter = (chapter = {}) => {
  const contentHtml = String(chapter.contentHtml || "").trim();
  const contentMarkdown = String(chapter.contentMarkdown || htmlToMarkdown(contentHtml)).trim();
  const normalizedHtml = contentHtml || markdownToHtml(contentMarkdown);
  return {
    sectionId: String(chapter.sectionId || "").trim(),
    title: String(chapter.title || "Untitled chapter").trim(),
    contentHtml: normalizedHtml,
    contentMarkdown,
    contentLatex: String(chapter.contentLatex || markdownToLatex(contentMarkdown)).trim(),
    status: VALID_STATUSES.has(chapter.status) ? chapter.status : (stripHtml(normalizedHtml) ? "in-progress" : "not-started"),
    generatedFrom: normalizeGeneratedFrom(chapter.generatedFrom),
    sourceFingerprint: String(chapter.sourceFingerprint || "").trim(),
    lastModified: chapter.lastModified || new Date(),
  };
};

const normalizeChapters = (chapters = []) => Array.isArray(chapters) ? chapters.map(normalizeChapter).filter((chapter) => chapter.sectionId && chapter.title) : [];

const getSourceSnapshot = (project) => ({
  basics: project.basics,
  description: project.description,
  technicalContext: project.technicalContext,
  actors: project.actors,
  existingSolutions: project.existingSolutions,
  functionalRequirements: project.functionalRequirements,
  nonFunctionalRequirements: project.nonFunctionalRequirements,
  productBacklog: project.productBacklog,
  umlPreparation: project.umlPreparation,
  reportStructure: project.reportStructure,
});

const getSourceFingerprint = (project) =>
  crypto.createHash("sha256").update(JSON.stringify(getSourceSnapshot(project))).digest("hex");

const findSection = (sections = [], sectionId) => {
  for (const section of sections) {
    if (section.id === sectionId) return section;
    const child = findSection(section.children || [], sectionId);
    if (child) return child;
  }
  return null;
};

const parseAiPayload = (content, key) => {
  const text = String(content || "").trim();
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : text;
  const objectStart = candidate.indexOf("{");
  const objectEnd = candidate.lastIndexOf("}");
  const json = objectStart !== -1 && objectEnd > objectStart ? candidate.slice(objectStart, objectEnd + 1) : candidate;

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    console.error("[report-studio] Invalid AI JSON response:", text.slice(0, 1000));
    throw new Error("AI returned invalid report content JSON. Please try again.");
  }

  const payload = parsed[key] || parsed.chapter || parsed.finalReport || parsed;
  if (!payload?.contentHtml && !payload?.contentMarkdown) {
    throw new Error("AI did not return valid report content. Please try again.");
  }
  return payload;
};

const getProjectForUser = async (userId, projectId = null) => {
  const query = projectId ? { _id: projectId, user: userId } : { user: userId };
  const project = await Project.findOne(query);
  if (!project) throw new Error("Project not found for this user.");
  return project;
};

const getReportChapters = async (userId, projectId) => {
  const project = await getProjectForUser(userId, projectId);
  return {
    reportChapters: normalizeChapters(project.reportChapters || []),
    sourceFingerprint: getSourceFingerprint(project),
    finalReport: project.finalReport || {},
  };
};

const saveReportChapters = async (userId, projectId, reportChapters) => {
  const project = await getProjectForUser(userId, projectId);
  const fingerprint = getSourceFingerprint(project);
  const normalized = normalizeChapters(reportChapters).map((chapter) => ({
    ...chapter,
    sourceFingerprint: chapter.sourceFingerprint || fingerprint,
    lastModified: new Date(),
  }));

  project.reportChapters = normalized;
  await project.save();
  return {
    reportChapters: normalizeChapters(project.reportChapters || []),
    sourceFingerprint: fingerprint,
    finalReport: project.finalReport || {},
  };
};

const generateChapter = async (project, sectionId, detailLevel = "standard", currentChapters = []) => {
  const section = findSection(project.reportStructure || [], sectionId);
  if (!section) throw new Error("Report structure section not found.");
  const level = VALID_DETAIL_LEVELS.has(detailLevel) ? detailLevel : "standard";
  const prompt = buildChapterGenerationPrompt(project, section, level, currentChapters);
  const response = await callOpenRouter(prompt);
  const payload = parseAiPayload(response, "chapter");
  return normalizeChapter({
    ...payload,
    sectionId,
    title: section.title,
    status: "in-progress",
    sourceFingerprint: getSourceFingerprint(project),
  });
};

const applyChapterAction = async (project, sectionId, action, currentContent, selectedText, currentChapters = []) => {
  const section = findSection(project.reportStructure || [], sectionId);
  if (!section) throw new Error("Report structure section not found.");
  if (!currentContent || !stripHtml(currentContent)) throw new Error("Current chapter content is required.");
  const prompt = buildChapterActionPrompt(project, section, action, selectedText, currentContent, currentChapters);
  const response = await callOpenRouter(prompt);
  const payload = parseAiPayload(response, "chapter");
  return normalizeChapter({
    ...payload,
    sectionId,
    title: section.title,
    status: "in-progress",
    sourceFingerprint: getSourceFingerprint(project),
  });
};

const generateCompleteReport = async (project, currentChapters = []) => {
  const chapters = normalizeChapters(currentChapters.length ? currentChapters : project.reportChapters || [])
    .filter((chapter) => stripHtml(chapter.contentHtml));
  if (chapters.length === 0) throw new Error("Generated chapters are required before creating the complete report.");
  const prompt = buildCompleteReportPrompt(project, chapters);
  const response = await callOpenRouter(prompt);
  const payload = parseAiPayload(response, "finalReport");
  const contentMarkdown = String(payload.contentMarkdown || htmlToMarkdown(payload.contentHtml)).trim();
  return {
    contentHtml: String(payload.contentHtml || markdownToHtml(contentMarkdown)).trim(),
    contentMarkdown,
    contentLatex: String(payload.contentLatex || markdownToLatex(contentMarkdown)).trim(),
    sourceFingerprint: getSourceFingerprint(project),
    generatedAt: new Date(),
  };
};

const saveFinalReport = async (userId, projectId, finalReport) => {
  const project = await getProjectForUser(userId, projectId);
  project.finalReport = finalReport;
  await project.save();
  return project.finalReport;
};

module.exports = {
  getReportChapters,
  saveReportChapters,
  generateChapter,
  applyChapterAction,
  generateCompleteReport,
  saveFinalReport,
  normalizeChapters,
  getSourceFingerprint,
};
