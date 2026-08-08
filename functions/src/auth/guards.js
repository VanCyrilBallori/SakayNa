const { ROLES, ACTIVE_ACCOUNT_STATUSES, PERMISSIONS, ROLE_PERMISSIONS, COLLECTIONS } = require("../config/constants");
const { auth, db: firestore } = require("../config/firebase");
const { denied, unauthenticated, notFound, conflict } = require("../utils/errors");

const db = () => firestore;
const userRef = (uid) => db().collection(COLLECTIONS.USERS).doc(uid);
const safeClaims = (profile) => ({
  role: String(profile.role || "").toLowerCase(),
  permissions: (profile.permissions || ROLE_PERMISSIONS[profile.role] || []).filter((permission) => Object.values(PERMISSIONS).includes(permission)).slice(0, 25),
  serviceAreas: Array.isArray(profile.serviceAreas) ? profile.serviceAreas.filter(Boolean).slice(0, 25) : [],
  accountActive: ACTIVE_ACCOUNT_STATUSES.has(profile.accountStatus || "Active"),
  claimsVersion: Number(profile.claimsVersion || 0) + 1,
});
const loadActor = async (context) => {
  if (!context.auth?.uid) unauthenticated();
  const snapshot = await userRef(context.auth.uid).get();
  if (!snapshot.exists) notFound("Your SakayNa profile is unavailable.");
  const profile = { id: snapshot.id, ...snapshot.data() };
  if (!ACTIVE_ACCOUNT_STATUSES.has(profile.accountStatus || "Active")) conflict("This account is not active.", "account-inactive");
  return profile;
};
const requireRole = (actor, roles) => {
  if (!roles.includes(actor.role)) denied();
};
const requirePermission = (actor, permission) => {
  if (actor.role === ROLES.ADMIN) return;
  const permissions = actor.permissions || ROLE_PERMISSIONS[actor.role] || [];
  if (!permissions.includes(permission)) denied();
};
const requireServiceArea = (actor, barangay) => {
  if (actor.role === ROLES.ADMIN || !barangay) return;
  const serviceAreas = actor.serviceAreas || [];
  if (!serviceAreas.includes(barangay)) denied("This request is outside your authorized service area.");
};
const syncClaims = async (uid, profile) => auth.setCustomUserClaims(uid, safeClaims(profile));
const ensureAdmin = async (context, permission) => { const actor = await loadActor(context); requireRole(actor, [ROLES.ADMIN]); if (permission) requirePermission(actor, permission); return actor; };
module.exports = { db, userRef, loadActor, requireRole, requirePermission, requireServiceArea, syncClaims, safeClaims, ensureAdmin };