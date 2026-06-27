const express = require("express");
const router = express.Router();
const {
  getNotifications,
  markNotificationsRead,
  streamNotifications,
} = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getNotifications);
router.patch("/read", protect, markNotificationsRead);
router.get("/stream", streamNotifications);

module.exports = router;
