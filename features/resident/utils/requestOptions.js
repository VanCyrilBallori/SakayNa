import { formatClockTime, formatShortDay } from "../../../lib/dates";

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

// The priority the dispatcher sees first. Scheduled rides are "Planned". Otherwise medical rides go first.
// The dispatcher still judges each case.
export const getResidentReportedPriority = (purpose, timing) => {
  if (timing === "scheduled") return "Planned";
  return purpose === "Medical / Health" ? "Urgent" : "Non-Urgent";
};

// ---- "Schedule for later" ----
// A scheduled ride must be at least 1 hour from now and at most 7 days ahead.
export const SCHEDULE_MIN_MINUTES_AHEAD = 60;
export const SCHEDULE_MAX_DAYS_AHEAD = 7;
// Which hours can be booked: 0 to 24 = any time of day.
// For office hours only, change these two numbers (for example 6 and 20 = 6:00 AM to 8:00 PM).
const SCHEDULE_FIRST_HOUR = 0;
const SCHEDULE_END_HOUR = 24;
const SLOT_MINUTES = 30;

// Turns the form's day ("2026-10-02") and time (minutes after midnight, e.g. 540 = 9:00 AM) into one date.
export const buildScheduledDate = (dayValue, minutes) => {
  const [year, month, day] = dayValue.split("-").map(Number);
  return new Date(year, month - 1, day, 0, minutes);
};

// True if this date and time may be booked right now (1 hour to 7 days ahead).
export const isAllowedScheduleTime = (date, now = new Date()) => {
  const earliest = now.getTime() + SCHEDULE_MIN_MINUTES_AHEAD * 60_000;
  const latest = now.getTime() + SCHEDULE_MAX_DAYS_AHEAD * 24 * 60 * 60_000;
  return date.getTime() >= earliest && date.getTime() <= latest;
};

// The time choices for one day: every 30 minutes, only the ones that may be booked.
export const getScheduleTimeOptions = (dayValue, now = new Date()) => {
  const options = [];
  for (let minutes = SCHEDULE_FIRST_HOUR * 60; minutes < SCHEDULE_END_HOUR * 60; minutes += SLOT_MINUTES) {
    const date = buildScheduledDate(dayValue, minutes);
    if (isAllowedScheduleTime(date, now)) options.push({ label: formatClockTime(date), value: minutes });
  }
  return options;
};

// The day choices: "Today (Tue, Sep 29)", "Tomorrow (Wed, Sep 30)", then "Fri, Oct 2" ... up to 7 days ahead.
// A day with no time left to book (for example today, late at night) is left out.
export const getScheduleDayOptions = (now = new Date()) => {
  const options = [];
  for (let offset = 0; offset <= SCHEDULE_MAX_DAYS_AHEAD; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const value = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
    if (!getScheduleTimeOptions(value, now).length) continue;
    const name = formatShortDay(date);
    const label = offset === 0 ? `Today (${name})` : offset === 1 ? `Tomorrow (${name})` : name;
    options.push({ label, value });
  }
  return options;
};
