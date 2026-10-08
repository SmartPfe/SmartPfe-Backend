const CREDIT_ERROR_KEYS = Object.freeze({
  UNPRICED_AI_ACTION: "credits.unpricedAction",
  AI_ACTION_DISABLED: "credits.actionUnavailable",
  ADMIN_WALLET_DISABLED: "credits.adminWalletDisabled",
  AI_RATE_LIMITED: "credits.rateLimited",
  AI_DAILY_LIMIT_REACHED: "credits.dailyLimitReached",
  AI_CONCURRENCY_LIMIT: "credits.concurrencyLimit",
  WALLET_NOT_FOUND: "credits.walletNotFound",
  INSUFFICIENT_CREDITS: "credits.insufficientCredits",
  CREDIT_CONFLICT: "credits.balanceConflict",
  CREDIT_PRICE_CHANGED: "credits.priceChanged",
  DUPLICATE_AI_REQUEST: "credits.duplicateRequest",
  CREDIT_TRANSACTION_NOT_FOUND: "credits.transactionNotFound",
  INVALID_CREDIT_TRANSACTION_STATE: "credits.transactionNotReservable",
  CREDIT_CHANGE_REASON_REQUIRED: "credits.changeReasonRequired",
  CREDIT_POLICY_NOT_FOUND: "credits.policyNotFound",
  CREDIT_POLICY_LOCKED: "credits.policyLocked",
  EMPTY_CREDIT_POLICY_UPDATE: "credits.emptyPolicyUpdate",
  CREDIT_POLICY_CONFLICT: "credits.policyConflict",
  EMPTY_CREDIT_SETTINGS_UPDATE: "credits.emptySettingsUpdate",
  INVALID_CREDIT_TIMEZONE: "credits.invalidTimezone",
  CREDIT_SETTINGS_CONFLICT: "credits.settingsConflict",
  INVALID_CREDIT_ADJUSTMENT: "credits.invalidAdjustment",
  IDEMPOTENCY_KEY_CONFLICT: "credits.idempotencyConflict",
  NEGATIVE_CREDIT_BALANCE: "credits.negativeBalance",
  INVALID_CREDIT_REQUEST: "credits.invalidPurchaseRequest",
  CREDIT_REQUEST_TOO_LARGE: "credits.purchaseRequestTooLarge",
  ADMIN_REQUEST_FORBIDDEN: "credits.adminPurchaseForbidden",
  INVALID_PHONE_NUMBER: "credits.invalidPhone",
  CREDIT_REQUEST_NOT_FOUND: "credits.requestNotFound",
  INVALID_CREDIT_REQUEST_STATUS: "credits.invalidRequestStatus",
  CREDIT_REQUEST_COMPLETED: "credits.completedRequest",
  INVALID_CREDIT_REQUEST_TRANSITION: "credits.invalidRequestTransition",
  CREDIT_REQUEST_NOT_CONFIRMED: "credits.requestNotConfirmed",
  CREDIT_REQUEST_ALREADY_CREDITED: "credits.requestAlreadyCredited",
  CREDIT_REQUEST_USER_NOT_FOUND: "credits.requestStudentNotFound",
});

const withMessageMetadata = (body, messageKey, messageParams) => {
  if (!messageKey) return body;
  return {
    ...body,
    messageKey,
    ...(messageParams && Object.keys(messageParams).length ? { messageParams } : {}),
  };
};

const interfaceError = (message, messageKey, messageParams) => {
  const error = new Error(message);
  error.messageKey = messageKey;
  if (messageParams && Object.keys(messageParams).length) error.messageParams = messageParams;
  return error;
};

const creditErrorMetadata = (error) => {
  const messageKey = CREDIT_ERROR_KEYS[error?.code];
  if (!messageKey) return null;

  const details = error?.details || {};
  const messageParams = {};
  if (error.code === "INSUFFICIENT_CREDITS") {
    for (const key of ["required", "balance", "actionKey"]) {
      if (details[key] !== undefined) messageParams[key] = details[key];
    }
  } else if (error.code === "AI_DAILY_LIMIT_REACHED" && details.actionKey !== undefined) {
    messageParams.actionKey = details.actionKey;
  } else if (error.code === "CREDIT_PRICE_CHANGED") {
    for (const key of ["actionKey", "cost", "policyVersion"]) {
      if (details[key] !== undefined) messageParams[key] = details[key];
    }
  }
  return { messageKey, ...(Object.keys(messageParams).length ? { messageParams } : {}) };
};

const withCreditErrorMetadata = (body, error) => {
  const metadata = creditErrorMetadata(error);
  return metadata ? { ...body, ...metadata } : body;
};

const withErrorMessageMetadata = (body, error, fallbackKey) => {
  const withKnownCreditKey = withCreditErrorMetadata(body, error);
  if (withKnownCreditKey !== body) return withKnownCreditKey;
  if (typeof error?.messageKey === "string") {
    return withMessageMetadata(body, error.messageKey, error.messageParams);
  }
  return !error?.message && fallbackKey ? withMessageMetadata(body, fallbackKey) : body;
};

module.exports = { CREDIT_ERROR_KEYS, interfaceError, withMessageMetadata, creditErrorMetadata, withCreditErrorMetadata, withErrorMessageMetadata };
