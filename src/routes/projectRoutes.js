const express = require("express");
const router = express.Router();
const {
  createProject,
  getMyProject,
  updateMyProject,
  updateProblemStatement,
  getActors,
  updateActors,
  getExistingSolutions,
  updateExistingSolutions,
  getFunctionalRequirements,
  updateFunctionalRequirements,
} = require("../controllers/projectController");
const { protect } = require("../middleware/authMiddleware");

// All project routes require authentication
router.post("/onboarding", protect, createProject);
router.get("/my-project", protect, getMyProject);
router.put("/my-project", protect, updateMyProject);
router.patch("/problem-statement", protect, updateProblemStatement);
router.get("/:id/actors", protect, getActors);
router.put("/:id/actors", protect, updateActors);
router.get("/:id/existing-solutions", protect, getExistingSolutions);
router.put("/:id/existing-solutions", protect, updateExistingSolutions);
router.get("/:id/functional-requirements", protect, getFunctionalRequirements);
router.put("/:id/functional-requirements", protect, updateFunctionalRequirements);

module.exports = router;
