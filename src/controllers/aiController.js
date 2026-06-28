const Project = require("../models/Project");
const { callAI } = require("../services/openRouterService");

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

module.exports = {
  generateProblemStatement,
  refineProblemStatement,
};
