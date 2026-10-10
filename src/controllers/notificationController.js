const Notification = require("../models/Notification");
const { withMessageMetadata } = require("../lib/interfaceMessages");
const User = require("../models/User");
const { addClient, sendEvent } = require("../services/notificationService");

const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json(notifications);
  } catch (error) {
    console.error("[notification] getNotifications error:", error.message);
    res.status(500).json(withMessageMetadata({ message: "Server error", error: error.message }, "common.serverError"));
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user: req.user._id, read: false });
    res.status(200).json({ count });
  } catch (error) {
    console.error("[notification] getUnreadCount error:", error.message);
    res.status(500).json(withMessageMetadata({ message: "Server error", error: error.message }, "common.serverError"));
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json(withMessageMetadata({ message: "Notification not found" }, "notifications.notFound"));
    }

    res.status(200).json(notification);
  } catch (error) {
    console.error("[notification] markNotificationRead error:", error.message);
    res.status(500).json(withMessageMetadata({ message: "Server error", error: error.message }, "common.serverError"));
  }
};

const markNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[notification] markNotificationsRead error:", error.message);
    res.status(500).json(withMessageMetadata({ message: "Server error", error: error.message }, "common.serverError"));
  }
};

const streamNotifications = async (req, res) => {
  try {
    const user = req.user;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    sendEvent(res, "connected", { connected: true });
    addClient(user._id, res);
    // Re-check long-lived connections; revoked/expired sessions cannot keep receiving events.
    const checkSession = setInterval(async () => {
      try {
        const current = await User.findById(user._id).select("sessionVersion");
        if (!current || String(current.sessionVersion || "0") !== String(req.authClaims.sv || "0") ||
          Date.now() >= req.authClaims.exp * 1000) res.end();
      } catch { res.end(); }
    }, 30000);
    res.once("close", () => clearInterval(checkSession));
  } catch (error) {
    console.error("[notification] streamNotifications error:", error.message);
    res.status(401).json(withMessageMetadata({ message: "Not authorized, token failed" }, "auth.tokenInvalid"));
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markNotificationsRead,
  streamNotifications,
};
