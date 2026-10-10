const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { withMessageMetadata } = require("../lib/interfaceMessages");

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SECRET environment variable is not configured in production!");
    }
    console.warn("[security] WARNING: JWT_SECRET is not set. Using dev fallback. Configure JWT_SECRET in .env for production.");
    return "default_super_secret_key";
  }
  return secret;
};

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });

      // Get user from the token
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json(withMessageMetadata({ message: "Not authorized, user not found" }, "auth.userNotAuthorized"));
      }
      if (String(decoded.sv || "0") !== String(req.user.sessionVersion || "0")) {
        return res.status(401).json({ message: "Session expired. Please sign in again.", messageKey: "auth.tokenInvalid" });
      }
      req.authClaims = decoded;

      return next();
    } catch (error) {
      console.error("[auth] Token verification failed:", error.message);
      return res.status(401).json(withMessageMetadata({ message: "Not authorized, token failed" }, "auth.tokenInvalid"));
    }
  }

  if (!token) {
    return res.status(401).json(withMessageMetadata({ message: "Not authorized, no token" }, "auth.tokenRequired"));
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role === "admin") {
    next();
    return;
  }

  res.status(403).json(withMessageMetadata({ message: "Admin access required" }, "auth.adminAccessRequired"));
};

const studentOnly = (req, res, next) => {
  if (req.user?.role === "etudiant" && req.user.emailVerified !== false) return next();
  return res.status(403).json({ message: "Verified student access required", messageKey: "security.studentRequired" });
};

module.exports = { protect, adminOnly, studentOnly, getJwtSecret };
