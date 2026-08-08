const { ROLES, PERMISSIONS, ROLE_PERMISSIONS, COLLECTIONS, ACTIVE_ASSIGNMENT_STATUSES } = require("../config/constants");
const { db, ensureAdmin, syncClaims } = require("../auth/guards");
const { auth, FieldValue } = require("../config/firebase");
const { invalid, notFound, conflict } = require("../utils/errors");
const { writeAudit } = require("../audit/writeAudit");

const hasReason = (value) => typeof value === "string" && value.trim().length >= 3;
const isEmail = (value) => /^\S+@\S+\.\S+$/.test(String(value || "").trim());
const activeAssignmentsFor = async (uid) => db().collection(COLLECTIONS.DRIVER_ASSIGNMENTS).where("driverId", "==", uid).get();

const createStaffAccount = async (context, data) => {
  const actor = await ensureAdmin(context, PERMISSIONS.MANAGE_USERS);
  const invitationId = String(data?.invitationId || "");
  if (!invitationId) invalid("A staff invitation is required.");
  const invitationRef = db().collection(COLLECTIONS.STAFF_INVITATIONS).doc(invitationId);
  const invitationSnapshot = await invitationRef.get();
  if (!invitationSnapshot.exists) notFound("The staff invitation no longer exists.");
  const invitation = invitationSnapshot.data();
  if (invitation.status !== "Pending Invitation" || invitation.intendedRole !== ROLES.DISPATCHER || !isEmail(invitation.email)) conflict("This invitation cannot be activated.", "already-processed");
  let authUser;
  try { authUser = await auth.getUserByEmail(invitation.email); } catch (error) { if (error.code !== "auth/user-not-found") throw error; }
  if (authUser) conflict("An Authentication account already exists for this invitation email.", "duplicate-account");
  const created = await auth.createUser({ email: invitation.email, displayName: invitation.displayName || undefined, disabled: false });
  const profile = { fullName: invitation.displayName || "Dispatcher", email: invitation.email, role: ROLES.DISPATCHER, accountStatus: "Active", permissions: ROLE_PERMISSIONS[ROLES.DISPATCHER], barangay: invitation.barangay || "", serviceAreas: Array.isArray(invitation.serviceAreas) ? invitation.serviceAreas : [], operationalPhone: invitation.operationalPhone || "", createdAt: FieldValue.serverTimestamp(), createdBy: actor.id, backendVersion: 8 };
  try {
    await db().runTransaction(async (transaction) => {
      transaction.create(db().collection(COLLECTIONS.USERS).doc(created.uid), profile);
      transaction.update(invitationRef, { status: "Activated", acceptedBy: actor.id, acceptedAt: FieldValue.serverTimestamp(), activatedUserId: created.uid });
      writeAudit(transaction, { action: "staff-account-created", actor, targetType: "user", targetId: created.uid, summary: "Dispatcher staff account activated from invitation.", metadata: { invitationId } });
    });
    await syncClaims(created.uid, { ...profile, claimsVersion: 1 });
  } catch (error) { await auth.deleteUser(created.uid).catch(() => {}); throw error; }
  return { uid: created.uid, email: invitation.email, role: ROLES.DISPATCHER, onboarding: "Use Firebase Authentication password reset to set the initial password. No email is sent by this function." };
};

const reviewDriverApplication = async (context, data) => {
  const actor = await ensureAdmin(context, PERMISSIONS.REVIEW_DRIVERS);
  const applicationId = String(data?.applicationId || ""); const decision = String(data?.decision || ""); const reason = String(data?.reason || "").trim(); const notes = String(data?.notes || "").trim();
  if (!["Approved", "Rejected", "Under Review", "Correction Requested"].includes(decision)) invalid("Choose a supported application decision.");
  if (decision === "Rejected" && !hasReason(reason)) invalid("A rejection reason is required.");
  let approvedProfile;
  await db().runTransaction(async (transaction) => {
    const appRef = db().collection(COLLECTIONS.DRIVER_APPLICATIONS).doc(applicationId); const appSnapshot = await transaction.get(appRef);
    if (!appSnapshot.exists) notFound("The driver application no longer exists."); const application = appSnapshot.data();
    if (application.driverUid === actor.id) conflict("You cannot review your own Driver application.", "self-action");
    if (["Approved", "Rejected"].includes(application.status)) conflict("This application already has a final decision.", "already-processed");
    const profileRef = db().collection(COLLECTIONS.USERS).doc(application.driverUid); const profileSnapshot = await transaction.get(profileRef);
    if (!profileSnapshot.exists) notFound("The linked Driver profile is unavailable."); const previous = profileSnapshot.data();
    transaction.update(appRef, { status: decision, approvalStatus: decision, reviewedBy: actor.id, reviewedAt: FieldValue.serverTimestamp(), reviewNotes: notes, rejectionReason: decision === "Rejected" ? reason : "", updatedAt: FieldValue.serverTimestamp(), ...(decision === "Approved" ? { approvedAt: FieldValue.serverTimestamp() } : {}) });
    if (decision === "Approved" || decision === "Rejected") { approvedProfile = { ...previous, accountStatus: decision, approvalStatus: decision, approvalReviewedAt: FieldValue.serverTimestamp(), approvalReviewedBy: actor.id }; transaction.update(profileRef, { accountStatus: decision, approvalStatus: decision, approvalReviewedAt: FieldValue.serverTimestamp(), approvalReviewedBy: actor.id, updatedAt: FieldValue.serverTimestamp() }); }
    writeAudit(transaction, { action: "driver-application-reviewed", actor, targetType: "driverApplication", targetId: applicationId, summary: `Driver application marked ${decision}.`, before: { status: application.status }, after: { status: decision }, metadata: { reason: decision === "Rejected" ? reason : undefined } });
  });
  if (approvedProfile) await syncClaims(data.driverUid || (await db().collection(COLLECTIONS.DRIVER_APPLICATIONS).doc(applicationId).get()).data().driverUid, approvedProfile);
  return { decision };
};

const changeAccountStatus = async (context, data) => {
  const actor = await ensureAdmin(context, PERMISSIONS.MANAGE_USERS); const targetUserId = String(data?.targetUserId || ""); const nextStatus = String(data?.nextStatus || ""); const reason = String(data?.reason || "").trim();
  if (!targetUserId || !hasReason(reason)) invalid("A target account and reason are required."); if (targetUserId === actor.id) conflict("You cannot change your own account status.", "self-action");
  const allowed = ["Active", "Approved", "Pending", "Rejected", "Suspended", "Disabled", "Deactivated"]; if (!allowed.includes(nextStatus)) invalid("Choose a supported account status.");
  const targetRef = db().collection(COLLECTIONS.USERS).doc(targetUserId); let nextProfile;
  await db().runTransaction(async (transaction) => { const targetSnapshot = await transaction.get(targetRef); if (!targetSnapshot.exists) notFound(); const target = targetSnapshot.data(); const activeAssignments = target.role === ROLES.DRIVER ? await transaction.get(db().collection(COLLECTIONS.DRIVER_ASSIGNMENTS).where("driverId", "==", targetUserId)) : null; if (["Suspended", "Disabled", "Deactivated"].includes(nextStatus) && activeAssignments?.docs.some((item) => ACTIVE_ASSIGNMENT_STATUSES.has(item.data().status))) conflict("Resolve active missions before changing this account status.", "active-mission"); nextProfile = { ...target, accountStatus: nextStatus }; transaction.update(targetRef, { accountStatus: nextStatus, previousAccountStatus: target.accountStatus || "Active", accountStatusReason: reason, accountStatusChangedBy: actor.id, accountStatusChangedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }); writeAudit(transaction, { action: "account-status-changed", actor, targetType: "user", targetId: targetUserId, summary: `Account status changed to ${nextStatus}.`, before: { accountStatus: target.accountStatus }, after: { accountStatus: nextStatus }, metadata: { reason } }); });
  const disabled = ["Suspended", "Disabled", "Deactivated", "Rejected", "Pending"].includes(nextStatus); await auth.updateUser(targetUserId, { disabled }); await syncClaims(targetUserId, nextProfile); return { accountStatus: nextStatus, authDisabled: disabled };
};

const updateUserRole = async (context, data) => {
  const actor = await ensureAdmin(context, PERMISSIONS.MANAGE_USERS); const targetUserId = String(data?.targetUserId || ""); const role = String(data?.role || ""); const reason = String(data?.reason || "").trim(); if (!Object.values(ROLES).includes(role) || !hasReason(reason)) invalid("A supported role and reason are required."); if (targetUserId === actor.id) conflict("You cannot change your own role.", "self-action"); const ref = db().collection(COLLECTIONS.USERS).doc(targetUserId); let nextProfile;
  await db().runTransaction(async (transaction) => { const snap = await transaction.get(ref); if (!snap.exists) notFound(); const before = snap.data(); if (before.role === ROLES.DRIVER && role !== ROLES.DRIVER) { const assignments = await transaction.get(db().collection(COLLECTIONS.DRIVER_ASSIGNMENTS).where("driverId", "==", targetUserId)); if (assignments.docs.some((item) => ACTIVE_ASSIGNMENT_STATUSES.has(item.data().status))) conflict("Resolve active missions before changing this Driver role.", "active-mission"); } nextProfile = { ...before, role, permissions: ROLE_PERMISSIONS[role] || [] }; transaction.update(ref, { role, permissions: nextProfile.permissions, previousRole: before.role, roleChangedBy: actor.id, roleChangedAt: FieldValue.serverTimestamp(), roleChangeReason: reason, updatedAt: FieldValue.serverTimestamp() }); writeAudit(transaction, { action: "role-changed", actor, targetType: "user", targetId: targetUserId, summary: `Role changed to ${role}.`, before: { role: before.role }, after: { role }, metadata: { reason } }); }); await syncClaims(targetUserId, nextProfile); return { role, refreshToken: true };
};

const updateDispatcherServiceAreas = async (context, data) => {
  const actor = await ensureAdmin(context, PERMISSIONS.MANAGE_DISPATCHER_SCOPES); const targetUserId = String(data?.targetUserId || ""); const serviceAreas = [...new Set((data?.serviceAreas || []).filter((item) => typeof item === "string" && item.trim()))].slice(0, 25); const reason = String(data?.reason || "").trim(); if (!hasReason(reason)) invalid("A reason is required."); const ref = db().collection(COLLECTIONS.USERS).doc(targetUserId); let nextProfile;
  await db().runTransaction(async (transaction) => { const snap = await transaction.get(ref); if (!snap.exists || snap.data().role !== ROLES.DISPATCHER) conflict("The target account is not a Dispatcher.", "invalid-role"); const before = snap.data(); nextProfile = { ...before, serviceAreas }; transaction.update(ref, { serviceAreas, scopeChangedBy: actor.id, scopeChangedAt: FieldValue.serverTimestamp(), scopeChangeReason: reason, updatedAt: FieldValue.serverTimestamp() }); writeAudit(transaction, { action: "dispatcher-service-areas-updated", actor, targetType: "user", targetId: targetUserId, summary: "Dispatcher service areas updated.", before: { serviceAreas: before.serviceAreas || [] }, after: { serviceAreas }, metadata: { reason } }); }); await syncClaims(targetUserId, nextProfile); return { serviceAreas, refreshToken: true };
};

const processUserDeletion = async (context, data) => {
  const actor = await ensureAdmin(context, PERMISSIONS.MANAGE_USERS); const deletionRequestId = String(data?.deletionRequestId || ""); if (!deletionRequestId) invalid("A deletion request is required."); const requestRef = db().collection(COLLECTIONS.DELETION_REQUESTS).doc(deletionRequestId); const requestSnapshot = await requestRef.get(); if (!requestSnapshot.exists) notFound("The deletion request no longer exists."); const request = requestSnapshot.data(); if (request.requestedBy === actor.id && request.targetUserId === actor.id) conflict("You cannot process deletion of your own account.", "self-action"); if (request.status !== "Pending backend processing") conflict("This deletion request was already processed.", "already-processed"); const targetRef = db().collection(COLLECTIONS.USERS).doc(request.targetUserId); const targetSnapshot = await targetRef.get(); if (!targetSnapshot.exists) notFound("The target profile no longer exists."); await auth.deleteUser(request.targetUserId).catch((error) => { if (error.code !== "auth/user-not-found") throw error; }); await db().runTransaction(async (transaction) => { const target = targetSnapshot.data(); transaction.update(targetRef, { fullName: "Deleted user", email: "", phone: "", phoneNumber: "", address: "", accountStatus: "Deactivated", deletedAt: FieldValue.serverTimestamp(), deletedBy: actor.id, dataRetention: "Operational records retained; profile anonymized.", updatedAt: FieldValue.serverTimestamp() }); transaction.update(requestRef, { status: "Processed", processedAt: FieldValue.serverTimestamp(), processedBy: actor.id }); writeAudit(transaction, { action: "user-deletion-processed", actor, targetType: "user", targetId: request.targetUserId, summary: "Authentication account deleted and profile anonymized; operational history retained.", metadata: { deletionRequestId } }); }); return { processed: true };
};
module.exports = { createStaffAccount, reviewDriverApplication, changeAccountStatus, updateUserRole, updateDispatcherServiceAreas, processUserDeletion };