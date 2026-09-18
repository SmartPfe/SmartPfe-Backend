const mongoose = require("mongoose");

const creditPolicySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true, immutable: true },
    label: { type: String, required: true, trim: true },
    group: { type: String, required: true, trim: true },
    cost: { type: Number, required: true, min: 0, max: 1000 },
    freeUsesPerDay: { type: Number, default: 0, min: 0, max: 1000 },
    perMinuteLimit: { type: Number, default: 10, min: 1, max: 120 },
    dailyLimit: { type: Number, default: 0, min: 0, max: 10000 },
    enabled: { type: Boolean, default: true },
    editable: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    version: { type: Number, default: 1, min: 1 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updateReason: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CreditPolicy", creditPolicySchema);
