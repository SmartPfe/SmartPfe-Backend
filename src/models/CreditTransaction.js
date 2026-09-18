const mongoose = require("mongoose");

const creditTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestId: { type: String, required: true, unique: true, index: true },
    kind: {
      type: String,
      enum: ["welcome", "daily_refill", "usage", "purchase", "admin_adjustment", "refund"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "reserved", "settled", "refunded", "cancelled"],
      default: "pending",
      index: true,
    },
    actionKey: { type: String, default: "", index: true },
    policyVersion: { type: Number, default: 0 },
    quotedCost: { type: Number, default: 0, min: 0 },
    chargedCost: { type: Number, default: 0, min: 0 },
    promotionalUsed: { type: Number, default: 0, min: 0 },
    purchasedUsed: { type: Number, default: 0, min: 0 },
    promotionalDelta: { type: Number, default: 0 },
    purchasedDelta: { type: Number, default: 0 },
    freeQuotaUsed: { type: Boolean, default: false },
    freeUsageDateKey: { type: String, default: "" },
    enforcementMode: { type: String, enum: ["off", "shadow", "enforce"], default: "enforce" },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, trim: true, maxlength: 500, default: "" },
    reference: { type: String, trim: true, maxlength: 200, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    balanceAfter: {
      promotional: { type: Number, default: 0 },
      purchased: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    settledAt: Date,
    refundedAt: Date,
  },
  { timestamps: true }
);

creditTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("CreditTransaction", creditTransactionSchema);
