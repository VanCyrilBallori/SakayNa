# SakayNa handoff

Checked October 11, 2026. This records the current state; it does not approve new code changes.

Task 1.1 deployment and owner-reported test results were added October 13, 2026.
Task 1.3 deployment and owner-reported test results were added October 14, 2026.
Task 1.2 deployment and owner-reported test results were added October 14, 2026.
The demo-ready-17 APK release was added October 14, 2026.
The demo-ready-18 APK release (local build) and the new defense set were added October 18, 2026.

The owner says the survey demo is finished. The thesis defense is **October 23, 2026**. The app is frozen: only bug fixes and small, safe changes. The test Admin's barangay is **Daanglungsod, Toledo City**. These details come from the owner; older notes have not caught up.

## 1. What the system does

SakayNa helps Toledo City residents ask for a barangay vehicle. A human Dispatcher chooses a driver and vehicle. There are no fares or payments. It is a Capstone project, not a confirmed LGU pilot or endorsement.

| Person | Their job |
|---|---|
| Resident | Signs up with proof of residency, waits for approval, asks for a ride now or later, follows its progress, or sends an emergency alert. |
| Dispatcher | Uses the website to answer alerts, assign rides, and check drivers' duty status and last known location. |
| Driver | Punches in, takes breaks, accepts rides, marks each trip step, completes rides, and punches out. |
| Admin | Reviews residents and driver applications, manages accounts/vehicles, creates Dispatchers, and reads emergency calls, duty records, reports, and activity logs. |

A normal ride goes: request -> Dispatcher assigns -> Driver accepts -> En route -> Arrived -> Picked up -> Completed. Residents can cancel before Accept. Before pickup, **I can't do this ride** returns the ride to dispatch. After pickup, the driver calls dispatch about problems.

For emergencies, an alert reaches the Dispatcher first. After Answer, the Resident's phone counts down three seconds, then calls the Dispatcher. The Resident can cancel the countdown. This uses their SIM, not an internet voice call. The number used is the Dispatcher's account phone, then their Operational phone, then the office number.

During the call, the Dispatcher fills in an Emergency Request Form: type, priority, patient count, incident details, age, conscious/breathing facts, route, driver, and vehicle. Submit saves one assigned ride and links it to the alert. **Even 50 patients still creates only one driver/vehicle assignment.** The alert stays connected until someone ends it.

Drivers share location only at Punch in, Accept, En route, Arrived, and Picked up. It is a last known place, not live tracking. Dispatchers and the driver themselves can read it. Punch out removes it.

One Expo SDK 54 / React Native JavaScript project makes the Android app and website. Firebase handles login and the shared database. There is no separate server or Cloud Functions backend. `firestore.rules` guards database access; hiding buttons alone is not protection. Cloudinary stores document photos, OpenStreetMap/Nominatim provide maps/address lookup, and Vercel hosts the website.

Resident/Driver application reviews belong to their barangay's Admin. Task 1.1 now also limits Admin user-profile writes to non-Admin accounts in their own barangay and approved fields. Users-list reads, other Admin tools and dispatch remain largely city-wide. Trusted test staff are assumed for the demo.

## 2. Current state

### Task 1.2: staff must be Active (October 14, 2026)

- **Rules:** `d464a70`, confirmed in local Git. The owner reports deployment to
  `sakayna-571e8`, live ruleset
  `projects/sakayna-571e8/rulesets/e9a236c9-131a-4e4a-b1c4-9436f87b7573`. The
  owner confirms the before comparison said **EXACT MATCH: 98db008**, the dry
  run compiled successfully, and the after comparison said **EXACT MATCH: yes**.
- **Rule:** `isAdmin()` and `isDispatcher()` also require the caller's own
  `accountStatus == "Active"` (new helper `myAccountStatus()`). `isStaff()` is
  built from them. Driver and Resident checks were not changed.
- **A2 fixed for database access:** Pending, Rejected, Deactivated or blank
  staff accounts are refused. Staff may still read their own profile.
- **Playground (Get):** admin1 and dispatcher0 reading
  `activityLogs/0NDrR4BLui8JBXpSmgyK`: Allowed. dispatcher1 (no `accountStatus`
  field) reading the same line: Denied; its own profile: Allowed;
  dispatcher0's profile: Denied. Driver jeb reading a vehicle: Allowed.
- **Real app:** admin1 Overview, Users and Logs: pass; dispatcher0 full
  emergency (answer, form Submit, driver accepts): pass; Driver jeb punch
  in/out: pass; Resident ride request: pass; dispatcher1 set Active,
  deactivated by admin1, shows "Account disabled", restored to Active: pass.
- **Staff data now:** dispatcher1 has `accountStatus` "Active" (set by the
  owner in the Console for the deactivate test). The Add Dispatcher test
  account `QEkP4aGH54OMZ6GVz9mdAmjl95J2` was found still in Firestore on
  2026-10-14 and deleted then from Authentication and Firestore; its
  activityLogs line is kept.
- **Limits:** a refused staff member can still sign in to Firebase; blocking
  sign-in needs a server. **Route gate fix done** in `258258e`: staff who are
  not Active see "Account not active"; tested on demo-ready-17 (dispatcher1
  Active → Pending → Active). Full results are in `architecture-review.md`.

### Task 1.3: Admin activity log (October 14, 2026)

- **Rules:** `98db008`, confirmed in local Git. The owner reports deployment to
  `sakayna-571e8`, live ruleset
  `projects/sakayna-571e8/rulesets/f4df0e81-6109-488e-9304-eb71ca94caa8`, and
  confirms the after comparison said **EXACT MATCH: yes**. Before-comparison
  and dry-run results were not supplied in this report. No independent live
  comparison or repeat tests occurred during this documentation update.
- **Rule:** only an Admin may create `activityLogs` lines, using their real
  signed-in UID (`actorId`), real role (`actorRole == myRole()`) and Firebase's
  time (`createdAt == request.time`). Only eight field names are allowed:
  `action`, `actorId`, `actorRole`, `targetType`, `targetId`, `summary`,
  `metadata`, `createdAt`. Staff may still read; the rule denies updates/deletes.
- **A5 fixed and website released:** `94d2cb3` loads the newest 50 with
  `orderBy("createdAt", "desc"), limit(50)` in `AdminOperationsPanel.jsx`.
  The owner confirms testing and website release; newest-first Logs passed.
- **Real-app results:** Driver jeb status change/restore with both log lines:
  pass; dispatcher0 phone edit/restore: pass; vehicle create/edit/archive:
  pass; new test Resident approval: pass (account deleted afterwards, UID not
  recorded); newest-first Logs: pass. Add Dispatcher test account: pass (live site; test
  account found still in Firestore on 2026-10-14 and deleted then).
- **Playground:** caller `kcwgrnPTETbVPS144oHfyyyAxfO2` except dispatcher0 and
  signed-out cases. a: another person's actorId, b: actorRole "Dispatcher",
  c: extra field, d: create as dispatcher0, e: signed-out create — all **Denied**.
  f (update) and g (delete) were run on one real existing log line
  (`activityLogs/0NDrR4BLui8JBXpSmgyK`, from 2026-09-20); both were **Denied**.
  An earlier attempt without a real document ID is not counted.
- **Limits:** the rule proves who wrote a line and when, not that the action
  really happened. Task 1.2 (`d464a70`) later refused staff who are not Active. Edit/delete
  denial was tested on one real log line only. Full supplied results
  and missing details are in `architecture-review.md`.

### Task 1.1: Admin user-profile write restriction (October 13, 2026)

- **Rules:** `c92f5a1`, confirmed in local Git. The owner reports deployment to `sakayna-571e8`, ruleset `projects/sakayna-571e8/rulesets/a8ceb049-1e5f-41d8-aeb9-dfbdc1c51292` (copied exactly as supplied). The owner confirms the after comparison said `EXACT MATCH: c92f5a13ecb59f67b412ee5de117482c0d71189c` (Yes). Before-comparison and dry-run results were not supplied; no independent live check occurred during this documentation update.
- Admin updates to other `users/{userId}` profiles now require a non-Admin target with a non-empty barangay exactly matching the Admin's barangay. Only the 24 approved fields may change; role and barangay stay unchanged. The field is `accountStatusReason`, and role-change fields are excluded.
- Add Dispatcher requires the Admin's barangay to be non-empty and the new profile's barangay to match it. The self-update clause and other collection rules are unchanged.
- **User-profile write issue fixed; Users-list reads remain city-wide.** Staff account-status enforcement was added later by Task 1.2 (`d464a70`); city-wide writes to other collections remain a separate open item.
- **Task 1.1 website release:** Step 1 at `b62c724`. The owner confirms testing, commit, website release and live checks passed. Edit Account's barangay is read-only; other-barangay/missing-barangay/Admin accounts are view only; Add Dispatcher uses the Admin's barangay; refused updates/reviews have a friendly message.
- **Test record:** all 14 supplied results are recorded in `architecture-review.md`, with missing details marked **not supplied**. Playground tests 1-5 were Denied as expected; test 6 was Allowed as expected. The owner reports Resident approval, "can Approve or Reject" for Gwen, and Passed for Driver jeb status change/restore, dispatcher0 phone edit/restore, punch in/out, emergency alert answered/form finished, and the other-barangay view-only UI. No failure appears in the latest supplied list.
- **Add Dispatcher (test 13):** pass (live site; test account found still in Firestore on 2026-10-14 and deleted then). **Not tested:** the required missing/empty-barangay denial case, for which no result was supplied. Gwen's specific saved decision and emergency mission completion were not reported. Real-app caller UIDs, separate expected-result values and generated duty/emergency document IDs were not supplied.
- Staff accounts made by hand in the Console must use the exact barangay spelling. A typo or missing value prevents Admin management; correct the data in the Console rather than loosening these rules. See Known-Issue.md.

### Earlier website release: a25dae1 (October 11, 2026)

- Released master to main at **a25dae1**, one command at a time, with a fast-forward merge. Vercel completed successfully.
- This includes the four tested and committed changes: remove Completion Notes, fade the completion backdrop, hold-to-show password eyes, and National ID proof of residency.
- Live page checks confirmed one "Hold to show password" eye on Log in, two on Create Account, and the updated Privacy Policy text. The working folder returned to master.
- The separate completion saving fix below is tested and committed on master and included in APK 16. It is not part of this website release.

### Earlier website release d62b195 (October 11, 2026)

- Released master to main at **d62b195**: landing header fix, Terms/Privacy links in a new tab with a back arrow to Home, Admin Users search, and corrected landing wording. Vercel's production deployment succeeded; the owner confirms live checks passed.
- **No new APK is needed for this website-only release.**
- **Next: phone changes** — National ID, Completion Notes, fade backdrop, and hold-to-show eye. These are not included in this release.

### Phone changes (October 11, 2026)

- #6 (remove Completion Notes), #7 (fade the completion backdrop), and #8 (hold to show passwords) are tested and committed by the owner.
- #5 adds **National ID** between Certificate of Indigency and Other government document with your address. It is tested and committed by the owner.
- The existing `documentType` field saves the label. Admin review already uses the saved label, and the photo viewer uses the saved photo link. No database rules change or deployment is needed, and older records keep their labels.
- The Privacy Policy draft names National ID as a government ID and says document photos, including National ID photos, use public Cloudinary links. Use sample documents for testing (Known-Issue.md).
- All four phone changes are tested and committed and released on the website at a25dae1. They are also included in the phone-tested **demo-ready-16** APK, along with the separately approved outcome/issues saving fix.

### Completion saving fix (October 11, 2026)

- The owner approved this separate fix after all four phone changes were tested and committed.
- `features/driver/services/driverMissionService.js` now saves `completionOutcome` and `completionIssues` on `driverAssignments/{assignmentId}` when completion succeeds. Issues are trimmed, capped at 300 characters, and saved as `""` when blank.
- The fields are written in the existing transaction with the ride's Completed status/time, driver/van availability, and Run end duty record. Failed completion saves nothing. Duty Records still use outcome `"Completed"`.
- Old records are not rewritten. Existing `completionNotes` are preserved when the new form supplies no note.
- Local mocked-transaction checks passed for with/without issues, blank/missing issues, 300-character limits, all ride steps, availability, duty records, older data, and failed/cancelled completion.
- The owner confirms the saving fix was tested and committed at **39e4583**, and the resulting APK 16 was tested on their phone. Check the two new fields in Firebase Console -> driverAssignments; existing history/Admin screens do not display them.
- No rules change or deployment was needed. The fix is included in **demo-ready-16**; the production website remains at a25dae1 and does not yet include this saving fix.

### Android APK (the installation file)

#### Latest release: demo-ready-18 (October 18, 2026) — defense APK

- **Phone tested:** the owner reports the APK passed their phone test.
- **Tag/source:** annotated tag **demo-ready-18** points exactly to
  **a18955c** (Merge big-update into master), the code used for the APK. The
  tag is pushed to GitHub. The live website is also at `a18955c`.
- **Local build, not EAS:** EAS free builds are used up until November 1, so
  this APK was built on the owner's Windows computer (Microsoft OpenJDK 17,
  Android SDK, Expo SDK 54). There is no EAS build ID, no download link and no
  fingerprint compare. Master was clean at `a18955c`; `npx expo install --check`
  reported "Dependencies are up to date"; then
  `npx expo prebuild --platform android --clean` and, in `android/`,
  `.\gradlew.bat assembleRelease` (BUILD SUCCESSFUL). The `.env` values match
  the EAS "preview" environment (all 10 `EXPO_PUBLIC_*` names compared).
  `android/` is in `.gitignore`. Prebuild changes the `android`/`ios` scripts in
  `package.json`; that change was undone with `git restore package.json`.
- **File:** `C:\Users\bOdzfest\Desktop\SakayNa-APKs\SakayNa-demo-ready-18.apk`,
  116,491,720 bytes, SHA-256
  `a5793779f4d7f1d22d6aaea1c07a9288da46e720847ef13c69f61ef50f2f4a8d`.
  versionCode 1, version 1.0.0. Share the file directly (Drive/Messenger).
- **Debug-signed:** signed with the Expo template's debug key
  (SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`), not
  the EAS key. **Testers must uninstall the old SakayNa first**, or Android says
  "App not installed". Fine for testers and the defense, not for the Play Store.
  Google sign-in only works if this SHA-1 is added to the Android app in
  Firebase Console → Project settings; whether it was added is not recorded.
- **Included since demo-ready-17:** Phase 3 tasks 3.1–3.14, 3.13b and 3.16,
  the dispatcher destination pin, and C3's 10-minute alert delay (`9ab2187`).
  Details are in ROADMAP.md "Progress on big-update". Rules are unchanged since
  `d464a70`.

#### Previous release: demo-ready-17 (October 14, 2026)

- **Phone tested:** the owner reports passes for the start screen (normal and
  large text), a full ride, an emergency with the form, dispatcher1 Active →
  Pending → Active, and logout.
- **Tag/source:** annotated tag **demo-ready-17** points exactly to
  **258258e538c7991151eb3d39c269d8231ed236a8** (`258258e`), the code used for
  the APK. The tag is pushed to GitHub. Later docs commits do not change the APK
  or the tag's source.
- **EAS Android preview build:** **34d17f8a-f311-43a7-bc86-7f2f7cfc33d2**,
  completed October 14, 2026. EAS records commit `258258e`.
- **Checklist passed:** master was clean before building (master, main and
  origin at `258258e`); `npx expo install --check` reported "Dependencies are up
  to date"; `eas fingerprint:compare --build-id 34d17f8a-f311-43a7-bc86-7f2f7cfc33d2 --environment preview --non-interactive`
  reported **matches**. Build and local fingerprint:
  `1a79f1aacec2bfe663831ac4e3819ea210c2392c` (same as APK 16: no native changes).
- **Included since demo-ready-16:** new start screen road picture with the logo
  at 20% (`960fca5`); Admin screens with the barangay locked, other-barangay and
  Admin accounts view only, Add Dispatcher using the Admin's barangay, and
  friendly refused messages (`b62c724`); Logs newest 50 first (`94d2cb3`);
  staff must be Active to enter, otherwise "Account not active" with Log Out
  (`258258e`); removal of unused files (`c0365c2`). Rules commits `c92f5a1`,
  `98db008` and `d464a70` live on Firebase and apply to every installed APK.
- **Download:** https://expo.dev/artifacts/eas/4eXRn5WsIvf0c_fhgym1zO5GN4-7EpuD6CHzQBPSQEU.apk
- **EAS link expiry:** October 28, 2026, after the October 23 defense.
- **Install:** Uninstall the old SakayNa app, then install this APK. No
  over-the-air updates: later phone code needs another APK.
- `tester-message.md` contains the link, changes, and test instructions.

#### Older release: demo-ready-16 (October 11, 2026)

- **Phone tested:** The owner confirms the new APK was tested on their phone.
- **Tag/source:** Annotated tag **demo-ready-16** points exactly to **39e45831631c6bb417bc4f8dd941633f38df30ea** (`39e4583`), the code used for the APK. Later tester-message/release-note commits do not change the APK or the tag's source.
- **EAS Android preview build:** **ed1042dd-1d81-4ba3-af4e-991d74108bd0**, completed October 11, 2026.
- **Checklist passed:** master was clean before building; `npx expo install --check` reported "Dependencies are up to date"; `eas fingerprint:compare --build-id ed1042dd-1d81-4ba3-af4e-991d74108bd0 --environment preview --non-interactive` reported **matches**. Build and local fingerprint: `1a79f1aacec2bfe663831ac4e3819ea210c2392c`.
- **Included:** Complete mission without the Completion notes box, with Issues encountered still optional, and with a fading dark background; hold-to-show password eyes; National ID proof of residency; the updated Privacy Policy; and saved `completionOutcome` / `completionIssues` on the driver's assignment. Issues are trimmed, capped at 300 characters, and empty when blank. Old completion notes and records are kept.
- **Download:** https://expo.dev/artifacts/eas/bij3WUHjKK9mVaTYRiAxOApXahaGUPAluF7zEPWab2Y.apk
- **EAS link expiry:** October 25, 2026, after the October 23 defense.
- **Install:** Uninstall the old SakayNa app, then install this APK. No over-the-air updates: later phone code needs another APK.

#### Older release: demo-ready-15

- Source **4103d0c**; EAS preview build **165bcbcf-2b0a-4e7c-9ccb-eab5a982a37e**. Release notes record phone testing and a matching native fingerprint. The build finished late October 5; tagging/release notes are dated October 6.
- Previous download: https://expo.dev/artifacts/eas/Ftw2zrDvzb7KWdJRq_SuG_KlkMU2ilX0BH8kLlaKTQ4.apk
- Recorded expiry: **October 19, 2026**. Use the APK 17 link above for the latest tested release.

Most completed driver/emergency work was already done **by** APK 15, rather than after it:

| Work | Release/evidence |
|---|---|
| Punch in/out, breaks, On a run, Admin daily time records (DTR) | APK 8; feedback in APK 9; driver-duty-plan.md |
| Driver card restyle, Accept without checklist, navigation, step timeline | APK 10; driver-home-restyle-plan.md |
| Ride/Map/Availability pages, inability reports, Call dispatch after pickup, Ride history | APK 11; driver-pages-plan.md |
| Location saved at steps and emergency auto-call | APK 12; location/auto-call plans |
| Correct Dispatcher phone choice and office wording | APK 13; emergency-auto-call-plan.md |
| Emergency form, quick facts, driver emergency card, logout fix | Form first released on website; later updates in APK 14 |
| Patients typing/step buttons, form colors, driver place strip/menu, Ride history below clock | Included by APK 15; 11df96a, 665baa6, a69fba5, e7ad6fb |
| C1: Approved drivers only for vehicle/schedule/checklist writes | 93867d3; rules deployed/tested per architecture-review.md; applies to installed APKs too |
| C2: Admin loads newest 100 alerts | ddda3f3; website tested/released per review; current query still sorts newest first |

### Website, branches, and later work

Website: https://sakay-na-delta.vercel.app. Vercel builds **main**; development uses **master**.

Before this handoff, local main/master and cached origin/main/origin/master all pointed to **d9ff664**, Admin Reports, October 6. A read-only GitHub check also confirmed both remote branch tips at d9ff664. The working folder was clean. **No committed app/rules work was only on master.**

The owner reports the later Admin changes are live. Git proves they reached remote main; it does not prove Vercel built them successfully. The public web reader could not open the site during this review. Vercel Ready status and signed-in pages were not independently checked.

At Task 1.1's release, local main was **b62c724**, and local master included rules commit **c92f5a1**. The latest owner-reported release is now Task 1.2: website route gate **258258e** (main and origin/main at `258258e`), and separately deployed rules **d464a70**, with owner-confirmed before and after comparisons. Git alone does not verify live Firebase rules. A rules deployment does not require releasing main again.

**Update October 18, 2026:** big-update (Phase 3) was merged into master at **a18955c**, and main and origin/main are at `a18955c`, so the live website is built from `a18955c`. Rules are still `d464a70` (no `firestore.rules` change since).

Changes after APK 15, already on both remote branches when checked:

| Commit | Change |
|---|---|
| 6133c19, d850e39 | Tester message and APK 15 release notes |
| be2d09a | Duty Records calendar date picker and break reasons |
| e9aa42e | Removed driver name, manual status, and owner UID from Admin vehicle cards/form |
| ba1c4c2 | Removed Change role from Admin Operations |
| 2683e6c, deb4c61 | Rules/service and form for Add Dispatcher |
| e8e0ddb, 77044ca, 728de68, 9a2b366, d9ff664 | Admin Emergency Calls, Overview, Requests, Users, Reports redesign |

Add Dispatcher exists in code/rules. The owner says its rules are deployed. Unlike C1, the requested notes do not record this newer deploy's before/after live comparison. Live Firebase rules were not downloaded in this task.

Vehicle **status still exists in the database** for dispatch. Only the Admin's manual choice/display was removed. New vehicles start Available; ride saves change their status. Existing records were not erased by the screen change.

### New APK decision

There are no direct Resident/Driver screen or service edits after APK 15 in the checked range. However, **be2d09a changes shared lib/dutyTime.js**, which DriverDutyCard.jsx also uses. It adds break details/calendar helpers for Admin records while preserving existing duty-time calculations. That shared phone code is absent from APK 15. Later Admin screens are also absent when Admins use the installed APK.

If all current code must reach phones, build a new APK. The history does not show a new Resident/Driver feature requiring everyone to replace APK 15 immediately. This remains a decision, not permission to build automatically.

## 3. Open items, most important first

This list is not approval to implement. The October 5 architecture review is a backlog, not a request to do every improvement during the freeze.

### First: C3 is confirmed (phone test October 18, 2026); fix not chosen yet

**C3 / resident issue #33:** a real waiting emergency alert may be hidden after two minutes in the background. Current dispatcher-home.jsx still uses `STUCK_ALERT_MS = 120_000`. The Resident's 20-second 'I'm still here' timer may pause when Call the office opens the Phone app. The Dispatcher then treats the real alert as stuck. It is hidden on Dispatcher screens, not deleted; Admin may still see it.

**Owner's test result (October 18, 2026):** demo-ready-17 APK, live website, dispatcher0, Answer not pressed. The Resident tapped **Call the office** and stayed in the Phone app.

- A. The alert showed on the Dispatcher screen: **yes**.
- B. It disappeared while the Resident stayed in the Phone app: **yes**, about 3 minutes after sending.
- C. It came back after the Resident returned to SakayNa: **no**.
- D. Admin Emergency Calls still listed it: **yes**.

C3 is confirmed. Result C was not expected: the alert stayed hidden even after the Resident came back. Its cause is not recorded yet.

The review proposes increasing the website delay from two to ten minutes. This also keeps crashed-phone alerts visible longer. It is proposed, not tested, and needs the owner's OK. For now keep SakayNa visible until Answer and have one Dispatcher answer promptly.

**Update October 18, 2026:** the ten-minute delay is committed (`9ab2187`) and is in master, the live website and demo-ready-18 (`a18955c`). A repeat of the C3 test with it is not recorded here.

Related #8/#34: old alerts still marked ringing can reappear after Dispatcher reload and block a fresh alert for two minutes. Keep test data tidy and office/Dispatcher numbers set before rehearsal. Real-data cleanup needs separate approval.

### Next: defense readiness / APK choice

- Decided (October 18, 2026): the defense set is the **demo-ready-18** APK (local build, debug-signed; testers must uninstall the old SakayNa first), the live website at **a18955c**, and rules **d464a70**. It replaces demo-ready-17. Going back to demo-ready-17 (EAS link expires October 28) would also need an uninstall first, because the signing keys differ.
- Rehearse normal ride, cancellation, emergency form, duty/break, and Admin approval using the chosen APK and current website.

### Safety/security backlog: before real use; outside the freeze unless separately approved

| Item | Problem / handling now |
|---|---|
| A1 | Two Dispatchers can answer the same alert at once. Use one answering Dispatcher for the defense. |
| A8 | Two Dispatchers can assign one van at once. Use one assigning Dispatcher. Later saves should check the van as well as the driver. |
| A2 | **Database access fixed for staff** by Task 1.2 (`d464a70`): staff must be Active. Still open: a refused staff member can still sign in to Firebase (blocking sign-in needs a server). The route gate fix (`258258e`) shows them "Account not active"; tested on demo-ready-17 (dispatcher1 Active → Pending → Active). Old advice to change role in Operations is outdated: that option was removed. C1 already tightened driver vehicle/schedule/checklist writes. |
| A3; resident #3/#4 | Owners can change too many fields of their rides/alerts/assignments if they bypass the app. Later rules should preserve ownership and restrict fields, one collection at a time. |
| A4 | Sign-up proof/application rules need stronger checks against fake submissions/photo links. |
| City-wide Admin tools | Task 1.1 fixes Admin user-profile writes and keeps role/barangay unchanged. Users-list reads, Duty Records and other tools remain city-wide. Owner-reported tests and the remaining not-tested cases are in architecture-review.md. |
| Public photos; F12 | Exact Cloudinary links open document photos publicly. Use sample documents for tests. Health-data access/retention needs real-use decisions. |
| Dispatcher passwords | Temporary password changes are not forced. Share privately and confirm the Dispatcher resets it through Forgot password. |
| Vehicle problem / after pickup | A reported faulty van becomes assignable again: manually pick another. After pickup, call dispatch; no separate incident report is saved. |

### Other bugs/limits: consider only if needed for the defense

- A5 is fixed and released on the website: Logs load the newest 50. Task 1.3's edit/delete tests on one real log line were both Denied; see section 2.
- A6: Some refused emergency-form saves show a misleading internet error.
- A7: Dispatcher alerts have no sound. Keep the tab visible.
- A9: Opening the driver app may overwrite a full name because of loading order. Unconfirmed: test before fixing.
- Form drafts are lost on Cancel/Back/reload/browser close. After the Resident ends the alert, a closed form cannot be reopened. Keep it open until Submit.
- Offline request/form saves can wait a long time. Resident #10/#11/#32 cover slow address lookup, missing ride-save timeout, and untested offline startup.
- Forgotten punch outs stay on duty; logout does not punch out. A crash/dead phone may still look app-open. Cancelled assigned rides free driver/van when the driver's app is open again.
- Scheduled rides have no reminders; early assignment holds the vehicle. Location/distance can be old/rough. Auto-call needs load/signal and does not run in the background.
- Other resident follow-ups remain in Skills/resident.md section 6: temporary wrong newest-request order (#19), hidden Settings success message (#22), uncertain email changes (#23), rejected-proof resubmission (#35), Google/email account duplication, unused declined/rejected states, and old-APK timeline behavior. This handoff does not mark them fixed.

### Vehicle pictures: lower priority

The owner calls this **#11**, but no matching numbered vehicle-picture requirement was found in the checked notes. **Resident issue #11 means offline request-save timeout.** Admin vehicle cards/form have no picture feature. DESIGN.md also has an unfinished barangay-van illustration placeholder; it may be a different request. Confirm the intended requirement before planning it. It is not an automatic freeze exception.

### Deferred cleanup from architecture-review.md

| IDs | Deferred work |
|---|---|
| A10-A11 | Repeated ride defaults, references, office-phone reads, date helpers, logout code. Different patient/passenger steppers can stay. |
| A12-A13 | Growing Dispatcher downloads and retired schedules/driver-owned-vehicle logic. Check remaining uses first. |
| A14-A15 | Duplicate Driver assignment reads and Resident history limits applied after downloading. |
| A16 | Repeated map/address downloads and provider reliability. |
| A17-A18 | Large screens and old-APK compatibility code. Do not remove working compatibility during the freeze; old availability still has current uses. |
| A19-A21 | Recheck hard-coded colors/status words and unused assignment messages. Recent Admin redesigns may cover some styling, not the entire backlog. |

### Future work for thesis/pilot, not implementation now

| IDs | Ideas only |
|---|---|
| F1-F5 | Barangay dispatch, vehicle pools, office numbers, other cities, measuring Firebase usage. |
| F6-F7 | Trusted server for alert/shift cleanup, account management, private photos, abuse limits, real push notifications. |
| F8-F10 | Multiple vehicles per incident, live driver tracking, map-provider plan. |
| F11-F12 | Automated rules/helper tests; health-data privacy, access, retention, removal decisions. |

Other optional plans stay deferred: Driver My DTR, automatic shift closing/corrections, DTR exports, Dispatcher Take back/Free driver tools, Android Back switching driver pages. None is newly approved.

## 4. Rules for continuing

1. Read AGENTS.md, DESIGN.md, PRODUCT.md, Known-Issue.md, Skills/resident.md, and the relevant plan before changes. Other role guides do not exist yet. Later releases/current code and the owner's newest instructions resolve stale notes.
2. **Plan first, wait for OK before code changes.** Explain current behavior, cause, smallest fix, intended files, and test in everyday words.
3. **One small change.** Give exact phone/website test steps, then stop. Owner tests and commits before the next. This documentation-only commit is explicitly requested; code keeps the usual routine.
4. Keep the Capstone simple and frozen. No unrelated refactoring, architecture, dependencies, server, or extra features. Stop when the approved requirement works.
5. Necessary approved packages use **npx expo install**, never plain npm install.
6. Follow DESIGN.md: light only, readable system font, green/orange (dark words on orange), emergency red, large tap areas, flat simple layout, documented website exceptions, large-text support, no unapproved LGU branding.

### Safe Firestore rules deploy

Commit approved rules. Download live rules and compare to the **previously deployed committed version**; intended new changes should differ from live. Stop on unexpected differences. Deploy with **--project sakayna-571e8**. Download again and confirm live matches the newly committed firestore.rules. Record the commit and comparison. Git alone cannot prove live rules.

### APK checklist

1. Test and commit first; git status clean.
2. Run `npx expo install --check`.
3. Build the approved Android preview, then `eas fingerprint:compare --build-id <id>` must say **matches**.
4. Uninstall old app, install new APK, phone-test, record build ID/commit/tag/link. Do not move the APK 15 tag to newer code.

### Website release checklist

Follow AGENTS.md / Claude.md. Everything tested/committed, folder clean. **Everything on master goes live**, not just the last change. Check APK compatibility before emergency changes.

Run one at a time:

1. `git push origin master`
2. `git switch main`
3. `git merge --ff-only master` - expect Fast-forward for new work; stop if impossible. Already up to date means nothing new to merge.
4. `git push origin main`
5. `git switch master`

Check Vercel **Ready**, then test changed live pages. No release is part of this handoff.

## 5. Outdated or inconsistent notes

- The completed list matches history, but 'done since APK 15' is too broad: duty, location, auto-call, three Driver pages, emergency quick facts, C1/C2 were already done by APK 15.
- PRODUCT.md still says survey underway and Dispatchers created only in Firebase Console. Owner says survey finished; Add Dispatcher now works. Admin provisioning still uses Console.
- PRODUCT.md says no notification package installed. package.json contains expo-notifications; lib/permissions.js asks permission. **Actual push notifications remain absent.** Its two disabled Phase 8 entry-point description also needs updating for working Add Dispatcher; permanent deletion stays deferred.
- Skills/resident.md says checked September 30 despite October updates. It still describes Dark/Light, older Driver layout, Change role in Operations, and tap-to-call resident number in issue #6. Later code/plans say light only, three Driver pages/menu, no Change role, and plain-text resident number on Dispatcher emergency screens.
- Known-Issue.md says checked October 5 but includes October 6 password issue; it does not fully describe later Admin redesigns.
- driver-duty-plan.md says close X fix not released and describes pre-duty behavior under What exists today. 43938cd is already in APK 10, therefore APK 15. My DTR remains optional, not done.
- emergency-request-form-plan.md still calls patient typing/step buttons master-only near the top. Later release/tag/branches supersede that. Original 1-6 patient sketch/layout is historical: emergency count is now 1-50.
- driver-location-plan.md lists distance/nearest sorting as Not now, but the later emergency form includes rough straight-line distance and nearest-first sorting. Live tracking/road distance remain absent.
- architecture-review.md is an October 5 snapshot at 798072a with C1/C2 updates. Checklist still says APK 14 and suggests doing C2 although APK 15 is newer and C2 fixed. A2's Operations role-change workaround is gone. Recheck old line numbers/counts before work. Cleanup suggestions are not current implementation requests.
- The actual filename is **Claude.md**, while plans refer to CLAUDE.md; Windows resolves both to this rulebook.
- Vehicle pictures #11 is owner-supplied context, not a matching numbered item found in the checked files.

## Evidence and limits

Read all requested files plus Claude.md. Checked git log --oneline -30, git tag, APK 15 tag contents, changed filenames since the tag, local/remote branch tips, and selected code where notes disagreed. No phone tests, new APK build, authenticated website/Vercel checks, or live Firebase rules comparison occurred. Git proves saved source state, not every live-service or test result. Only HANDOFF.md is authorized for this task's commit.
