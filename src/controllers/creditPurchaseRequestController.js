const {
  getPurchaseOptions,
  createCreditPurchaseRequest,
  listMyCreditPurchaseRequests,
  listAdminCreditPurchaseRequests,
  getAdminCreditPurchaseRequest,
  updateCreditPurchaseRequestStatus,
  addRequestedCreditsToWallet,
} = require("../services/creditPurchaseRequestService");
const { CreditError } = require("../services/creditService");
const { withErrorMessageMetadata, withMessageMetadata } = require("../lib/interfaceMessages");

const respondError = (res, error, fallback, fallbackKey) => {
  const status = error instanceof CreditError ? error.status : error?.name === "ValidationError" ? 400 : 500;
  res.status(status).json(withErrorMessageMetadata({
    message: error.message || fallback,
    ...(error.code ? { code: error.code } : {}),
    ...(error.details || {}),
  }, error, fallbackKey));
};

const getCreditPurchaseOptions = async (req, res) => {
  try {
    res.status(200).json(getPurchaseOptions());
  } catch (error) {
    console.error("[credits] purchase options error:", error.message);
    respondError(res, error, "Failed to load credit purchase options.", "credits.loadPurchaseOptionsFailed");
  }
};

const createRequest = async (req, res) => {
  try {
    const result = await createCreditPurchaseRequest({
      user: req.user,
      phone: req.body.phone,
      packageKey: req.body.packageKey,
      credits: req.body.credits,
    });
    res.status(201).json(withMessageMetadata({
      ...result,
      message: "Your request is saved. A team member will contact you as soon as possible to explain the payment steps. Your credits will be added after your payment is verified.",
    }, "credits.purchaseRequestSubmitted"));
  } catch (error) {
    console.error("[credits] create purchase request error:", error.message);
    respondError(res, error, "Failed to submit credit purchase request.", "credits.submitPurchaseRequestFailed");
  }
};

const getMyRequests = async (req, res) => {
  try {
    const requests = await listMyCreditPurchaseRequests({ userId: req.user._id, limit: req.query.limit });
    res.status(200).json({ requests });
  } catch (error) {
    console.error("[credits] my purchase requests error:", error.message);
    respondError(res, error, "Failed to load credit requests.", "credits.loadRequestsFailed");
  }
};

const getAdminRequests = async (req, res) => {
  try {
    const requests = await listAdminCreditPurchaseRequests(req.query);
    res.status(200).json({ requests });
  } catch (error) {
    console.error("[admin][credits] purchase requests error:", error.message);
    respondError(res, error, "Failed to load credit requests.", "credits.loadRequestsFailed");
  }
};

const getAdminRequest = async (req, res) => {
  try {
    const request = await getAdminCreditPurchaseRequest(req.params.id);
    res.status(200).json({ request });
  } catch (error) {
    console.error("[admin][credits] purchase request detail error:", error.message);
    respondError(res, error, "Failed to load credit request.", "credits.loadRequestFailed");
  }
};

const patchAdminRequestStatus = async (req, res) => {
  try {
    const request = await updateCreditPurchaseRequestStatus({
      requestId: req.params.id,
      status: req.body.status,
      admin: req.user,
      note: req.body.note,
    });
    res.status(200).json({ request });
  } catch (error) {
    console.error("[admin][credits] purchase request status error:", error.message);
    respondError(res, error, "Failed to update credit request.", "credits.updateRequestFailed");
  }
};

const addCredits = async (req, res) => {
  try {
    const result = await addRequestedCreditsToWallet({ requestId: req.params.id, admin: req.user });
    res.status(200).json(result);
  } catch (error) {
    console.error("[admin][credits] purchase request fulfillment error:", error.message);
    respondError(res, error, "Failed to add requested credits.", "credits.addRequestedCreditsFailed");
  }
};

module.exports = {
  getCreditPurchaseOptions,
  createRequest,
  getMyRequests,
  getAdminRequests,
  getAdminRequest,
  patchAdminRequestStatus,
  addCredits,
};
