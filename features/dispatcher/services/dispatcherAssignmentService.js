import { collection, doc, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "../../../firebase";

// Assigns a pending request to a driver + vehicle.
// One transaction: create the assignment, mark the request "Assigned", flag the vehicle busy.
export const assignDispatcherRequest = async ({ requestId, driver, vehicle, dispatcher = {}, priority = "" }) => {
  if (!requestId || !driver?.id || !vehicle?.id) {
    throw new Error("Choose a valid request, driver, and vehicle before assigning.");
  }

  const assignmentRef = doc(collection(db, "driverAssignments"));

  await runTransaction(db, async (transaction) => {
    const requestRef = doc(db, "transportRequests", requestId);
    const requestSnapshot = await transaction.get(requestRef);

    if (!requestSnapshot.exists()) {
      throw new Error("This request no longer exists.");
    }

    const request = requestSnapshot.data();

    if (request.status !== "Pending") {
      throw new Error("This request is no longer available for assignment.");
    }

    const driverName = driver.name || driver.fullName || "Driver";
    const vehicleName = vehicle.name || "Vehicle";
    const resolvedPriority = priority || request.priorityLevel || request.level || "";

    transaction.set(assignmentRef, {
      requestId,
      residentId: request.residentId || "",
      residentName: request.residentName || "Resident",
      driverId: driver.id,
      driverName,
      dispatcherId: dispatcher.uid || "",
      dispatcherName: dispatcher.name || "",
      vehicleId: vehicle.id,
      vehicleName,
      vehiclePlateNumber: vehicle.plateNumber || "",
      pickupLocation: request.pickupLocation || request.barangay || "",
      destination: request.destination || "",
      status: "Assigned",
      missionStatus: "Assigned",
      priorityLevel: resolvedPriority,
      assignedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.update(requestRef, {
      status: "Assigned",
      missionStatus: "Assigned",
      assignedDriverId: driver.id,
      assignedDriverName: driverName,
      assignedVehicleId: vehicle.id,
      assignedVehicleName: vehicleName,
      vehiclePlateNumber: vehicle.plateNumber || "",
      assignedAt: serverTimestamp(),
      assignedBy: dispatcher.uid || "",
      priorityLevel: resolvedPriority,
      updatedAt: serverTimestamp(),
    });

    transaction.update(doc(db, "vehicles", vehicle.id), {
      status: "Assigned",
      assignedDriverId: driver.id,
      assignedRequestId: requestId,
      updatedAt: serverTimestamp(),
    });
  });

  return { assignmentId: assignmentRef.id };
};

// Optional priority change (not currently wired to a button).
export const updateDispatcherPriority = async ({ requestId, priority, reason = "" }) => {
  if (!requestId || !priority) {
    throw new Error("A request and priority are required.");
  }

  await updateDoc(doc(db, "transportRequests", requestId), {
    priorityLevel: priority,
    priorityUpdateReason: reason,
    updatedAt: serverTimestamp(),
  });
};
