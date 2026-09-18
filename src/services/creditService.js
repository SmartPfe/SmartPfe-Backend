const crypto = require("crypto");
const CreditWallet = require("../models/CreditWallet");
const CreditTransaction = require("../models/CreditTransaction");
const CreditPolicy = require("../models/CreditPolicy");
const CreditSettings = require("../models/CreditSettings");
const CreditFreeUsage = require("../models/CreditFreeUsage");
const CreditPolicyChange = require("../models/CreditPolicyChange");
const RateLimitCounter = require("../models/RateLimitCounter");
const AiConcurrencyLock = require("../models/AiConcurrencyLock");
const {
  DEFAULT_CREDIT_POLICIES,
  DEFAULT_CREDIT_SETTINGS,
  POLICY_BY_KEY,
} = require("../config/creditDefaults");

const MAX_CONCURRENT_AI_REQUESTS = 2;
const RESERVATION_TTL_MS = 15 * 60 * 1000;
let configurationPromise;

class CreditError extends Error {
  constructor(message, code, status = 400, details = {}) {
    super(message);
    this.name = "CreditError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const dateKeyForTimezone = (date = new Date(), timezone = "Africa/Tunis") => {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
};

const walletPayload = (wallet) => {
  const promotional = Math.max(0, Number(wallet?.promotionalBalance) || 0);
  const purchased = Math.max(0, Number(wallet?.purchasedBalance) || 0);
  return {
    promotional,
    purchased,
    total: promotional + purchased,
    lastDailyRefillKey: wallet?.lastDailyRefillKey || "",
  };
};

const ensureCreditConfiguration = async () => {
  if (configurationPromise) return configurationPromise;
  configurationPromise = Promise.all([
    CreditPolicy.bulkWrite(
      DEFAULT_CREDIT_POLICIES.map((policy, sortOrder) => ({
        updateOne: {
          filter: { key: policy.key },
          update: {
            $setOnInsert: {
              ...POLICY_BY_KEY[policy.key],
              sortOrder,
              version: 1,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    ),
    CreditSettings.findOneAndUpdate(
      { key: "default" },
      { $setOnInsert: { ...DEFAULT_CREDIT_SETTINGS, version: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
  ]).catch((error) => {
    configurationPromise = null;
    throw error;
  });
  return configurationPromise;
};

const getCreditSettings = async () => {
  await ensureCreditConfiguration();
  const settings = await CreditSettings.findOne({ key: "default" }).lean();
  const envMode = String(process.env.CREDITS_ENFORCEMENT_MODE || "").trim().toLowerCase();
  return {
    ...settings,
    enforcementMode: ["off", "shadow", "enforce"].includes(envMode)
      ? envMode
      : settings.enforcementMode,
  };
};

const getCreditPolicy = async (actionKey) => {
  if (!POLICY_BY_KEY[actionKey]) {
    throw new CreditError("This AI action is not registered in the credit catalog.", "UNPRICED_AI_ACTION", 503, {
      actionKey,
    });
  }
  await ensureCreditConfiguration();
  const policy = await CreditPolicy.findOne({ key: actionKey }).lean();
  if (!policy || !policy.enabled) {
    throw new CreditError("This AI action is temporarily unavailable.", "AI_ACTION_DISABLED", 503, { actionKey });
  }
  return policy;
};

const ensureWallet = async (userId) => {
  try {
    return await CreditWallet.findOneAndUpdate(
      { user: userId },
      { $setOnInsert: { user: userId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return CreditWallet.findOne({ user: userId });
  }
};

const recoverExpiredCharges = async (userId, timezone) => {
  const cutoff = new Date(Date.now() - RESERVATION_TTL_MS);
  const staleTransactions = await CreditTransaction.find({
    user: userId,
    status: { $in: ["pending", "reserved"] },
    createdAt: { $lte: cutoff },
  }).limit(20);

  for (const transaction of staleTransactions) {
    let wallet;
    if (["pending", "reserved"].includes(transaction.status) && transaction.chargedCost > 0) {
      const walletBeforeRecovery = await CreditWallet.findOne({
        user: userId,
        "reservations.requestId": transaction.requestId,
      }).lean();
      const staleReservation = walletBeforeRecovery?.reservations?.find(
        (reservation) => reservation.requestId === transaction.requestId
      );
      wallet = await CreditWallet.findOneAndUpdate(
        { user: userId, "reservations.requestId": transaction.requestId },
        {
          $inc: {
            promotionalBalance: staleReservation?.promotional ?? transaction.promotionalUsed,
            purchasedBalance: staleReservation?.purchased ?? transaction.purchasedUsed,
            __v: 1,
          },
          $pull: { reservations: { requestId: transaction.requestId } },
        },
        { new: true }
      );
    }
    if (transaction.freeQuotaUsed) {
      await releaseFreeQuotaReservation({
        userId,
        actionKey: transaction.actionKey,
        requestId: transaction.requestId,
        refund: true,
        timezone,
        dateKey: transaction.freeUsageDateKey,
      });
    }
    await CreditTransaction.updateOne(
      { _id: transaction._id, status: { $in: ["pending", "reserved"] } },
      {
        $set: {
          status: "refunded",
          refundedAt: new Date(),
          reason: "Expired AI credit reservation recovered automatically",
          ...(wallet ? { balanceAfter: walletPayload(wallet) } : {}),
        },
      }
    );
    await releaseAiSlot({ userId, requestId: transaction.requestId });
  }
};

const recordSettledGrant = async ({ userId, requestId, kind, promotionalDelta = 0, purchasedDelta = 0, wallet, actor, reason, reference }) => {
  await CreditTransaction.findOneAndUpdate(
    { requestId },
    {
      $setOnInsert: {
        user: userId,
        requestId,
        kind,
        actionKey: "",
        quotedCost: 0,
        chargedCost: 0,
        promotionalDelta,
        purchasedDelta,
        actor,
        reason: reason || "",
        reference: reference || "",
        status: "settled",
        settledAt: new Date(),
        balanceAfter: walletPayload(wallet),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const applyWelcomeGrant = async (user, settings) => {
  if (!user || user.emailVerified === false || Number(settings.welcomeCredits) <= 0) return null;
  const wallet = await CreditWallet.findOneAndUpdate(
    { user: user._id, welcomeGranted: false },
    {
      $set: { welcomeGranted: true },
      $inc: { promotionalBalance: Number(settings.welcomeCredits), __v: 1 },
    },
    { new: true }
  );
  if (!wallet) return null;
  await recordSettledGrant({
    userId: user._id,
    requestId: `welcome:${user._id}`,
    kind: "welcome",
    promotionalDelta: Number(settings.welcomeCredits),
    wallet,
    reason: "Welcome credits",
  });
  return wallet;
};

const applyDailyRefill = async (user, settings) => {
  const target = Math.max(0, Number(settings.dailyPromotionalRefill) || 0);
  const dateKey = dateKeyForTimezone(new Date(), settings.timezone);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await CreditWallet.findOne({ user: user._id }).lean();
    if (!current || current.lastDailyRefillKey === dateKey) return null;
    const delta = Math.max(0, target - (Number(current.promotionalBalance) || 0));
    const updated = await CreditWallet.findOneAndUpdate(
      { _id: current._id, __v: current.__v || 0, lastDailyRefillKey: { $ne: dateKey } },
      {
        $set: { lastDailyRefillKey: dateKey },
        $inc: { promotionalBalance: delta, __v: 1 },
      },
      { new: true }
    );
    if (!updated) continue;
    if (delta > 0) {
      await recordSettledGrant({
        userId: user._id,
        requestId: `daily:${user._id}:${dateKey}`,
        kind: "daily_refill",
        promotionalDelta: delta,
        wallet: updated,
        reason: `Daily promotional refill to ${target}`,
      });
    }
    return updated;
  }
  return null;
};

const prepareWalletForUser = async (user) => {
  const settings = await getCreditSettings();
  await ensureWallet(user._id);
  await recoverExpiredCharges(user._id, settings.timezone);
  await applyWelcomeGrant(user, settings);
  await applyDailyRefill(user, settings);
  const wallet = await CreditWallet.findOne({ user: user._id });
  return { wallet, settings };
};

const getWalletForUser = async (user) => {
  const { wallet, settings } = await prepareWalletForUser(user);
  const dateKey = dateKeyForTimezone(new Date(), settings.timezone);
  const freeUsageRecords = await CreditFreeUsage.find({ user: user._id, dateKey }).lean();
  return {
    ...walletPayload(wallet),
    welcomeGranted: Boolean(wallet.welcomeGranted),
    dailyRefillTarget: Number(settings.dailyPromotionalRefill) || 0,
    dailyRefillClaimed: wallet.lastDailyRefillKey === dateKey,
    timezone: settings.timezone,
    settingsVersion: settings.version,
    enforcementMode: settings.enforcementMode,
    freeUsage: Object.fromEntries(freeUsageRecords.map((record) => [record.actionKey, record.count])),
  };
};

const consumeRateCounter = async ({ key, limit, windowMs }) => {
  if (!limit || limit <= 0) return true;
  const now = Date.now();
  const bucketMs = Math.floor(now / windowMs) * windowMs;
  const bucketStart = new Date(bucketMs);
  const expiresAt = new Date(bucketMs + windowMs * 2);
  const filter = { key, bucketStart, count: { $lt: limit } };
  let counter = await RateLimitCounter.findOneAndUpdate(filter, { $inc: { count: 1 } }, { new: true });
  if (counter) return true;
  try {
    await RateLimitCounter.create({ key, bucketStart, count: 1, expiresAt });
    return true;
  } catch (error) {
    if (error?.code !== 11000) throw error;
    counter = await RateLimitCounter.findOneAndUpdate(filter, { $inc: { count: 1 } }, { new: true });
    return Boolean(counter);
  }
};

const enforcePolicyRateLimits = async ({ userId, ip, policy }) => {
  const hardPolicy = POLICY_BY_KEY[policy.key] || {};
  const configuredMinuteLimit = Number(policy.perMinuteLimit) || 10;
  const hardMinuteLimit = Number(hardPolicy.perMinuteLimit) || 10;
  const minuteLimit = Math.min(configuredMinuteLimit, hardMinuteLimit, 60);
  const minuteKey = `ai:minute:${userId}:${policy.key}`;
  const userAllowed = await consumeRateCounter({ key: minuteKey, limit: minuteLimit, windowMs: 60 * 1000 });
  const globalUserAllowed = await consumeRateCounter({ key: `ai:user:${userId}`, limit: 30, windowMs: 60 * 1000 });
  const ipAllowed = await consumeRateCounter({ key: `ai:ip:${ip || "unknown"}`, limit: 600, windowMs: 60 * 1000 });
  if (!userAllowed || !globalUserAllowed || !ipAllowed) {
    throw new CreditError("Too many AI requests. Please wait a moment and try again.", "AI_RATE_LIMITED", 429);
  }
  const configuredDailyLimit = Number(policy.dailyLimit) || 0;
  const hardDailyLimit = Number(hardPolicy.dailyLimit) || 0;
  const dailyLimit = configuredDailyLimit > 0 && hardDailyLimit > 0
    ? Math.min(configuredDailyLimit, hardDailyLimit)
    : Math.max(configuredDailyLimit, hardDailyLimit);
  if (dailyLimit > 0) {
    const dailyAllowed = await consumeRateCounter({
      key: `ai:day:${userId}:${policy.key}`,
      limit: dailyLimit,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!dailyAllowed) {
      throw new CreditError("Today's free-use limit has been reached.", "AI_DAILY_LIMIT_REACHED", 429, {
        actionKey: policy.key,
      });
    }
  }
};

const acquireAiSlot = async ({ userId, requestId }) => {
  const now = new Date();
  const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);
  try {
    await AiConcurrencyLock.findOneAndUpdate(
      { user: userId },
      { $setOnInsert: { user: userId } },
      { upsert: true, new: true }
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  await AiConcurrencyLock.updateOne({ user: userId }, { $pull: { activeRequests: { expiresAt: { $lte: now } } } });
  const lock = await AiConcurrencyLock.findOneAndUpdate(
    {
      user: userId,
      "activeRequests.requestId": { $ne: requestId },
      $expr: { $lt: [{ $size: "$activeRequests" }, MAX_CONCURRENT_AI_REQUESTS] },
    },
    { $push: { activeRequests: { requestId, expiresAt } } },
    { new: true }
  );
  if (!lock) {
    throw new CreditError("Two AI tasks are already running. Please wait for one to finish.", "AI_CONCURRENCY_LIMIT", 429);
  }
};

const releaseAiSlot = async ({ userId, requestId }) => {
  await AiConcurrencyLock.updateOne({ user: userId }, { $pull: { activeRequests: { requestId } } });
};

const consumeFreeQuota = async ({ userId, actionKey, requestId, limit, timezone }) => {
  if (!limit || limit <= 0) return { used: false, dateKey: "" };
  const dateKey = dateKeyForTimezone(new Date(), timezone);
  try {
    await CreditFreeUsage.findOneAndUpdate(
      { user: userId, actionKey, dateKey },
      { $setOnInsert: { user: userId, actionKey, dateKey, count: 0, activeRequestIds: [] } },
      { upsert: true, new: true }
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  const usage = await CreditFreeUsage.findOneAndUpdate(
    {
      user: userId,
      actionKey,
      dateKey,
      count: { $lt: limit },
      activeRequestIds: { $ne: requestId },
    },
    { $inc: { count: 1 }, $push: { activeRequestIds: requestId } },
    { new: true }
  );
  return { used: Boolean(usage), dateKey };
};

const releaseFreeQuotaReservation = async ({ userId, actionKey, requestId, refund = false, timezone, dateKey }) => {
  const usageDateKey = dateKey || dateKeyForTimezone(new Date(), timezone);
  const update = { $pull: { activeRequestIds: requestId } };
  if (refund) update.$inc = { count: -1 };
  await CreditFreeUsage.updateOne(
    { user: userId, actionKey, dateKey: usageDateKey, activeRequestIds: requestId },
    update
  );
};

const reserveWalletCredits = async ({ userId, requestId, actionKey, cost }) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const wallet = await CreditWallet.findOne({ user: userId }).lean();
    if (!wallet) throw new CreditError("Credit wallet not found.", "WALLET_NOT_FOUND", 500);
    const available = (Number(wallet.promotionalBalance) || 0) + (Number(wallet.purchasedBalance) || 0);
    if (available < cost) {
      throw new CreditError("Not enough credits for this action.", "INSUFFICIENT_CREDITS", 402, {
        required: cost,
        balance: available,
        actionKey,
      });
    }
    const activeReservations = (wallet.reservations || []).filter((item) => new Date(item.expiresAt) > new Date());
    if (activeReservations.length >= MAX_CONCURRENT_AI_REQUESTS) {
      throw new CreditError("Two AI tasks are already running. Please wait for one to finish.", "AI_CONCURRENCY_LIMIT", 429);
    }
    const promotionalUsed = Math.min(Number(wallet.promotionalBalance) || 0, cost);
    const purchasedUsed = cost - promotionalUsed;
    const updated = await CreditWallet.findOneAndUpdate(
      {
        _id: wallet._id,
        __v: wallet.__v || 0,
        promotionalBalance: { $gte: promotionalUsed },
        purchasedBalance: { $gte: purchasedUsed },
        "reservations.requestId": { $ne: requestId },
      },
      {
        $inc: {
          promotionalBalance: -promotionalUsed,
          purchasedBalance: -purchasedUsed,
          __v: 1,
        },
        $push: {
          reservations: {
            requestId,
            actionKey,
            promotional: promotionalUsed,
            purchased: purchasedUsed,
            expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
          },
        },
      },
      { new: true }
    );
    if (updated) return { wallet: updated, promotionalUsed, purchasedUsed };
  }
  throw new CreditError("Credits changed while starting this request. Please retry.", "CREDIT_CONFLICT", 409);
};

const reserveCreditCharge = async ({ user, actionKey, requestId, expectedPolicyVersion, metadata = {}, ip }) => {
  const normalizedRequestId = String(requestId || crypto.randomUUID()).slice(0, 160);
  const [{ wallet, settings }, policy] = await Promise.all([
    prepareWalletForUser(user),
    getCreditPolicy(actionKey),
  ]);
  if (expectedPolicyVersion && Number(expectedPolicyVersion) !== Number(policy.version)) {
    throw new CreditError("Credit price changed. Review the current price and try again.", "CREDIT_PRICE_CHANGED", 409, {
      actionKey,
      cost: policy.cost,
      policyVersion: policy.version,
    });
  }
  const existing = await CreditTransaction.exists({ requestId: normalizedRequestId });
  if (existing) {
    throw new CreditError("This AI request has already been submitted.", "DUPLICATE_AI_REQUEST", 409);
  }
  await enforcePolicyRateLimits({ userId: user._id, ip, policy });
  await acquireAiSlot({ userId: user._id, requestId: normalizedRequestId });

  let transaction;
  let freeQuotaUsed = false;
  let freeUsageDateKey = "";
  let reservedCredits = { promotionalUsed: 0, purchasedUsed: 0 };
  try {
    const mode = settings.enforcementMode;
    let actualCost = Math.max(0, Number(policy.cost) || 0);
    if (mode === "enforce" && Number(policy.freeUsesPerDay) > 0) {
      const freeQuota = await consumeFreeQuota({
        userId: user._id,
        actionKey,
        requestId: normalizedRequestId,
        limit: Number(policy.freeUsesPerDay),
        timezone: settings.timezone,
      });
      freeQuotaUsed = freeQuota.used;
      freeUsageDateKey = freeQuota.dateKey;
      if (freeQuotaUsed) actualCost = 0;
    }
    if (mode !== "enforce") actualCost = 0;

    transaction = await CreditTransaction.create({
      user: user._id,
      requestId: normalizedRequestId,
      kind: "usage",
      status: "pending",
      actionKey,
      policyVersion: policy.version,
      quotedCost: Math.max(0, Number(policy.cost) || 0),
      chargedCost: actualCost,
      freeQuotaUsed,
      freeUsageDateKey,
      enforcementMode: mode,
      metadata,
      balanceAfter: walletPayload(wallet),
    });

    let reservation = { wallet, promotionalUsed: 0, purchasedUsed: 0 };
    if (actualCost > 0) {
      reservation = await reserveWalletCredits({ userId: user._id, requestId: normalizedRequestId, actionKey, cost: actualCost });
      reservedCredits = {
        promotionalUsed: reservation.promotionalUsed,
        purchasedUsed: reservation.purchasedUsed,
      };
    }
    transaction.status = "reserved";
    transaction.promotionalUsed = reservation.promotionalUsed;
    transaction.purchasedUsed = reservation.purchasedUsed;
    transaction.balanceAfter = walletPayload(reservation.wallet);
    await transaction.save();

    return {
      requestId: normalizedRequestId,
      transactionId: String(transaction._id),
      userId: String(user._id),
      actionKey,
      label: policy.label,
      quotedCost: Number(policy.cost) || 0,
      chargedCost: actualCost,
      policyVersion: policy.version,
      freeQuotaUsed,
      freeUsageDateKey,
      enforcementMode: mode,
      timezone: settings.timezone,
      balance: walletPayload(reservation.wallet),
    };
  } catch (error) {
    let reservationRollbackFailed = false;
    if (reservedCredits.promotionalUsed > 0 || reservedCredits.purchasedUsed > 0) {
      await CreditWallet.findOneAndUpdate(
        { user: user._id, "reservations.requestId": normalizedRequestId },
        {
          $inc: {
            promotionalBalance: reservedCredits.promotionalUsed,
            purchasedBalance: reservedCredits.purchasedUsed,
            __v: 1,
          },
          $pull: { reservations: { requestId: normalizedRequestId } },
        },
        { new: true }
      ).catch((refundError) => {
        reservationRollbackFailed = true;
        console.error("[credits] Failed to roll back an incomplete reservation:", refundError.message);
      });
    }
    if (transaction?._id) {
      await CreditTransaction.updateOne(
        { _id: transaction._id },
        {
          $set: {
            ...(!reservationRollbackFailed ? { status: "cancelled" } : {}),
            reason: String(error.message || "Reservation failed").slice(0, 500),
          },
        }
      ).catch((cleanupError) => {
        console.error("[credits] Failed to mark an incomplete transaction:", cleanupError.message);
      });
    }
    if (freeQuotaUsed) {
      await releaseFreeQuotaReservation({
        userId: user._id,
        actionKey,
        requestId: normalizedRequestId,
        refund: true,
        timezone: settings.timezone,
        dateKey: freeUsageDateKey,
      }).catch((cleanupError) => {
        console.error("[credits] Failed to restore a free-use allowance:", cleanupError.message);
      });
    }
    await releaseAiSlot({ userId: user._id, requestId: normalizedRequestId }).catch((cleanupError) => {
      console.error("[credits] Failed to release an AI concurrency slot:", cleanupError.message);
    });
    if (error?.code === 11000) {
      throw new CreditError("This AI request has already been submitted.", "DUPLICATE_AI_REQUEST", 409);
    }
    throw error;
  }
};

const settleCreditCharge = async (charge) => {
  if (!charge) return null;
  const transaction = await CreditTransaction.findOne({ requestId: charge.requestId });
  if (!transaction) throw new CreditError("Credit transaction not found.", "CREDIT_TRANSACTION_NOT_FOUND", 500);
  if (transaction.status === "settled") {
    return { charged: transaction.chargedCost, balance: transaction.balanceAfter, transactionId: transaction._id };
  }
  if (transaction.status !== "reserved") {
    throw new CreditError("Credit transaction is not reservable.", "INVALID_CREDIT_TRANSACTION_STATE", 409);
  }
  let wallet = await CreditWallet.findOne({ user: transaction.user });
  if (transaction.chargedCost > 0) {
    wallet = await CreditWallet.findOneAndUpdate(
      { user: transaction.user, "reservations.requestId": transaction.requestId },
      { $pull: { reservations: { requestId: transaction.requestId } }, $inc: { __v: 1 } },
      { new: true }
    );
  }
  if (transaction.freeQuotaUsed) {
    await releaseFreeQuotaReservation({
      userId: transaction.user,
      actionKey: transaction.actionKey,
      requestId: transaction.requestId,
      refund: false,
      timezone: charge.timezone,
      dateKey: transaction.freeUsageDateKey,
    });
  }
  transaction.status = "settled";
  transaction.settledAt = new Date();
  transaction.balanceAfter = walletPayload(wallet || await CreditWallet.findOne({ user: transaction.user }));
  await transaction.save();
  await releaseAiSlot({ userId: transaction.user, requestId: transaction.requestId });
  return {
    charged: transaction.chargedCost,
    quotedCost: transaction.quotedCost,
    freeQuotaUsed: transaction.freeQuotaUsed,
    balance: transaction.balanceAfter,
    transactionId: String(transaction._id),
    actionKey: transaction.actionKey,
    policyVersion: transaction.policyVersion,
  };
};

const refundCreditCharge = async (charge, reason = "AI request failed") => {
  if (!charge) return null;
  const transaction = await CreditTransaction.findOne({ requestId: charge.requestId });
  if (!transaction || ["refunded", "cancelled"].includes(transaction.status)) return null;
  if (transaction.status === "settled") return null;
  let wallet = await CreditWallet.findOne({ user: transaction.user });
  if (transaction.chargedCost > 0) {
    wallet = await CreditWallet.findOneAndUpdate(
      { user: transaction.user, "reservations.requestId": transaction.requestId },
      {
        $inc: {
          promotionalBalance: transaction.promotionalUsed,
          purchasedBalance: transaction.purchasedUsed,
          __v: 1,
        },
        $pull: { reservations: { requestId: transaction.requestId } },
      },
      { new: true }
    );
  }
  if (transaction.freeQuotaUsed) {
    await releaseFreeQuotaReservation({
      userId: transaction.user,
      actionKey: transaction.actionKey,
      requestId: transaction.requestId,
      refund: true,
      timezone: charge.timezone,
      dateKey: transaction.freeUsageDateKey,
    });
  }
  transaction.status = "refunded";
  transaction.refundedAt = new Date();
  transaction.reason = String(reason || "AI request failed").slice(0, 500);
  transaction.balanceAfter = walletPayload(wallet || await CreditWallet.findOne({ user: transaction.user }));
  await transaction.save();
  await releaseAiSlot({ userId: transaction.user, requestId: transaction.requestId });
  return {
    refunded: transaction.chargedCost,
    balance: transaction.balanceAfter,
    transactionId: String(transaction._id),
  };
};

const listPolicies = async () => {
  await ensureCreditConfiguration();
  return CreditPolicy.find().sort({ sortOrder: 1, label: 1 }).lean();
};

const updatePolicy = async ({ key, updates, actor, reason }) => {
  if (!reason || !String(reason).trim()) {
    throw new CreditError("A reason is required for credit policy changes.", "CREDIT_CHANGE_REASON_REQUIRED", 400);
  }
  await ensureCreditConfiguration();
  const current = await CreditPolicy.findOne({ key }).lean();
  if (!current || !POLICY_BY_KEY[key]) {
    throw new CreditError("Credit policy not found.", "CREDIT_POLICY_NOT_FOUND", 404);
  }
  if (current.editable === false) {
    throw new CreditError("This bundled system action cannot be priced independently.", "CREDIT_POLICY_LOCKED", 409);
  }
  const allowed = {};
  for (const field of ["cost", "freeUsesPerDay", "perMinuteLimit", "dailyLimit", "enabled"]) {
    if (updates[field] !== undefined) allowed[field] = updates[field];
  }
  if (Object.keys(allowed).length === 0) {
    throw new CreditError("No supported credit policy changes were provided.", "EMPTY_CREDIT_POLICY_UPDATE", 400);
  }
  const updated = await CreditPolicy.findOneAndUpdate(
    { key, version: current.version },
    {
      $set: { ...allowed, updatedBy: actor, updateReason: String(reason).trim() },
      $inc: { version: 1 },
    },
    { new: true, runValidators: true }
  ).lean();
  if (!updated) throw new CreditError("Credit policy changed. Refresh and retry.", "CREDIT_POLICY_CONFLICT", 409);
  await CreditPolicyChange.create({
    targetType: "policy",
    targetKey: key,
    before: current,
    after: updated,
    actor,
    reason: String(reason).trim(),
  });
  return updated;
};

const updateSettings = async ({ updates, actor, reason }) => {
  if (!reason || !String(reason).trim()) {
    throw new CreditError("A reason is required for credit setting changes.", "CREDIT_CHANGE_REASON_REQUIRED", 400);
  }
  const current = await getCreditSettings();
  const allowed = {};
  for (const field of ["welcomeCredits", "dailyPromotionalRefill", "timezone", "enforcementMode"]) {
    if (updates[field] !== undefined) allowed[field] = updates[field];
  }
  if (Object.keys(allowed).length === 0) {
    throw new CreditError("No supported credit setting changes were provided.", "EMPTY_CREDIT_SETTINGS_UPDATE", 400);
  }
  if (allowed.timezone) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: allowed.timezone }).format();
    } catch {
      throw new CreditError("Use a valid IANA timezone, such as Africa/Tunis.", "INVALID_CREDIT_TIMEZONE", 400);
    }
  }
  const updated = await CreditSettings.findOneAndUpdate(
    { key: "default", version: current.version },
    {
      $set: { ...allowed, updatedBy: actor, updateReason: String(reason).trim() },
      $inc: { version: 1 },
    },
    { new: true, runValidators: true }
  ).lean();
  if (!updated) throw new CreditError("Credit settings changed. Refresh and retry.", "CREDIT_SETTINGS_CONFLICT", 409);
  await CreditPolicyChange.create({
    targetType: "settings",
    targetKey: "default",
    before: current,
    after: updated,
    actor,
    reason: String(reason).trim(),
  });
  return updated;
};

const adjustUserCredits = async ({ userId, amount, bucket, actor, reason, reference, requestId }) => {
  const numericAmount = Math.trunc(Number(amount));
  if (!numericAmount || !["promotional", "purchased"].includes(bucket)) {
    throw new CreditError("Provide a non-zero whole amount and a valid credit bucket.", "INVALID_CREDIT_ADJUSTMENT", 400);
  }
  if (!reason || !String(reason).trim()) {
    throw new CreditError("A reason is required for credit adjustments.", "CREDIT_CHANGE_REASON_REQUIRED", 400);
  }
  await ensureWallet(userId);
  const normalizedRequestId = String(requestId || `admin:${actor}:${crypto.randomUUID()}`).slice(0, 160);
  let transaction;
  try {
    transaction = await CreditTransaction.create({
      user: userId,
      requestId: normalizedRequestId,
      kind: "admin_adjustment",
      status: "pending",
      promotionalDelta: bucket === "promotional" ? numericAmount : 0,
      purchasedDelta: bucket === "purchased" ? numericAmount : 0,
      actor,
      reason: String(reason).trim(),
      reference: String(reference || "").trim(),
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    transaction = await CreditTransaction.findOne({ requestId: normalizedRequestId });
    if (!transaction) throw error;
  }
  const expectedPromotionalDelta = bucket === "promotional" ? numericAmount : 0;
  const expectedPurchasedDelta = bucket === "purchased" ? numericAmount : 0;
  if (
    String(transaction.user) !== String(userId) ||
    transaction.kind !== "admin_adjustment" ||
    Number(transaction.promotionalDelta) !== expectedPromotionalDelta ||
    Number(transaction.purchasedDelta) !== expectedPurchasedDelta
  ) {
    throw new CreditError("This idempotency key belongs to a different adjustment.", "IDEMPOTENCY_KEY_CONFLICT", 409);
  }
  if (transaction.status === "settled") return transaction;
  const field = bucket === "purchased" ? "purchasedBalance" : "promotionalBalance";
  const filter = { user: userId, appliedAdjustmentRequestIds: { $ne: normalizedRequestId } };
  if (numericAmount < 0) filter[field] = { $gte: Math.abs(numericAmount) };
  let wallet = await CreditWallet.findOneAndUpdate(
    filter,
    {
      $inc: { [field]: numericAmount, __v: 1 },
      $push: { appliedAdjustmentRequestIds: { $each: [normalizedRequestId], $slice: -500 } },
    },
    { new: true }
  );
  if (!wallet) {
    wallet = await CreditWallet.findOne({ user: userId }).select("+appliedAdjustmentRequestIds");
    if (!wallet?.appliedAdjustmentRequestIds?.includes(normalizedRequestId)) {
      await CreditTransaction.deleteOne({ _id: transaction._id, status: "pending" });
      throw new CreditError("The adjustment would make the balance negative.", "NEGATIVE_CREDIT_BALANCE", 409);
    }
  }
  transaction.status = "settled";
  transaction.settledAt = new Date();
  transaction.balanceAfter = walletPayload(wallet);
  await transaction.save();
  return transaction;
};

const listTransactions = async ({ userId, limit = 30, before }) => {
  const query = { user: userId };
  if (before) query.createdAt = { $lt: new Date(before) };
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
  const items = await CreditTransaction.find(query)
    .sort({ createdAt: -1 })
    .limit(safeLimit + 1)
    .populate("actor", "fullName email")
    .lean();
  const hasMore = items.length > safeLimit;
  const page = hasMore ? items.slice(0, safeLimit) : items;
  return {
    items: page,
    nextCursor: hasMore ? page[page.length - 1].createdAt.toISOString() : null,
  };
};

const getPolicyChanges = async (limit = 100) =>
  CreditPolicyChange.find()
    .sort({ createdAt: -1 })
    .limit(Math.min(200, Math.max(1, Number(limit) || 100)))
    .populate("actor", "fullName email")
    .lean();

module.exports = {
  CreditError,
  ensureCreditConfiguration,
  getCreditSettings,
  getCreditPolicy,
  getWalletForUser,
  reserveCreditCharge,
  settleCreditCharge,
  refundCreditCharge,
  releaseAiSlot,
  listPolicies,
  updatePolicy,
  updateSettings,
  adjustUserCredits,
  listTransactions,
  getPolicyChanges,
  walletPayload,
};
