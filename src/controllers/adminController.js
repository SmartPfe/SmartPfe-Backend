const User = require("../models/User");
const Project = require("../models/Project");

function getLastMonths(count = 6) {
  const months = [];
  const now = new Date();

  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleString("en", { month: "short" }),
    });
  }

  return months;
}

function getMonthKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function countBy(items, getKey, fallback = "Not provided") {
  return items.reduce((acc, item) => {
    const rawKey = getKey(item);
    const key = rawKey && String(rawKey).trim() ? String(rawKey).trim() : fallback;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function toChartItems(counts, limit = 6) {
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

const getDashboardStats = async (req, res) => {
  try {
    const [totalUsers, totalStudents, totalAdmins, totalProjects, completedOnboarding] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ $or: [{ role: "etudiant" }, { role: { $exists: false } }] }),
      User.countDocuments({ role: "admin" }),
      Project.countDocuments(),
      User.countDocuments({ hasCompletedOnboarding: true }),
    ]);

    const [allUsers, allProjects] = await Promise.all([
      User.find().select("role hasCompletedOnboarding createdAt"),
      Project.find().select("basics.domain technicalContext.methodology createdAt"),
    ]);

    const months = getLastMonths(6);
    const userGrowth = months.map((month) => ({
      label: month.label,
      value: allUsers.filter((user) => getMonthKey(user.createdAt) === month.key).length,
    }));
    const projectGrowth = months.map((month) => ({
      label: month.label,
      value: allProjects.filter((project) => getMonthKey(project.createdAt) === month.key).length,
    }));

    const domains = toChartItems(countBy(allProjects, (project) => project.basics?.domain));
    const methodologies = toChartItems(countBy(allProjects, (project) => project.technicalContext?.methodology));
    const complexities = toChartItems(countBy(allProjects, (project) => project.technicalContext?.complexity));

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
      charts: {
        userGrowth,
        projectGrowth,
        onboardingStatus: [
          { label: "Completed", value: completedOnboarding },
          { label: "Pending", value: Math.max(totalUsers - completedOnboarding, 0) },
        ],
        complexities,
        domains,
        methodologies,
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
