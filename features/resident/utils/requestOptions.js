// The most people one request can have (Task 3.10). A big group may need more than one vehicle.
export const MAX_PASSENGERS = 50;
// 10 or more people: the request form and the dispatcher show BIG_GROUP_NOTE.
export const BIG_GROUP_SIZE = 10;
export const BIG_GROUP_NOTE = "This is a big group. The dispatcher may need to send more than one vehicle.";
export const isBigGroup = (count) => count >= BIG_GROUP_SIZE && count <= MAX_PASSENGERS;

export const PURPOSE_OPTIONS = Object.freeze(["Medical / Health", "Community Activity", "Other"]);

// "Community Activity" was called "Community / Personal Trip" before Task 3.9. Old rides (and old APKs that
// are not updated yet) still save the old name. Counts and filters use getPurpose, so both names count as one.
// Screens that show a ride's saved title still show the name it was saved with.
export const COMMUNITY_PURPOSE = "Community Activity";
export const OLD_COMMUNITY_PURPOSE = "Community / Personal Trip";
export const getPurpose = (request) => (request?.purpose === OLD_COMMUNITY_PURPOSE ? COMMUNITY_PURPOSE : request?.purpose);

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

// The priority the dispatcher sees first. Scheduled rides are "Planned". Otherwise medical rides go first.
// The dispatcher still judges each case.
export const getResidentReportedPriority = (purpose, timing) => {
  if (timing === "scheduled") return "Planned";
  return purpose === "Medical / Health" ? "Urgent" : "Non-Urgent";
};

// ---- "Schedule for later" ----
// A scheduled ride must be at least 1 hour from now and at most 1 year (365 days) ahead (Task 3.11).
// The phone uses Android's own calendar and clock, the website the browser's date and time boxes.
export const SCHEDULE_MIN_MINUTES_AHEAD = 60;
export const SCHEDULE_MAX_DAYS_AHEAD = 365;

// Turns the form's day ("2026-10-02") and time (minutes after midnight, e.g. 540 = 9:00 AM) into one date.
export const buildScheduledDate = (dayValue, minutes) => {
  const [year, month, day] = dayValue.split("-").map(Number);
  return new Date(year, month - 1, day, 0, minutes);
};

// The other way: a date becomes the form's day text, "2026-10-02" (also what the website's date box uses).
export const toDayValue = (date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;

// True if this date and time may be booked right now (1 hour to 1 year ahead).
export const isAllowedScheduleTime = (date, now = new Date()) => {
  const earliest = now.getTime() + SCHEDULE_MIN_MINUTES_AHEAD * 60_000;
  const latest = now.getTime() + SCHEDULE_MAX_DAYS_AHEAD * 24 * 60 * 60_000;
  return date.getTime() >= earliest && date.getTime() <= latest;
};
