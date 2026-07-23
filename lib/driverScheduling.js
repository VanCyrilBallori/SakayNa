export const DRIVER_SCHEDULE_COLLECTION = "driverSchedules";

export const SCHEDULE_STATUSES = ["Available", "Claimed", "On Duty", "Completed", "Cancelled"];
export const OPEN_SHIFT_ROLE_OPTIONS = ["Dispatcher", "Admin"];
export const DRIVER_AVAILABILITY_SHIFT = "Driver Availability";
export const OPEN_SHIFT_TYPE = "Open Shift";

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

export const buildScheduleDateTime = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) {
    return null;
  }

  const date = new Date(`${dateValue}T${timeValue}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const scheduleHasStarted = (schedule, now = new Date()) => {
  const startAt = getDateFromValue(schedule.startAt);
  return Boolean(startAt && startAt <= now);
};

export const scheduleHasEnded = (schedule, now = new Date()) => {
  const endAt = getDateFromValue(schedule.endAt);
  return Boolean(endAt && endAt < now);
};

export const isScheduleFuture = (schedule, now = new Date()) => {
  const startAt = getDateFromValue(schedule.startAt);
  return Boolean(startAt && startAt > now);
};

export const overlapsScheduleWindow = (firstSchedule, secondSchedule) => {
  const firstStart = getDateFromValue(firstSchedule.startAt);
  const firstEnd = getDateFromValue(firstSchedule.endAt);
  const secondStart = getDateFromValue(secondSchedule.startAt);
  const secondEnd = getDateFromValue(secondSchedule.endAt);

  if (!firstStart || !firstEnd || !secondStart || !secondEnd) {
    return false;
  }

  return firstStart < secondEnd && secondStart < firstEnd;
};

export const formatScheduleWindow = (schedule) => {
  const startAt = getDateFromValue(schedule.startAt);
  const endAt = getDateFromValue(schedule.endAt);

  if (!startAt || !endAt) {
    return `${schedule.date || "No date"} | ${schedule.startTime || "--:--"} - ${schedule.endTime || "--:--"}`;
  }

  return `${startAt.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} | ${startAt.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  })} - ${endAt.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
};

export const getScheduleLifecycleStatus = (schedule, now = new Date()) => {
  if (!schedule) {
    return "Offline";
  }

  if (schedule.status === "Cancelled") {
    return "Cancelled";
  }

  if (schedule.status === "Completed" || scheduleHasEnded(schedule, now)) {
    return "Completed";
  }

  if (scheduleHasStarted(schedule, now)) {
    return "On Duty";
  }

  return schedule.status || "Available";
};

export const getDriverAvailabilityState = ({
  driver,
  schedules = [],
  activeAssignment = null,
  now = new Date(),
}) => {
  const approved = driver?.accountStatus === "Approved";
  const online = driver?.presence === "Online";
  const activeSchedule = schedules.find(
    (schedule) =>
      ["Available", "Claimed", "On Duty"].includes(schedule.status) &&
      scheduleHasStarted(schedule, now) &&
      !scheduleHasEnded(schedule, now)
  );
  const futureSchedule = schedules.find(
    (schedule) =>
      ["Available", "Claimed", "On Duty"].includes(schedule.status) &&
      isScheduleFuture(schedule, now)
  );

  if (activeAssignment) {
    return "Busy";
  }

  if (approved && activeSchedule) {
    return online ? "Online Now" : "Scheduled Now";
  }

  if (futureSchedule) {
    return "Scheduled Later";
  }

  if (online && approved) {
    return "Online Now";
  }

  return "Offline";
};
