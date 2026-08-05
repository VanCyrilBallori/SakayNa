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

export const sanitizeRequestForm = (form) => ({
  ...form,
  serviceType: compactWhitespace(form.serviceType),
  passengerName: compactWhitespace(form.passengerName),
  contactNumber: normalizePhilippinePhone(form.contactNumber),
  barangay: compactWhitespace(form.barangay),
  pickupDetails: compactWhitespace(form.pickupDetails),
  destinationAddress: compactWhitespace(form.destinationAddress),
  description: compactWhitespace(form.description),
  accessibilityNotes: compactWhitespace(form.accessibilityNotes),
  additionalNotes: compactWhitespace(form.additionalNotes),
  pickup: {
    ...form.pickup,
    address: compactWhitespace(form.pickup?.address),
    barangay: compactWhitespace(form.pickup?.barangay) || null,
  },
});

export const validateResidentRequest = (form) => {
  const errors = {};
  if (!form.category) errors.category = "Choose the request category.";
  if (!form.serviceType) errors.serviceType = "Choose the service type.";
  if (!form.passengerCapacity) errors.passengerCapacity = "Choose the passenger count.";
  if (!hasText(form.passengerName, 80)) errors.passengerName = "Enter the passenger's name (up to 80 characters).";
  if (!form.contactNumber) errors.contactNumber = "Enter a valid Philippine mobile number.";
  if (!hasText(form.barangay, 80)) errors.barangay = "Choose the pickup barangay.";
  if (!hasText(form.pickup?.address, 180)) errors.pickup = "Enter or select a pickup location.";
  if (!hasText(form.pickupDetails, 300)) errors.pickupDetails = "Add clear pickup details so the driver can find you.";

  const canOmitDestination = form.category === "Emergency Request" && form.destinationMode === "no-destination";
  if (!canOmitDestination && form.destinationMode !== "nearest-facility" && !hasText(form.destinationAddress, 180)) {
    errors.destination = "Enter a destination or choose the nearest appropriate facility.";
  }
  if (!hasText(form.description, 500)) errors.description = "Describe the transport need (up to 500 characters).";
  if (form.accessibilityNotes && form.accessibilityNotes.length > 500) errors.accessibilityNotes = "Accessibility notes must be 500 characters or fewer.";
  if (form.additionalNotes && form.additionalNotes.length > 500) errors.additionalNotes = "Additional notes must be 500 characters or fewer.";

  return errors;
};

export const validateCancellationReason = (value = "") => {
  const normalized = compactWhitespace(value);
  if (normalized.length < 3 || normalized.length > 240) return "Provide a cancellation reason between 3 and 240 characters.";
  return "";
};
