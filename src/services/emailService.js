const nodemailer = require("nodemailer");

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  const user = process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : "";
  const pass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, "").trim() : "";

  // If Gmail or general credentials are provided
  if (user && pass) {
    // If specific SMTP host is configured, use it; otherwise default to standard Gmail service
    if (process.env.SMTP_HOST) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
        auth: {
          user,
          pass,
        },
      });
    }

    return nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: {
        user,
        pass,
      },
    });
  }

  return null;
};

const getSenderAddress = () => {
  return process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@smartpfe.com";
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const sendResetPasswordEmail = async (email, token) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  const transporter = createTransporter();

  // If email credentials are not yet configured, use development fallback
  if (!transporter) {
    console.info("[emailService] EMAIL_USER/EMAIL_PASS not configured. Dev fallback for reset password:", {
      email,
      resetLink,
    });

    if (process.env.NODE_ENV !== "production") {
      return {
        devFallback: true,
        resetLink,
      };
    }

    throw new Error("Email service is not configured. Please set EMAIL_USER and EMAIL_PASS.");
  }

  try {
    await transporter.sendMail({
      from: `"PFE Guidance Platform" <${getSenderAddress()}>`,
      to: email,
      subject: "Réinitialisation du mot de passe",
      html: `
        <h2>Réinitialisation du mot de passe</h2>
        <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
        <p>
          <a href="${resetLink}">
            Réinitialiser mon mot de passe
          </a>
        </p>
        <p>Ce lien expire dans 1 heure.</p>
      `,
    });

    return {
      sent: true,
    };
  } catch (error) {
    console.error("[emailService] NODEMAILER RESET PASSWORD ERROR:", error);

    if (process.env.NODE_ENV !== "production") {
      return {
        devFallback: true,
        resetLink,
      };
    }

    throw error;
  }
};

const sendEmailVerificationCode = async (email, code) => {
  const transporter = createTransporter();

  // If email credentials are not yet configured, use development fallback
  if (!transporter) {
    console.info("[emailService] EMAIL_USER/EMAIL_PASS not configured. Dev fallback for verification code:", {
      email,
      code,
    });

    if (process.env.NODE_ENV !== "production") {
      return {
        devFallback: true,
        verificationCode: code,
      };
    }

    throw new Error("Email service is not configured. Please set EMAIL_USER and EMAIL_PASS.");
  }

  try {
    await transporter.sendMail({
      from: `"PFE Guidance Platform" <${getSenderAddress()}>`,
      to: email,
      subject: "Verify your email",
      html: `
        <h2>Verify your email</h2>
        <p>Use this code to activate your Smart PFE account:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 8px;">
          ${code}
        </p>
        <p>This code expires in 15 minutes.</p>
      `,
    });

    return {
      sent: true,
    };
  } catch (error) {
    console.error("[emailService] NODEMAILER VERIFICATION CODE ERROR:", error);

    if (process.env.NODE_ENV !== "production") {
      return {
        devFallback: true,
        verificationCode: code,
      };
    }

    throw error;
  }
};

const sendContactMessageEmail = async ({ name, email, subject, message }) => {
  const contactRecipient = process.env.CONTACT_TO_EMAIL || process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const transporter = createTransporter();

  if (!transporter || !contactRecipient) {
    console.info("[contact] Email not configured. Dev fallback:", {
      name,
      email,
      subject,
      message,
    });

    if (process.env.NODE_ENV !== "production") {
      return {
        devFallback: true,
      };
    }

    throw new Error("Contact email is not configured");
  }

  try {
    await transporter.sendMail({
      from: `"PFE Guidance Platform" <${getSenderAddress()}>`,
      to: contactRecipient,
      replyTo: `"${name}" <${email}>`,
      subject: `[PFE Guidance Contact] ${subject}`,
      html: `
        <h2>New PFE Guidance contact message</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
      `,
    });

    return {
      sent: true,
    };
  } catch (error) {
    console.error("[emailService] NODEMAILER CONTACT ERROR:", error);

    if (process.env.NODE_ENV !== "production") {
      return {
        devFallback: true,
      };
    }

    throw error;
  }
};

module.exports = {
  sendResetPasswordEmail,
  sendEmailVerificationCode,
  sendContactMessageEmail,
};
