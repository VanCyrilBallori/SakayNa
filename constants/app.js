export const ROLES = Object.freeze({
  RESIDENT: "Resident",
  DRIVER: "Driver",
  DISPATCHER: "Dispatcher",
  ADMIN: "Admin",
});

export const ROLE_OPTIONS = Object.freeze(Object.values(ROLES));

export const ACCOUNT_STATUSES = Object.freeze({
  ACTIVE: "Active",
  APPROVED: "Approved",
  PENDING: "Pending",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
  DISABLED: "Disabled",
  DEACTIVATED: "Deactivated",
});

export const REQUEST_STATUSES = Object.freeze({
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
});

export const MISSION_STATUSES = Object.freeze({
  ASSIGNED: "Assigned",
  ACCEPTED: "Accepted",
  EN_ROUTE: "En Route",
  ARRIVED: "Arrived",
  PICKED_UP: "Picked Up",
  COMPLETED: "Completed",
  DECLINED: "Declined",
});

export const REQUEST_PRIORITIES = Object.freeze({
  EMERGENCY: "Emergency",
  URGENT: "Urgent",
  NON_URGENT: "Non-Urgent",
  PLANNED: "Planned",
});

export const RESIDENT_REQUEST_CATEGORIES = Object.freeze({
  COMMUNITY: "Community Transport Request",
  EMERGENCY: "Emergency Request",
});

export const RESIDENT_CANCELLABLE_STATUSES = Object.freeze([
  REQUEST_STATUSES.PENDING,
  REQUEST_STATUSES.ASSIGNED,
]);

export const FIRESTORE_COLLECTIONS = Object.freeze({
  USERS: "users",
  TRANSPORT_REQUESTS: "transportRequests",
  DRIVER_ASSIGNMENTS: "driverAssignments",
  CALL_SESSIONS: "callSessions",
  DRIVER_APPLICATIONS: "Driver_Applications",
  VEHICLES: "vehicles",
  DRIVER_SCHEDULES: "driverSchedules",
  VEHICLE_MAINTENANCE: "vehicleMaintenance",
  ACTIVITY_LOGS: "activityLogs",
  STAFF_INVITATIONS: "staffInvitations",
  DELETION_REQUESTS: "deletionRequests",
  SYSTEM_SETTINGS: "systemSettings",
});

export const VEHICLE_MAINTENANCE_STATUSES = Object.freeze({
  REPORTED: "Reported",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
});

export const ADMIN_PERMISSION_OPTIONS = Object.freeze([
  "manage-users",
  "review-driver-applications",
  "manage-dispatcher-scopes",
  "manage-vehicles",
  "view-reports",
  "manage-settings",
]);
