const { AsyncLocalStorage } = require("async_hooks");
const { Langfuse } = require("langfuse");

const requestContext = new AsyncLocalStorage();

let langfuseInstance = null;

const getLangfuse = () => {
  if (!langfuseInstance) {
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const baseUrl = process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com";

    if (secretKey && publicKey) {
      langfuseInstance = new Langfuse({
        secretKey,
        publicKey,
        baseUrl,
      });
      console.info("[observability] Langfuse tracing initialized.");
    } else {
      console.warn("[observability] Langfuse keys not set; tracing disabled.");
    }
  }
  return langfuseInstance;
};

/**
 * Express middleware that runs the downstream request handlers inside an AsyncLocalStorage context.
 * When req.user is set (via protect middleware), it records user email/id/name for tracing.
 */
const observabilityContextMiddleware = (req, res, next) => {
  requestContext.run({ req }, () => {
    next();
  });
};

/**
 * Helper to retrieve the current active user context from AsyncLocalStorage.
 */
const getCurrentUserContext = () => {
  const store = requestContext.getStore();
  const user = store?.req?.user;
  if (!user) return null;
  return {
    userId: user.email || (user._id ? String(user._id) : "anonymous"),
    userName: user.fullName || user.name || "Student",
    userMongoId: user._id ? String(user._id) : undefined,
    userRole: user.role || "student",
  };
};

/**
 * Creates a Langfuse trace for an AI action
 * @param {object} params
 * @param {string} params.name - e.g. "report-chapter-generation", "problem-statement"
 * @param {string} [params.userId]
 * @param {string} [params.sessionId]
 * @param {object} [params.metadata]
 * @param {object} [params.tags]
 */
const createTrace = ({ name, userId, sessionId, metadata = {}, tags = [] }) => {
  const client = getLangfuse();
  if (!client) {
    return {
      span: () => ({ end: () => {} }),
      generation: () => ({ end: () => {} }),
      event: () => {},
      update: () => {},
    };
  }

  const activeUser = getCurrentUserContext();
  const resolvedUserId = userId || activeUser?.userId || "anonymous";
  const enrichedMetadata = {
    ...metadata,
    ...(activeUser ? {
      userName: activeUser.userName,
      userMongoId: activeUser.userMongoId,
      userRole: activeUser.userRole,
    } : {}),
  };

  try {
    return client.trace({
      name,
      userId: String(resolvedUserId),
      sessionId: sessionId ? String(sessionId) : undefined,
      metadata: enrichedMetadata,
      tags,
    });
  } catch (err) {
    console.warn(`[observability] Failed to create trace: ${err.message}`);
    return {
      span: () => ({ end: () => {} }),
      generation: () => ({ end: () => {} }),
      event: () => {},
      update: () => {},
    };
  }
};

/**
 * Flushes all pending traces to Langfuse Cloud
 */
const flushTraces = async () => {
  const client = getLangfuse();
  if (client) {
    try {
      await client.flushAsync();
    } catch (err) {
      console.warn(`[observability] Trace flush warning: ${err.message}`);
    }
  }
};

module.exports = {
  getLangfuse,
  createTrace,
  flushTraces,
  observabilityContextMiddleware,
  getCurrentUserContext,
};
