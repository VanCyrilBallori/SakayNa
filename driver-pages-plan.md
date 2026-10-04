# Driver Pages Plan (3 pages + "I can't do this ride")

**Status: ALL STEPS DONE 2026-10-04: Step 1 (a9d9aae), 2a (a022361), 2b (16e8376), Ride history on Availability (bf4f119, group's request), 2c (574c817), 2d paperwork. Releasing demo-ready-11.**

From the groupmate's two requests. Built one step at a time:
sketch → OK → build → test on phone → commit. Demo freeze ~Oct 8–9.

## Answers (2026-10-04)
1. "I can't do this ride" from the new ride until "Arrived at pickup".
   After "Picked up" it is replaced by a **Call dispatch** button
   (the office number we already have), for problems during the trip.
2. A: the ride goes straight back to the dispatcher. B is future work.
3. A short scroll for the Ride steps list is fine.
4. Yes: remove the "Ride Inbox" pill and the "Current ride" title.
5. Extra (in 2a / 2b): after a report the driver is still Available, so
   - dispatcher's driver card shows a warning: "Reported: can't do a
     ride (Vehicle problem), 5 min ago" (2b);
   - the driver's note after sending says "If you can't take more
     rides, take a break or punch out." (2a).

## What I found first (the code as it is today)

- **The driver home is one long page** (app/driver-home.jsx): thin
  header, duty card, "Ride Inbox" header, "Current ride" title, map,
  ride card, navigation button, step button + ride steps list.
- **Decline today** (DriverMissionActions.jsx → `declineAssignment` →
  `transitionMission(..., "Declined")` in driverMissionService.js):
  the assignment becomes "Declined", the ride goes back to "Pending",
  the driver and vehicle fields on the ride are cleared, the vehicle is
  freed, and `lastDeclinedDriverId` / `lastDeclineReason` are saved on
  the ride. Only possible before Accept.
- **Can the decline code be reused?** Yes. "Give the ride back to the
  dispatcher" is exactly what the decline save already does. The new
  report uses the same save, with its own status ("Unable") and its own
  fields, so it is not counted as a decline.
- **Can the dispatcher take a ride back today?** No. There is no "take
  back" button. A ride only returns to the dispatcher's list when the
  driver declines or the resident cancels. The dispatcher's list shows
  only "Pending" rides, and a declined ride shows there with no reason
  and no warning (`getQueueBucket`'s "Reassignment needed" exists but
  no screen uses it).
- **Reassigning is already possible:** once a ride is "Pending" again,
  the dispatcher uses the normal Assign window.
- **Rules:** a driver may already update their own assignment, their
  assigned ride, and vehicles. "On a run" → "Available" with a
  "Run end" duty record is already allowed. **No firestore.rules
  change is needed.**
- **Today a driver can't get out of a ride after Accept** (no Decline,
  no break, no punch out until it is finished).

---

## PART 1 — Three pages with a bottom bar

### What it looks like

```
┌──────────────────────────────┐
│ SakayNa logo            (JD) │  thin header (stays on top)
├──────────────────────────────┤
│                              │
│   the chosen page            │  scrolls only if it doesn't fit
│   (Ride / Map / Availability)│
│                              │
├──────────────────────────────┤
│  [van]●     [map]    [clock] │  bottom bar, always visible
│   Ride       Map  Availability│  chosen one = green + bold
└──────────────────────────────┘
```

**Ride page** (opens first)
```
┌──────────────────────────────┐
│▓ New ride from dispatch     ▓│  status band
│ Medical / Health             │
│ ◷ As soon as possible        │
│ ○ Pickup                     │
│ │ Purok 3, Barangay Poblacion│
│ ● Destination                │
│   Toledo City Hospital       │
│ [Riders 2 seniors][Vehicle..]│
│ [Needs help: Wheelchair]     │
│ ─────────────────────────────│
│ Maria Santos                 │
│ [ ☏ Call passenger ]         │
│ Ride details ›               │
└──────────────────────────────┘
[        Accept ride         ]     green, 56 tall
(Part 2 changes what is under Accept)
Ride steps list (after Accept)
```
No ride: the "Inbox empty" card, as now.

**Map page**
```
┌──────────────────────────────┐
│                              │
│        big map               │  fills the space between
│   (same pickup + destination │  header and bottom bar
│    pins)                     │  (never shorter than 280)
│                              │
└──────────────────────────────┘
[ ➤ Navigate to pickup        ]    same button as now
```
No ride: the map of Toledo with no pins, and one line: "No ride yet.
The pickup and destination show here when dispatch gives you a ride."

**Availability page**: the duty card (DriverDutyCard), unchanged.

### Details
- The bottom bar is made with plain Views and Pressables. No new
  package (no tab library, no new screens/routes).
- Each button: icon on top, word under it, at least 56 tall. Chosen
  page = Hall Green icon and bold green word; the others = Ink Muted.
  Words may wrap with large text (the bar grows), never cut off.
- **New ride:** when a new ride arrives (status "Assigned"), the app
  switches to the Ride page by itself. An orange dot sits on the Ride
  button while the ride is waiting for Accept (screen reader: "Ride,
  new ride waiting").
- The "resident cancelled this ride" note also switches to the Ride
  page, so the driver sees it.
- Only the open page is drawn. The map loads again when you open the
  Map page (same as opening the app today).
- Removed from the Ride page: the "Ride Inbox" pill row and the
  "Current ride" title (the bottom bar and the status band already say
  this; it frees about 70 points of height). **Question 4.**
- The duty card's text "Accept or decline it below first" becomes
  "Accept it on the Ride page first" (Part 1: "Accept or decline it on
  the Ride page first").
- The "Navigate to pickup / destination" button moves out of
  DriverMissionActions.jsx into its own small file, so it can sit on
  the Map page. Same words, same Google Maps link. Its "no maps app"
  error shows under it.
- Pages scroll if needed (small phones, large text), so nothing is cut.
- Kept as is: header, profile menu (Profile / History / Settings / Log
  Out), all pop-ups, Accept, steps, saves, duty rules.

### Will each page fit without scrolling?
Normal phone (about 675 points between the header and the bar):
- Map page: yes (the map takes whatever space there is).
- Availability page: yes.
- Ride page before Accept: yes, just (card ~540 + Accept).
- **Ride page after Accept: the card and the green step button fit,
  but the Ride steps list (~270 tall) will need a short scroll.**
  **Question 3.**

### Files
- app/driver-home.jsx (pages, bottom bar, auto-switch, header moved out
  of the scrolling part)
- features/driver/components/DriverNavigateButton.jsx (new; the
  navigation button moved here)
- features/driver/components/DriverMissionActions.jsx (navigation
  button removed)
- features/driver/components/DriverDutyCard.jsx (one sentence)

### Test (Step 1)
1. Open the app as a driver: Ride page, bottom bar with 3 buttons.
2. Tap Availability: Punch in. Tap Map: map, no pins, "No ride yet".
3. Dispatcher assigns a ride while you are on the Map page: the app
   jumps to Ride, orange dot on Ride. Accept: dot goes away.
4. Map page: pins + "Navigate to pickup" opens Google Maps.
5. Go through the steps to Complete. Availability says "Available".
6. Phone text size at largest: nothing cut off; pages scroll.

---

## PART 2 — Remove Decline, add "I can't do this ride"

### The driver's side
```
[        Accept ride         ]     green, 56 tall (unchanged)

     ⓘ I can't do this ride         plain words, no fill, 48 tall
```
After Accept it sits under the Ride steps list, and it disappears
once the rider is on board (**Question 1**).

Tapping it opens a pop-up:
```
┌──────────────────────────────┐
│ I can't do this ride         │
│ Dispatch will be told right  │
│ away and will give the ride  │
│ to another driver.           │
│ Why?                         │
│ ( ) Vehicle problem          │  4 big choices, 48 tall each
│ ( ) Feeling unwell           │
│ ( ) Family emergency         │
│ ( ) Other                    │
│ [ More details (optional) ]  │  required for "Other"
│ [   Send to dispatch      ]  │  red: it can't be undone
│ [   Keep this ride        ]  │  outline
└──────────────────────────────┘
```
After sending, the ride leaves the driver's screen and a note shows:
"You told dispatch you can't do this ride (Vehicle problem). If you
can't take rides now, open Availability and take a break or punch
out."

### What is saved (one transaction, reusing the decline save)
- Assignment: status **"Unable"**, `unableReason` ("Vehicle problem:
  flat tire"), `unableAt`, `unableAtStep` (e.g. "En Route"). History
  stays on the assignment.
- Ride: back to "Pending", driver and vehicle fields cleared (as
  decline does), plus `lastUnableDriverId`, `lastUnableDriverName`,
  `lastUnableReason`, `lastUnableVehicleName`. Its old step times
  (assignedAt, acceptedAt, enRouteAt, arrivedAt) are cleared, so the
  resident's timeline doesn't show old check marks (this also fixes
  Skills/resident.md #17 for this new path).
- Vehicle: freed ("Available"), as decline does.
- If the driver had accepted ("On a run"): back to "Available" with a
  "Run end" duty record, outcome "Driver unable" (not counted as a
  completed ride in the DTR).
- The resident sees "Finding another driver" (same as after a decline).

### The dispatcher's side (**Question 2**: recommended A)
- **A (recommended):** the ride goes straight back to the dispatcher's
  list. An orange banner at the top of the dispatcher screen: "Needs a
  new driver: Juan Dela Cruz can't do Medical / Health (Vehicle
  problem · Barangay Van 1). Choose another driver." Tapping it selects
  that ride. The ride's card in the list and the Selected Request box
  say "Driver can't do this ride: Vehicle problem". These rides are
  listed first. The banner goes away when the ride is assigned again.
  The dispatcher reassigns with the normal Assign window.
- B (bigger): the ride stays with the driver until the dispatcher taps
  a new "Take back" button. Needs a new dispatcher button and a new
  save. Not recommended for the freeze.

### The admin's side
Admin → Duty Records: under the time cards, a short list
**"Inability reports"** for the same day: time · driver · reason ·
ride · step ("before Accept", "On the way to pickup"...). Read from
driverAssignments with status "Unable".

### Kept (not deleted)
- `declineAssignment`, `DECLINE_REASONS`, `validateDecline`, and the
  "Declined" part of the save stay, with a comment "not used since
  driver-pages-plan.md Part 2". Old "Declined" assignments stay.
- The Decline pop-up is turned into the new pop-up (same pieces).
- Drivers on an old APK still see Decline and it still works. The
  dispatcher banner also shows their reason (it reads
  `lastDeclineReason` when there is no `lastUnableReason`).

### Steps (each tested and committed before the next)
- **2a — Driver:** button, pop-up, save, the note; resident words.
  Files: DriverMissionActions.jsx, driverMissionService.js,
  driverMissionValidation.js (`UNABLE_REASONS`), constants/app.js
  (`UNABLE`), DriverDutyCard.jsx (one sentence), app/driver-home.jsx
  (the note), features/resident/utils/requestMapper.js (one line).
- **2b — Dispatcher:** banner, line on the ride, listed first.
  File: app/dispatcher-home.jsx.
- **2c — Admin:** "Inability reports" list.
  File: features/admin/components/AdminDutyRecordsSection.jsx.
- **2d — Paperwork:** README.md, PRODUCT.md, Known-Issue.md, this
  plan, driver-home-restyle-plan.md ("Bottom tabs" no longer future).

### Test (2a + 2b)
1. Driver punched in, dispatcher assigns. Ride page: Accept and, under
   it, "I can't do this ride". No Decline.
2. Tap it, tap "Send to dispatch" with no reason: error "Choose a
   reason". Choose "Other" with no details: error.
3. Choose "Vehicle problem", send. The ride disappears; the note shows.
4. Dispatcher (website): orange banner with the driver's name and
   "Vehicle problem"; the ride is first in the list. Assign it to
   another driver: banner gone.
5. Repeat after Accept + Mark en route: driver goes back to
   "Available"; Firebase Console: duty record "Run end", outcome
   "Driver unable".
6. After "Confirm pickup", the button is gone.
7. Resident: "Finding another driver", no old check marks.

### Questions
1. When can the driver use it? **Recommended:** from the new ride until
   "Arrived at pickup"; hidden once the rider is on board (then the
   ride must be finished or handled by phone).
2. Dispatcher side: **A (recommended)** or B (above).
3. Ride page after Accept: **recommended:** keep the full Ride steps
   list and accept a short scroll for it (the green button stays on
   screen). Otherwise the list must be shortened.
4. Remove the "Ride Inbox" pill and "Current ride" title from the Ride
   page? **Recommended: yes.**

## Not now (future work)
- Keeping a van with a "Vehicle problem" out of the Assign window until
  an admin checks it (today the dispatcher just picks another vehicle).
- **Option B: a dispatcher "Take back" button.** The ride would stay
  with the driver after a report until the dispatcher taps "Take back"
  (or tells the driver to continue). Needs a new dispatcher button and
  a new save (like the report's save, done by the dispatcher). The
  driver would wait with the ride in the meantime.
- Android back button switching pages.
