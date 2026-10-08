const Project = require("../models/Project");
const { withMessageMetadata, withErrorMessageMetadata } = require("../lib/interfaceMessages");
const { callAI } = require("../services/geminiService");
const {
  generateActors: generateActorsService,
  refineActors: refineActorsService,
  translateActors: translateActorsService,
} = require("../services/actorService");
const {
  generateExistingSolutions: generateExistingSolutionsService,
  refineExistingSolutions: refineExistingSolutionsService,
  translateExistingSolutions: translateExistingSolutionsService,
} = require("../services/existingSolutionService");
const {
  generateFunctionalRequirements: generateFunctionalRequirementsService,
  refineFunctionalRequirements: refineFunctionalRequirementsService,
  translateFunctionalRequirements: translateFunctionalRequirementsService,
} = require("../services/functionalRequirementService");
const {
  generateNonFunctionalRequirements: generateNonFunctionalRequirementsService,
  refineNonFunctionalRequirements: refineNonFunctionalRequirementsService,
  translateNonFunctionalRequirements: translateNonFunctionalRequirementsService,
} = require("../services/nonFunctionalRequirementService");
const {
  generateProductBacklog: generateProductBacklogService,
  refineProductBacklog: refineProductBacklogService,
  translateProductBacklog: translateProductBacklogService,
} = require("../services/productBacklogService");
const {
  generateReportStructure: generateReportStructureService,
  refineReportStructure: refineReportStructureService,
  translateReportStructure: translateReportStructureService,
} = require("../services/reportStructureService");
const {
  generateChapter: generateReportChapterService,
  generateChapterStream: generateReportChapterStreamService,
  applyChapterAction: applyReportChapterActionService,
  generateCompleteReport: generateCompleteReportService,
  saveFinalReport: saveFinalReportService,
} = require("../services/reportStudioService");
const {
  generateUmlPreparation: generateUmlPreparationService,
  refineUmlPreparation: refineUmlPreparationService,
  translateUmlPreparation: translateUmlPreparationService,
} = require("../services/umlPreparationService");
const {
  generatePresentation: generatePresentationService,
  refinePresentation: refinePresentationService,
  translatePresentationSlide: translatePresentationSlideService,
} = require("../services/presentationService");
const {
  generatePitch: generatePitchService,
  refinePitch: refinePitchService,
  generatePitchSlide: generatePitchSlideService,
  refinePitchSlide: refinePitchSlideService,
  translatePitchSlide: translatePitchSlideService,
} = require("../services/pitchService");
const {
  analyzeJurySimulation: analyzeJurySimulationService,
} = require("../services/jurySimulationService");
const {
  generateJuryQA: generateJuryQAService,
  answerJuryQAQuestion: answerJuryQAQuestionService,
  finalizeJuryQA: finalizeJuryQAService,
} = require("../services/juryQAService");
const { createGenerationNotification } = require("../services/notificationService");

const notifyGenerationComplete = async (req, project, feature) => {
  await createGenerationNotification({
    userId: req.user._id,
    projectId: project._id,
    feature,
  });
};

// @desc    Generate a first draft of the problem statement using AI
// @route   POST /api/ai/problem-statement/generate
// @access  Private
const generateProblemStatement = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const suggestion = await callAI("generate", project);
    await notifyGenerationComplete(req, project, "problemStatement");
    res.status(200).json({ suggestion });
  } catch (error) {
    console.error("[ai] generate error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI generation failed." }, error, "ai.generationFailed"));
  }
};

// @desc    Refine the current problem statement using AI
// @route   POST /api/ai/problem-statement/refine
// @access  Private
const refineProblemStatement = async (req, res) => {
  try {
    const { current, instructions } = req.body;
    if (!current || current.trim() === "") {
      return res.status(400).json(withMessageMetadata({ message: "Current text is required to refine." }, "ai.currentTextRequiredToRefine"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const suggestion = await callAI("refine", project, current, { instructions });
    res.status(200).json({ suggestion });
  } catch (error) {
    console.error("[ai] refine error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI refinement failed." }, error, "ai.refinementFailed"));
  }
};

// @desc    Translate the current problem statement using AI
// @route   POST /api/ai/problem-statement/translate
// @access  Private
const translateProblemStatement = async (req, res) => {
  try {
    const { current } = req.body;
    if (!current || current.trim() === "") {
      return res.status(400).json(withMessageMetadata({ message: "Current text is required to translate." }, "ai.currentTextRequiredToTranslate"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const suggestion = await callAI("translate", project, current);
    res.status(200).json({ suggestion });
  } catch (error) {
    console.error("[ai] translate error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI translation failed." }, error, "ai.translationFailed"));
  }
};

// @desc    Generate actors and stakeholders using AI
// @route   POST /api/ai/actors/generate
// @access  Private
const generateActors = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const actors = await generateActorsService(project);
    await notifyGenerationComplete(req, project, "actors");
    res.status(200).json({ actors });
  } catch (error) {
    console.error("[ai] generate actors error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI actor generation failed." }, error, "ai.actorGenerationFailed"));
  }
};

// @desc    Refine actors and stakeholders using AI
// @route   POST /api/ai/actors/refine
// @access  Private
const refineActors = async (req, res) => {
  try {
    const { actors, instructions } = req.body;
    if (!Array.isArray(actors) || actors.length === 0) {
      return res.status(400).json(withMessageMetadata({ message: "Current actors are required to refine." }, "ai.currentActorsRequiredToRefine"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const refinedActors = await refineActorsService(project, actors, instructions);
    res.status(200).json({ actors: refinedActors });
  } catch (error) {
    console.error("[ai] refine actors error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI actor refinement failed." }, error, "ai.actorRefinementFailed"));
  }
};

// @desc    Translate actors and stakeholders using AI
// @route   POST /api/ai/actors/translate
// @access  Private
const translateActors = async (req, res) => {
  try {
    const { actors } = req.body;
    if (!Array.isArray(actors) || actors.length === 0) {
      return res.status(400).json(withMessageMetadata({ message: "Current actors are required to translate." }, "ai.currentActorsRequiredToTranslate"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const translatedActors = await translateActorsService(project, actors);
    res.status(200).json({ actors: translatedActors });
  } catch (error) {
    console.error("[ai] translate actors error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI actor translation failed." }, error, "ai.actorTranslationFailed"));
  }
};

// @desc    Generate existing solutions using AI
// @route   POST /api/ai/existing-solutions/generate
// @access  Private
const generateExistingSolutions = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const existingSolutions = await generateExistingSolutionsService(project);
    await notifyGenerationComplete(req, project, "existingSolutions");
    res.status(200).json({ existingSolutions });
  } catch (error) {
    console.error("[ai] generate existing solutions error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI existing solution generation failed." }, error, "ai.existingSolutionGenerationFailed"));
  }
};

// @desc    Refine existing solutions using AI
// @route   POST /api/ai/existing-solutions/refine
// @access  Private
const refineExistingSolutions = async (req, res) => {
  try {
    const { existingSolutions, instructions } = req.body;
    if (!Array.isArray(existingSolutions) || existingSolutions.length === 0) {
      return res.status(400).json(withMessageMetadata({ message: "Current existing solutions are required to refine." }, "ai.currentSolutionsRequiredToRefine"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const refinedSolutions = await refineExistingSolutionsService(project, existingSolutions, instructions);
    res.status(200).json({ existingSolutions: refinedSolutions });
  } catch (error) {
    console.error("[ai] refine existing solutions error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI existing solution refinement failed." }, error, "ai.existingSolutionRefinementFailed"));
  }
};

// @desc    Translate existing solutions using AI
// @route   POST /api/ai/existing-solutions/translate
// @access  Private
const translateExistingSolutions = async (req, res) => {
  try {
    const { existingSolutions } = req.body;
    if (!Array.isArray(existingSolutions) || existingSolutions.length === 0) {
      return res.status(400).json(withMessageMetadata({ message: "Current existing solutions are required to translate." }, "ai.currentSolutionsRequiredToTranslate"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const translatedSolutions = await translateExistingSolutionsService(project, existingSolutions);
    res.status(200).json({ existingSolutions: translatedSolutions });
  } catch (error) {
    console.error("[ai] translate existing solutions error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI existing solution translation failed." }, error, "ai.existingSolutionTranslationFailed"));
  }
};

// @desc    Generate functional requirements using AI
// @route   POST /api/ai/functional-requirements/generate
// @access  Private
const generateFunctionalRequirements = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const functionalRequirements = await generateFunctionalRequirementsService(project);
    await notifyGenerationComplete(req, project, "functionalRequirements");
    res.status(200).json({ functionalRequirements });
  } catch (error) {
    console.error("[ai] generate functional requirements error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI functional requirement generation failed." }, error, "ai.functionalRequirementGenerationFailed"));
  }
};

// @desc    Refine functional requirements using AI
// @route   POST /api/ai/functional-requirements/refine
// @access  Private
const refineFunctionalRequirements = async (req, res) => {
  try {
    const { functionalRequirements, instructions } = req.body;
    if (!Array.isArray(functionalRequirements) || functionalRequirements.length === 0) {
      return res.status(400).json(withMessageMetadata({ message: "Current functional requirements are required to refine." }, "ai.currentFunctionalRequirementsRequiredToRefine"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const refinedRequirements = await refineFunctionalRequirementsService(project, functionalRequirements, instructions);
    res.status(200).json({ functionalRequirements: refinedRequirements });
  } catch (error) {
    console.error("[ai] refine functional requirements error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI functional requirement refinement failed." }, error, "ai.functionalRequirementRefinementFailed"));
  }
};

// @desc    Translate functional requirements using AI
// @route   POST /api/ai/functional-requirements/translate
// @access  Private
const translateFunctionalRequirements = async (req, res) => {
  try {
    const { functionalRequirements } = req.body;
    if (!Array.isArray(functionalRequirements) || functionalRequirements.length === 0) {
      return res.status(400).json(withMessageMetadata({ message: "Current functional requirements are required to translate." }, "ai.currentFunctionalRequirementsRequiredToTranslate"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const translatedRequirements = await translateFunctionalRequirementsService(project, functionalRequirements);
    res.status(200).json({ functionalRequirements: translatedRequirements });
  } catch (error) {
    console.error("[ai] translate functional requirements error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI functional requirement translation failed." }, error, "ai.functionalRequirementTranslationFailed"));
  }
};

// @desc    Generate non-functional requirements using AI
// @route   POST /api/ai/non-functional-requirements/generate
// @access  Private
const generateNonFunctionalRequirements = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const nonFunctionalRequirements = await generateNonFunctionalRequirementsService(project);
    await notifyGenerationComplete(req, project, "nonFunctionalRequirements");
    res.status(200).json({ nonFunctionalRequirements });
  } catch (error) {
    console.error("[ai] generate non-functional requirements error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI non-functional requirement generation failed." }, error, "ai.nonFunctionalRequirementGenerationFailed"));
  }
};

// @desc    Refine non-functional requirements using AI
// @route   POST /api/ai/non-functional-requirements/refine
// @access  Private
const refineNonFunctionalRequirements = async (req, res) => {
  try {
    const { nonFunctionalRequirements, instructions } = req.body;
    if (!Array.isArray(nonFunctionalRequirements) || nonFunctionalRequirements.length === 0) {
      return res.status(400).json(withMessageMetadata({ message: "Current non-functional requirements are required to refine." }, "ai.currentNonFunctionalRequirementsRequiredToRefine"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const refinedRequirements = await refineNonFunctionalRequirementsService(project, nonFunctionalRequirements, instructions);
    res.status(200).json({ nonFunctionalRequirements: refinedRequirements });
  } catch (error) {
    console.error("[ai] refine non-functional requirements error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI non-functional requirement refinement failed." }, error, "ai.nonFunctionalRequirementRefinementFailed"));
  }
};

// @desc    Translate non-functional requirements using AI
// @route   POST /api/ai/non-functional-requirements/translate
// @access  Private
const translateNonFunctionalRequirements = async (req, res) => {
  try {
    const { nonFunctionalRequirements } = req.body;
    if (!Array.isArray(nonFunctionalRequirements) || nonFunctionalRequirements.length === 0) {
      return res.status(400).json(withMessageMetadata({ message: "Current non-functional requirements are required to translate." }, "ai.currentNonFunctionalRequirementsRequiredToTranslate"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const translatedRequirements = await translateNonFunctionalRequirementsService(project, nonFunctionalRequirements);
    res.status(200).json({ nonFunctionalRequirements: translatedRequirements });
  } catch (error) {
    console.error("[ai] translate non-functional requirements error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI non-functional requirement translation failed." }, error, "ai.nonFunctionalRequirementTranslationFailed"));
  }
};

// @desc    Generate product backlog using AI
// @route   POST /api/ai/product-backlog/generate
// @access  Private
const generateProductBacklog = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const productBacklog = await generateProductBacklogService(project);
    await notifyGenerationComplete(req, project, "productBacklog");
    res.status(200).json({ productBacklog });
  } catch (error) {
    console.error("[ai] generate product backlog error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI product backlog generation failed." }, error, "ai.productBacklogGenerationFailed"));
  }
};

// @desc    Refine product backlog using AI
// @route   POST /api/ai/product-backlog/refine
// @access  Private
const refineProductBacklog = async (req, res) => {
  try {
    const { productBacklog, instructions } = req.body;
    if (!Array.isArray(productBacklog) || productBacklog.length === 0) {
      return res.status(400).json(withMessageMetadata({ message: "Current product backlog is required to refine." }, "ai.currentProductBacklogRequiredToRefine"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const refinedBacklog = await refineProductBacklogService(project, productBacklog, instructions);
    res.status(200).json({ productBacklog: refinedBacklog });
  } catch (error) {
    console.error("[ai] refine product backlog error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI product backlog refinement failed." }, error, "ai.productBacklogRefinementFailed"));
  }
};

// @desc    Translate product backlog using AI
// @route   POST /api/ai/product-backlog/translate
// @access  Private
const translateProductBacklog = async (req, res) => {
  try {
    const { productBacklog } = req.body;
    if (!Array.isArray(productBacklog) || productBacklog.length === 0) {
      return res.status(400).json(withMessageMetadata({ message: "Current product backlog is required to translate." }, "ai.currentProductBacklogRequiredToTranslate"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const translatedBacklog = await translateProductBacklogService(project, productBacklog);
    res.status(200).json({ productBacklog: translatedBacklog });
  } catch (error) {
    console.error("[ai] translate product backlog error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI product backlog translation failed." }, error, "ai.productBacklogTranslationFailed"));
  }
};

// @desc    Generate report structure using AI
// @route   POST /api/ai/report-structure/generate
// @access  Private
const generateReportStructure = async (req, res) => {
  try {
    console.info(`[ai][report-structure][generate] Request received. user=${req.user?._id || "unknown"}`);
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      console.warn(`[ai][report-structure][generate] No project found. user=${req.user?._id || "unknown"}`);
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    console.info(
      `[ai][report-structure][generate] Project loaded. project=${project._id} title="${project.basics?.title || "Untitled"}"`
    );
    const reportStructure = await generateReportStructureService(project);
    console.info(`[ai][report-structure][generate] Response ready. sections=${reportStructure.length}`);
    await notifyGenerationComplete(req, project, "reportStructure");
    res.status(200).json({ reportStructure });
  } catch (error) {
    console.error("[ai] generate report structure error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI report structure generation failed." }, error, "ai.reportStructureGenerationFailed"));
  }
};

// @desc    Refine report structure using AI
// @route   POST /api/ai/report-structure/refine
// @access  Private
const refineReportStructure = async (req, res) => {
  try {
    console.info(`[ai][report-structure][refine] Request received. user=${req.user?._id || "unknown"}`);
    const { reportStructure, instructions } = req.body;
    if (!Array.isArray(reportStructure) || reportStructure.length === 0) {
      console.warn("[ai][report-structure][refine] Rejected: current report structure is missing.");
      return res.status(400).json(withMessageMetadata({ message: "Current report structure is required to refine." }, "ai.currentReportStructureRequiredToRefine"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      console.warn(`[ai][report-structure][refine] No project found. user=${req.user?._id || "unknown"}`);
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    console.info(
      `[ai][report-structure][refine] Project loaded. project=${project._id} currentSections=${reportStructure.length} hasInstructions=${Boolean(String(instructions || "").trim())}`
    );
    const refinedStructure = await refineReportStructureService(project, reportStructure, instructions);
    console.info(`[ai][report-structure][refine] Response ready. sections=${refinedStructure.length}`);
    res.status(200).json({ reportStructure: refinedStructure });
  } catch (error) {
    console.error("[ai] refine report structure error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI report structure refinement failed." }, error, "ai.reportStructureRefinementFailed"));
  }
};

// @desc    Translate the current report structure using AI
// @route   POST /api/ai/report-structure/translate
// @access  Private
const translateReportStructure = async (req, res) => {
  try {
    const { reportStructure } = req.body;
    if (!Array.isArray(reportStructure) || reportStructure.length === 0) {
      return res.status(400).json(withMessageMetadata({ message: "Current report structure is required to translate." }, "ai.currentReportStructureRequiredToTranslate"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const translatedStructure = await translateReportStructureService(project, reportStructure);
    res.status(200).json({ reportStructure: translatedStructure });
  } catch (error) {
    console.error("[ai] translate report structure error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI report structure translation failed." }, error, "ai.reportStructureTranslationFailed"));
  }
};

// @desc    Generate one report chapter using AI
// @route   POST /api/ai/report-studio/chapter/generate
// @access  Private
const generateReportChapter = async (req, res) => {
  try {
    const { sectionId, detailLevel = "standard", reportChapters = [] } = req.body;
    if (!sectionId) {
      return res.status(400).json(withMessageMetadata({ message: "Section id is required." }, "ai.sectionIdRequired"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const chapter = await generateReportChapterService(project, sectionId, detailLevel, reportChapters);
    await notifyGenerationComplete(req, project, "reportBuilder");
    res.status(200).json({ chapter });
  } catch (error) {
    console.error("[ai] generate report chapter error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI report chapter generation failed." }, error, "ai.reportChapterGenerationFailed"));
  }
};

// @desc    Generate one report chapter using AI with SSE Streaming
// @route   POST /api/ai/report-studio/chapter/generate-stream
// @access  Private
const generateReportChapterStream = async (req, res) => {
  try {
    const { sectionId, detailLevel = "standard", reportChapters = [] } = req.body;
    if (!sectionId) {
      return res.status(400).json(withMessageMetadata({ message: "Section id is required." }, "ai.sectionIdRequired"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    await generateReportChapterStreamService(project, sectionId, detailLevel, reportChapters, res, req);
  } catch (error) {
    console.error("[ai] generate report chapter stream error:", error.message);
    if (!res.headersSent) {
      res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI streaming chapter generation failed." }, error, "ai.streamingChapterGenerationFailed"));
    }
  }
};

// @desc    Apply an AI writing action to one report chapter
// @route   POST /api/ai/report-studio/chapter/action
// @access  Private
const applyReportChapterAction = async (req, res) => {
  try {
    const { sectionId, action, currentContent, selectedText = "", reportChapters = [], instructions = "" } = req.body;
    if (!sectionId || !action || !currentContent) {
      return res.status(400).json(withMessageMetadata({ message: "Section id, action, and current content are required." }, "ai.sectionActionAndContentRequired"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const chapter = await applyReportChapterActionService(
      project,
      sectionId,
      action,
      currentContent,
      selectedText,
      reportChapters,
      instructions
    );
    res.status(200).json({ chapter });
  } catch (error) {
    console.error("[ai] apply report chapter action error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI report chapter action failed." }, error, "ai.reportChapterActionFailed"));
  }
};

// @desc    Generate the polished complete report using AI
// @route   POST /api/ai/report-studio/final/generate
// @access  Private
const generateCompleteReport = async (req, res) => {
  try {
    const { reportChapters = [] } = req.body;
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const finalReport = await generateCompleteReportService(project, reportChapters);
    const savedFinalReport = await saveFinalReportService(req.user._id, project._id, finalReport);
    await createGenerationNotification({
      userId: req.user._id,
      projectId: project._id,
      feature: "completeReport",
    });
    res.status(200).json({ finalReport: savedFinalReport });
  } catch (error) {
    console.error("[ai] generate complete report error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI final report generation failed." }, error, "ai.finalReportGenerationFailed"));
  }
};

// @desc    Generate UML preparation using AI
// @route   POST /api/ai/uml-preparation/generate
// @access  Private
const generateUmlPreparation = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const { diagramType, currentUmlPreparation } = req.body || {};
    const umlPreparation = await generateUmlPreparationService(project, diagramType, currentUmlPreparation);
    await notifyGenerationComplete(req, project, "umlPreparation");
    res.status(200).json({ umlPreparation });
  } catch (error) {
    console.error("[ai] generate UML preparation error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI UML preparation generation failed." }, error, "ai.umlPreparationGenerationFailed"));
  }
};

// @desc    Refine UML preparation using AI
// @route   POST /api/ai/uml-preparation/refine
// @access  Private
const refineUmlPreparation = async (req, res) => {
  try {
    const { umlPreparation, instructions, diagramType } = req.body;
    if (!umlPreparation) {
      return res.status(400).json(withMessageMetadata({ message: "Current UML preparation is required to refine." }, "ai.currentUmlPreparationRequiredToRefine"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const refinedPreparation = await refineUmlPreparationService(project, umlPreparation, instructions, diagramType);
    res.status(200).json({ umlPreparation: refinedPreparation });
  } catch (error) {
    console.error("[ai] refine UML preparation error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI UML preparation refinement failed." }, error, "ai.umlPreparationRefinementFailed"));
  }
};

// @desc    Translate UML preparation using AI
// @route   POST /api/ai/uml-preparation/translate
// @access  Private
const translateUmlPreparation = async (req, res) => {
  try {
    const { umlPreparation } = req.body;
    if (!umlPreparation || !Array.isArray(umlPreparation.classes) || umlPreparation.classes.length === 0) {
      return res.status(400).json(withMessageMetadata({ message: "Current UML preparation is required to translate." }, "ai.currentUmlPreparationRequiredToTranslate"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const translatedPreparation = await translateUmlPreparationService(project, umlPreparation);
    res.status(200).json({ umlPreparation: translatedPreparation });
  } catch (error) {
    console.error("[ai] translate UML preparation error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI UML preparation translation failed." }, error, "ai.umlPreparationTranslationFailed"));
  }
};

// @desc    Generate a PFE defense presentation using AI
// @route   POST /api/ai/presentation/generate
// @access  Private
const generatePresentation = async (req, res) => {
  try {
    const { durationMinutes = 10 } = req.body;
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const presentation = await generatePresentationService(project, durationMinutes);
    await notifyGenerationComplete(req, project, "presentation");
    res.status(200).json({ presentation });
  } catch (error) {
    console.error("[ai] generate presentation error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI presentation generation failed." }, error, "ai.presentationGenerationFailed"));
  }
};

// @desc    Refine a PFE defense presentation using AI
// @route   POST /api/ai/presentation/refine
// @access  Private
const refinePresentation = async (req, res) => {
  try {
    const { presentation, instructions = "", slideId = "" } = req.body;
    if (!presentation || !Array.isArray(presentation.slides) || presentation.slides.length === 0) {
      return res.status(400).json(withMessageMetadata({ message: "Current presentation is required to refine." }, "ai.currentPresentationRequiredToRefine"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const refinedPresentation = await refinePresentationService(project, presentation, instructions, slideId);
    res.status(200).json({ presentation: refinedPresentation });
  } catch (error) {
    console.error("[ai] refine presentation error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI presentation refinement failed." }, error, "ai.presentationRefinementFailed"));
  }
};

// @desc    Translate one PFE defense presentation slide using AI
// @route   POST /api/ai/presentation/translate
// @access  Private
const translatePresentation = async (req, res) => {
  try {
    const { presentation, slideId } = req.body;
    if (!presentation || !Array.isArray(presentation.slides) || presentation.slides.length === 0 || !slideId) {
      return res.status(400).json(withMessageMetadata({ message: "Current presentation and slide id are required to translate." }, "ai.currentPresentationAndSlideIdRequiredToTranslate"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const translatedPresentation = await translatePresentationSlideService(project, presentation, slideId);
    res.status(200).json({ presentation: translatedPresentation });
  } catch (error) {
    console.error("[ai] translate presentation error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI presentation translation failed." }, error, "ai.presentationTranslationFailed"));
  }
};

// @desc    Generate a complete PFE defense speech from the generated presentation
// @route   POST /api/ai/pitch/generate
// @access  Private
const generatePitch = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const pitch = await generatePitchService(project);
    await notifyGenerationComplete(req, project, "pitch");
    res.status(200).json({ pitch });
  } catch (error) {
    console.error("[ai] generate pitch error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI pitch generation failed." }, error, "ai.pitchGenerationFailed"));
  }
};

// @desc    Refine a complete PFE defense speech
// @route   POST /api/ai/pitch/refine
// @access  Private
const refinePitch = async (req, res) => {
  try {
    const { pitch, instructions = "" } = req.body;
    if (!pitch || !Array.isArray(pitch.slides) || pitch.slides.length === 0) {
      return res.status(400).json(withMessageMetadata({ message: "Current pitch is required to refine." }, "ai.currentPitchRequiredToRefine"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const refinedPitch = await refinePitchService(project, pitch, instructions);
    res.status(200).json({ pitch: refinedPitch });
  } catch (error) {
    console.error("[ai] refine pitch error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI pitch refinement failed." }, error, "ai.pitchRefinementFailed"));
  }
};

// @desc    Generate speech for one presentation slide
// @route   POST /api/ai/pitch/slide/generate
// @access  Private
const generatePitchSlide = async (req, res) => {
  try {
    const { pitch, slideId } = req.body;
    if (!slideId) {
      return res.status(400).json(withMessageMetadata({ message: "Slide id is required." }, "ai.slideIdRequired"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const nextPitch = await generatePitchSlideService(project, pitch || {}, slideId);
    await notifyGenerationComplete(req, project, "pitchSlide");
    res.status(200).json({ pitch: nextPitch });
  } catch (error) {
    console.error("[ai] generate pitch slide error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI slide speech generation failed." }, error, "ai.slideSpeechGenerationFailed"));
  }
};

// @desc    Refine speech for one presentation slide
// @route   POST /api/ai/pitch/slide/refine
// @access  Private
const refinePitchSlide = async (req, res) => {
  try {
    const { pitch, slideId, instructions = "" } = req.body;
    if (!pitch || !Array.isArray(pitch.slides) || pitch.slides.length === 0 || !slideId) {
      return res.status(400).json(withMessageMetadata({ message: "Current pitch and slide id are required to refine." }, "ai.currentPitchAndSlideIdRequiredToRefine"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const nextPitch = await refinePitchSlideService(project, pitch, slideId, instructions);
    res.status(200).json({ pitch: nextPitch });
  } catch (error) {
    console.error("[ai] refine pitch slide error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI slide speech refinement failed." }, error, "ai.slideSpeechRefinementFailed"));
  }
};

// @desc    Translate speech for one presentation slide
// @route   POST /api/ai/pitch/slide/translate
// @access  Private
const translatePitchSlide = async (req, res) => {
  try {
    const { pitch, slideId } = req.body;
    if (!pitch || !Array.isArray(pitch.slides) || pitch.slides.length === 0 || !slideId) {
      return res.status(400).json(withMessageMetadata({ message: "Current pitch and slide id are required to translate." }, "ai.currentPitchAndSlideIdRequiredToTranslate"));
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json(withMessageMetadata({ message: "Project not found for this user." }, "project.notFound"));
    }

    const nextPitch = await translatePitchSlideService(project, pitch, slideId);
    res.status(200).json({ pitch: nextPitch });
  } catch (error) {
    console.error("[ai] translate pitch slide error:", error.message);
    res.status(500).json(withErrorMessageMetadata({ message: error.message || "AI slide speech translation failed." }, error, "ai.slideSpeechTranslationFailed"));
  }
};

// @desc    Analyze a recorded PFE defense attempt
// @route   POST /api/ai/jury-simulation/analyze
// @access  Private
const analyzeJurySimulation = async (req, res) => {
  try {
    const { projectId, actualSeconds } = req.body;
    if (!projectId) {
      return res.status(400).json(withMessageMetadata({ message: "Project id is required." }, "ai.projectIdRequired"));
    }

    let objectiveMetrics = {};
    if (req.body.objectiveMetrics) {
      try {
        objectiveMetrics = JSON.parse(req.body.objectiveMetrics);
      } catch {
        objectiveMetrics = {};
      }
    }

    let presentation = null;
    if (req.body.presentation) {
      try {
        presentation = JSON.parse(req.body.presentation);
      } catch {
        presentation = null;
      }
    }

    let pitch = null;
    if (req.body.pitch) {
      try {
        pitch = JSON.parse(req.body.pitch);
      } catch {
        pitch = null;
      }
    }

    const payload = await analyzeJurySimulationService({
      userId: req.user._id,
      projectId,
      audioFile: req.file,
      actualSeconds,
      objectiveMetrics,
      presentation,
      pitch,
    });

    await createGenerationNotification({
      userId: req.user._id,
      projectId,
      feature: "jurySimulation",
    });

    res.status(200).json(payload);
  } catch (error) {
    console.error("[ai] analyze jury simulation error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "AI jury simulation analysis failed." }, error, "ai.jurySimulationAnalysisFailed"));
  }
};

// @desc    Generate or resume jury Q&A questions after defense analysis
// @route   POST /api/ai/jury-qa/generate
// @access  Private
const generateJuryQA = async (req, res) => {
  try {
    const { projectId, juryAttemptId, presentation = null, pitch = null } = req.body;
    if (!projectId || !juryAttemptId) {
      return res.status(400).json(withMessageMetadata({ message: "Project id and jury attempt id are required." }, "ai.projectAndAttemptIdRequired"));
    }

    const payload = await generateJuryQAService({
      userId: req.user._id,
      projectId,
      juryAttemptId,
      submittedPresentation: presentation,
      submittedPitch: pitch,
    });

    res.status(200).json(payload);
  } catch (error) {
    console.error("[ai] generate jury Q&A error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "AI jury question generation failed." }, error, "ai.juryQuestionGenerationFailed"));
  }
};

// @desc    Transcribe and evaluate one recorded Q&A answer
// @route   POST /api/ai/jury-qa/:sessionId/answer
// @access  Private
const answerJuryQAQuestion = async (req, res) => {
  try {
    const { projectId, questionId, durationSeconds } = req.body;
    if (!projectId || !questionId) {
      return res.status(400).json(withMessageMetadata({ message: "Project id and question id are required." }, "ai.projectAndQuestionIdRequired"));
    }

    const payload = await answerJuryQAQuestionService({
      userId: req.user._id,
      projectId,
      sessionId: req.params.sessionId,
      questionId,
      audioFile: req.file,
      durationSeconds,
    });

    res.status(200).json(payload);
  } catch (error) {
    console.error("[ai] answer jury Q&A error:", error.message);
    const status = error.message.includes("not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "AI jury answer evaluation failed." }, error, "ai.juryAnswerEvaluationFailed"));
  }
};

// @desc    Finalize the full defense + Q&A jury report
// @route   POST /api/ai/jury-qa/:sessionId/finalize
// @access  Private
const finalizeJuryQA = async (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json(withMessageMetadata({ message: "Project id is required." }, "ai.projectIdRequired"));
    }

    const payload = await finalizeJuryQAService({
      userId: req.user._id,
      projectId,
      sessionId: req.params.sessionId,
    });

    await createGenerationNotification({
      userId: req.user._id,
      projectId,
      feature: "juryFinalEvaluation",
    });

    res.status(200).json(payload);
  } catch (error) {
    console.error("[ai] finalize jury Q&A error:", error.message);
    const status = error.message.includes("not found") ? 404 : 500;
    res.status(status).json(withErrorMessageMetadata({ message: error.message || "AI final jury report generation failed." }, error, "ai.finalJuryReportGenerationFailed"));
  }
};

module.exports = {
  generateProblemStatement,
  refineProblemStatement,
  translateProblemStatement,
  generateActors,
  refineActors,
  translateActors,
  generateExistingSolutions,
  refineExistingSolutions,
  translateExistingSolutions,
  generateFunctionalRequirements,
  refineFunctionalRequirements,
  translateFunctionalRequirements,
  generateNonFunctionalRequirements,
  refineNonFunctionalRequirements,
  translateNonFunctionalRequirements,
  generateProductBacklog,
  refineProductBacklog,
  translateProductBacklog,
  generateReportStructure,
  refineReportStructure,
  translateReportStructure,
  generateReportChapter,
  generateReportChapterStream,
  applyReportChapterAction,
  generateCompleteReport,
  generateUmlPreparation,
  refineUmlPreparation,
  translateUmlPreparation,
  generatePresentation,
  refinePresentation,
  translatePresentation,
  generatePitch,
  refinePitch,
  generatePitchSlide,
  refinePitchSlide,
  translatePitchSlide,
  analyzeJurySimulation,
  generateJuryQA,
  answerJuryQAQuestion,
  finalizeJuryQA,
};
