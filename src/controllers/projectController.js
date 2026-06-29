const Project = require("../models/Project");
const User = require("../models/User");
const { createNotification, createAdminNotification } = require("../services/notificationService");
const { getActors: getActorsService, saveActors: saveActorsService } = require("../services/actorService");

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

module.exports = {
  createProject,
  getMyProject,
  updateMyProject,
  updateProblemStatement,
  getActors,
  updateActors,
};
