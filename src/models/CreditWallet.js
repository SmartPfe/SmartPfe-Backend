const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true },
    actionKey: { type: String, required: true },
    promotional: { type: Number, default: 0, min: 0 },
    purchased: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const creditWalletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    promotionalBalance: { type: Number, default: 0, min: 0 },
    purchasedBalance: { type: Number, default: 0, min: 0 },
    welcomeGranted: { type: Boolean, default: false },
    lastDailyRefillKey: { type: String, default: "" },
    reservations: { type: [reservationSchema], default: [] },
    appliedAdjustmentRequestIds: { type: [String], default: [], select: false },
  },
  { timestamps: true, optimisticConcurrency: true }
);

creditWalletSchema.index({ "reservations.requestId": 1 });

module.exports = mongoose.model("CreditWallet", creditWalletSchema);
