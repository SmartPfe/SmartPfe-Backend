const Project = require("../models/Project");
const { withMessageMetadata, withErrorMessageMetadata } = require("../lib/interfaceMessages");
const User = require("../models/User");
const {
  createNotification,
  createAdminNotification,
  createGenerationNotification,
} = require("../services/notificationService");
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
const {
  getJurySimulation: getJurySimulationService,
} = require("../services/jurySimulationService");
const {
  getJuryQASessions: getJuryQASessionsService,
  getJuryQASession: getJuryQASessionService,
} = require("../services/juryQAService");

const createGenerationNotificationIfRequested = async (req, projectId) => {
  const feature = String(req.body?.generationFeature || "").trim();
  if (!feature || req.body?.notifyGenerationAfterSave !== true) return;

  await createGenerationNotification({
    userId: req.user._id,
    projectId,
    feature,
  });
};

// @desc    Create a new project from onboarding
// @route   POST /api/projects/onboarding
// @access  Private
const createProject = async (req, res) => {
  let claimedUser = null;
  let projectCreated = false;
  try {
    const { basics, description, technicalContext } = req.body;
    if (await Project.exists({ user: req.user._id })) {
      return res.status(409).json({ message: "Onboarding is already completed. Use project settings to edit your project." });
    }
    // Claim once atomically so concurrent submissions cannot create duplicate projects.
    claimedUser = await User.findOneAndUpdate(
      { _id: req.user._id, hasCompletedOnboarding: { $ne: true } },
      { $set: { hasCompletedOnboarding: true, workspaceTourStatus: "pending" } }, { new: true }
    );
    if (!claimedUser) return res.status(409).json({ message: "Onboarding is already completed." });

    // Create the project
    const project = await Project.create({
      user: req.user._id,
      basics,
      description,
      technicalContext,
    });
    projectCreated = true;

    // Update the user's onboarding status
    const user = claimedUser;

    await createNotification({
      user: req.user._id,
      title: "Project created",
      titleKey: "events.projectCreated.title",
      messageKey: "events.projectCreated.message",
      message: "Your PFE workspace has been created successfully.",
      type: "success",
    });

    await createAdminNotification({
      title: "New project created",
      titleKey: "events.newProjectCreated.title",
      messageKey: "events.newProjectCreated.message",
      messageParams: { name: user?.fullName || "A student", title: basics?.title || "Untitled Project", nameMissing: !user?.fullName, titleMissing: !basics?.title },
      message: `${user?.fullName || "A student"} created "${basics?.title || "Untitled Project"}".`,
      type: "success",
    });

    res.status(201).json(project);
  } catch (error) {
    if (claimedUser && !projectCreated) await User.updateOne({ _id: req.user._id }, { $set: { hasCompletedOnboarding: false }, $unset: { workspaceTourStatus: 1 } });
    console.error("[project] createProject error:", error.message);
    res.status(500).json(withMessageMetadata({ message: "Server error", error: error.message }, "common.serverError"));
  }
};

// @desc    Get current user's project
// @route   GET /api/projects/my-project
// @access  Private
const getMyProject = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });

    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user" }, "project.notFound"));
    }

    res.status(200).json(project);
  } catch (error) {
    console.error("[project] getMyProject error:", error.message);
    res.status(500).json(withMessageMetadata({ message: "Server error", error: error.message }, "common.serverError"));
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
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user" }, "project.notFound"));
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
      titleKey: "events.projectSettingsUpdated.title",
      messageKey: "events.projectSettingsUpdated.message",
      message: "Your onboarding information has been saved.",
      type: "success",
    });

    res.status(200).json(project);
  } catch (error) {
    console.error("[project] updateMyProject error:", error.message);
    res.status(500).json(withMessageMetadata({ message: "Server error", error: error.message }, "common.serverError"));
  }
};

// @desc    Update only the problem statement of the current user's project
// @route   PATCH /api/projects/problem-statement
// @access  Private
const updateProblemStatement = async (req, res) => {
  try {
    const { problemStatement, language } = req.body;

    if (problemStatement === undefined) {
      return res.status(400).json(withMessageMetadata({ message: "Problem statement content is required" }, "project.problemStatementRequired"));
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
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user" }, "project.notFound"));
    }

    await createGenerationNotificationIfRequested(req, project._id);

    res.status(200).json({ 
      problemStatement: project.description.problemStatement,
      language: project.description.problemStatementLanguage,
      updatedAt: project.updatedAt 
    });
  } catch (error) {
    console.error("[project] updateProblemStatement error:", error.message);
    res.status(500).json(withMessageMetadata({ message: "Server error", error: error.message }, "common.serverError"));
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
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
  }
};

// @desc    Replace actors for a project owned by the current user
// @route   PUT /api/projects/:id/actors
// @access  Private
const updateActors = async (req, res) => {
  try {
    const { actors, language } = req.body;
    if (!Array.isArray(actors)) {
      return res.status(400).json(withMessageMetadata({ message: "Actors must be an array" }, "project.actorsMustBeArray"));
    }

    const saved = await saveActorsService(req.user._id, req.params.id, actors, language);
    await createGenerationNotificationIfRequested(req, req.params.id);
    res.status(200).json(saved);
  } catch (error) {
    console.error("[project] updateActors error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
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
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
  }
};

// @desc    Replace existing solutions for a project owned by the current user
// @route   PUT /api/projects/:id/existing-solutions
// @access  Private
const updateExistingSolutions = async (req, res) => {
  try {
    const { existingSolutions, language } = req.body;
    if (!Array.isArray(existingSolutions)) {
      return res.status(400).json(withMessageMetadata({ message: "Existing solutions must be an array" }, "project.existingSolutionsMustBeArray"));
    }

    const saved = await saveExistingSolutionsService(
      req.user._id,
      req.params.id,
      existingSolutions,
      language
    );
    await createGenerationNotificationIfRequested(req, req.params.id);
    res.status(200).json(saved);
  } catch (error) {
    console.error("[project] updateExistingSolutions error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
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
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
  }
};

// @desc    Replace functional requirements for a project owned by the current user
// @route   PUT /api/projects/:id/functional-requirements
// @access  Private
const updateFunctionalRequirements = async (req, res) => {
  try {
    const { functionalRequirements, language } = req.body;
    if (!Array.isArray(functionalRequirements)) {
      return res.status(400).json(withMessageMetadata({ message: "Functional requirements must be an array" }, "project.functionalRequirementsMustBeArray"));
    }

    const saved = await saveFunctionalRequirementsService(
      req.user._id,
      req.params.id,
      functionalRequirements,
      language
    );
    await createGenerationNotificationIfRequested(req, req.params.id);
    res.status(200).json(saved);
  } catch (error) {
    console.error("[project] updateFunctionalRequirements error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
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
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
  }
};

// @desc    Replace non-functional requirements for a project owned by the current user
// @route   PUT /api/projects/:id/non-functional-requirements
// @access  Private
const updateNonFunctionalRequirements = async (req, res) => {
  try {
    const { nonFunctionalRequirements, language } = req.body;
    if (!Array.isArray(nonFunctionalRequirements)) {
      return res.status(400).json(withMessageMetadata({ message: "Non-functional requirements must be an array" }, "project.nonFunctionalRequirementsMustBeArray"));
    }

    const saved = await saveNonFunctionalRequirementsService(
      req.user._id,
      req.params.id,
      nonFunctionalRequirements,
      language
    );
    await createGenerationNotificationIfRequested(req, req.params.id);
    res.status(200).json(saved);
  } catch (error) {
    console.error("[project] updateNonFunctionalRequirements error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
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
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
  }
};

// @desc    Replace product backlog for a project owned by the current user
// @route   PUT /api/projects/:id/product-backlog
// @access  Private
const updateProductBacklog = async (req, res) => {
  try {
    const { productBacklog, language } = req.body;
    if (!Array.isArray(productBacklog)) {
      return res.status(400).json(withMessageMetadata({ message: "Product backlog must be an array" }, "project.productBacklogMustBeArray"));
    }

    const saved = await saveProductBacklogService(
      req.user._id,
      req.params.id,
      productBacklog,
      language
    );
    await createGenerationNotificationIfRequested(req, req.params.id);
    res.status(200).json(saved);
  } catch (error) {
    console.error("[project] updateProductBacklog error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
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
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
  }
};

// @desc    Replace report structure for a project owned by the current user
// @route   PUT /api/projects/:id/report-structure
// @access  Private
const updateReportStructure = async (req, res) => {
  try {
    const { reportStructure, language } = req.body;
    if (!Array.isArray(reportStructure)) {
      return res.status(400).json(withMessageMetadata({ message: "Report structure must be an array" }, "project.reportStructureMustBeArray"));
    }

    const saved = await saveReportStructureService(
      req.user._id,
      req.params.id,
      reportStructure,
      language
    );
    await createGenerationNotificationIfRequested(req, req.params.id);
    res.status(200).json(saved);
  } catch (error) {
    console.error("[project] updateReportStructure error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
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
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
  }
};

// @desc    Replace report studio chapters for a project owned by the current user
// @route   PUT /api/projects/:id/report-chapters
// @access  Private
const updateReportChapters = async (req, res) => {
  try {
    const { reportChapters } = req.body;
    if (!Array.isArray(reportChapters)) {
      return res.status(400).json(withMessageMetadata({ message: "Report chapters must be an array" }, "project.reportChaptersMustBeArray"));
    }

    const payload = await saveReportChaptersService(req.user._id, req.params.id, reportChapters);
    await createGenerationNotificationIfRequested(req, req.params.id);
    res.status(200).json(payload);
  } catch (error) {
    console.error("[project] updateReportChapters error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
  }
};

// @desc    Save final generated report for a project owned by the current user
// @route   PUT /api/projects/:id/final-report
// @access  Private
const updateFinalReport = async (req, res) => {
  try {
    const { finalReport } = req.body;
    if (!finalReport || typeof finalReport !== "object") {
      return res.status(400).json(withMessageMetadata({ message: "Final report must be an object" }, "project.finalReportMustBeObject"));
    }

    const savedFinalReport = await saveFinalReportService(req.user._id, req.params.id, finalReport);
    await createGenerationNotificationIfRequested(req, req.params.id);
    res.status(200).json({ finalReport: savedFinalReport });
  } catch (error) {
    console.error("[project] updateFinalReport error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
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
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
  }
};

// @desc    Replace UML preparation for a project owned by the current user
// @route   PUT /api/projects/:id/uml-preparation
// @access  Private
const updateUmlPreparation = async (req, res) => {
  try {
    const { umlPreparation, language } = req.body;
    if (!umlPreparation || typeof umlPreparation !== "object") {
      return res.status(400).json(withMessageMetadata({ message: "UML preparation must be an object" }, "project.umlPreparationMustBeObject"));
    }

    const saved = await saveUmlPreparationService(req.user._id, req.params.id, umlPreparation, language);
    await createGenerationNotificationIfRequested(req, req.params.id);
    res.status(200).json(saved);
  } catch (error) {
    console.error("[project] updateUmlPreparation error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
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
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
  }
};

// @desc    Replace presentation for a project owned by the current user
// @route   PUT /api/projects/:id/presentation
// @access  Private
const updatePresentation = async (req, res) => {
  try {
    const { presentation } = req.body;
    if (!presentation || typeof presentation !== "object") {
      return res.status(400).json(withMessageMetadata({ message: "Presentation must be an object" }, "project.presentationMustBeObject"));
    }

    const savedPresentation = await savePresentationService(req.user._id, req.params.id, presentation);
    await createGenerationNotificationIfRequested(req, req.params.id);
    res.status(200).json({ presentation: savedPresentation });
  } catch (error) {
    console.error("[project] updatePresentation error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
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
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
  }
};

// @desc    Replace pitch for a project owned by the current user
// @route   PUT /api/projects/:id/pitch
// @access  Private
const updatePitch = async (req, res) => {
  try {
    const { pitch } = req.body;
    if (!pitch || typeof pitch !== "object") {
      return res.status(400).json(withMessageMetadata({ message: "Pitch must be an object" }, "project.pitchMustBeObject"));
    }

    const savedPitch = await savePitchService(req.user._id, req.params.id, pitch);
    await createGenerationNotificationIfRequested(req, req.params.id);
    res.status(200).json({ pitch: savedPitch });
  } catch (error) {
    console.error("[project] updatePitch error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
  }
};

// @desc    Get jury simulation attempts for a project owned by the current user
// @route   GET /api/projects/:id/jury-simulation
// @access  Private
const getJurySimulation = async (req, res) => {
  try {
    const payload = await getJurySimulationService(req.user._id, req.params.id);
    res.status(200).json(payload);
  } catch (error) {
    console.error("[project] getJurySimulation error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Server error" }, error, "common.serverError"));
  }
};

// @desc    Get jury Q&A sessions for a project owned by the current user
// @route   GET /api/projects/:id/jury-qa
// @access  Private
const getJuryQASessions = async (req, res) => {
  try {
    const payload = await getJuryQASessionsService(req.user._id, req.params.id);
    res.status(200).json(payload);
  } catch (error) {
    console.error("[project] getJuryQASessions error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Failed to load jury Q&A sessions." }, error, "project.loadJurySessionsFailed"));
  }
};

// @desc    Get one jury Q&A session for a project owned by the current user
// @route   GET /api/projects/:id/jury-qa/:sessionId
// @access  Private
const getJuryQASession = async (req, res) => {
  try {
    const payload = await getJuryQASessionService(req.user._id, req.params.id, req.params.sessionId);
    res.status(200).json(payload);
  } catch (error) {
    console.error("[project] getJuryQASession error:", error.message);
    const status = error.message.includes("not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "Failed to load jury Q&A session." }, error, "project.loadJurySessionFailed"));
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
  getJurySimulation,
  getJuryQASessions,
  getJuryQASession,
};
