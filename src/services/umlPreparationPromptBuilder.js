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

const contracts = {
  class: `
Return ONLY valid JSON. No markdown fences. No explanation.
Strict JSON format:
{
  "classes": [
    {
      "name": "User",
      "type": "Abstract Class",
      "description": "Base user entity managing authentication and account profiles.",
      "attributes": ["id: UUID", "email: String", "passwordHash: String", "role: String", "createdAt: DateTime"],
      "methods": ["login(credentials: Credentials): Token", "logout(): void", "resetPassword(token: String): Boolean"]
    },
    {
      "name": "CoreEntity",
      "type": "Class",
      "description": "Primary business entity representing the core domain object.",
      "attributes": ["id: UUID", "title: String", "status: String", "score: Float"],
      "methods": ["updateStatus(newStatus: String): void", "calculateMetrics(): Float"]
    }
  ],
  "relationships": [
    {
      "source": "User",
      "target": "CoreEntity",
      "type": "association",
      "label": "manages",
      "sourceMultiplicity": "1",
      "targetMultiplicity": "0..*"
    }
  ]
}
`.trim(),

  usecase: `
Return ONLY valid JSON. No markdown fences. No explanation.
Strict JSON format:
{
  "useCase": {
    "systemName": "Platform / System Title",
    "primaryActors": ["Primary User", "Administrator"],
    "secondaryActors": ["External Payment Gateway", "Notification Engine", "AI Service"],
    "useCases": [
      "Authenticate & Sign In",
      "Manage Profile",
      "Submit Core Request",
      "Validate & Process Request",
      "Execute AI Analysis",
      "Process Online Payment",
      "Generate Final PDF Report"
    ],
    "actorLinks": [
      { "actor": "Primary User", "useCase": "Authenticate & Sign In" },
      { "actor": "Primary User", "useCase": "Submit Core Request" },
      { "actor": "Primary User", "useCase": "Process Online Payment" },
      { "actor": "Administrator", "useCase": "Validate & Process Request" },
      { "actor": "Process Online Payment", "useCase": "External Payment Gateway" },
      { "actor": "Execute AI Analysis", "useCase": "AI Service" }
    ],
    "useCaseRelations": [
      { "source": "Submit Core Request", "target": "Authenticate & Sign In", "type": "include" },
      { "source": "Submit Core Request", "target": "Process Online Payment", "type": "include" },
      { "source": "Validate & Process Request", "target": "Execute AI Analysis", "type": "include" },
      { "source": "Validate & Process Request", "target": "Generate Final PDF Report", "type": "extend" }
    ]
  }
}
`.trim(),

  sequence: `
Return ONLY valid JSON. No markdown fences. No explanation.
Strict JSON format:
{
  "sequence": {
    "scenario": "Core End-to-End Workflow Scenario",
    "participants": [
      { "name": "User", "type": "actor" },
      { "name": "FrontendApp", "type": "boundary" },
      { "name": "SystemController", "type": "control" },
      { "name": "CoreService", "type": "control" },
      { "name": "Database", "type": "database" },
      { "name": "ExternalAPI", "type": "entity" }
    ],
    "messages": [
      { "source": "User", "target": "FrontendApp", "message": "Submit action request form", "response": false, "type": "sync" },
      { "source": "FrontendApp", "target": "SystemController", "message": "POST /api/v1/resource (payload)", "response": false, "type": "sync" },
      { "source": "SystemController", "target": "CoreService", "message": "processRequest(data)", "response": false, "type": "sync" },
      { "source": "CoreService", "target": "Database", "message": "queryExistingRecords(id)", "response": false, "type": "sync" },
      { "source": "Database", "target": "CoreService", "message": "return record details", "response": true, "type": "return" },
      { "source": "CoreService", "target": "ExternalAPI", "message": "fetchExternalVerification(params)", "response": false, "type": "sync" },
      { "source": "ExternalAPI", "target": "CoreService", "message": "return verification results", "response": true, "type": "return" },
      { "source": "CoreService", "target": "Database", "message": "saveUpdatedRecord(entity)", "response": false, "type": "sync" },
      { "source": "CoreService", "target": "SystemController", "message": "return operation successDTO", "response": true, "type": "return" },
      { "source": "SystemController", "target": "FrontendApp", "message": "200 OK (Processed Result)", "response": true, "type": "return" },
      { "source": "FrontendApp", "target": "User", "message": "Display success confirmation & summary", "response": true, "type": "return" }
    ],
    "altFlow": {
      "condition": "Invalid input or verification failure",
      "messages": [
        { "source": "SystemController", "target": "FrontendApp", "message": "422 Unprocessable Entity / 400 Bad Request", "response": true },
        { "source": "FrontendApp", "target": "User", "message": "Display actionable validation error alert", "response": true }
      ]
    }
  }
}
`.trim(),

  activity: `
Return ONLY valid JSON. No markdown fences. No explanation.
Strict JSON format:
{
  "activity": {
    "workflowTitle": "Primary Business & Processing Workflow",
    "steps": [
      { "type": "action", "label": "User initiates transaction/process and provides required inputs" },
      {
        "type": "decision",
        "condition": "Input validation and security checks pass?",
        "thenBranch": "Authorize action and trigger business computation",
        "elseBranch": "Return validation errors and prompt user for correction"
      },
      { "type": "action", "label": "System executes core business logic and database persistence" },
      {
        "type": "decision",
        "condition": "Secondary verification / external processing succeeds?",
        "thenBranch": "Commit transaction and generate confirmation artifact",
        "elseBranch": "Rollback state and notify administrator of failure"
      },
      { "type": "action", "label": "Deliver final output to user and log audit trail" }
    ]
  }
}
`.trim(),

  all: `
Return ONLY valid JSON. No markdown fences. No explanation. No commentary.
Strict JSON structure:
{
  "umlPreparation": {
    "classes": [
      {
        "name": "User",
        "type": "Abstract Class",
        "description": "Base user entity managing authentication and account profiles.",
        "attributes": ["id: UUID", "email: String", "passwordHash: String", "role: String", "createdAt: DateTime"],
        "methods": ["login(credentials: Credentials): Token", "logout(): void", "resetPassword(token: String): Boolean"]
      },
      {
        "name": "CoreEntity",
        "type": "Class",
        "description": "Primary business entity representing the core domain object.",
        "attributes": ["id: UUID", "title: String", "status: String", "score: Float"],
        "methods": ["updateStatus(newStatus: String): void", "calculateMetrics(): Float"]
      }
    ],
    "relationships": [
      {
        "source": "User",
        "target": "CoreEntity",
        "type": "association",
        "label": "manages",
        "sourceMultiplicity": "1",
        "targetMultiplicity": "0..*"
      }
    ],
    "useCase": {
      "systemName": "System Name / Platform Title",
      "primaryActors": ["Primary User", "Administrator"],
      "secondaryActors": ["External Payment Gateway", "Notification Engine", "AI Service"],
      "useCases": [
        "Authenticate & Sign In",
        "Manage Profile",
        "Submit Core Request",
        "Validate & Process Request",
        "Execute AI Analysis",
        "Process Online Payment",
        "Generate Final PDF Report"
      ],
      "actorLinks": [
        { "actor": "Primary User", "useCase": "Authenticate & Sign In" },
        { "actor": "Primary User", "useCase": "Submit Core Request" },
        { "actor": "Primary User", "useCase": "Process Online Payment" },
        { "actor": "Administrator", "useCase": "Validate & Process Request" },
        { "actor": "Process Online Payment", "useCase": "External Payment Gateway" },
        { "actor": "Execute AI Analysis", "useCase": "AI Service" }
      ],
      "useCaseRelations": [
        { "source": "Submit Core Request", "target": "Authenticate & Sign In", "type": "include" },
        { "source": "Submit Core Request", "target": "Process Online Payment", "type": "include" },
        { "source": "Validate & Process Request", "target": "Execute AI Analysis", "type": "include" },
        { "source": "Validate & Process Request", "target": "Generate Final PDF Report", "type": "extend" }
      ]
    },
    "sequence": {
      "scenario": "Core End-to-End Workflow Scenario",
      "participants": [
        { "name": "User", "type": "actor" },
        { "name": "FrontendApp", "type": "boundary" },
        { "name": "SystemController", "type": "control" },
        { "name": "CoreService", "type": "control" },
        { "name": "Database", "type": "database" },
        { "name": "ExternalAPI", "type": "entity" }
      ],
      "messages": [
        { "source": "User", "target": "FrontendApp", "message": "Submit action request form", "response": false, "type": "sync" },
        { "source": "FrontendApp", "target": "SystemController", "message": "POST /api/v1/resource (payload)", "response": false, "type": "sync" },
        { "source": "SystemController", "target": "CoreService", "message": "processRequest(data)", "response": false, "type": "sync" },
        { "source": "CoreService", "target": "Database", "message": "queryExistingRecords(id)", "response": false, "type": "sync" },
        { "source": "Database", "target": "CoreService", "message": "return record details", "response": true, "type": "return" },
        { "source": "CoreService", "target": "ExternalAPI", "message": "fetchExternalVerification(params)", "response": false, "type": "sync" },
        { "source": "ExternalAPI", "target": "CoreService", "message": "return verification results", "response": true, "type": "return" },
        { "source": "CoreService", "target": "Database", "message": "saveUpdatedRecord(entity)", "response": false, "type": "sync" },
        { "source": "CoreService", "target": "SystemController", "message": "return operation successDTO", "response": true, "type": "return" },
        { "source": "SystemController", "target": "FrontendApp", "message": "200 OK (Processed Result)", "response": true, "type": "return" },
        { "source": "FrontendApp", "target": "User", "message": "Display success confirmation & summary", "response": true, "type": "return" }
      ],
      "altFlow": {
        "condition": "Invalid input or verification failure",
        "messages": [
          { "source": "SystemController", "target": "FrontendApp", "message": "422 Unprocessable Entity / 400 Bad Request", "response": true },
          { "source": "FrontendApp", "target": "User", "message": "Display actionable validation error alert", "response": true }
        ]
      }
    },
    "activity": {
      "workflowTitle": "Primary Business & Processing Workflow",
      "steps": [
        { "type": "action", "label": "User initiates transaction/process and provides required inputs" },
        {
          "type": "decision",
          "condition": "Input validation and security checks pass?",
          "thenBranch": "Authorize action and trigger business computation",
          "elseBranch": "Return validation errors and prompt user for correction"
        },
        { "type": "action", "label": "System executes core business logic and database persistence" },
        {
          "type": "decision",
          "condition": "Secondary verification / external processing succeeds?",
          "thenBranch": "Commit transaction and generate confirmation artifact",
          "elseBranch": "Rollback state and notify administrator of failure"
        },
        { "type": "action", "label": "Deliver final output to user and log audit trail" }
      ]
    }
  }
}
`.trim(),
};

const rulesByDiagram = {
  usecase: `
CRITICAL ACADEMIC USE CASE RULES:
- systemName: Name of the student's project / core platform.
- primaryActors: 2 to 4 human / user roles that initiate use cases (e.g. Student, Mentor, Doctor, Admin). They appear on the LEFT.
- secondaryActors: 1 to 3 external systems, APIs, or background servers (e.g. PaymentGateway, NotificationService, AIService, AuthServer). They appear on the RIGHT.
- useCases: 6 to 10 distinct, functional use cases inside the system boundary (written as action phrases like "Submit PFE Topic", "Review & Evaluate Submission", "Process Payment").
- actorLinks: Connect primary actors to their initiated use cases, and secondary actors to the use cases that interact with them.
- useCaseRelations: Include at least 2-4 realistic relations:
  - "include": Essential, mandatory sub-flow (e.g., "Submit Topic" includes "Authenticate User", "Book Consultation" includes "Process Payment").
  - "extend": Optional extension or alternative outcome (e.g., "Review Submission" extends "Request Revision", "Analyze Data" extends "Flag High Risk Warning").
`.trim(),

  activity: `
CRITICAL ACADEMIC ACTIVITY RULES:
- Must NOT be a naive 1-directional chain!
- workflowTitle: Name of the critical workflow (e.g., "PFE Proposal Validation & Defense Scheduling Flow").
- steps: Provide 4 to 7 realistic steps with at least 1-2 "decision" steps.
  - Decision steps MUST have a clear "condition", a realistic "thenBranch" (success path), and an "elseBranch" (error / fallback / retry / rejection path).
  - Action steps describe concrete system actions.
`.trim(),

  sequence: `
CRITICAL ACADEMIC SEQUENCE RULES:
- scenario: Name of the detailed interaction (e.g., "Authentication and Submission Processing Flow").
- participants: 4 to 6 components across architecture tiers (actor, boundary, control, database, entity).
- messages: 8 to 14 realistic synchronous requests and return responses with activations and realistic method calls or API endpoints.
- altFlow: Provide an alternative/error branch handling invalid credentials, timeout, or validation errors.
`.trim(),

  class: `
CRITICAL ACADEMIC CLASS RULES:
- 5 to 8 coherent domain entities tailored specifically to the project's functional requirements.
- Class names in PascalCase without spaces (e.g. User, StudentProfile, ConsultationRecord, EvaluationRubric).
- Provide 3 to 6 realistic attributes with proper types (e.g., id: UUID, email: String, status: ProjectStatus, createdAt: DateTime).
- Provide 2 to 4 realistic methods with parameter and return types (e.g., updateStatus(newStatus: ProjectStatus): void, calculateGrade(): Float).
- Relationships must use valid types: "association", "inheritance", "composition", "aggregation", "dependency" with accurate multiplicities ("1", "0..*", "1..*").
`.trim(),
};

const getTargetContract = (diagramType = "all") => {
  const key = String(diagramType || "all").toLowerCase();
  return contracts[key] || contracts.all;
};

const getTargetRules = (diagramType = "all") => {
  const key = String(diagramType || "all").toLowerCase();
  if (rulesByDiagram[key]) return rulesByDiagram[key];
  return Object.values(rulesByDiagram).join("\n\n");
};

const buildUmlPreparationGenerationPrompt = (project, diagramType = "all") => {
  const ctx = getProjectContext(project);
  const typeKey = String(diagramType || "all").toLowerCase();
  const diagramLabel =
    typeKey === "usecase"
      ? "Use Case Diagram"
      : typeKey === "sequence"
      ? "Sequence Diagram"
      : typeKey === "activity"
      ? "Activity Diagram"
      : typeKey === "class"
      ? "Class Diagram"
      : "Complete UML Diagram Suite (Class, Use Case, Sequence, Activity)";

  return `
You are an expert academic software analysis professor helping a university student design a professional ${diagramLabel} for their PFE (Final Year Engineering Thesis).

Your task: Generate an academically rigorous, highly realistic ${diagramLabel} tailored strictly to the project context, actors, and functional requirements.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for descriptions, use cases, workflow steps, sequence messages, and labels. Keep class names, attributes, and method signatures code-friendly.

${getTargetContract(typeKey)}

${getTargetRules(typeKey)}

PROJECT CONTEXT:
${formatContextString(ctx)}

ACTORS:
${formatActors(project.actors || []) || "No actors defined yet."}

EXISTING SOLUTIONS:
${formatExistingSolutions(project.existingSolutions || []) || "No existing solutions defined yet."}

FUNCTIONAL REQUIREMENTS:
${formatFunctionalRequirements(project.functionalRequirements || []) || "No functional requirements defined yet."}

NON-FUNCTIONAL REQUIREMENTS:
${formatNonFunctionalRequirements(project.nonFunctionalRequirements || []) || "No non-functional requirements defined yet."}
`.trim();
};

const buildUmlPreparationRefinementPrompt = (project, umlPreparation, instructions = "", diagramType = "all") => {
  const ctx = getProjectContext(project);
  const studentInstructions = String(instructions || "").trim();
  const typeKey = String(diagramType || "all").toLowerCase();
  const diagramLabel =
    typeKey === "usecase"
      ? "Use Case Diagram"
      : typeKey === "sequence"
      ? "Sequence Diagram"
      : typeKey === "activity"
      ? "Activity Diagram"
      : typeKey === "class"
      ? "Class Diagram"
      : "Complete UML Model";

  return `
You are an expert academic software analysis professor helping a student refine their ${diagramLabel} for a PFE project.

Your task: Improve and elevate the current ${diagramLabel} while strictly respecting student instructions and preserving valuable manual edits.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for descriptions, use cases, workflow steps, sequence messages, and labels. Keep class names, attributes, and method signatures code-friendly.

${getTargetContract(typeKey)}

${getTargetRules(typeKey)}
- Preserve useful user-provided entities, use cases, and workflows.
- Enhance any naive structures (add decisions to activity, add includes/extends to use cases, refine class multiplicities).
${studentInstructions ? `\nSTUDENT INSTRUCTIONS (highest priority, while maintaining academic UML validity):\n${studentInstructions}\n` : ""}

PROJECT CONTEXT:
${formatContextString(ctx)}

ACTORS:
${formatActors(project.actors || []) || "No actors defined yet."}

FUNCTIONAL REQUIREMENTS:
${formatFunctionalRequirements(project.functionalRequirements || []) || "No functional requirements defined yet."}

NON-FUNCTIONAL REQUIREMENTS:
${formatNonFunctionalRequirements(project.nonFunctionalRequirements || []) || "No non-functional requirements defined yet."}

CURRENT UML PREPARATION DATA:
${JSON.stringify({ umlPreparation }, null, 2)}
`.trim();
};

const buildUmlPreparationTranslationPrompt = (project, umlPreparation) => {
  const ctx = getProjectContext(project);
  return `
You are an academic translation assistant.

Your task: Translate human-readable labels, use cases, workflow steps, sequence messages, and descriptions in the current UML model to ${ctx.outputLanguage}.

OUTPUT LANGUAGE: ${ctx.outputLanguage}

${contracts.all}

Rules:
- Translate only the human-readable text (descriptions, use cases, actor names, workflow step labels/conditions, sequence message labels).
- Preserve class names, attributes, and method signatures code-friendly.
- Return ONLY valid JSON. No markdown fences.

CURRENT UML PREPARATION:
${JSON.stringify({ umlPreparation }, null, 2)}
`.trim();
};

module.exports = {
  buildUmlPreparationGenerationPrompt,
  buildUmlPreparationRefinementPrompt,
  buildUmlPreparationTranslationPrompt,
};
