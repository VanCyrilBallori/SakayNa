# SakayNa Architecture Review

**Date:** October 5, 2026
**Code checked:** `master` at commit 798072a (after demo-ready-14 and the patients box)
**Type:** review only. No code, rules or data were changed. Only this file was added.

How to read this:
- Start with section 1 (one page). Each problem has an ID (C1, A3, F2…),
  so the team can say "let's do A5".
- **CRITICAL** = could break emergencies, lose data, or is a security hole.
  **AFTER THE DEMO** = improvements and clean-ups. **FUTURE WORK** = bigger
  ideas for the capstone paper.
- **NEW** = found in this review. **KNOWN** = already written in
  Known-Issue.md or Skills/resident.md section 6 (the number is given).
- Technical words are explained the first time, and again at the end
  ("Words used").

---

## 1. The short version

SakayNa is in good shape for a capstone. The most important saves are
"all or nothing" (see "transaction" below), and the database rules already
block the worst dangers: nobody can make themselves an Admin, the driver
time card can't be edited, and only the dispatcher who answered an alert can
create the emergency ride for that resident.

The problems, most important first:

| ID | Problem | Category | What the fix touches |
|---|---|---|---|
| C1 | An unapproved "driver" account can change every vehicle | CRITICAL | rules only |
| C2 | The Admin's Emergency Calls list may not show a new alert | CRITICAL | website, 1 line |
| C3 | A real alert can disappear from every dispatcher after 2 minutes | CRITICAL (KNOWN #33) | test first; website, 1 number |
| A1 | Two dispatchers can answer the same alert | After the demo | website |
| A2 | Removed staff and drivers keep their database powers | After the demo | rules (+ a habit now) |
| A5 | The Admin's activity log shows a random 50 lines | After the demo | website, 1 line |
| A7 | No sound when an alert rings on the dispatcher website | After the demo | website |
| A12 | The dispatcher screen downloads whole collections, forever growing | After the demo | website |

**If the app stays frozen until the demo:** use the demo-day checklist
(section 9). It avoids C2, C3 and A1 without changing code.
**If you allow one change:** C1. It is a rules-only change, it doesn't need
a new APK or a website release, and the risk is low.

### What is already done well (useful for the defense)

- Assigning a ride, the emergency form's Submit, every driver step,
  cancelling, and approving a resident are all **transactions**: the app
  reads, checks, then saves everything together or nothing. For example,
  a ride can't be given to a driver who started a break a second ago.
- The duty status rules only allow real changes (no punch out during a
  run), use Firestore's clock instead of the phone's, and the time card
  (`dutyRecords`) can never be edited or deleted.
- An emergency alert is saved under one ID made in advance, with a
  10-second "not confirmed" limit. "Try again" reuses the same ID, so a
  resident can never send two alerts by accident. The GPS is added after
  sending, so a slow GPS never delays the alert.
- One ride per alert: the form's Submit checks that the alert has no ride yet.
- Old APKs keep working on purpose (old fields and old buttons are still
  understood).
- The project documents itself very well: plans, Known-Issue.md and the
  resident role doc made this review much faster.

---

## 2. How SakayNa is built

SakayNa has three parts.

1. **The app.** One project (Expo / React Native) that becomes both the
   Android app and the website. Residents and drivers use the phone app;
   dispatchers and admins use the website. Each screen is one file in
   `app/`; pieces of screens are in `features/<role>/`.
2. **Firebase** (a Google service):
   - **Authentication** checks who is logging in.
   - **Firestore** is the database. It is made of **collections** (like
     folders, for example `transportRequests`) that hold **documents** (like
     one filled-in form each, for example one ride).
   - **`firestore.rules`** is the guard at the database door. SakayNa has
     no server of its own (on purpose), so the rules are the *only* real
     protection. The app hides buttons, but a person who writes their own
     program can skip the app's screens and talk to the database directly.
     Only the rules can stop them.
3. **Outside helpers.** Cloudinary keeps the ID and document photos.
   OpenStreetMap provides the map pictures, and Nominatim turns typed
   addresses into map points. Phone calls use the phone's own dialer.
   Vercel hosts the website, built from the `main` branch.

```
      PHONE APP (Android)                    WEBSITE (computer)
  ┌────────────┐ ┌────────────┐       ┌──────────────┐ ┌────────────┐
  │  Resident  │ │   Driver   │       │  Dispatcher  │ │   Admin    │
  └─────┬──────┘ └─────┬──────┘       └──────┬───────┘ └─────┬──────┘
        └──────────────┴─── same code ───────┴───────────────┘
                               │  saves, reads, live listeners
                               ▼
        ┌──────────────────────────────────────────────────┐
        │  FIREBASE                                        │
        │   Authentication ── who you are                  │
        │   firestore.rules ── the guard at the door       │
        │   Firestore ─────── the database (collections)   │
        └──────────────────────────────────────────────────┘

  Outside helpers: Cloudinary (photos) · OpenStreetMap + Nominatim (maps)
                   · the phone's dialer (calls) · Vercel (the website)
```

**Live listeners.** Most screens don't ask the database just once. They
keep a **listener** open, which is like a subscription: "tell me every
time this changes". That is why a dispatcher sees a new alert without
refreshing. Each listener costs database reads, so a listener that watches
a big, growing collection gets slower and more expensive over time (A12).

**Transactions and batches.** A **transaction** means "read, check, then
save everything together, or save nothing". A **batch** is the same "all
or nothing" save, without the reading part (used for punch in / punch out).

### Where the data lives

| Collection | What one document is | Who saves it | Who can read it |
|---|---|---|---|
| `users` | a person's profile: role, account status, duty status | the person (limited fields), Admin | the person, staff |
| `transportRequests` | one ride | resident (create, cancel), dispatcher, assigned driver | the resident, staff, the assigned driver |
| `callSessions` | one emergency alert | resident, dispatcher | the resident, staff |
| `driverAssignments` | "driver X does ride Y with van Z" | dispatcher, driver | staff, that driver |
| `vehicles` | one barangay van | Admin, dispatcher, drivers (see C1) | staff, drivers |
| `dutyRecords` | one time card line (never edited) | the driver | staff, that driver |
| `driverLocations` | a driver's last known place | the driver | dispatchers only |
| `residentVerifications`, `Driver_Applications` | sign-up proof and photos | the new resident or driver | that person, their barangay's Admin |
| `activityLogs`, `systemSettings`, `vehicleMaintenance` | Admin bookkeeping, office phone | Admin | staff (everyone may read the office phone) |

("Staff" = Dispatchers and Admins.)

---

## 3. The main data flows

### 3.1 A resident asks for a ride

```
Resident phone              transportRequests/{ride}           Dispatcher website         Driver phone
Request a Ride ──save──────▶ "Pending" ───── listener ───────▶ queue (soonest first)
                                                    Assign ──▶ ONE transaction:
                            "Assigned" ◀──────────────────── ride + assignment + van "Assigned"
                                                                                     ──▶ "New ride from dispatch"
                            "In Progress" ◀───────────────────────────────── Accept, En route, Arrived, Picked up
                            "Completed"   ◀───────────────────────────────── Complete (van "Available" again)
Cancel (Pending/Assigned) ─▶ "Cancelled" ──▶ the driver's app frees the driver and the van (when it is open)
```

1. The form is checked on the phone, then saved as "Pending" with a
   reference like `SKN-AB12CD34`. The rules allow it only for an Active
   resident, for themselves.
2. Every dispatcher's queue shows it at once (listener on "Pending").
3. **Assign** saves three things together: the ride ("Assigned"), a new
   `driverAssignments` document, and the van ("Assigned"). It first checks
   that the ride is still Pending and the driver is still Available.
4. Each driver step updates the assignment and the ride together. Accept
   also makes the driver "On a run"; Complete makes them "Available" and
   frees the van; both add a time card line.
5. The resident's card and Request Details update live from the ride.

### 3.2 An emergency alert

```
Resident phone                 callSessions/{alert}                 Dispatcher website
[Emergency] ─── save ─────────▶ "ringing"  ─────── listener ──────▶ "Incoming Emergency Call"
every 20 s ──── save ─────────▶ lastActiveAt ("I'm still here")     (hidden if quiet for 2 min)
GPS found ───── save ─────────▶ location + address
                                "connected" ◀────── Answer ──────── saves the dispatcher's phone
countdown 3, 2, 1 ◀──────────── dispatcherPhone                      the Emergency request form opens
phone CALLS the dispatcher (a normal call from the resident's SIM)
[Done] ──────── save ─────────▶ "ended"   (or "cancelled" if nobody answered)
```

- If nobody answers in 30 seconds, the resident sees "Call the office".
- The Admin's Emergency Calls panel marks alerts ringing for more than
  30 seconds as unanswered (but see C2).

### 3.3 The dispatcher's emergency form

1. **Answer** opens the form. The caller's name, number, barangay and GPS
   address are filled in from the alert and the resident's profile.
2. The dispatcher types the emergency details (type, priority, patients,
   incident details, quick facts) and picks an Available driver and a van,
   nearest first.
3. **Submit** is one transaction. It checks that the alert has no ride yet
   and the driver is still Available, then saves the new ride (already
   "Assigned"), the driver's assignment, the van "Assigned", and a link
   from the alert to the ride.
4. The rules allow this only for the dispatcher who answered that alert,
   for that same resident.
5. The resident and the driver see it like any assigned ride. Since
   demo-ready-14, the driver's card shows the quick facts.

### 3.4 Driver duty and rides

- **Duty status** (Off duty → Available → On break / On a run → …) is saved
  on the driver's profile. Each change also saves a time card line in
  `dutyRecords`, in the same batch. The rules check that the change is
  allowed, that both parts match, and that the time is Firestore's clock.
- Only an **Approved** driver who is **Available** can be given a ride.
  The app checks both. The rules check "Available", and only an Approved
  driver can make themselves Available.
- **Location:** saved only when the driver taps Punch in, Accept, En route,
  Arrived or Picked up. Only dispatchers can read it, and Punch out erases it.
- **"I can't do this ride"** (before pickup) gives the ride back to the
  dispatcher as "Pending" and frees the van.

### 3.5 Admin

- **Resident Verification** and **Driver Applications**: only the Admin of
  the same barangay can see and decide them (rules check the barangay).
- **Accounts** (Operations): changing a status or a role needs a reason.
  It is saved in a transaction together with an activity log line.
- **Vehicles**: add, edit, archive, and maintenance records.
- **Overview, Requests, Users**: counts are made by the server; the lists
  show the newest 200.
- **Duty Records**: each driver's daily time card; **Emergency Calls**:
  the list of alerts with the "unanswered" badge.

---

## 4. Choices I did NOT count as mistakes

These are on purpose, as you said:

- **No server** (no Cloud Functions). FUTURE WORK F6 lists what a server
  *could* add, as an idea for the paper, not as a mistake.
- **No Decline** button for drivers.
- **Light mode only.**
- **Alert-first emergencies:** the resident's phone calls the dispatcher;
  dispatchers use computers.

Problems already written in Known-Issue.md or Skills/resident.md section 6
are only repeated here when they matter for the demo, and are marked KNOWN.

---

## 5. CRITICAL: fix before the demo (or use the workaround)

### C1. An unapproved "driver" account can change every vehicle (NEW, security)

**What is happening?**
In the rules, `isDriver()` only asks "is this account's role Driver?"
(`firestore.rules:28`). It does *not* ask "was this driver approved?".
Anyone can get the Driver role: sign up, verify the email, choose Driver.
The account is still "Pending", but `isDriver()` already says yes. Rejected,
Suspended and Deactivated drivers also still pass `isDriver()`.

Three rules use `isDriver()` to allow saving:
- `vehicles`: any driver may change **any** vehicle, **any** field
  (`firestore.rules:198`).
- `driverSchedules`: any driver may save any schedule (`firestore.rules:204`).
- `vehicleChecklists`: any driver may create or change checklists
  (`firestore.rules:282`).

**Why it matters:**
The app's screens never let a Pending driver do this. But someone who knows
some programming can skip the screens. (The website's Firebase settings are
public; that is normal for Firebase, which is why the rules matter.) That
person could:
- set every van to "Under Maintenance". The Assign window and the emergency
  form only offer vans that are "Available" or "Assigned"
  (`app/dispatcher-home.jsx:422-448`), so no ride could be sent, including
  emergency rides;
- create thousands of `driverSchedules` documents. Every dispatcher screen
  downloads all of them (`app/dispatcher-home.jsx:688`). That is slow, and it
  can use up the free plan's 50,000 reads per day, after which the whole app
  stops working until the next day.

**How likely?** Low during the demo: it needs someone who deliberately
writes code. But it is the only hole I found that a complete stranger can
use, and it hits the emergency path.

**Smallest fix (rules only: no new APK, no website release):**
use `isApprovedDriver()` (which already exists, `firestore.rules:77-80`)
in those three places:

```
match /vehicles/{vehicleId} {
  allow read:           if isStaff() || isDriver();
  allow create, delete: if isAdmin();
  allow update:         if isAdmin() || isStaff() || isApprovedDriver();
}
match /driverSchedules/{scheduleId} {
  allow read:  if isStaff() || isDriver();
  allow write: if isStaff() || isApprovedDriver();
}
match /vehicleChecklists/{checklistId} {
  allow read:           if isStaff() || isDriver();
  allow create, update: if isApprovedDriver();
  allow delete:         if false;
}
```
(This only shows the change. Nothing was applied.)

**Risk: Low.** I checked every place the app saves a vehicle. Drivers only
do it when they complete a ride, report "I can't do this ride", or after a
resident cancels (`features/driver/services/driverMissionService.js:107-113,
146-152, 221-227`). Only an Approved driver can have a ride, so they keep
working. The Pending driver's screens (`app/driver-status.jsx`,
`app/register-driver.jsx`) never touch vehicles. Before deploying, check in
the Firebase Console that every test driver who should work has
`accountStatus: "Approved"` (they must already, because Punch in needs it).

**How to test it by hand** (deploy the safe way, section 8):
1. Approved driver punches in → dispatcher assigns a ride → Accept → En
   route → Arrived → Picked up → Complete. The van is offered again in the
   Assign window.
2. Assign again → the driver taps "I can't do this ride" → the van is
   offered again.
3. Assign again → the resident cancels → with the driver's app open, the
   driver and the van are freed.
4. Emergency alert → Answer → form → Submit → the driver completes it →
   the van is free.
5. A Pending driver applicant logs in → still sees the application status
   screen, as before.
6. Optional: Firebase Console → Rules Playground (section 8): "update
   `vehicles/<id>`" as a Pending driver's uid → **Denied**.

### C2. The Admin's Emergency Calls list may not show a new alert (NEW, emergency safety net)

**What is happening?**
The list asks the database for "any 100 alerts"
(`features/admin/hooks/useAdminCallSessions.js:23`):
`query(collection(db, "callSessions"), limit(COLLECTION_LIMIT))`. It never
says "newest first". Without an order, Firestore returns the alerts sorted
by their ID, and IDs are random letters. The app sorts by time only *after*
those 100 arrive.

**Why it matters:**
Once there are more than 100 alerts saved (testing makes many), a brand-new
unanswered alert is often *not* among the 100. Then its "unanswered" badge
never appears. That badge is the backup for when no dispatcher reacts
(PRODUCT.md principle 2: "An emergency never rings into a void").

**Check first:** Firebase Console → Firestore → `callSessions`. If there
are more than 100 documents, this is already happening.

**Smallest fix (website only, 1 line, plus `orderBy` in the import):**
`query(collection(db, "callSessions"), orderBy("createdAt", "desc"), limit(COLLECTION_LIMIT))`.
Every alert from the app has `createdAt` (`app/resident-home.jsx:367`), and
Firestore makes the one-field index it needs by itself.

**Risk: Low.** The only change is *which* 100 alerts arrive: the newest
instead of random ones.

**How to test it by hand:** on the local website, log in as Admin → Emergency
Calls. From the resident phone send an alert, and don't answer it. Within
about 30 seconds it appears at the top with the "unanswered" badge, and the
other alerts are listed newest first. Answer it as a dispatcher → its status
changes in the Admin list.

### C3. A real alert can disappear from every dispatcher after 2 minutes (KNOWN #33, not tested yet)

**What is happening?**
While an alert rings, the resident's phone saves "I'm still here" every 20
seconds (`app/resident-home.jsx:170-182`). Dispatchers hide an alert whose
signal hasn't changed for 2 minutes, treating it as stuck
(`app/dispatcher-home.jsx:26` and `761-768`). The signal uses an ordinary
timer, and on Android ordinary timers usually stop while the app is in the
background.

**Why it matters:**
The resident's own fallback, "Call the office", opens the phone's dialer,
which puts SakayNa in the background. So a resident doing exactly what the
app suggests can make their alert vanish from every dispatcher after 2
minutes. A hidden alert can't be answered, so nobody can open the emergency
form for it either.

**Do this first (no code):** the phone test written in #33. Send an alert,
tap "Call the office", stay on the call for 3 minutes, and watch the
dispatcher screen.

**Smallest fix, if the test confirms it (website only, 1 number):** wait
longer before hiding. Change `STUCK_ALERT_MS` from `120_000` (2 minutes) to
`600_000` (10 minutes) at `app/dispatcher-home.jsx:26`.
The trade-off: an alert from a crashed phone stays on screen longer (#34).
But a dispatcher can Decline a stuck alert, while a hidden real alert can't
be found at all. The real fix needs a server or a background task (F6).

**Risk: Low** (one number), but it changes what dispatchers see, so test
both cases.

**How to test it by hand:** (1) Repeat the #33 test: the alert stays
visible for 10 minutes. (2) Send an alert, then force-close SakayNa on the
phone: the alert disappears from the dispatcher after about 10 minutes
instead of 2.

**Demo workaround (no code):** the resident keeps SakayNa on screen until a
dispatcher answers, and a dispatcher answers within 2 minutes.

---

## 6. AFTER THE DEMO

Each item says what it is, the fix, how risky the fix is, and how to test
it by hand. Risk means "how likely the fix breaks something that works
today".

### Security and safety

#### A1. Two dispatchers can answer the same alert (NEW)
- **What:** Answer saves "connected" without first checking that the alert
  is still "ringing". It is a plain save, not a transaction
  (`app/dispatcher-home.jsx:820-852`). If two dispatchers click Answer
  within about a second, both saves go through, and the last one wins. The
  resident's phone calls the last one. The other dispatcher's Active
  emergency card disappears, and their open form can't be submitted. The
  rules refuse it (good: no double ride), but the message says "Check the
  internet connection" (A6), which sends them looking for the wrong
  problem. Also, if the resident cancels at the same moment, Answer can turn
  the cancelled alert back into "connected".
- **Fix:** do Answer in a transaction. Read the alert; if it is no longer
  "ringing", stop and show "Another dispatcher already answered this alert"
  (or "The resident cancelled this alert").
- **Risk: Medium.** It's a small change, but in the most important button
  of the app, so test it well.
- **Test:** two dispatcher accounts in two browser windows (one normal, one
  private). Send an alert and click Answer in both at the same moment: one
  gets the form, the other sees the message. Then the normal case: one
  dispatcher answers, the resident's phone counts down and calls, and
  Submit works.
- **Until then:** only one dispatcher answers alerts during the demo.

#### A2. Removed staff and drivers keep their database powers (NEW; adds to Known-Issue "Deactivating does not disable the login")
- **What:** The rules decide who is staff or a driver by `role` only
  (`firestore.rules:25-28`). Deactivate, Suspend and Disable only change
  `accountStatus` (`features/admin/services/adminOperationsService.js:162-199`).
  The app's screens lock a Deactivated person out, but their login still
  works. With their own program, a deactivated Dispatcher can still read
  every user's phone number and address, every ride and every alert, and a
  deactivated Admin can still change other accounts.
- **Do this now (no code):** when someone leaves, (1) change their role in
  Operations (for example to Resident), and (2) disable their login in
  Firebase Console → Authentication.
- **Fix later:** in the rules, `isStaff()`, `isAdmin()` and `isDriver()`
  also require an active status: "Active" for staff, "Approved" for drivers.
- **Risk: Medium.** Any staff profile whose `accountStatus` isn't exactly
  "Active" is locked out at once. Check every staff document in the Console
  first.
- **Test:** the golden path (section 8) for every role. Then deactivate a
  test dispatcher: their website shows "Account disabled", and the Rules
  Playground says Denied for a read of `users` as that uid.

#### A3. Owners can change any field of their own rides and alerts (KNOWN #3, #4; drivers are NEW)
- **What:** For rides, alerts and assignments, the update rules only check
  *whose* document it is, not *which fields* change
  (`firestore.rules:177-179, 190, 240`). So, with their own program, a
  resident could mark their ride "Completed", or move it into another
  person's account (the owner is only checked *before* the change). An
  assigned driver could change any field of the ride. The app itself never
  does this.
- **Fix later, in two steps:**
  1. Easy first step: the owner can't move a document to someone else. Add
     `request.resource.data.residentId == resource.data.residentId` to the
     resident's part of the update rules.
  2. Bigger step: a list of the fields each role may change, for example
     `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`.
- **Risk:** step 1 is **Low**, because the app never changes `residentId`.
  Step 2 is **Medium-High**: if the list forgets one field the app saves,
  that button stops working. For example, an alert gets `lastActiveAt` (the
  heartbeat) and `location` and `pickupLocation` (the GPS). Do one
  collection at a time.
- **Test:** every button that saves to that collection. For alerts: send,
  heartbeat (wait 1 minute), "Location: sent", Cancel, Done. For rides:
  create, cancel, every driver step, Assign, emergency Submit.

#### A4. Fake sign-up records can be made (NEW)
- **What:** Any logged-in account, even one with an unverified email, can
  create its own `residentVerifications` or `Driver_Applications` record
  (`firestore.rules:253-256, 270-271`), naming any barangay and any photo
  link. It appears in that barangay Admin's list, and the Admin's screen
  loads the photo from whatever web link was given.
- **Fix:** require `request.auth.token.email_verified == true` there (like
  the profile rule already does), and check that the photo links start with
  your Cloudinary address.
- **Risk: Low–Medium.** The real sign-up already verifies the email before
  these records are saved. Check the order in `app/register-resident.jsx`
  and `app/register-driver.jsx` first.
- **Test:** sign up a new resident with email and one with Google, and a
  new driver. All three reach "Submitted", and that barangay's Admin sees
  them.

### Things that work wrong

#### A5. The Admin's activity log shows a random 50 lines (NEW)
- **What:** the same mistake as C2: `limit(50)` without "newest first"
  (`features/admin/components/AdminOperationsPanel.jsx:55`). Once there are
  more than 50 log lines, a new action may not appear in the log.
- **Fix:** add `orderBy("createdAt", "desc")` before `limit(50)`. Every log
  line has `createdAt` (`features/admin/services/adminOperationsService.js:31-42`).
- **Risk: Low.**
- **Test:** change a test account's status with a reason → the line appears
  at the top of the log.
- **Demo note:** if you plan to show the activity log in the demo, check it
  first. This fix can go together with C2.

#### A6. A misleading message when the emergency form is refused (NEW)
- **What:** every Firebase error in the form shows "Check the internet
  connection and try again"
  (`features/dispatcher/components/EmergencyRequestForm.jsx:205`). A refusal
  by the rules (for example after A1) gets the same message.
- **Fix:** for the `permission-denied` error, say "This alert belongs to
  another dispatcher now. Close the form."
- **Risk: Low** (text only).
- **Test:** use the two-browser test from A1. Also turn off the internet and
  Submit: it should still say "check the internet".

#### A7. No sound when an alert rings on the dispatcher website (NEW)
- **What:** the "Incoming Emergency Call" pop-up is the only signal. There
  is no sound and the browser tab doesn't change (I found no sound code). A
  dispatcher who is in another tab or looking away won't notice.
  PRODUCT.md principle 2 says unanswered calls are surfaced "loudly".
- **Fix:** while an alert rings, change the tab title (for example
  "EMERGENCY – SakayNa") and play a short sound. Website only, and no new
  package is needed (a browser can play a sound file).
- **Risk: Low–Medium.** Browsers only allow sound after the person has
  clicked on the page once (the dispatcher did, when logging in), so also
  test right after a page reload.
- **Test:** the dispatcher is in another tab → send an alert → the tab
  title changes and the sound plays. Answer or Decline → it stops.
- **Until then:** keep the dispatcher tab in front.

#### A8. The same van can be given twice at the same moment (NEW)
- **What:** Assign and the emergency form check, inside their transaction,
  that the *driver* is still Available, but not that the *van* is still
  free (`features/dispatcher/services/dispatcherAssignmentService.js:8`,
  `:98`). Which vans are free is worked out on each dispatcher's own screen
  (`app/dispatcher-home.jsx:399-448`). So two dispatchers clicking at the
  same moment could give one van to two drivers. The rules also don't stop
  a second ride for a driver who hasn't accepted the first one yet (the
  screen does, but only on that dispatcher's computer).
- **Fix:** inside the transaction, read the van and stop if it is already
  held for another ride that is still going.
- **Risk: Medium.** Old vans may have leftover "held" data (the screen
  accepts vans whose status still says "Assigned"), which would wrongly
  block them. Check the vehicles data first.
- **Test:** two dispatcher windows, the same van, two rides, click Assign
  together → one works, the other gets a clear message. Then a normal Assign
  still works.
- **Until then:** with one dispatcher, this can't happen.

#### A9. The driver app re-saves the driver's name every time it opens (NEW, not confirmed)
- **What:** when the driver app opens, it saves `presence: "Online"` and
  also the name, email and role (`app/driver-home.jsx:209-219`), using
  `profile?.fullName ?? displayName`. Each screen loads its own copy of the
  profile (`lib/session.js:91`: the login gate and the driver screen each
  open their own listener). If the "approved" check finishes before that
  screen's copy of the profile arrives, the saved name is the fallback (the
  first part of the email), replacing the real name. I could not prove this
  happens: the order is usually right, but it depends on timing.
- **Fix:** save only `presence` and `lastSeenAt` there.
- **Risk: Low**, but it needs a new APK.
- **Test:** open the driver app several times, also with slow internet.
  Admin → Users still shows the real full name, and the dispatcher still
  sees "app closed" and "app open" correctly.

### Duplicate logic

#### A10. A ride is built in two places and read with guesses in four screens (NEW)
- **What:** a ride document is created by `createResidentRequest`
  (`features/resident/services/residentRequestService.js:26-58`) and by
  `createEmergencyRide` (`features/dispatcher/services/dispatcherAssignmentService.js`).
  Each screen also fills in missing fields with its own guesses. For
  example, the dispatcher queue shows a ride with no priority as
  "Emergency", and a ride with no destination as "Nearest available
  response center" (`app/dispatcher-home.jsx:520-535`). Parts A and B
  showed the cost: one new field had to be added in several places.
- **Fix:** one small file that lists every ride field with its default,
  used by both creators. Screens use the shared label helpers
  (`features/resident/utils/requestMapper.js`) instead of their own guesses.
- **Risk: Medium.** It touches every role's screens, so do it in small
  steps, one screen at a time.
- **Test:** golden path steps 1 and 3 (section 8). Take screenshots of each
  role's ride screens before the change, and compare after.

#### A11. Small copies of the same rule (NEW)
- **The "SKN-…" reference** is built in 6 files
  (`residentRequestService.js:13`, `dispatcherAssignmentService.js`,
  `EmergencyRequestForm.jsx`, `dispatcherRequestMapper.js`,
  `driverMissionMapper.js`, `requestMapper.js`).
  Fix: one `makeReference(id)` in `lib/`. **Risk: Low.**
  Test: a new ride and a new emergency ride show the same SKN on the
  resident, driver, dispatcher and admin screens.
- **The office phone** (`systemSettings/operational`) is read in 5 places
  (resident-home, driver-home, dispatcher-home, AdminOperationsPanel,
  adminOperationsService). Fix: one `loadOfficePhone()` in `lib/`.
  **Risk: Low.** Test: ☰ → Help shows the number; the driver's "Call
  dispatch" works; with a dispatcher who has no phone, the resident's
  countdown says "the dispatch office".
- **Four date helpers** do almost the same thing (`getDate`, `toMillis`,
  `toDate`, `getDateFromValue` / `getTimestampMillis`). Fix: use
  `lib/dates.js` everywhere. **Risk: Low–Medium** (sorting by date is easy
  to break). Test: resident History, the admin lists, the driver's ride
  history and the activity log are all newest first.
- **Log out** is copied into 5 screens with the same comment (admin-home,
  dispatcher-home, driver-home, driver-status, ResidentSideMenu). Fix: one
  `logOutAndGoToLogin(router)` in `lib/session.js` (the driver version also
  saves "Offline" first). **Risk: Low–Medium** (the log out order was a
  recent fix). Test: log out from all four roles, on the phone and the
  website → the Log In page, with no error; the dispatcher sees the driver
  as "app closed".
- **Two StepperButton components** (resident form and emergency form).
  They are different enough (1–6 vs 1–50). Fine to leave.

### Slow parts

#### A12. The dispatcher screen downloads whole collections (NEW)
- **What:** the dispatcher page keeps 9 listeners open
  (`app/dispatcher-home.jsx:508-742`). Some have no limit and keep growing
  forever: every Driver profile, including Pending and Rejected applicants
  (`:560`); every vehicle (`:671`); every "I can't do this ride" report ever
  made (`:653`); and every driver schedule ever made (`:688`). Every change
  to any of them is sent to every open dispatcher screen (for example, each
  time a driver opens their app, it saves `presence`). The whole page also
  redraws every 10 seconds (`:756-759`).
- **Why it matters:** fine for the demo. With many barangays and months of
  data, the page gets slower and uses more of the free plan's 50,000 reads
  per day.
- **Fix (one at a time):** drop the schedules listener (A13); read only the
  "can't do this ride" reports from the last 2 days; read only Approved
  drivers.
- **Risk: Low–Medium** each. A new query may need an index; if so,
  Firestore's error message in the browser console gives a link that
  creates it.
- **Test after each:** the Drivers column, the "Needs a new driver" banner,
  the "Reported: can't do a ride" warning, the vans in the Assign window,
  and Show on map all look the same as before.

#### A13. A dead feature still costs reads: driver schedules (NEW)
- **What:** the driver app's "Add Availability" schedule pop-up can't open
  anymore: nothing calls `setSchedulePromptOpen(true)`
  (`app/driver-home.jsx:154`, pop-up at `:943`). But the driver screen still
  listens to the driver's schedules (`:399`), the dispatcher listens to all
  schedules (`app/dispatcher-home.jsx:688`), and schedules still affect
  which "Driver-Owned" vans are offered (`app/dispatcher-home.jsx:407-447`).
  The product no longer uses driver-owned vans (PRODUCT.md: "Drivers do not
  register vehicles").
- **Fix:** remove the schedule code and listeners, and the driver-owned van
  rules, in one planned change.
- **Risk: Medium.** It touches the van logic for Assign, and needs an APK
  for the driver part.
- **Test:** the Assign window and the emergency form offer the same vans as
  before, and all three driver pages work.

#### A14. The driver screen has two listeners on the same data (NEW)
- **What:** `app/driver-home.jsx:296` and `:370` both listen to *all* of the
  driver's assignments ever made. One finds the current ride, the other
  builds the history.
- **Fix:** one listener for both, with only the newest 50 for the history
  (the `driverId` + `updatedAt` index already exists).
- **Risk: Low–Medium**, and it needs an APK.
- **Test:** a new ride appears; the history is newest first; a completed
  ride moves to the history.

#### A15. Resident history loads every request, then keeps 50 (NEW)
- **What:** `features/resident/hooks/useResidentRequests.js:25-35` reads
  *all* of a resident's requests, then throws away all but the newest 50.
  The comment says this avoids needing an index, but the index
  (`residentId` + `createdAt`) is already in `firestore.indexes.json`.
- **Fix:** `orderBy("createdAt", "desc"), limit(50)` in the query.
- **Risk: Low–Medium.** A brand-new request has no server time for a moment
  (#19), so check that it still appears at the top right away.
- **Test:** send a request → it shows at once on the home card and at the
  top of History. Cancel it → both update.

#### A16. Maps are loaded and looked up again every time (KNOWN: Known-Issue "Free map server")
- **What:** each map loads the Leaflet map code from unpkg.com
  (`components/LeafletMap.jsx:17`). For any place without map points (for
  example typed destinations), it asks Nominatim again every time the map
  is drawn (`:22`). If unpkg is slow or down, maps stay blank; Nominatim may
  block heavy use.
- **Fix later:** save the found map points on the ride, or switch map
  provider (F10).
- **Risk: Medium** (maps are on every role's screens).
- **Test:** every map on every role.

### Hard to maintain

#### A17. Four very large screen files (NEW)
- **What:** `app/resident-home.jsx` (1,646 lines), `app/dispatcher-home.jsx`
  (1,502), `app/admin-home.jsx` (1,488), `app/driver-home.jsx` (1,406). Each
  one mixes database listeners, the rules for what to show, and the screen
  itself. That makes them hard to read and hard to change safely.
- **Fix:** move one piece at a time into `features/<role>/components` or
  `hooks`, the way `EmergencyRequestForm` and `DriverRideCard` were done.
  Start with pieces that rarely change (for example the resident Settings
  pop-up, or the dispatcher's Drivers column).
- **Risk: Medium** per piece. It only moves code, but it is easy to miss a
  variable.
- **Test:** that screen's part of the golden path, plus opening every
  pop-up on that screen.

#### A18. Code kept only for old APKs (NEW; on purpose for now)
- **What:** for example, the old `availability` field next to `dutyStatus`
  (about 17 lines), Decline (`declineAssignment`), the old "Meal" break name
  (`firestore.rules:110-112`), and `saveVehicleChecklist`
  (`features/driver/services/driverMissionService.js:20-40`).
- **Fix:** once every tester has demo-ready-14 or newer, remove these in one
  planned change.
- **Risk: Medium** (an old APK would break; that is why it waits).
- **Test:** the golden path on the newest APK; the Admin Overview "Available
  Drivers" number is still right.

#### A19. Colors typed by hand (NEW)
- **What:** about 218 color codes are typed directly in the four big
  screens (66 in dispatcher-home, 54 in driver-home, 49 in admin-home, 49 in
  resident-home), even though `constants/design.js` holds the DESIGN.md
  colors. Some are retired colors, for example the old green `#06774B` in
  the dispatcher queue (`app/dispatcher-home.jsx:66`).
- **Fix:** replace them with `DESIGN_COLORS` names when each screen is redone.
- **Risk: Low** (looks only).
- **Test:** look at each screen and compare with screenshots.

#### A20. Status words typed by hand (NEW)
- **What:** "Assigned", "In Progress", "Cancelled" and others are typed as
  text in many files, although `constants/app.js` has `REQUEST_STATUSES`
  and `MISSION_STATUSES`. One typo (for example "In progress") would
  silently break a filter.
- **Fix:** use the constants whenever a file is touched anyway.
- **Risk: Low.**
- **Test:** the filters in resident History, the dispatcher queue, and the
  admin lists.

#### A21. Leftover logic in the dispatcher's assignment listener (NEW)
- **What:** `app/dispatcher-home.jsx:614-622` looks for "Completed" and
  "Declined" assignments to build a "marked … as …" message, but the query
  only returns "Assigned" and "In Progress" ones (`:606`). So the message
  can only ever say "In Progress", for whichever ride happens to come first.
- **Fix:** remove the unused parts.
- **Risk: Low.**
- **Test:** Assign a ride and go through the driver steps; the dispatcher
  screen looks the same as before.

---

## 7. FUTURE WORK: ideas for the capstone paper

#### Growing to many barangays

- **F1. Barangay-based dispatch.** Today every dispatcher sees every
  barangay: one city-wide queue, and every alert rings for every
  dispatcher. The "service areas" an Admin can save for each dispatcher
  (`features/admin/services/adminOperationsService.js:218-227`) are never
  used by the dispatcher screen. With many barangays, the queue gets long
  and mixed, and every dispatcher gets every alert (more A1 cases). Idea:
  filter the queue and the alerts by the dispatcher's service areas. The
  `barangay + status + createdAt` index already exists.
- **F2. Barangay vehicle pools.** Vans "belong to the barangay"
  (PRODUCT.md), but nothing links a van to its barangay in the Assign
  window, so any van can be sent anywhere. Idea: a `barangay` on each
  vehicle, with the barangay's own vans shown first.
- **F3. One office number per barangay.** Today there is one
  `publicOfficePhone` for the whole city.
- **F4. Beyond Toledo City.** The barangay list (`lib/barangays.js`), the
  map center and the search box (`components/LeafletMap.jsx:6, 12`) are
  written into the code. Another city would need code changes. Idea: keep
  them in a settings document.
- **F5. Watch the free plan.** Firebase Console → Usage shows the reads
  per day; the free plan allows 50,000. Before a pilot, measure one busy
  day (A12 is the biggest reader).

#### A small trusted server (on purpose not built now)

- **F6.** Leaving out a server is a deliberate choice (PRODUCT.md principle
  5), and `docs/PHASE_8_BACKEND.md` already plans part of one. For the
  paper, here is what it would make possible:
  - close stuck "ringing" alerts automatically (#8), and know when a phone
    stopped answering (C3), instead of guessing from a timer;
  - punch out forgotten shifts automatically;
  - **push notifications** (F7);
  - private document photos through signed uploads (today the links are
    public: Known-Issue "Document photo links are public");
  - real account deletion, and switching off a removed person's login (A2);
  - limits on how many alerts or requests one account can send.
- **F7. Push notifications.** `expo-notifications` is installed but only
  asks for permission (#29). With F6, drivers could get a "New ride"
  notification and dispatchers an alert notification, even with the app
  closed.

#### Other ideas

- **F8. Incidents with many patients.** 1–50 patients still create one ride
  for one van (Known-Issue). Idea: "add another vehicle" to the same incident.
- **F9. Live driver tracking** (KNOWN: driver-location-plan.md, "Not now").
- **F10. A map provider plan** (KNOWN: Known-Issue "Free map server").
- **F11. Automated tests.** Two kinds would help most:
  - **Rules tests** with the Firebase Emulator (a pretend Firebase on your
    computer): small scripts that check, for example, "a Pending driver
    can't change a vehicle" (C1) or "a resident can't create a ride for
    someone else". They run in seconds after every rules change.
  - **Unit tests** for helpers that have no screen:
    `requestValidation.js`, `requestOptions.js` (schedule times),
    `lib/dutyTime.js`, and the patients box check.
  These need new development tools (Jest, the emulator), so this is a
  planned project, not a quick fix.
- **F12. Privacy and health data.** Emergency rides now store health
  details (age, conscious, breathing, incident details). The resident, the
  assigned driver, dispatchers and admins can read them, and they are kept
  forever. For the paper: the Philippine Data Privacy Act of 2012 (RA
  10173). How long should these details be kept, who may read them, and how
  does a resident ask for their data to be removed? (This pairs with F6 for
  private photos.)

---

## 8. How to test by hand (there are no automated tests)

**What you need:** a resident phone and a driver phone, both with the
newest APK; a computer with two browser windows (one normal, one private)
for two dispatcher accounts; and an Admin account.

**How each kind of change goes live:**

| A change in… | How it goes live | New APK? |
|---|---|---|
| `firestore.rules` | the safe way: commit → compare the live rules with the committed file → deploy → compare again (`--project sakayna-571e8`) | No |
| dispatcher or admin screens (website) | test with `npx expo start --web`, then master → main (CLAUDE.md) | No |
| resident or driver screens (phone) | development build first, then the EAS build checklist (CLAUDE.md) | Yes |

**Testing rules without the app:** Firebase Console → Firestore → Rules →
**Rules Playground**. Pick the kind of request (for example "update"), a
path (for example `vehicles/<a van's id>`), and "Authenticated" with a test
user's uid. It answers **Allowed** or **Denied**. You can try changed rules
in the editor there before you publish them.

**The golden path.** Run it after any fix, whatever the fix was:
1. **Ride:** resident sends a request → the dispatcher sees it → Assign →
   the driver goes Accept → En route → Arrived → Picked up → Complete → the
   van is offered again. The resident's card follows every step.
2. **Cancel:** assign a ride, then the resident cancels → the driver's app
   shows the note and the driver and van are free again.
3. **Emergency:** the resident sends an alert → the dispatcher Answers →
   the phone counts down and calls → the form is filled in → Submit → the
   driver gets the ride with the quick facts → the resident's "Your ride"
   card shows it.
4. **Duty:** the driver punches in, takes a break, resumes, punches out →
   Admin → Duty Records shows the lines.
5. **Admin:** approve a test resident → their banner disappears. An
   unanswered alert gets the "unanswered" badge after 30 seconds (C2).

---

## 9. Demo-day checklist (no code changes)

1. **Clean stuck alerts.** Firebase Console → `callSessions` → set any old
   "ringing" alert to "cancelled" (KNOWN #8 and #34: a stuck alert can show
   in front of a real one).
2. **One dispatcher answers alerts** (A1).
3. **The resident keeps SakayNa on screen until a dispatcher answers**, and
   a dispatcher answers within 2 minutes (C3).
4. **Try the Admin's Emergency Calls list with a fresh alert** before the
   demo (C2). If it doesn't appear, don't show that panel, or do the C2 fix.
5. **Keep the dispatcher tab in front**, because there is no sound (A7).
6. **Everyone is on demo-ready-14.**
7. **The office phone is saved** (Operations → operational settings). It is
   the fallback for "Call the office" and "Call dispatch".
8. **Test drivers punch in before the demo and punch out after it** (KNOWN:
   a forgotten punch out stays "Available").

---

## Words used

- **Collection / document:** a folder of filled-in forms / one form, in the
  Firestore database.
- **Rules (`firestore.rules`):** the guard at the database door. It decides
  who may read or save each document. With no server, it is the only real
  protection.
- **Listener:** a subscription to the database ("tell me every time this
  changes"). It costs reads every time something changes.
- **Transaction:** "read, check, then save everything together, or nothing".
- **Batch:** "save everything together, or nothing", without reading first.
- **Index:** a ready-made sorted list that lets Firestore answer a question
  quickly. Questions that sort or filter on several fields need one.
- **Free plan reads:** Firebase's free plan allows 50,000 document reads a
  day. After that, reads stop until the next day.
- **APK:** the Android app file. Phone screen changes need a new one;
  website and rules changes don't.
