const { formatContextString, getProjectContext } = require("./openRouterService");

const flattenStructure = (sections = [], prefix = "") =>
  sections.flatMap((section, index) => {
    const number = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
    return [
      `${number} ${section.title}`,
      ...flattenStructure(section.children || [], number),
    ];
  });

const formatActors = (actors = []) =>
  actors.map((actor, index) => `${index + 1}. ${actor.name}: ${actor.description}`).join("\n");

const formatExistingSolutions = (solutions = []) =>
  solutions
    .map((solution, index) => `${index + 1}. ${solution.name}: ${solution.solvedProblem}. Weaknesses: ${(solution.weaknesses || []).join("; ")}. Difference: ${solution.differentiation}`)
    .join("\n");

const formatRequirements = (requirements = []) =>
  requirements
    .map((requirement, index) => `${index + 1}. ${requirement.code} [${requirement.priority}] ${requirement.title}: ${requirement.description}`)
    .join("\n");

const formatBacklog = (items = []) =>
  items.map((item, index) => `${index + 1}. ${item.code} ${item.epic} - ${item.task} (${item.durationDays} days, ${item.priority})`).join("\n");

const formatUml = (umlPreparation = {}) => {
  const classes = (umlPreparation.classes || []).map((item) => `${item.name}: ${item.description}`).join("\n");
  const useCases = (umlPreparation.useCase?.useCases || []).join(", ");
  return [`Classes:\n${classes || "None"}`, `Use cases: ${useCases || "None"}`].join("\n");
};

const formatChapters = (chapters = [], currentSectionId = "") =>
  chapters
    .filter((chapter) => chapter.sectionId !== currentSectionId && chapter.contentMarkdown)
    .map((chapter, index) => `${index + 1}. ${chapter.title}\n${String(chapter.contentMarkdown).slice(0, 1200)}`)
    .join("\n\n");

const jsonContract = `
Return ONLY valid JSON. No markdown fences. No explanation.

Strict JSON format:
{
  "chapter": {
    "contentHtml": "<h2>Section title</h2><p>Academic paragraph...</p>",
    "contentMarkdown": "## Section title\\n\\nAcademic paragraph...",
    "contentLatex": "\\\\section{Section title}\\n\\nAcademic paragraph...",
    "generatedFrom": ["Project Context", "Functional Requirements"]
  }
}
`.trim();

const writingRules = `
Writing rules:
- Write like a real university PFE report: formal, concrete, coherent, and project-specific.
- Do not sound like a generic AI outline.
- Avoid invented results, metrics, company facts, names, screenshots, or experiments that are not supported by context.
- Use paragraphs with clear transitions.
- Use bullet lists or tables only when they genuinely improve readability.
- Include figure or table placeholders when useful, using captions such as "Figure X: ...".
- Keep terminology consistent with previous artifacts and previous generated chapters.
- Do not include numbering in headings; the application manages the table of contents.
`.trim();

const buildContextBlock = (project, chapters = [], currentSectionId = "") => {
  const ctx = getProjectContext(project);
  return `
PROJECT CONTEXT:
${formatContextString(ctx)}

REPORT STRUCTURE:
${flattenStructure(project.reportStructure || []).join("\n") || "No report structure available."}

PROBLEM STATEMENT:
${project.description?.problemStatement || "No problem statement available."}

ACTORS:
${formatActors(project.actors || []) || "No actors available."}

EXISTING SOLUTIONS:
${formatExistingSolutions(project.existingSolutions || []) || "No existing solutions available."}

FUNCTIONAL REQUIREMENTS:
${formatRequirements(project.functionalRequirements || []) || "No functional requirements available."}

NON-FUNCTIONAL REQUIREMENTS:
${formatRequirements(project.nonFunctionalRequirements || []) || "No non-functional requirements available."}

PRODUCT BACKLOG:
${formatBacklog(project.productBacklog || []) || "No product backlog available."}

UML PREPARATION:
${formatUml(project.umlPreparation || {})}

PREVIOUSLY GENERATED CHAPTERS:
${formatChapters(chapters, currentSectionId) || "No previous chapters generated yet."}
`.trim();
};

const buildChapterGenerationPrompt = (project, section, detailLevel, chapters) => {
  const ctx = getProjectContext(project);
  const lengthGuidance = detailLevel === "summary"
    ? "Write a concise section of 3 to 5 focused paragraphs."
    : detailLevel === "detailed"
      ? "Write a detailed section with developed paragraphs, useful lists/tables, and careful transitions."
      : "Write a standard section of 5 to 8 academic paragraphs.";

  return `
You are Smart PFE's AI Report Studio, helping a student write one chapter/section of a PFE report.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Write entirely in ${ctx.outputLanguage} unless a technical term must remain in English.

Current section to write:
- Title: ${section.title}
- Section id: ${section.id}
- Detail level: ${detailLevel}
- Length guidance: ${lengthGuidance}

${jsonContract}

${writingRules}

${buildContextBlock(project, chapters, section.id)}
`.trim();
};

const buildChapterActionPrompt = (project, section, action, selectedText, currentContent, chapters) => {
  const ctx = getProjectContext(project);
  return `
You are Smart PFE's AI Report Studio.

OUTPUT LANGUAGE: ${ctx.outputLanguage}

Current section:
- Title: ${section.title}
- Requested action: ${action}
- Scope: ${selectedText ? "selected text" : "entire chapter"}

Apply the requested action intelligently:
- Expand: add useful detail without padding.
- Shorten: reduce length while preserving core meaning.
- Improve Academic Style: make it formal and report-ready.
- Make More Technical: add precise technical analysis supported by context.
- Simplify: make the text clearer without losing academic tone.
- Continue Writing: continue naturally from the existing content.
- Improve Grammar: fix grammar, wording, and flow.
- Rewrite Selection: rewrite only the selected passage.
- Regenerate Selection: replace the selected passage with a stronger version.
- Explain Better: clarify weak or abstract ideas.

${jsonContract}

${writingRules}

SELECTED TEXT:
${selectedText || "No selected text. Operate on the entire chapter."}

CURRENT CHAPTER HTML:
${currentContent || "No current content."}

${buildContextBlock(project, chapters, section.id)}
`.trim();
};

const buildCompleteReportPrompt = (project, chapters) => {
  const ctx = getProjectContext(project);
  return `
You are Smart PFE's AI Report Studio final reviewer.

OUTPUT LANGUAGE: ${ctx.outputLanguage}

Create a polished complete report from the generated chapters. Improve transitions, reduce duplicated ideas, keep terminology consistent, verify figure/table references, and preserve the report structure.

${jsonContract.replace('"chapter"', '"finalReport"')}

${writingRules}

${buildContextBlock(project, chapters)}

CHAPTERS TO REVIEW:
${chapters.map((chapter, index) => `${index + 1}. ${chapter.title}\n${chapter.contentMarkdown}`).join("\n\n")}
`.trim();
};

module.exports = {
  buildChapterGenerationPrompt,
  buildChapterActionPrompt,
  buildCompleteReportPrompt,
};
