# Driver Duty Status + Duty Time Record (DTR) Plan — demo version

**Status: Steps 1–6 DONE (tested 2026-10-04).** Step 8 (paperwork + release) in progress, then Step 7 if there is time.
Demo freeze: around Oct 8–9.

## Goal (in simple words)
Drivers "punch in" and "punch out" like a time card, can take a break, and
are marked "On a run" by themselves when they accept a ride. Dispatchers see
who can take a ride. Admins see a daily time card (DTR) for every driver.
Every punch is saved as a record that can't be changed, with Firestore's
own clock (not the phone's).

## Our setup (from the request)
- Firebase JS SDK only (Auth + Firestore). No server, no Cloud Functions.
- Android: EAS development build. **No new packages** in this plan, so no
  new development build is needed. Testers need a new preview APK at the end.
- Security comes from firestore.rules.
- Times come from `serverTimestamp()` (saved) and `request.time` (checked
  by the rules). The phone clock is only used to make the on-screen timer
  tick.

---

## What exists today

### The driver's "Available / Unavailable" (app/driver-home.jsx)
There is **no button** to go online or offline today. It is automatic:
- Opening the driver home writes `availability: "Available"`,
  `presence: "Online"` on the driver's `users/{uid}` document
  (driver-home.jsx:176-195).
- Leaving the app (background, close, or website tab close) writes
  `availability: "Unavailable"`, `presence: "Offline"` (driver-home.jsx:206-256).
- The green bar at the top (driver-home.jsx:711-722) only *shows* this.
- Its "Set Availability" button opens a different thing: a **work-hours
  window** (start/end time) saved in `driverSchedules`. This window also
  pops up by itself every time the driver home opens (driver-home.jsx:396-403).

In simple words: today "Available" just means "the app is open on the
driver's screen right now".

### Who reads it
| Who | Where | What it reads |
|---|---|---|
| Dispatcher driver list | dispatcher-home.jsx:412-455, 328-362 | `presence` + `driverSchedules` → "Online Now", "Scheduled Now", "Scheduled Later", "Busy", "Offline" (lib/driverScheduling.js:90-127) |
| Dispatcher assign check | dispatcher-home.jsx:571-588 | Blocks the driver unless "Online Now" / "Scheduled Now", or if the driver already has a ride |
| Dispatcher driver card | dispatcher-home.jsx:777-814 | Badge + "Presence", "Schedule", "Tags" lines |
| Admin "Available Drivers" counter | useAdminDashboardData.js:211-219, admin-home.jsx:469-477 | `availability == "Available"` |
| Admin vehicle status | admin-home.jsx:221-229 | A driver-owned vehicle is "Inactive" unless its owner's `availability == "Available"` |
| Admin deactivate driver | adminOperationsService.js:189 | Sets `availability: "Unavailable"` |
| Driver ride flow | features/driver/services/driverMissionService.js | Accept / Complete / Decline. Does not touch availability today |

### How we move from it without breaking anything
1. The new status is a **new field**, `dutyStatus`, on the same
   `users/{uid}` document. Dispatchers and admins already watch this
   document live, so no new connection is needed.
2. Every time `dutyStatus` changes, the app **also** writes the old
   `availability` field: "Available" only when `dutyStatus` is "Available",
   otherwise "Unavailable". So the admin counter and the admin vehicle
   status keep working without being changed.
3. `presence` keeps its meaning: **is the driver's app open right now?**
   The automatic code on the driver home stays, but from Step 2 it only
   writes `presence` (and `lastSeenAt`), never `availability`. Otherwise
   closing the app would undo a punch in. The dispatcher uses `presence`
   for the "app closed" warning (Step 5).
4. The old work-hours window (`driverSchedules`) is retired from the
   driver home and the dispatcher card (see Question 2). Its data and
   rules stay; nothing is deleted.
5. The dispatcher switches to `dutyStatus` in Step 5.
6. A driver who has never punched in has no `dutyStatus`. Everyone treats
   that as **"Off duty"**.

---

## Where the data lives

### 1. Current status: on `users/{driverUid}` (new fields)
| Field | Meaning |
|---|---|
| `dutyStatus` | "Off duty", "Available", "On break" or "On a run" |
| `dutyStatusSince` | Server time of the last change (for "time in this status") |
| `shiftId` | Id of this shift's "Punch in" record (ties a shift's records together) |
| `shiftStartedAt` | Server time of punch in |
| `breakType` | "Lunch", "Rest" or "Personal" (only while on break). "Meal" until Oct 4, 2026; old records keep it |
| `breakNote` | Optional, up to 100 letters (only while on break) |
| `availability` | Old field, copies the duty status (see above) |
| `presence` | Old field, still means "app is open" (see above) |

### 2. Duty records: new collection `dutyRecords/{autoId}`
One new document for every change. **Never edited, never deleted.**

| Field | Example |
|---|---|
| `driverId`, `driverName` | who |
| `type` | "Punch in", "Break start", "Break end", "Run start", "Run end", "Punch out" |
| `at` | `serverTimestamp()` |
| `shiftId` | same as on the user document |
| `breakType`, `breakNote` | only on "Break start" |
| `assignmentId`, `requestId`, `purpose` | only on "Run start" / "Run end" |
| `outcome` | only on "Run end": "Completed" or "Cancelled" |

The status change and its record are saved **together in one save**
(a Firestore "batch": either both are saved or neither is).

### How the numbers are worked out (one small shared helper)
New file `lib/dutyTime.js`, one function that reads a shift's records and
returns: first punch in, last punch out, break time, time on duty, rides
completed. Used by the punch-out summary, the admin DTR and My DTR.
- **Break time** = all (Break end − Break start). An unfinished break
  counts up to "now".
- **Time on duty** = (Punch out, or now) − Punch in − Break time. The same
  number is the "On duty for HH:MM:SS" timer on the driver's card.
- **Rides completed** = "Run end" records with outcome "Completed".
- **Manila time:** Manila is always UTC+8 (no daylight saving), so times
  are shown by adding 8 hours and reading the UTC clock. This gives the
  same answer on every phone and browser, whatever their time zone.

---

## Rules changes (firestore.rules)

### Part A — Step 1 (safe to deploy while the old app is live)
Old code never writes these new fields or this new collection, so old
APKs and the live website keep working.

**Allowed changes**, written once:
```
function allowedDutyChange(before, after) {
  return (before == "Off duty" && after == "Available")
    || (before == "Available" && after in ["On break", "On a run", "Off duty"])
    || (before == "On break" && after in ["Available", "Off duty"])
    || (before == "On a run" && after == "Available");
}
```
- **users/{uid}, driver updating their own profile:** if any duty field
  changes, the driver must be an Approved Driver, the change must be in the
  list above (missing `dutyStatus` counts as "Off duty"), and
  `dutyStatusSince` must equal `request.time` (Firestore's clock). Going on
  break also needs a break type in ["Lunch", "Meal", "Rest", "Personal"] and a note
  of 100 letters or fewer. Saves that don't touch duty fields (Settings,
  the old online/offline code) are checked exactly as today.
- **users/{uid}, new profile (sign-up):** may not contain duty fields.
- **dutyRecords:**
  - read: staff, or the driver it belongs to.
  - create: an Approved Driver, for themselves only, with `at ==
    request.time`, a known `type`, and the driver's status *after this same
    save* must match the record (e.g. "Break start" → "On break"), changed
    at this same moment. (Uses `getAfter`. If Firestore refuses this check
    when we test Step 2, we drop that one line and say so.)
  - update, delete: **never**, for everyone (Admins too).

### Part B — at release (Step 8), not before
- **driverAssignments create:** the chosen driver's `dutyStatus` must be
  "Available". Not in Step 1, because until testers have the new APK no
  driver can punch in, and every assignment on the live website would fail.

### What the rules can't check (written here so we can say it at the defense)
- That "On a run" really matches an accepted ride. The app changes both in
  the same save; the rules only check the allowed-changes list. (Possible
  later: check the assignment with `getAfter`.)
- "Can't start a break while a ride is waiting to be accepted." The rules
  can't search for that driver's waiting rides. The app hides the buttons
  instead.
- A driver who closes the app without punching out stays "Available"
  (see Future work: heartbeat, auto-closing shifts). The dispatcher sees
  "Available · app closed" (Step 5).
- "App closed" only shows when the app closed normally. If the app
  crashes or the phone dies, it has no chance to save "Offline", so the
  driver still looks "app open". That is the limit of a no-server
  stand-in for "Unreachable".

Deploy the safe way every time (memory: rules-deploy-check): commit →
download live rules and compare to the last committed file → deploy with
`--project sakayna-571e8` → download again and confirm they match.

---

## The screens

### Driver home (replaces the green bar at driver-home.jsx:711-722)
New component `features/driver/components/DriverDutyCard.jsx` (keeps the
1355-line driver-home.jsx from growing) and
`features/driver/services/driverDutyService.js` (punch in, start break,
end break, punch out).

Layout idea from design-refs/driver-home-reference.png screens 1 and 2,
in DESIGN.md colors (card corner 24, button corner 16, main buttons
full width and at least 56 tall, a word with every color, no ALL CAPS):

| Status | Card | Buttons |
|---|---|---|
| Off duty | Board Tint (grey) card, Ink text: "Off duty", "You can't get rides." | Big Hall Green **Punch in** |
| Available | Hall Green card, white text: "Available", "On duty for 02:14:09", "Punched in at 8:02 AM" | **Start break** (white), **Punch out** (outline) |
| On break | Sakay Orange card, Ink text: "On break · Meal", break timer "12:30", the note | **Resume duty** |
| On a run | Hall Green Deep card, white text: "On a run", the ride's purpose | none |

- **Start break** opens the "Take a break" bottom sheet (like
  reference screen 2; renamed from "Set availability" on 2026-10-04): three big choices Meal / Rest / Personal, an
  optional note (max 100), then **Start break** (main) and **Cancel**
  underneath.
- **Punch out** opens a confirm pop-up: "Punch out?" + start time, time on
  duty, break time, rides completed. **Punch out** (main), **Keep working**
  underneath. Not red: punching out can be undone by punching in again.
- While a ride is waiting for Accept/Decline, Start break and Punch out are
  hidden with the line "Answer your ride first."
- While saving: buttons show "Saving…". No internet: the save waits and
  Firestore stamps the time when it actually arrives; after 8 seconds we
  show "Still saving. Check your internet."
- The "Ride Inbox", Accept/Decline and the rest of the ride screens do not
  change.

### Ride flow (driverMissionService.js)
- **Accept** (same transaction as today): if the driver is "Available",
  also set "On a run" + save a "Run start" record. If the driver is Off
  duty or On break: stop with "Punch in (or resume duty) before
  accepting." (This can only happen with a ride assigned before this
  feature.)
- **Complete:** if the driver is "On a run", also set "Available" + save a
  "Run end" (Completed) record. If not (a ride accepted before this
  feature), complete as today.
- **Cancelled by the resident:** not needed. A resident can only cancel
  while the ride is "Pending" or "Assigned", before Accept
  (residentRequestService.js), so a run is never cancelled halfway.
  `clearCancelledRide` is unchanged (found 2026-10-04, Step 4).
- **Decline:** no change (the driver stays Available).

### Dispatcher (app/dispatcher-home.jsx)
- Each driver card: badge with the word and color, plus time in that
  status: "Available · 1 hr 5 min", "On break · Meal · 12 min" (+ note),
  "On a run · 25 min", "Off duty".
- **App closed warning:** a driver who is Available but whose app is
  closed (`presence` is "Offline") shows "Available · app closed" with a
  short line "Call the driver first." They can still be assigned. This is
  our simple, no-server stand-in for an "Unreachable" status.
  Colors: Available = Hall Green; On break = Sakay Orange with Ink text;
  On a run = Hall Green Deep; Off duty = Ink Muted.
- Only **Available** drivers (with no waiting ride) can be tapped to
  assign. Others are greyed out with the reason ("On break (Meal)",
  "On a run", "Off duty: not punched in").
- The assign transaction (dispatcherAssignmentService.js) reads the
  driver again and stops if they are no longer Available (e.g. they just
  started a break at the same moment).
- "Presence", "Schedule" and "Tags" lines are removed from the card.
- The time counts with the screen's existing 10-second clock, so it moves
  every 10 seconds.

### Admin (new "Duty Records" section)
New `features/admin/components/AdminDutyRecordsSection.jsx`, added to the
admin menu next to the other sections (admin-home.jsx:713-814).
- Day picker: "‹  Sun, Oct 4  ›" (no new date package).
- One row per driver shift: driver, first punch in, last punch out
  ("Still on duty" if none), break time, time on duty, rides completed
  in two columns, "Medical / Health rides" and "Community / Other rides"
  (not "emergency": emergencies are alerts, not rides). Times in Manila
  time.
- It reads the records from the chosen day **plus the next day**, and keeps
  shifts that *started* on the chosen day. So a night shift that ends after
  midnight still shows whole.
- City-wide, like the other older admin tools (Known-Issue.md "Admin
  tools are still city-wide").

### (Only if time allows) My DTR for the driver
A read-only list in the driver's ☰ / avatar menu: the last 7 days of the
driver's own shifts, same columns. Reads only that driver's records (fine
for a demo; would need a Firestore index after months of records).

---

## Steps (one at a time: build → test on phone → commit → next)
[Rules] = rules deploy the safe way. [UI] = design with Impeccable.
None needs a new package or a new development build.

### Step 1 — Rules Part A [Rules]
- Files: firestore.rules only.
- **Test (nothing old broke):** resident signs up; driver opens home, saves
  Settings; dispatcher assigns a ride; driver accepts and completes it;
  emergency alert still rings on the dispatcher. All as before.

### Step 2 — Punch in / Punch out [UI]
- Files: DriverDutyCard.jsx (new), driverDutyService.js (new),
  lib/dutyTime.js (new), app/driver-home.jsx (status bar replaced; the
  automatic code keeps saving `presence` only; the work-hours pop-up
  removed).
- **Test:** driver home shows grey "Off duty" → Punch in → green card, timer
  counts → close and reopen the app: still Available, timer continues →
  Punch out → summary shows start time and time on duty → Punch out →
  grey card. In Firebase Console: 2 new `dutyRecords` with server times;
  `users` doc has `dutyStatus`. Put the app in the background: `presence`
  turns "Offline" but `dutyStatus` stays "Available".

### Step 3 — Breaks [UI]
- Files: DriverDutyCard.jsx, driverDutyService.js.
- **Test:** Start break → pick Meal, type a note → orange card with break
  timer → Resume duty → green card, "on duty" timer did not count the
  break → Punch out summary shows the break time.

### Step 4 — On a run (automatic)
- Files: driverMissionService.js, DriverDutyCard.jsx, app/driver-home.jsx.
- **Test:** punch in → dispatcher assigns → Start break and Punch out are
  hidden ("Answer your ride first") → Accept → "On a run", no buttons →
  Complete → back to Available. Punch out summary says 1 ride completed.
  Also: Decline → driver stays Available. Also: accept while on break →
  "Tap Resume duty, then accept this ride."

### Step 5 — Dispatcher [UI]
- Files: app/dispatcher-home.jsx, dispatcherAssignmentService.js.
- **Test (dispatcher on the website, driver on the phone):** each status
  shows its badge and time; On break / On a run / Off duty are greyed out
  with the reason and can't be assigned; Available can. Close the
  driver's app: the card shows "Available · app closed"; open it again:
  the warning goes away.

### Step 6 — Admin daily DTR [UI]
- Files: AdminDutyRecordsSection.jsx (new), app/admin-home.jsx (menu entry).
- **Test:** pick today: the shifts from Steps 2–5 show with correct Manila
  times, break time, time on duty and ride counts; pick yesterday: empty.

### Step 7 — My DTR for the driver (only if time allows)
- Files: new small screen/pop-up in the driver menu.
- **Test:** the driver sees their own shifts from today; nothing to edit.

### Step 8 — Paperwork + release (planned 2026-10-04, waiting for OK)
Order changed (2026-10-04): Step 8 before Step 7. Step 7 comes after,
if there is time.

**Why the order inside Step 8 matters.** The new rule ("only Available
drivers can be assigned") goes live for everyone the moment it is
deployed. Drivers can only become Available with the new app (new APK,
or the website). So the new APK must be built and ready to send
*before* the rule goes live, and the rule goes live together with the
website.

**8a. Paperwork** (no behavior change; you read it, then commit)
- Known-Issue.md, new "Open" items:
  - A driver who forgets to punch out stays "Available" (no
    auto-closing). The admin DTR shows "Still on duty" and the hours
    keep counting. Fix by hand for now: the driver punches out.
  - "App closed" only shows when the app closed normally. A crash or a
    dead phone still looks "app open" (no heartbeat, no server).
  - Rules limits: the rules can't check that "On a run" matches a real
    ride, or that a driver with a waiting ride doesn't start a break.
    The app checks these.
  - Drivers on an old APK can't get rides after this release (on
    purpose; they can't punch in).
  - The admin DTR is city-wide (added to the existing "Admin tools are
    still city-wide" item).
  - "Last checked" date updated.
- Privacy Policy draft (app/privacy.jsx, shows in the app and on the
  website):
  - What we collect, drivers: punch in / punch out times, breaks (type
    and optional note), the rides started and finished while on duty,
    and whether the app is open.
  - Who sees it: dispatchers see a driver's duty status, break type and
    note, and whether the app is open; administrators see the daily
    time records. Drivers see their own.
  - "SakayNa does not calculate pay." Keeping time: "[to be decided]",
    like the other records.
  - "Last updated" date.
- README.md collections table: new `dutyRecords` row; `users` row says
  "duty status"; `driverSchedules` row says "old work-hours windows, no
  longer used by the app (kept)".
- PRODUCT.md: Driver = punch in / out, breaks, "On a run" set
  automatically (instead of "go online/offline, post availability
  schedules"); Dispatcher = sees duty status, assigns only Available
  drivers; Admin = daily duty records (DTR).
- One sentence in the app: the admin's "Approve driver?" pop-up
  (AdminDriverApplicationsSection.jsx:258) says "They will be able to
  punch in and receive rides." instead of "go online".
- Test: read the files; open /privacy on your dev server.

**8b. Rules Part B** (written and committed, NOT deployed yet)
```
match /driverAssignments/{assignmentId} {
  allow create: if isStaff()
    && get(/databases/$(database)/documents/users/$(request.resource.data.driverId))
         .data.get("dutyStatus", "Off duty") == "Available";
  ...the rest unchanged
}
```
- Compile check with `--dry-run`, then commit.

**8c. Preview APK** (CLAUDE.md "EAS build checklist")
1. git status clean.
2. `npx expo install --check`.
3. `eas build --profile preview --platform android` (from the 8b
   commit; the new rule is in the file but not live, which is fine).
4. `eas fingerprint:compare --build-id <id>` must say "matches".
5. Uninstall the old app, install the new APK, quick test on the
   phone: punch in, break, resume, punch out. (Live rules are still
   Part A, which is all the app needs.)

**8d. Release window** (one sitting, same day, in this order)
1. Website (CLAUDE.md "How to update the website"):
   `git push origin master` → `git switch main` →
   `git merge --ff-only master` (must say "Fast-forward") →
   `git push origin main` → `git switch master`. Wait for Vercel
   "Ready".
2. Rules Part B, the safe way: download live rules and compare with
   the last deployed version (commit 177df0c) → deploy with
   `--project sakayna-571e8` → download again and compare with the
   file.
3. Tag `demo-ready-8` on the release commit and push the tag.
4. Live checks on https://sakay-na-delta.vercel.app:
   - Dispatcher: badges and times; an Off duty driver can't be tapped.
   - Driver (new APK): punch in → the dispatcher sees "Available" →
     assign → accept → complete.
   - Admin: Duty Records shows that shift.
   - Emergency alert from the new APK **and** from an old APK still
     rings and can be answered (alerts are not changed).
5. Send testers the message below.

**8e. Write it down:** a "Releases" section at the end of this plan
(build id, commit, tag), Status line updated. Commit.

**Undo button.** If something is badly wrong after 8d: deploy the old
rules again the same safe way (the firestore.rules from commit 177df0c,
"Part A"). Then old APKs can be assigned again. The website can stay.

**What testers must do** (message to send at 8d step 5):
- Everyone: uninstall the old SakayNa app and install the new one
  (link). Residents: the old app still works, but please update.
- Drivers: the old app can't get rides any more. In the new app, tap
  **Punch in** when you start testing and **Punch out** when you stop.
  Use **Start break** for breaks and **Resume duty** after. Keep the
  app open while punched in, or dispatch sees "app closed".
  No phone with the new app? Log in as driver on the website instead.
  Don't switch between the old and new app.
- Dispatchers: refresh the website. Only drivers with a green
  "Available" badge can be given a ride. Grey cards say why not.
- Admins: new "Duty Records" menu item: each driver's time card per
  day.

## If time runs out (demo freeze ~Oct 8–9)
Suggested days: Oct 4 Step 1 · Oct 5 Steps 2–3 · Oct 6 Steps 4–5 ·
Oct 7 Step 6 · Oct 8 Step 7 if there is time, then Step 8 (an EAS build
takes time; release by Oct 8 morning if possible).

Drop in this order:
1. **Step 7** (My DTR): drop first. Nothing depends on it.
2. **Step 6 simplified:** only first punch in, last punch out and time on
   duty (no break or ride columns).
3. **Step 3** (breaks): the card then has only Punch in / Punch out. Rules
   from Step 1 already allow breaks, so they can be added later with no
   rules change.

**Must stay:** Steps 1, 2, 4, 5 and 8. Without them the demo has no working
"only available drivers get rides" loop.

## Not now (future work)
- Detecting unreachable drivers (heartbeat).
- Auto-closing forgotten shifts (a driver who never punches out).
- Admin corrections and flags on the DTR (records stay append-only;
  corrections would be new "correction" records).
- CSV / PDF export.
- Push notifications ("please resume duty").
- Shift schedules (the old `driverSchedules` work-hours window).
- Location tracking.
- Salary or pay of any kind.
- From the reference picture: the community "confirm / transfer" flow and
  the emergency countdown.
- Admin DTR only for the admin's own barangay.
- Rules check that "On a run" matches a real accepted ride.

## Keep as it is
Emergency alerts, the request flow, the driver's Accept/Decline, and
everything residents see.

## Answers (2026-10-04)
1. Admin DTR columns are named "Medical / Health rides" and
   "Community / Other rides", not "emergency". Emergencies are alerts,
   not rides.
2. Yes: remove the work-hours pop-up from the driver home and the
   Schedule/Tags lines from the dispatcher card. Keep its data and code.
3. Added to Step 5: "Available · app closed" warning, using `presence`.

## Groupmates' feedback (2026-10-04, after the demo-ready-8 release)
1. "Take a break" button text disappeared after choosing a type
   (Android): fixed, the grey box and the green button are now two
   separate things.
2. Header too thick: one thin row (logo left, profile right).
3. "Meal" renamed "Lunch". Rules allow "Lunch" and still "Meal" (older
   APK, old records). Dispatcher badge shows what was saved; the admin
   DTR shows only break time, so it needed no change.
4. Break card too orange: Peach Tint card with an orange edge and dark
   text (preview first).
