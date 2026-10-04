import { getTimestampMillis } from "./dates";

// Duty time helpers (driver-duty-plan.md). Used by the driver's status card,
// and later by the admin DTR and the driver's My DTR.

// Turns one shift's duty records into its time card numbers.
// A record looks like { type: "Punch in", at: <Firestore time>, outcome, purpose }.
// Anything still going on (a break, or the shift itself) counts up to nowMs.
export const summarizeShift = (records, nowMs = Date.now()) => {
  const sorted = records
    .map((record) => ({ ...record, ms: getTimestampMillis(record.at) }))
    .filter((record) => record.ms !== null)
    .sort((first, second) => first.ms - second.ms);

  let punchInMs = null;
  let punchOutMs = null;
  let breakMs = 0;
  let breakStartMs = null;
  let medicalRides = 0;
  let communityRides = 0;

  sorted.forEach((record) => {
    if (record.type === "Punch in" && punchInMs === null) punchInMs = record.ms;
    if (record.type === "Break start") breakStartMs = record.ms;
    // A break ends with "Break end", or with "Punch out" if the driver punched out while on break.
    if ((record.type === "Break end" || record.type === "Punch out") && breakStartMs !== null) {
      breakMs += record.ms - breakStartMs;
      breakStartMs = null;
    }
    if (record.type === "Punch out") punchOutMs = record.ms;
    if (record.type === "Run end" && record.outcome === "Completed") {
      if (record.purpose === "Medical / Health") medicalRides += 1;
      else communityRides += 1;
    }
  });

  const endMs = punchOutMs ?? nowMs;
  // A break that has not ended yet counts up to now.
  if (breakStartMs !== null) breakMs += Math.max(0, endMs - breakStartMs);
  // Time on duty = from punch in to punch out (or now), without the breaks.
  const onDutyMs = punchInMs === null ? 0 : Math.max(0, endMs - punchInMs - breakMs);

  return {
    punchInMs,
    punchOutMs,
    breakMs,
    onDutyMs,
    medicalRides,
    communityRides,
    ridesCompleted: medicalRides + communityRides,
  };
};

const twoDigits = (value) => `${value}`.padStart(2, "0");

// 8115000 ms -> "02:15:15" (for the ticking timer).
export const formatTimer = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(totalSeconds % 60)}`;
};

// 8115000 ms -> "2 hr 15 min", 0 -> "0 min".
export const formatDutyDuration = (milliseconds) => {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
};

// Manila is always 8 hours ahead of UTC (no daylight saving). Adding 8 hours and reading
// the UTC clock shows Manila time on every phone and browser, whatever its own time zone.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

// -> "8:02 AM" in Manila time.
export const formatManilaTime = (milliseconds) => {
  if (milliseconds === null || milliseconds === undefined) return "Not available";
  const manila = new Date(milliseconds + MANILA_OFFSET_MS);
  const hours = manila.getUTCHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${twoDigits(manila.getUTCMinutes())} ${hours < 12 ? "AM" : "PM"}`;
};
