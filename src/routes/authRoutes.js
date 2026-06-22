const express = require("express");
const router = express.Router();

const {
  registerUser,
  loginUser,
  getProfile,
  forgotPassword,
  resetPassword,
  googleLogin,
} = require("../controllers/authController");

const {
  protect,
} = require("../middleware/authMiddleware");

router.post("/register", registerUser);

router.post("/login", loginUser);

router.post("/google", googleLogin);

router.get(
  "/profile",
  protect,
  getProfile
);
router.post("/forgot-password",forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;