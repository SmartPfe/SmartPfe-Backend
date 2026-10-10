const { normalizeEmailLocale } = require("../services/emailLocale");
const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../middleware/authMiddleware");
const User = require("../models/User");
const crypto = require("crypto");
const googleIdentity = require("../services/googleIdentityService");
const { passwordPolicyError } = require("../lib/passwordPolicy");
const { createNotification, createAdminNotification } = require("../services/notificationService");
const { getWalletForUser } = require("../services/creditService");
const { withMessageMetadata } = require("../lib/interfaceMessages");

const rejectWeakPassword = (password, res) => {
  const key = passwordPolicyError(password);
  if (!key) return false;
  res.status(400).json(withMessageMetadata({ message: key === "auth.passwordTooLong" ? "Password must not exceed 72 UTF-8 bytes." : "Password must be at least 15 characters." }, key));
  return true;
};

// Generate JWT Token
const generateToken = (id, sessionVersion = "0") => {
  return jwt.sign({ id, sv: sessionVersion }, getJwtSecret(), {
    expiresIn: "30d",
  });
};
const {
  sendResetPasswordEmail,
  sendEmailVerificationCode,
} = require("../services/emailService");

const requestUiLanguage = (req) => normalizeEmailLocale(req.headers?.["x-ui-language"]);
const recipientUiLanguage = (user, req) => user.uiLanguage || requestUiLanguage(req);

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
  googleConnected: Boolean(user.googleId), hasPassword: Boolean(user.password),
  emailVerified: user.emailVerified !== false,
  hasCompletedOnboarding: user.hasCompletedOnboarding,
  role: user.role || "etudiant",
  uiLanguage: user.uiLanguage || "fr",
  token: generateToken(user._id, user.sessionVersion),
});

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    if (rejectWeakPassword(password, res)) return;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    // Check if user exists
    const userExists = await User.findOne({ email: normalizedEmail });

    if (userExists) {
      if (userExists.googleId && !userExists.password) {
        return res.status(400).json(withMessageMetadata({ message: "This email is already connected with Google. Please log in using 'Continue with Google'." }, "auth.googleLoginRequired"));
      }

      if (userExists.emailVerified === false) {
        userExists.fullName = fullName || userExists.fullName;
        userExists.password = password;
        const verificationCode = setEmailVerificationCode(userExists);
        await userExists.save();

        const emailResult = await sendEmailVerificationCode(userExists.email, verificationCode, recipientUiLanguage(userExists, req));
        const response = withMessageMetadata({
          message: "Verification code sent. Please check your email.",
          requiresEmailVerification: true,
          email: userExists.email,
          emailSent: emailResult.sent === true,
        }, "auth.verificationCodeSent");

        if (emailResult.devFallback && process.env.NODE_ENV !== "production") {
          response.devVerificationCode = emailResult.verificationCode;
        }

        return res.status(200).json(response);
      }

      return res.status(400).json(withMessageMetadata({ message: "User already exists with this email" }, "auth.userAlreadyExists"));
    }

    // Create user
    const user = await User.create({
      fullName,
      email: normalizedEmail,
      password,
      emailVerified: false,
      uiLanguage: requestUiLanguage(req),
    });

    if (user) {
      const verificationCode = setEmailVerificationCode(user);
      await user.save();

      const emailResult = await sendEmailVerificationCode(user.email, verificationCode, recipientUiLanguage(user, req));
      const response = withMessageMetadata({
        message: "Account created. Verification code sent to your email.",
        requiresEmailVerification: true,
        email: user.email,
        emailSent: emailResult.sent === true,
      }, "auth.accountCreatedVerificationSent");

      if (emailResult.devFallback && process.env.NODE_ENV !== "production") {
        response.devVerificationCode = emailResult.verificationCode;
      }

      res.status(201).json(response);
    } else {
      res.status(400).json(withMessageMetadata({ message: "Invalid user data received" }, "auth.invalidUserData"));
    }
  } catch (error) {
    res.status(500).json(withMessageMetadata({ message: "Server error", error: error.message }, "common.serverError"));
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
      return res.status(400).json(withMessageMetadata({ message: "This account was registered using Google. Please log in using 'Continue with Google'." }, "auth.googleLoginRequired"));
    }

    if (user && (await user.matchPassword(password))) {
      if (user.emailVerified === false) {
        const verificationCode = setEmailVerificationCode(user);
        await user.save();
        const emailResult = await sendEmailVerificationCode(user.email, verificationCode, recipientUiLanguage(user, req));

        const response = withMessageMetadata({
          message: "Please verify your email before logging in. A new code has been sent.",
          requiresEmailVerification: true,
          email: user.email,
          emailSent: emailResult.sent === true,
        }, "auth.verifyEmailBeforeLogin");

        if (emailResult.devFallback && process.env.NODE_ENV !== "production") {
          response.devVerificationCode = emailResult.verificationCode;
        }

        return res.status(403).json(response);
      }

      res.json(buildAuthResponse(user, "email"));
    } else {
      res.status(401).json(withMessageMetadata({ message: "Invalid email or password" }, "auth.invalidCredentials"));
    }
  } catch (error) {
    res.status(500).json(withMessageMetadata({ message: "Server error", error: error.message }, "common.serverError"));
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
      return res.status(400).json(withMessageMetadata({ message: "Email and verification code are required" }, "auth.emailAndCodeRequired"));
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json(withMessageMetadata({ message: "No account was found for this email" }, "auth.accountNotFound"));
    }

    if (user.emailVerified !== false) {
      return res.status(400).json(withMessageMetadata({
        message: "This email is already verified. Please log in.",
        alreadyVerified: true,
      }, "auth.emailAlreadyVerifiedLogin"));
    }

    const codeHash = hashVerificationCode(normalizedCode);
    const isCodeValid =
      user.emailVerificationCodeHash === codeHash &&
      user.emailVerificationCodeExpiry &&
      user.emailVerificationCodeExpiry > new Date();

    if (!isCodeValid) {
      return res.status(400).json(withMessageMetadata({ message: "Invalid or expired verification code" }, "auth.invalidVerificationCode"));
    }

    user.emailVerified = true;
    user.emailVerificationCodeHash = undefined;
    user.emailVerificationCodeExpiry = undefined;
    await user.save();
    await getWalletForUser(user);

    await createAdminNotification({
      title: "New user registered",
      titleKey: "events.userRegistered.title",
      messageKey: "events.userRegistered.message",
      messageParams: { name: user.fullName, role: user.role || "etudiant" },
      message: `${user.fullName} joined the platform as ${user.role || "etudiant"}.`,
      type: "info",
    });

    return res.status(200).json(buildAuthResponse(user, user.password ? "email" : "google"));
  } catch (error) {
    console.error("[auth] verifyEmail error:", error.message);
    return res.status(500).json(withMessageMetadata({ message: "Server error", error: error.message }, "common.serverError"));
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
      return res.status(400).json(withMessageMetadata({ message: "Email is required" }, "auth.emailRequired"));
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json(withMessageMetadata({ message: "No account was found for this email" }, "auth.accountNotFound"));
    }

    if (user.emailVerified !== false) {
      return res.status(200).json(withMessageMetadata({
        message: "This email is already verified. You can log in now.",
        alreadyVerified: true,
      }, "auth.emailAlreadyVerifiedLoginNow"));
    }

    const verificationCode = setEmailVerificationCode(user);
    await user.save();

    const emailResult = await sendEmailVerificationCode(user.email, verificationCode, recipientUiLanguage(user, req));
    const response = withMessageMetadata({
      message: "A new verification code has been sent.",
      email: user.email,
      emailSent: emailResult.sent === true,
    }, "auth.newVerificationCodeSent");

    if (emailResult.devFallback && process.env.NODE_ENV !== "production") {
      response.devVerificationCode = emailResult.verificationCode;
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("[auth] resendVerificationCode error:", error.message);
    return res.status(500).json(withMessageMetadata({ message: "Server error", error: error.message }, "common.serverError"));
  }
};
const getProfile = async (req, res) => {
  try {

    const user = await User.findById(req.user._id)
      .select("fullName email avatar role uiLanguage hasCompletedOnboarding emailVerified googleId password");

    res.json({
      _id: user._id, fullName: user.fullName, email: user.email, avatar: user.avatar,
      role: user.role || "etudiant", uiLanguage: user.uiLanguage || "fr",
      hasCompletedOnboarding: user.hasCompletedOnboarding === true,
      emailVerified: user.emailVerified !== false,
      authProvider: user.googleId && !user.password ? "google" : "email",
      googleConnected: Boolean(user.googleId), hasPassword: Boolean(user.password),
    });

  } catch (error) {

    res.status(500).json({
      message: "Server error",
      messageKey: "common.serverError"
    });

  }
};

const getPreferences = async (req, res) => {
  return res.json({ uiLanguage: req.user.uiLanguage || "fr" });
};

const updatePreferences = async (req, res) => {
  const { uiLanguage } = req.body || {};
  if (uiLanguage !== "en" && uiLanguage !== "fr") {
    return res.status(400).json(withMessageMetadata({ message: "uiLanguage must be en or fr" }, "auth.invalidUiLanguage"));
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { uiLanguage } },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json(withMessageMetadata({ message: "User not found" }, "auth.userNotFound"));
    }

    return res.json({ uiLanguage: user.uiLanguage || "fr" });
  } catch (error) {
    return res.status(500).json(withMessageMetadata({ message: "Server error", error: error.message }, "common.serverError"));
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json(withMessageMetadata({ message: "User not found" }, "auth.userNotFound"));
    }

    if (user.googleId && !user.password) {
      return res.status(403).json(withMessageMetadata({
        message: "This account is connected with Google. Profile and password changes are managed by Google.",
      }, "auth.googleProfileManaged"));
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
      if (rejectWeakPassword(newPassword, res)) return;

      if (!currentPassword) {
        return res.status(400).json(withMessageMetadata({ message: "Current password is required" }, "auth.currentPasswordRequired"));
      }

      const isCurrentPasswordValid = await user.matchPassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(401).json(withMessageMetadata({ message: "Current password is incorrect" }, "auth.currentPasswordIncorrect"));
      }

      user.password = newPassword;
      user.sessionVersion = crypto.randomUUID();
      passwordChanged = true;
    }

    await user.save();

    await createNotification({
      user: req.user._id,
      title: passwordChanged ? "Password updated" : "Profile updated",
      titleKey: passwordChanged ? "events.passwordUpdated.title" : "events.profileUpdated.title",
      messageKey: passwordChanged ? "events.passwordUpdated.message" : "events.profileUpdated.message",
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
      googleConnected: Boolean(user.googleId), hasPassword: Boolean(user.password),
      emailVerified: user.emailVerified !== false,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      role: user.role || "etudiant",
      uiLanguage: user.uiLanguage || "fr",
      passwordChanged,
      ...(passwordChanged ? { token: generateToken(user._id, user.sessionVersion) } : {}),
    });
  } catch (error) {
    return res.status(500).json(withMessageMetadata({ message: "Server error", error: error.message }, "common.serverError"));
  }
};
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({
        message: "Si un compte existe, un email a été envoyé.",
        messageKey: "auth.passwordResetIfAccountExists",
      });
    }

    const resetToken = crypto
      .randomBytes(32)
      .toString("hex");

    user.resetToken = resetToken;

    user.resetTokenExpiry =
      new Date(Date.now() + 60 * 60 * 1000);

    await user.save();

    const emailResult = await sendResetPasswordEmail(user.email, resetToken, recipientUiLanguage(user, req));

    const response = withMessageMetadata({
      message: "Si un compte existe, un email a été envoyé.",
      emailSent: emailResult.sent === true,
    }, "auth.passwordResetIfAccountExists");

    if (emailResult.devFallback && process.env.NODE_ENV !== "production") {
      response.devResetLink = emailResult.resetLink;
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("[auth] forgotPassword error:", error.message);
    return res.status(500).json({
      message: "Server error",
      messageKey: "common.serverError",
      error: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json(withMessageMetadata({ message: "Token and password are required" }, "auth.resetTokenAndPasswordRequired"));
    }

    if (rejectWeakPassword(password, res)) return;

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json(withMessageMetadata({ message: "Invalid or expired reset link" }, "auth.invalidResetLink"));
    }

    user.password = password;
    user.sessionVersion = crypto.randomUUID();
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    return res.status(200).json(withMessageMetadata({ message: "Password reset successfully" }, "auth.passwordResetSuccess"));
  } catch (error) {
    console.error("[auth] resetPassword error:", error.message);
    return res.status(500).json({
      message: "Server error",
      messageKey: "common.serverError",
      error: error.message,
    });
  }
};
// Email equality never authorizes linking an existing account.
const googleLogin = async (req, res) => {
  try {
    const identity = await googleIdentity.verifyGoogleIdentity(req.body?.credential);
    const { googleId, email, fullName, picture, authoritativeEmail } = identity;
    let user = await User.findOne({ googleId });
    if (!user) {
      if (await User.exists({ email })) {
        return res.status(409).json(withMessageMetadata({ message: "Sign in with your existing login method, then connect Google in Account & Security.", code: "GOOGLE_LINK_REQUIRED" }, "auth.googleLinkRequired"));
      }
      user = await User.create({ fullName: fullName || email.split("@")[0], email, googleId,
        avatar: picture, role: "etudiant", emailVerified: authoritativeEmail, uiLanguage: requestUiLanguage(req) });
      if (authoritativeEmail) {
        await getWalletForUser(user);
        await createAdminNotification({ title: "New Google user registered", titleKey: "events.googleUserRegistered.title",
          messageKey: "events.googleUserRegistered.message", messageParams: { name: user.fullName },
          message: user.fullName + " joined the platform with Google.", type: "info" });
      }
    }
    if (user.emailVerified === false) {
      const verificationCode = setEmailVerificationCode(user);
      await user.save();
      const result = await sendEmailVerificationCode(user.email, verificationCode, recipientUiLanguage(user, req));
      const response = withMessageMetadata({ message: "Please verify your email before logging in. A new code has been sent.",
        requiresEmailVerification: true, email: user.email, emailSent: result.sent === true }, "auth.verifyEmailBeforeLogin");
      if (result.devFallback && process.env.NODE_ENV !== "production") response.devVerificationCode = result.verificationCode;
      return res.status(403).json(response);
    }
    return res.json(buildAuthResponse(user, "google"));
  } catch (error) {
    const collision = error.code === 11000;
    return res.status(collision ? 409 : error.status || 500).json(withMessageMetadata({
      message: collision ? "Sign in using your existing login method before connecting Google." : "Google authentication failed.",
      ...(collision ? { code: "GOOGLE_LINK_REQUIRED" } : {}),
    }, collision ? "auth.googleLinkRequired" : "auth.googleAuthenticationFailed"));
  }
};

// Require both an authenticated session and current password proof to add a login method.
const connectGoogle = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user?.password || user.emailVerified === false || !req.body?.currentPassword || !await user.matchPassword(req.body.currentPassword)) {
      return res.status(401).json(withMessageMetadata({ message: "Confirm your current password to connect Google." }, "auth.googlePasswordRequired"));
    }
    const { googleId, email } = await googleIdentity.verifyGoogleIdentity(req.body.credential);
    if (email !== user.email || (user.googleId && user.googleId !== googleId)) {
      return res.status(409).json(withMessageMetadata({ message: "Choose the Google account with your SmartPFE email. An existing Google link cannot be replaced." }, "auth.googleLinkConflict"));
    }
    if (user.googleId === googleId) return res.json(buildAuthResponse(user, "email"));
    const linked = await User.findOneAndUpdate({ _id: user._id, password: user.password, emailVerified: true,
      $and: [{ $or: [{ googleId: { $exists: false } }, { googleId: null }] },
        { $or: [{ sessionVersion: user.sessionVersion || "0" }, { sessionVersion: { $exists: false } }] }] },
      { $set: { googleId, sessionVersion: crypto.randomUUID() } }, { new: true, runValidators: true });
    if (!linked) return res.status(409).json(withMessageMetadata({ message: "The account changed. Please sign in again before connecting Google." }, "auth.googleLinkConflict"));
    return res.json(buildAuthResponse(linked, "email"));
  } catch (error) {
    return res.status(error.code === 11000 ? 409 : error.status || 500).json(withMessageMetadata({ message: "Could not connect Google. Please try again." }, error.code === 11000 ? "auth.googleLinkConflict" : "auth.googleAuthenticationFailed"));
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyEmail,
  resendVerificationCode,
  getProfile,
  getPreferences,
  updatePreferences,
  updateProfile,
  forgotPassword,
  resetPassword,
  googleLogin,
  connectGoogle,
};
