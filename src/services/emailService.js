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

module.exports = {
  sendResetPasswordEmail,
};