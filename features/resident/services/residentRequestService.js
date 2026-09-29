import { collection, doc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../../../firebase";
import { FIRESTORE_COLLECTIONS, REQUEST_STATUSES } from "../../../constants/app";
import { buildScheduledDate, getResidentReportedPriority } from "../utils/requestOptions";
import { formatClockTime, formatShortDay } from "../../../lib/dates";
import { normalizePhilippinePhone } from "../utils/requestValidation";

// Saves a new transport request. The form must already be checked by validateResidentRequest.
// residentPhone = the phone in the resident's profile.
export const createResidentRequest = async ({ uid, residentName, residentPhone, form }) => {
  const requestRef = doc(collection(db, FIRESTORE_COLLECTIONS.TRANSPORT_REQUESTS));
  const reference = `SKN-${requestRef.id.slice(0, 8).toUpperCase()}`;
  const priority = getResidentReportedPriority(form.purpose, form.timing);
  // A scheduled ride saves its date and time. Firestore stores it as a Timestamp.
  const scheduledFor = form.timing === "scheduled" ? buildScheduledDate(form.scheduleDay, form.scheduleMinutes) : null;
  const whenText = scheduledFor ? ` on ${formatShortDay(scheduledFor)}, ${formatClockTime(scheduledFor)}` : "";
  const myPhone = normalizePhilippinePhone(residentPhone || "");
  const riderIsMe = form.ridingFor === "self";
  // "Other: Groceries" instead of just "Other", so dispatchers and drivers know what the ride is for.
  const purposeLabel = form.purpose === "Other" ? `Other: ${form.purposeOther}` : form.purpose;
  // Without a GPS location or map pin, the barangay name is the pickup (same as the old form).
  const pickupAddress = form.pickup.address || form.barangay;
  const peopleLabel = `${form.passengerCount} ${form.passengerCount === 1 ? "person" : "people"}`;

  await setDoc(requestRef, {
    residentId: uid,
    residentName: residentName || "Resident",
    residentPhone: myPhone,
    reference,
    // Every form request is a non-emergency ride now. Emergencies go through the red Emergency alert.
    requestType: "Community Transport Request",
    status: REQUEST_STATUSES.PENDING,
    level: priority,
    priorityLevel: priority,
    purpose: form.purpose,
    purposeOther: form.purpose === "Other" ? form.purposeOther : "",
    timing: form.timing, // "asap" or "scheduled"
    scheduledFor,
    title: purposeLabel,
    ridingFor: form.ridingFor,
    passengerName: riderIsMe ? residentName || "Resident" : form.passengerName,
    // Someone else with no phone: the driver gets the resident's number instead.
    contactNumber: riderIsMe ? myPhone : normalizePhilippinePhone(form.passengerPhone) || myPhone,
    passengerCount: form.passengerCount,
    barangay: form.barangay,
    pickupLocation: pickupAddress,
    pickup: { ...form.pickup, address: pickupAddress, barangay: form.barangay },
    pickupDetails: form.pickupDetails,
    destination: form.destination,
    summary: `${purposeLabel} ride for ${peopleLabel}${whenText} from ${pickupAddress} to ${form.destination}.`,
    assistance: form.assistance,
    assistanceOther: form.assistance.includes("Other") ? form.assistanceOther : "",
    additionalNotes: form.additionalNotes,
    timeline: { submitted: { actorRole: "Resident", actorId: uid, note: null } },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: requestRef.id, reference };
};

// Marks the resident's own request as Cancelled (previously a Cloud Function call).
export const cancelResidentRequest = async ({ requestId, reason }) => {
  const trimmedReason = (reason || "").trim();
  if (!requestId || trimmedReason.length < 3) {
    throw new Error("A request and a cancellation reason are required.");
  }

  await runTransaction(db, async (transaction) => {
    const requestRef = doc(db, FIRESTORE_COLLECTIONS.TRANSPORT_REQUESTS, requestId);
    const snapshot = await transaction.get(requestRef);

    if (!snapshot.exists()) {
      throw new Error("This request no longer exists.");
    }

    const request = snapshot.data();
    if (!["Pending", "Assigned"].includes(request.status)) {
      throw new Error("not-cancellable");
    }

    transaction.update(requestRef, {
      status: REQUEST_STATUSES.CANCELLED,
      previousStatus: request.status,
      cancellationReason: trimmedReason,
      cancelledBy: request.residentId || "",
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return { cancelled: true };
};
