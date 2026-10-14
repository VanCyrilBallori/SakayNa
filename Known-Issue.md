# Known Issues

Problems found but not fixed yet, newest at the top. Fixed items are at the bottom.

APK baseline checked October 11, 2026, against **demo-ready-16** at **39e4583**. The owner tested this APK on their phone; its EAS fingerprint says **matches**. Task 1.1 was updated October 13: the owner confirms the Step 1 website release at **b62c724**, deployment of rules **c92f5a1**, and the test results recorded in architecture-review.md. General APK testing does not close the other open issues below.
Task 1.3 was updated October 14: owner-reported deployment/test results and the remaining log-test limits are recorded below and in architecture-review.md.
Task 1.2 was updated October 14: staff must be Active (rules `d464a70`); results and remaining limits are recorded below and in architecture-review.md.

More resident problems, with file and line numbers, are listed in
Skills/resident.md section 6.

---

## Open

### Refused staff: sign-in still works, and some screens are unclear

- **Recorded:** October 14, 2026, after Task 1.2 (`d464a70`).
- **What it is:** the database now refuses staff who are not Active, but a
  refused staff member can still sign in to Firebase. Blocking sign-in needs
  a server. The screens for Pending, Rejected or blank staff still show a
  spinner or empty lists. Deactivated staff already see "Account disabled".
- **Next step:** the route gate fix (`lib/roles.js`, `AuthRouteGate.jsx`).
- **Status:** Open. No data is exposed: the database refuses these accounts.

### Staff accounts made by hand: barangay spelling must match exactly

- **Recorded:** October 13, 2026, during Task 1.1.
- **What it is:** a Dispatcher or Admin profile made by hand in Firebase Console
  can have a missing or mistyped barangay. `DaanLungsod`,
  `Daanlungsod, Toledo City` and `Daanglungsod, Toledo City` are different values.
- **Effect:** Task 1.1's strict rule refuses Admin management when the target's
  barangay is missing or differs from the Admin's barangay. Admin accounts are
  view only regardless of their barangay. The Admin's barangay must also be
  non-empty when creating a Dispatcher.
- **What to do:** the owner checks and fixes the saved Console value to match
  the intended barangay exactly. The main test Admin uses
  `Daanglungsod, Toledo City`. Keep the rules strict.
- **Status:** data-entry risk remains open. No live data was changed by this
  documentation update.

### New Dispatcher: changing the temporary password is not forced

- **Found:** Oct 6, 2026 (Admin Operations → Add Dispatcher).
- **What it is:** The Admin picks a temporary password and gives it to
  the new Dispatcher. The success message reminds the Admin to tell them
  to tap **Forgot password?** on the login screen and set their own, but
  nothing makes them do it. Until they do, the Admin also knows their
  password.
- **What to do for now:** give the temporary password privately, and
  check with the Dispatcher that they changed it.
- **Future work (option B):** after the first login, show a "Set a new
  password" screen before Dispatcher home (a `mustChangePassword` flag on
  the profile, cleared after the change).
- **Status:** Open. Fine for the Capstone demo.

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
  - Emergency form Part A (committed and tested, Oct 5): the
    dispatcher can record 1–50 patients, but Submit still creates one
    assignment to one driver and vehicle. This is the incident count, not
    a promise that everyone fits in one vehicle. Different patients'
    conditions need to be described in Incident details.
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
  - Drivers on the website or on APKs before demo-ready-12 never share
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
  Firestore's clock. Dispatchers and the driver themselves can read it;
  Admins and Residents cannot. But the rules
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

### After pickup, an immediate problem is handled by phone

- **Found:** Oct 4, 2026 (driver-pages-plan.md, answer 1).
- **What it is:** Once the rider is on board, "I can't do this ride" is
  gone and the driver taps "Call dispatch" (the office number). If the
  admin has not saved an office number (Operations → operational
  settings), the driver only sees a sentence telling them to call the
  barangay office. That phone call does not create an incident report.
  At completion, the driver can separately save optional Issues encountered
  text on the assignment (APK 16, maximum 300 characters). This does not
  provide an in-app response to a problem while the rider is on board.
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
- **Also (Oct 5, 2026):** logging out does not punch out. A driver who
  taps Log Out while punched in stays "Available" (the dispatcher sees
  "Available · app closed").
- **What to do for now:** the driver punches out (the record can't be
  edited afterward, on purpose).
- **Future work:** auto-closing forgotten shifts, admin corrections
  (driver-duty-plan.md, "Not now").
- **Possible improvement (small to medium, needs a new APK):** when a
  punched-in driver taps Log Out, ask "You're still on duty. Punch out
  before logging out?" with **Punch out and log out**, **Log out and
  stay on duty**, and **Cancel**. About 30–40 lines in
  app/driver-home.jsx, reusing `punchOut` (driverDutyService.js); no
  rules change. It must handle "On a run" (can't punch out: "Finish your
  ride first"), "On break" (`punchOut` only covers Available today), and
  erase the last known location like the duty card does.
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

### Admin Users reads and other tools remain city-wide

- **Found:** Sept 29, 2026 (login-overhaul-plan.md, steps 7 and 10).
- **Fixed for user profiles (Task 1.1, rules commit `c92f5a1`):** Admin writes
  now require a non-Admin target in the Admin's exact, non-empty barangay and
  only approved fields. Role and barangay cannot change. Add Dispatcher is
  restricted to the Admin's own non-empty barangay. The owner reports ruleset
  `projects/sakayna-571e8/rulesets/a8ceb049-1e5f-41d8-aeb9-dfbdc1c51292` and confirms
  `EXACT MATCH: c92f5a13ecb59f67b412ee5de117482c0d71189c` after deployment.
  Both values are recorded exactly as supplied, without an independent live read.
- **Owner-reported tests:** the five Playground denial cases were Denied;
  the phone-only update was Allowed, all as expected. The real-app results are
  recorded as supplied in architecture-review.md. No failure appears in the
  latest list. Add Dispatcher: pass (live site; test account found still in
  Firestore on 2026-10-14 and deleted then); the missing/empty-
  barangay denial case has no supplied result and is **not tested** in the record.
- **Still open:** Admin reads of the Users list remain city-wide. Overview,
  Emergency Calls, Requests, Vehicles, reports and other management tools
  are not made barangay-limited by Task 1.1. Resident Verification and Driver
  Applications remain limited to their barangay's Admin.
- **Also (Oct 4, 2026):** the new Duty Records (driver DTR) list shows
  the drivers of every barangay.
- **Status:** user-profile write issue fixed; city-wide reads and other tools
  remain open. Test details and the remaining not-tested cases are in
  architecture-review.md.

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
- **What it is:** Proof-of-residency (including the National ID option,
  a government ID) and driver document photos are stored in Cloudinary
  as public web links. SakayNa only shows these links to the owner
  and their barangay's admin, but anyone who has the exact link can open the
  photo.
- **Status:** Open. The Privacy Policy draft now explicitly names National
  ID as a government ID and explains that document photos, including
  National ID photos, use public links. Use sample documents, not real
  IDs, while testing.

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
- **Status:** Partly fixed (commit cfc717b): Dispatchers hide alerts after
  2 minutes without a heartbeat. Firestore still says "ringing". The
  redesigned Admin Emergency Calls page calls overdue alerts **No answer**;
  it fetches the newest 100, then puts overdue alerts first (oldest waiting
  first). Older alerts outside those 100 may not appear.
- **C3 remains open/unconfirmed:** a real waiting alert may also disappear
  if Call the office puts the Resident app in the background and pauses
  its heartbeat. Reloading Dispatcher can briefly bring old alerts back.
  The separate three-minute phone-call test has no recorded result yet;
  the general APK 16 phone test does not establish that C3 is fixed.

---

## Fixed / done

### Task 1.2: staff must be Active (A2 fixed for database access)

- **Rules commit:** `d464a70`, confirmed in local Git. The owner reports live
  ruleset `projects/sakayna-571e8/rulesets/e9a236c9-131a-4e4a-b1c4-9436f87b7573`
  in `sakayna-571e8`. The owner confirms the before comparison said **EXACT
  MATCH: 98db008**, the dry run compiled successfully, and the after
  comparison said **EXACT MATCH: yes**.
- **New rule:** `isAdmin()` and `isDispatcher()` also require the caller's own
  `accountStatus == "Active"`. Pending, Rejected, Deactivated or blank staff
  are refused. Driver and Resident checks were not changed.
- **Playground (Get):** admin1 and dispatcher0 reading a real log line:
  Allowed. dispatcher1 (no `accountStatus` field) reading it: Denied; its own
  profile: Allowed; dispatcher0's profile: Denied. Driver jeb reading a
  vehicle: Allowed.
- **Real app:** admin1 Overview/Users/Logs, dispatcher0 full emergency, Driver
  jeb punch in/out, Resident ride request, and dispatcher1 deactivate ("Account
  disabled") then restore: all pass. dispatcher1 is now "Active".
- **Limits:** see the open item "Refused staff: sign-in still works, and some
  screens are unclear".

### Task 1.3: activity log creation secured; A5 newest-first query fixed

- **Rules commit:** `98db008`, confirmed in local Git. The owner reports live
  ruleset `projects/sakayna-571e8/rulesets/f4df0e81-6109-488e-9304-eb71ca94caa8`
  in `sakayna-571e8`, and confirms the after comparison said **EXACT MATCH: yes**.
  Before-comparison and dry-run results were not supplied in this report.
  This documentation update did not independently check live rules or rerun tests.
- **New rule:** an Admin creates a line using their real signed-in UID,
  real role and Firebase's save time. Only these eight field names are allowed:
  `action`, `actorId`, `actorRole`, `targetType`, `targetId`, `summary`,
  `metadata`, `createdAt`. Staff reads are preserved; updates/deletes are denied
  by the rule. Playground f (update) and g (delete) were run on one real
  existing log line (`activityLogs/0NDrR4BLui8JBXpSmgyK`, from 2026-09-20);
  both were **Denied**.
- **A5 fixed:** website commit `94d2cb3` queries `orderBy("createdAt", "desc"),
  limit(50)`. The owner confirms the website release and newest-first Logs: pass.
- **Other real-app results:** Driver jeb status change/restore with both log
  lines: pass; dispatcher0 phone edit/restore: pass; vehicle create/edit/archive:
  pass; new test Resident approved: pass (test account deleted afterwards, UID
  not recorded). Add Dispatcher test account: pass (live site; test account
  found still in Firestore on 2026-10-14 and deleted then; its activityLogs
  line is kept).
- **Playground a-e:** another person's actorId, actorRole "Dispatcher", an extra
  field, create as dispatcher0, and signed-out create were each **Denied**.
  Caller was `kcwgrnPTETbVPS144oHfyyyAxfO2` except dispatcher0 and signed out.
  Exact request/document details were not supplied; the full reported test
  record, including f/g, is in `architecture-review.md`.
- **Limits remain:** identity/time checks do not prove the action happened;
  Task 1.2 (`d464a70`) later refused staff who are not Active; edit/delete denial was tested on
  one real log line only.

### Complete mission outcome/issues saving — fixed in APK 16

- **Found:** Oct 11, 2026, while removing the Completion notes box (#6).
- **Original problem:** The pop-up collected the selected outcome and
  optional "Issues encountered" text, but `advanceMission` saved only
  `completion.notes` and ignored the outcome and issues. This problem
  existed before #6 and was left unchanged during #6, #7, #8 and #5.
- **Approved saving fix (Oct 11):** `driverMissionService.js` now saves
  `completionOutcome` and `completionIssues` on the driver's assignment
  only when completing the mission. Issues are trimmed and limited to
  300 characters; blank or missing issues save as `""`.
- **One save:** These fields use the same Firestore transaction as the
  Completed status/time, van availability, driver availability and Run
  end duty record. If completion fails, none of these changes are saved.
  The duty record's outcome remains `"Completed"`, as before.
- **Old data:** No records are rewritten. An existing `completionNotes`
  value is kept when the current form sends no note. Older completed
  assignments and duty records remain untouched.
- **Where to check:** Firebase Console -> `driverAssignments` -> the
  completed assignment. Existing history/Admin screens do not display
  the two new fields; this change fixes saving only.
- **Local checks passed:** With/without issues, spaces-only and missing
  issues, exactly/over 300 characters, the full ride sequence, driver
  and van availability, Run start/end duty records, old notes/records,
  an older off-duty ride, failed save/retry, cancelled ride and missing
  assignment. Checks used mocked transactions; no live data was changed.
- **Status:** Fixed, tested and committed at **39e4583**, then included in
  **demo-ready-16**. The owner confirmed both the saving-fix test and the
  resulting APK's phone test. EAS fingerprint comparison says **matches**.
  No rules change or deployment was needed. The production website at
  a25dae1 does not yet include this saving fix.
- **Related APK 16 changes:** Only the Completion notes box was removed;
  Issues encountered remains optional. The completion backdrop fades
  separately from the card, using the landing sheet's approach. Log in
  and Create Account eyes show passwords only while held. National ID
  was added to resident proof choices using the existing document label
  and photo link; older labels/data are kept.

### Theme plan (was a future feature, not a bug)

- **Decided (Sept 28, 2026):** the app uses light mode, not dark.
- **Landing page, Get Started sheet and Choose Role:** Always light. They
  do not follow the phone's theme. There is no Dark / Light switch in
  the current app. This is on purpose.
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
