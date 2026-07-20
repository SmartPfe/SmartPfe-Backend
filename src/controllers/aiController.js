const Project = require("../models/Project");
const { callAI } = require("../services/openRouterService");
const {
  generateActors: generateActorsService,
  refineActors: refineActorsService,
} = require("../services/actorService");
const {
  generateExistingSolutions: generateExistingSolutionsService,
  refineExistingSolutions: refineExistingSolutionsService,
} = require("../services/existingSolutionService");
const {
  generateFunctionalRequirements: generateFunctionalRequirementsService,
  refineFunctionalRequirements: refineFunctionalRequirementsService,
} = require("../services/functionalRequirementService");
const {
  generateNonFunctionalRequirements: generateNonFunctionalRequirementsService,
  refineNonFunctionalRequirements: refineNonFunctionalRequirementsService,
} = require("../services/nonFunctionalRequirementService");
const {
  generateProductBacklog: generateProductBacklogService,
  refineProductBacklog: refineProductBacklogService,
} = require("../services/productBacklogService");
const {
  generateReportStructure: generateReportStructureService,
  refineReportStructure: refineReportStructureService,
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
} = require("../services/umlPreparationService");

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
    const { current } = req.body;
    if (!current || current.trim() === "") {
      return res.status(400).json({ message: "Current text is required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const suggestion = await callAI("refine", project, current);
    res.status(200).json({ suggestion });
  } catch (error) {
    console.error("[ai] refine error:", error.message);
    res.status(500).json({ message: error.message || "AI refinement failed." });
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
    const { actors } = req.body;
    if (!Array.isArray(actors) || actors.length === 0) {
      return res.status(400).json({ message: "Current actors are required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const refinedActors = await refineActorsService(project, actors);
    res.status(200).json({ actors: refinedActors });
  } catch (error) {
    console.error("[ai] refine actors error:", error.message);
    res.status(500).json({ message: error.message || "AI actor refinement failed." });
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
    const { existingSolutions } = req.body;
    if (!Array.isArray(existingSolutions) || existingSolutions.length === 0) {
      return res.status(400).json({ message: "Current existing solutions are required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const refinedSolutions = await refineExistingSolutionsService(project, existingSolutions);
    res.status(200).json({ existingSolutions: refinedSolutions });
  } catch (error) {
    console.error("[ai] refine existing solutions error:", error.message);
    res.status(500).json({ message: error.message || "AI existing solution refinement failed." });
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
    const { functionalRequirements } = req.body;
    if (!Array.isArray(functionalRequirements) || functionalRequirements.length === 0) {
      return res.status(400).json({ message: "Current functional requirements are required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const refinedRequirements = await refineFunctionalRequirementsService(project, functionalRequirements);
    res.status(200).json({ functionalRequirements: refinedRequirements });
  } catch (error) {
    console.error("[ai] refine functional requirements error:", error.message);
    res.status(500).json({ message: error.message || "AI functional requirement refinement failed." });
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
    const { nonFunctionalRequirements } = req.body;
    if (!Array.isArray(nonFunctionalRequirements) || nonFunctionalRequirements.length === 0) {
      return res.status(400).json({ message: "Current non-functional requirements are required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const refinedRequirements = await refineNonFunctionalRequirementsService(project, nonFunctionalRequirements);
    res.status(200).json({ nonFunctionalRequirements: refinedRequirements });
  } catch (error) {
    console.error("[ai] refine non-functional requirements error:", error.message);
    res.status(500).json({ message: error.message || "AI non-functional requirement refinement failed." });
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
    const { productBacklog } = req.body;
    if (!Array.isArray(productBacklog) || productBacklog.length === 0) {
      return res.status(400).json({ message: "Current product backlog is required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const refinedBacklog = await refineProductBacklogService(project, productBacklog);
    res.status(200).json({ productBacklog: refinedBacklog });
  } catch (error) {
    console.error("[ai] refine product backlog error:", error.message);
    res.status(500).json({ message: error.message || "AI product backlog refinement failed." });
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
    const { reportStructure } = req.body;
    if (!Array.isArray(reportStructure) || reportStructure.length === 0) {
      return res.status(400).json({ message: "Current report structure is required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const refinedStructure = await refineReportStructureService(project, reportStructure);
    res.status(200).json({ reportStructure: refinedStructure });
  } catch (error) {
    console.error("[ai] refine report structure error:", error.message);
    res.status(500).json({ message: error.message || "AI report structure refinement failed." });
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
    const { sectionId, action, currentContent, selectedText = "", reportChapters = [] } = req.body;
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
      reportChapters
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
    const { umlPreparation } = req.body;
    if (!umlPreparation || !Array.isArray(umlPreparation.classes) || umlPreparation.classes.length === 0) {
      return res.status(400).json({ message: "Current UML preparation is required to refine." });
    }

    const project = await Project.findOne({ user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: "Project not found for this user." });
    }

    const refinedPreparation = await refineUmlPreparationService(project, umlPreparation);
    res.status(200).json({ umlPreparation: refinedPreparation });
  } catch (error) {
    console.error("[ai] refine UML preparation error:", error.message);
    res.status(500).json({ message: error.message || "AI UML preparation refinement failed." });
  }
};

module.exports = {
  generateProblemStatement,
  refineProblemStatement,
  generateActors,
  refineActors,
  generateExistingSolutions,
  refineExistingSolutions,
  generateFunctionalRequirements,
  refineFunctionalRequirements,
  generateNonFunctionalRequirements,
  refineNonFunctionalRequirements,
  generateProductBacklog,
  refineProductBacklog,
  generateReportStructure,
  refineReportStructure,
  generateReportChapter,
  applyReportChapterAction,
  generateCompleteReport,
  generateUmlPreparation,
  refineUmlPreparation,
};
