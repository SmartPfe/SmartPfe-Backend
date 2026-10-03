const CreditPurchaseRequest = require("../models/CreditPurchaseRequest");
const User = require("../models/User");
const { getCreditPurchasePricing } = require("../config/creditPurchasePricing");
const { CreditError, adjustUserCredits, getWalletForUser } = require("./creditService");
const { sendCreditPurchaseRequestEmail, sendPurchasedCreditsEmail, sendCreditPurchaseReceiptEmail } = require("./emailService");
const { createNotification } = require("./notificationService");

const notifyStudent = async (request, title, message, type = "success") => {
  try {
    await createNotification({ user: request.user, title, message, type, link: `/workspace/settings/credits?request=${request._id}` });
    return true;
  } catch (error) {
    console.error("[credits] student notification error:", error.message);
    return false;
  }
};

const sanitize = (value, maxLength = 500) => String(value || "").trim().slice(0, maxLength);

const normalizePhone = (value) => sanitize(value, 40).replace(/\s+/g, " ");

const validatePhone = (phone) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 15 && /^[+()\d\s.-]+$/.test(phone);
};

const publicRequest = (request) => ({
  _id: request._id,
  id: String(request._id),
  user: request.user,
  studentName: request.studentName,
  email: request.email,
  phone: request.phone,
  requestedCredits: request.requestedCredits,
  packageKey: request.packageKey,
  packageLabel: request.packageLabel,
  price: request.price,
  currency: request.currency,
  status: request.status,
  adminNote: request.adminNote,
  cancellationReason: request.cancellationReason,
  creditTransaction: request.creditTransaction,
  confirmedAt: request.confirmedAt,
  cancelledAt: request.cancelledAt,
  creditedAt: request.creditedAt,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
  receiptEmailStatus: request.receiptEmailStatus,
  receiptEmailSentAt: request.receiptEmailSentAt,
});

const quoteCreditPurchase = ({ packageKey, credits }) => {
  const pricing = getCreditPurchasePricing();
  const selectedPackage = packageKey
    ? pricing.packages.find((item) => item.key === String(packageKey).trim())
    : null;
  const requestedCredits = selectedPackage ? selectedPackage.credits : Math.trunc(Number(credits) || 0);
  if (requestedCredits <= 0) {
    throw new CreditError("Choose a credit package or enter a custom credit amount greater than 0.", "INVALID_CREDIT_REQUEST", 400);
  }
  if (requestedCredits > 100000) {
    throw new CreditError("Credit requests are limited to 100,000 credits.", "CREDIT_REQUEST_TOO_LARGE", 400);
  }
  const price = Math.round(requestedCredits * pricing.pricePerCredit * 100) / 100;
  return {
    requestedCredits,
    packageKey: selectedPackage?.key || "",
    packageLabel: selectedPackage?.label || "Custom amount",
    price,
    currency: pricing.currency,
  };
};

const getPurchaseOptions = () => getCreditPurchasePricing();

const createCreditPurchaseRequest = async ({ user, phone, packageKey, credits }) => {
  if ((user?.role || "etudiant") === "admin") {
    throw new CreditError("Admin accounts cannot submit student credit requests.", "ADMIN_REQUEST_FORBIDDEN", 403);
  }
  const normalizedPhone = normalizePhone(phone);
  if (!validatePhone(normalizedPhone)) {
    throw new CreditError("Enter a valid phone number so the admin can contact you.", "INVALID_PHONE_NUMBER", 400);
  }
  const quote = quoteCreditPurchase({ packageKey, credits });
  const request = await CreditPurchaseRequest.create({
    user: user._id,
    studentName: sanitize(user.fullName, 160) || "Student",
    email: sanitize(user.email, 180).toLowerCase(),
    phone: normalizedPhone,
    ...quote,
    status: "PENDING",
  });

  const [adminEmail, studentEmail, notificationSent] = await Promise.all([
    sendCreditPurchaseRequestEmail({ request }).catch((error) => {
      console.error("[credits] admin purchase-request email error:", error.message);
      return { sent: false };
    }),
    sendCreditPurchaseReceiptEmail({ request }).catch((error) => {
      console.error("[credits] student receipt email error:", error.message);
      return { sent: false, failed: true };
    }),
    notifyStudent(request, "Credit request submitted", `Your request for ${request.requestedCredits} credits is saved. A team member will contact you as soon as possible with the payment steps.`),
  ]);
  request.receiptEmailStatus = studentEmail.sent ? "sent" : studentEmail.failed ? "failed" : "unavailable";
  if (studentEmail.sent) request.receiptEmailSentAt = new Date();
  // A receipt-status write failure must not turn a saved request into a failed submission.
  try { await request.save(); } catch (error) { console.error("[credits] receipt status save error:", error.message); }

  return {
    request: publicRequest(request.toObject()),
    studentEmailSent: studentEmail.sent === true,
    notificationSent,
    emailDeliveryWarning: adminEmail.sent !== true || studentEmail.sent !== true,
  };
};

const listMyCreditPurchaseRequests = async ({ userId, limit = 20 }) => {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  const requests = await CreditPurchaseRequest.find({ user: userId }).sort({ createdAt: -1 }).limit(safeLimit).lean();
  return requests.map(publicRequest);
};

const buildAdminQuery = ({ status, student, dateFrom, dateTo }) => {
  const query = {};
  if (status && status !== "ALL") query.status = String(status).toUpperCase();
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }
  const search = sanitize(student, 120);
  if (search) {
    const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ studentName: pattern }, { email: pattern }, { phone: pattern }];
  }
  return query;
};

const listAdminCreditPurchaseRequests = async (filters = {}) => {
  const safeLimit = Math.min(100, Math.max(1, Number(filters.limit) || 50));
  const requests = await CreditPurchaseRequest.find(buildAdminQuery(filters))
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .populate("user", "fullName email role")
    .populate("confirmedBy cancelledBy creditedBy", "fullName email")
    .lean();
  return requests.map(publicRequest);
};

const getAdminCreditPurchaseRequest = async (requestId) => {
  const request = await CreditPurchaseRequest.findById(requestId)
    .populate("user", "fullName email role")
    .populate("confirmedBy cancelledBy creditedBy", "fullName email")
    .populate("creditTransaction")
    .lean();
  if (!request) throw new CreditError("Credit request not found.", "CREDIT_REQUEST_NOT_FOUND", 404);
  return publicRequest(request);
};

const updateCreditPurchaseRequestStatus = async ({ requestId, status, admin, note }) => {
  const nextStatus = String(status || "").toUpperCase();
  if (!["CONFIRMED", "CANCELLED"].includes(nextStatus)) {
    throw new CreditError("Status can only be changed to CONFIRMED or CANCELLED here.", "INVALID_CREDIT_REQUEST_STATUS", 400);
  }
  const request = await CreditPurchaseRequest.findById(requestId);
  if (!request) throw new CreditError("Credit request not found.", "CREDIT_REQUEST_NOT_FOUND", 404);
  if (request.status === "COMPLETED") {
    throw new CreditError("Completed requests cannot be changed.", "CREDIT_REQUEST_COMPLETED", 409);
  }
  if (nextStatus === "CONFIRMED" && request.status !== "PENDING") {
    throw new CreditError("Only pending requests can be confirmed.", "INVALID_CREDIT_REQUEST_TRANSITION", 409);
  }
  if (nextStatus === "CANCELLED" && !["PENDING", "CONFIRMED"].includes(request.status)) {
    throw new CreditError("This request cannot be cancelled.", "INVALID_CREDIT_REQUEST_TRANSITION", 409);
  }
  request.status = nextStatus;
  request.adminNote = sanitize(note, 500);
  if (nextStatus === "CONFIRMED") {
    request.confirmedAt = new Date();
    request.confirmedBy = admin._id;
  } else {
    request.cancelledAt = new Date();
    request.cancelledBy = admin._id;
    request.cancellationReason = sanitize(note, 500);
  }
  await request.save();
  await notifyStudent(request,
    nextStatus === "CONFIRMED" ? "Credit request confirmed" : "Credit request cancelled",
    nextStatus === "CONFIRMED"
      ? `Your request for ${request.requestedCredits} credits has been confirmed. Your credits will appear when the administrator completes the deposit.`
      : `Your request for ${request.requestedCredits} credits was cancelled.${request.cancellationReason ? ` Reason: ${request.cancellationReason}` : " View your credit history for details."}`,
    nextStatus === "CANCELLED" ? "info" : "success"
  );
  return publicRequest(request.toObject());
};

const addRequestedCreditsToWallet = async ({ requestId, admin }) => {
  const request = await CreditPurchaseRequest.findById(requestId);
  if (!request) throw new CreditError("Credit request not found.", "CREDIT_REQUEST_NOT_FOUND", 404);
  if (request.status !== "CONFIRMED" && request.status !== "COMPLETED") {
    throw new CreditError("Confirm the request before adding credits to the wallet.", "CREDIT_REQUEST_NOT_CONFIRMED", 409);
  }
  if (request.creditedAt || request.creditTransaction) {
    throw new CreditError("Credits have already been added for this request.", "CREDIT_REQUEST_ALREADY_CREDITED", 409);
  }
  const targetUser = await User.findById(request.user).select("fullName email emailVerified role");
  if (!targetUser || (targetUser.role || "etudiant") === "admin") {
    throw new CreditError("Student account for this request was not found.", "CREDIT_REQUEST_USER_NOT_FOUND", 404);
  }

  const { transaction, idempotentReplay } = await adjustUserCredits({
    userId: targetUser._id,
    amount: request.requestedCredits,
    bucket: "purchased",
    actor: admin._id,
    reason: `Credit purchase request ${request._id}`,
    reference: `credit-request:${request._id}`,
    requestId: `credit-purchase:${request._id}`,
  });

  const wallet = await getWalletForUser(targetUser);
  request.status = "COMPLETED";
  request.creditedAt = request.creditedAt || new Date();
  request.creditedBy = admin._id;
  request.creditTransaction = transaction._id;
  request.adminNote = request.adminNote || "Credits added to wallet.";
  await request.save();

  let emailSent = false;
  let emailDeliveryWarning = false;
  if (!idempotentReplay) {
    await notifyStudent(request, "Credits added to your wallet", `${request.requestedCredits} purchased credits have been added. Your request is complete.`);
    try {
      const result = await sendPurchasedCreditsEmail({
        email: targetUser.email,
        fullName: targetUser.fullName,
        amount: request.requestedCredits,
        balance: wallet.purchased,
      });
      emailSent = result.sent === true;
    } catch (error) {
      emailDeliveryWarning = true;
      console.error("[credits] request fulfillment email error:", error.message);
    }
  }

  return {
    request: publicRequest(request.toObject()),
    transaction,
    wallet,
    emailSent,
    emailDeliveryWarning,
  };
};

module.exports = {
  getPurchaseOptions,
  quoteCreditPurchase,
  createCreditPurchaseRequest,
  listMyCreditPurchaseRequests,
  listAdminCreditPurchaseRequests,
  getAdminCreditPurchaseRequest,
  updateCreditPurchaseRequestStatus,
  addRequestedCreditsToWallet,
};
