const express = require("express");
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
} = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");

router.post("/problem-statement/generate", protect, generateProblemStatement);
router.post("/problem-statement/refine", protect, refineProblemStatement);
router.post("/problem-statement/translate", protect, translateProblemStatement);
router.post("/actors/generate", protect, generateActors);
router.post("/actors/refine", protect, refineActors);
router.post("/actors/translate", protect, translateActors);
router.post("/existing-solutions/generate", protect, generateExistingSolutions);
router.post("/existing-solutions/refine", protect, refineExistingSolutions);
router.post("/existing-solutions/translate", protect, translateExistingSolutions);
router.post("/functional-requirements/generate", protect, generateFunctionalRequirements);
router.post("/functional-requirements/refine", protect, refineFunctionalRequirements);
router.post("/functional-requirements/translate", protect, translateFunctionalRequirements);
router.post("/non-functional-requirements/generate", protect, generateNonFunctionalRequirements);
router.post("/non-functional-requirements/refine", protect, refineNonFunctionalRequirements);
router.post("/non-functional-requirements/translate", protect, translateNonFunctionalRequirements);
router.post("/product-backlog/generate", protect, generateProductBacklog);
router.post("/product-backlog/refine", protect, refineProductBacklog);
router.post("/product-backlog/translate", protect, translateProductBacklog);
router.post("/report-structure/generate", protect, generateReportStructure);
router.post("/report-structure/refine", protect, refineReportStructure);
router.post("/report-structure/translate", protect, translateReportStructure);
router.post("/report-studio/chapter/generate", protect, generateReportChapter);
router.post("/report-studio/chapter/action", protect, applyReportChapterAction);
router.post("/report-studio/final/generate", protect, generateCompleteReport);
router.post("/uml-preparation/generate", protect, generateUmlPreparation);
router.post("/uml-preparation/refine", protect, refineUmlPreparation);
router.post("/uml-preparation/translate", protect, translateUmlPreparation);
router.post("/presentation/generate", protect, generatePresentation);
router.post("/presentation/refine", protect, refinePresentation);
router.post("/presentation/translate", protect, translatePresentation);
router.post("/pitch/generate", protect, generatePitch);
router.post("/pitch/refine", protect, refinePitch);
router.post("/pitch/slide/generate", protect, generatePitchSlide);
router.post("/pitch/slide/refine", protect, refinePitchSlide);
router.post("/pitch/slide/translate", protect, translatePitchSlide);

module.exports = router;
