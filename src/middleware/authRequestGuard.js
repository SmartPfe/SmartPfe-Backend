const { rateLimit } = require("express-rate-limit");

const publicAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many authentication attempts. Please try again later.", messageKey: "security.authLimited" },
});

// Reject query operators and structured credentials before they reach MongoDB.
const validateAuthInput = (req, res, next) => {
  for (const field of ["email", "password", "currentPassword", "newPassword", "code", "token", "credential", "fullName"]) {
    if (req.body?.[field] !== undefined && typeof req.body[field] !== "string") {
      return res.status(400).json({ message: "Invalid authentication input", messageKey: "security.invalidInput" });
    }
  }
  return next();
};

module.exports = { publicAuthLimiter, validateAuthInput };
