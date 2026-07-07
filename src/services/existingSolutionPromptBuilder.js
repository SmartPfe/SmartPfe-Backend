const { formatContextString, getProjectContext } = require("./openRouterService");

const formatActors = (actors = []) =>
  actors
    .map((actor, index) => {
      const type = actor.type ? ` (${actor.type})` : "";
      return `${index + 1}. ${actor.name}${type}: ${actor.description}`;
    })
    .join("\n");

const formatSolutions = (solutions = []) =>
  solutions
    .map(
      (solution, index) => `
${index + 1}. ${solution.name} (${solution.category})
Description: ${solution.description}
Problem solved: ${solution.solvedProblem}
Strengths: ${(solution.strengths || []).join("; ")}
Weaknesses: ${(solution.weaknesses || []).join("; ")}
Difference: ${solution.differentiation}
`.trim()
    )
    .join("\n\n");

const jsonContract = `
Return ONLY valid JSON. No markdown. No explanation. No surrounding text.

Strict JSON format:
{
  "existingSolutions": [
    {
      "name": "Solution name",
      "category": "Existing application",
      "icon": "web",
      "description": "Short description of the solution.",
      "solvedProblem": "The specific problem this solution addresses.",
      "strengths": ["Concrete strength", "Concrete strength"],
      "weaknesses": ["Concrete weakness", "Concrete weakness"],
      "differentiation": "Why the student's project remains different or what limitations remain."
    }
  ]
}
`.trim();

const rules = `
Rules:
- Generate 3 to 5 relevant existing solutions.
- Prefer well-known real products, platforms, systems, websites, applications, or research solutions when they clearly match the project domain.
- If no famous solution is clearly relevant, create realistic domain-specific examples without pretending they are famous market leaders.
- Include direct and indirect competitors when useful.
- Keep every field concise, specific, and usable in an academic "Etude de l'existant".
- Strengths and weaknesses should each contain 2 to 4 short items.
- Differentiation must explain why the student's project still has value.
- Do not invent unrelated companies or generic placeholder tools.
- icon must be a short Material Symbols icon name such as "web", "apps", "science", "cloud", "school", "analytics", "devices", "business_center", "database", or "smart_toy".
`.trim();

const buildExistingSolutionGenerationPrompt = (project) => {
  const ctx = getProjectContext(project);
  return `
You are an academic software analysis assistant helping a student prepare the "Etude de l'existant" section for a PFE project.

Your task: Identify existing solutions that already solve, partially solve, or compete with the student's project idea.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for all fields when appropriate.

${jsonContract}

${rules}

PROJECT CONTEXT:
${formatContextString(ctx)}

KNOWN ACTORS AND STAKEHOLDERS:
${formatActors(project.actors || []) || "No actors have been defined yet."}
`.trim();
};

const buildExistingSolutionRefinementPrompt = (project, solutions) => {
  const ctx = getProjectContext(project);
  return `
You are an academic software analysis assistant helping a student improve the "Etude de l'existant" section for a PFE project.

Your task: Refine the current existing-solutions analysis. Improve relevance, clarity, academic usefulness, and differentiation while preserving valuable user edits.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for all fields when appropriate.

${jsonContract}

${rules}
- Preserve useful user-provided solutions.
- Remove duplicates and replace irrelevant solutions with stronger alternatives.

PROJECT CONTEXT:
${formatContextString(ctx)}

KNOWN ACTORS AND STAKEHOLDERS:
${formatActors(project.actors || []) || "No actors have been defined yet."}

CURRENT EXISTING SOLUTIONS:
${formatSolutions(solutions)}
`.trim();
};

module.exports = {
  buildExistingSolutionGenerationPrompt,
  buildExistingSolutionRefinementPrompt,
};
