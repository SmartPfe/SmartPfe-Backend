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
  getUmlPreparation: getUmlPreparationService,
  saveUmlPreparation: saveUmlPreparationService,
} = require("../services/umlPreparationService");

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

    const project = await Project.findOneAndUpdate(
      { user: req.user._id },
      { basics, description, technicalContext },
      { new: true, runValidators: true }
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found for this user" });
    }

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
    const { problemStatement } = req.body;

    if (problemStatement === undefined) {
      return res.status(400).json({ message: "Problem statement content is required" });
    }

    const project = await Project.findOneAndUpdate(
      { user: req.user._id },
      { $set: { "description.problemStatement": problemStatement } },
      { new: true, runValidators: true }
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found for this user" });
    }

    res.status(200).json({ 
      problemStatement: project.description.problemStatement,
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
    const { actors } = req.body;
    if (!Array.isArray(actors)) {
      return res.status(400).json({ message: "Actors must be an array" });
    }

    const savedActors = await saveActorsService(req.user._id, req.params.id, actors);
    res.status(200).json({ actors: savedActors });
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
    const { existingSolutions } = req.body;
    if (!Array.isArray(existingSolutions)) {
      return res.status(400).json({ message: "Existing solutions must be an array" });
    }

    const savedSolutions = await saveExistingSolutionsService(
      req.user._id,
      req.params.id,
      existingSolutions
    );
    res.status(200).json({ existingSolutions: savedSolutions });
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
    const { functionalRequirements } = req.body;
    if (!Array.isArray(functionalRequirements)) {
      return res.status(400).json({ message: "Functional requirements must be an array" });
    }

    const savedRequirements = await saveFunctionalRequirementsService(
      req.user._id,
      req.params.id,
      functionalRequirements
    );
    res.status(200).json({ functionalRequirements: savedRequirements });
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
    const { nonFunctionalRequirements } = req.body;
    if (!Array.isArray(nonFunctionalRequirements)) {
      return res.status(400).json({ message: "Non-functional requirements must be an array" });
    }

    const savedRequirements = await saveNonFunctionalRequirementsService(
      req.user._id,
      req.params.id,
      nonFunctionalRequirements
    );
    res.status(200).json({ nonFunctionalRequirements: savedRequirements });
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
    const { productBacklog } = req.body;
    if (!Array.isArray(productBacklog)) {
      return res.status(400).json({ message: "Product backlog must be an array" });
    }

    const savedBacklog = await saveProductBacklogService(
      req.user._id,
      req.params.id,
      productBacklog
    );
    res.status(200).json({ productBacklog: savedBacklog });
  } catch (error) {
    console.error("[project] updateProductBacklog error:", error.message);
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
    const { umlPreparation } = req.body;
    if (!umlPreparation || typeof umlPreparation !== "object") {
      return res.status(400).json({ message: "UML preparation must be an object" });
    }

    const savedPreparation = await saveUmlPreparationService(req.user._id, req.params.id, umlPreparation);
    res.status(200).json({ umlPreparation: savedPreparation });
  } catch (error) {
    console.error("[project] updateUmlPreparation error:", error.message);
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
  getUmlPreparation,
  updateUmlPreparation,
};
