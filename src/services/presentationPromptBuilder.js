const { formatContextString, getProjectContext } = require("./openRouterService");

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

const formatUserStories = (project) => {
  if (Array.isArray(project.userStories) && project.userStories.length) {
    return project.userStories
      .map((story, index) => `${index + 1}. ${story.title || story.role || "User story"}: ${story.description || story.story || story.value || ""}`)
      .join("\n");
  }

  return (project.productBacklog || [])
    .map((item, index) => `${index + 1}. As a user, I need ${item.task} (${item.epic}) so the project delivers this backlog value.`)
    .join("\n");
};

const formatUml = (umlPreparation = {}) => {
  const classes = (umlPreparation.classes || []).map((item) => `${item.name}: ${item.description}`).join("\n");
  const relationships = (umlPreparation.relationships || []).map((item) => `${item.source} -> ${item.target} (${item.type}) ${item.label || ""}`).join("\n");
  const useCases = (umlPreparation.useCase?.useCases || []).join(", ");
  return [
    `Classes:\n${classes || "None"}`,
    `Relationships:\n${relationships || "None"}`,
    `Use cases: ${useCases || "None"}`,
  ].join("\n");
};

const formatReportChapters = (chapters = []) =>
  chapters
    .filter((chapter) => chapter.contentMarkdown || chapter.contentHtml)
    .map((chapter, index) => `${index + 1}. ${chapter.title}\n${String(chapter.contentMarkdown || stripHtml(chapter.contentHtml)).slice(0, 1500)}`)
    .join("\n\n");

const formatCurrentPresentation = (presentation = {}) =>
  (presentation.slides || [])
    .map((slide, index) => [
      `Slide ${index + 1}: ${slide.title}`,
      `Bullets:\n${(slide.bullets || []).map((bullet) => `- ${bullet}`).join("\n")}`,
      `Speaker notes:\n${slide.notes || ""}`,
    ].join("\n"))
    .join("\n\n");

const jsonContract = `
Return ONLY valid JSON. No markdown fences. No explanation.

Strict JSON format:
{
  "presentation": {
    "durationMinutes": 10,
    "slides": [
      {
        "title": "Slide title",
        "bullets": ["Short academic bullet", "Another bullet"],
        "notes": "Speaker notes that guide what the student should say without reading the slide."
      }
    ]
  }
}
`.trim();

const rules = `
Rules:
- Create an academic PFE defense presentation, not a report outline.
- Adapt slide count and density to the selected duration.
- For 5 minutes: 5 to 7 concise slides with only essential content.
- For 10 minutes: 8 to 11 slides with balanced problem, solution, method, and result coverage.
- For 15 minutes: 12 to 15 slides with more implementation and validation detail.
- For 20 minutes: 16 to 20 slides with detailed methodology, requirements, UML/design, implementation, results, limits, and perspectives.
- Each slide must contain 3 to 5 short bullet points.
- Speaker notes must guide what to say, add transitions, and explain the reasoning behind the slide. They must not simply repeat the bullets.
- Keep the presentation coherent from title slide to conclusion and make the next slide feel natural.
- Use only information supported by the available Smart PFE context. Do not invent metrics, jury names, screenshots, experiments, or company facts.
- Preserve useful student edits during refinement while improving academic flow, pacing, and slide clarity.
`.trim();

const buildContextBlock = (project) => {
  const ctx = getProjectContext(project);
  return `
PROJECT OVERVIEW:
${formatContextString(ctx)}

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

USER STORIES:
${formatUserStories(project) || "No user stories available."}

UML PREPARATION:
${formatUml(project.umlPreparation || {})}

REPORT STRUCTURE:
${flattenStructure(project.reportStructure || []).join("\n") || "No report structure available."}

GENERATED REPORT CHAPTERS:
${formatReportChapters(project.reportChapters || []) || "No generated report chapters available."}

GENERATED REPORT:
${project.finalReport?.contentMarkdown || stripHtml(project.finalReport?.contentHtml || "") || "No final generated report available."}
`.trim();
};

const buildPresentationGenerationPrompt = (project, durationMinutes) => {
  const ctx = getProjectContext(project);
  return `
You are Smart PFE's AI Presentation Studio, helping a student prepare an academic PFE defense presentation.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Write entirely in ${ctx.outputLanguage} unless technical terms must remain in English.

Selected defense duration: ${durationMinutes} minutes.

${jsonContract}

${rules}

${buildContextBlock(project)}
`.trim();
};

const buildPresentationRefinementPrompt = (project, presentation) => {
  const ctx = getProjectContext(project);
  return `
You are Smart PFE's AI Presentation Studio.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Write entirely in ${ctx.outputLanguage} unless technical terms must remain in English.

Refine the current editable defense presentation for a ${presentation.durationMinutes}-minute PFE defense.

${jsonContract}

${rules}

CURRENT PRESENTATION:
${formatCurrentPresentation(presentation)}

${buildContextBlock(project)}
`.trim();
};

module.exports = {
  buildPresentationGenerationPrompt,
  buildPresentationRefinementPrompt,
};
