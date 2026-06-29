const express = require("express");
const router = express.Router();
const {
  generateProblemStatement,
  refineProblemStatement,
  generateActors,
  refineActors,
} = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");

router.post("/problem-statement/generate", protect, generateProblemStatement);
router.post("/problem-statement/refine", protect, refineProblemStatement);
router.post("/actors/generate", protect, generateActors);
router.post("/actors/refine", protect, refineActors);

module.exports = router;
