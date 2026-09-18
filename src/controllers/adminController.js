const User = require("../models/User");
const Project = require("../models/Project");
const CreditWallet = require("../models/CreditWallet");
const CreditTransaction = require("../models/CreditTransaction");

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
    const studentFilter = { $or: [{ role: "etudiant" }, { role: { $exists: false } }] };
    const [totalUsers, totalStudents, totalAdmins, totalProjects, completedOnboarding, students] = await Promise.all([
      User.countDocuments(),
      User.countDocuments(studentFilter),
      User.countDocuments({ role: "admin" }),
      Project.countDocuments(),
      User.countDocuments({ ...studentFilter, hasCompletedOnboarding: true }),
      User.find(studentFilter).select("_id role hasCompletedOnboarding createdAt"),
    ]);

    const studentIds = students.map((student) => student._id);
    const [allProjects, wallets, transactions, recentUsers, recentProjects] = await Promise.all([
      Project.find().select("basics.domain createdAt"),
      CreditWallet.find({ user: { $in: studentIds } }).lean(),
      CreditTransaction.find({ user: { $in: studentIds }, status: "settled" })
        .sort({ createdAt: -1 })
        .limit(5000)
        .populate("user", "fullName email")
        .select("user kind actionKey chargedCost promotionalDelta purchasedDelta reason createdAt"),
      User.find(studentFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .select("fullName email role hasCompletedOnboarding createdAt"),
      Project.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("user", "fullName email")
        .select("basics.domain basics.title user createdAt"),
    ]);

    const months = getLastMonths(6);
    const studentGrowth = months.map((month) => ({
      label: month.label,
      value: students.filter((user) => getMonthKey(user.createdAt) === month.key).length,
    }));
    const projectGrowth = months.map((month) => ({
      label: month.label,
      value: allProjects.filter((project) => getMonthKey(project.createdAt) === month.key).length,
    }));

    const domains = toChartItems(countBy(allProjects, (project) => project.basics?.domain), 5);
    const walletTotals = wallets.reduce((totals, wallet) => ({
      promotional: totals.promotional + (Number(wallet.promotionalBalance) || 0),
      purchased: totals.purchased + (Number(wallet.purchasedBalance) || 0),
    }), { promotional: 0, purchased: 0 });
    const creditsSpent = transactions.reduce((sum, transaction) => sum + (transaction.kind === "usage" ? Number(transaction.chargedCost) || 0 : 0), 0);
    const purchasedFulfilled = transactions.reduce((sum, transaction) => sum + Math.max(0, transaction.kind === "admin_adjustment" ? Number(transaction.purchasedDelta) || 0 : 0), 0);
    const actionDemand = toChartItems(countBy(transactions.filter((transaction) => transaction.kind === "usage"), (transaction) => transaction.actionKey || "Other"), 5);
    const activityDays = Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (13 - index));
      return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString("en", { month: "short", day: "numeric" }), spent: 0, fulfilled: 0 };
    });
    const activityByDay = new Map(activityDays.map((day) => [day.key, day]));
    transactions.forEach((transaction) => {
      const day = activityByDay.get(new Date(transaction.createdAt).toISOString().slice(0, 10));
      if (!day) return;
      if (transaction.kind === "usage") day.spent += Number(transaction.chargedCost) || 0;
      if (transaction.kind === "admin_adjustment") day.fulfilled += Math.max(0, Number(transaction.purchasedDelta) || 0);
    });
    const recentFulfillments = transactions
      .filter((transaction) => transaction.kind === "admin_adjustment" && Number(transaction.purchasedDelta) > 0)
      .slice(0, 5)
      .map((transaction) => transaction.toObject());

    res.status(200).json({
      totals: {
        users: totalUsers,
        students: totalStudents,
        admins: totalAdmins,
        projects: totalProjects,
        completedOnboarding,
        creditsSpent,
        purchasedFulfilled,
        walletCredits: walletTotals.promotional + walletTotals.purchased,
      },
      charts: {
        studentGrowth,
        projectGrowth,
        onboardingStatus: [
          { label: "Completed", value: completedOnboarding },
          { label: "Pending", value: Math.max(totalStudents - completedOnboarding, 0) },
        ],
        domains,
        actionDemand,
        creditActivity: activityDays,
      },
      recentUsers: recentUsers.map((user) => ({
        ...user.toObject(),
        role: user.role || "etudiant",
      })),
      recentProjects,
      recentFulfillments,
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

    const studentIds = users.filter((user) => (user.role || "etudiant") !== "admin").map((user) => user._id);
    const wallets = await CreditWallet.find({ user: { $in: studentIds } }).lean();
    const walletByUser = new Map(wallets.map((wallet) => [String(wallet.user), wallet]));

    res.status(200).json(users.map((user) => {
      const isAdmin = (user.role || "etudiant") === "admin";
      const wallet = isAdmin ? null : walletByUser.get(String(user._id));
      const promotional = Number(wallet?.promotionalBalance) || 0;
      const purchased = Number(wallet?.purchasedBalance) || 0;
      return {
        ...user.toObject(),
        role: user.role || "etudiant",
        walletEligible: !isAdmin,
        ...(isAdmin ? {} : { credits: { promotional, purchased, total: promotional + purchased } }),
      };
    }));
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
