export const DECLINE_REASONS = ["Unavailable", "Vehicle problem", "Too far", "Schedule conflict", "Medical or personal reason", "Other"];
export const COMPLETION_OUTCOMES = ["Passenger transported successfully", "Passenger transferred to facility", "Request resolved on site", "Passenger unavailable", "Unable to complete", "Other"];
export const REQUIRED_CHECKLIST_ITEMS = ["fuel", "tires", "brakes", "lights", "firstAidKit", "communicationDevice", "documents", "cleanliness", "emergencyEquipment"];
export const validateDecline = (reason, details) => reason && (reason !== "Other" || details.trim().length >= 3) && details.trim().length <= 300;
export const validateCompletion = (outcome, notes) => Boolean(outcome) && notes.trim().length > 0 && notes.trim().length <= 500;
export const isChecklistReady = (items) => REQUIRED_CHECKLIST_ITEMS.every((key) => items[key] === true);
