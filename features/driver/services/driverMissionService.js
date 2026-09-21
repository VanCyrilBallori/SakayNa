import { doc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../../../firebase";

const TIMESTAMP_FIELD = {
  Accepted: "acceptedAt",
  "En Route": "enRouteAt",
  Arrived: "arrivedAt",
  "Picked Up": "pickedUpAt",
  Completed: "completedAt",
  Declined: "declinedAt",
};

export const saveVehicleChecklist = async ({ checklistId, driverId, assignment, items, issues }) => {
  const ref = checklistId ? doc(db, "vehicleChecklists", checklistId) : doc(db, "vehicleChecklists");
  await setDoc(
    ref,
    {
      driverId,
      vehicleId: assignment.vehicleId || "",
      assignmentId: assignment.id,
      scheduleId: assignment.scheduleId || "",
      items,
      issues: issues.trim().slice(0, 500),
      ready: true,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: false }
  );
  return ref.id;
};

// Moves a mission to its next step, updating the assignment and its linked request together.
const transitionMission = async (assignmentId, nextStatus, notes = "") => {
  if (!assignmentId || !nextStatus) {
    throw new Error("Assignment and next mission status are required.");
  }

  await runTransaction(db, async (transaction) => {
    const assignmentRef = doc(db, "driverAssignments", assignmentId);
    const assignmentSnapshot = await transaction.get(assignmentRef);

    if (!assignmentSnapshot.exists()) {
      throw new Error("This assignment no longer exists.");
    }

    const assignment = assignmentSnapshot.data();
    const requestRef = assignment.requestId ? doc(db, "transportRequests", assignment.requestId) : null;

    const assignmentPatch = { missionStatus: nextStatus, updatedAt: serverTimestamp() };
    const requestPatch = { missionStatus: nextStatus, updatedAt: serverTimestamp() };

    const stampField = TIMESTAMP_FIELD[nextStatus];
    if (stampField) {
      assignmentPatch[stampField] = serverTimestamp();
      requestPatch[stampField] = serverTimestamp();
    }

    if (nextStatus === "Completed") {
      assignmentPatch.status = "Completed";
      assignmentPatch.completionNotes = notes;
      requestPatch.status = "Completed";
      if (assignment.vehicleId) {
        transaction.update(doc(db, "vehicles", assignment.vehicleId), {
          status: "Available",
          assignedRequestId: "",
          updatedAt: serverTimestamp(),
        });
      }
    } else if (nextStatus === "Declined") {
      assignmentPatch.status = "Declined";
      assignmentPatch.declineReason = notes;
      requestPatch.status = "Pending";
      requestPatch.missionStatus = null;
      requestPatch.assignedDriverId = null;
      requestPatch.assignedDriverName = null;
      requestPatch.assignedVehicleId = null;
      requestPatch.assignedVehicleName = null;
      requestPatch.lastDeclinedDriverId = assignment.driverId || null;
      requestPatch.lastDeclineReason = notes;
      if (assignment.vehicleId) {
        transaction.update(doc(db, "vehicles", assignment.vehicleId), {
          status: "Available",
          assignedRequestId: "",
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      assignmentPatch.status = "In Progress";
      requestPatch.status = "In Progress";
    }

    transaction.update(assignmentRef, assignmentPatch);
    if (requestRef) {
      transaction.update(requestRef, requestPatch);
    }
  });

  return { nextStatus };
};

export const acceptAssignment = async ({ assignmentId }) => transitionMission(assignmentId, "Accepted");

export const advanceMission = async ({ assignmentId, nextStatus, completion = {} }) =>
  transitionMission(assignmentId, nextStatus, completion.notes || "");

export const declineAssignment = async ({ assignmentId, reason, details }) =>
  transitionMission(assignmentId, "Declined", [reason, details].filter(Boolean).join(": "));
