const { formatContextString, getProjectContext } = require("./openRouterService");

const formatActors = (actors = []) =>
  actors
    .map((actor, index) => {
      const type = actor.type ? ` (${actor.type})` : "";
      return `${index + 1}. ${actor.name}${type}: ${actor.description}`;
    })
    .join("\n");

const buildActorGenerationPrompt = (project) => {
  const ctx = getProjectContext(project);
  return `
You are an academic software analysis assistant helping a student identify actors and stakeholders for a PFE project.

Your task: Generate a concise list of project actors based on the project context.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for actor names and descriptions when appropriate.

Return ONLY valid JSON. No markdown. No explanation. No surrounding text.

Strict JSON format:
{
  "actors": [
    {
      "name": "Actor name",
      "description": "One clear sentence describing how this actor interacts with or is affected by the system.",
      "type": "primary",
      "icon": "person"
    }
  ]
}

Rules:
- Generate only the actors that are clearly relevant.
- Most projects should have 2 to 4 primary actors.
- Add 0 to 3 external actors only when the context clearly mentions external systems, APIs, hardware, devices, organizations, or third-party services.
- Do not force external actors when the project does not need them.
- type must be exactly one of: "primary", "external".
- Use "primary" for Acteurs principaux.
- Use "external" for Acteurs externes (Systèmes ou Matériel).
- icon must be a short Material Symbols icon name such as "person", "admin_panel_settings", "school", "api", "devices", "database", "business_center", or "sensors".
- Do not invent unrelated actors.
- Do not include duplicate or overlapping actors.
- Descriptions must be specific to this project.

PROJECT CONTEXT:
${formatContextString(ctx)}
`.trim();
};

const buildActorRefinementPrompt = (project, actors) => {
  const ctx = getProjectContext(project);
  return `
You are an academic software analysis assistant helping a student improve actors and stakeholders for a PFE project.

Your task: Refine the current actor list. Improve clarity, remove duplicates, add missing essential actors, and ensure each role is specific.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Use ${ctx.outputLanguage} for actor names and descriptions when appropriate.

Return ONLY valid JSON. No markdown. No explanation. No surrounding text.

Strict JSON format:
{
  "actors": [
    {
      "name": "Actor name",
      "description": "One clear sentence describing how this actor interacts with or is affected by the system.",
      "type": "primary",
      "icon": "person"
    }
  ]
}

Rules:
- Preserve useful user-provided actors.
- Do not silently discard important actors.
- Keep the list concise and relevant.
- Most projects should have 2 to 4 primary actors.
- Add 0 to 3 external actors only when the context clearly requires external systems, APIs, hardware, devices, organizations, or third-party services.
- Do not force external actors when the project does not need them.
- type must be exactly one of: "primary", "external".
- Use "primary" for Acteurs principaux.
- Use "external" for Acteurs externes (Systèmes ou Matériel).
- icon must be a short Material Symbols icon name such as "person", "admin_panel_settings", "school", "api", "devices", "database", "business_center", or "sensors".
- Do not include duplicate or overlapping actors.
- Descriptions must be specific to this project.

PROJECT CONTEXT:
${formatContextString(ctx)}

CURRENT ACTORS:
${formatActors(actors)}
`.trim();
};

module.exports = {
  buildActorGenerationPrompt,
  buildActorRefinementPrompt,
};
