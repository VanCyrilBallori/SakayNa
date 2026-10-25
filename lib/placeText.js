// A pickup ("From") place saved as only map numbers, like "10.390482, 123.649995". The pin picker and the
// phone's GPS save that when no address is typed or found. On screen it says "Pinned location" instead
// (Task 3.17). Display only: the saved text and the map position stay the same.
const COORDINATES_ONLY = /^\s*-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+\s*$/;

export const formatPlace = (text) => (typeof text === "string" && COORDINATES_ONLY.test(text) ? "Pinned location" : text);

// A Plus Code, like "9JQX+XH7": Google's short code for a map spot. The phone's address lookup gives it as the
// place's name when the spot has no street name, e.g. "9JQX+XH7, Toledo, Central Visayas". It means nothing to a person.
const PLUS_CODE = /\b[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,3}\b/;

export const hasPlusCode = (text) => typeof text === "string" && PLUS_CODE.test(text);

// What the emergency form puts in its Pickup box for an alert's address: "Pinned location" when the GPS
// address is a Plus Code (the GPS spot itself is saved with the ride, so the driver's map still has the pin).
// Submit uses it too: if the box still says this, the dispatcher kept the GPS spot (dispatcherAssignmentService.js).
export const getPickupBoxText = (text = "") => (hasPlusCode(text) ? "Pinned location" : text);

// The same text without the Plus Code: "9JQX+XH7, Toledo, Central Visayas" becomes "Toledo, Central Visayas".
export const removePlusCode = (text) => text.replace(PLUS_CODE, "").replace(/^[\s,]+/, "").trim();
