const { sendContactMessageEmail } = require("../services/emailService");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeField = (value) => String(value || "").trim();

const submitContactMessage = async (req, res) => {
  const name = normalizeField(req.body.name);
  const email = normalizeField(req.body.email).toLowerCase();
  const subject = normalizeField(req.body.subject);
  const message = normalizeField(req.body.message);

  if (!name || !email || !subject || !message) {
    return res.status(400).json({
      message: "Please complete all contact form fields.",
    });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({
      message: "Please enter a valid email address.",
    });
  }

  if (name.length > 120 || email.length > 160 || subject.length > 180 || message.length > 4000) {
    return res.status(400).json({
      message: "Your message is too long. Please shorten it and try again.",
    });
  }

  try {
    const result = await sendContactMessageEmail({
      name,
      email,
      subject,
      message,
    });

    res.status(200).json({
      message: result.devFallback
        ? "Message received in development mode. Configure contact email settings to send it."
        : "Your message has been sent successfully.",
      devFallback: Boolean(result.devFallback),
    });
  } catch (error) {
    console.error("[contact] submitContactMessage error:", error.message);
    res.status(500).json({
      message: "Could not send your message. Please try again later.",
    });
  }
};

module.exports = {
  submitContactMessage,
};
