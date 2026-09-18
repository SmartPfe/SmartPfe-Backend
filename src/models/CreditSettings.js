const mongoose = require("mongoose");

const creditSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "default", immutable: true },
    welcomeCredits: { type: Number, default: 110, min: 0, max: 100000 },
    dailyPromotionalRefill: { type: Number, default: 20, min: 0, max: 10000 },
    timezone: { type: String, default: "Africa/Tunis", trim: true },
    enforcementMode: { type: String, enum: ["off", "shadow", "enforce"], default: "enforce" },
    version: { type: Number, default: 1, min: 1 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updateReason: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CreditSettings", creditSettingsSchema);
