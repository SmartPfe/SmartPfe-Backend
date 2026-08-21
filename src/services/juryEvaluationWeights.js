const FINAL_JURY_WEIGHTS = {
  presentationDelivery: 0.22,
  contentMastery: 0.2,
  technicalKnowledge: 0.18,
  qaPerformance: 0.2,
  clarity: 0.12,
  criticalThinking: 0.08,
};

const clampScore = (value) => {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
};

const average = (values = []) => {
  const safeValues = values.map(Number).filter(Number.isFinite);
  if (!safeValues.length) return 0;
  return safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length;
};

const readinessFromScore = (score) => {
  if (score >= 90) return "Highly Ready";
  if (score >= 78) return "Ready";
  if (score >= 65) return "Almost Ready";
  if (score >= 50) return "Needs More Practice";
  return "Not Ready";
};

const calculateFinalJuryScores = ({ defenseAnalysis = {}, questions = [] }) => {
  const qaEvaluations = questions.map((question) => question.evaluation || {}).filter(Boolean);
  const qaScores = qaEvaluations.map((evaluation) => evaluation.score);
  const qaDimension = (key) => average(qaEvaluations.map((evaluation) => evaluation.scores?.[key]));
  const defenseScores = defenseAnalysis.categoryScores || {};

  const categoryScores = {
    presentationDelivery: clampScore(average([defenseScores.delivery, defenseScores.timing])),
    contentMastery: clampScore(average([defenseScores.content, qaDimension("correctness"), qaDimension("relevance")])),
    technicalKnowledge: clampScore(average([qaDimension("depth"), qaDimension("correctness"), qaDimension("justification")])),
    qaPerformance: clampScore(average(qaScores)),
    clarity: clampScore(average([defenseScores.clarity, qaDimension("clarity")])),
    criticalThinking: clampScore(average([qaDimension("depth"), qaDimension("justification")])),
  };

  const overallScore = clampScore(
    Object.entries(FINAL_JURY_WEIGHTS).reduce(
      (sum, [key, weight]) => sum + clampScore(categoryScores[key]) * weight,
      0
    )
  );

  return {
    weights: FINAL_JURY_WEIGHTS,
    categoryScores,
    overallScore,
    readinessLevel: readinessFromScore(overallScore),
    readinessPercent: overallScore,
  };
};

module.exports = {
  FINAL_JURY_WEIGHTS,
  calculateFinalJuryScores,
  clampScore,
  average,
  readinessFromScore,
};
