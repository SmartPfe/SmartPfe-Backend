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

module.exports = router;
