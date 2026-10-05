# Known Issues

Problems found but not fixed yet, newest at the top. Fixed items are at the bottom.

Last checked against the app: Oct 5, 2026 (after emergency-request-form-plan.md: the dispatcher's Emergency request form).

More resident problems, with file and line numbers, are listed in
Skills/resident.md section 6.

---

## Open

### Emergency request form: limits

- **Found:** Oct 5, 2026 (emergency-request-form-plan.md).
- **What it is:**
  - If the resident taps **Done** and the dispatcher then closes the form
    without submitting, the form can't be opened again: the Active
    emergency card (with its **Open emergency form** button) is gone
    once the alert ends. While the form stays open, Submit still works.
  - Cancel, Back, closing the browser or reloading the page throw away
    what was typed (the caller information fills in again).
  - "About 2 km" is a straight line from the driver's **last known**
    location (where they last tapped a step), not the road distance, and
    the location can be old (its age is shown). No resident GPS = no
    distances.
  - The GPS pin is saved on the ride only if the dispatcher kept the GPS
    address as the pickup; a typed address saves no pin.
  - With no internet, Submit can stay on "Saving…" for a while before the
    red "could not be saved" message (no time limit, like resident #11).
  - firestore.rules checks that the alert was answered by this
    dispatcher for this resident, but not the other fields. That is not
    new: dispatchers can already change any field of any ride.
- **What to do:** keep the form open until Submit. If it was lost, the
  resident can still send a normal Request a Ride.
- **Status:** Open. Fine for the Capstone demo.

### Auto call after a dispatcher answers: when it doesn't call

- **Found:** Oct 4, 2026 (emergency-auto-call-plan.md).
- **What it is:** After a dispatcher answers, the resident's phone calls
  them after a 3-second countdown. It is a normal phone call from the
  resident's own SIM, so with no load or no signal it fails like any
  call. It also doesn't call:
  - on the website (a browser can't place a phone call),
  - if SakayNa is in the background, or the resident leaves the app
    during the countdown,
  - on APKs before demo-ready-12 (they still need a tap on Call),
  - if there is no number at all: the dispatcher has no account phone
    and no Operational phone, and no office number is saved.
- Older APKs (demo-ready-12 and before) on the office fallback still
  say "Calling {dispatcher name}" even though the office phone rings.
- **What to do:** the **Call {name}** button stays on the pop-up in all
  of these cases; the office number is in the ☰ menu.
- **Status:** Open. Fine for the Capstone demo.

### "Show on map": the location can be old, rough, or missing

- **Found:** Oct 4, 2026 (driver-location-plan.md).
- **What it is:** A driver's location is saved only when they tap Punch
  in, Accept, En route, Arrived or Picked up (never in the background),
  so it is a *last known* place, not a live one. Also:
  - A driver who forgets to punch out keeps their last location visible
    to dispatchers until they punch out.
  - If the driver chose "Approximate" in Android's location pop-up, the
    pin can be a few km off.
  - Drivers on the website or on an APK before this release never share
    a location ("No location shared.").
  - On a narrow screen the map is above the driver list, so the
    dispatcher scrolls up after tapping Show on map.
- **What to do for now:** read the "5 min ago (Arrived)" line before
  trusting the pin; call the driver if it is old.
- **Future work:** live tracking (driver-location-plan.md, "Not now").
- **Status:** Open. The light version on purpose.

### Driver location: what firestore.rules can't check

- **Found:** Oct 4, 2026 (driver-location-plan.md, "What the rules can't
  check").
- **What it is:** The rules check that only the driver saves their own
  location, only while on duty, with one of the five steps and
  Firestore's clock, and that only dispatchers can read it. But they
  can't check that the latitude and longitude are real (a tampered app
  could send a fake place), or that the step matches what the driver
  just did.
- **Status:** Open. Fine for the Capstone (only approved drivers can
  save a location).

### A van reported with "Vehicle problem" can still be assigned

- **Found:** Oct 4, 2026 (driver-pages-plan.md Step 2a).
- **What it is:** When a driver sends "I can't do this ride" with
  "Vehicle problem", the van is freed ("Available") like after a
  decline. The dispatcher's banner names the van, but the Assign window
  still offers it (and picks the first van by itself if the dispatcher
  doesn't choose one).
- **What to do for now:** the dispatcher picks another van; the admin
  can add a maintenance record in Operations.
- **Future work:** keep that van out of the Assign window until an admin
  checks it (driver-pages-plan.md, "Not now").
- **Status:** Open. Fine for the Capstone demo.

### Drivers on an older APK still see Decline

- **Found:** Oct 4, 2026 (driver-pages-plan.md Step 2a).
- **What it is:** APKs before demo-ready-11 still have the Decline button.
  It still works: the ride goes back to the dispatcher, who sees the
  banner and the reason, but not the driver's name, and there is no
  warning on the driver's card and no line in the admin's Inability
  reports.
- **What to do:** drivers install the newest APK.
- **Status:** Intended (old data and code are kept on purpose).

### After pickup, a problem can only be reported by phone

- **Found:** Oct 4, 2026 (driver-pages-plan.md, answer 1).
- **What it is:** Once the rider is on board, "I can't do this ride" is
  gone and the driver taps "Call dispatch" (the office number). If the
  admin has not saved an office number (Operations → operational
  settings), the driver only sees a sentence telling them to call the
  barangay office. Nothing is saved in the app about the problem.
- **Status:** Open. Left out on purpose (a ride with the rider on board
  needs a person to decide).

### Drivers on an old APK can't get rides (on purpose)

- **Found:** Oct 4, 2026 (driver-duty-plan.md, Step 8).
- **What it is:** Since the duty status release, a dispatcher can only
  give a ride to a driver who is punched in ("Available"). This is also
  checked by firestore.rules. Only the new app (preview APK
  demo-ready-8 or later) and the website have the Punch in button. A
  driver on an older APK shows as "Off duty: not punched in" and can't be
  assigned.
- **What to do:** drivers install the new APK, or log in as driver on the
  website. Emergency alerts are not affected: old APKs still send them.
- **Status:** Intended.

### A driver who forgets to punch out stays "Available"

- **Found:** Oct 4, 2026 (driver-duty-plan.md).
- **What it is:** Nothing closes a shift by itself (there is no server to
  do it). If a driver goes home without tapping Punch out, dispatchers
  still see them as "Available", and the admin's Duty Records show
  "Still on duty" with the hours still counting. The next punch out ends
  that long shift.
- **Also:** a shift is read up to the end of the day after it started.
  A shift left open longer than that shows as "Still on duty".
- **What to do for now:** the driver punches out (the record can't be
  edited afterward, on purpose).
- **Future work:** auto-closing forgotten shifts, admin corrections
  (driver-duty-plan.md, "Not now").
- **Status:** Open. Fine for the Capstone demo.

### "App closed" only shows when the app closes normally

- **Found:** Oct 4, 2026 (driver-duty-plan.md, Step 5).
- **What it is:** The dispatcher's "Available · app closed" warning uses
  the driver's `presence`, which the driver's app saves when it opens and
  closes. If the app crashes or the phone dies, it has no chance to save
  "Offline", so the driver still looks "app open". This is a simple
  stand-in for a real "Unreachable" status, which would need a regular
  "I'm still here" signal (heartbeat).
- **Status:** Open. Left out on purpose (future work).

### Duty status: what firestore.rules can't check

- **Found:** Oct 4, 2026 (driver-duty-plan.md, "What the rules can't
  check").
- **What it is:** The rules check that every status change is allowed
  (for example, no punch out during a run), that times come from
  Firestore's clock, and that duty records are never edited or deleted.
  But they can't check that "On a run" matches a real accepted ride, or
  that a driver with a ride waiting to be accepted doesn't start a break.
  The app checks these two things, not the rules.
- **Status:** Open. Fine for the Capstone (only approved drivers can
  change their own status).

### Cancelled ride: driver stays "busy" until the driver's app is opened

- **Found:** Sept 30, 2026, while fixing Skills/resident.md issue #1.
- **What it is:** When a resident cancels a ride that was still
  "Assigned", the driver's app now frees the driver and the vehicle by
  itself and tells the driver (features/driver/services/
  driverMissionService.js, `clearCancelledRide`). But this only happens
  while the driver's app is open, or the next time it opens. Until then,
  the dispatcher still sees that driver as "Handling" the ride and the
  vehicle as taken.
- **Optional follow-up:** a "Free driver" button on the dispatcher screen.
  No Firestore rules change is needed (a Dispatcher may already update
  driverAssignments and vehicles). The dispatcher screen would need to
  watch the rides behind the busy drivers' assignments, show the button
  when one is "Cancelled", and run the same `clearCancelledRide`.
- **Status:** Open. Left out on purpose to keep the fix small.

### Scheduled rides: no reminders, and assigning early keeps the vehicle busy

- **Found:** Sept 29, 2026, while planning "Schedule for later"
  (resident-overhaul-plan.md).
- **What it is:** Nobody gets a reminder when a scheduled ride is near (the
  app has no notifications). The dispatcher watches the list. If the
  dispatcher assigns a scheduled ride too early, the driver sees it as their
  current ride right away, and the vehicle stays busy until the trip ends.
- **What the app does about it:** The dispatcher's assign window warns when
  the ride is more than 2 hours away, and the tag turns red ("Scheduled time
  passed") if nobody assigned it in time.
- **Status:** Left out on purpose for the Capstone.

### Admin tools are still city-wide — MUST FIX BEFORE A REAL PILOT

- **Found:** Sept 29, 2026 (login-overhaul-plan.md, steps 7 and 10).
- **What it is:** The Resident Verification and Driver Applications lists
  only show the admin's own barangay. But the older Users and Operations
  tools still work for every barangay. Any admin can set any resident
  "Active", or any driver "Approved", from any barangay there, skipping the
  document review.
- **Also:** If an admin changes a Pending resident's barangay in Users →
  Edit, the resident's verification stays with the old barangay's admin.
- **Also (Oct 4, 2026):** the new Duty Records (driver DTR) list shows
  the drivers of every barangay.
- **Status:** Open. Fine for the Capstone demo (trusted test admins).

### A barangay with no admin leaves its people waiting

- **Found:** Sept 29, 2026 (login-overhaul-plan.md).
- **What it is:** Residents and drivers are approved only by the admin of
  their own barangay. If that barangay has no admin, they stay "Pending".
- **Status:** Open. Each barangay that joins needs an admin (set in the
  Firebase Console).

### The same person via Google and via email becomes two accounts

- **Found:** Sept 28, 2026 (login-overhaul-plan.md).
- **What it is:** Signing up with email, then later tapping "Continue with
  Google" with the same Gmail, may create a second account, or replace the
  password login if the email was never verified.
- **Status:** Open.

### Document photo links are public

- **Found:** Sept 29, 2026 (login-overhaul-plan.md).
- **What it is:** Proof-of-residency and driver document photos are stored
  in Cloudinary as web links. SakayNa only shows these links to the owner
  and their barangay's admin, but anyone who has the exact link can open the
  photo.
- **Status:** Open. Written in the Privacy Policy draft. Use sample
  documents, not real IDs, while testing.

### Free map server has a fair-use rule

- **Found:** Sept 29, 2026, while planning the map-first resident home
  (resident-overhaul-plan.md).
- **What it is:** The maps (components/LeafletMap.jsx) load their pictures
  from the free OpenStreetMap server and look up addresses with the free
  Nominatim server. Both have a fair-use rule: fine for small projects,
  but they can slow down or block an app that sends too many requests. The
  resident home screen is now a map, so every resident loads map pictures
  each time they open the app.
- **Fine for:** the Capstone and a small pilot.
- **Before a real city rollout:** switch to a map provider plan (a paid or
  sponsored map service).
- **Status:** Not a bug yet. Nothing to fix for the Capstone.

### Emergency alerts can get stuck "ringing"

- **What happens:** If the app crashes or is closed while an alert is
  ringing, the alert stays "ringing" in Firestore forever.
- **Found:** During testing, a crash left test alerts stuck. I cleared
  them manually in the Firebase Console.
- **Idea for fix:** Alerts should automatically expire (for example,
  after a few minutes with no answer).
- **Status:** Partly fixed (commit cfc717b): dispatchers stop seeing stuck
  alerts after 2 minutes. Firestore still says "ringing", and the Admin
  Emergency Calls list still shows them as "Ringing — Unanswered".
  Important before the pilot.

---

## Fixed / done

### Theme plan (was a future feature, not a bug)

- **Decided (Sept 28, 2026):** the app uses light mode, not dark.
- **Landing page, Get Started sheet and Choose Role:** Always light. They
  do NOT change with the phone's theme or the app's Dark / Light switch.
  This is on purpose.
- **Rest of the app:** Always light (lib/theme.js). Dark mode was removed
  on 2026-10-03 for the redesign (the Dark / Light switch in resident
  Settings, driver Settings and the admin menu). It can come back after
  the demo as its own plan; the old code is in git history.
- **Status:** Done (login-overhaul-plan.md step 2b). Nothing else needs
  building.

### 1. Emergency call error on Android

- **Date found:** [Sept 26, 2026]
- **Status:** Fixed (Sept 27, 2026, commit f827299). The pop-up's
  centering moved into the ScrollView's contentContainerStyle.
- **Steps:**
  1. Log in as Resident on the Android development build
  2. Tap "Send emergency alert" → "Send alert"
- **Expected:** [The alert is sent and I can call]
- **What happened:** [A Render Error Alert Popped out]
- **Error message:** [ERROR  [Invariant Violation: ScrollView child layout (["alignItems"]) must be applied through the contentContainerStyle prop.] 

Call Stack
  invariant (node_modules\invariant\browser.js)
  render (node_modules\react-native\Libraries\Components\ScrollView\ScrollView.js)
  callRender.reactStackBottomFrame (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  finishClassComponent (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  updateClassComponent (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  beginWork (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  runWithFiberInDEV (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  performUnitOfWork (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  workLoopSync (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  renderRootSync (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  performWorkOnRoot (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  performSyncWorkOnRoot (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  flushSyncWorkAcrossRoots_impl (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  processRootScheduleInMicrotask (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  scheduleMicrotask$argument_0 (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)]
- **Started after:** the direct phone call change (not sure if
  this change caused it or it was already there)
- **Priority:** HIGH, because emergency alerts are the most
  important feature
