const { onCall } = require("firebase-functions/v2/https");
require("./config/firebase");
const { logger } = require("firebase-functions");
const { normalizeError } = require("./utils/errors");
const users = require("./users/userOperations");
const assignments = require("./assignments/assignmentOperations");
const missions = require("./missions/missionOperations");
const requests = require("./requests/requestOperations");
const vehicles = require("./vehicles/vehicleOperations");

const region = "asia-southeast1";
const callable = (operation) => onCall({ region }, async (request) => {
  try { return await operation(request, request.data || {}); } catch (error) { logger.error("Callable operation failed", { code: error?.code, message: error?.message }); return normalizeError(error); }
});

exports.createStaffAccount = callable(users.createStaffAccount);
exports.reviewDriverApplication = callable(users.reviewDriverApplication);
exports.changeAccountStatus = callable(users.changeAccountStatus);
exports.updateUserRole = callable(users.updateUserRole);
exports.updateDispatcherServiceAreas = callable(users.updateDispatcherServiceAreas);
exports.processUserDeletion = callable(users.processUserDeletion);
exports.assignRequest = callable(assignments.assignRequest);
exports.transitionMissionStatus = callable(missions.transitionMissionStatus);
exports.cancelResidentRequest = callable(requests.cancelResidentRequest);
exports.updateRequestPriority = callable(requests.updateRequestPriority);
exports.rejectRequest = callable(requests.rejectRequest);
exports.saveMaintenanceRecord = callable(vehicles.saveMaintenanceRecord);