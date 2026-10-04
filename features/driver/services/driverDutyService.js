import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";

import { db } from "../../../firebase";
import { eraseDriverLocation } from "./driverLocationService";

// Driver duty status (driver-duty-plan.md).
// Each change saves two things in ONE save (a "batch": both are saved or neither is):
//   1. the new status on the driver's own users/{uid} profile, and
//   2. a new dutyRecords document (the time card line, never edited or deleted).
// Times always come from Firestore's clock (serverTimestamp), never the phone's.
// firestore.rules checks that the change is allowed and that both parts match.

// Off duty -> Available. The punch-in record's id becomes the shift's id.
export const punchIn = async ({ driverId, driverName }) => {
  const recordRef = doc(collection(db, "dutyRecords"));
  const batch = writeBatch(db);

  batch.update(doc(db, "users", driverId), {
    dutyStatus: "Available",
    dutyStatusSince: serverTimestamp(),
    shiftId: recordRef.id,
    shiftStartedAt: serverTimestamp(),
    // The old field, still read by the admin "Available Drivers" counter.
    availability: "Available",
  });
  batch.set(recordRef, {
    driverId,
    driverName,
    type: "Punch in",
    at: serverTimestamp(),
    shiftId: recordRef.id,
  });

  await batch.commit();
};

// Available -> On break. breakType is "Lunch", "Rest" or "Personal"; the note is optional (100 letters at most).
export const startBreak = async ({ driverId, driverName, shiftId, breakType, breakNote }) => {
  const recordRef = doc(collection(db, "dutyRecords"));
  const batch = writeBatch(db);
  const note = breakNote.trim().slice(0, 100);

  batch.update(doc(db, "users", driverId), {
    dutyStatus: "On break",
    dutyStatusSince: serverTimestamp(),
    breakType,
    breakNote: note,
    availability: "Unavailable",
  });
  batch.set(recordRef, {
    driverId,
    driverName,
    type: "Break start",
    at: serverTimestamp(),
    shiftId,
    breakType,
    breakNote: note,
  });

  await batch.commit();
};

// On break -> Available ("Resume duty"). The break type and note are cleared from the profile.
export const endBreak = async ({ driverId, driverName, shiftId }) => {
  const recordRef = doc(collection(db, "dutyRecords"));
  const batch = writeBatch(db);

  batch.update(doc(db, "users", driverId), {
    dutyStatus: "Available",
    dutyStatusSince: serverTimestamp(),
    breakType: "",
    breakNote: "",
    availability: "Available",
  });
  batch.set(recordRef, {
    driverId,
    driverName,
    type: "Break end",
    at: serverTimestamp(),
    shiftId,
  });

  await batch.commit();
};

// Available -> Off duty. The profile keeps its shiftId, so the "Punch out" record matches it.
export const punchOut = async ({ driverId, driverName, shiftId }) => {
  const recordRef = doc(collection(db, "dutyRecords"));
  const batch = writeBatch(db);

  batch.update(doc(db, "users", driverId), {
    dutyStatus: "Off duty",
    dutyStatusSince: serverTimestamp(),
    availability: "Unavailable",
  });
  batch.set(recordRef, {
    driverId,
    driverName,
    type: "Punch out",
    at: serverTimestamp(),
    shiftId,
  });

  await batch.commit();
  // Off duty now: erase the last known location (driver-location-plan.md). Not waited for.
  eraseDriverLocation({ driverId });
};
