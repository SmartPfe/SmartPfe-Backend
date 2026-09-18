const mongoose = require("mongoose");

const creditFreeUsageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actionKey: { type: String, required: true },
    dateKey: { type: String, required: true },
    count: { type: Number, default: 0, min: 0 },
    activeRequestIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

creditFreeUsageSchema.index({ user: 1, actionKey: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model("CreditFreeUsage", creditFreeUsageSchema);
