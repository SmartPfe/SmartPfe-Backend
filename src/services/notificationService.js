const Notification = require("../models/Notification");
const User = require("../models/User");

const clients = new Map();

function getUserId(userId) {
  return String(userId);
}

function addClient(userId, res) {
  const id = getUserId(userId);
  const userClients = clients.get(id) || new Set();
  const heartbeat = setInterval(() => {
    sendEvent(res, "heartbeat", { at: new Date().toISOString() });
  }, 30000);

  userClients.add(res);
  clients.set(id, userClients);

  res.on("close", () => {
    clearInterval(heartbeat);
    userClients.delete(res);
    if (userClients.size === 0) {
      clients.delete(id);
    }
  });
}

function sendEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcastToUser(userId, event, data) {
  const userClients = clients.get(getUserId(userId));
  if (!userClients) return;

  userClients.forEach((res) => sendEvent(res, event, data));
}

async function createNotification({ user, title, message, type = "info" }) {
  const notification = await Notification.create({ user, title, message, type });
  broadcastToUser(user, "notification", notification);
  return notification;
}

async function createAdminNotification({ title, message, type = "info" }) {
  const admins = await User.find({ role: "admin" }).select("_id");
  if (!admins.length) return [];

  const notifications = await Notification.insertMany(
    admins.map((admin) => ({
      user: admin._id,
      title,
      message,
      type,
    }))
  );

  notifications.forEach((notification) => {
    broadcastToUser(notification.user, "notification", notification);
  });

  return notifications;
}

module.exports = {
  addClient,
  sendEvent,
  broadcastToUser,
  createNotification,
  createAdminNotification,
};
