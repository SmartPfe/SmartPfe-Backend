const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { getMyWallet, getCatalog, getMyTransactions } = require("../controllers/creditController");

const router = express.Router();
router.use(protect);
router.get("/me", getMyWallet);
router.get("/catalog", getCatalog);
router.get("/transactions", getMyTransactions);

module.exports = router;
