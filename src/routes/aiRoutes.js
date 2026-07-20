const express = require("express");
const router = express.Router();
const {
  generateProblemStatement,
  refineProblemStatement,
  generateActors,
  refineActors,
  generateExistingSolutions,
  refineExistingSolutions,
  generateFunctionalRequirements,
  refineFunctionalRequirements,
  generateNonFunctionalRequirements,
  refineNonFunctionalRequirements,
  generateProductBacklog,
  refineProductBacklog,
  generateReportStructure,
  refineReportStructure,
  generateReportChapter,
  applyReportChapterAction,
  generateCompleteReport,
  generateUmlPreparation,
  refineUmlPreparation,
  generatePresentation,
  refinePresentation,
} = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");

router.post("/problem-statement/generate", protect, generateProblemStatement);
router.post("/problem-statement/refine", protect, refineProblemStatement);
router.post("/actors/generate", protect, generateActors);
router.post("/actors/refine", protect, refineActors);
router.post("/existing-solutions/generate", protect, generateExistingSolutions);
router.post("/existing-solutions/refine", protect, refineExistingSolutions);
router.post("/functional-requirements/generate", protect, generateFunctionalRequirements);
router.post("/functional-requirements/refine", protect, refineFunctionalRequirements);
router.post("/non-functional-requirements/generate", protect, generateNonFunctionalRequirements);
router.post("/non-functional-requirements/refine", protect, refineNonFunctionalRequirements);
router.post("/product-backlog/generate", protect, generateProductBacklog);
router.post("/product-backlog/refine", protect, refineProductBacklog);
router.post("/report-structure/generate", protect, generateReportStructure);
router.post("/report-structure/refine", protect, refineReportStructure);
router.post("/report-studio/chapter/generate", protect, generateReportChapter);
router.post("/report-studio/chapter/action", protect, applyReportChapterAction);
router.post("/report-studio/final/generate", protect, generateCompleteReport);
router.post("/uml-preparation/generate", protect, generateUmlPreparation);
router.post("/uml-preparation/refine", protect, refineUmlPreparation);
router.post("/presentation/generate", protect, generatePresentation);
router.post("/presentation/refine", protect, refinePresentation);

module.exports = router;
