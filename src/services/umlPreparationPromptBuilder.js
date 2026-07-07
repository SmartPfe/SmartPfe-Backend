const { formatContextString, getProjectContext } = require("./openRouterService");

const formatActors = (actors = []) =>
  actors.map((actor, index) => `${index + 1}. ${actor.name}: ${actor.description}`).join("\n");

const formatExistingSolutions = (solutions = []) =>
  solutions
    .map((solution, index) => `${index + 1}. ${solution.name}: ${solution.solvedProblem}. Difference: ${solution.differentiation}`)
    .join("\n");

const formatFunctionalRequirements = (requirements = []) =>
  requirements
    .map((requirement, index) => `${index + 1}. ${requirement.code} ${requirement.module} - ${requirement.title}: ${requirement.description}`)
    .join("\n");

const formatNonFunctionalRequirements = (requirements = []) =>
  requirements
    .map((requirement, index) => `${index + 1}. ${requirement.code} ${requirement.category} - ${requirement.title}: ${requirement.description}`)
    .join("\n");

const formatClasses = (classes = []) =>
  classes
    .map(
      (umlClass, index) => `
${index + 1}. ${umlClass.name} (${umlClass.type})
Description: ${umlClass.description}
Attributes: ${(umlClass.attributes || []).join("; ")}
Methods: ${(umlClass.methods || []).join("; ")}
`.trim()
    )
    .join("\n\n");

const formatRelationships = (relationships = []) =>
  relationships
    .map(
      (relationship, index) =>
        `${index + 1}. ${relationship.source} -> ${relationship.target} (${relationship.type}) ${relationship.label || ""}`
    )
    .join("\n");

const jsonContract = `
Return ONLY valid JSON. No markdown. No explanation. No surrounding text.
The first character of your response must be "{" and the last character must be "}".

Strict JSON format:
{
  "umlPreparation": {
    "classes": [
      {
        "name": "ClassName",
        "type": "Class",
        "description": "Short class responsibility.",
        "attributes": ["id: UUID", "name: String"],
        "methods": ["createItem()", "updateItem()"]
      }
    ],
    "relationships": [
      {
        "source": "ClassA",
        "target": "ClassB",
        "type": "association",
        "label": "uses",
        "sourceMultiplicity": "1",
        "targetMultiplicity": "*"
      }
    ],
    "useCase": {
      "actors": ["Actor"],
      "useCases": ["Use case"],
      "links": [{ "actor": "Actor", "useCase": "Use case" }]
    },
    "sequence": {
      "participants": ["Actor", "System"],
      "messages": [{ "source": "Actor", "target": "System", "message": "Request action", "response": false }]
    },
    "activity": {
      "transitions": [{ "from": "[*]", "to": "Start", "label": "" }]
    }
  }
}
`.trim();

const rules = `
Rules:
- Generate 4 to 8 coherent domain classes based on the project requirements.
- Class names must be valid PlantUML identifiers: PascalCase, no spaces.
- Attributes should use "name: Type" format.
- Methods should use "methodName()" or "methodName(param: Type)" format.
- Relationships must reference generated class names exactly.
- Relationship type must be exactly one of: "association", "inheritance", "composition", "aggregation", "dependency".
- Do not generate generic classes unrelated to the project.
- Use actors and functional requirements to derive use cases, sequence participants, and activity transitions.
- Keep content concise and suitable for a PFE UML preparation step.
`.trim();

const buildUmlPreparationGenerationPrompt = (project) => {
  const ctx = getProjectContext(project);
  return `
You are an academic software analysis assistant helping a student prepare UML diagrams for a PFE project.

Your task: Generate a complete UML preparation model based on all available project context.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for descriptions and labels when appropriate. Keep class names, attributes, and methods code-friendly.

${jsonContract}

${rules}

PROJECT CONTEXT:
${formatContextString(ctx)}

ACTORS:
${formatActors(project.actors || []) || "No actors have been defined yet."}

EXISTING SOLUTIONS:
${formatExistingSolutions(project.existingSolutions || []) || "No existing solutions have been defined yet."}

FUNCTIONAL REQUIREMENTS:
${formatFunctionalRequirements(project.functionalRequirements || []) || "No functional requirements have been defined yet."}

NON-FUNCTIONAL REQUIREMENTS:
${formatNonFunctionalRequirements(project.nonFunctionalRequirements || []) || "No non-functional requirements have been defined yet."}
`.trim();
};

const buildUmlPreparationRefinementPrompt = (project, umlPreparation) => {
  const ctx = getProjectContext(project);
  return `
You are an academic software analysis assistant helping a student refine UML preparation data for a PFE project.

Your task: Improve the current UML preparation model while preserving useful user edits. Fix missing attributes, weak methods, incoherent relationships, and incomplete diagram preparation.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for descriptions and labels when appropriate. Keep class names, attributes, and methods code-friendly.

${jsonContract}

${rules}
- Preserve useful user-provided classes and relationships.
- Remove duplicate or incoherent classes.
- Ensure relationships reference existing classes.

PROJECT CONTEXT:
${formatContextString(ctx)}

ACTORS:
${formatActors(project.actors || []) || "No actors have been defined yet."}

FUNCTIONAL REQUIREMENTS:
${formatFunctionalRequirements(project.functionalRequirements || []) || "No functional requirements have been defined yet."}

NON-FUNCTIONAL REQUIREMENTS:
${formatNonFunctionalRequirements(project.nonFunctionalRequirements || []) || "No non-functional requirements have been defined yet."}

CURRENT CLASSES:
${formatClasses(umlPreparation.classes || [])}

CURRENT RELATIONSHIPS:
${formatRelationships(umlPreparation.relationships || [])}
`.trim();
};

module.exports = {
  buildUmlPreparationGenerationPrompt,
  buildUmlPreparationRefinementPrompt,
};
