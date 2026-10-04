import { collection, doc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../../../firebase";

const TIMESTAMP_FIELD = {
  Accepted: "acceptedAt",
  "En Route": "enRouteAt",
  Arrived: "arrivedAt",
  "Picked Up": "pickedUpAt",
  Completed: "completedAt",
  Declined: "declinedAt",
};

// Not used since driver-home-restyle-plan.md Piece 1 (Accept no longer asks for the checklist).
// Kept so it can come back; the saved vehicleChecklists stay in Firestore.
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

    // The resident may have cancelled the ride while it was still "Assigned" (Skills/resident.md #1).
    // Then nothing is saved, so Accept or Decline can never undo the cancel.
    let request = null;
    if (requestRef) {
      const requestSnapshot = await transaction.get(requestRef);
      request = requestSnapshot.exists() ? requestSnapshot.data() : null;
      if (request?.status === "Cancelled") {
        throw new Error("The resident cancelled this ride.");
      }
    }

    // The driver's duty status (driver-duty-plan.md Step 4): Accept makes the driver "On a run",
    // Complete makes them "Available" again. Read here, because a transaction reads everything before it writes.
    const driverRef = doc(db, "users", assignment.driverId);
    const driverSnapshot = nextStatus === "Accepted" || nextStatus === "Completed" ? await transaction.get(driverRef) : null;
    const dutyStatus = driverSnapshot?.data()?.dutyStatus ?? "Off duty";
    const shiftId = driverSnapshot?.data()?.shiftId ?? "";

    if (nextStatus === "Accepted" && dutyStatus !== "Available") {
      const notReadyMessages = {
        "On break": "You are on a break. Tap Resume duty, then accept this ride.",
        "On a run": "Finish your current ride first, then accept this one.",
      };
      throw new Error(notReadyMessages[dutyStatus] || "You are off duty. Tap Punch in, then accept this ride.");
    }

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
      requestPatch.assignedDriverPhone = null;
      requestPatch.assignedVehicleId = null;
      requestPatch.assignedVehicleName = null;
      requestPatch.vehiclePlateNumber = null;
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

    // Save the duty status change and its time card line together with the ride (firestore.rules checks they match).
    // A ride accepted before this feature existed has no "On a run": then Complete changes nothing here.
    const startsRun = nextStatus === "Accepted";
    const endsRun = nextStatus === "Completed" && dutyStatus === "On a run";
    if (startsRun || endsRun) {
      transaction.update(driverRef, {
        dutyStatus: startsRun ? "On a run" : "Available",
        dutyStatusSince: serverTimestamp(),
        availability: startsRun ? "Unavailable" : "Available",
      });
      transaction.set(doc(collection(db, "dutyRecords")), {
        driverId: assignment.driverId,
        driverName: assignment.driverName || "Driver",
        type: startsRun ? "Run start" : "Run end",
        at: serverTimestamp(),
        shiftId,
        assignmentId,
        requestId: assignment.requestId || "",
        // What the ride was for. The admin DTR counts "Medical / Health" rides apart from the others.
        purpose: request?.purpose || "",
        ...(endsRun ? { outcome: "Completed" } : {}),
      });
    }
  });

  return { nextStatus };
};

// Frees the driver and the vehicle after the resident cancelled a ride that was still "Assigned".
// Safe to run more than once: it only acts if the assignment is still active AND the ride really is "Cancelled".
// Returns true if it freed something, false if there was nothing to do.
// (A Dispatcher is also allowed to run this by the Firestore rules, for a future "Free driver" button.)
export const clearCancelledRide = async ({ assignmentId }) => {
  if (!assignmentId) return false;

  return runTransaction(db, async (transaction) => {
    // A transaction must read everything first, then write.
    const assignmentRef = doc(db, "driverAssignments", assignmentId);
    const assignmentSnapshot = await transaction.get(assignmentRef);
    if (!assignmentSnapshot.exists()) return false;

    const assignment = assignmentSnapshot.data();
    if (!["Assigned", "In Progress"].includes(assignment.status) || !assignment.requestId) return false;

    const requestSnapshot = await transaction.get(doc(db, "transportRequests", assignment.requestId));
    if (!requestSnapshot.exists() || requestSnapshot.data().status !== "Cancelled") return false;

    // Only free the vehicle if it is still held for this ride (an Admin may have changed it since).
    const vehicleRef = assignment.vehicleId ? doc(db, "vehicles", assignment.vehicleId) : null;
    const vehicleSnapshot = vehicleRef ? await transaction.get(vehicleRef) : null;

    transaction.update(assignmentRef, {
      status: "Cancelled",
      missionStatus: "Cancelled",
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (vehicleSnapshot?.exists() && vehicleSnapshot.data().assignedRequestId === assignment.requestId) {
      transaction.update(vehicleRef, {
        status: "Available",
        assignedRequestId: "",
        updatedAt: serverTimestamp(),
      });
    }
    return true;
  });
};

export const acceptAssignment = async ({ assignmentId }) => transitionMission(assignmentId, "Accepted");

export const advanceMission = async ({ assignmentId, nextStatus, completion = {} }) =>
  transitionMission(assignmentId, nextStatus, completion.notes || "");

export const declineAssignment = async ({ assignmentId, reason, details }) =>
  transitionMission(assignmentId, "Declined", [reason, details].filter(Boolean).join(": "));
