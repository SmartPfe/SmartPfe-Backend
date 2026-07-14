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
  generateUmlPreparation,
  refineUmlPreparation,
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
router.post("/uml-preparation/generate", protect, generateUmlPreparation);
router.post("/uml-preparation/refine", protect, refineUmlPreparation);

module.exports = router;
