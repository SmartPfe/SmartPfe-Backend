const mongoose = require("mongoose");

const rateLimitCounterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    bucketStart: { type: Date, required: true },
    count: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false }
);

rateLimitCounterSchema.index({ key: 1, bucketStart: 1 }, { unique: true });
rateLimitCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RateLimitCounter", rateLimitCounterSchema);
