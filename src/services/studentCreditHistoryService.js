const mongoose = require("mongoose");
const CreditPurchaseRequest = require("../models/CreditPurchaseRequest");
const CreditTransaction = require("../models/CreditTransaction");
const { CreditError } = require("./creditService");

const REQUEST_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"];
const TRANSACTION_STATUSES = ["pending", "reserved", "settled", "refunded", "cancelled"];
const TRANSACTION_KINDS = ["welcome", "daily_refill", "usage", "purchase", "admin_adjustment", "refund"];

const buildHistoryQuery = ({ userId, section = "requests", status, kind, search, dateFrom, dateTo }) => {
  if (!["requests", "transactions"].includes(section)) {
    throw new CreditError("Choose requests or transactions.", "INVALID_HISTORY_SECTION", 400);
  }
  // Ownership always comes from the authenticated user, never a query parameter.
  const query = { user: userId };
  const statuses = section === "requests" ? REQUEST_STATUSES : TRANSACTION_STATUSES;
  if (status && status !== "ALL") {
    if (!statuses.includes(status)) throw new CreditError("Invalid status filter.", "INVALID_HISTORY_FILTER", 400);
    query.status = status;
  }
  if (section === "transactions" && kind && kind !== "ALL") {
    if (!TRANSACTION_KINDS.includes(kind)) throw new CreditError("Invalid activity filter.", "INVALID_HISTORY_FILTER", 400);
    query.kind = kind;
  }
  if (dateFrom || dateTo) {
    query.createdAt = {};
    for (const [key, value] of [["$gte", dateFrom], ["$lt", dateTo]]) {
      if (!value) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new CreditError("Use a valid date.", "INVALID_HISTORY_DATE", 400);
      const date = new Date(`${value}T00:00:00.000Z`);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new CreditError("Use a valid date.", "INVALID_HISTORY_DATE", 400);
      }
      if (key === "$lt") date.setUTCDate(date.getUTCDate() + 1);
      query.createdAt[key] = date;
    }
    if (query.createdAt.$gte && query.createdAt.$lt && query.createdAt.$gte >= query.createdAt.$lt) {
      throw new CreditError("The end date must be on or after the start date.", "INVALID_HISTORY_DATE", 400);
    }
  }
  const text = String(search || "").trim().slice(0, 120);
  if (text) {
    const regex = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const fields = section === "requests" ? ["packageLabel", "phone", "adminNote", "cancellationReason"] : ["actionKey", "reason", "reference", "kind"];
    query.$or = fields.map((field) => ({ [field]: regex }));
    if (mongoose.isValidObjectId(text)) query.$or.push({ _id: text });
    if (/^\d+$/.test(text) && section === "requests") query.$or.push({ requestedCredits: Number(text) });
  }
  return query;
};

const listStudentCreditHistory = async (filters) => {
  const query = buildHistoryQuery(filters);
  const Model = filters.section === "transactions" ? CreditTransaction : CreditPurchaseRequest;
  const page = Math.min(100000, Math.max(1, Math.trunc(Number(filters.page) || 1)));
  const limit = Math.min(50, Math.max(1, Math.trunc(Number(filters.limit) || 10)));
  const [items, total] = await Promise.all([
    Model.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Model.countDocuments(query),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
};

const getStudentCreditRequest = async ({ userId, requestId }) => {
  if (!mongoose.isValidObjectId(requestId)) throw new CreditError("Credit request not found.", "CREDIT_REQUEST_NOT_FOUND", 404);
  const request = await CreditPurchaseRequest.findOne({ _id: requestId, user: userId }).lean();
  if (!request) throw new CreditError("Credit request not found.", "CREDIT_REQUEST_NOT_FOUND", 404);
  return request;
};

module.exports = { buildHistoryQuery, listStudentCreditHistory, getStudentCreditRequest };
