const MIN_PASSWORD_CHARACTERS = 15;
// bcrypt only uses the first 72 bytes. Reject longer secrets rather than truncating them.
const MAX_PASSWORD_BYTES = 72;
const passwordPolicyError = (password) => {
  if (typeof password !== "string" || [...password].length < MIN_PASSWORD_CHARACTERS) return "auth.passwordTooShort";
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) return "auth.passwordTooLong";
  return null;
};
module.exports = { passwordPolicyError, MIN_PASSWORD_CHARACTERS, MAX_PASSWORD_BYTES };
