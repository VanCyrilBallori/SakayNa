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

export const formatDate = (value) => {
  const date = getDateFromValue(value);

  if (!date) {
    return "Not available";
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatDateTime = (value) => {
  const date = getDateFromValue(value);

  if (!date) {
    return "Not available";
  }

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

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
