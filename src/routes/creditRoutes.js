const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { getMyWallet, getCatalog, getMyTransactions } = require("../controllers/creditController");
const { getHistory, getRequest } = require("../controllers/studentCreditHistoryController");
const {
  getCreditPurchaseOptions,
  createRequest,
  getMyRequests,
} = require("../controllers/creditPurchaseRequestController");

const router = express.Router();
router.use(protect);
router.get("/me", getMyWallet);
router.get("/catalog", getCatalog);
router.get("/transactions", getMyTransactions);
router.get("/purchase-options", getCreditPurchaseOptions);
router.post("/requests", createRequest);
router.get("/requests/my", getMyRequests);
router.get("/requests/:id", getRequest);
router.get("/history", getHistory);

module.exports = router;
