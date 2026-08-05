import { MISSION_STATUSES, REQUEST_STATUSES } from "../../../constants/app";

export const MISSION_TRANSITIONS = Object.freeze({
  [MISSION_STATUSES.ASSIGNED]: [MISSION_STATUSES.ACCEPTED],
  [MISSION_STATUSES.ACCEPTED]: [MISSION_STATUSES.EN_ROUTE],
  [MISSION_STATUSES.EN_ROUTE]: [MISSION_STATUSES.ARRIVED],
  [MISSION_STATUSES.ARRIVED]: [MISSION_STATUSES.PICKED_UP],
  [MISSION_STATUSES.PICKED_UP]: [MISSION_STATUSES.COMPLETED],
});

export const getMissionStatus = (assignment = {}) => assignment.missionStatus || (assignment.status === REQUEST_STATUSES.IN_PROGRESS ? MISSION_STATUSES.ACCEPTED : assignment.status || MISSION_STATUSES.ASSIGNED);
export const canAdvanceMission = (assignment, nextStatus) => (MISSION_TRANSITIONS[getMissionStatus(assignment)] || []).includes(nextStatus);
export const getRequestFromAssignment = (assignment = {}) => assignment.currentRequest || assignment.request || {};
export const getCoordinatePair = (value = {}) => typeof value.latitude === "number" && typeof value.longitude === "number" ? [value.latitude, value.longitude] : null;
export const getPickupCoordinates = (request = {}) => getCoordinatePair(request.pickup) || (typeof request.pickupLatitude === "number" && typeof request.pickupLongitude === "number" ? [request.pickupLatitude, request.pickupLongitude] : null);
export const getDestinationCoordinates = (request = {}) => getCoordinatePair(request.destinationLocation) || (typeof request.destinationLatitude === "number" && typeof request.destinationLongitude === "number" ? [request.destinationLatitude, request.destinationLongitude] : null);
export const getPickupLabel = (request = {}) => request.pickup?.address || request.pickupLocation || request.barangay || "Pickup location pending";
export const getDestinationLabel = (request = {}) => request.destinationLocation?.address || request.destination || "Destination not provided";
export const getAssignmentReference = (assignment = {}) => getRequestFromAssignment(assignment).reference || `SKN-${(assignment.requestId || assignment.id || "").slice(0, 8).toUpperCase()}`;
