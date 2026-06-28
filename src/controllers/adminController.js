const User = require("../models/User");
const Project = require("../models/Project");

const getDashboardStats = async (req, res) => {
  try {
    const [totalUsers, totalStudents, totalAdmins, totalProjects, completedOnboarding] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ $or: [{ role: "etudiant" }, { role: { $exists: false } }] }),
      User.countDocuments({ role: "admin" }),
      Project.countDocuments(),
      User.countDocuments({ hasCompletedOnboarding: true }),
    ]);

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("fullName email role hasCompletedOnboarding createdAt");

    const recentProjects = await Project.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("user", "fullName email")
      .select("basics.domain basics.title basics.academicYear user createdAt");

    res.status(200).json({
      totals: {
        users: totalUsers,
        students: totalStudents,
        admins: totalAdmins,
        projects: totalProjects,
        completedOnboarding,
      },
      recentUsers: recentUsers.map((user) => ({
        ...user.toObject(),
        role: user.role || "etudiant",
      })),
      recentProjects,
    });
  } catch (error) {
    console.error("[admin] getDashboardStats error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .select("fullName email role hasCompletedOnboarding authProvider avatar createdAt");

    res.status(200).json(
      users.map((user) => ({
        ...user.toObject(),
        role: user.role || "etudiant",
      }))
    );
  } catch (error) {
    console.error("[admin] getUsers error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .sort({ createdAt: -1 })
      .populate("user", "fullName email role")
      .select("basics description technicalContext user createdAt updatedAt");

    res.status(200).json(projects);
  } catch (error) {
    console.error("[admin] getProjects error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  getProjects,
};
