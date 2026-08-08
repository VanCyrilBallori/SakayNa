import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../../../firebase";
import { callTrustedFunction } from "../../../lib/backendFunctions";

export const saveVehicleChecklist = async ({ checklistId, driverId, assignment, items, issues }) => {
  const ref = checklistId ? doc(db, "vehicleChecklists", checklistId) : doc(db, "vehicleChecklists");
  await setDoc(ref, { driverId, vehicleId: assignment.vehicleId || "", assignmentId: assignment.id, scheduleId: assignment.scheduleId || "", items, issues: issues.trim().slice(0, 500), ready: true, completedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: false });
  return ref.id;
};

export const acceptAssignment = async ({ assignmentId, checklistId }) => callTrustedFunction("transitionMissionStatus", { assignmentId, nextStatus: "Accepted", checklistId });
export const advanceMission = async ({ assignmentId, nextStatus, completion = {} }) => callTrustedFunction("transitionMissionStatus", { assignmentId, nextStatus, notes: completion.notes || "", completion });
export const declineAssignment = async ({ assignmentId, reason, details }) => callTrustedFunction("transitionMissionStatus", { assignmentId, nextStatus: "Declined", notes: [reason, details].filter(Boolean).join(": ") });