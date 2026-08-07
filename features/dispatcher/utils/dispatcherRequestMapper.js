import { MISSION_STATUSES, REQUEST_STATUSES } from "../../../constants/app";

export const DISPATCHER_PRIORITY_OPTIONS = ["Critical", "Urgent", "Standard", "Non-urgent"];
export const getQueueBucket = (request = {}) => {
  if (request.status === REQUEST_STATUSES.PENDING && request.lastDeclinedDriverId) return "Reassignment needed";
  if (request.status === REQUEST_STATUSES.PENDING) return "Awaiting assignment";
  if (request.status === REQUEST_STATUSES.ASSIGNED) return "Assigned";
  if (request.status === REQUEST_STATUSES.IN_PROGRESS) return "Active mission";
  if (request.status === REQUEST_STATUSES.COMPLETED) return "Completed";
  if (request.status === REQUEST_STATUSES.CANCELLED) return "Cancelled";
  return request.status || "New";
};
export const getMissionLabel = (request = {}) => request.missionStatus || (request.status === REQUEST_STATUSES.IN_PROGRESS ? MISSION_STATUSES.ACCEPTED : request.status || "Pending");
export const getRequestReference = (request = {}) => request.reference || `SKN-${(request.id || "").slice(0, 8).toUpperCase()}`;
export const isEligibleDispatcherDriver = (driver, activeAssignments = []) => driver?.accountStatus === "Approved" && driver?.availability !== "Unavailable" && !activeAssignments.some((assignment) => assignment.driverId === driver.id && ["Assigned", "In Progress"].includes(assignment.status));
