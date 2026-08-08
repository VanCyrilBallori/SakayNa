import { callTrustedFunction } from "../../../lib/backendFunctions";

export { buildCsv, getDate, getProfileName, getUserMissionConflicts, createStaffInvitation, requestPermanentDeletion, saveSystemSettings } from "./adminOperationsService";

export const reviewDriverApplication = async ({ applicationId, decision, reason = "", notes = "" }) => callTrustedFunction("reviewDriverApplication", { applicationId, decision, reason, notes });
export const changeAccountStatus = async ({ targetUser, nextStatus, reason }) => callTrustedFunction("changeAccountStatus", { targetUserId: targetUser.id, nextStatus, reason });
export const changeUserRole = async ({ targetUser, nextRole, reason }) => callTrustedFunction("updateUserRole", { targetUserId: targetUser.id, role: nextRole, reason });
export const updateDispatcherScope = async ({ targetUser, serviceAreas, reason = "Administrative scope update" }) => callTrustedFunction("updateDispatcherServiceAreas", { targetUserId: targetUser.id, serviceAreas, reason });
export const saveMaintenanceRecord = async ({ vehicle, form }) => callTrustedFunction("saveMaintenanceRecord", { vehicleId: vehicle.id, ...form });
export const activateStaffInvitation = async ({ invitationId }) => callTrustedFunction("createStaffAccount", { invitationId });
export const processUserDeletion = async ({ deletionRequestId }) => callTrustedFunction("processUserDeletion", { deletionRequestId });