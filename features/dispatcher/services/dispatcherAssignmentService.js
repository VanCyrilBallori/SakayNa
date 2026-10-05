import { collection, doc, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "../../../firebase";
import { normalizePhilippinePhone } from "../../resident/utils/requestValidation";

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

    // Read the driver again now: they may have started a break or punched out a moment ago
    // (driver-duty-plan.md Step 5). Only an Available driver can be given a ride.
    const driverSnapshot = await transaction.get(doc(db, "users", driver.id));
    const dutyStatus = driverSnapshot.data()?.dutyStatus ?? "Off duty";
    if (dutyStatus !== "Available") {
      throw new Error(`${driverName} is no longer available (${dutyStatus}). Choose another driver.`);
    }
    const vehicleName = vehicle.name || "Vehicle";
    const resolvedPriority = priority || request.priorityLevel || request.level || "";

    transaction.set(assignmentRef, {
      requestId,
      residentId: request.residentId || "",
      residentName: request.residentName || "Resident",
      // What the ride is for (e.g. "Medical / Health"), shown in the dispatcher's Drivers column and the driver's History.
      title: request.title || "Transport Request",
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
      // The resident can't open the driver's profile (firestore.rules), so the phone is copied here for "Call driver".
      assignedDriverPhone: driver.phoneNumber || "",
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

// Removes extra spaces from one line of typed text.
const oneLine = (value = "") => value.trim().replace(/\s+/g, " ");

// Emergency request form (emergency-request-form-plan.md): makes a ride for the resident from an alert this
// dispatcher answered, already given to a driver. One transaction: everything below is saved together, or nothing is.
// requestId = the id the form made when it opened. alert = the callSessions document. form = the checked form.
// driver / vehicle = the picked ones. dispatcher = { uid, name }.
export const createEmergencyRide = async ({ requestId, alert, form, driver, vehicle, dispatcher }) => {
  if (!requestId || !alert?.id || !driver?.id || !vehicle?.id || !dispatcher?.uid) {
    throw new Error("Choose a driver and a vehicle before submitting.");
  }

  const requestRef = doc(db, "transportRequests", requestId);
  const alertRef = doc(db, "callSessions", alert.id);
  const assignmentRef = doc(collection(db, "driverAssignments"));
  const reference = `SKN-${requestId.slice(0, 8).toUpperCase()}`;
  const driverName = driver.name || driver.fullName || "Driver";
  const vehicleName = vehicle.name || "Vehicle";
  // Medical emergency, Accident / injury and Pregnancy / labor count as "Medical / Health" rides
  // (admin counts and filters, the resident's History filter, the driver's DTR).
  const purpose = form.emergencyType === "Other" ? "Other" : "Medical / Health";
  const title = `Emergency: ${form.emergencyType}`;
  const pickupAddress = oneLine(form.pickupLocation);
  const destination = oneLine(form.destination);
  // The GPS spot is saved only if the dispatcher kept the GPS address. If they typed another place, the pin would be wrong.
  const location = alert.location;
  const pickupIsGps =
    typeof location?.latitude === "number" && typeof location?.longitude === "number" && pickupAddress === oneLine(alert.pickupLocation || "");
  const pickup = pickupIsGps
    ? { latitude: location.latitude, longitude: location.longitude, address: pickupAddress, barangay: form.barangay, source: "gps" }
    : { address: pickupAddress, barangay: form.barangay };
  const peopleLabel = `${form.patientCount} ${form.patientCount === 1 ? "patient" : "patients"}`;

  await runTransaction(db, async (transaction) => {
    // A transaction reads everything first, then writes.
    const alertSnapshot = await transaction.get(alertRef);
    const driverSnapshot = await transaction.get(doc(db, "users", driver.id));

    if (!alertSnapshot.exists()) {
      throw new Error("This emergency alert no longer exists.");
    }
    // Stops a double Submit (or two open forms) from making two rides for one alert.
    const linkedReference = alertSnapshot.data().linkedRequestReference;
    if (alertSnapshot.data().linkedRequestId) {
      throw new Error(`A ride was already made for this alert${linkedReference ? ` (${linkedReference})` : ""}.`);
    }
    // The driver may have started a break or punched out a moment ago (same check as the Assign window).
    const dutyStatus = driverSnapshot.data()?.dutyStatus ?? "Off duty";
    if (dutyStatus !== "Available") {
      throw new Error(`${driverName} is no longer available (${dutyStatus}). Choose another driver.`);
    }

    // The ride, with the same fields as a resident's request (residentRequestService.js), so every screen shows it.
    transaction.set(requestRef, {
      residentId: alert.residentId || "",
      residentName: alert.residentName || "Resident",
      residentPhone: alert.residentPhone || "",
      reference,
      requestType: "Emergency Request",
      status: "Assigned",
      missionStatus: "Assigned",
      level: form.priority,
      priorityLevel: form.priority,
      purpose,
      purposeOther: purpose === "Other" ? "Emergency" : "",
      // The driver's ride card shows this first (DriverRideCard).
      emergencyType: form.emergencyType,
      timing: "asap",
      scheduledFor: null,
      title,
      ridingFor: "self",
      passengerName: oneLine(form.callerName),
      contactNumber: normalizePhilippinePhone(form.contactNumber),
      passengerCount: form.patientCount,
      barangay: form.barangay,
      pickupLocation: pickupAddress,
      pickup,
      pickupDetails: oneLine(form.landmark),
      destination,
      summary: `${title} ride for ${peopleLabel} from ${pickupAddress} to ${destination}.`,
      assistance: [],
      assistanceOther: "",
      // The short description. The driver and the resident see it as "Notes".
      additionalNotes: form.description.trim(),
      timeline: { submitted: { actorRole: "Dispatcher", actorId: dispatcher.uid, note: "From an emergency alert" } },
      // The rules check these two: the alert must be one this dispatcher answered, for this resident (firestore.rules).
      emergencyAlertId: alert.id,
      createdBy: dispatcher.uid,
      alertReceivedAt: alert.createdAt ?? null,
      // Shown in the resident's Request Details ("Dispatcher" and "Dispatcher contact").
      dispatcherName: dispatcher.name || "",
      dispatcherOfficePhone: alert.dispatcherPhone || "",
      // Already given to the driver: the same fields as assignDispatcherRequest above.
      assignedDriverId: driver.id,
      assignedDriverName: driverName,
      assignedDriverPhone: driver.phoneNumber || "",
      assignedVehicleId: vehicle.id,
      assignedVehicleName: vehicleName,
      vehiclePlateNumber: vehicle.plateNumber || "",
      assignedAt: serverTimestamp(),
      assignedBy: dispatcher.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.set(assignmentRef, {
      requestId,
      residentId: alert.residentId || "",
      residentName: alert.residentName || "Resident",
      title,
      driverId: driver.id,
      driverName,
      dispatcherId: dispatcher.uid,
      dispatcherName: dispatcher.name || "",
      vehicleId: vehicle.id,
      vehicleName,
      vehiclePlateNumber: vehicle.plateNumber || "",
      pickupLocation: pickupAddress,
      destination,
      status: "Assigned",
      missionStatus: "Assigned",
      priorityLevel: form.priority,
      assignedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.update(doc(db, "vehicles", vehicle.id), {
      status: "Assigned",
      assignedDriverId: driver.id,
      assignedRequestId: requestId,
      updatedAt: serverTimestamp(),
    });

    // Link the alert to its ride. Its status stays "connected", so the resident's pop-up doesn't change mid-call.
    // emergencyType also fills "Type:" in the Admin's Emergency Calls list.
    transaction.update(alertRef, {
      linkedRequestId: requestId,
      linkedRequestReference: reference,
      linkedDriverName: driverName,
      linkedVehicleName: vehicleName,
      emergencyType: form.emergencyType,
      updatedAt: serverTimestamp(),
    });
  });

  return { reference };
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
