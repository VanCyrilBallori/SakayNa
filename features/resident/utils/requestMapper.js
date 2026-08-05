import { REQUEST_STATUSES, RESIDENT_CANCELLABLE_STATUSES } from "../../../constants/app";

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
  const events = [
    { key: "submitted", label: "Request submitted", timestamp: request.createdAt, complete: Boolean(request.createdAt) },
    { key: "review", label: "Dispatcher review", timestamp: null, complete: status !== REQUEST_STATUSES.PENDING },
    { key: "assigned", label: "Driver assigned", timestamp: request.assignedAt, complete: Boolean(request.assignedDriverId || request.assignedAt) },
    { key: "accepted", label: "Driver accepted", timestamp: request.acceptedAt, complete: Boolean(request.acceptedAt) },
    { key: "in-progress", label: "Driver en route / trip in progress", timestamp: request.inProgressAt, complete: status === REQUEST_STATUSES.IN_PROGRESS || status === REQUEST_STATUSES.COMPLETED },
    { key: "completed", label: "Request completed", timestamp: request.completedAt, complete: status === REQUEST_STATUSES.COMPLETED },
  ];

  if (status === REQUEST_STATUSES.CANCELLED) {
    return [...events.filter((event) => event.key !== "completed"), { key: "cancelled", label: "Request cancelled", timestamp: request.cancelledAt, complete: true, terminal: true }];
  }

  if (status === "Rejected") {
    return [...events.filter((event) => event.key !== "completed"), { key: "rejected", label: "Request rejected", timestamp: request.rejectedAt, complete: true, terminal: true }];
  }

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
