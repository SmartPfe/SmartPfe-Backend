const express = require("express");
const router = express.Router();

const {
  submitContactMessage,
} = require("../controllers/contactController");

const { contactLimiter, contactBody } = require("../middleware/contactGuard");
router.post("/", contactLimiter, contactBody, submitContactMessage);

module.exports = router;
