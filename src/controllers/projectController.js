const Project = require("../models/Project");
const User = require("../models/User");

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

    res.status(200).json(project);
  } catch (error) {
    console.error("[project] updateMyProject error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createProject,
  getMyProject,
  updateMyProject,
};
