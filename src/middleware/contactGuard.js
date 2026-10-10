const { rateLimit } = require("express-rate-limit");
const express = require("express");
const contactLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5,
  standardHeaders: "draft-8", legacyHeaders: false,
  message: { message: "Too many contact messages. Please try again later.", messageKey: "security.contactLimited" } });
module.exports = { contactLimiter, contactBody: express.json({ limit: "16kb" }) };
