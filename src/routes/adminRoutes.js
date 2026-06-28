const express = require("express");
const router = express.Router();
const { getDashboardStats, getUsers, getProjects } = require("../controllers/adminController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.use(protect, adminOnly);

router.get("/dashboard", getDashboardStats);
router.get("/users", getUsers);
router.get("/projects", getProjects);

module.exports = router;
