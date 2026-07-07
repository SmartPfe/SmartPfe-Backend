const { formatContextString, getProjectContext } = require("./openRouterService");

const formatActors = (actors = []) =>
  actors.map((actor, index) => `${index + 1}. ${actor.name}: ${actor.description}`).join("\n");

const formatExistingSolutions = (solutions = []) =>
  solutions
    .map(
      (solution, index) => `
${index + 1}. ${solution.name} (${solution.category})
Strengths: ${(solution.strengths || []).join("; ")}
Weaknesses: ${(solution.weaknesses || []).join("; ")}
Difference: ${solution.differentiation}
`.trim()
    )
    .join("\n\n");

const formatFunctionalRequirements = (requirements = []) =>
  requirements
    .map((requirement, index) => `${index + 1}. ${requirement.code} ${requirement.module} - ${requirement.title}: ${requirement.description}`)
    .join("\n");

const formatNonFunctionalRequirements = (requirements = []) =>
  requirements
    .map(
      (requirement, index) =>
        `${index + 1}. ${requirement.code} [${requirement.priority} / ${requirement.status}] ${requirement.category} - ${requirement.title}: ${requirement.description}`
    )
    .join("\n");

const jsonContract = `
Return ONLY valid JSON. No markdown. No explanation. No surrounding text.
The first character of your response must be "{" and the last character must be "}".

Strict JSON format:
{
  "nonFunctionalRequirements": [
    {
      "code": "NFR-01",
      "category": "Performance",
      "title": "Short requirement title",
      "description": "The system shall meet a clear quality constraint specific to the project.",
      "priority": "Must Have",
      "status": "Draft"
    }
  ]
}
`.trim();

const rules = `
Rules:
- Generate 8 to 12 non-functional requirements unless the project is very small.
- Focus on quality attributes, constraints, and operating criteria, not features.
- Cover relevant categories such as Performance, Security, Reliability, Scalability, Usability, Availability, Maintainability, Compatibility, and Accessibility when applicable.
- Make every requirement specific to the project context and realistic for a PFE project.
- Prefer measurable or verifiable wording when possible, but do not invent unrealistic enterprise guarantees.
- Write each description as a requirement using "The system shall...", "The platform shall...", or equivalent in the output language.
- Do not duplicate functional requirements.
- Do not include generic filler or implementation details.
- priority must be exactly one of: "Must Have", "Should Have", "Could Have", "Won't Have".
- status must be exactly one of: "Draft", "In Review", "Approved".
- Use "Draft" for newly generated requirements.
- Codes must be sequential: NFR-01, NFR-02, NFR-03, and so on.
`.trim();

const buildNonFunctionalRequirementGenerationPrompt = (project) => {
  const ctx = getProjectContext(project);
  return `
You are an academic software analysis assistant helping a student define non-functional requirements for a PFE project.

Your task: Generate a concise, project-specific list of non-functional requirements using all available context.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for categories, titles, and descriptions when appropriate.

${jsonContract}

${rules}

PROJECT CONTEXT:
${formatContextString(ctx)}

KNOWN ACTORS AND STAKEHOLDERS:
${formatActors(project.actors || []) || "No actors have been defined yet."}

EXISTING SOLUTIONS ANALYSIS:
${formatExistingSolutions(project.existingSolutions || []) || "No existing solutions have been defined yet."}

FUNCTIONAL REQUIREMENTS:
${formatFunctionalRequirements(project.functionalRequirements || []) || "No functional requirements have been defined yet."}
`.trim();
};

const buildNonFunctionalRequirementRefinementPrompt = (project, requirements) => {
  const ctx = getProjectContext(project);
  return `
You are an academic software analysis assistant helping a student refine non-functional requirements for a PFE project.

Your task: Improve the current non-functional requirements. Preserve useful user edits, remove duplicates, fill important quality-attribute gaps, and keep the list concise and verifiable.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for categories, titles, and descriptions when appropriate.

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

FUNCTIONAL REQUIREMENTS:
${formatFunctionalRequirements(project.functionalRequirements || []) || "No functional requirements have been defined yet."}

CURRENT NON-FUNCTIONAL REQUIREMENTS:
${formatNonFunctionalRequirements(requirements)}
`.trim();
};

module.exports = {
  buildNonFunctionalRequirementGenerationPrompt,
  buildNonFunctionalRequirementRefinementPrompt,
};
