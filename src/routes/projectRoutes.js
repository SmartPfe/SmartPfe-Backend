const express = require("express");
const router = express.Router();
const { createProject, getMyProject, updateMyProject } = require("../controllers/projectController");
const { protect } = require("../middleware/authMiddleware");

// All project routes require authentication
router.post("/onboarding", protect, createProject);
router.get("/my-project", protect, getMyProject);
router.put("/my-project", protect, updateMyProject);

module.exports = router;
