const ROLES = Object.freeze({ RESIDENT: "Resident", DRIVER: "Driver", DISPATCHER: "Dispatcher", ADMIN: "Admin" });
const ACTIVE_ACCOUNT_STATUSES = new Set(["Active", "Approved"]);
const INACTIVE_ACCOUNT_STATUSES = new Set(["Pending", "Rejected", "Suspended", "Disabled", "Deactivated"]);
const PERMISSIONS = Object.freeze({
  MANAGE_USERS: "manage-users",
  REVIEW_DRIVERS: "review-driver-applications",
  MANAGE_DISPATCHER_SCOPES: "manage-dispatcher-scopes",
  MANAGE_VEHICLES: "manage-vehicles",
  VIEW_REPORTS: "view-reports",
  MANAGE_SETTINGS: "manage-settings",
  ASSIGN_REQUESTS: "assign-requests",
  UPDATE_REQUESTS: "update-requests",
});
const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.DISPATCHER]: [PERMISSIONS.ASSIGN_REQUESTS, PERMISSIONS.UPDATE_REQUESTS],
  [ROLES.DRIVER]: [],
  [ROLES.RESIDENT]: [],
});
const COLLECTIONS = Object.freeze({
  USERS: "users", DRIVER_APPLICATIONS: "Driver_Applications", TRANSPORT_REQUESTS: "transportRequests", DRIVER_ASSIGNMENTS: "driverAssignments", VEHICLES: "vehicles", DRIVER_SCHEDULES: "driverSchedules", VEHICLE_CHECKLISTS: "vehicleChecklists", VEHICLE_MAINTENANCE: "vehicleMaintenance", STAFF_INVITATIONS: "staffInvitations", DELETION_REQUESTS: "deletionRequests", AUDIT_LOGS: "authoritativeAuditLogs", OPERATIONS: "backendOperations",
});
const ACTIVE_ASSIGNMENT_STATUSES = new Set(["Assigned", "Accepted", "In Progress", "En Route", "Arrived", "Picked Up"]);
const MISSION_TRANSITIONS = Object.freeze({
  Assigned: ["Accepted", "Declined"],
  Accepted: ["En Route", "Declined"],
  "En Route": ["Arrived"],
  Arrived: ["Picked Up"],
  "Picked Up": ["Completed"],
});
module.exports = { ROLES, ACTIVE_ACCOUNT_STATUSES, INACTIVE_ACCOUNT_STATUSES, PERMISSIONS, ROLE_PERMISSIONS, COLLECTIONS, ACTIVE_ASSIGNMENT_STATUSES, MISSION_TRANSITIONS };