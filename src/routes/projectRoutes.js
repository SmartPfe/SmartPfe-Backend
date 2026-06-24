const express = require("express");
const router = express.Router();
const { createProject, getMyProject } = require("../controllers/projectController");
const { protect } = require("../middleware/authMiddleware");

// All project routes require authentication
router.post("/onboarding", protect, createProject);
router.get("/my-project", protect, getMyProject);

module.exports = router;
