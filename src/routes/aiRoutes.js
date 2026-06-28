const express = require("express");
const router = express.Router();
const { generateProblemStatement, refineProblemStatement } = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");

router.post("/problem-statement/generate", protect, generateProblemStatement);
router.post("/problem-statement/refine", protect, refineProblemStatement);

module.exports = router;
