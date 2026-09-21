// The Admin Operations panel now runs entirely against Firestore (no Cloud Functions).
// Every operation and helper it uses lives in ./adminOperationsService.
export * from "./adminOperationsService";
