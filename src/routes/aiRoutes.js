const express = require("express");
const multer = require("multer");
const router = express.Router();
const {
  generateProblemStatement,
  refineProblemStatement,
  translateProblemStatement,
  generateActors,
  refineActors,
  translateActors,
  generateExistingSolutions,
  refineExistingSolutions,
  translateExistingSolutions,
  generateFunctionalRequirements,
  refineFunctionalRequirements,
  translateFunctionalRequirements,
  generateNonFunctionalRequirements,
  refineNonFunctionalRequirements,
  translateNonFunctionalRequirements,
  generateProductBacklog,
  refineProductBacklog,
  translateProductBacklog,
  generateReportStructure,
  refineReportStructure,
  translateReportStructure,
  generateReportChapter,
  generateReportChapterStream,
  applyReportChapterAction,
  generateCompleteReport,
  generateUmlPreparation,
  refineUmlPreparation,
  translateUmlPreparation,
  generatePresentation,
  refinePresentation,
  translatePresentation,
  generatePitch,
  refinePitch,
  generatePitchSlide,
  refinePitchSlide,
  translatePitchSlide,
  analyzeJurySimulation,
  generateJuryQA,
  answerJuryQAQuestion,
  finalizeJuryQA,
} = require("../controllers/aiController");
const { protect, studentOnly } = require("../middleware/authMiddleware");
router.use(protect, studentOnly);
const { creditGate } = require("../middleware/creditMiddleware");
const Project = require("../models/Project");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 40 * 1024 * 1024,
    files: 1,
  },
});
const { uploadCapacity, validateAudio, runAudio } = require("../middleware/audioGuard");

const traceReportStructureRequest = (req, res, next) => {
  console.info(`[ai-route][report-structure] ${req.method} ${req.originalUrl}`);
  next();
};

const contextualReportActions = new Set([
  "Expand",
  "Improve Academic Style",
  "Make More Technical",
  "Explain Better",
  "Continue Writing",
  "Regenerate Selection",
  "Rewrite Selection",
]);

const resolveReportAction = (req) => {
  if (req.body?.action === "Translate") return "translation";
  if (String(req.body?.selectedText || "").trim()) return "report_polish_light";
  return contextualReportActions.has(req.body?.action)
    ? "report_polish_contextual"
    : "report_polish_light";
};

const resolvePresentationRefine = (req) => req.body?.slideId ? "presentation_slide" : "presentation_full";

const resolveJuryQaStart = async (req) => {
  const existing = await Project.exists({
    _id: req.body?.projectId,
    user: req.user._id,
    "jurySimulation.qaSessions": {
      $elemMatch: {
        juryAttemptId: req.body?.juryAttemptId,
        status: { $in: ["generated", "in-progress", "completed"] },
      },
    },
  });
  return existing ? "jury_qa_included" : "jury_qa_session";
};

router.post("/problem-statement/generate", protect, creditGate("problem_statement"), generateProblemStatement);
router.post("/problem-statement/refine", protect, creditGate("problem_statement"), refineProblemStatement);
router.post("/problem-statement/translate", protect, creditGate("translation"), translateProblemStatement);
router.post("/actors/generate", protect, creditGate("actors"), generateActors);
router.post("/actors/refine", protect, creditGate("actors"), refineActors);
router.post("/actors/translate", protect, creditGate("translation"), translateActors);
router.post("/existing-solutions/generate", protect, creditGate("existing_solutions"), generateExistingSolutions);
router.post("/existing-solutions/refine", protect, creditGate("existing_solutions"), refineExistingSolutions);
router.post("/existing-solutions/translate", protect, creditGate("translation"), translateExistingSolutions);
router.post("/functional-requirements/generate", protect, creditGate("functional_requirements"), generateFunctionalRequirements);
router.post("/functional-requirements/refine", protect, creditGate("functional_requirements"), refineFunctionalRequirements);
router.post("/functional-requirements/translate", protect, creditGate("translation"), translateFunctionalRequirements);
router.post("/non-functional-requirements/generate", protect, creditGate("nonfunctional_requirements"), generateNonFunctionalRequirements);
router.post("/non-functional-requirements/refine", protect, creditGate("nonfunctional_requirements"), refineNonFunctionalRequirements);
router.post("/non-functional-requirements/translate", protect, creditGate("translation"), translateNonFunctionalRequirements);
router.post("/product-backlog/generate", protect, creditGate("product_backlog"), generateProductBacklog);
router.post("/product-backlog/refine", protect, creditGate("product_backlog"), refineProductBacklog);
router.post("/product-backlog/translate", protect, creditGate("translation"), translateProductBacklog);
router.post("/report-structure/generate", traceReportStructureRequest, protect, creditGate("report_structure"), generateReportStructure);
router.post("/report-structure/refine", traceReportStructureRequest, protect, creditGate("report_structure"), refineReportStructure);
router.post("/report-structure/translate", protect, creditGate("translation"), translateReportStructure);
router.post("/report-studio/chapter/generate", protect, creditGate("report_section"), generateReportChapter);
router.post("/report-studio/chapter/generate-stream", protect, creditGate("report_section", { manualSettlement: true }), generateReportChapterStream);
router.post("/report-studio/chapter/action", protect, creditGate(resolveReportAction), applyReportChapterAction);
router.post("/report-studio/final/generate", protect, creditGate("final_report_compile"), generateCompleteReport);
router.post("/uml-preparation/generate", protect, creditGate("uml_preparation"), generateUmlPreparation);
router.post("/uml-preparation/refine", protect, creditGate("uml_preparation"), refineUmlPreparation);
router.post("/uml-preparation/translate", protect, creditGate("translation"), translateUmlPreparation);
router.post("/presentation/generate", protect, creditGate("presentation_full"), generatePresentation);
router.post("/presentation/refine", protect, creditGate(resolvePresentationRefine), refinePresentation);
router.post("/presentation/translate", protect, creditGate("translation"), translatePresentation);
router.post("/pitch/generate", protect, creditGate("pitch_full"), generatePitch);
router.post("/pitch/refine", protect, creditGate("pitch_full"), refinePitch);
router.post("/pitch/slide/generate", protect, creditGate("pitch_slide"), generatePitchSlide);
router.post("/pitch/slide/refine", protect, creditGate("pitch_slide"), refinePitchSlide);
router.post("/pitch/slide/translate", protect, creditGate("translation"), translatePitchSlide);
router.post("/jury-simulation/analyze", protect, uploadCapacity, upload.single("audio"), validateAudio, creditGate("jury_simulation"), runAudio(analyzeJurySimulation));
router.post("/jury-qa/generate", protect, creditGate(resolveJuryQaStart), generateJuryQA);
router.post("/jury-qa/:sessionId/answer", protect, uploadCapacity, upload.single("audio"), validateAudio, creditGate("jury_qa_included"), runAudio(answerJuryQAQuestion));
router.post("/jury-qa/:sessionId/finalize", protect, creditGate("jury_qa_included"), finalizeJuryQA);

module.exports = router;
