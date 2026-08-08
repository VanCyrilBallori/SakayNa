import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

import { app, auth } from "../firebase";

const functions = getFunctions(app, "asia-southeast1");
let emulatorConnected = false;

const connectToEmulator = () => {
  if (emulatorConnected || process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS !== "true") return;
  connectFunctionsEmulator(functions, process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST || "127.0.0.1", Number(process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT || 5001));
  emulatorConnected = true;
};

const callableErrorMessage = (error) => {
  const reason = error?.details?.reason;
  const messages = {
    unauthenticated: "Please sign in again before continuing.",
    "permission-denied": "Your account is not permitted to perform this action.",
    "account-inactive": "This account is not active.",
    conflict: "The record changed or conflicts with active operations. Refresh and try again.",
    "request-not-assignable": "This request is no longer available for assignment.",
    "driver-unavailable": "The selected Driver is no longer available.",
    "vehicle-unavailable": "The selected vehicle is no longer available.",
    "schedule-conflict": "This action conflicts with an existing schedule.",
    "invalid-status-transition": "This status change is no longer allowed.",
    "already-processed": "This operation was already processed.",
    "service-area-denied": "This record is outside your authorized service area.",
  };
  return messages[reason] || messages[error?.code] || error?.message || "The secure operation could not be completed. Please try again.";
};

export const callTrustedFunction = async (name, data = {}) => {
  connectToEmulator();
  if (!auth.currentUser) throw new Error("Please sign in again before continuing.");
  try {
    const result = await httpsCallable(functions, name)(data);
    if (result.data?.refreshToken) await auth.currentUser.getIdToken(true);
    return result.data;
  } catch (error) {
    throw new Error(callableErrorMessage(error));
  }
};