const { formatContextString, getProjectContext } = require("./openRouterService");

const getPrimaryActors = (actors = []) =>
  actors.filter((actor) => actor?.type !== "external" && String(actor?.name || "").trim());

const formatActors = (actors = []) =>
  getPrimaryActors(actors)
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
        `${index + 1}. ${item.code} [${item.priority}] Epic: ${item.epic}; Sprint: ${item.sprint || "Sprint missing"}; As a: ${(item.actors || []).join(", ") || "Primary actor missing"}; I want: ${item.task}; Notes: ${item.notes || "No extra details"}`
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
      "code": "1.1",
      "epic": "User Management",
      "actors": ["Learner", "Trainer"],
      "task": "Create an account.",
      "priority": "High",
      "durationDays": 1,
      "sprint": "Sprint 1",
      "notes": "Allows new primary users to access the application."
    }
  ]
}
`.trim();

const buildRules = (project) => {
  const targetDays = getTargetDurationDays(project);
  return `
Rules:
- Generate a professional Product Backlog for a final-year project report using exactly this table meaning: Epic, ID, As a, I want (User Story), Sprint, Priority.
- Output must always be in English, even if the project context contains French text.
- Each row must be a concrete functional user story or report-ready application capability.
- IMPORTANT FORMAT REQUIREMENT: epic is the grouped feature area, actors is an array of primary app actors, task is only the "I want" goal, and notes is a short optional English explanation.
  - Write task as an English goal only, for example "Create an account." or "Update my profile."
  - Do not write French backlog content.
- Use enough tasks for a real PFE project. Small projects: 14-18 tasks. Medium projects: 18-26 tasks. Complex projects: 26-36 tasks.
- Ignore any French-language examples above. The final JSON must be English only.
- The total durationDays across all tasks must be approximately ${targetDays} days, based on the onboarding duration (${project.technicalContext?.duration || "unknown"} month(s)).
- Distribute durations realistically: analysis/design/documentation tasks are usually 2-8 days; implementation tasks can be 4-15 days; testing/deployment tasks are usually 2-8 days.
- Focus on primary app functionality first. Include project lifecycle/report tasks only when they are genuinely relevant to the PFE planning.
- Use previous context: project description, problem statement, actors, existing solutions, functional requirements, non-functional requirements, technologies, methodology, and target users.
- Use ONLY actors from the PRIMARY APP ACTORS list. Do not use external systems, APIs, devices, companies, or secondary stakeholders as backlog actors.
- Keep task titles short and specific. Do not put the full "En tant que..." sentence in task.
- Notes must be English and must not repeat the full user story sentence.
- priority must be exactly one of: "High", "Medium", "Low".
- durationDays must be a positive integer.
- sprint must be a non-empty English planning label such as "Sprint 1", "Sprint 2", or "Phase 1".
- User stories in the same epic may share the same sprint when planned together, or use different sprints when the epic spans multiple iterations.
- Codes must follow grouped epic numbering like "1.1", "1.2", "2.1", "2.2". Rows in the same epic must share the first number.
- Use concise epic names such as User Management, Profile Management, Authentication, Dashboard, AI Analysis, Reporting, Administration, Notifications, or project-specific equivalents.
- Use sprint names only when useful. If the methodology is not sprint-based, use "Phase 1", "Phase 2", etc.
`.trim();
};

const buildProductBacklogGenerationPrompt = (project) => {
  const ctx = getProjectContext(project);
  return `
You are an academic software project planning assistant helping a student prepare the Product Backlog section of a PFE report.

Your task: Generate a complete, realistic, project-specific Product Backlog table using all available project context.

OUTPUT LANGUAGE: English only.
All epic names, actors, user stories, priorities, notes, and labels must be written in English.

${jsonContract}

${buildRules(project)}

PROJECT CONTEXT:
${formatContextString(ctx)}

PRIMARY APP ACTORS:
${formatActors(project.actors || []) || "No primary app actors have been defined yet. Use the main end user as the primary actor."}

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

OUTPUT LANGUAGE: English only.
All epic names, actors, user stories, priorities, notes, and labels must be written in English.

${jsonContract}

${buildRules(project)}
- Preserve useful existing tasks and manually chosen priorities.
- Keep the backlog simple and report-oriented.

PROJECT CONTEXT:
${formatContextString(ctx)}

PRIMARY APP ACTORS:
${formatActors(project.actors || []) || "No primary app actors have been defined yet. Use the main end user as the primary actor."}

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
