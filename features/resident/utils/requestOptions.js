export const SERVICE_TYPE_OPTIONS = Object.freeze([
  { label: "Medical Transport", value: "Medical Transport" },
  { label: "Non-Emergency Medical Transport (NEMT)", value: "Non-Emergency Medical Transport (NEMT)" },
  { label: "Accessible / Wheelchair Van", value: "Accessible / Wheelchair Van" },
  { label: "Assisted Care Ride", value: "Assisted Care Ride" },
  { label: "Community Transport", value: "Community Transport" },
  { label: "Special Event / Wedding Charter", value: "Special Event / Wedding Charter" },
  { label: "Memorial / Funeral Procession", value: "Memorial / Funeral Procession" },
  { label: "Hourly / As-Directed Rental", value: "Hourly / As-Directed Rental" },
]);

export const PASSENGER_CAPACITY_OPTIONS = Object.freeze([
  { label: "1 passenger", value: "1 passenger" },
  { label: "2 passengers", value: "2 passengers" },
  { label: "4 passengers", value: "4 passengers" },
  { label: "6 passengers", value: "6 passengers" },
  { label: "8 passengers", value: "8 passengers" },
  { label: "10+ passengers", value: "10+ passengers" },
]);

export const VULNERABLE_GROUP_OPTIONS = Object.freeze([
  { key: "seniorCitizen", label: "Senior citizen" },
  { key: "pwd", label: "PWD" },
  { key: "pregnantPassenger", label: "Pregnant passenger" },
  { key: "child", label: "Child" },
  { key: "otherAssistance", label: "Other assistance needed" },
]);

const EMERGENCY_SERVICES = new Set(["Medical Transport"]);
const PLANNED_SERVICES = new Set([
  "Special Event / Wedding Charter",
  "Memorial / Funeral Procession",
  "Hourly / As-Directed Rental",
]);

export const getResidentReportedPriority = (category, serviceType) => {
  if (category === "Emergency Request" || EMERGENCY_SERVICES.has(serviceType)) {
    return "Urgent";
  }

  return PLANNED_SERVICES.has(serviceType) ? "Planned" : "Non-Urgent";
};
