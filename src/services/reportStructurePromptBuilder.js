const { formatContextString, getProjectContext } = require("./openRouterService");

const formatActors = (actors = []) =>
  actors.map((actor, index) => `${index + 1}. ${actor.name}: ${actor.description}`).join("\n");

const formatExistingSolutions = (solutions = []) =>
  solutions
    .map((solution, index) => `${index + 1}. ${solution.name}: ${solution.solvedProblem}. Difference: ${solution.differentiation}`)
    .join("\n");

const formatRequirements = (requirements = [], label = "REQ") =>
  requirements
    .map((requirement, index) => `${index + 1}. ${requirement.code || `${label}-${index + 1}`} ${requirement.title || requirement.task}: ${requirement.description || requirement.notes || ""}`)
    .join("\n");

const formatBacklog = (items = []) =>
  items
    .map((item, index) => `${index + 1}. ${item.code} [${item.priority}] ${item.epic} - ${item.task} (${item.durationDays} days)`)
    .join("\n");

const formatUml = (umlPreparation = {}) => {
  const classes = (umlPreparation.classes || []).map((item) => item.name).join(", ");
  const useCases = (umlPreparation.useCase?.useCases || []).join(", ");
  return [`Classes: ${classes || "none"}`, `Use cases: ${useCases || "none"}`].join("\n");
};

const formatTree = (sections = [], depth = 0) =>
  sections
    .map((section, index) => {
      const number = `${"  ".repeat(depth)}${index + 1}. ${section.title}`;
      const children = section.children?.length ? `\n${formatTree(section.children, depth + 1)}` : "";
      return `${number}${children}`;
    })
    .join("\n");

const jsonContract = `
Return ONLY valid JSON. No markdown. No explanation. No surrounding text.

Strict JSON format:
{
  "reportStructure": [
    {
      "id": "section-1",
      "title": "Introduction",
      "collapsed": false,
      "children": [
        {
          "id": "section-1-1",
          "title": "Project Context",
          "collapsed": false,
          "children": []
        }
      ]
    }
  ]
}
`.trim();

const rules = `
Rules:
- Generate a professional PFE report table of contents, not a generic AI outline.
- Adapt the chapters to the project domain, technologies, actors, requirements, UML content, and backlog.
- Use common PFE/report engineering conventions: introduction, organizational/project context when relevant, state of the art/existing solutions, methodology and requirements, analysis and design, implementation/realization, testing/validation, project management or planning when useful, conclusion and perspectives.
- Include detailed sections and subsections suitable for a real final report, usually 6 to 8 main chapters.
- Use 2 to 3 hierarchy levels. Avoid a fourth level unless absolutely necessary.
- Do not include numbering in titles. Numbering is computed by the application.
- Do not include front matter such as cover page, acknowledgements, abstract, table of contents, bibliography, glossary, or appendices in the numbered structure unless the project specifically needs a numbered annex chapter.
- Keep titles concise, academic, and coherent with the output language.
- Every node must have a stable unique id, a non-empty title, collapsed false, and children array.
`.trim();

const buildReportStructureGenerationPrompt = (project) => {
  const ctx = getProjectContext(project);
  return `
You are an academic report architect helping a student define the complete Table of Contents for a PFE software engineering report.

Your task: Generate a complete, coherent, project-specific report structure that will become the source of truth for later report generation.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for all section titles when appropriate.

${jsonContract}

${rules}

PROJECT CONTEXT:
${formatContextString(ctx)}

PROBLEM STATEMENT:
${project.description?.problemStatement || "No problem statement available."}

ACTORS:
${formatActors(project.actors || []) || "No actors have been defined yet."}

EXISTING SOLUTIONS:
${formatExistingSolutions(project.existingSolutions || []) || "No existing solutions have been defined yet."}

FUNCTIONAL REQUIREMENTS:
${formatRequirements(project.functionalRequirements || [], "FR") || "No functional requirements have been defined yet."}

NON-FUNCTIONAL REQUIREMENTS:
${formatRequirements(project.nonFunctionalRequirements || [], "NFR") || "No non-functional requirements have been defined yet."}

PRODUCT BACKLOG:
${formatBacklog(project.productBacklog || []) || "No product backlog has been defined yet."}

UML PREPARATION:
${formatUml(project.umlPreparation || {})}
`.trim();
};

const buildReportStructureRefinementPrompt = (project, reportStructure) => {
  const ctx = getProjectContext(project);
  return `
You are an academic report architect helping a student refine the Table of Contents for a PFE software engineering report.

Your task: Improve the current report structure while preserving useful manual edits. Make it coherent, detailed, and aligned with all project artifacts.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for all section titles when appropriate.

${jsonContract}

${rules}
- Preserve useful existing chapter titles and hierarchy.
- Remove duplicates, fix weak generic titles, and add missing sections based on project artifacts.

PROJECT CONTEXT:
${formatContextString(ctx)}

FUNCTIONAL REQUIREMENTS:
${formatRequirements(project.functionalRequirements || [], "FR") || "No functional requirements have been defined yet."}

NON-FUNCTIONAL REQUIREMENTS:
${formatRequirements(project.nonFunctionalRequirements || [], "NFR") || "No non-functional requirements have been defined yet."}

PRODUCT BACKLOG:
${formatBacklog(project.productBacklog || []) || "No product backlog has been defined yet."}

UML PREPARATION:
${formatUml(project.umlPreparation || {})}

CURRENT REPORT STRUCTURE:
${formatTree(reportStructure)}
`.trim();
};

module.exports = {
  buildReportStructureGenerationPrompt,
  buildReportStructureRefinementPrompt,
};
