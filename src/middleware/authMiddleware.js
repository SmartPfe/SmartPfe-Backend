const jwt = require("jsonwebtoken");
const User = require("../models/User");

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
      const decoded = jwt.verify(token, getJwtSecret());

      // Get user from the token
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({ message: "Not authorized, user not found" });
      }

      return next();
    } catch (error) {
      console.error("[auth] Token verification failed:", error.message);
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role === "admin") {
    next();
    return;
  }

  res.status(403).json({ message: "Admin access required" });
};

module.exports = { protect, adminOnly };
