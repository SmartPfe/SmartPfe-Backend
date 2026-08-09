const Project = require("../models/Project");
const { callAI } = require("../services/openRouterService");
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

// @desc    Generate a first draft of the problem statement using AI
// @route   POST /api/ai/problem-statement/generate
// @access  Private
const generateProblemStatement = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const suggestion = await callAI("generate", project);
    res.status(200).json({ suggestion });
  } catch (error) {
    console.error("[ai] generate error:", error.message);
    res.status(500).json({ message: error.message || "AI generation failed." });
  }
};

// @desc    Refine the current problem statement using AI
// @route   POST /api/ai/problem-statement/refine
// @access  Private
const refineProblemStatement = async (req, res) => {
  try {
    const { current, instructions } = req.body;
    if (!current || current.trim() === "") {
      return res.status(400).json({ message: "Current text is required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const suggestion = await callAI("refine", project, current, { instructions });
    res.status(200).json({ suggestion });
  } catch (error) {
    console.error("[ai] refine error:", error.message);
    res.status(500).json({ message: error.message || "AI refinement failed." });
  }
};

// @desc    Translate the current problem statement using AI
// @route   POST /api/ai/problem-statement/translate
// @access  Private
const translateProblemStatement = async (req, res) => {
  try {
    const { current } = req.body;
    if (!current || current.trim() === "") {
      return res.status(400).json({ message: "Current text is required to translate." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const suggestion = await callAI("translate", project, current);
    res.status(200).json({ suggestion });
  } catch (error) {
    console.error("[ai] translate error:", error.message);
    res.status(500).json({ message: error.message || "AI translation failed." });
  }
};

// @desc    Generate actors and stakeholders using AI
// @route   POST /api/ai/actors/generate
// @access  Private
const generateActors = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const actors = await generateActorsService(project);
    res.status(200).json({ actors });
  } catch (error) {
    console.error("[ai] generate actors error:", error.message);
    res.status(500).json({ message: error.message || "AI actor generation failed." });
  }
};

// @desc    Refine actors and stakeholders using AI
// @route   POST /api/ai/actors/refine
// @access  Private
const refineActors = async (req, res) => {
  try {
    const { actors, instructions } = req.body;
    if (!Array.isArray(actors) || actors.length === 0) {
      return res.status(400).json({ message: "Current actors are required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const refinedActors = await refineActorsService(project, actors, instructions);
    res.status(200).json({ actors: refinedActors });
  } catch (error) {
    console.error("[ai] refine actors error:", error.message);
    res.status(500).json({ message: error.message || "AI actor refinement failed." });
  }
};

// @desc    Translate actors and stakeholders using AI
// @route   POST /api/ai/actors/translate
// @access  Private
const translateActors = async (req, res) => {
  try {
    const { actors } = req.body;
    if (!Array.isArray(actors) || actors.length === 0) {
      return res.status(400).json({ message: "Current actors are required to translate." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const translatedActors = await translateActorsService(project, actors);
    res.status(200).json({ actors: translatedActors });
  } catch (error) {
    console.error("[ai] translate actors error:", error.message);
    res.status(500).json({ message: error.message || "AI actor translation failed." });
  }
};

// @desc    Generate existing solutions using AI
// @route   POST /api/ai/existing-solutions/generate
// @access  Private
const generateExistingSolutions = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const existingSolutions = await generateExistingSolutionsService(project);
    res.status(200).json({ existingSolutions });
  } catch (error) {
    console.error("[ai] generate existing solutions error:", error.message);
    res.status(500).json({ message: error.message || "AI existing solution generation failed." });
  }
};

// @desc    Refine existing solutions using AI
// @route   POST /api/ai/existing-solutions/refine
// @access  Private
const refineExistingSolutions = async (req, res) => {
  try {
    const { existingSolutions, instructions } = req.body;
    if (!Array.isArray(existingSolutions) || existingSolutions.length === 0) {
      return res.status(400).json({ message: "Current existing solutions are required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const refinedSolutions = await refineExistingSolutionsService(project, existingSolutions, instructions);
    res.status(200).json({ existingSolutions: refinedSolutions });
  } catch (error) {
    console.error("[ai] refine existing solutions error:", error.message);
    res.status(500).json({ message: error.message || "AI existing solution refinement failed." });
  }
};

// @desc    Translate existing solutions using AI
// @route   POST /api/ai/existing-solutions/translate
// @access  Private
const translateExistingSolutions = async (req, res) => {
  try {
    const { existingSolutions } = req.body;
    if (!Array.isArray(existingSolutions) || existingSolutions.length === 0) {
      return res.status(400).json({ message: "Current existing solutions are required to translate." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const translatedSolutions = await translateExistingSolutionsService(project, existingSolutions);
    res.status(200).json({ existingSolutions: translatedSolutions });
  } catch (error) {
    console.error("[ai] translate existing solutions error:", error.message);
    res.status(500).json({ message: error.message || "AI existing solution translation failed." });
  }
};

// @desc    Generate functional requirements using AI
// @route   POST /api/ai/functional-requirements/generate
// @access  Private
const generateFunctionalRequirements = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const functionalRequirements = await generateFunctionalRequirementsService(project);
    res.status(200).json({ functionalRequirements });
  } catch (error) {
    console.error("[ai] generate functional requirements error:", error.message);
    res.status(500).json({ message: error.message || "AI functional requirement generation failed." });
  }
};

// @desc    Refine functional requirements using AI
// @route   POST /api/ai/functional-requirements/refine
// @access  Private
const refineFunctionalRequirements = async (req, res) => {
  try {
    const { functionalRequirements, instructions } = req.body;
    if (!Array.isArray(functionalRequirements) || functionalRequirements.length === 0) {
      return res.status(400).json({ message: "Current functional requirements are required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const refinedRequirements = await refineFunctionalRequirementsService(project, functionalRequirements, instructions);
    res.status(200).json({ functionalRequirements: refinedRequirements });
  } catch (error) {
    console.error("[ai] refine functional requirements error:", error.message);
    res.status(500).json({ message: error.message || "AI functional requirement refinement failed." });
  }
};

// @desc    Translate functional requirements using AI
// @route   POST /api/ai/functional-requirements/translate
// @access  Private
const translateFunctionalRequirements = async (req, res) => {
  try {
    const { functionalRequirements } = req.body;
    if (!Array.isArray(functionalRequirements) || functionalRequirements.length === 0) {
      return res.status(400).json({ message: "Current functional requirements are required to translate." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const translatedRequirements = await translateFunctionalRequirementsService(project, functionalRequirements);
    res.status(200).json({ functionalRequirements: translatedRequirements });
  } catch (error) {
    console.error("[ai] translate functional requirements error:", error.message);
    res.status(500).json({ message: error.message || "AI functional requirement translation failed." });
  }
};

// @desc    Generate non-functional requirements using AI
// @route   POST /api/ai/non-functional-requirements/generate
// @access  Private
const generateNonFunctionalRequirements = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const nonFunctionalRequirements = await generateNonFunctionalRequirementsService(project);
    res.status(200).json({ nonFunctionalRequirements });
  } catch (error) {
    console.error("[ai] generate non-functional requirements error:", error.message);
    res.status(500).json({ message: error.message || "AI non-functional requirement generation failed." });
  }
};

// @desc    Refine non-functional requirements using AI
// @route   POST /api/ai/non-functional-requirements/refine
// @access  Private
const refineNonFunctionalRequirements = async (req, res) => {
  try {
    const { nonFunctionalRequirements, instructions } = req.body;
    if (!Array.isArray(nonFunctionalRequirements) || nonFunctionalRequirements.length === 0) {
      return res.status(400).json({ message: "Current non-functional requirements are required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const refinedRequirements = await refineNonFunctionalRequirementsService(project, nonFunctionalRequirements, instructions);
    res.status(200).json({ nonFunctionalRequirements: refinedRequirements });
  } catch (error) {
    console.error("[ai] refine non-functional requirements error:", error.message);
    res.status(500).json({ message: error.message || "AI non-functional requirement refinement failed." });
  }
};

// @desc    Translate non-functional requirements using AI
// @route   POST /api/ai/non-functional-requirements/translate
// @access  Private
const translateNonFunctionalRequirements = async (req, res) => {
  try {
    const { nonFunctionalRequirements } = req.body;
    if (!Array.isArray(nonFunctionalRequirements) || nonFunctionalRequirements.length === 0) {
      return res.status(400).json({ message: "Current non-functional requirements are required to translate." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const translatedRequirements = await translateNonFunctionalRequirementsService(project, nonFunctionalRequirements);
    res.status(200).json({ nonFunctionalRequirements: translatedRequirements });
  } catch (error) {
    console.error("[ai] translate non-functional requirements error:", error.message);
    res.status(500).json({ message: error.message || "AI non-functional requirement translation failed." });
  }
};

// @desc    Generate product backlog using AI
// @route   POST /api/ai/product-backlog/generate
// @access  Private
const generateProductBacklog = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const productBacklog = await generateProductBacklogService(project);
    res.status(200).json({ productBacklog });
  } catch (error) {
    console.error("[ai] generate product backlog error:", error.message);
    res.status(500).json({ message: error.message || "AI product backlog generation failed." });
  }
};

// @desc    Refine product backlog using AI
// @route   POST /api/ai/product-backlog/refine
// @access  Private
const refineProductBacklog = async (req, res) => {
  try {
    const { productBacklog, instructions } = req.body;
    if (!Array.isArray(productBacklog) || productBacklog.length === 0) {
      return res.status(400).json({ message: "Current product backlog is required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const refinedBacklog = await refineProductBacklogService(project, productBacklog, instructions);
    res.status(200).json({ productBacklog: refinedBacklog });
  } catch (error) {
    console.error("[ai] refine product backlog error:", error.message);
    res.status(500).json({ message: error.message || "AI product backlog refinement failed." });
  }
};

// @desc    Translate product backlog using AI
// @route   POST /api/ai/product-backlog/translate
// @access  Private
const translateProductBacklog = async (req, res) => {
  try {
    const { productBacklog } = req.body;
    if (!Array.isArray(productBacklog) || productBacklog.length === 0) {
      return res.status(400).json({ message: "Current product backlog is required to translate." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const translatedBacklog = await translateProductBacklogService(project, productBacklog);
    res.status(200).json({ productBacklog: translatedBacklog });
  } catch (error) {
    console.error("[ai] translate product backlog error:", error.message);
    res.status(500).json({ message: error.message || "AI product backlog translation failed." });
  }
};

// @desc    Generate report structure using AI
// @route   POST /api/ai/report-structure/generate
// @access  Private
const generateReportStructure = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const reportStructure = await generateReportStructureService(project);
    res.status(200).json({ reportStructure });
  } catch (error) {
    console.error("[ai] generate report structure error:", error.message);
    res.status(500).json({ message: error.message || "AI report structure generation failed." });
  }
};

// @desc    Refine report structure using AI
// @route   POST /api/ai/report-structure/refine
// @access  Private
const refineReportStructure = async (req, res) => {
  try {
    const { reportStructure, instructions } = req.body;
    if (!Array.isArray(reportStructure) || reportStructure.length === 0) {
      return res.status(400).json({ message: "Current report structure is required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const refinedStructure = await refineReportStructureService(project, reportStructure, instructions);
    res.status(200).json({ reportStructure: refinedStructure });
  } catch (error) {
    console.error("[ai] refine report structure error:", error.message);
    res.status(500).json({ message: error.message || "AI report structure refinement failed." });
  }
};

// @desc    Translate the current report structure using AI
// @route   POST /api/ai/report-structure/translate
// @access  Private
const translateReportStructure = async (req, res) => {
  try {
    const { reportStructure } = req.body;
    if (!Array.isArray(reportStructure) || reportStructure.length === 0) {
      return res.status(400).json({ message: "Current report structure is required to translate." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const translatedStructure = await translateReportStructureService(project, reportStructure);
    res.status(200).json({ reportStructure: translatedStructure });
  } catch (error) {
    console.error("[ai] translate report structure error:", error.message);
    res.status(500).json({ message: error.message || "AI report structure translation failed." });
  }
};

// @desc    Generate one report chapter using AI
// @route   POST /api/ai/report-studio/chapter/generate
// @access  Private
const generateReportChapter = async (req, res) => {
  try {
    const { sectionId, detailLevel = "standard", reportChapters = [] } = req.body;
    if (!sectionId) {
      return res.status(400).json({ message: "Section id is required." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const chapter = await generateReportChapterService(project, sectionId, detailLevel, reportChapters);
    res.status(200).json({ chapter });
  } catch (error) {
    console.error("[ai] generate report chapter error:", error.message);
    res.status(500).json({ message: error.message || "AI report chapter generation failed." });
  }
};

// @desc    Apply an AI writing action to one report chapter
// @route   POST /api/ai/report-studio/chapter/action
// @access  Private
const applyReportChapterAction = async (req, res) => {
  try {
    const { sectionId, action, currentContent, selectedText = "", reportChapters = [], instructions = "" } = req.body;
    if (!sectionId || !action || !currentContent) {
      return res.status(400).json({ message: "Section id, action, and current content are required." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
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
    res.status(500).json({ message: error.message || "AI report chapter action failed." });
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
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const finalReport = await generateCompleteReportService(project, reportChapters);
    const savedFinalReport = await saveFinalReportService(req.user._id, project._id, finalReport);
    res.status(200).json({ finalReport: savedFinalReport });
  } catch (error) {
    console.error("[ai] generate complete report error:", error.message);
    res.status(500).json({ message: error.message || "AI final report generation failed." });
  }
};

// @desc    Generate UML preparation using AI
// @route   POST /api/ai/uml-preparation/generate
// @access  Private
const generateUmlPreparation = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const umlPreparation = await generateUmlPreparationService(project);
    res.status(200).json({ umlPreparation });
  } catch (error) {
    console.error("[ai] generate UML preparation error:", error.message);
    res.status(500).json({ message: error.message || "AI UML preparation generation failed." });
  }
};

// @desc    Refine UML preparation using AI
// @route   POST /api/ai/uml-preparation/refine
// @access  Private
const refineUmlPreparation = async (req, res) => {
  try {
    const { umlPreparation, instructions } = req.body;
    if (!umlPreparation || !Array.isArray(umlPreparation.classes) || umlPreparation.classes.length === 0) {
      return res.status(400).json({ message: "Current UML preparation is required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const refinedPreparation = await refineUmlPreparationService(project, umlPreparation, instructions);
    res.status(200).json({ umlPreparation: refinedPreparation });
  } catch (error) {
    console.error("[ai] refine UML preparation error:", error.message);
    res.status(500).json({ message: error.message || "AI UML preparation refinement failed." });
  }
};

// @desc    Translate UML preparation using AI
// @route   POST /api/ai/uml-preparation/translate
// @access  Private
const translateUmlPreparation = async (req, res) => {
  try {
    const { umlPreparation } = req.body;
    if (!umlPreparation || !Array.isArray(umlPreparation.classes) || umlPreparation.classes.length === 0) {
      return res.status(400).json({ message: "Current UML preparation is required to translate." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const translatedPreparation = await translateUmlPreparationService(project, umlPreparation);
    res.status(200).json({ umlPreparation: translatedPreparation });
  } catch (error) {
    console.error("[ai] translate UML preparation error:", error.message);
    res.status(500).json({ message: error.message || "AI UML preparation translation failed." });
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
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const presentation = await generatePresentationService(project, durationMinutes);
    res.status(200).json({ presentation });
  } catch (error) {
    console.error("[ai] generate presentation error:", error.message);
    res.status(500).json({ message: error.message || "AI presentation generation failed." });
  }
};

// @desc    Refine a PFE defense presentation using AI
// @route   POST /api/ai/presentation/refine
// @access  Private
const refinePresentation = async (req, res) => {
  try {
    const { presentation, instructions = "", slideId = "" } = req.body;
    if (!presentation || !Array.isArray(presentation.slides) || presentation.slides.length === 0) {
      return res.status(400).json({ message: "Current presentation is required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const refinedPresentation = await refinePresentationService(project, presentation, instructions, slideId);
    res.status(200).json({ presentation: refinedPresentation });
  } catch (error) {
    console.error("[ai] refine presentation error:", error.message);
    res.status(500).json({ message: error.message || "AI presentation refinement failed." });
  }
};

// @desc    Translate one PFE defense presentation slide using AI
// @route   POST /api/ai/presentation/translate
// @access  Private
const translatePresentation = async (req, res) => {
  try {
    const { presentation, slideId } = req.body;
    if (!presentation || !Array.isArray(presentation.slides) || presentation.slides.length === 0 || !slideId) {
      return res.status(400).json({ message: "Current presentation and slide id are required to translate." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const translatedPresentation = await translatePresentationSlideService(project, presentation, slideId);
    res.status(200).json({ presentation: translatedPresentation });
  } catch (error) {
    console.error("[ai] translate presentation error:", error.message);
    res.status(500).json({ message: error.message || "AI presentation translation failed." });
  }
};

// @desc    Generate a complete PFE defense speech from the generated presentation
// @route   POST /api/ai/pitch/generate
// @access  Private
const generatePitch = async (req, res) => {
  try {
    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const pitch = await generatePitchService(project);
    res.status(200).json({ pitch });
  } catch (error) {
    console.error("[ai] generate pitch error:", error.message);
    res.status(500).json({ message: error.message || "AI pitch generation failed." });
  }
};

// @desc    Refine a complete PFE defense speech
// @route   POST /api/ai/pitch/refine
// @access  Private
const refinePitch = async (req, res) => {
  try {
    const { pitch, instructions = "" } = req.body;
    if (!pitch || !Array.isArray(pitch.slides) || pitch.slides.length === 0) {
      return res.status(400).json({ message: "Current pitch is required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const refinedPitch = await refinePitchService(project, pitch, instructions);
    res.status(200).json({ pitch: refinedPitch });
  } catch (error) {
    console.error("[ai] refine pitch error:", error.message);
    res.status(500).json({ message: error.message || "AI pitch refinement failed." });
  }
};

// @desc    Generate speech for one presentation slide
// @route   POST /api/ai/pitch/slide/generate
// @access  Private
const generatePitchSlide = async (req, res) => {
  try {
    const { pitch, slideId } = req.body;
    if (!slideId) {
      return res.status(400).json({ message: "Slide id is required." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const nextPitch = await generatePitchSlideService(project, pitch || {}, slideId);
    res.status(200).json({ pitch: nextPitch });
  } catch (error) {
    console.error("[ai] generate pitch slide error:", error.message);
    res.status(500).json({ message: error.message || "AI slide speech generation failed." });
  }
};

// @desc    Refine speech for one presentation slide
// @route   POST /api/ai/pitch/slide/refine
// @access  Private
const refinePitchSlide = async (req, res) => {
  try {
    const { pitch, slideId, instructions = "" } = req.body;
    if (!pitch || !Array.isArray(pitch.slides) || pitch.slides.length === 0 || !slideId) {
      return res.status(400).json({ message: "Current pitch and slide id are required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const nextPitch = await refinePitchSlideService(project, pitch, slideId, instructions);
    res.status(200).json({ pitch: nextPitch });
  } catch (error) {
    console.error("[ai] refine pitch slide error:", error.message);
    res.status(500).json({ message: error.message || "AI slide speech refinement failed." });
  }
};

// @desc    Translate speech for one presentation slide
// @route   POST /api/ai/pitch/slide/translate
// @access  Private
const translatePitchSlide = async (req, res) => {
  try {
    const { pitch, slideId } = req.body;
    if (!pitch || !Array.isArray(pitch.slides) || pitch.slides.length === 0 || !slideId) {
      return res.status(400).json({ message: "Current pitch and slide id are required to translate." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const nextPitch = await translatePitchSlideService(project, pitch, slideId);
    res.status(200).json({ pitch: nextPitch });
  } catch (error) {
    console.error("[ai] translate pitch slide error:", error.message);
    res.status(500).json({ message: error.message || "AI slide speech translation failed." });
  }
};

// @desc    Analyze a recorded PFE defense attempt
// @route   POST /api/ai/jury-simulation/analyze
// @access  Private
const analyzeJurySimulation = async (req, res) => {
  try {
    const { projectId, actualSeconds } = req.body;
    if (!projectId) {
      return res.status(400).json({ message: "Project id is required." });
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

    res.status(200).json(payload);
  } catch (error) {
    console.error("[ai] analyze jury simulation error:", error.message);
    const status = error.message.includes("Project not found") ? 404 : 500;
    res.status(status).json({ message: error.message || "AI jury simulation analysis failed." });
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
};
