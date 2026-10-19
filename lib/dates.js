export const getDateFromValue = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getTimestampMillis = (value) => getDateFromValue(value)?.getTime() ?? null;

// "Tue, Oct 20" (one date format everywhere, see formatDay below).
export const formatDate = (value) => formatDay(value);

// "Tue, Oct 20, 2:00 PM" (one date and time format everywhere, see formatWhen below).
export const formatDateTime = (value) => formatWhen(value);

export const getDurationLabel = (milliseconds) => {
  if (typeof milliseconds !== "number" || Number.isNaN(milliseconds)) {
    return "Not enough data";
  }

  if (milliseconds < 60_000) {
    return `${Math.max(1, Math.round(milliseconds / 1000))} sec`;
  }

  const minutes = Math.round(milliseconds / 60_000);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
};

export const getAverageDuration = (requests, endFieldNames) => {
  const durations = requests
    .map((request) => {
      const createdAt = getTimestampMillis(request.createdAt);
      const endingField = endFieldNames.find((fieldName) => request[fieldName]);
      const endedAt = endingField ? getTimestampMillis(request[endingField]) : null;

      if (!createdAt || !endedAt || endedAt < createdAt) {
        return null;
      }

      return endedAt - createdAt;
    })
    .filter((value) => typeof value === "number");

  if (!durations.length) {
    return null;
  }

  return durations.reduce((sum, value) => sum + value, 0) / durations.length;
};

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Fri, Oct 2" (written by hand so every phone and browser shows the same words).
export const formatShortDay = (date) => `${SHORT_WEEKDAYS[date.getDay()]}, ${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;

// "9:00 AM", "12:30 PM".
export const formatClockTime = (date) => {
  const hours = date.getHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${`${date.getMinutes()}`.padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
};

// ---- One date and time format everywhere (DESIGN.md "Dates and times"), in Philippine time ----
// "Tue, Oct 20, 2:00 PM", "Tue, Oct 20" and "2:00 PM". The year is added only when it isn't this
// year: "Sun, Oct 4, 2025". Never seconds. Manila is 8 hours ahead of UTC all year (no daylight
// saving), so adding 8 hours and reading the UTC clock shows Philippine time on every phone and browser.
// (Admin CSV downloads keep their own format.)
const PHILIPPINE_OFFSET_MS = 8 * 60 * 60 * 1000;

const toPhilippineClock = (value) => {
  const date = getDateFromValue(value);
  return date ? new Date(date.getTime() + PHILIPPINE_OFFSET_MS) : null;
};

const philippineDayText = (clock) => {
  const thisYear = new Date(Date.now() + PHILIPPINE_OFFSET_MS).getUTCFullYear();
  const year = clock.getUTCFullYear() === thisYear ? "" : `, ${clock.getUTCFullYear()}`;
  return `${SHORT_WEEKDAYS[clock.getUTCDay()]}, ${SHORT_MONTHS[clock.getUTCMonth()]} ${clock.getUTCDate()}${year}`;
};

const philippineTimeText = (clock) => {
  const hours = clock.getUTCHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${`${clock.getUTCMinutes()}`.padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
};

// "Tue, Oct 20, 2:00 PM"
export const formatWhen = (value) => {
  const clock = toPhilippineClock(value);
  return clock ? `${philippineDayText(clock)}, ${philippineTimeText(clock)}` : "Not available";
};

// "Tue, Oct 20"
export const formatDay = (value) => {
  const clock = toPhilippineClock(value);
  return clock ? philippineDayText(clock) : "Not available";
};

// "2:00 PM"
export const formatTime = (value) => {
  const clock = toPhilippineClock(value);
  return clock ? philippineTimeText(clock) : "Not available";
};
