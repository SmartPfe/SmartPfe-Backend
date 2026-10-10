const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client();
const identityError = (message, status = 401) => Object.assign(new Error(message), { status });

const verifyGoogleIdentity = async (credential) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw identityError("Google sign-in is unavailable.", 503);
  }
  if (typeof credential !== "string" || !credential) throw identityError("Missing Google credential.", 400);
  let ticket;
  try { ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID }); }
  catch (_) { throw identityError("Invalid Google credential."); }
  const payload = ticket.getPayload();
  if (!payload || typeof payload.sub !== "string" || !payload.sub || typeof payload.email !== "string" || payload.email_verified !== true) {
    throw identityError("Google must provide a verified email address.");
  }
  return { googleId: payload.sub, email: payload.email.trim().toLowerCase(), fullName: payload.name,
    picture: payload.picture, authoritativeEmail: payload.email.toLowerCase().endsWith("@gmail.com") || Boolean(payload.hd) };
};
module.exports = { verifyGoogleIdentity };
