const Project = require("../models/Project");
const { callAI } = require("../services/openRouterService");
const {
  generateActors: generateActorsService,
  refineActors: refineActorsService,
} = require("../services/actorService");

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

module.exports = {
  generateProblemStatement,
  refineProblemStatement,
  generateActors,
  refineActors,
};
