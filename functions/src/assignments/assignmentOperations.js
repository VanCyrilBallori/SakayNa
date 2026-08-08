const { COLLECTIONS, ROLES, ACTIVE_ASSIGNMENT_STATUSES, PERMISSIONS } = require("../config/constants");
const { db, loadActor, requireRole, requirePermission, requireServiceArea } = require("../auth/guards");
const { FieldValue } = require("../config/firebase");
const { invalid, notFound, conflict } = require("../utils/errors");
const { writeAudit } = require("../audit/writeAudit");

const assignRequest = async (context, data) => {
  const actor = await loadActor(context); requireRole(actor, [ROLES.ADMIN, ROLES.DISPATCHER]); requirePermission(actor, PERMISSIONS.ASSIGN_REQUESTS);
  const requestId = String(data?.requestId || ""); const driverId = String(data?.driverId || ""); const vehicleId = String(data?.vehicleId || ""); const priority = String(data?.priority || ""); const notes = String(data?.operationalNotes || "").trim(); if (!requestId || !driverId || !vehicleId) invalid("Request, Driver, and vehicle are required.");
  let assignmentId = "";
  await db().runTransaction(async (transaction) => {
    const requestRef = db().collection(COLLECTIONS.TRANSPORT_REQUESTS).doc(requestId); const driverRef = db().collection(COLLECTIONS.USERS).doc(driverId); const vehicleRef = db().collection(COLLECTIONS.VEHICLES).doc(vehicleId);
    const [requestSnapshot, driverSnapshot, vehicleSnapshot] = await Promise.all([transaction.get(requestRef), transaction.get(driverRef), transaction.get(vehicleRef)]);
    if (!requestSnapshot.exists) notFound("This request no longer exists."); const request = requestSnapshot.data(); if (request.status !== "Pending") conflict("This request is no longer awaiting assignment.", "request-not-assignable"); requireServiceArea(actor, request.barangay);
    if (!driverSnapshot.exists || driverSnapshot.data().role !== ROLES.DRIVER || driverSnapshot.data().accountStatus !== "Approved") conflict("The selected Driver is not approved.", "driver-unavailable");
    if (!vehicleSnapshot.exists || !["Available", "Assigned"].includes(vehicleSnapshot.data().status || "Available") || ["Reported", "Scheduled", "In Progress"].includes(vehicleSnapshot.data().maintenanceStatus)) conflict("The selected vehicle is unavailable.", "vehicle-unavailable");
    const [driverAssignments, vehicleAssignments] = await Promise.all([transaction.get(db().collection(COLLECTIONS.DRIVER_ASSIGNMENTS).where("driverId", "==", driverId)), transaction.get(db().collection(COLLECTIONS.DRIVER_ASSIGNMENTS).where("vehicleId", "==", vehicleId))]);
    if (driverAssignments.docs.some((item) => ACTIVE_ASSIGNMENT_STATUSES.has(item.data().status))) conflict("The selected Driver already has an active mission.", "driver-unavailable"); if (vehicleAssignments.docs.some((item) => ACTIVE_ASSIGNMENT_STATUSES.has(item.data().status))) conflict("The selected vehicle already has an active mission.", "vehicle-unavailable");
    const assignmentRef = db().collection(COLLECTIONS.DRIVER_ASSIGNMENTS).doc(); assignmentId = assignmentRef.id; const attempt = Number(request.assignmentAttemptCount || 0) + 1; const timeline = { ...(request.timeline || {}), assigned: { actorId: actor.id, actorRole: actor.role, note: notes || "Assignment created by dispatcher.", at: FieldValue.serverTimestamp() } };
    transaction.create(assignmentRef, { requestId, residentId: request.residentId || "", driverId, driverName: driverSnapshot.data().fullName || "Driver", dispatcherId: actor.id, vehicleId, vehicleName: vehicleSnapshot.data().name || "Vehicle", status: "Assigned", missionStatus: "Assigned", attempt, assignedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), backendVersion: 8 });
    transaction.update(requestRef, { status: "Assigned", missionStatus: "Assigned", assignedDriverId: driverId, assignedDriverName: driverSnapshot.data().fullName || "Driver", assignedVehicleId: vehicleId, assignedVehicleName: vehicleSnapshot.data().name || "Vehicle", assignedAt: FieldValue.serverTimestamp(), assignedBy: actor.id, assignmentAttemptCount: attempt, timeline, updatedAt: FieldValue.serverTimestamp(), priorityLevel: priority || request.priorityLevel });
    transaction.update(vehicleRef, { status: "Assigned", assignedDriverId: driverId, assignedRequestId: requestId, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(transaction, { action: "request-assigned", actor, targetType: "transportRequest", targetId: requestId, requestId, assignmentId, summary: "Request assigned through trusted backend.", metadata: { driverId, vehicleId, attempt } });
  });
  return { assignmentId };
};
module.exports = { assignRequest };