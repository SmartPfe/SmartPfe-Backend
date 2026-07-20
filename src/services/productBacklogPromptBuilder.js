const { formatContextString, getProjectContext } = require("./openRouterService");

const formatActors = (actors = []) =>
  actors
    .map((actor, index) => `${index + 1}. ${actor.name}: ${actor.description}`)
    .join("\n");

const formatExistingSolutions = (solutions = []) =>
  solutions
    .map(
      (solution, index) => `
${index + 1}. ${solution.name} (${solution.category})
Problem solved: ${solution.solvedProblem}
Weaknesses: ${(solution.weaknesses || []).join("; ")}
Difference: ${solution.differentiation}
`.trim()
    )
    .join("\n\n");

const formatFunctionalRequirements = (requirements = []) =>
  requirements
    .map(
      (requirement, index) =>
        `${index + 1}. ${requirement.code} [${requirement.priority}] ${requirement.module} - ${requirement.title}: ${requirement.description}`
    )
    .join("\n");

const formatNonFunctionalRequirements = (requirements = []) =>
  requirements
    .map(
      (requirement, index) =>
        `${index + 1}. ${requirement.code} [${requirement.priority}] ${requirement.category} - ${requirement.title}: ${requirement.description}`
    )
    .join("\n");

const formatBacklog = (items = []) =>
  items
    .map(
      (item, index) =>
        `${index + 1}. ${item.code} [${item.priority}] ${item.epic} - ${item.task} (${item.durationDays} day(s), ${item.sprint || "No sprint"})${item.notes ? ` Notes: ${item.notes}` : ""}`
    )
    .join("\n");

const getTargetDurationDays = (project) => {
  const months = Number(project.technicalContext?.duration) || 0;
  return months > 0 ? months * 22 : 90;
};

const jsonContract = `
Return ONLY valid JSON. No markdown. No explanation. No surrounding text.

Strict JSON format:
{
  "productBacklog": [
    {
      "code": "PB-01",
      "epic": "Analysis",
      "task": "As a project manager, I want to define the project scope so that the team has a clear roadmap.",
      "priority": "High",
      "durationDays": 5,
      "sprint": "Sprint 1",
      "notes": "Optional short academic planning note"
    }
  ]
}
`.trim();

const buildRules = (project) => {
  const targetDays = getTargetDurationDays(project);
  return `
Rules:
- Generate a professional Product Backlog for a final-year project report, not a todo app.
- Each row must be a concrete project task, implementation task, analysis task, design task, testing task, documentation task, or deployment task.
- IMPORTANT FORMAT REQUIREMENT: Each task MUST be written in User Story format.
  - If output language is English: "As a <actor>, I want to <goal>, so that <benefit>." (the "so that" part is optional if it doesn't add value).
  - If output language is French: "En tant que <acteur>, je veux <objectif> afin de <bénéfice>."
- Use enough tasks for a real PFE project. Small projects: 14-18 tasks. Medium projects: 18-26 tasks. Complex projects: 26-36 tasks.
- The total durationDays across all tasks must be approximately ${targetDays} days, based on the onboarding duration (${project.technicalContext?.duration || "unknown"} month(s)).
- Distribute durations realistically: analysis/design/documentation tasks are usually 2-8 days; implementation tasks can be 4-15 days; testing/deployment tasks are usually 2-8 days.
- Cover the full PFE lifecycle: analysis, requirements, design, implementation, testing, report writing, presentation preparation, and deployment when relevant.
- Use previous context: project description, problem statement, actors, existing solutions, functional requirements, non-functional requirements, technologies, methodology, and target users.
- Keep task names clear, formatted as user stories, and specific to the project.
- priority must be exactly one of: "High", "Medium", "Low".
- durationDays must be a positive integer.
- Codes must be sequential: PB-01, PB-02, PB-03, and so on.
- Use concise epic names such as Analysis, Design, Backend, Frontend, AI, Testing, Documentation, Deployment, Defense Preparation, or project-specific equivalents.
- Use sprint names only when useful. If the methodology is not sprint-based, use "Phase 1", "Phase 2", etc.
`.trim();
};

const buildProductBacklogGenerationPrompt = (project) => {
  const ctx = getProjectContext(project);
  return `
You are an academic software project planning assistant helping a student prepare the Product Backlog section of a PFE report.

Your task: Generate a complete, realistic, project-specific Product Backlog table using all available project context.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for epic names, tasks, sprint/phase names, and notes when appropriate.

${jsonContract}

${buildRules(project)}

PROJECT CONTEXT:
${formatContextString(ctx)}

KNOWN ACTORS AND STAKEHOLDERS:
${formatActors(project.actors || []) || "No actors have been defined yet."}

EXISTING SOLUTIONS ANALYSIS:
${formatExistingSolutions(project.existingSolutions || []) || "No existing solutions have been defined yet."}

FUNCTIONAL REQUIREMENTS:
${formatFunctionalRequirements(project.functionalRequirements || []) || "No functional requirements have been defined yet."}

NON-FUNCTIONAL REQUIREMENTS:
${formatNonFunctionalRequirements(project.nonFunctionalRequirements || []) || "No non-functional requirements have been defined yet."}
`.trim();
};

const buildProductBacklogRefinementPrompt = (project, productBacklog) => {
  const ctx = getProjectContext(project);
  return `
You are an academic software project planning assistant helping a student refine a Product Backlog for a PFE report.

Your task: Improve the current backlog. Preserve useful student edits, make durations realistic, add missing lifecycle tasks, remove duplicates, and ensure the total duration approximately matches the onboarding duration.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for epic names, tasks, sprint/phase names, and notes when appropriate.

${jsonContract}

${buildRules(project)}
- Preserve useful existing tasks and manually chosen priorities.
- Keep the backlog simple and report-oriented.

PROJECT CONTEXT:
${formatContextString(ctx)}

KNOWN ACTORS AND STAKEHOLDERS:
${formatActors(project.actors || []) || "No actors have been defined yet."}

EXISTING SOLUTIONS ANALYSIS:
${formatExistingSolutions(project.existingSolutions || []) || "No existing solutions have been defined yet."}

FUNCTIONAL REQUIREMENTS:
${formatFunctionalRequirements(project.functionalRequirements || []) || "No functional requirements have been defined yet."}

NON-FUNCTIONAL REQUIREMENTS:
${formatNonFunctionalRequirements(project.nonFunctionalRequirements || []) || "No non-functional requirements have been defined yet."}

CURRENT PRODUCT BACKLOG:
${formatBacklog(productBacklog)}
`.trim();
};

module.exports = {
  buildProductBacklogGenerationPrompt,
  buildProductBacklogRefinementPrompt,
  getTargetDurationDays,
};
