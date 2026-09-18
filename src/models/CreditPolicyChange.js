const mongoose = require("mongoose");

const creditPolicyChangeSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ["policy", "settings"], required: true, index: true },
    targetKey: { type: String, required: true, index: true },
    before: { type: mongoose.Schema.Types.Mixed, default: {} },
    after: { type: mongoose.Schema.Types.Mixed, default: {} },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

creditPolicyChangeSchema.index({ targetType: 1, targetKey: 1, createdAt: -1 });

module.exports = mongoose.model("CreditPolicyChange", creditPolicyChangeSchema);
