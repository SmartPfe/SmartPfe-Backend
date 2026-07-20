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
  getNonFunctionalRequirements,
  updateNonFunctionalRequirements,
  getProductBacklog,
  updateProductBacklog,
  getReportStructure,
  updateReportStructure,
  getReportChapters,
  updateReportChapters,
  updateFinalReport,
  getUmlPreparation,
  updateUmlPreparation,
  getPresentation,
  updatePresentation,
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
router.get("/:id/non-functional-requirements", protect, getNonFunctionalRequirements);
router.put("/:id/non-functional-requirements", protect, updateNonFunctionalRequirements);
router.get("/:id/product-backlog", protect, getProductBacklog);
router.put("/:id/product-backlog", protect, updateProductBacklog);
router.get("/:id/report-structure", protect, getReportStructure);
router.put("/:id/report-structure", protect, updateReportStructure);
router.get("/:id/report-chapters", protect, getReportChapters);
router.put("/:id/report-chapters", protect, updateReportChapters);
router.put("/:id/final-report", protect, updateFinalReport);
router.get("/:id/uml-preparation", protect, getUmlPreparation);
router.put("/:id/uml-preparation", protect, updateUmlPreparation);
router.get("/:id/presentation", protect, getPresentation);
router.put("/:id/presentation", protect, updatePresentation);

module.exports = router;
