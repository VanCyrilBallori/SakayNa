// A pickup ("From") place saved as only map numbers, like "10.390482, 123.649995". The pin picker and the
// phone's GPS save that when no address is typed or found. On screen it says "Pinned location" instead
// (Task 3.17). Display only: the saved text and the map position stay the same.
const COORDINATES_ONLY = /^\s*-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+\s*$/;

export const formatPlace = (text) => (typeof text === "string" && COORDINATES_ONLY.test(text) ? "Pinned location" : text);
