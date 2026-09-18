const mongoose = require("mongoose");

const activeRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const aiConcurrencyLockSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    activeRequests: { type: [activeRequestSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AiConcurrencyLock", aiConcurrencyLockSchema);
