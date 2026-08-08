const test = require("node:test");
const assert = require("node:assert/strict");
const { ACTIVE_ASSIGNMENT_STATUSES, MISSION_TRANSITIONS, ROLES, ROLE_PERMISSIONS } = require("../src/config/constants");

test("mission transitions are forward-only", () => {
  assert.deepEqual(MISSION_TRANSITIONS.Assigned, ["Accepted", "Declined"]);
  assert.equal(MISSION_TRANSITIONS.Completed, undefined);
  assert.equal(MISSION_TRANSITIONS["Picked Up"].includes("Completed"), true);
});

test("active statuses exclude completed work", () => {
  assert.equal(ACTIVE_ASSIGNMENT_STATUSES.has("Assigned"), true);
  assert.equal(ACTIVE_ASSIGNMENT_STATUSES.has("Completed"), false);
});

test("only Admin receives management defaults", () => {
  assert.equal(ROLE_PERMISSIONS[ROLES.ADMIN].length > 0, true);
  assert.equal(ROLE_PERMISSIONS[ROLES.DRIVER].length, 0);
});