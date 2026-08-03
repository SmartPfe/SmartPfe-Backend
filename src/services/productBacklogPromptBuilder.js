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

const buildRules = (project, outputLanguage = "English") => {
  const targetDays = getTargetDurationDays(project);
  return `
Rules:
- Generate a professional Product Backlog for a final-year project report using exactly this table meaning: Epic, ID, As a, I want (User Story), Sprint, Priority.
- Output human-readable backlog content in ${outputLanguage}.
- Each row must be a concrete functional user story or report-ready application capability.
- IMPORTANT FORMAT REQUIREMENT: epic is the grouped feature area, actors is an array of primary app actors, task is only the "I want" goal, and notes is a short optional explanation in ${outputLanguage}.
  - Write task as a short goal only, for example "Create an account.", "Update my profile.", or the equivalent in ${outputLanguage}.
- Use enough tasks for a real PFE project. Small projects: 14-18 tasks. Medium projects: 18-26 tasks. Complex projects: 26-36 tasks.
- The total durationDays across all tasks must be approximately ${targetDays} days, based on the onboarding duration (${project.technicalContext?.duration || "unknown"} month(s)).
- Distribute durations realistically: analysis/design/documentation tasks are usually 2-8 days; implementation tasks can be 4-15 days; testing/deployment tasks are usually 2-8 days.
- Focus on primary app functionality first. Include project lifecycle/report tasks only when they are genuinely relevant to the PFE planning.
- Use previous context: project description, problem statement, actors, existing solutions, functional requirements, non-functional requirements, technologies, methodology, and target users.
- Use ONLY actors from the PRIMARY APP ACTORS list. Do not use external systems, APIs, devices, companies, or secondary stakeholders as backlog actors.
- Keep task titles short and specific. Do not put the full "En tant que..." sentence in task.
- Notes must use ${outputLanguage} and must not repeat the full user story sentence.
- priority must be exactly one of: "High", "Medium", "Low".
- durationDays must be a positive integer.
- sprint must be a non-empty planning label such as "Sprint 1", "Sprint 2", "Phase 1", or the equivalent in ${outputLanguage}.
- User stories in the same epic may share the same sprint when planned together, or use different sprints when the epic spans multiple iterations.
- Codes must follow grouped epic numbering like "1.1", "1.2", "2.1", "2.2". Rows in the same epic must share the first number.
- Use concise epic names such as User Management, Profile Management, Authentication, Dashboard, AI Analysis, Reporting, Administration, Notifications, or project-specific equivalents in ${outputLanguage}.
- Use sprint names only when useful. If the methodology is not sprint-based, use "Phase 1", "Phase 2", etc.
`.trim();
};

const buildProductBacklogGenerationPrompt = (project) => {
  const ctx = getProjectContext(project);
  return `
You are an academic software project planning assistant helping a student prepare the Product Backlog section of a PFE report.

Your task: Generate a complete, realistic, project-specific Product Backlog table using all available project context.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for epic names, user stories, sprint labels, and notes when appropriate.
Keep priority values exactly "High", "Medium", or "Low".

${jsonContract}

${buildRules(project, ctx.outputLanguage)}

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

const buildProductBacklogRefinementPrompt = (project, productBacklog, instructions = "") => {
  const ctx = getProjectContext(project);
  const studentInstructions = String(instructions || "").trim();
  return `
You are an academic software project planning assistant helping a student refine a Product Backlog for a PFE report.

Your task: Improve the current backlog. Preserve useful student edits, make durations realistic, add missing lifecycle tasks, remove duplicates, and ensure the total duration approximately matches the onboarding duration.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for epic names, user stories, sprint labels, and notes when appropriate.
Keep priority values exactly "High", "Medium", or "Low".

${jsonContract}

${buildRules(project, ctx.outputLanguage)}
- Preserve useful existing tasks and manually chosen priorities.
- Keep the backlog simple and report-oriented.
${studentInstructions ? `\nSTUDENT INSTRUCTIONS (highest priority, while still respecting the rules above):\n${studentInstructions}\n` : ""}

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

const buildProductBacklogTranslationPrompt = (project, productBacklog) => {
  const ctx = getProjectContext(project);
  return `
You are an academic translation assistant.

Your task: Translate the current Product Backlog to ${ctx.outputLanguage}.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for epic names, user stories, sprint labels, and notes when appropriate.
Keep priority values exactly "High", "Medium", or "Low".

${jsonContract}

Rules:
- Translate only the current Product Backlog content.
- Do NOT regenerate, add, remove, merge, or reorder backlog items.
- Preserve each code, priority, and durationDays exactly.
- Preserve the student's manual edits and meaning as much as possible.
- Use ONLY actors from the PRIMARY APP ACTORS list so the translated backlog still matches the project's actor options.
- Translate epic, task, sprint, and notes.
- Return ONLY valid JSON. No markdown. No explanation. No surrounding text.

PRIMARY APP ACTORS:
${formatActors(project.actors || []) || "No primary app actors have been defined yet. Use the existing actor values from the backlog."}

CURRENT PRODUCT BACKLOG:
${JSON.stringify({ productBacklog }, null, 2)}
`.trim();
};

module.exports = {
  buildProductBacklogGenerationPrompt,
  buildProductBacklogRefinementPrompt,
  buildProductBacklogTranslationPrompt,
  getTargetDurationDays,
};
