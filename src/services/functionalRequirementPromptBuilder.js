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

const formatRequirements = (requirements = []) =>
  requirements
    .map(
      (requirement, index) =>
        `${index + 1}. ${requirement.code} [${requirement.priority} / ${requirement.status}] ${requirement.module} - ${requirement.title}: ${requirement.description}`
    )
    .join("\n");

const jsonContract = `
Return ONLY valid JSON. No markdown. No explanation. No surrounding text.

Strict JSON format:
{
  "functionalRequirements": [
    {
      "code": "FR-01",
      "module": "Module name",
      "title": "Short requirement title",
      "description": "The system shall allow a specific actor to perform a clear capability.",
      "priority": "Must Have",
      "status": "Draft"
    }
  ]
}
`.trim();

const rules = `
Rules:
- Generate 8 to 14 functional requirements unless the project is very small.
- Requirements must be specific to the student's project context.
- Write each description as a functional requirement, not an implementation detail.
- Use wording such as "The system shall...", "The platform shall...", "Users shall be able to...", or equivalent in the output language.
- Cover the main actors and core project objectives.
- Use existing solutions to identify expected features and gaps the student's project should address.
- Avoid vague, generic, duplicated, or overlapping requirements.
- Do not include non-functional requirements such as performance, scalability, security levels, availability, or UI aesthetics unless they describe a concrete user-facing capability.
- priority must be exactly one of: "Must Have", "Should Have", "Could Have", "Won't Have".
- status must be exactly one of: "Draft", "In Review", "Approved".
- Use "Draft" for newly generated requirements.
- Codes must be sequential: FR-01, FR-02, FR-03, and so on.
`.trim();

const buildFunctionalRequirementGenerationPrompt = (project) => {
  const ctx = getProjectContext(project);
  return `
You are an academic software analysis assistant helping a student define functional requirements for a PFE project.

Your task: Generate a complete, concise, project-specific list of functional requirements based on all available project context.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for module names, titles, and descriptions when appropriate.

${jsonContract}

${rules}

PROJECT CONTEXT:
${formatContextString(ctx)}

KNOWN ACTORS AND STAKEHOLDERS:
${formatActors(project.actors || []) || "No actors have been defined yet."}

EXISTING SOLUTIONS ANALYSIS:
${formatExistingSolutions(project.existingSolutions || []) || "No existing solutions have been defined yet."}
`.trim();
};

const buildFunctionalRequirementRefinementPrompt = (project, requirements) => {
  const ctx = getProjectContext(project);
  return `
You are an academic software analysis assistant helping a student refine functional requirements for a PFE project.

Your task: Improve the current functional requirements. Preserve useful user edits, remove duplicates, fill important gaps, and keep the list concise and actionable.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for module names, titles, and descriptions when appropriate.

${jsonContract}

${rules}
- Preserve useful user-provided requirements and priorities.
- Keep manually approved requirements unless they are clearly duplicate or irrelevant.

PROJECT CONTEXT:
${formatContextString(ctx)}

KNOWN ACTORS AND STAKEHOLDERS:
${formatActors(project.actors || []) || "No actors have been defined yet."}

EXISTING SOLUTIONS ANALYSIS:
${formatExistingSolutions(project.existingSolutions || []) || "No existing solutions have been defined yet."}

CURRENT FUNCTIONAL REQUIREMENTS:
${formatRequirements(requirements)}
`.trim();
};

module.exports = {
  buildFunctionalRequirementGenerationPrompt,
  buildFunctionalRequirementRefinementPrompt,
};
