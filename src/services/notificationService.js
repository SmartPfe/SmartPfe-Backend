const Notification = require("../models/Notification");
const User = require("../models/User");

const clients = new Map();

const generationNotificationConfig = {
  problemStatement: {
    titleKey: "generation.problemStatement.title",
    messageKey: "generation.problemStatement.message",
    title: "Problem Statement is ready",
    message: "The Problem Statement has been generated successfully.",
    link: "/workspace/problem-statement",
  },
  actors: {
    titleKey: "generation.actors.title",
    messageKey: "generation.actors.message",
    title: "Actors section is ready",
    message: "The Actors section has been generated successfully.",
    link: "/workspace/actors",
  },
  userStories: {
    titleKey: "generation.userStories.title",
    messageKey: "generation.userStories.message",
    title: "User Stories are ready",
    message: "The user stories have been generated successfully.",
    link: "/workspace/backlog",
  },
  existingSolutions: {
    titleKey: "generation.existingSolutions.title",
    messageKey: "generation.existingSolutions.message",
    title: "Existing Solutions are ready",
    message: "The Existing Solutions section has been generated successfully.",
    link: "/workspace/solutions",
  },
  functionalRequirements: {
    titleKey: "generation.functionalRequirements.title",
    messageKey: "generation.functionalRequirements.message",
    title: "Functional Requirements are ready",
    message: "The Functional Requirements section has been generated successfully.",
    link: "/workspace/functional-requirements",
  },
  nonFunctionalRequirements: {
    titleKey: "generation.nonFunctionalRequirements.title",
    messageKey: "generation.nonFunctionalRequirements.message",
    title: "Non-Functional Requirements are ready",
    message: "The Non-Functional Requirements section has been generated successfully.",
    link: "/workspace/non-functional-requirements",
  },
  productBacklog: {
    titleKey: "generation.productBacklog.title",
    messageKey: "generation.productBacklog.message",
    title: "Product Backlog is ready",
    message: "The Product Backlog has been generated successfully.",
    link: "/workspace/backlog",
  },
  reportStructure: {
    titleKey: "generation.reportStructure.title",
    messageKey: "generation.reportStructure.message",
    title: "Report Structure is ready",
    message: "The Report Structure has been generated successfully.",
    link: "/workspace/report-structure",
  },
  reportBuilder: {
    titleKey: "generation.reportBuilder.title",
    messageKey: "generation.reportBuilder.message",
    title: "Report Builder is ready",
    message: "The generated report content has been saved successfully.",
    link: "/workspace/report-builder",
  },
  completeReport: {
    titleKey: "generation.completeReport.title",
    messageKey: "generation.completeReport.message",
    title: "Complete Report is ready",
    message: "The complete report has been generated successfully.",
    link: "/workspace/report-builder",
  },
  umlPreparation: {
    titleKey: "generation.umlPreparation.title",
    messageKey: "generation.umlPreparation.message",
    title: "UML diagram is ready",
    message: "The UML preparation has been generated successfully.",
    link: "/workspace/uml-preparation",
  },
  presentation: {
    titleKey: "generation.presentation.title",
    messageKey: "generation.presentation.message",
    title: "Your presentation is ready",
    message: "Your presentation has been generated successfully.",
    link: "/workspace/presentation",
  },
  pitch: {
    titleKey: "generation.pitch.title",
    messageKey: "generation.pitch.message",
    title: "Your pitch is ready",
    message: "Your pitch has been generated successfully.",
    link: "/workspace/pitch",
  },
  pitchSlide: {
    titleKey: "generation.pitchSlide.title",
    messageKey: "generation.pitchSlide.message",
    title: "Slide speech is ready",
    message: "The slide speech has been generated successfully.",
    link: "/workspace/pitch",
  },
  jurySimulation: {
    titleKey: "generation.jurySimulation.title",
    messageKey: "generation.jurySimulation.message",
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

async function createNotification({ user, projectId, feature = "", title, message, type = "info", link = "", titleKey, messageKey, messageParams }) {
  const notification = await Notification.create({
    user,
    projectId,
    feature,
    title,
    message,
    type,
    link,
    ...(titleKey ? { titleKey } : {}),
    ...(messageKey ? { messageKey } : {}),
    ...(messageParams !== undefined ? { messageParams } : {}),
  });
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
    titleKey: config.titleKey,
    messageKey: config.messageKey,
    link: config.link,
  });
}

async function createAdminNotification({ title, message, type = "info", titleKey, messageKey, messageParams }) {
  const admins = await User.find({ role: "admin" }).select("_id");
  if (!admins.length) return [];

  const notifications = await Notification.insertMany(
    admins.map((admin) => ({
      user: admin._id,
      title,
      message,
      type,
      ...(titleKey ? { titleKey } : {}),
      ...(messageKey ? { messageKey } : {}),
      ...(messageParams !== undefined ? { messageParams } : {}),
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
