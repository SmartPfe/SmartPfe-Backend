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
} = require("../controllers/authController");

const {
  protect,
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

router.get("/preferences", protect, getPreferences);
router.put("/preferences", protect, updatePreferences);

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
