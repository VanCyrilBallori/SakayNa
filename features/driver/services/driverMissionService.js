import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../firebase";
import { FIRESTORE_COLLECTIONS, MISSION_STATUSES, REQUEST_STATUSES } from "../../../constants/app";
import { canAdvanceMission, getMissionStatus } from "../utils/driverMissionMapper";

const driverTimelineKey = { Accepted: "driverAccepted", "En Route": "driverEnRoute", Arrived: "driverArrived", "Picked Up": "driverPickedUp", Completed: "driverCompleted" };
const timestampKey = { Accepted: "acceptedAt", "En Route": "enRouteAt", Arrived: "arrivedAt", "Picked Up": "pickedUpAt", Completed: "completedAt" };

const assignmentRef = (id) => doc(db, FIRESTORE_COLLECTIONS.DRIVER_ASSIGNMENTS, id);
const requestRef = (id) => doc(db, FIRESTORE_COLLECTIONS.TRANSPORT_REQUESTS, id);
const vehicleRef = (id) => doc(db, FIRESTORE_COLLECTIONS.VEHICLES, id);

export const saveVehicleChecklist = async ({ checklistId, driverId, assignment, items, issues }) => {
  const ref = checklistId ? doc(db, "vehicleChecklists", checklistId) : doc(db, "vehicleChecklists");
  await setDoc(ref, { driverId, vehicleId: assignment.vehicleId || "", assignmentId: assignment.id, scheduleId: assignment.scheduleId || "", items, issues: issues.trim().slice(0, 500), ready: true, completedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: false });
  return ref.id;
};

export const acceptAssignment = async ({ assignmentId, driverId, checklistId }) => runTransaction(db, async (tx) => {
  const assignmentSnapshot = await tx.get(assignmentRef(assignmentId));
  if (!assignmentSnapshot.exists()) throw new Error("Assignment is no longer available.");
  const assignment = assignmentSnapshot.data();
  if (assignment.driverId !== driverId || assignment.status !== "Assigned") throw new Error("This assignment is no longer available to accept.");
  const requestSnapshot = await tx.get(requestRef(assignment.requestId));
  if (!requestSnapshot.exists() || requestSnapshot.data().status !== REQUEST_STATUSES.ASSIGNED || requestSnapshot.data().assignedDriverId !== driverId) throw new Error("The related request is no longer assignable.");
  const checklistSnapshot = await tx.get(doc(db, "vehicleChecklists", checklistId));
  if (!checklistSnapshot.exists() || checklistSnapshot.data().driverId !== driverId || checklistSnapshot.data().assignmentId !== assignmentId || checklistSnapshot.data().vehicleId !== assignment.vehicleId || checklistSnapshot.data().ready !== true) throw new Error("Complete the vehicle readiness checklist before accepting.");
  const timeline = requestSnapshot.data().timeline || {};
  tx.update(assignmentRef(assignmentId), { status: REQUEST_STATUSES.IN_PROGRESS, missionStatus: MISSION_STATUSES.ACCEPTED, acceptedBy: driverId, acceptedAt: serverTimestamp(), vehicleChecklistId: checklistId, updatedAt: serverTimestamp() });
  tx.update(requestRef(assignment.requestId), { status: REQUEST_STATUSES.IN_PROGRESS, missionStatus: MISSION_STATUSES.ACCEPTED, acceptedAt: serverTimestamp(), updatedAt: serverTimestamp(), timeline: { ...timeline, driverAccepted: { actorRole: "Driver", actorId: driverId, note: null } } });
  if (assignment.vehicleId) tx.update(vehicleRef(assignment.vehicleId), { status: "In Use", updatedAt: serverTimestamp() });
});

export const advanceMission = async ({ assignmentId, driverId, nextStatus, completion }) => runTransaction(db, async (tx) => {
  const assignmentSnapshot = await tx.get(assignmentRef(assignmentId));
  if (!assignmentSnapshot.exists()) throw new Error("Mission not found.");
  const assignment = { id: assignmentId, ...assignmentSnapshot.data() };
  if (assignment.driverId !== driverId || !canAdvanceMission(assignment, nextStatus)) throw new Error("This mission can no longer move to that status.");
  const requestSnapshot = await tx.get(requestRef(assignment.requestId));
  if (!requestSnapshot.exists() || [REQUEST_STATUSES.CANCELLED, "Rejected", REQUEST_STATUSES.COMPLETED].includes(requestSnapshot.data().status)) throw new Error("The request is no longer active.");
  const timestamp = timestampKey[nextStatus]; const timelineKey = driverTimelineKey[nextStatus]; const timeline = requestSnapshot.data().timeline || {};
  const isComplete = nextStatus === MISSION_STATUSES.COMPLETED;
  const assignmentUpdate = { missionStatus: nextStatus, status: isComplete ? REQUEST_STATUSES.COMPLETED : REQUEST_STATUSES.IN_PROGRESS, [timestamp]: serverTimestamp(), updatedAt: serverTimestamp(), ...(isComplete ? { completionOutcome: completion.outcome, completionNotes: completion.notes, completionIssues: completion.issues || "" } : {}) };
  const requestUpdate = { missionStatus: nextStatus, status: isComplete ? REQUEST_STATUSES.COMPLETED : REQUEST_STATUSES.IN_PROGRESS, [timestamp]: serverTimestamp(), updatedAt: serverTimestamp(), timeline: { ...timeline, [timelineKey]: { actorRole: "Driver", actorId: driverId, note: isComplete ? completion.notes : null } } };
  tx.update(assignmentRef(assignmentId), assignmentUpdate); tx.update(requestRef(assignment.requestId), requestUpdate);
  if (isComplete && assignment.vehicleId) tx.update(vehicleRef(assignment.vehicleId), { status: "Available", assignedDriverId: null, assignedRequestId: null, updatedAt: serverTimestamp() });
});

export const declineAssignment = async ({ assignmentId, driverId, reason, details }) => runTransaction(db, async (tx) => {
  const assignmentSnapshot = await tx.get(assignmentRef(assignmentId));
  if (!assignmentSnapshot.exists()) throw new Error("Assignment not found.");
  const assignment = assignmentSnapshot.data();
  if (assignment.driverId !== driverId || assignment.status !== "Assigned") throw new Error("Only a new assignment can be declined.");
  const requestSnapshot = await tx.get(requestRef(assignment.requestId));
  if (!requestSnapshot.exists() || requestSnapshot.data().assignedDriverId !== driverId || requestSnapshot.data().status !== REQUEST_STATUSES.ASSIGNED) throw new Error("This request is no longer assigned to you.");
  tx.update(assignmentRef(assignmentId), { status: "Declined", missionStatus: MISSION_STATUSES.DECLINED, declinedBy: driverId, declinedAt: serverTimestamp(), declineReason: reason, declineDetails: details.trim(), previousStatus: "Assigned", updatedAt: serverTimestamp() });
  const request = requestSnapshot.data();
  tx.update(requestRef(assignment.requestId), { status: REQUEST_STATUSES.PENDING, missionStatus: null, assignedDriverId: null, assignedDriverName: null, assignedVehicleId: null, assignedVehicleName: null, vehicleId: null, vehicle: null, vehiclePlateNumber: null, lastDeclinedDriverId: driverId, lastDeclineReason: reason, updatedAt: serverTimestamp(), timeline: { ...(request.timeline || {}), driverDeclined: { actorRole: "Driver", actorId: driverId, note: reason } } });
  if (assignment.vehicleId) tx.update(vehicleRef(assignment.vehicleId), { status: "Available", assignedDriverId: null, assignedRequestId: null, updatedAt: serverTimestamp() });
});
