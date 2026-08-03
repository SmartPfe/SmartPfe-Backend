const Project = require("../models/Project");
const User = require("../models/User");
const { createNotification, createAdminNotification } = require("../services/notificationService");
const { getActors: getActorsService, saveActors: saveActorsService } = require("../services/actorService");
const {
  getExistingSolutions: getExistingSolutionsService,
  saveExistingSolutions: saveExistingSolutionsService,
} = require("../services/existingSolutionService");
const {
  getFunctionalRequirements: getFunctionalRequirementsService,
  saveFunctionalRequirements: saveFunctionalRequirementsService,
} = require("../services/functionalRequirementService");
const {
  getNonFunctionalRequirements: getNonFunctionalRequirementsService,
  saveNonFunctionalRequirements: saveNonFunctionalRequirementsService,
} = require("../services/nonFunctionalRequirementService");
const {
  getProductBacklog: getProductBacklogService,
  saveProductBacklog: saveProductBacklogService,
} = require("../services/productBacklogService");
const {
  getReportStructure: getReportStructureService,
  saveReportStructure: saveReportStructureService,
} = require("../services/reportStructureService");
const {
  getReportChapters: getReportChaptersService,
  saveReportChapters: saveReportChaptersService,
  saveFinalReport: saveFinalReportService,
} = require("../services/reportStudioService");
const {
  getUmlPreparation: getUmlPreparationService,
  saveUmlPreparation: saveUmlPreparationService,
} = require("../services/umlPreparationService");
const {
  getPresentation: getPresentationService,
  savePresentation: savePresentationService,
} = require("../services/presentationService");
const {
  getPitch: getPitchService,
  savePitch: savePitchService,
} = require("../services/pitchService");

// @desc    Create a new project from onboarding
// @route   POST /api/projects/onboarding
// @access  Private
const createProject = async (req, res) => {
  try {
    const { basics, description, technicalContext } = req.body;

    // Create the project
    const project = await Project.create({
      user: req.user._id,
      basics,
      description,
      technicalContext,
    });

    // Update the user's onboarding status
    const user = await User.findById(req.user._id);
    if (user) {
      user.hasCompletedOnboarding = true;
      await user.save();
    }

    await createNotification({
      user: req.user._id,
      title: "Project created",
      message: "Your PFE workspace has been created successfully.",
      type: "success",
    });

    await createAdminNotification({
      title: "New project created",
      message: `${user?.fullName || "A student"} created "${basics?.title || "Untitled Project"}".`,
      type: "success",
    });

    res.status(201).json(project);
  } catch (error) {
    console.error("[project] createProject error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get current user's project
// @route   GET /api/projects/my-project
// @access  Private
const getMyProject = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });

    if (!project) {
      return res.status(404).json({ message: "Project not found for this user" });
    }

    res.status(200).json(project);
  } catch (error) {
    console.error("[project] getMyProject error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update current user's project onboarding data
// @route   PUT /api/projects/my-project
// @access  Private
const updateMyProject = async (req, res) => {
  try {
    const { basics, description, technicalContext } = req.body;

    const currentProject = await Project.findOne({ user: req.user._id });

    if (!currentProject) {
      return res.status(404).json({ message: "Project not found for this user" });
    }

    const incomingProblemStatement = description?.problemStatement;
    const existingProblemStatement = currentProject.description?.problemStatement;
    const shouldPreserveProblemStatement =
      incomingProblemStatement === undefined ||
      (typeof incomingProblemStatement === "string" &&
        incomingProblemStatement.trim() === "" &&
        typeof existingProblemStatement === "string" &&
        existingProblemStatement.trim() !== "");

    const nextDescription = {
      ...description,
      problemStatement:
        shouldPreserveProblemStatement
          ? existingProblemStatement
          : incomingProblemStatement,
      problemStatementLanguage:
        description?.problemStatementLanguage
          ? description.problemStatementLanguage
          : currentProject.description?.problemStatementLanguage,
    };

    const project = await Project.findOneAndUpdate(
      { user: req.user._id },
      { basics, description: nextDescription, technicalContext },
      { new: true, runValidators: true }
    );

    await createNotification({
      user: req.user._id,
      title: "Project settings updated",
      message: "Your onboarding information has been saved.",
      type: "success",
    });

    res.status(200).json(project);
  } catch (error) {
    console.error("[project] updateMyProject error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update only the problem statement of the current user's project
// @route   PATCH /api/projects/problem-statement
// @access  Private
const updateProblemStatement = async (req, res) => {
  try {
    const { problemStatement, language } = req.body;

    if (problemStatement === undefined) {
      return res.status(400).json({ message: "Problem statement content is required" });
    }

    const updates = { "description.problemStatement": problemStatement };
    if (language !== undefined) {
      updates["description.problemStatementLanguage"] = language;
    }

    const project = await Project.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found for this user" });
    }

    res.status(200).json({ 
      problemStatement: project.description.problemStatement,
      language: project.description.problemStatementLanguage,
      updatedAt: project.updatedAt 
    });
  } catch (error) {
    console.error("[project] updateProblemStatement error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get actors for a project owned by the current user
// @route   GET /api/projects/:id/actors
// @access  Private
const getActors = async (req, res) => {
  try {
    const actors = await getActorsService(req.user._id, req.params.id);
    res.status(200).json({ actors });
  } catch (error) {
    console.error("[project] getActors error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Replace actors for a project owned by the current user
// @route   PUT /api/projects/:id/actors
// @access  Private
const updateActors = async (req, res) => {
  try {
    const { actors, language } = req.body;
    if (!Array.isArray(actors)) {
      return res.status(400).json({ message: "Actors must be an array" });
    }

    const saved = await saveActorsService(req.user._id, req.params.id, actors, language);
    res.status(200).json(saved);
  } catch (error) {
    console.error("[project] updateActors error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Get existing solutions for a project owned by the current user
// @route   GET /api/projects/:id/existing-solutions
// @access  Private
const getExistingSolutions = async (req, res) => {
  try {
    const existingSolutions = await getExistingSolutionsService(req.user._id, req.params.id);
    res.status(200).json({ existingSolutions });
  } catch (error) {
    console.error("[project] getExistingSolutions error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Replace existing solutions for a project owned by the current user
// @route   PUT /api/projects/:id/existing-solutions
// @access  Private
const updateExistingSolutions = async (req, res) => {
  try {
    const { existingSolutions, language } = req.body;
    if (!Array.isArray(existingSolutions)) {
      return res.status(400).json({ message: "Existing solutions must be an array" });
    }

    const saved = await saveExistingSolutionsService(
      req.user._id,
      req.params.id,
      existingSolutions,
      language
    );
    res.status(200).json(saved);
  } catch (error) {
    console.error("[project] updateExistingSolutions error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Get functional requirements for a project owned by the current user
// @route   GET /api/projects/:id/functional-requirements
// @access  Private
const getFunctionalRequirements = async (req, res) => {
  try {
    const functionalRequirements = await getFunctionalRequirementsService(req.user._id, req.params.id);
    res.status(200).json({ functionalRequirements });
  } catch (error) {
    console.error("[project] getFunctionalRequirements error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Replace functional requirements for a project owned by the current user
// @route   PUT /api/projects/:id/functional-requirements
// @access  Private
const updateFunctionalRequirements = async (req, res) => {
  try {
    const { functionalRequirements, language } = req.body;
    if (!Array.isArray(functionalRequirements)) {
      return res.status(400).json({ message: "Functional requirements must be an array" });
    }

    const saved = await saveFunctionalRequirementsService(
      req.user._id,
      req.params.id,
      functionalRequirements,
      language
    );
    res.status(200).json(saved);
  } catch (error) {
    console.error("[project] updateFunctionalRequirements error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Get non-functional requirements for a project owned by the current user
// @route   GET /api/projects/:id/non-functional-requirements
// @access  Private
const getNonFunctionalRequirements = async (req, res) => {
  try {
    const nonFunctionalRequirements = await getNonFunctionalRequirementsService(req.user._id, req.params.id);
    res.status(200).json({ nonFunctionalRequirements });
  } catch (error) {
    console.error("[project] getNonFunctionalRequirements error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Replace non-functional requirements for a project owned by the current user
// @route   PUT /api/projects/:id/non-functional-requirements
// @access  Private
const updateNonFunctionalRequirements = async (req, res) => {
  try {
    const { nonFunctionalRequirements, language } = req.body;
    if (!Array.isArray(nonFunctionalRequirements)) {
      return res.status(400).json({ message: "Non-functional requirements must be an array" });
    }

    const saved = await saveNonFunctionalRequirementsService(
      req.user._id,
      req.params.id,
      nonFunctionalRequirements,
      language
    );
    res.status(200).json(saved);
  } catch (error) {
    console.error("[project] updateNonFunctionalRequirements error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Get product backlog for a project owned by the current user
// @route   GET /api/projects/:id/product-backlog
// @access  Private
const getProductBacklog = async (req, res) => {
  try {
    const productBacklog = await getProductBacklogService(req.user._id, req.params.id);
    res.status(200).json({ productBacklog });
  } catch (error) {
    console.error("[project] getProductBacklog error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Replace product backlog for a project owned by the current user
// @route   PUT /api/projects/:id/product-backlog
// @access  Private
const updateProductBacklog = async (req, res) => {
  try {
    const { productBacklog, language } = req.body;
    if (!Array.isArray(productBacklog)) {
      return res.status(400).json({ message: "Product backlog must be an array" });
    }

    const saved = await saveProductBacklogService(
      req.user._id,
      req.params.id,
      productBacklog,
      language
    );
    res.status(200).json(saved);
  } catch (error) {
    console.error("[project] updateProductBacklog error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Get report structure for a project owned by the current user
// @route   GET /api/projects/:id/report-structure
// @access  Private
const getReportStructure = async (req, res) => {
  try {
    const reportStructure = await getReportStructureService(req.user._id, req.params.id);
    res.status(200).json({ reportStructure });
  } catch (error) {
    console.error("[project] getReportStructure error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Replace report structure for a project owned by the current user
// @route   PUT /api/projects/:id/report-structure
// @access  Private
const updateReportStructure = async (req, res) => {
  try {
    const { reportStructure, language } = req.body;
    if (!Array.isArray(reportStructure)) {
      return res.status(400).json({ message: "Report structure must be an array" });
    }

    const saved = await saveReportStructureService(
      req.user._id,
      req.params.id,
      reportStructure,
      language
    );
    res.status(200).json(saved);
  } catch (error) {
    console.error("[project] updateReportStructure error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Get report studio chapters for a project owned by the current user
// @route   GET /api/projects/:id/report-chapters
// @access  Private
const getReportChapters = async (req, res) => {
  try {
    const payload = await getReportChaptersService(req.user._id, req.params.id);
    res.status(200).json(payload);
  } catch (error) {
    console.error("[project] getReportChapters error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Replace report studio chapters for a project owned by the current user
// @route   PUT /api/projects/:id/report-chapters
// @access  Private
const updateReportChapters = async (req, res) => {
  try {
    const { reportChapters } = req.body;
    if (!Array.isArray(reportChapters)) {
      return res.status(400).json({ message: "Report chapters must be an array" });
    }

    const payload = await saveReportChaptersService(req.user._id, req.params.id, reportChapters);
    res.status(200).json(payload);
  } catch (error) {
    console.error("[project] updateReportChapters error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Save final generated report for a project owned by the current user
// @route   PUT /api/projects/:id/final-report
// @access  Private
const updateFinalReport = async (req, res) => {
  try {
    const { finalReport } = req.body;
    if (!finalReport || typeof finalReport !== "object") {
      return res.status(400).json({ message: "Final report must be an object" });
    }

    const savedFinalReport = await saveFinalReportService(req.user._id, req.params.id, finalReport);
    res.status(200).json({ finalReport: savedFinalReport });
  } catch (error) {
    console.error("[project] updateFinalReport error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Get UML preparation for a project owned by the current user
// @route   GET /api/projects/:id/uml-preparation
// @access  Private
const getUmlPreparation = async (req, res) => {
  try {
    const umlPreparation = await getUmlPreparationService(req.user._id, req.params.id);
    res.status(200).json({ umlPreparation });
  } catch (error) {
    console.error("[project] getUmlPreparation error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Replace UML preparation for a project owned by the current user
// @route   PUT /api/projects/:id/uml-preparation
// @access  Private
const updateUmlPreparation = async (req, res) => {
  try {
    const { umlPreparation, language } = req.body;
    if (!umlPreparation || typeof umlPreparation !== "object") {
      return res.status(400).json({ message: "UML preparation must be an object" });
    }

    const saved = await saveUmlPreparationService(req.user._id, req.params.id, umlPreparation, language);
    res.status(200).json(saved);
  } catch (error) {
    console.error("[project] updateUmlPreparation error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Get presentation for a project owned by the current user
// @route   GET /api/projects/:id/presentation
// @access  Private
const getPresentation = async (req, res) => {
  try {
    const presentation = await getPresentationService(req.user._id, req.params.id);
    res.status(200).json({ presentation });
  } catch (error) {
    console.error("[project] getPresentation error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Replace presentation for a project owned by the current user
// @route   PUT /api/projects/:id/presentation
// @access  Private
const updatePresentation = async (req, res) => {
  try {
    const { presentation } = req.body;
    if (!presentation || typeof presentation !== "object") {
      return res.status(400).json({ message: "Presentation must be an object" });
    }

    const savedPresentation = await savePresentationService(req.user._id, req.params.id, presentation);
    res.status(200).json({ presentation: savedPresentation });
  } catch (error) {
    console.error("[project] updatePresentation error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Get pitch for a project owned by the current user
// @route   GET /api/projects/:id/pitch
// @access  Private
const getPitch = async (req, res) => {
  try {
    const pitch = await getPitchService(req.user._id, req.params.id);
    res.status(200).json({ pitch });
  } catch (error) {
    console.error("[project] getPitch error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

// @desc    Replace pitch for a project owned by the current user
// @route   PUT /api/projects/:id/pitch
// @access  Private
const updatePitch = async (req, res) => {
  try {
    const { pitch } = req.body;
    if (!pitch || typeof pitch !== "object") {
      return res.status(400).json({ message: "Pitch must be an object" });
    }

    const savedPitch = await savePitchService(req.user._id, req.params.id, pitch);
    res.status(200).json({ pitch: savedPitch });
  } catch (error) {
    console.error("[project] updatePitch error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

module.exports = {
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
  getPitch,
  updatePitch,
};
