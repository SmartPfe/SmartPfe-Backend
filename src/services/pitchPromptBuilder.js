const { getProjectContext } = require("./openRouterService");
const { buildContextBlock, formatCurrentPresentation } = require("./presentationPromptBuilder");

const formatCurrentPitch = (pitch = {}) =>
  (pitch.slides || [])
    .map((slide, index) => [
      `Slide ${index + 1}: ${slide.title}`,
      `Estimated time: ${slide.estimatedSeconds || 0} seconds`,
      `Speech:\n${slide.speech || ""}`,
      `Speaker tips:\n${(slide.tips || []).map((tip) => `- ${tip}`).join("\n")}`,
    ].join("\n"))
    .join("\n\n");

const formatTargetSlide = (presentation, slideId) => {
  const slides = presentation?.slides || [];
  const index = slides.findIndex((slide) => slide.id === slideId);
  const slide = slides[index];
  if (!slide) return "";

  return [
    `Slide ${index + 1} of ${slides.length}: ${slide.title}`,
    `Bullets:\n${(slide.bullets || []).map((bullet) => `- ${bullet}`).join("\n")}`,
    `Speaker notes from Presentation:\n${slide.notes || ""}`,
  ].join("\n");
};

const pitchJsonContract = `Return ONLY valid JSON. No markdown fences. No explanation.

Strict JSON format:
{
  "pitch": {
    "durationMinutes": 15,
    "slides": [
      {
        "slideId": "same-slide-id-from-presentation",
        "title": "Slide title",
        "estimatedSeconds": 75,
        "speech": "Complete natural speech for this slide.",
        "tips": ["Simple delivery advice", "Useful transition or pause"]
      }
    ]
  }
}`.trim();

const singleSlideJsonContract = `Return ONLY valid JSON. No markdown fences. No explanation.

Strict JSON format:
{
  "slide": {
    "slideId": "same-slide-id-from-presentation",
    "title": "Slide title",
    "estimatedSeconds": 75,
    "speech": "Complete natural speech for this slide.",
    "tips": ["Simple delivery advice", "Useful transition or pause"]
  }
}`.trim();

const rules = `Rules:
- Generate a complete oral defense speech based on the generated presentation.
- Keep exactly one speech item per presentation slide and preserve each slideId.
- The total speech duration must closely match the selected presentation duration.
- Use the slide order from the generated presentation as the speech order.
- Use all available Smart PFE context: generated presentation, report, report structure, UML, functional requirements, non-functional requirements, product backlog, user stories, problem statement, and every generated workflow artifact.
- The speech must sound natural when spoken by a student in front of an academic jury.
- Do not repeat slide bullets mechanically; explain, connect, and transition between ideas.
- Do not invent metrics, jury names, screenshots, experiments, company facts, or implementation details not supported by the context.
- Speaker tips must be short, practical advice about emphasis, pauses, transitions, or mistakes to avoid.
- During refinement, preserve useful student edits while improving clarity, flow, pacing, and academic tone.`.trim();

const buildPitchGenerationPrompt = (project, presentation) => {
  const ctx = getProjectContext(project);
  return `
You are Smart PFE's AI Pitch Studio, helping a student prepare the complete speech for an academic PFE defense.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Write entirely in ${ctx.outputLanguage} unless technical terms must remain in English.

Selected presentation duration: ${presentation.durationMinutes} minutes.

${pitchJsonContract}

${rules}

GENERATED PRESENTATION:
${formatCurrentPresentation(presentation)}

${buildContextBlock(project)}
`.trim();
};

const buildPitchRefinementPrompt = (project, presentation, pitch) => {
  const ctx = getProjectContext(project);
  return `
You are Smart PFE's AI Pitch Studio.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Write entirely in ${ctx.outputLanguage} unless technical terms must remain in English.

Refine the complete speech for a ${presentation.durationMinutes}-minute PFE defense.

${pitchJsonContract}

${rules}

GENERATED PRESENTATION:
${formatCurrentPresentation(presentation)}

CURRENT EDITABLE SPEECH:
${formatCurrentPitch(pitch)}

${buildContextBlock(project)}
`.trim();
};

const buildPitchSlideGenerationPrompt = (project, presentation, pitch, slideId) => {
  const ctx = getProjectContext(project);
  return `
You are Smart PFE's AI Pitch Studio.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Write entirely in ${ctx.outputLanguage} unless technical terms must remain in English.

Generate only the speech for the selected slide. Respect the complete ${presentation.durationMinutes}-minute presentation pacing.

${singleSlideJsonContract}

${rules}

TARGET SLIDE:
${formatTargetSlide(presentation, slideId)}

FULL PRESENTATION:
${formatCurrentPresentation(presentation)}

CURRENT SPEECH FOR CONTEXT:
${formatCurrentPitch(pitch)}

${buildContextBlock(project)}
`.trim();
};

const buildPitchSlideRefinementPrompt = (project, presentation, pitch, slideId, currentSlide) => {
  const ctx = getProjectContext(project);
  return `
You are Smart PFE's AI Pitch Studio.

OUTPUT LANGUAGE: ${ctx.outputLanguage}
Write entirely in ${ctx.outputLanguage} unless technical terms must remain in English.

Refine only the selected slide speech. Preserve useful student edits and keep the full ${presentation.durationMinutes}-minute defense pacing coherent.

${singleSlideJsonContract}

${rules}

TARGET SLIDE:
${formatTargetSlide(presentation, slideId)}

CURRENT SELECTED SPEECH:
Speech:
${currentSlide?.speech || ""}

Speaker tips:
${(currentSlide?.tips || []).map((tip) => `- ${tip}`).join("\n")}

FULL PRESENTATION:
${formatCurrentPresentation(presentation)}

CURRENT COMPLETE SPEECH:
${formatCurrentPitch(pitch)}

${buildContextBlock(project)}
`.trim();
};

module.exports = {
  buildPitchGenerationPrompt,
  buildPitchRefinementPrompt,
  buildPitchSlideGenerationPrompt,
  buildPitchSlideRefinementPrompt,
};
