const jwt = require("jsonwebtoken");
const User = require("../models/User");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const { createNotification, createAdminNotification } = require("../services/notificationService");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "default_super_secret_key", {
    expiresIn: "30d",
  });
};
const {
  sendResetPasswordEmail,
  sendEmailVerificationCode,
} = require("../services/emailService");

const createVerificationCode = () => String(crypto.randomInt(100000, 1000000));

const hashVerificationCode = (code) =>
  crypto.createHash("sha256").update(String(code)).digest("hex");

const setEmailVerificationCode = (user) => {
  const code = createVerificationCode();
  user.emailVerificationCodeHash = hashVerificationCode(code);
  user.emailVerificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
  return code;
};

const buildAuthResponse = (user, authProvider = "email") => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  avatar: user.avatar,
  authProvider,
  emailVerified: user.emailVerified !== false,
  hasCompletedOnboarding: user.hasCompletedOnboarding,
  role: user.role || "etudiant",
  token: generateToken(user._id),
});

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    // Check if user exists
    const userExists = await User.findOne({ email: normalizedEmail });

    if (userExists) {
      if (userExists.googleId && !userExists.password) {
        return res.status(400).json({ message: "This email is already connected with Google. Please log in using 'Continue with Google'." });
      }

      if (userExists.emailVerified === false) {
        userExists.fullName = fullName || userExists.fullName;
        userExists.password = password;
        const verificationCode = setEmailVerificationCode(userExists);
        await userExists.save();

        const emailResult = await sendEmailVerificationCode(userExists.email, verificationCode);
        const response = {
          message: "Verification code sent. Please check your email.",
          requiresEmailVerification: true,
          email: userExists.email,
          emailSent: emailResult.sent === true,
        };

        if (emailResult.devFallback && process.env.NODE_ENV !== "production") {
          response.devVerificationCode = emailResult.verificationCode;
        }

        return res.status(200).json(response);
      }

      return res.status(400).json({ message: "User already exists with this email" });
    }

    // Create user
    const user = await User.create({
      fullName,
      email: normalizedEmail,
      password,
      emailVerified: false,
    });

    if (user) {
      const verificationCode = setEmailVerificationCode(user);
      await user.save();

      const emailResult = await sendEmailVerificationCode(user.email, verificationCode);
      const response = {
        message: "Account created. Verification code sent to your email.",
        requiresEmailVerification: true,
        email: user.email,
        emailSent: emailResult.sent === true,
      };

      if (emailResult.devFallback && process.env.NODE_ENV !== "production") {
        response.devVerificationCode = emailResult.verificationCode;
      }

      res.status(201).json(response);
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
    const normalizedEmail = String(email || "").trim().toLowerCase();

    // Check for user email
    const user = await User.findOne({ email: normalizedEmail });

    if (user && !user.password) {
      return res.status(400).json({ message: "This account was registered using Google. Please log in using 'Continue with Google'." });
    }

    if (user && (await user.matchPassword(password))) {
      if (user.emailVerified === false) {
        const verificationCode = setEmailVerificationCode(user);
        await user.save();
        const emailResult = await sendEmailVerificationCode(user.email, verificationCode);

        const response = {
          message: "Please verify your email before logging in. A new code has been sent.",
          requiresEmailVerification: true,
          email: user.email,
          emailSent: emailResult.sent === true,
        };

        if (emailResult.devFallback && process.env.NODE_ENV !== "production") {
          response.devVerificationCode = emailResult.verificationCode;
        }

        return res.status(403).json(response);
      }

      res.json(buildAuthResponse(user, "email"));
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Verify a newly registered user's email with a code
// @route   POST /api/auth/verify-email
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedCode = String(code || "").trim();

    if (!normalizedEmail || !normalizedCode) {
      return res.status(400).json({ message: "Email and verification code are required" });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ message: "No account was found for this email" });
    }

    if (user.emailVerified !== false) {
      return res.status(400).json({
        message: "This email is already verified. Please log in.",
        alreadyVerified: true,
      });
    }

    const codeHash = hashVerificationCode(normalizedCode);
    const isCodeValid =
      user.emailVerificationCodeHash === codeHash &&
      user.emailVerificationCodeExpiry &&
      user.emailVerificationCodeExpiry > new Date();

    if (!isCodeValid) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    user.emailVerified = true;
    user.emailVerificationCodeHash = undefined;
    user.emailVerificationCodeExpiry = undefined;
    await user.save();

    await createAdminNotification({
      title: "New user registered",
      message: `${user.fullName} joined the platform as ${user.role || "etudiant"}.`,
      type: "info",
    });

    return res.status(200).json(buildAuthResponse(user, "email"));
  } catch (error) {
    console.error("[auth] verifyEmail error:", error.message);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Resend an email verification code
// @route   POST /api/auth/resend-verification-code
// @access  Public
const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ message: "No account was found for this email" });
    }

    if (user.emailVerified !== false) {
      return res.status(200).json({
        message: "This email is already verified. You can log in now.",
        alreadyVerified: true,
      });
    }

    const verificationCode = setEmailVerificationCode(user);
    await user.save();

    const emailResult = await sendEmailVerificationCode(user.email, verificationCode);
    const response = {
      message: "A new verification code has been sent.",
      email: user.email,
      emailSent: emailResult.sent === true,
    };

    if (emailResult.devFallback && process.env.NODE_ENV !== "production") {
      response.devVerificationCode = emailResult.verificationCode;
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("[auth] resendVerificationCode error:", error.message);
    return res.status(500).json({ message: "Server error", error: error.message });
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

const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.googleId) {
      return res.status(403).json({
        message: "This account is connected with Google. Profile and password changes are managed by Google.",
      });
    }

    const { fullName, currentPassword, newPassword } = req.body;
    const wantsPasswordChange = Boolean(
      (currentPassword && currentPassword.trim()) ||
      (newPassword && newPassword.trim())
    );
    let passwordChanged = false;

    if (fullName) {
      user.fullName = fullName;
    }

    if (wantsPasswordChange) {
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required" });
      }

      const isCurrentPasswordValid = await user.matchPassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      user.password = newPassword;
      passwordChanged = true;
    }

    await user.save();

    await createNotification({
      user: req.user._id,
      title: passwordChanged ? "Password updated" : "Profile updated",
      message: passwordChanged
        ? "Your password was changed successfully."
        : "Your profile information has been saved.",
      type: "success",
    });

    return res.json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      avatar: user.avatar,
      authProvider: "email",
      emailVerified: user.emailVerified !== false,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      role: user.role || "etudiant",
      passwordChanged,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
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
        user.emailVerified = true;
        user.emailVerificationCodeHash = undefined;
        user.emailVerificationCodeExpiry = undefined;
        if (picture) user.avatar = picture;
        await user.save();
      } else {
        // 3. Create new user
        user = await User.create({
          fullName: fullName || email.split("@")[0],
          email,
          googleId,
          avatar: picture,
          emailVerified: true,
        });

        await createAdminNotification({
          title: "New Google user registered",
          message: `${user.fullName} joined the platform with Gmail.`,
          type: "info",
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
        authProvider: "google",
        emailVerified: true,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        role: user.role || "etudiant",
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
  verifyEmail,
  resendVerificationCode,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
  googleLogin,
};
