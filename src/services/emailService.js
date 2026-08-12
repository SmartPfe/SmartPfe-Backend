const SibApiV3Sdk = require("sib-api-v3-sdk");

const client = SibApiV3Sdk.ApiClient.instance;

client.authentications["api-key"].apiKey =
  process.env.BREVO_API_KEY;

const emailApi =
  new SibApiV3Sdk.TransactionalEmailsApi();

const sendResetPasswordEmail = async (email, token) => {

const resetLink =
  `${process.env.FRONTEND_URL}/reset-password/${token}`;

  try {
    await emailApi.sendTransacEmail({
      sender: {
        email: process.env.EMAIL_FROM,
        name: "PFE Guidance Platform",
      },

      to: [
        {
          email,
        },
      ],

      subject: "Réinitialisation du mot de passe",

      htmlContent: `
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
    console.error("BREVO FULL ERROR:");
    console.dir(error, { depth: null });

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
  try {
    await emailApi.sendTransacEmail({
      sender: {
        email: process.env.EMAIL_FROM,
        name: "PFE Guidance Platform",
      },

      to: [
        {
          email,
        },
      ],

      subject: "Verify your email",

      htmlContent: `
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
    console.error("BREVO FULL ERROR:");
    console.dir(error, { depth: null });

    if (process.env.NODE_ENV !== "production") {
      return {
        devFallback: true,
        verificationCode: code,
      };
    }

    throw error;
  }
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const sendContactMessageEmail = async ({ name, email, subject, message }) => {
  const contactRecipient = process.env.CONTACT_TO_EMAIL || process.env.EMAIL_FROM;

  if (!process.env.BREVO_API_KEY || !process.env.EMAIL_FROM || !contactRecipient) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[contact] Email not configured. Dev fallback:", {
        name,
        email,
        subject,
        message,
      });

      return {
        devFallback: true,
      };
    }

    throw new Error("Contact email is not configured");
  }

  try {
    await emailApi.sendTransacEmail({
      sender: {
        email: process.env.EMAIL_FROM,
        name: "PFE Guidance Platform",
      },
      to: [
        {
          email: contactRecipient,
        },
      ],
      replyTo: {
        email,
        name,
      },
      subject: `[PFE Guidance Contact] ${subject}`,
      htmlContent: `
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
    console.error("BREVO CONTACT ERROR:");
    console.dir(error, { depth: null });

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
