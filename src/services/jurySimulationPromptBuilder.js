const { formatContextString, getProjectContext } = require("./geminiService");

const formatPresentation = (presentation = {}) =>
  (presentation.slides || [])
    .map((slide, index) => [
      `Slide ${index + 1}: ${slide.title || "Untitled slide"}`,
      ...(Array.isArray(slide.bullets) && slide.bullets.length
        ? [`Bullets: ${slide.bullets.join(" | ")}`]
        : []),
      slide.notes ? `Speaker notes: ${slide.notes}` : null,
    ].filter(Boolean).join("\n"))
    .join("\n\n");

const formatPitch = (pitch = {}) =>
  (pitch.slides || [])
    .map((slide, index) => [
      `Slide ${index + 1}: ${slide.title || "Untitled slide"}`,
      `Expected seconds: ${Math.round(Number(slide.estimatedSeconds) || 0)}`,
      `Expected speech: ${slide.speech || ""}`,
      Array.isArray(slide.tips) && slide.tips.length ? `Delivery tips: ${slide.tips.join(" | ")}` : null,
    ].filter(Boolean).join("\n"))
    .join("\n\n");

const juryAssessmentJsonContract = `Return ONLY valid JSON. No markdown fences. No explanation.
{
  "overallScore": 0,
  "overallLabel": "Good defense",
  "categoryScores": {
    "delivery": 0,
    "clarity": 0,
    "content": 0,
    "timing": 0,
    "structure": 0
  },
  "timing": {
    "targetSeconds": 0,
    "actualSeconds": 0,
    "differenceSeconds": 0,
    "assessment": "Specific timing assessment"
  },
  "fillerWords": {
    "total": 0,
    "mostFrequent": ["um"],
    "examples": ["Short quoted examples if audible"]
  },
  "strengths": ["2 to 4 specific strengths"],
  "improvements": ["2 to 4 specific improvements"],
  "sectionFeedback": [
    {
      "slideNumber": 1,
      "slideTitle": "Slide title",
      "strengths": ["Specific good point"],
      "improvements": ["Specific next improvement"],
      "observations": ["Concrete observation comparing expected pitch to actual speech"]
    }
  ],
  "actionPlan": ["2 to 4 concise, highly specific actions for the next attempt"]
}`;

const buildJurySimulationAnalysisPrompt = ({
  project,
  presentation,
  pitch,
  targetSeconds,
  actualSeconds,
  objectiveMetrics,
}) => {
  const ctx = getProjectContext(project);
  const system = `
You are Smart PFE's AI Jury Simulation coach.

Analyze a student's real PFE defense recording by comparing:
1. What the student was supposed to present, based on the generated presentation.
2. What the student was supposed to say, based on the expected pitch per slide.
3. What the student actually said in the audio recording.

Be specific, calm, and actionable. Do not create a generic dashboard-style review.
Do not claim psychological certainty. Use wording like "sounded hesitant in this section" instead of "you were not confident".
Focus on speech, delivery, content alignment, academic defense quality, and timing.
Keep recommendations practical and limited so the student knows what to do next.
`.trim();

  const userText = `
PROJECT CONTEXT:
${formatContextString(ctx)}

TARGET DURATION:
${Math.round(targetSeconds)} seconds

RECORDED DURATION:
${Math.round(actualSeconds)} seconds

OBJECTIVE AUDIO METRICS:
${JSON.stringify(objectiveMetrics || {}, null, 2)}

PRESENTATION VERSION:
${presentation.version || 0}

PITCH VERSION:
${pitch.version || 0}

PRESENTATION:
${formatPresentation(presentation)}

EXPECTED PITCH:
${formatPitch(pitch)}

ASSESSMENT REQUIREMENTS:
- Compare skipped, rushed, over-explained, or deviated content against the expected pitch.
- Identify filler words, repeated words, hesitation indicators, long pauses, pacing issues, and rushed/slow sections when audible.
- Evaluate delivery clarity, pacing, pauses, monotony/variation, and engagement indicators without claiming objective emotional states.
- Evaluate academic structure, transitions, relevance, and conclusion effectiveness.
- Return slide-by-slide feedback aligned to the presentation slides.
- Keep strengths, improvements, and actionPlan short and high-value.

${juryAssessmentJsonContract}
`.trim();

  return { system, userText };
};

module.exports = {
  buildJurySimulationAnalysisPrompt,
};
