const express = require("express");
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markNotificationsRead,
  streamNotifications,
} = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getNotifications);
router.get("/unread-count", protect, getUnreadCount);
router.patch("/:id/read", protect, markNotificationRead);
router.patch("/read", protect, markNotificationsRead);
router.patch("/read-all", protect, markNotificationsRead);
router.get("/stream", streamNotifications);

module.exports = router;
