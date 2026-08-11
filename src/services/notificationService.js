const Notification = require("../models/Notification");
const User = require("../models/User");

const clients = new Map();

const generationNotificationConfig = {
  problemStatement: {
    title: "Problem Statement is ready",
    message: "The Problem Statement has been generated successfully.",
    link: "/workspace/problem-statement",
  },
  actors: {
    title: "Actors section is ready",
    message: "The Actors section has been generated successfully.",
    link: "/workspace/actors",
  },
  userStories: {
    title: "User Stories are ready",
    message: "The user stories have been generated successfully.",
    link: "/workspace/backlog",
  },
  existingSolutions: {
    title: "Existing Solutions are ready",
    message: "The Existing Solutions section has been generated successfully.",
    link: "/workspace/solutions",
  },
  functionalRequirements: {
    title: "Functional Requirements are ready",
    message: "The Functional Requirements section has been generated successfully.",
    link: "/workspace/functional-requirements",
  },
  nonFunctionalRequirements: {
    title: "Non-Functional Requirements are ready",
    message: "The Non-Functional Requirements section has been generated successfully.",
    link: "/workspace/non-functional-requirements",
  },
  productBacklog: {
    title: "Product Backlog is ready",
    message: "The Product Backlog has been generated successfully.",
    link: "/workspace/backlog",
  },
  reportStructure: {
    title: "Report Structure is ready",
    message: "The Report Structure has been generated successfully.",
    link: "/workspace/report-structure",
  },
  reportBuilder: {
    title: "Report Builder is ready",
    message: "The generated report content has been saved successfully.",
    link: "/workspace/report-builder",
  },
  completeReport: {
    title: "Complete Report is ready",
    message: "The complete report has been generated successfully.",
    link: "/workspace/report-builder",
  },
  umlPreparation: {
    title: "UML diagram is ready",
    message: "The UML preparation has been generated successfully.",
    link: "/workspace/uml-preparation",
  },
  presentation: {
    title: "Your presentation is ready",
    message: "Your presentation has been generated successfully.",
    link: "/workspace/presentation",
  },
  pitch: {
    title: "Your pitch is ready",
    message: "Your pitch has been generated successfully.",
    link: "/workspace/pitch",
  },
  pitchSlide: {
    title: "Slide speech is ready",
    message: "The slide speech has been generated successfully.",
    link: "/workspace/pitch",
  },
  jurySimulation: {
    title: "Your jury simulation is ready",
    message: "Your jury simulation analysis has been generated successfully.",
    link: "/workspace/jury-simulation",
  },
};

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

async function createNotification({ user, projectId, feature = "", title, message, type = "info", link = "" }) {
  const notification = await Notification.create({ user, projectId, feature, title, message, type, link });
  broadcastToUser(user, "notification", notification);
  return notification;
}

async function createGenerationNotification({ userId, projectId, feature }) {
  const config = generationNotificationConfig[feature];
  if (!config) return null;

  return createNotification({
    user: userId,
    projectId,
    feature,
    type: "generation_complete",
    title: config.title,
    message: config.message,
    link: config.link,
  });
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
  createGenerationNotification,
  generationNotificationConfig,
  createAdminNotification,
};
