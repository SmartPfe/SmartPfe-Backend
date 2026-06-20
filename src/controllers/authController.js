const jwt = require("jsonwebtoken");
const User = require("../models/User");
const crypto = require("crypto");

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "default_super_secret_key", {
    expiresIn: "30d",
  });
};
const {
  sendResetPasswordEmail,
} = require("../services/emailService");

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists with this email" });
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      password,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: "Invalid user data received" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user email
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
const getProfile = async (req, res) => {
  try {

    const user = await User.findById(req.user._id)
      .select("-password");

    res.json(user);

  } catch (error) {

    res.status(500).json({
      message: "Server error"
    });

  }
};
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({
        message:
          "Si un compte existe, un email a été envoyé.",
      });
    }

    const resetToken = crypto
      .randomBytes(32)
      .toString("hex");

    user.resetToken = resetToken;

    user.resetTokenExpiry =
      new Date(Date.now() + 60 * 60 * 1000);

    await user.save();

    const emailResult = await sendResetPasswordEmail(user.email, resetToken);

    const response = {
      message: "Si un compte existe, un email a été envoyé.",
      emailSent: emailResult.sent === true,
    };

    if (emailResult.devFallback && process.env.NODE_ENV !== "production") {
      response.devResetLink = emailResult.resetLink;
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("[auth] forgotPassword error:", error.message);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: "Token and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("[auth] resetPassword error:", error.message);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};
module.exports = {
  registerUser,
  loginUser,
  getProfile,
  forgotPassword,
  resetPassword,
};
