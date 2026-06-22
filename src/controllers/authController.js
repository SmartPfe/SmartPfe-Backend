const jwt = require("jsonwebtoken");
const User = require("../models/User");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
        avatar: user.avatar,
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

    if (user && !user.password) {
      return res.status(400).json({ message: "This account was registered using Google. Please log in using 'Continue with Google'." });
    }

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
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
const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Google credential is required" });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn("WARNING: GOOGLE_CLIENT_ID is not configured in environment variables.");
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name: fullName, picture } = payload;

    if (!email) {
      return res.status(400).json({ message: "Google account does not provide an email" });
    }

    // 1. Check if user already exists with googleId
    let user = await User.findOne({ googleId });

    if (!user) {
      // 2. Check if user exists with the same email
      user = await User.findOne({ email });

      if (user) {
        // Link Google ID to existing email account
        user.googleId = googleId;
        if (picture) user.avatar = picture;
        await user.save();
      } else {
        // 3. Create new user
        user = await User.create({
          fullName: fullName || email.split("@")[0],
          email,
          googleId,
          avatar: picture,
        });
      }
    } else {
      // Keep avatar updated if it changed on Google's end
      if (picture && user.avatar !== picture) {
        user.avatar = picture;
        await user.save();
      }
    }

    if (user) {
      res.status(200).json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: "Failed to authenticate with Google" });
    }
  } catch (error) {
    console.error("[auth] googleLogin error:", error.message);
    res.status(500).json({ message: "Google authentication failed", error: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getProfile,
  forgotPassword,
  resetPassword,
  googleLogin,
};
