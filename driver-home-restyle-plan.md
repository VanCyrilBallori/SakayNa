# Driver Home Restyle Plan

**Status: Pieces 1–5 DONE (commits f0c21dd, a6e75f4, 1b0dcb7, fd00d3d, 8ee0520, c0800eb), released as demo-ready-10, 2026-10-04.** Later changed by driver-pages-plan.md: a bottom bar with 3 pages (Ride / Map / Availability), Decline replaced by "I can't do this ride", History moved to the Availability page.

## Answers (2026-10-04)
1. Accept is one tap, no "Are you sure?". Decline keeps asking first
   (its reason pop-up with "Keep assignment" / "Confirm decline").
2. One navigation button that follows the ride step:
   "Navigate to pickup" until "Picked up", then "Navigate to
   destination" (Piece 4a).
Demo freeze: around Oct 8–9.

## Goal (in simple words)
Make the driver home LOOK like design-refs/driver-home-reference.png
(screens 1, 3–4, 10–11), in DESIGN.md colors and sizes. How it works
stays the same, with one change: Accept no longer asks for the vehicle
checklist first.

## Rules for this restyle
- DESIGN.md wins where the picture differs: Hall Green, Sakay Orange
  with dark (Ink) text, sentence case ("Pickup", not "PICKUP"), text 17
  (15 only for small dates and labels), buttons at least 56 tall, card
  corners 24, button corners 16, no shadows.
- Same look as the resident's "Your ride" card
  (features/resident/components/LatestRequestCard.jsx): status band on
  top (22, bold), places 17 bold, green ring for Pickup, orange dot for
  Destination, short green line between them.
- No new packages, no rules change, no new Firestore fields.
- Icons: MaterialCommunityIcons (already in @expo/vector-icons).

## Keep exactly as now
- The duty card (DriverDutyCard.jsx): Punch in, Take a break
  (Lunch / Rest / Personal), On a run, Punch out.
- Decline and its reason pop-up; Complete and its outcome pop-up.
- All ride steps and what they save (driverMissionService.js is not
  changed).
- The map (LeafletMap + OpenStreetMap).
- The thin header and the profile menu. No bottom tabs.
- The "resident cancelled this ride" note.

## The vehicle checklist: who uses it
Searched the whole project (2026-10-04):
- **Uses it:** only DriverMissionActions.jsx ("Review vehicle" pop-up)
  and the function that saves it, `saveVehicleChecklist` in
  driverMissionService.js.
- **Does not need it:** `acceptAssignment` takes the checklist id but
  never saves it. The rules for driverAssignments don't ask for it.
  No dispatcher or admin screen reads `vehicleChecklists`.
- **Mentions it (words only):** firestore.rules (who may read/write
  it; unchanged), README.md (collections table and the ride steps
  line), PRODUCT.md (two lines), Skills/resident.md (access table,
  still true).
- **Kept:** the `vehicleChecklists` data and its rules. The
  `saveVehicleChecklist` function and the checklist item list stay in
  their files, not used, with a comment (like the old work-hours
  window), so it can come back later.

## Pieces (one at a time: sketch → OK → build → test on phone → commit)

### Piece 1 — Accept works directly (no "Review vehicle")
- File: features/driver/components/DriverMissionActions.jsx
  (+ one comment line in driverMissionService.js and
  driverMissionValidation.js).
- "Review vehicle" becomes **Accept ride** (full width, Hall Green,
  on top). **Decline** goes underneath (full width). Tapping Accept
  saves right away, same as the old "Accept assignment" did.
- The checklist pop-up is removed.
- Error messages (for example "You are on a break. Tap Resume duty,
  then accept this ride.") now show under the buttons. Today they only
  show inside a pop-up, so without the checklist pop-up they would be
  invisible.
- **Test:** punch in → dispatcher assigns → tap Accept ride → no
  checklist pop-up; the card shows "Mark en route"; the duty card says
  "On a run". Decline on another ride → reason pop-up as before.
  Firebase Console: no new `vehicleChecklists` document; old ones are
  still there.

### Piece 2 — Ride Inbox header and empty inbox (screen 1)
- File: app/driver-home.jsx (inbox header, empty inbox, their styles).
- Board Tint section with 24 corners. Orange "Ride Inbox" pill with
  Ink text. Small green words on the right: "No ride yet" /
  "New from dispatch" / "Ride in progress" (group chose "No ride yet"
  over the reference's "No assigned task").
- The empty card has its own new styles, because the History pop-up
  shares the old ones (emptyInbox / emptyTitle / emptyText) and
  stays unchanged. The "Ride Inbox" pill is new too (History uses
  `badge`).
- Title "Current ride" (22, bold).
- Empty: white card, envelope icon, "Inbox empty" (22),
  "Rides assigned to you by dispatch will appear here." (17).

### Piece 3 — The task card (screens 3–4)
- New file features/driver/components/DriverRideCard.jsx (keeps
  driver-home.jsx from growing); app/driver-home.jsx uses it instead
  of the five small cards (Current mission, Passenger, Pickup,
  Destination, Trip summary).
- Agreed at the sketch (2026-10-04): ride title is 17 bold (the band
  is the card's one big thing); landmark and "Needs help" stay on the
  card; "Pickup" / "Destination" sit above the place. The pop-up is
  renamed "Ride details" and also shows Summary, Priority (`level`,
  from the old "Trip summary" box) and Landmark. The "Review details"
  button under the map is replaced by "Ride details ›" on the card.
- Card: status band (word + color, see below) → ride title (17) →
  clock + time ("Sun, Oct 4 · 9:00 AM" or "As soon as possible") →
  Pickup / Destination route board → two small boxes, **Riders**
  ("4 seniors") and **Vehicle** ("Barangay Van 1") → passenger name
  with **Call passenger** (kept, it is on the screen today) →
  "Ride details ›".
- Nothing is lost: what leaves the screen (summary, landmark,
  assistance, notes, level) is in the "Ride details" pop-up. The
  pop-up gets the two lines it doesn't show today: summary and
  landmark.
- Status band words (DESIGN.md "Status band colors"):
  | Step | Band | Color |
  |---|---|---|
  | Assigned | "New ride from dispatch" | Hall Green Deep, white text |
  | Accepted | "Accepted" | Hall Green Deep, white text |
  | En Route | "On the way to pickup" | Hall Green Deep, white text |
  | Arrived | "At the pickup" | Sakay Orange, Ink text |
  | Picked Up | "Rider on board" | Hall Green Deep, white text |

### Piece 4a — During a ride: map on top + "Open navigation" (screens 10–11)
- Files: app/driver-home.jsx, DriverMissionActions.jsx.
- Order on screen: inbox header → map (same LeafletMap) → task card →
  navigation button → buttons.
- One column on the phone and on the website (not wider than 640).
- Map height is one number, `RIDE_MAP_HEIGHT` in driver-home.jsx: 180
  (was 240; the step button needed scrolling on the phone, 2026-10-04).
- The repeated header above the map (title + small status tag) is
  removed; the task card already shows both.
- One navigation button replaces the two buttons "Open pickup" /
  "Open destination". It opens the same Google Maps link we use now.
  Its words follow the ride step: **Navigate to pickup** until
  "Picked up", then **Navigate to destination**.

### Piece 4b — Ride steps as a timeline (screens 10–11)
- Files: features/driver/components/DriverRideSteps.jsx (new),
  DriverMissionActions.jsx.
- Agreed at the sketch (2026-10-04): the step button sits ABOVE the
  list (the picture has it below), so the button stays on screen
  without scrolling. The list shows only after Accept.
- Title "Ride steps" (not "STATUS"). One row per step:
  Accepted → On the way → Arrived at pickup → Rider picked up →
  Completed.
  - Done: green check + word + the time it was saved (from the
    assignment's acceptedAt, enRouteAt, … in Manila time, using
    formatManilaTime from lib/dutyTime.js).
  - Now: orange dot + word in bold.
  - Not yet: grey ring + word in Ink Muted.
- Under it, **one big button** for the next step, same words and same
  save as today: Mark en route → Confirm arrival → Confirm pickup →
  Complete mission (opens the same Complete pop-up).

### Piece 5 — Paperwork
- README.md: ride steps line without "checklist →"; collections table:
  `vehicleChecklists` = "old pre-trip checks, no longer asked (kept)".
- PRODUCT.md: remove "completes a pre-trip vehicle checklist" (2 lines).
- This plan: Status line.

### Then release (CLAUDE.md "EAS build checklist" + "How to update the website")
No rules change. No new packages, so no new development build. Old
APKs keep working (they still save a checklist; nothing breaks).

## If time runs out (freeze ~Oct 8–9)
Suggested days: Oct 5 Pieces 1–2 · Oct 6 Piece 3 · Oct 7 Pieces 4a–4b ·
Oct 8 morning Piece 5 + APK + website.

Drop in this order:
1. **Piece 4b** (timeline): keep today's single next-step button,
   only made full width.
2. **Piece 4a** (map on top + Open navigation): keep today's map
   position and the two "Open pickup / Open destination" buttons.

**Must stay:** Pieces 1, 2, 3 and 5. They give the reference look for
the inbox and the task card, and remove the checklist.

## Not now (future work)
- The 1-hour confirm / transfer flow (screens 5–8).
- The red emergency takeover with countdown and vibration (screen 9).
- Bottom tabs (Inbox / Schedule / History / Profile). Partly done in driver-pages-plan.md: Ride / Map / Availability.
- The "How assignments reach you" note.
- Distance (needs a route service).
- The Online / Offline sheet (screen 2): our duty card replaces it.
- The "1" count badge on the Ride Inbox pill (a driver only ever sees
  one ride at a time today).

## Releases
- 2026-10-04: **demo-ready-10** (Pieces 1–5: Accept without the
  vehicle checklist, Ride Inbox header, one ride card with status band,
  map on top with one navigation button, ride steps list).
  - Website: master → main → Vercel, main at c0800eb; the new version
    was live (checked: the live code file contains "Accept ride",
    "Navigate to pickup" and "Ride steps"). No rules change.
  - Preview APK: EAS build 5c010ce5-2c5e-49b0-a5a2-84c6ba0479f1,
    profile preview, built from commit c0800eb, `eas fingerprint:compare`
    says "matches". Tested on the phone. Tagged demo-ready-10 (on
    c0800eb) and pushed.
  - Tester message: tester-message.md with the new ride screen and this
    APK's link (commit 7cbc131).
  - Not in this release: the 3 driver pages (driver-pages-plan.md
    Step 1, not committed yet), for the next website + APK.
