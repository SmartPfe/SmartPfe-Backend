const express = require("express");
const router = express.Router();
const {
  createProject,
  getMyProject,
  updateMyProject,
  updateProblemStatement,
  getActors,
  updateActors,
} = require("../controllers/projectController");
const { protect } = require("../middleware/authMiddleware");

// All project routes require authentication
router.post("/onboarding", protect, createProject);
router.get("/my-project", protect, getMyProject);
router.put("/my-project", protect, updateMyProject);
router.patch("/problem-statement", protect, updateProblemStatement);
router.get("/:id/actors", protect, getActors);
router.put("/:id/actors", protect, updateActors);

module.exports = router;
