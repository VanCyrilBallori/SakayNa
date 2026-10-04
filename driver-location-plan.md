# Driver Location Plan ("Show on map") — light version

**Status: Steps 1–3 DONE and tested on the phone, Step 4 paperwork written (2026-10-04). Release (APK + website) not done yet.**
- Step 1 rules: commit 288e164, deployed. Before: live rules matched
  commit 09c0f46. After: live rules matched firestore.rules (ruleset
  0f846354-c72c-44bc-b46c-a99e83e40796).
- Step 2 driver saves location: commit 5618f97.
- Step 3 dispatcher "Show on map": commit 1aacad2.
Demo freeze: around Oct 8–9.

## Goal (in simple words)
A groupmate's request: on a driver card, the dispatcher taps **Show on
map** and the Live Map zooms to where that driver is.

Light version only: the driver's phone saves its location **only at the
moment the driver taps** Punch in, Accept, En route, Arrived or Picked
up while on duty. **Never in the background.** The dispatcher sees
"Last known location: 5 min ago (Arrived)".

## Our setup
- Firebase JS SDK only (Auth + Firestore). No server, no Cloud Functions.
- `expo-location` is already in the app, and app.json already has the
  normal "while using the app" location permissions (no background
  permission). **No new package, no app.json change, so no new
  development build.** Testers need a new preview APK at the end, like
  every release (the app has no over-the-air updates).
- Security comes from firestore.rules. Times come from
  `serverTimestamp()` / `request.time`, never the phone's clock.

---

## Where the data lives

New collection `driverLocations/{driverUid}`: **one document per
driver**, like a sticky note.

| Field | Example |
|---|---|
| `latitude`, `longitude` | 10.3774, 123.6386 |
| `step` | "Punch in", "Accepted", "En Route", "Arrived" or "Picked Up" |
| `at` | `serverTimestamp()` |

- Each step **replaces** the note. There is no history of past places,
  only the latest one.
- **Punch out erases it.**
- Not on `users/{uid}`, so the rules for it are short and clear, and the
  rest of the profile rules don't change.

## Decisions (2026-10-04)
1. **Only dispatchers** can read driver locations (and the driver their
   own). Not admins, not residents. The Privacy Policy says so.
2. The ride step never waits for GPS. Location is saved *after* the
   action succeeds. GPS off, slow (gives up after about 8 seconds) or
   not allowed: the action still works, the note just isn't updated.
3. Fresh positions only: a GPS reading at most about 1 minute old (the
   resident's code accepts 5 minutes; that stays the same for residents).
4. The permission is asked at **Punch in only**, never in the middle of a
   ride.

---

## Rules change (firestore.rules)

New collection, never touched by old code, so **safe to deploy at any
time** (no release order needed, unlike duty Part B).

```
match /driverLocations/{driverId} {
  allow read:   if isDispatcher() || (signedIn() && request.auth.uid == driverId);
  allow create, update: if signedIn() && request.auth.uid == driverId
    && isApprovedDriver()
    && (driver's dutyStatus is not "Off duty")
    && only the fields latitude, longitude, step, at
    && latitude and longitude are numbers on the globe
    && step is one of the 5 steps
    && at == request.time;
  allow delete: if signedIn() && request.auth.uid == driverId;
}
```

### What the rules can't check (for the defense)
- That the coordinates are real. A tampered app could send a fake place.
- That the step name matches what the driver just did.

---

## What the driver will be asked (permission)
- **When:** the first time they tap **Punch in**, *after* the punch in is
  saved.
- **What they see:** Android's own pop-up, "Allow SakayNa to access this
  device's location?" with While using the app / Only this time / Don't
  allow. Android doesn't allow our own sentence there, so the Off duty
  card gets one line: "When you punch in, SakayNa asks for your
  location. It is saved only when you tap Punch in, Accept, En route,
  Arrived or Picked up. Never in the background."
- **Says no:** everything still works; the dispatcher sees "No location
  shared."
- **"Only this time":** may be asked again at the next Punch in. After
  two "Don't allow", Android stops asking by itself.
- **"Approximate":** the pin can be a few km off.

---

## Steps (one at a time: build → test on phone → commit → next)

### Step 1 — Rules [Rules]
- Files: firestore.rules only.
- Deploy the safe way (memory: rules-deploy-check): commit → download
  live rules and compare with the last deployed version (commit 09c0f46)
  → deploy with `--project sakayna-571e8` → download again and compare.
- **Test (nothing old broke):** driver punches in, takes a break, resumes,
  accepts and completes a ride, punches out; dispatcher assigns a ride;
  resident requests a ride; emergency alert still rings.

### Step 2 — Driver saves location
- Files: new `features/driver/services/driverLocationService.js` (read
  the location once, save the note; erase it), driverDutyService.js
  (Punch in saves, Punch out erases), driverMissionService.js (Accept,
  En route, Arrived, Picked up save), DriverDutyCard.jsx (ask at Punch
  in + the one explaining line), useCurrentLocation.js (one optional
  "how old is too old" number; residents keep 5 minutes).
- Punch out still works even if erasing the note fails (the dispatcher
  hides Off duty drivers' notes anyway).
- **Test:** Punch in → Android pop-up → allow → Firebase Console:
  `driverLocations/{uid}` with step "Punch in". Accept, En route,
  Arrived, Picked up → the step and time change each time. Punch out →
  the document is gone. Again with "Don't allow": all steps still work,
  no document.

### Step 3 — Dispatcher [UI]
- Files: app/dispatcher-home.jsx (read the notes; line + button on the
  driver card), components/LeafletMap.jsx (optional driver pin, zoom to
  it).
- Driver card: "Last known location: 5 min ago (Arrived)" and a **Show
  on map** button, only when the driver is on duty and has a note.
  Otherwise "No location shared."
- The button must also work on greyed-out cards (a driver "On a run"
  can't be assigned, but that's when the dispatcher wants to find them).
  It gets its own tap area.
- The pin label uses a clock time ("Arrived, 2:14 PM"), not "5 min ago",
  so the map doesn't reload every 10 seconds.
- Tapping a request in the queue clears the driver pin.
- **Test (dispatcher on the website, driver on the phone):** after
  Arrived, the card says "… (Arrived)"; Show on map zooms to the driver;
  works on an "On a run" card; tap a request: back to the ride pins;
  punch out: the line and button go away.

### Step 4 — Paperwork + release
- Privacy Policy (app/privacy.jsx):
  - Location paragraph: "…or, for drivers, when you tap Punch in,
    Accept, En route, Arrived or Picked up."
  - "When you work as a driver": your phone's location (latitude and
    longitude), saved only at the moment you tap one of those steps,
    with that step and the time. Never in the background. Only the
    latest one is kept, each step replaces the last, and it is erased
    when you punch out. You can still work if you don't allow location.
  - Who sees it: "Dispatchers see a driver's last saved location and
    when it was saved, so they can find the nearest driver.
    Administrators and residents do not."
  - "Last updated" date.
- Known-Issue.md: the limits below.
- README.md collections table: `driverLocations` row. PRODUCT.md:
  Dispatcher = "Show on map".
- Release: preview APK (CLAUDE.md "EAS build checklist"), then website
  (CLAUDE.md "How to update the website"). Rules are already live.

## Limits (for Known-Issue.md)
- A driver who forgets to punch out keeps their last location visible
  until they do.
- "Approximate" location can be a few km off.
- Drivers using the website (or an old APK) don't share a location.
- On a narrow screen the map is above the driver list, so the dispatcher
  scrolls up after tapping Show on map.

## Not now (future work)
- Live tracking or background location.
- Location history or a route trail.
- Location from the website (browser GPS).
- Distance to the pickup / "nearest driver" sorting.
