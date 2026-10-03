const mongoose = require("mongoose");

const creditPurchaseRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    studentName: { type: String, required: true, trim: true, maxlength: 160 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 180 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    requestedCredits: { type: Number, required: true, min: 1 },
    packageKey: { type: String, trim: true, maxlength: 80, default: "" },
    packageLabel: { type: String, trim: true, maxlength: 120, default: "Custom amount" },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, trim: true, uppercase: true, default: "TND" },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"],
      default: "PENDING",
      index: true,
    },
    adminNote: { type: String, trim: true, maxlength: 500, default: "" },
    cancellationReason: { type: String, trim: true, maxlength: 500, default: "" },
    confirmedAt: Date,
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    creditedAt: Date,
    creditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    creditTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "CreditTransaction" },
    receiptEmailStatus: { type: String, enum: ["pending", "sent", "failed", "unavailable"], default: "pending" },
    receiptEmailSentAt: Date,
  },
  { timestamps: true }
);

creditPurchaseRequestSchema.index({ createdAt: -1 });
creditPurchaseRequestSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("CreditPurchaseRequest", creditPurchaseRequestSchema);
