const express = require("express");
const router = express.Router();
const { publicAuthLimiter, validateAuthInput } = require("../middleware/authRequestGuard");
router.use((req, res, next) => req.method === "POST" ? publicAuthLimiter(req, res, next) : next());
router.use(express.json({ limit: "16kb" }));
router.use(validateAuthInput);

const {
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
  disconnectGoogle,
} = require("../controllers/authController");

const {
  protect,
  studentOnly,
} = require("../middleware/authMiddleware");

router.post("/register", registerUser);
router.post("/logout-all", protect, async (req, res, next) => {
  try {
    const crypto = require("crypto");
    const User = require("../models/User");
    await User.updateOne({ _id: req.user._id }, { $set: { sessionVersion: crypto.randomUUID() } });
    res.json({ message: "All sessions signed out." });
  } catch (error) { next(error); }
});

router.post("/verify-email", verifyEmail);

router.post("/resend-verification-code", resendVerificationCode);

router.post("/login", loginUser);

router.post("/google", googleLogin);
router.post("/google/connect", protect, connectGoogle);
router.post("/google/disconnect", protect, disconnectGoogle);

router.get("/preferences", protect, getPreferences);
router.put("/preferences", protect, updatePreferences);

router.get("/workspace-tour", protect, studentOnly, (req, res) => {
  res.json({ status: req.user.workspaceTourStatus || "inactive",
    eligible: req.user.hasCompletedOnboarding === true });
});
router.put("/workspace-tour", protect, studentOnly, async (req, res, next) => {
  const { status } = req.body || {};
  if (status !== "completed" && status !== "skipped") return res.status(400).json({ message: "Invalid tour status" });
  try {
    const User = require("../models/User");
    const result = await User.updateOne({ _id: req.user._id, hasCompletedOnboarding: true }, { $set: { workspaceTourStatus: status } });
    if (!result.matchedCount) return res.status(409).json({ message: "Complete onboarding first" });
    res.json({ status });
  } catch (error) { next(error); }
});

router.get(
  "/profile",
  protect,
  getProfile
);
router.put(
  "/profile",
  protect,
  updateProfile
);
router.post("/forgot-password",forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;
