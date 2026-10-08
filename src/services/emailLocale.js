const EMAIL_COPY = {
  en: {
    reset: {
      subject: "Reset your password",
      title: "Reset your password",
      intro: "You requested a password reset.",
      action: "Reset my password",
      expiry: "This link expires in 1 hour.",
    },
    verification: {
      subject: "Verify your email",
      title: "Verify your email",
      intro: "Use this code to activate your Smart PFE account:",
      expiry: "This code expires in 15 minutes.",
    },
    creditsReady: {
      subject: (amount) => `${amount} SmartPFE credits are ready for your project`,
      tagline: "Your project momentum just got a boost.",
      title: (name) => name ? `Your credits are ready, ${name}.` : "Your credits are ready.",
      confirmed: "Your purchase has been confirmed and added to your SmartPFE account.",
      added: "Credits added",
      balance: (amount) => `Purchased balance: ${amount} credits`,
      next: "You can now continue generating your report, presentation, pitch, and defense preparation materials from your workspace.",
      help: "If you did not make this purchase, please contact the SmartPFE team.",
    },
    adminCreditRequest: {
      subject: "New Credit Purchase Request",
      title: "New Credit Purchase Request",
      dashboard: "Review this request from the Admin Dashboard.",
      intro: "A student submitted a manual credit purchase request. Contact the student to confirm payment, then fulfill the wallet from the Admin Dashboard.",
      studentName: "Student name", studentEmail: "Student email", phone: "Phone number",
      credits: "Requested credits", package: "Package", price: "Price", requestDate: "Request date", requestId: "Request ID",
      customAmount: "Custom amount",
    },
    creditReceipt: {
      subject: (amount) => `We've received your request for ${amount} SmartPFE credits`,
      received: "Your credit request is received",
      thankYou: (name) => `Thank you, ${name}.`,
      intro: "Your credit request has been submitted successfully.",
      requestId: "Request ID", submitted: "Submitted", package: "Package", credits: "Credits requested",
      amount: "Amount to pay", phone: "Contact phone", status: "Status", pending: "Pending — awaiting contact from our team",
      nextSteps: "A team member will contact you as soon as possible to explain how to make your payment. After your payment is verified, an administrator will add the credits to your wallet. Your request is saved; no payment has been collected through SmartPFE.",
      viewHistory: "View my credit history",
      keepRecord: "Keep this email as a record of your request. You can follow its status anytime in Settings → Credit History.",
      tunisiaTime: "Tunisia time",
      customAmount: "Custom amount",
    },
  },
  fr: {
    reset: {
      subject: "Réinitialiser votre mot de passe",
      title: "Réinitialiser votre mot de passe",
      intro: "Vous avez demandé la réinitialisation de votre mot de passe.",
      action: "Réinitialiser mon mot de passe",
      expiry: "Ce lien expire dans 1 heure.",
    },
    verification: {
      subject: "Vérifiez votre adresse e-mail",
      title: "Vérifiez votre adresse e-mail",
      intro: "Utilisez ce code pour activer votre compte Smart PFE :",
      expiry: "Ce code expire dans 15 minutes.",
    },
    creditsReady: {
      subject: (amount) => `${amount} crédits SmartPFE sont prêts pour votre projet`,
      tagline: "Votre projet vient de prendre un nouvel élan.",
      title: (name) => name ? `Vos crédits sont prêts, ${name}.` : "Vos crédits sont prêts.",
      confirmed: "Votre achat a été confirmé et ajouté à votre compte SmartPFE.",
      added: "Crédits ajoutés",
      balance: (amount) => `Solde acheté : ${amount} crédits`,
      next: "Vous pouvez maintenant continuer à créer le rapport, la présentation, le pitch et les supports de préparation à la soutenance depuis votre espace de travail.",
      help: "Si vous n’êtes pas à l’origine de cet achat, contactez l’équipe SmartPFE.",
    },
    adminCreditRequest: {
      subject: "Nouvelle demande d’achat de crédits",
      title: "Nouvelle demande d’achat de crédits",
      dashboard: "Consultez cette demande dans le tableau de bord d’administration.",
      intro: "Un étudiant a soumis une demande manuelle d’achat de crédits. Contactez-le pour confirmer le paiement, puis créditez son portefeuille depuis le tableau de bord d’administration.",
      studentName: "Nom de l’étudiant", studentEmail: "E-mail de l’étudiant", phone: "Numéro de téléphone",
      credits: "Crédits demandés", package: "Offre", price: "Prix", requestDate: "Date de la demande", requestId: "Identifiant de la demande",
      customAmount: "Montant personnalisé",
    },
    creditReceipt: {
      subject: (amount) => `Nous avons reçu votre demande de ${amount} crédits SmartPFE`,
      received: "Votre demande de crédits a bien été reçue",
      thankYou: (name) => `Merci, ${name}.`,
      intro: "Votre demande de crédits a été envoyée avec succès.",
      requestId: "Identifiant de la demande", submitted: "Envoyée le", package: "Offre", credits: "Crédits demandés",
      amount: "Montant à payer", phone: "Téléphone de contact", status: "Statut", pending: "En attente — notre équipe doit vous contacter",
      nextSteps: "Un membre de l’équipe vous contactera dès que possible pour vous expliquer les modalités de paiement. Une fois le paiement vérifié, un administrateur ajoutera les crédits à votre portefeuille. Votre demande est enregistrée ; aucun paiement n’a été encaissé par SmartPFE.",
      viewHistory: "Voir mon historique de crédits",
      keepRecord: "Conservez cet e-mail comme preuve de votre demande. Vous pouvez suivre son statut dans Paramètres → Historique des crédits.",
      tunisiaTime: "heure de Tunisie",
      customAmount: "Montant personnalisé",
    },
  },
};

const normalizeEmailLocale = (uiLanguage) => {
  const language = typeof uiLanguage === "string"
    ? uiLanguage.trim().toLowerCase().split(/[-_]/, 1)[0]
    : "";
  return language === "fr" ? "fr" : "en";
};

const getEmailCopy = (uiLanguage = "en") => EMAIL_COPY[normalizeEmailLocale(uiLanguage)];

module.exports = { normalizeEmailLocale, getEmailCopy };
