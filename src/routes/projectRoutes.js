const express = require("express");
const router = express.Router();
const { createProject, getMyProject, updateMyProject, updateProblemStatement } = require("../controllers/projectController");
const { protect } = require("../middleware/authMiddleware");

// All project routes require authentication
router.post("/onboarding", protect, createProject);
router.get("/my-project", protect, getMyProject);
router.put("/my-project", protect, updateMyProject);
router.patch("/problem-statement", protect, updateProblemStatement);

module.exports = router;
