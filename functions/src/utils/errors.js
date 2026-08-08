const { HttpsError } = require("firebase-functions/v2/https");

const fail = (code, message, details) => { throw new HttpsError(code, message, details); };
const invalid = (message) => fail("invalid-argument", message);
const denied = (message = "You do not have permission to perform this action.") => fail("permission-denied", message);
const unauthenticated = () => fail("unauthenticated", "Sign in is required.");
const notFound = (message = "The requested record no longer exists.") => fail("not-found", message);
const conflict = (message, reason = "conflict") => fail("failed-precondition", message, { reason });
const normalizeError = (error) => {
  if (error instanceof HttpsError) throw error;
  console.error("Unexpected function error", error);
  throw new HttpsError("internal", "The operation could not be completed. Please try again.");
};
module.exports = { fail, invalid, denied, unauthenticated, notFound, conflict, normalizeError };