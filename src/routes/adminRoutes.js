const express = require("express");
const router = express.Router();
const { getDashboardStats, getUsers, getProjects } = require("../controllers/adminController");
const {
  getCreditEconomy,
  patchCreditPolicy,
  patchCreditSettings,
  adjustCredits,
  getUserCreditHistory,
} = require("../controllers/adminCreditController");
const {
  getAdminRequests,
  getAdminRequest,
  patchAdminRequestStatus,
  addCredits,
} = require("../controllers/creditPurchaseRequestController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.use(protect, adminOnly);

router.get("/dashboard", getDashboardStats);
router.get("/users", getUsers);
router.get("/projects", getProjects);
router.get("/credits/economy", getCreditEconomy);
router.patch("/credits/policies/:key", patchCreditPolicy);
router.patch("/credits/settings", patchCreditSettings);
router.post("/users/:userId/credits/adjust", adjustCredits);
router.get("/users/:userId/credits", getUserCreditHistory);
router.get("/credit-requests", getAdminRequests);
router.get("/credit-requests/:id", getAdminRequest);
router.patch("/credit-requests/:id/status", patchAdminRequestStatus);
router.post("/credit-requests/:id/add-credits", addCredits);

module.exports = router;
