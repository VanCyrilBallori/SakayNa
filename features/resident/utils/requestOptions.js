// The most people one request can carry (our biggest barangay vehicle).
export const MAX_PASSENGERS = 6;

export const PURPOSE_OPTIONS = Object.freeze(["Medical / Health", "Community / Personal Trip", "Other"]);

export const ASSISTANCE_OPTIONS = Object.freeze([
  "Senior citizen",
  "PWD / Wheelchair user",
  "Pregnant",
  "Child",
  "Needs help getting in the vehicle",
  "Other",
]);

// Old requests (before the new form) saved assistance as on/off switches. Kept so those still show.
export const VULNERABLE_GROUP_OPTIONS = Object.freeze([
  { key: "seniorCitizen", label: "Senior citizen" },
  { key: "pwd", label: "PWD" },
  { key: "pregnantPassenger", label: "Pregnant passenger" },
  { key: "child", label: "Child" },
  { key: "otherAssistance", label: "Other assistance needed" },
]);

// The priority the dispatcher sees first. Medical rides go first; the dispatcher still judges each case.
export const getResidentReportedPriority = (purpose) => (purpose === "Medical / Health" ? "Urgent" : "Non-Urgent");
