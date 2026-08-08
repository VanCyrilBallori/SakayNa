import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../../../firebase";
import { callTrustedFunction } from "../../../lib/backendFunctions";
import { FIRESTORE_COLLECTIONS, REQUEST_STATUSES } from "../../../constants/app";
import { getResidentReportedPriority } from "../utils/requestOptions";

const destinationFor = (form) => {
  if (form.destinationMode === "nearest-facility") return { address: "Nearest appropriate facility", latitude: null, longitude: null, source: "nearest-facility" };
  if (form.destinationMode === "no-destination") return { address: "", latitude: null, longitude: null, source: "manual" };
  return { address: form.destinationAddress, latitude: null, longitude: null, source: "manual" };
};

export const createResidentRequest = async ({ uid, residentName, form }) => {
  const requestRef = doc(collection(db, FIRESTORE_COLLECTIONS.TRANSPORT_REQUESTS));
  const reference = `SKN-${requestRef.id.slice(0, 8).toUpperCase()}`;
  const priority = getResidentReportedPriority(form.category, form.serviceType);
  const destinationLocation = destinationFor(form);

  await setDoc(requestRef, {
    residentId: uid,
    residentName: residentName || "Resident",
    reference,
    category: form.category,
    requestType: form.category,
    status: REQUEST_STATUSES.PENDING,
    residentReportedUrgency: form.category === "Emergency Request" ? "Emergency" : "Standard",
    level: priority,
    priorityLevel: priority,
    title: `${form.serviceType} Transport Request`,
    emergencyType: form.serviceType,
    serviceType: form.serviceType,
    vehicle: form.passengerCapacity,
    vehicleType: form.passengerCapacity,
    passengerCapacity: form.passengerCapacity,
    passengerName: form.passengerName,
    contactNumber: form.contactNumber,
    barangay: form.barangay,
    pickupLocation: form.pickup.address,
    pickup: form.pickup,
    pickupDetails: form.pickupDetails,
    destination: destinationLocation.address,
    destinationLocation,
    summary: `${form.serviceType} transport request from ${form.pickup.address}.`,
    description: form.description,
    vulnerableGroups: form.vulnerableGroups,
    accessibilityNotes: form.accessibilityNotes,
    additionalNotes: form.additionalNotes,
    timeline: { submitted: { actorRole: "Resident", actorId: uid, note: null } },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: requestRef.id, reference };
};

export const cancelResidentRequest = async ({ requestId, reason }) => callTrustedFunction("cancelResidentRequest", { requestId, reason });
