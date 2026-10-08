const crypto = require("crypto");
const {
  CreditError,
  reserveCreditCharge,
  settleCreditCharge,
  refundCreditCharge,
} = require("../services/creditService");
const { withCreditErrorMetadata, withMessageMetadata } = require("../lib/interfaceMessages");

const sendCreditError = (error, res, next) => {
  if (!(error instanceof CreditError)) return next(error);
  const response = withCreditErrorMetadata({
    message: error.message,
    code: error.code,
    ...error.details,
  }, error);
  return res.status(error.status || 400).json(response);
};

const normalizeResolution = (resolution) => {
  if (!resolution) return null;
  if (typeof resolution === "string") return { actionKey: resolution, metadata: {} };
  return resolution;
};

const resolveRequestId = (req) =>
  String(req.headers["x-idempotency-key"] || req.body?.idempotencyKey || crypto.randomUUID()).slice(0, 160);

const creditGate = (actionResolver, options = {}) => async (req, res, next) => {
  let charge;
  let responseHandled = false;
  try {
    const resolution = normalizeResolution(
      typeof actionResolver === "function" ? await actionResolver(req) : actionResolver
    );
    if (!resolution?.actionKey) return next();

    charge = await reserveCreditCharge({
      user: req.user,
      actionKey: resolution.actionKey,
      requestId: resolveRequestId(req),
      expectedPolicyVersion: req.headers["x-credit-policy-version"] || req.body?.creditPolicyVersion,
      metadata: {
        route: req.originalUrl,
        method: req.method,
        projectId: req.body?.projectId,
        sectionId: req.body?.sectionId,
        ...resolution.metadata,
      },
      ip: req.ip,
    });
    req.creditCharge = charge;

    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      if (responseHandled) return res;
      responseHandled = true;
      const succeeded = res.statusCode >= 200 && res.statusCode < 400;
      const finalize = succeeded
        ? settleCreditCharge(charge)
        : refundCreditCharge(charge, payload?.message || `HTTP ${res.statusCode}`);

      Promise.resolve(finalize)
        .then((creditUsage) => {
          if (succeeded && payload && typeof payload === "object" && !Array.isArray(payload)) {
            originalJson({ ...payload, creditUsage });
          } else {
            originalJson(payload);
          }
        })
        .catch(async (error) => {
          await refundCreditCharge(charge, "Credit settlement failed").catch(() => {});
          if (!res.headersSent) {
            res.status(500);
            originalJson(withMessageMetadata({
              message: "The AI action finished, but its credit record could not be finalized. No charge was kept.",
              code: "CREDIT_SETTLEMENT_FAILED",
            }, "credits.settlementFailed"));
          }
          console.error("[credits] Settlement failed:", error.message);
        });
      return res;
    };

    res.once("finish", () => {
      responseHandled = true;
    });

    res.once("close", () => {
      if (!responseHandled && charge) {
        responseHandled = true;
        refundCreditCharge(charge, "Client disconnected before completion").catch((error) => {
          console.error("[credits] Disconnect refund failed:", error.message);
        });
      }
    });

    return next();
  } catch (error) {
    if (charge) {
      await refundCreditCharge(charge, error.message).catch(() => {});
    }
    return sendCreditError(error, res, next);
  }
};

module.exports = {
  creditGate,
  sendCreditError,
};
