const Project = require("../models/Project");
const { callOpenRouter } = require("./openRouterService");
const {
  buildUmlPreparationGenerationPrompt,
  buildUmlPreparationRefinementPrompt,
  buildUmlPreparationTranslationPrompt,
} = require("./umlPreparationPromptBuilder");

const RELATIONSHIP_TYPES = new Set(["association", "inheritance", "composition", "aggregation", "dependency"]);

const normalizeList = (value) => (Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : []);

const sanitizeClassName = (value, fallback) => {
  const cleaned = String(value || "").replace(/[^a-zA-Z0-9_]/g, "").trim();
  if (!cleaned) return fallback;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const normalizeClasses = (classes) => {
  if (!Array.isArray(classes)) return [];
  return classes
    .map((umlClass, index) => ({
      name: sanitizeClassName(umlClass?.name, `Class${index + 1}`),
      type: String(umlClass?.type || "Class").trim(),
      description: String(umlClass?.description || "").trim(),
      attributes: normalizeList(umlClass?.attributes),
      methods: normalizeList(umlClass?.methods),
    }))
    .filter((umlClass) => umlClass.name);
};

const normalizeRelationships = (relationships, classNames) => {
  if (!Array.isArray(relationships)) return [];
  const knownClasses = new Set(classNames);
  return relationships
    .map((relationship) => ({
      source: sanitizeClassName(relationship?.source, ""),
      target: sanitizeClassName(relationship?.target, ""),
      type: RELATIONSHIP_TYPES.has(relationship?.type) ? relationship.type : "association",
      label: String(relationship?.label || "").trim(),
      sourceMultiplicity: String(relationship?.sourceMultiplicity || "").trim(),
      targetMultiplicity: String(relationship?.targetMultiplicity || "").trim(),
    }))
    .filter((relationship) => relationship.source && relationship.target && knownClasses.has(relationship.source) && knownClasses.has(relationship.target));
};

const normalizeUseCase = (useCase = {}) => {
  const primaryActors = normalizeList(useCase.primaryActors?.length ? useCase.primaryActors : useCase.actors);
  const secondaryActors = normalizeList(useCase.secondaryActors);
  const allActors = Array.from(new Set([...primaryActors, ...secondaryActors, ...normalizeList(useCase.actors)]));
  const useCases = normalizeList(useCase.useCases);

  const rawLinks = Array.isArray(useCase.actorLinks)
    ? useCase.actorLinks
    : Array.isArray(useCase.links)
    ? useCase.links
    : [];

  const links = rawLinks
    .map((link) => ({
      actor: String(link?.actor || "").trim(),
      useCase: String(link?.useCase || "").trim(),
    }))
    .filter((link) => link.actor && link.useCase);

  const useCaseRelations = Array.isArray(useCase.useCaseRelations)
    ? useCase.useCaseRelations
        .map((rel) => ({
          source: String(rel?.source || "").trim(),
          target: String(rel?.target || "").trim(),
          type: rel?.type === "extend" ? "extend" : "include",
        }))
        .filter((rel) => rel.source && rel.target)
    : [];

  return {
    systemName: String(useCase.systemName || "System Platform").trim(),
    primaryActors: primaryActors.length ? primaryActors : (allActors.length ? allActors : ["User"]),
    secondaryActors,
    actors: allActors.length ? allActors : ["User"],
    useCases: useCases.length ? useCases : ["Process Action"],
    links,
    useCaseRelations,
  };
};

const normalizeSequence = (sequence = {}) => {
  const rawParticipants = Array.isArray(sequence.participants) ? sequence.participants : [];
  const participants = rawParticipants.map((p) => {
    if (typeof p === "string") {
      return { name: p.trim(), type: "participant" };
    }
    return {
      name: String(p?.name || "Participant").trim(),
      type: String(p?.type || "participant").trim(),
    };
  }).filter((p) => p.name);

  const messages = Array.isArray(sequence.messages)
    ? sequence.messages
        .map((message) => ({
          source: String(message?.source || "").trim(),
          target: String(message?.target || "").trim(),
          message: String(message?.message || "").trim(),
          response: Boolean(message?.response),
          type: String(message?.type || (message?.response ? "return" : "sync")).trim(),
        }))
        .filter((message) => message.source && message.target && message.message)
    : [];

  const altFlow = sequence.altFlow && sequence.altFlow.condition
    ? {
        condition: String(sequence.altFlow.condition || "").trim(),
        messages: Array.isArray(sequence.altFlow.messages)
          ? sequence.altFlow.messages
              .map((m) => ({
                source: String(m?.source || "").trim(),
                target: String(m?.target || "").trim(),
                message: String(m?.message || "").trim(),
                response: Boolean(m?.response),
              }))
              .filter((m) => m.source && m.target && m.message)
          : [],
      }
    : { condition: "", messages: [] };

  return {
    scenario: String(sequence.scenario || "Core Execution Flow").trim(),
    participants: participants.length ? participants : [{ name: "User", type: "actor" }, { name: "System", type: "boundary" }],
    messages,
    altFlow,
  };
};

const normalizeActivity = (activity = {}) => {
  const steps = Array.isArray(activity.steps)
    ? activity.steps
        .map((step) => ({
          type: step?.type === "decision" ? "decision" : "action",
          label: String(step?.label || "").trim(),
          condition: String(step?.condition || "").trim(),
          thenBranch: String(step?.thenBranch || "").trim(),
          elseBranch: String(step?.elseBranch || "").trim(),
        }))
        .filter((step) => (step.type === "action" && step.label) || (step.type === "decision" && step.condition))
    : [];

  const transitions = Array.isArray(activity.transitions)
    ? activity.transitions
        .map((transition) => ({
          from: String(transition?.from || "").trim(),
          to: String(transition?.to || "").trim(),
          label: String(transition?.label || "").trim(),
        }))
        .filter((transition) => transition.from && transition.to)
    : [];

  return {
    workflowTitle: String(activity.workflowTitle || "Core Business Process").trim(),
    steps,
    transitions,
  };
};

const normalizeUmlPreparation = (payload) => {
  const source = payload?.umlPreparation || payload || {};
  const classes = normalizeClasses(source.classes);
  const relationships = normalizeRelationships(source.relationships, classes.map((umlClass) => umlClass.name));

  return {
    classes,
    relationships,
    useCase: normalizeUseCase(source.useCase),
    sequence: normalizeSequence(source.sequence),
    activity: normalizeActivity(source.activity),
  };
};

const extractJsonPayload = (content) => {
  const text = String(content || "").trim();
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : text;
  if (candidate.startsWith("{")) return candidate;
  const objectStart = candidate.indexOf("{");
  const objectEnd = candidate.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) return candidate.slice(objectStart, objectEnd + 1);
  return candidate;
};

const mergeUmlPreparation = (base, partial, diagramType = "all") => {
  const current = normalizeUmlPreparation(base);
  const typeKey = String(diagramType || "all").toLowerCase();

  if (typeKey === "class") {
    const classes = normalizeClasses(partial.classes || []);
    const relationships = normalizeRelationships(partial.relationships || [], classes.map((c) => c.name));
    return {
      ...current,
      classes: classes.length ? classes : current.classes,
      relationships: relationships.length ? relationships : current.relationships,
    };
  }

  if (typeKey === "usecase") {
    return {
      ...current,
      useCase: normalizeUseCase(partial.useCase || partial),
    };
  }

  if (typeKey === "sequence") {
    return {
      ...current,
      sequence: normalizeSequence(partial.sequence || partial),
    };
  }

  if (typeKey === "activity") {
    return {
      ...current,
      activity: normalizeActivity(partial.activity || partial),
    };
  }

  return normalizeUmlPreparation(partial);
};

const getProjectForUser = async (userId, projectId = null) => {
  const query = projectId ? { _id: projectId, user: userId } : { user: userId };
  const project = await Project.findOne(query);
  if (!project) throw new Error("Project not found for this user.");
  return project;
};

const generateUmlPreparation = async (project, diagramType = "all", currentPreparation = null) => {
  const prompt = buildUmlPreparationGenerationPrompt(project, diagramType);
  const response = await callOpenRouter(prompt);
  let parsed;
  try {
    parsed = JSON.parse(extractJsonPayload(response));
  } catch (error) {
    console.error("[uml] Invalid AI JSON response:", String(response || "").slice(0, 1000));
    throw new Error("AI returned invalid UML preparation JSON. Please try again.");
  }

  const base = currentPreparation || project.umlPreparation || {};
  return mergeUmlPreparation(base, parsed.umlPreparation || parsed, diagramType);
};

const refineUmlPreparation = async (project, currentUmlPreparation, instructions = "", diagramType = "all") => {
  const umlPreparation = normalizeUmlPreparation(currentUmlPreparation);
  const prompt = buildUmlPreparationRefinementPrompt(project, umlPreparation, instructions, diagramType);
  const response = await callOpenRouter(prompt);
  let parsed;
  try {
    parsed = JSON.parse(extractJsonPayload(response));
  } catch (error) {
    console.error("[uml] Invalid AI JSON response:", String(response || "").slice(0, 1000));
    throw new Error("AI returned invalid UML preparation JSON. Please try again.");
  }

  return mergeUmlPreparation(umlPreparation, parsed.umlPreparation || parsed, diagramType);
};

const translateUmlPreparation = async (project, currentUmlPreparation) => {
  const umlPreparation = normalizeUmlPreparation(currentUmlPreparation);
  if (umlPreparation.classes.length === 0) {
    throw new Error("Current UML preparation is required to translate.");
  }

  const prompt = buildUmlPreparationTranslationPrompt(project, umlPreparation);
  const response = await callOpenRouter(prompt);
  return parseUmlPreparationResponse(response);
};

const getUmlPreparation = async (userId, projectId) => {
  const project = await getProjectForUser(userId, projectId);
  return normalizeUmlPreparation(project.umlPreparation || {});
};

const saveUmlPreparation = async (userId, projectId, umlPreparation, language) => {
  const normalized = normalizeUmlPreparation(umlPreparation);
  const updates = { umlPreparation: normalized };
  if (language !== undefined) {
    updates.umlPreparationLanguage = language;
  }

  const project = await Project.findOneAndUpdate(
    { _id: projectId, user: userId },
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!project) throw new Error("Project not found for this user.");
  return {
    umlPreparation: normalizeUmlPreparation(project.umlPreparation || {}),
    language: project.umlPreparationLanguage,
  };
};

module.exports = {
  generateUmlPreparation,
  refineUmlPreparation,
  translateUmlPreparation,
  getUmlPreparation,
  saveUmlPreparation,
  normalizeUmlPreparation,
};
