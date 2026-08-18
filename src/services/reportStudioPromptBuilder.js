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
  items.map((item, index) => `${index + 1}. ${item.code} [${item.priority}] ${item.task}: ${item.notes || ""}`).join("\n");

const formatUml = (umlPreparation = {}) => {
  const classes = (umlPreparation.classes || []).map((item) => `${item.name}: ${item.description}`).join("\n");
  const useCases = (umlPreparation.useCase?.useCases || []).join(", ");
  return [`Classes:\n${classes || "None"}`, `Use cases: ${useCases || "None"}`].join("\n");
};

const formatReportOverview = (structure = [], chapters = []) => {
  const chapterMap = new Map(chapters.map((c) => [c.sectionId, c]));
  const lines = [];

  const traverse = (sections, prefix = "") => {
    sections.forEach((sec, idx) => {
      const num = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
      const ch = chapterMap.get(sec.id);
      const status = ch?.contentMarkdown ? "[Draft Written]" : "[Not Started]";
      lines.push(`${num} ${sec.title} ${status}`);
      if (Array.isArray(sec.children) && sec.children.length > 0) {
        traverse(sec.children, num);
      }
    });
  };

  traverse(structure);
  return lines.length > 0 ? lines.join("\n") : "No structure available.";
};

const formatPrecedingSectionSnippet = (chapters = [], currentSectionId = "") => {
  const currentIndex = chapters.findIndex((c) => c.sectionId === currentSectionId);
  if (currentIndex <= 0) {
    // If not found or is first, check if there is any written chapter prior
    const writtenChapters = chapters.filter((c) => c.contentMarkdown && c.sectionId !== currentSectionId);
    if (writtenChapters.length === 0) return "";
    const prev = writtenChapters[writtenChapters.length - 1];
    const preview = String(prev.contentMarkdown).slice(-450).trim();
    return `Preceding Chapter (${prev.title}) Closing Excerpt:\n"...${preview}"`;
  }

  const prev = chapters[currentIndex - 1];
  if (!prev?.contentMarkdown) return "";
  const preview = String(prev.contentMarkdown).slice(-450).trim();
  return `Preceding Chapter (${prev.title}) Closing Excerpt:\n"...${preview}"`;
};

const formatRetrievedSectionReferences = (ragContext = "") => {
  const context = String(ragContext || "").trim();
  if (!context) return "";

  return `
ACADEMIC REFERENCE LITERATURE & PFE THESIS EXCERPTS:
Use the retrieved technical PFE excerpts below for academic terminology, depth, and formal explanation:
- Ground all facts strictly in the student's project context, UML classes, and requirements.
- Use the reference literature to inspire rigorous academic tone, structural depth, and technical clarity.
- Do NOT mention RAG, vector search, MongoDB, or external author names.

${context}
`.trim();
};

const jsonContract = `
Return ONLY valid JSON. No markdown fences. No explanation.

Strict JSON format:
{
  "chapter": {
    "contentHtml": "<h2>Section title</h2><p>Academic paragraph...</p>",
    "contentMarkdown": "## Section title\\n\\nAcademic paragraph...",
    "contentLatex": "\\\\section{Section title}\\n\\nAcademic paragraph...",
    "generatedFrom": ["Project Context", "Functional Requirements", "Reference Literature"]
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

const buildContextBlock = (project, chapters = [], currentSectionId = "", ragContext = "") => {
  const ctx = getProjectContext(project);
  const precedingSnippet = formatPrecedingSectionSnippet(chapters, currentSectionId);
  const referenceLiterature = formatRetrievedSectionReferences(ragContext);

  return [
    referenceLiterature ? `${referenceLiterature}\n` : null,
    "PROJECT CONTEXT:",
    formatContextString(ctx),
    "\nREPORT OUTLINE STATUS:",
    formatReportOverview(project.reportStructure || [], chapters),
    precedingSnippet ? `\nPREVIOUS TRANSITION CONTEXT:\n${precedingSnippet}` : null,
    "\nPROBLEM STATEMENT:",
    project.description?.problemStatement || "No problem statement available.",
    "\nACTORS:",
    formatActors(project.actors || []) || "No actors available.",
    "\nEXISTING SOLUTIONS:",
    formatExistingSolutions(project.existingSolutions || []) || "No existing solutions available.",
    "\nFUNCTIONAL REQUIREMENTS:",
    formatRequirements(project.functionalRequirements || []) || "No functional requirements available.",
    "\nNON-FUNCTIONAL REQUIREMENTS:",
    formatRequirements(project.nonFunctionalRequirements || []) || "No non-functional requirements available.",
    "\nPRODUCT BACKLOG:",
    formatBacklog(project.productBacklog || []) || "No product backlog available.",
    "\nUML PREPARATION:",
    formatUml(project.umlPreparation || {}),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
};

const buildChapterGenerationPrompt = (project, section, detailLevel, chapters, ragContext = "") => {
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

${buildContextBlock(project, chapters, section.id, ragContext)}
`.trim();
};

const buildChapterActionPrompt = (project, section, action, selectedText, currentContent, chapters, instructions = "", ragContext = "") => {
  const ctx = getProjectContext(project);
  const studentInstructions = String(instructions || "").trim();
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
${studentInstructions ? `\nSTUDENT INSTRUCTIONS (highest priority, while still respecting the action and rules above):\n${studentInstructions}\n` : ""}

${jsonContract}

${writingRules}

SELECTED TEXT:
${selectedText || "No selected text. Operate on the entire chapter."}

CURRENT CHAPTER HTML:
${currentContent || "No current content."}

${buildContextBlock(project, chapters, section.id, ragContext)}
`.trim();
};

const buildChapterTranslationPrompt = (project, section, currentContent, chapters) => {
  const ctx = getProjectContext(project);
  return `
You are Smart PFE's AI Report Studio translation assistant.

Your task: Translate only the current report section content to ${ctx.outputLanguage}.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Write entirely in ${ctx.outputLanguage} unless a technical term must remain in English.

Current section:
- Title: ${section.title}
- Section id: ${section.id}

${jsonContract}

Translation rules:
- Translate only the current chapter content.
- Do NOT regenerate the section from project context.
- Do NOT add new claims, examples, metrics, figures, or report parts.
- Preserve the student's manual edits and meaning as much as possible.
- Preserve the existing HTML structure where it is useful.
- Preserve code snippets, URLs, API names, class names, table/figure placeholders, and technical identifiers.
- Return ONLY valid JSON. No markdown fences. No explanation.

CURRENT CHAPTER HTML:
${currentContent || "No current content."}

PROJECT CONTEXT FOR TERMINOLOGY ONLY:
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
  buildChapterTranslationPrompt,
  buildCompleteReportPrompt,
};
