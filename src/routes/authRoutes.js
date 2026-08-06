const express = require("express");
const router = express.Router();

const {
  registerUser,
  loginUser,
  verifyEmail,
  resendVerificationCode,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
  googleLogin,
} = require("../controllers/authController");

const {
  protect,
} = require("../middleware/authMiddleware");

router.post("/register", registerUser);

router.post("/verify-email", verifyEmail);

router.post("/resend-verification-code", resendVerificationCode);

router.post("/login", loginUser);

router.post("/google", googleLogin);

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
