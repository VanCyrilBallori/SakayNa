import { MAX_PASSENGERS } from "./requestOptions";

const compactWhitespace = (value = "") => value.trim().replace(/\s+/g, " ");

export const normalizePhilippinePhone = (value = "") => {
  const digits = value.replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^639\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\+639\d{9}$/.test(value.replace(/\s|-/g, ""))) return value.replace(/\s|-/g, "");
  return "";
};

const hasText = (value, max) => {
  const normalized = compactWhitespace(value);
  return normalized.length > 0 && normalized.length <= max;
};

// Removes extra spaces from everything the resident typed.
export const sanitizeRequestForm = (form) => ({
  ...form,
  purposeOther: compactWhitespace(form.purposeOther),
  passengerName: compactWhitespace(form.passengerName),
  passengerPhone: form.passengerPhone.trim(),
  pickupDetails: compactWhitespace(form.pickupDetails),
  destination: compactWhitespace(form.destination),
  assistanceOther: compactWhitespace(form.assistanceOther),
  additionalNotes: compactWhitespace(form.additionalNotes),
});

// Returns { fieldName: "message" } for every field that needs fixing. Empty object = the form is complete.
// residentPhone is the phone saved in the resident's profile (used when "Me" is riding).
export const validateResidentRequest = (form, residentPhone) => {
  const errors = {};

  if (!form.purpose) errors.purpose = "Choose what the ride is for.";
  else if (form.purpose === "Other" && !hasText(form.purposeOther, 100)) errors.purposeOther = "Tell us briefly what the ride is for (up to 100 letters).";

  if (form.ridingFor === "self" && !normalizePhilippinePhone(residentPhone || "")) {
    errors.ridingFor = "Your profile has no phone number. Add it in Settings first.";
  }
  if (form.ridingFor === "other") {
    if (!hasText(form.passengerName, 80) || form.passengerName.length < 2) errors.passengerName = "Enter the passenger's name.";
    // The passenger's phone is optional, but if something was typed it must be a real mobile number.
    if (form.passengerPhone && !normalizePhilippinePhone(form.passengerPhone)) errors.passengerPhone = "Enter a mobile number like 0917 123 4567, or leave it empty.";
  }

  if (!(form.passengerCount >= 1 && form.passengerCount <= MAX_PASSENGERS)) errors.passengerCount = `Choose 1 to ${MAX_PASSENGERS} people.`;
  if (!form.barangay) errors.barangay = "Choose the pickup barangay.";
  if (!hasText(form.pickupDetails, 300)) errors.pickupDetails = "Tell the driver how to find you, like a landmark or gate color.";
  if (!hasText(form.destination, 180)) errors.destination = "Enter where you are going.";
  if (form.assistance.includes("Other") && !hasText(form.assistanceOther, 100)) errors.assistanceOther = "Tell us what help is needed (up to 100 letters).";
  if (form.additionalNotes.length > 500) errors.additionalNotes = "Notes must be 500 letters or fewer.";

  return errors;
};

export const validateCancellationReason = (value = "") => {
  const normalized = compactWhitespace(value);
  if (normalized.length < 3 || normalized.length > 240) return "Provide a cancellation reason between 3 and 240 characters.";
  return "";
};
