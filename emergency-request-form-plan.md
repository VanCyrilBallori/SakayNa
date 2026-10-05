# Emergency Request Form Plan

**Original release: DONE and released (2026-10-05).** Steps 1 (3521461), 2a (7709c51), 3 (rules, 269a2b1), 4 (b403e55), 2b (627ea2d) and 5 (notes, 49482ea), each tested. See "Releases" at the bottom.
**Decisions (2026-10-05):** the alert stays connected after Submit; the
description is saved as Notes, with the hint "The driver and the resident
can see this." under the box; drivers are listed nearest first.
Layout reference: design-refs/emergency-form-reference.png (its left side
panel is ignored; our dispatcher header stays).

## Group lead feedback — Part A and Part B (2026-10-05)

**Part A: done, committed (addecd1) and tested by the user (2026-10-05).
Follow-up fix: Priority is round buttons again (one click during the call),
not a drop-down. Not on the live website yet. Part B: written, waiting
for the user's phone test.** The sections below this
update describe the original release; this update replaces its emergency
types, patient limit, description, layout, and privacy decisions.

### Part A — website only (approved)
- Emergency types: Medical, Accident / injury, Fire-related, Pregnancy /
  labor, Other. Other shows a required specifics box (up to 180 characters).
  Switching away clears it; it is saved only for Other.
- Patients: 1–50. Follow-up (2026-10-05, website only): the dispatcher
  can type the number in a box (digits only, up to 3 so "100" is caught)
  or use [−10] [−5] [−] [box] [+] [+5] [+10] (all 48 × 48). Buttons keep
  the result between 1 and 50 (−10 at 7 → 1, +10 at 45 → 50). An empty
  box or a number outside 1–50 shows "Enter a number from 1 to 50." in red
  at once, and Submit saves nothing. The form and save function both check
  the count. Ordinary resident ride requests still allow 1–6 people.
- Incident details replaces Short description (still required, up to 500
  characters). Hint: "What happened, who needs help, and their condition
  (for example: male, about 30s, not breathing). Write only what the driver
  needs." Placeholder: "What happened, who needs help, and their condition."
- Approximate age is optional: a number or short range such as 30 or 30–40.
  Conscious and Breathing each offer Yes / No / Unknown, initially Unknown.
  For several patients, differing ages/conditions go in Incident details.
- Wide website: three columns for short fields; Incident details beside
  quick facts; Driver beside Vehicle. Narrow screens stack. No smaller text
  or controls; DESIGN.md records this form's column exception.

| Emergency type | Saved `purpose` |
|---|---|
| Medical | Medical / Health |
| Accident / injury | Medical / Health |
| Fire-related | Medical / Health |
| Pregnancy / labor | Medical / Health |
| Other | Other |

The Admin counters query `purpose`. Driver run records already copy it,
so Duty Records group these rides correctly without a driver app change.
Duty Records currently has two ride groups: Medical / Health rides, and
Community rides (all non-medical purposes, including Other).
For Other, `purposeOther` remains "Emergency" as in the original release;
the specific emergency is saved in `emergencyTypeOther`.

Save on the same `transportRequests` record, in the existing transaction:
- Existing: `emergencyType`, `passengerCount` (the incident's patient count),
  title, purpose, route, driver, vehicle, priority, and status.
- New: `emergencyTypeOther`, `approximateAge` (text, blank if unknown),
  `conscious`, `breathing`, and `incidentDetails` (the incident text alone).
- Existing `additionalNotes`: a readable copy of the Other specifics when
  present, approximate age, conscious, breathing, and incident details.
  Existing resident/driver APKs still see these in Notes. No data migration
  and no Firestore rules change.
- Health details stay on the ride record, not on the alert or assignment.
  Existing read access: that resident, assigned driver, Dispatchers, Admins.
- A big incident still creates one ride for one driver/vehicle. The count
  does not mean all patients fit in that vehicle; no multi-vehicle feature.
- Privacy Policy collection/sharing paragraphs now describe emergency health
  information, with an updated date. Website copy updates with Part A;
  installed phone policy copy updates with the next APK.

**Part A test:** dispatcher on local website, resident and driver on existing
phones. Check all five types, required Other specifics, switching away from
Other, 1 → 6 → 16 → 50 (cannot exceed it), age 30 and 30–40, and Yes / No /
Unknown. Submit a test emergency: resident sees the same ride/driver/vehicle
and facts in Request details → Notes; driver sees them in Ride details →
Notes, and can Accept → En route. Check ordinary requests still allow 1–6.
Check Admin purpose counters; after completing a test ride, check Duty
Records. Then test and commit before starting Part B.

Local code checks passed: lint on the three changed code files, Expo web
export, and temporary in-memory checks for limits, controls, validation,
saved facts/Notes, and purpose/Duty Records grouping. No Firebase records
were written by those checks. The user then tested the layout and the real
computer/phone flow (2026-10-05).

### Part B — driver app, needs a new APK (written, waiting for the user's phone test)
Decided (2026-10-05): rides from the form (`emergencyAlertId`) get the title
"Emergency: Medical" (Other: "Emergency: [specifics]"); the Riders box says
"Patients"; a peach box shows approximate age, conscious, breathing, and
Incident details cut at 3 lines (the full text stays in Ride details →
Notes). The Ride details pop-up (app/driver-home.jsx) says "Patients: 3
patients" and "Request: Emergency: Medical" for these rides too. The shared
text rules are in features/driver/utils/driverMissionMapper.js.

Add emergency type, patients, approximate age, conscious, and breathing to
DriverRideCard above Incident details. Read the separate fields saved by
Part A. Older rides fall back to their existing Notes, without requiring
new fields. Ordinary rides keep their current card. No "Why you" line.
Test enlarged phone text and old/new emergency rides before committing and
building. Use the AGENTS.md EAS checklist for the new APK.

## Goal (in simple words)
When a dispatcher taps **Answer** on an emergency alert, the resident's
phone still calls them (no change), and the dispatcher's screen shows an
**Emergency request form**. While they talk, the dispatcher types what is
wrong and where to go, picks a driver and a vehicle, and taps **Submit
request**. That one tap makes a normal ride for the resident, already
given to the driver. The resident sees it in their "Your ride" card, and
the driver gets it like any other ride.

## Sketch (website, wide screen)

```
 SakayNa header (as today: Dispatcher · name · Log out)
 ─────────────────────────────────────────────────────────────────────
  ← Back   Emergency request form              Reference: SKN-AB12CD34
           Fill this in while you are on the call.

 ┌───────────────────────────────────────────────────────────────────┐
 │ Caller information                                                │
 │ Caller name *          Contact number *        Barangay *         │
 │ [Juan Dela Cruz     ]  [0917 123 4567      ]  [Talavera       ▾]  │
 │ Pickup location *                      Landmark (optional)        │
 │ [Talavera Road Crossing           ]    [Near the covered court ]  │
 │ From the resident's GPS · [Open location in Maps]                 │
 │───────────────────────────────────────────────────────────────────│
 │ Emergency details                                                 │
 │ Emergency type *                                                  │
 │ (•) Medical emergency ( ) Accident / injury                       │
 │ ( ) Pregnancy / labor ( ) Other                                   │
 │ Priority *                              Number of patients *      │
 │ (•) Emergency ( ) Urgent ( ) Non-Urgent   [ − ]  1  [ + ]         │
 │ Short description *                                               │
 │ [Male, about 60, chest pain, hard to breathe                   ]  │
 │ The driver and the resident can see this.                         │
 │ Destination / hospital *                                          │
 │ [Toledo City General Hospital                                  ]  │
 │───────────────────────────────────────────────────────────────────│
 │ Driver and vehicle                                                │
 │ Driver * (only Available drivers, nearest first)                  │
 │ ( ) Mark Reyes   [Available]  about 1 km away (location 5 min ago)│
 │ ( ) Ana Cruz     [Available]  distance unknown (no location)      │
 │ Vehicle *                                                         │
 │ ( ) Barangay Van 1 · ABC 123    ( ) Barangay Van 2 · XYZ 789      │
 │───────────────────────────────────────────────────────────────────│
 │ Call information (filled in by itself)                            │
 │ Date received      Time received      Dispatcher                  │
 │ Mon, Oct 5         9:42 AM            Maria Santos                │
 │───────────────────────────────────────────────────────────────────│
 │ [            Submit request  (green, big)           ]             │
 │ [            Cancel          (outline)              ]             │
 │ ⓘ After Submit, the driver gets the ride and the resident sees it │
 │   in their "Your ride" card.                                      │
 └───────────────────────────────────────────────────────────────────┘
```

- On a narrow screen the fields stack in one column.
- DESIGN.md: section titles in Hall Green (red stays for the emergency
  itself), corners 16/24, no shadows, sentence case, every color with a
  word. Driver and vehicle choices are outlined choice rows, not cards
  inside the card. Submit on top, Cancel underneath (one-column rule).
- **Left out of the reference on purpose:** ETA, "Vehicle type needed",
  "Call status", the extra "Notes" box, and the "ER-2024-…" ID style (we
  keep our `SKN-…` reference so every screen and the History search work).

### Active emergency card (top of the dispatcher page)

```
 Before Submit                          After Submit
 ┌ Active emergency · Juan Dela Cruz ┐   ┌ Active emergency · Juan Dela Cruz ┐
 │ Resident's number: 0917 123 4567  │   │ Resident's number: 0917 123 4567  │
 │ Barangay / place: ...             │   │ Barangay / place: ...             │
 │ [Open location in Maps]           │   │ ✓ Ride SKN-AB12CD34 created ·     │
 │ [Open emergency form]  (green)    │   │   Mark Reyes · Barangay Van 1     │
 │ [End emergency]        (outline)  │   │ [End emergency]        (outline)  │
 └───────────────────────────────────┘   └───────────────────────────────────┘
```

## What fills itself in
| Field | Comes from | Can the dispatcher change it? |
|---|---|---|
| Caller name | the alert (`residentName`) | yes (typo, or a family member) |
| Contact number | the alert (`residentPhone`) | yes; must be a real PH mobile number |
| Barangay | the resident's profile (`users/{id}.barangay`). The alert's `pickupLocation` stops being the barangay once the GPS address arrives, so the profile is the safe source | yes, dropdown (same Toledo City list) |
| Pickup location | the GPS address if sent, else the barangay. If the GPS arrives after the form opened and the dispatcher hasn't typed in this box, it fills in by itself | yes |
| Landmark | empty (optional) | yes |
| Date / time received | the alert's `createdAt` | no |
| Dispatcher | the logged-in dispatcher's name | no |
| Reference | made when the form opens (nothing is saved yet) | no |

## How it fits our current ride fields
Submit saves a normal `transportRequests` document, so the driver,
resident and admin screens show it with **no changes to their code**:

| Ride field | Value | Who sees it |
|---|---|---|
| `residentId`, `residentName`, `residentPhone` | from the alert | resident's "Your ride" card and History find it by `residentId` |
| `reference` | `SKN-` + first 8 letters of the id (same as the resident form) | everyone |
| `requestType` | `"Emergency Request"` (already in constants/app.js) | admin type label |
| `purpose` | Medical emergency, Accident / injury, Pregnancy / labor → `"Medical / Health"`; Other → `"Other"` (`purposeOther: "Emergency"`) | admin counts and filter, resident History filter, the driver's DTR medical count |
| `emergencyType` | the dispatcher's choice, e.g. `"Medical emergency"` | the driver's ride card title (`DriverRideCard` reads it first) |
| `title` | `"Emergency: Medical emergency"` | resident "Ride for", admin "Ride for", driver History |
| `priorityLevel` and `level` | Emergency (default), Urgent or Non-Urgent: our existing names (no "Critical") | admin priority counts, the assignment |
| `timing` / `scheduledFor` | `"asap"` / `null` | "As soon as possible" everywhere |
| `ridingFor`, `passengerName`, `contactNumber` | `"self"`, caller name, contact number | driver's Passenger part and Call button |
| `passengerCount` | number of patients (1 to 6) | "People riding: 1 person" |
| `barangay`, `pickupLocation`, `pickup` | barangay; address; GPS spot (latitude, longitude) if sent | driver's map pin, resident From line |
| `pickupDetails` | landmark | "Landmark" lines |
| `destination` | hospital | resident To line, driver |
| `additionalNotes` | the short description | driver "Notes", resident Request Details "Notes" |
| `assistance` | `[]` | "Help needed: None" |
| `status`, `missionStatus` + driver fields | `"Assigned"` + the same driver/vehicle fields as the Assign window | resident "Driver assigned", driver gets the ride |
| `dispatcherName`, `dispatcherOfficePhone` | the dispatcher's name; the alert's `dispatcherPhone` | resident Request Details "Dispatcher" (already coded, was always empty: Resident doc #15) |
| new: `emergencyAlertId`, `createdBy`, `alertReceivedAt` | the alert id, the dispatcher's uid, the alert's `createdAt` | the rules check (below) and our records |

It never shows in the dispatcher's Pending queue, because it is already
"Assigned". The driver's card in the Drivers column shows "Has a ride
waiting to be accepted", as after any assignment.

## The rules change (firestore.rules)
Today only an Active resident can create a ride, and only for themselves.
We add one more way in: **a dispatcher may create a ride for a resident,
but only from an emergency alert that this same dispatcher answered, for
that same resident.**

```
// A dispatcher may create a ride for a resident, but only from an emergency
// alert this same dispatcher answered, for that same resident
// (emergency-request-form-plan.md).
function dispatcherRideFromAlertIsSafe() {
  return isDispatcher()
    && request.resource.data.createdBy == request.auth.uid
    && request.resource.data.get("emergencyAlertId", "") is string
    && request.resource.data.get("emergencyAlertId", "").size() > 0
    && get(/databases/$(database)/documents/callSessions/$(request.resource.data.emergencyAlertId)).data.dispatcherId == request.auth.uid
    && get(/databases/$(database)/documents/callSessions/$(request.resource.data.emergencyAlertId)).data.residentId == request.resource.data.residentId;
}

match /transportRequests/{requestId} {
  ...
  allow create: if (isActiveResident() && request.resource.data.residentId == request.auth.uid)
    || dispatcherRideFromAlertIsSafe();
```

- It does **not** check the alert is still "connected": the resident often
  taps Done right after the call, while the dispatcher is still typing.
- Admins can't do this (they don't answer alerts).
- What it can't check: the other fields. That's not new: dispatchers can
  already change any field of any ride (`allow update: if isStaff()`).
- No other rule changes. Assignments, vehicles and alerts already allow
  dispatchers.
- Deployed the safe way: commit → compare live vs committed → deploy →
  compare again, `--project sakayna-571e8`.

## What happens on Submit (one save, all or nothing)
A new function `createEmergencyRide` next to `assignDispatcherRequest` in
features/dispatcher/services/dispatcherAssignmentService.js, built the same
way (one transaction = everything is saved together, or nothing is):
1. Read the driver again: still "Available"? If not: "Mark Reyes is no
   longer available (On break). Choose another driver."
2. Read the alert: does it already have a ride? If yes: "A ride was already
   made for this alert (SKN-…)." (Stops a double Submit making two rides.)
3. Save the new ride (fields above), already "Assigned".
4. Save the `driverAssignments` document (same fields as the Assign window).
5. Mark the vehicle "Assigned".
6. Link the alert: `linkedRequestId`, `linkedRequestReference`,
   `emergencyType` (and `linkedDriverName`, `linkedVehicleName` for the
   card's "Ride created" line).

Decided while building (Step 4, 2026-10-05):
- The GPS pin is saved on the ride only if the dispatcher kept the GPS
  address as the pickup. A typed address saves no pin, so the driver's map
  never points to the wrong place.
- Back and Cancel can't be tapped while Submit is saving (the save would
  still finish, so "nothing saved" would not be true).

## The alert and the Active emergency card after Submit
- The alert **stays "connected"**. Its status does not change, so the
  resident's pop-up is not touched mid-call (still **Call … again** and
  **Done**). That is also why **no new APK** is needed.
- The Active emergency card shows "✓ Ride SKN-… created · driver ·
  vehicle", and **Open emergency form** goes away (one ride per alert).
- It closes as today: the resident taps Done, or the dispatcher taps End
  emergency.
- Side effect: the Admin's Emergency Calls list shows "Type: Medical
  emergency" instead of "Not specified" (half of Resident doc #9).
- The resident's "Your ride" card updates by itself under the pop-up; after
  Done they see the driver, vehicle and the Call driver button. They can
  cancel it like any Assigned ride (the driver is told, as today).

## If the dispatcher closes the form halfway
- **Cancel or ← Back:** nothing is saved. Back to the normal dispatcher
  page. The Active emergency card is still there, with **Open emergency
  form**: it opens a fresh form (caller information filled in again; what
  was typed is gone).
- **Browser closed, page reloaded, internet lost:** the same. Nothing is
  saved until Submit. After reopening, the card and its button are back.
- **Submit fails** (driver went on break, no internet): a red message in
  the form; nothing was saved; what was typed stays. Pick another driver,
  tap Submit again.
- **The resident taps Done while the dispatcher is typing:** the form stays
  open and Submit still works. Limit: the Active emergency card is gone, so
  if the form is then closed it can't be reopened (Known-Issue).
- **A second alert rings while the form is open:** its pop-up shows on top
  as today. Answering it does **not** replace the open form; the second
  alert gets its own **Open emergency form** button on its card.

## Files
- New: `features/dispatcher/components/EmergencyRequestForm.jsx` (the form;
  app/dispatcher-home.jsx is already 1,400+ lines).
- `app/dispatcher-home.jsx`: which alert's form is open; Answer opens it;
  the page shows the form instead of the queue / map / drivers while it is
  open (header stays); the card button and "Ride created" line. The form
  uses the same driver/vehicle memory as the Assign window
  (`selectedDriver`, `assignableVehicles`), so no vehicle rules are copied.
- `features/dispatcher/services/dispatcherAssignmentService.js`:
  `createEmergencyRide`.
- `firestore.rules`: the helper + the create line.
- Notes: this plan, Skills/resident.md (5.3, 4.4), Known-Issue.md,
  PRODUCT.md, README.md.

## Steps (one at a time: build → test → commit → next)
Testing: dispatcher on the website on the computer (`npx expo start --web`),
resident on the phone (demo-ready-13 APK), a driver on a second phone.

### Step 1 — The form opens (look only, nothing saved)
- Answer → form opens with caller information and call information filled
  in; emergency details can be typed; Cancel / ← Back go back; Active
  emergency card gets **Open emergency form**. Submit shows the red "fill
  this in" messages but saves nothing yet.
- Test: alert from the phone → Answer → phone still counts down and calls;
  website shows the form with the right name, number, barangay, GPS
  address; Cancel → card → Open emergency form → fresh form.

### Step 2a — Driver and vehicle choice
- Available drivers only; choosing one shows that driver's vehicles (same
  list as the Assign window).
- Test: a punched-in driver shows; one on break doesn't; vehicles match the
  Assign window for the same driver.

### Step 2b — "about 2 km" (CAN BE DROPPED)
- Straight-line distance from the resident's GPS to the driver's last known
  location, rounded ("less than 1 km", "about 2 km"), with how old the
  location is; nearest first. No GPS on either side → "distance unknown".
- Test: driver taps Punch in at a known place → the number looks right.

### Step 3 — Rules change, deployed the safe way
- Test (nothing looks different yet): resident sends a normal ride request
  → works; dispatcher assigns it → works; emergency alert + Answer → works.

### Step 4 — Submit saves
- `createEmergencyRide`, the alert link, the "Ride created" line.
- Test: Submit → resident's "Your ride" card shows the driver and vehicle
  (after Done) and Request Details shows Ride for, Notes, Dispatcher; driver
  phone gets the ride, Accept → En route works, the map pin is the GPS spot;
  admin sees it (Emergency Request, Medical / Health, priority); Submit
  again → "already made"; driver on break before Submit → red message,
  nothing saved; resident taps Done first → Submit still works.

### Step 5 — Notes
- Skills/resident.md, Known-Issue.md (the limits above), PRODUCT.md,
  README.md, this plan.

### If time runs out
- Drop **2b** first (the form works without distance).
- Steps 1, 2a, 3, 4 are the feature; don't release only part of them (a
  form whose Submit saves nothing would confuse testers). Until Step 4 is
  done and tested, nothing on the live website changes, because only
  master is touched.
- Step 5 can be short notes if needed.

## Release
- Rules first (Step 3), then the website (master → main → Vercel).
- **No new APK and no new development build**: only website code and
  rules change. Old APKs (resident and driver) read the same ride fields.
- No new packages (the barangay dropdown uses react-native-element-dropdown,
  already in the project).
- Privacy Policy: no change (the same information as a resident-made ride;
  the resident's GPS spot was already shared with dispatchers in the alert).

## Releases
- 2026-10-05: **Emergency request form** (website + rules; no APK).
  - Rules: deployed in Step 3 the safe way (live rules matched the
    committed file before; dry run compiled; deployed to sakayna-571e8;
    live rules matched 269a2b1 after). Ruleset
    6c8642c6-1bd7-48aa-8e03-4fd85ccdadb2.
  - Website: master → main → Vercel, fast-forward f020676..49482ea (also
    carried ae47f44 and e5dd542, the demo-ready-13 tester message and
    plans). Live checks passed: Vercel "Ready", Answer opens the form
    while the phone still calls, distance line, Submit → "Ride created"
    on the card, the resident's "Your ride" card shows the driver, the
    driver gets the ride, normal Request a Ride and Assign still work.
  - No new APK and no new development build. Testers keep demo-ready-13.
    No new tag (the tags follow APK builds).
  - Tester message: tester-message.md, for dispatchers.
