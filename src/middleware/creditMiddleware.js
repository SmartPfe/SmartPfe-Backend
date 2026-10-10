const crypto = require("crypto");
const creditService = require("../services/creditService");
const { CreditError } = creditService;
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

    charge = await creditService.reserveCreditCharge({
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

    // A disconnected socket is not a failed AI operation. Finalize from the
    // server outcome, once only, even if the caller has gone away.
    let renewing = false;
    const leaseTimer = setInterval(async () => {
      if (renewing) return;
      renewing = true;
      try { await creditService.renewCreditChargeLease(charge); }
      catch (error) { console.error("[credits] Lease renewal failed:", error.message); }
      finally { renewing = false; }
    }, 60000);
    leaseTimer.unref?.();
    const stopLease = () => clearInterval(leaseTimer);
    let finalization;
    req.finalizeCredits = (succeeded, reason) => {
      if (!finalization) {
        const attempt = succeeded
          ? creditService.settleCreditCharge(charge, { releaseSlot: !options.manualSettlement })
          : creditService.refundCreditCharge(charge, reason, { releaseSlot: !options.manualSettlement });
        finalization = options.manualSettlement ? attempt : attempt.finally(stopLease);
      }
      return finalization;
    };
    req.releaseCreditSlot = () => { stopLease(); return creditService.releaseCreditSlot(charge); };
    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      if (responseHandled) return res;
      responseHandled = true;
      const succeeded = res.statusCode >= 200 && res.statusCode < 400;
      const finalize = req.finalizeCredits(succeeded, payload?.message || `HTTP ${res.statusCode}`);

      Promise.resolve(finalize)
        .then((creditUsage) => {
          if (succeeded && payload && typeof payload === "object" && !Array.isArray(payload)) {
            if (!res.destroyed) originalJson({ ...payload, creditUsage });
          } else {
            if (!res.destroyed) originalJson(payload);
          }
        })
        .catch((error) => {
          // Keep successful work reserved if accounting fails; never turn it into free work.
          if (!res.headersSent && !res.destroyed) {
            res.status(500);
            originalJson(withMessageMetadata({
              message: "The credit record could not be finalized. The reservation remains pending; please contact support.",
              code: "CREDIT_SETTLEMENT_FAILED",
            }, "credits.settlementPending"));
          }
          console.error("[credits] Settlement failed:", error.message);
        });
      if (options.manualSettlement) Promise.resolve(finalize)
        .then(req.releaseCreditSlot, req.releaseCreditSlot).catch(() => {});
      return res;
    };

    return next();
  } catch (error) {
    if (charge) {
      await creditService.refundCreditCharge(charge, error.message).catch(() => {});
    }
    return sendCreditError(error, res, next);
  }
};

module.exports = {
  creditGate,
  sendCreditError,
};
