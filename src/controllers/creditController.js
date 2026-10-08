const {
  getWalletForUser,
  listPolicies,
  listTransactions,
  CreditError,
} = require("../services/creditService");
const { withErrorMessageMetadata } = require("../lib/interfaceMessages");

const sendError = (res, error, fallback, fallbackKey) => {
  const status = error instanceof CreditError ? error.status : 500;
  return res.status(status).json(withErrorMessageMetadata({
    message: error.message || fallback,
    ...(error.code ? { code: error.code } : {}),
    ...(error.details || {}),
  }, error, fallbackKey));
};

const getMyWallet = async (req, res) => {
  try {
    const wallet = await getWalletForUser(req.user);
    res.status(200).json({ wallet });
  } catch (error) {
    console.error("[credits] get wallet error:", error.message);
    sendError(res, error, "Failed to load credit wallet.", "credits.loadWalletFailed");
  }
};

const getCatalog = async (req, res) => {
  try {
    const policies = await listPolicies();
    res.status(200).json({
      policies: policies.map((policy) => ({
        key: policy.key,
        label: policy.label,
        group: policy.group,
        cost: policy.cost,
        freeUsesPerDay: policy.freeUsesPerDay,
        enabled: policy.enabled,
        version: policy.version,
      })),
    });
  } catch (error) {
    console.error("[credits] get catalog error:", error.message);
    sendError(res, error, "Failed to load credit prices.", "credits.loadCatalogFailed");
  }
};

const getMyTransactions = async (req, res) => {
  try {
    const result = await listTransactions({
      userId: req.user._id,
      limit: req.query.limit,
      before: req.query.before,
    });
    res.status(200).json(result);
  } catch (error) {
    console.error("[credits] get transactions error:", error.message);
    sendError(res, error, "Failed to load credit history.", "credits.loadHistoryFailed");
  }
};

module.exports = { getMyWallet, getCatalog, getMyTransactions };
