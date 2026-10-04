// DECLINE_REASONS and validateDecline: Decline is not on the screen since driver-pages-plan.md Step 2a. Kept so it can come back.
export const DECLINE_REASONS = ["Unavailable", "Vehicle problem", "Too far", "Schedule conflict", "Medical or personal reason", "Other"];
// The reasons for "I can't do this ride" (driver-pages-plan.md Step 2a). "Other" needs a few words.
export const UNABLE_REASONS = ["Vehicle problem", "Feeling unwell", "Family emergency", "Other"];
export const COMPLETION_OUTCOMES = ["Passenger transported successfully", "Passenger transferred to facility", "Request resolved on site", "Passenger unavailable", "Unable to complete", "Other"];
// The vehicle checklist (REQUIRED_CHECKLIST_ITEMS, isChecklistReady) is not used since driver-home-restyle-plan.md Piece 1. Kept so it can come back.
export const REQUIRED_CHECKLIST_ITEMS = ["fuel", "tires", "brakes", "lights", "firstAidKit", "communicationDevice", "documents", "cleanliness", "emergencyEquipment"];
export const validateDecline = (reason, details) => reason && (reason !== "Other" || details.trim().length >= 3) && details.trim().length <= 300;
// Same check as the old decline: a reason is required, "Other" needs at least 3 letters, at most 300.
export const validateUnable = validateDecline;
export const validateCompletion = (outcome, notes) => Boolean(outcome) && notes.trim().length > 0 && notes.trim().length <= 500;
export const isChecklistReady = (items) => REQUIRED_CHECKLIST_ITEMS.every((key) => items[key] === true);
