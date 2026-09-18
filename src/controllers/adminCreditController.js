const User = require("../models/User");
const { sendPurchasedCreditsEmail } = require("../services/emailService");
const {
  CreditError,
  getCreditSettings,
  getWalletForUser,
  listPolicies,
  updatePolicy,
  updateSettings,
  adjustUserCredits,
  listTransactions,
  getPolicyChanges,
} = require("../services/creditService");

const respondError = (res, error, fallback) => {
  const status = error instanceof CreditError ? error.status : error?.name === "ValidationError" ? 400 : 500;
  res.status(status).json({
    message: error.message || fallback,
    ...(error.code ? { code: error.code } : {}),
    ...(error.details || {}),
  });
};

const getCreditEconomy = async (req, res) => {
  try {
    const [settings, policies, history] = await Promise.all([
      getCreditSettings(),
      listPolicies(),
      getPolicyChanges(50),
    ]);
    res.status(200).json({ settings, policies, history });
  } catch (error) {
    console.error("[admin][credits] get economy error:", error.message);
    respondError(res, error, "Failed to load credit economy.");
  }
};

const patchCreditPolicy = async (req, res) => {
  try {
    const policy = await updatePolicy({
      key: req.params.key,
      updates: req.body,
      actor: req.user._id,
      reason: req.body.reason,
    });
    res.status(200).json({ policy });
  } catch (error) {
    console.error("[admin][credits] update policy error:", error.message);
    respondError(res, error, "Failed to update credit price.");
  }
};

const patchCreditSettings = async (req, res) => {
  try {
    const settings = await updateSettings({
      updates: req.body,
      actor: req.user._id,
      reason: req.body.reason,
    });
    res.status(200).json({ settings });
  } catch (error) {
    console.error("[admin][credits] update settings error:", error.message);
    respondError(res, error, "Failed to update credit settings.");
  }
};

const adjustCredits = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId).select("fullName email emailVerified role");
    if (!targetUser) return res.status(404).json({ message: "User not found." });
    if ((targetUser.role || "etudiant") === "admin") {
      return res.status(403).json({ message: "Admin accounts do not have student wallets." });
    }
    await getWalletForUser(targetUser);
    const amount = Number(req.body.amount);
    const bucket = req.body.bucket || "purchased";
    const { transaction, idempotentReplay } = await adjustUserCredits({
      userId: targetUser._id,
      amount,
      bucket,
      actor: req.user._id,
      reason: req.body.reason,
      reference: req.body.reference,
      requestId: req.headers["x-idempotency-key"],
    });
    const wallet = await getWalletForUser(targetUser);
    let emailSent = false;
    let emailDeliveryWarning = false;
    if (bucket === "purchased" && amount > 0 && transaction.status === "settled" && !idempotentReplay) {
      try {
        const result = await sendPurchasedCreditsEmail({
          email: targetUser.email,
          fullName: targetUser.fullName,
          amount,
          balance: wallet.purchased,
        });
        emailSent = result.sent === true;
      } catch (emailError) {
        emailDeliveryWarning = true;
        console.error("[admin][credits] purchased-credit email error:", emailError.message);
      }
    }
    res.status(200).json({ transaction, wallet, emailSent, emailDeliveryWarning });
  } catch (error) {
    console.error("[admin][credits] adjustment error:", error.message);
    respondError(res, error, "Failed to adjust credits.");
  }
};

const getUserCreditHistory = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("fullName email emailVerified role");
    if (!user) return res.status(404).json({ message: "User not found." });
    if ((user.role || "etudiant") === "admin") {
      return res.status(403).json({ message: "Admin accounts do not have student wallets." });
    }
    const [wallet, transactions] = await Promise.all([
      getWalletForUser(user),
      listTransactions({ userId: user._id, limit: req.query.limit, before: req.query.before }),
    ]);
    res.status(200).json({ user, wallet, ...transactions });
  } catch (error) {
    console.error("[admin][credits] user history error:", error.message);
    respondError(res, error, "Failed to load user credit history.");
  }
};

module.exports = {
  getCreditEconomy,
  patchCreditPolicy,
  patchCreditSettings,
  adjustCredits,
  getUserCreditHistory,
};
