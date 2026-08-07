import { collection, doc, query, runTransaction, serverTimestamp, where } from "firebase/firestore";

import { db } from "../../../firebase";
import { FIRESTORE_COLLECTIONS, REQUEST_STATUSES } from "../../../constants/app";

const assignmentStatuses = ["Assigned", "In Progress"];
const requestRef = (id) => doc(db, FIRESTORE_COLLECTIONS.TRANSPORT_REQUESTS, id);
const vehicleRef = (id) => doc(db, FIRESTORE_COLLECTIONS.VEHICLES, id);
const userRef = (id) => doc(db, FIRESTORE_COLLECTIONS.USERS, id);

export const assignDispatcherRequest = async ({ requestId, driver, vehicle, dispatcher, priority, operationalNotes = "" }) => runTransaction(db, async (transaction) => {
  const currentRequest = await transaction.get(requestRef(requestId));
  if (!currentRequest.exists()) throw new Error("This request is no longer available.");
  const request = currentRequest.data();
  if (request.status !== REQUEST_STATUSES.PENDING) throw new Error("This request is no longer awaiting assignment.");

  const driverSnapshot = await transaction.get(userRef(driver.id));
  if (!driverSnapshot.exists() || driverSnapshot.data().role !== "Driver" || driverSnapshot.data().accountStatus !== "Approved") throw new Error("The selected driver is no longer approved.");
  const currentVehicle = await transaction.get(vehicleRef(vehicle.id));
  if (!currentVehicle.exists() || !["Available", "Assigned"].includes(currentVehicle.data().status || "Available")) throw new Error("The selected vehicle is no longer available.");
  if (currentVehicle.data().assignedRequestId && currentVehicle.data().assignedRequestId !== requestId) throw new Error("The selected vehicle is assigned to another mission.");

  const activeDriverAssignments = await transaction.get(query(collection(db, FIRESTORE_COLLECTIONS.DRIVER_ASSIGNMENTS), where("driverId", "==", driver.id)));
  const hasActiveDriverMission = activeDriverAssignments.docs.some((assignmentDoc) => {
    const assignment = assignmentDoc.data();
    return assignment.driverId === driver.id && assignmentStatuses.includes(assignment.status) && assignment.requestId !== requestId;
  });
  if (hasActiveDriverMission) throw new Error("The selected driver already has an active assignment.");

  const attempt = (request.assignmentAttemptCount || 0) + 1;
  const assignment = doc(collection(db, FIRESTORE_COLLECTIONS.DRIVER_ASSIGNMENTS));
  const publicDriverName = driver.publicDisplayName || driver.name || "Driver";
  const publicDriverPhone = driver.operationalPhone || driver.publicPhone || "";
  const timeline = request.timeline || {};
  transaction.set(assignment, {
    requestId,
    residentId: request.residentId || "",
    driverId: driver.id,
    driverName: driver.name || "Driver",
    dispatcherId: dispatcher.uid,
    dispatcherName: dispatcher.name || "Dispatcher",
    vehicleId: vehicle.id,
    vehicleName: vehicle.name || "Vehicle",
    vehiclePlateNumber: vehicle.plateNumber || "",
    serviceBarangay: request.barangay || "",
    request,
    status: "Assigned",
    missionStatus: "Assigned",
    assignmentAttempt: attempt,
    operationalNotes: operationalNotes.trim().slice(0, 500),
    createdAt: serverTimestamp(),
    assignedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  transaction.update(requestRef(requestId), {
    status: REQUEST_STATUSES.ASSIGNED,
    missionStatus: "Assigned",
    dispatcherConfirmedPriority: priority || request.dispatcherConfirmedPriority || "",
    priorityConfirmedBy: priority ? dispatcher.uid : request.priorityConfirmedBy || "",
    priorityConfirmedAt: priority ? serverTimestamp() : request.priorityConfirmedAt || null,
    assignedDriverId: driver.id,
    assignedDriverName: driver.name || "Driver",
    assignedDriverPublicName: publicDriverName,
    assignedDriverPhone: publicDriverPhone,
    assignedVehicleId: vehicle.id,
    assignedVehicleName: vehicle.name || "Vehicle",
    vehicleId: vehicle.id,
    vehicle: vehicle.name || "Vehicle",
    vehiclePlateNumber: vehicle.plateNumber || "",
    dispatcherId: dispatcher.uid,
    dispatcherName: dispatcher.name || "Dispatcher",
    dispatcherOfficePhone: dispatcher.officePhone || "",
    assignmentAttemptCount: attempt,
    assignedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    timeline: { ...timeline, dispatcherAssigned: { actorRole: "Dispatcher", actorId: dispatcher.uid, note: `Assignment attempt ${attempt}`, visibility: "resident" } },
  });
  transaction.update(vehicleRef(vehicle.id), { status: "Assigned", assignedDriverId: driver.id, assignedRequestId: requestId, updatedAt: serverTimestamp() });
});

export const updateDispatcherPriority = async ({ requestId, dispatcherId, priority, reason = "" }) => runTransaction(db, async (transaction) => {
  const snapshot = await transaction.get(requestRef(requestId));
  if (!snapshot.exists() || ["Completed", "Cancelled", "Rejected"].includes(snapshot.data().status)) throw new Error("Priority cannot be updated for this request.");
  const request = snapshot.data();
  transaction.update(requestRef(requestId), { dispatcherConfirmedPriority: priority, priorityConfirmedBy: dispatcherId, priorityConfirmedAt: serverTimestamp(), priorityReason: reason.trim().slice(0, 300), updatedAt: serverTimestamp(), timeline: { ...(request.timeline || {}), dispatcherPriority: { actorRole: "Dispatcher", actorId: dispatcherId, note: priority, visibility: "resident" } } });
});
