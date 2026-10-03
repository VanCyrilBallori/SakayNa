import { REQUEST_STATUSES, RESIDENT_CANCELLABLE_STATUSES } from "../../../constants/app";
import { formatClockTime, formatShortDay, getDateFromValue } from "../../../lib/dates";
import { VULNERABLE_GROUP_OPTIONS } from "./requestOptions";

// ---- Labels shared by the resident, dispatcher, driver and admin screens ----
// Each one reads the new form's fields first, then the old form's fields, so old requests still show.

// The date and time of a scheduled ride, or null for "as soon as possible" (old requests are always ASAP).
export const getScheduledDate = (request) => (request?.timing === "scheduled" ? getDateFromValue(request.scheduledFor) : null);

// "Fri, Oct 2, 9:00 AM" for a scheduled ride, or "As soon as possible".
export const getWhenText = (request) => {
  const scheduled = getScheduledDate(request);
  return scheduled ? `${formatShortDay(scheduled)}, ${formatClockTime(scheduled)}` : "As soon as possible";
};

// The person riding: the name typed in the request form, or the account owner's name for older requests.
export const getPassengerName = (request, assignment) =>
  request?.passengerName || request?.patientName || request?.residentName || assignment?.residentName || "Not provided";

// New requests save a number (passengerCount); older requests saved text like "2 passengers".
export const getPassengerCountText = (request) => {
  const count = request?.passengerCount;
  if (typeof count === "number") return `${count} ${count === 1 ? "person" : "people"}`;
  return request?.passengerCapacity || "Not provided";
};

// The help the passenger needs, as one line like "Senior citizen, PWD". "None" if nothing was chosen.
// New requests save a list (assistance); older requests saved on/off switches (vulnerableGroups) plus notes.
export const getAssistanceText = (request) => {
  if (Array.isArray(request?.assistance)) {
    const labels = request.assistance.map((item) => (item === "Other" && request.assistanceOther ? `Other: ${request.assistanceOther}` : item));
    return labels.join(", ") || "None";
  }
  const groups = request?.vulnerableGroups || {};
  const labels = VULNERABLE_GROUP_OPTIONS.filter((option) => groups[option.key]).map((option) => option.label);
  return [labels.join(", "), request?.accessibilityNotes].filter(Boolean).join(" | ") || "None";
};

const statusMeta = {
  [REQUEST_STATUSES.PENDING]: { label: "Pending review", tone: "warning", icon: "clock-o" },
  [REQUEST_STATUSES.ASSIGNED]: { label: "Driver assigned", tone: "success", icon: "user" },
  [REQUEST_STATUSES.IN_PROGRESS]: { label: "In progress", tone: "success", icon: "car" },
  [REQUEST_STATUSES.COMPLETED]: { label: "Completed", tone: "success", icon: "check" },
  [REQUEST_STATUSES.CANCELLED]: { label: "Cancelled", tone: "danger", icon: "ban" },
  Rejected: { label: "Rejected", tone: "danger", icon: "times" },
};

export const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatRequestDate = (value) => {
  const date = toDate(value);
  return date ? date.toLocaleString() : "Not available";
};

export const getPickupLabel = (request = {}) =>
  request.pickup?.address || request.pickupLocation || request.barangay || "Pickup location not provided";

export const getDestinationLabel = (request = {}) =>
  request.destinationLocation?.address || request.destination || "Destination not provided";

export const getRequestStatusMeta = (status) => statusMeta[status] || { label: status || "Pending review", tone: "neutral", icon: "info-circle" };

// The 7 steps of a ride, in order. The home "Your ride" card shows "Step 4 of 7 · En route".
export const RIDE_STEPS = ["Pending", "Driver assigned", "Accepted", "En route", "Arrived", "Picked up", "Completed"];

// Which step (1 to 7) a ride is on, and the words for the card's status band.
// step 0 = Cancelled or Rejected: the card shows no progress bar.
// Old requests may have "In Progress" with no missionStatus: they count as Accepted.
export const getRideProgress = (request = {}) => {
  const status = request.status || REQUEST_STATUSES.PENDING;
  const missionStatus = request.missionStatus || "";

  if (status === REQUEST_STATUSES.CANCELLED) return { step: 0, title: "Cancelled" };
  if (status === "Rejected") return { step: 0, title: "Rejected" };
  if (status === REQUEST_STATUSES.COMPLETED || missionStatus === "Completed") return { step: 7, title: "Ride completed" };
  if (missionStatus === "Picked Up") return { step: 6, title: "Picked up" };
  if (missionStatus === "Arrived") return { step: 5, title: "Your driver is here!" };
  if (missionStatus === "En Route") return { step: 4, title: "Driver on the way" };
  if (missionStatus === "Accepted" || status === REQUEST_STATUSES.IN_PROGRESS) return { step: 3, title: "Driver accepted" };
  if (status === REQUEST_STATUSES.ASSIGNED) return { step: 2, title: "Driver assigned" };
  // Pending. If a driver declined it before, the dispatcher is now finding someone else.
  return { step: 1, title: request.lastDeclinedDriverId ? "Finding another driver" : "Waiting for a driver" };
};

// The ride for the home "Your ride" card. requests = newest first (from useResidentRequests).
// A ride a driver is on right now (Assigned or In Progress) comes first, so a newer ride scheduled
// for tomorrow never hides a driver who is on the way. If there is none, the newest ride.
export const getHomeRide = (requests = []) =>
  requests.find((request) => [REQUEST_STATUSES.ASSIGNED, REQUEST_STATUSES.IN_PROGRESS].includes(request.status)) ?? requests[0] ?? null;

export const canResidentCancel = (request = {}) => RESIDENT_CANCELLABLE_STATUSES.includes(request.status || REQUEST_STATUSES.PENDING);

export const normalizeResidentRequest = (id, data = {}) => ({
  id,
  ...data,
  status: data.status || REQUEST_STATUSES.PENDING,
  reference: data.reference || `SKN-${id.slice(0, 8).toUpperCase()}`,
  pickupLabel: getPickupLabel(data),
  destinationLabel: getDestinationLabel(data),
  submittedAt: data.createdAt || null,
  latestUpdatedAt: data.updatedAt || data.completedAt || data.cancelledAt || data.createdAt || null,
});

export const getRequestTimeline = (request = {}) => {
  const status = request.status || REQUEST_STATUSES.PENDING;
  const missionStatus = request.missionStatus || "";
  const events = [
    { key: "submitted", label: "Request submitted", timestamp: request.createdAt, complete: Boolean(request.createdAt) },
    { key: "review", label: "Dispatcher review", timestamp: null, complete: status !== REQUEST_STATUSES.PENDING },
    { key: "assigned", label: "Driver assigned", timestamp: request.assignedAt, complete: Boolean(request.assignedDriverId || request.assignedAt) },
    { key: "accepted", label: "Driver accepted", timestamp: request.acceptedAt, complete: Boolean(request.acceptedAt) },
    { key: "en-route", label: "Driver en route", timestamp: request.enRouteAt, complete: Boolean(request.enRouteAt) || ["Arrived", "Picked Up", "Completed"].includes(missionStatus) },
    { key: "arrived", label: "Driver arrived", timestamp: request.arrivedAt, complete: Boolean(request.arrivedAt) || ["Picked Up", "Completed"].includes(missionStatus) },
    { key: "picked-up", label: "Passenger picked up", timestamp: request.pickedUpAt, complete: Boolean(request.pickedUpAt) || missionStatus === "Completed" },
    { key: "completed", label: "Request completed", timestamp: request.completedAt, complete: status === REQUEST_STATUSES.COMPLETED },
  ];
  if (status === REQUEST_STATUSES.CANCELLED) return [...events.filter((event) => event.key !== "completed"), { key: "cancelled", label: "Request cancelled", timestamp: request.cancelledAt, complete: true, terminal: true }];
  if (status === "Rejected") return [...events.filter((event) => event.key !== "completed"), { key: "rejected", label: "Request rejected", timestamp: request.rejectedAt, complete: true, terminal: true }];
  return events;
};
export const getPickupCoordinates = (request = {}) => {
  const pickup = request.pickup || {};
  if (typeof pickup.latitude === "number" && typeof pickup.longitude === "number") return [pickup.latitude, pickup.longitude];
  if (typeof request.pickupLatitude === "number" && typeof request.pickupLongitude === "number") return [request.pickupLatitude, request.pickupLongitude];
  return null;
};

export const getDestinationCoordinates = (request = {}) => {
  const destination = request.destinationLocation || {};
  if (typeof destination.latitude === "number" && typeof destination.longitude === "number") return [destination.latitude, destination.longitude];
  if (typeof request.destinationLatitude === "number" && typeof request.destinationLongitude === "number") return [request.destinationLatitude, request.destinationLongitude];
  return null;
};
