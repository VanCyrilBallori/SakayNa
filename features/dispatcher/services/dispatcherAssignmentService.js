import { callTrustedFunction } from "../../../lib/backendFunctions";

export const assignDispatcherRequest = async ({ requestId, driver, vehicle, priority, operationalNotes = "" }) =>
  callTrustedFunction("assignRequest", { requestId, driverId: driver.id, vehicleId: vehicle.id, priority, operationalNotes });

export const updateDispatcherPriority = async ({ requestId, priority, reason = "" }) =>
  callTrustedFunction("updateRequestPriority", { requestId, priority, reason });