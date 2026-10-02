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

const sendPurchasedCreditsEmail = async ({ email, fullName, amount, balance }) => {
  const transporter = createTransporter();
  const safeName = escapeHtml(fullName || "there");
  const safeAmount = Math.max(0, Math.trunc(Number(amount) || 0));
  const safeBalance = Math.max(0, Math.trunc(Number(balance) || 0));

  if (!transporter) {
    console.info("[emailService] Email not configured. Dev fallback for purchased-credit confirmation:", { email, amount: safeAmount });
    if (process.env.NODE_ENV !== "production") return { devFallback: true, sent: false };
    throw new Error("Email service is not configured. Please set EMAIL_USER and EMAIL_PASS.");
  }

  await transporter.sendMail({
    from: `"SmartPFE" <${getSenderAddress()}>`,
    to: email,
    subject: `${safeAmount} SmartPFE credits are ready for your project`,
    html: `
      <div style="margin:0;padding:32px 16px;background:#f7f8fc;font-family:Arial,sans-serif;color:#172033;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6e8ef;border-radius:20px;overflow:hidden;">
          <div style="padding:28px 32px;background:linear-gradient(135deg,#5b4bdb,#8b5cf6);color:#ffffff;">
            <div style="font-size:24px;font-weight:800;letter-spacing:-0.5px;">SmartPFE</div>
            <div style="margin-top:8px;font-size:15px;opacity:.9;">Your project momentum just got a boost.</div>
          </div>
          <div style="padding:32px;">
            <h1 style="margin:0 0 12px;font-size:23px;line-height:1.25;">Your credits are ready, ${safeName}.</h1>
            <p style="margin:0;color:#526076;font-size:15px;line-height:1.6;">Your purchase has been confirmed and added to your SmartPFE account.</p>
            <div style="margin:24px 0;padding:20px;border-radius:16px;background:#fff8df;border:1px solid #f6d36b;text-align:center;">
              <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#80600d;">Credits added</div>
              <div style="margin-top:6px;font-size:36px;font-weight:800;color:#352b08;">+${safeAmount}</div>
              <div style="margin-top:6px;font-size:13px;color:#80600d;">Purchased balance: ${safeBalance} credits</div>
            </div>
            <p style="margin:0;color:#526076;font-size:14px;line-height:1.6;">You can now continue generating your report, presentation, pitch, and defense preparation materials from your workspace.</p>
            <p style="margin:24px 0 0;color:#8a94a6;font-size:12px;line-height:1.5;">If you did not make this purchase, please contact the SmartPFE team.</p>
          </div>
        </div>
      </div>`,
  });

  return { sent: true };
};

const sendCreditPurchaseRequestEmail = async ({ request }) => {
  const transporter = createTransporter();
  const recipient =
    process.env.ADMIN_CREDIT_REQUEST_EMAIL ||
    process.env.ADMIN_EMAIL ||
    process.env.CONTACT_TO_EMAIL ||
    process.env.EMAIL_FROM ||
    process.env.EMAIL_USER;
  const requestId = String(request._id || request.id || "");
  const createdAt = request.createdAt ? new Date(request.createdAt) : new Date();
  const payload = {
    requestId,
    studentName: request.studentName,
    email: request.email,
    phone: request.phone,
    requestedCredits: request.requestedCredits,
    packageLabel: request.packageLabel || "Custom amount",
    price: request.price,
    currency: request.currency || "TND",
    createdAt: createdAt.toISOString(),
  };

  if (!transporter || !recipient) {
    console.info("[emailService] Email not configured. Dev fallback for credit purchase request:", payload);
    if (process.env.NODE_ENV !== "production") return { devFallback: true, sent: false };
    throw new Error("Admin credit request email is not configured.");
  }

  await transporter.sendMail({
    from: `"SmartPFE" <${getSenderAddress()}>`,
    to: recipient,
    replyTo: request.email,
    subject: "New Credit Purchase Request",
    html: `
      <div style="margin:0;padding:28px 16px;background:#f7f8fc;font-family:Arial,sans-serif;color:#172033;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e6e8ef;border-radius:18px;overflow:hidden;">
          <div style="padding:24px 28px;background:#172033;color:#ffffff;">
            <div style="font-size:22px;font-weight:800;">New Credit Purchase Request</div>
            <div style="margin-top:6px;font-size:13px;color:#d9deea;">Review this request from the Admin Dashboard.</div>
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#526076;">
              A student submitted a manual credit purchase request. Contact the student to confirm payment, then fulfill the wallet from the Admin Dashboard.
            </p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:9px 0;color:#697386;">Student name</td><td style="padding:9px 0;font-weight:700;">${escapeHtml(request.studentName)}</td></tr>
              <tr><td style="padding:9px 0;color:#697386;">Student email</td><td style="padding:9px 0;font-weight:700;">${escapeHtml(request.email)}</td></tr>
              <tr><td style="padding:9px 0;color:#697386;">Phone number</td><td style="padding:9px 0;font-weight:700;">${escapeHtml(request.phone)}</td></tr>
              <tr><td style="padding:9px 0;color:#697386;">Requested credits</td><td style="padding:9px 0;font-weight:700;">${escapeHtml(request.requestedCredits)}</td></tr>
              <tr><td style="padding:9px 0;color:#697386;">Package</td><td style="padding:9px 0;font-weight:700;">${escapeHtml(request.packageLabel || "Custom amount")}</td></tr>
              <tr><td style="padding:9px 0;color:#697386;">Price</td><td style="padding:9px 0;font-weight:700;">${escapeHtml(request.price)} ${escapeHtml(request.currency || "TND")}</td></tr>
              <tr><td style="padding:9px 0;color:#697386;">Request date</td><td style="padding:9px 0;font-weight:700;">${escapeHtml(createdAt.toLocaleString("en-GB", { timeZone: "Africa/Tunis" }))}</td></tr>
              <tr><td style="padding:9px 0;color:#697386;">Request ID</td><td style="padding:9px 0;font-family:monospace;font-weight:700;">${escapeHtml(requestId)}</td></tr>
            </table>
          </div>
        </div>
      </div>`,
  });

  return { sent: true };
};

module.exports = {
  sendResetPasswordEmail,
  sendEmailVerificationCode,
  sendContactMessageEmail,
  sendPurchasedCreditsEmail,
  sendCreditPurchaseRequestEmail,
};
