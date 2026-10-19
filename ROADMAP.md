# SakayNa: Admin System Security & UI/UX Roadmap

**Created:** October 13, 2026  
**Target Defense Date:** October 23, 2026 (10 days remaining)  
**Rule:** One change at a time. Plan first -> Review & get user OK -> Implement smallest possible change -> Test on phone/web -> Commit -> Move to next.

**Status (October 18, 2026):** Phase 1 is done except Task 1.4, which moved to future work (after the defense). Phase 2 is deferred until after the defense. **Phase 3** work so far (below) was merged from `big-update` into `master` at `a18955c`. The app is frozen: the defense uses APK **demo-ready-18** (`a18955c`; local build, debug-signed, testers must uninstall the old SakayNa first), website `a18955c`, rules `d464a70`. Test results are in `architecture-review.md`; APK details are in HANDOFF.md.

---

## 🎯 Goal
Make the Admin system secure and easy to defend to the panel (barangay scoping, account rules, security logs), followed by high-impact UI/UX polish (loading states, visual feedback) without destabilizing existing working flows.

---

## 📍 Phase 1: Admin System & Security Hardening (Priority 1)

These fixes directly solve the open security questions so you can confidently answer the panel: *"How do you prevent an Admin from modifying accounts outside their barangay or suspended staff from accessing data?"*

### Task 1.1: Restrict Admin Firestore Rules to Own Barangay & Allowed Fields
- **Status: Done.** Rules `c92f5a1` (deployed), screens `b62c724` (released). Users-list reads stay city-wide.
- **Problem:** Currently, `firestore.rules` allows an Admin to update any user profile without restricting barangay or fields (`isAdmin() && request.auth.uid != userId`).
- **Solution:** 
  - Restrict Admin profile modifications so Admins can only manage users within their own assigned barangay (`isAdminOf(resource.data.barangay)`).
  - Limit which fields an Admin can modify (e.g. `accountStatus`, `accountStatusReason`, `approvalStatus`), preventing arbitrary overwrites of sensitive system flags or credentials.
- **Verification / Test:**
  - Log in as Daanglungsod Admin -> verify you can approve/modify a Daanglungsod user.
  - Attempt (or test via emulator/rules test) to modify a user from another barangay -> correctly denied by rules.

### Task 1.2: Enforce Account Status for Staff in Security Rules & Route Gates
- **Status: Done.** Rules `d464a70` (deployed). Route gate `258258e` (website and demo-ready-17): staff who are not Active see "Account not active" with Log Out, instead of being signed out automatically. Refused staff can still sign in to Firebase (blocking that needs a server).
- **Problem:** `isStaff()` currently checks only `myRole() in ['Admin', 'Dispatcher']` without ensuring the account status is `"Active"`. If an Admin sets a Dispatcher or Admin to "Suspended" or "Disabled", their token role still allows database reads/writes.
- **Solution:**
  - Update `isStaff()`, `isAdmin()`, and `isDispatcher()` helper functions in `firestore.rules` to require `accountStatus == "Active"`.
  - Ensure `dispatcher-home.jsx` and `admin-home.jsx` route gates immediately block/sign out users whose `accountStatus !== "Active"`.
- **Verification / Test:**
  - Set a test Dispatcher account to "Suspended" via Admin panel.
  - Verify that the Dispatcher screen immediately prevents viewing requests or assigning vehicles.

### Task 1.3: Secure the Admin Activity Log (`activityLogs`)
- **Status: Done.** Rules `98db008` (deployed; only Admins may create lines). Newest-first Logs `94d2cb3` (released), in `AdminOperationsPanel.jsx`.
- **Problem:** Any staff member can create activity log entries with arbitrary `actorId` fields.
- **Solution:**
  - In `firestore.rules`, require that `request.resource.data.actorId == request.auth.uid` and `actorRole == myRole()`.
  - In `useAdminDashboardData.js`, add `orderBy("createdAt", "desc")` to activity logs so recent entries are never missed.
- **Verification / Test:**
  - Perform an admin approval -> check that the activity log entry appears immediately at the top of the Admin Operations log with the correct admin ID.

### Task 1.4: Scope Admin Dashboard Views by Barangay (Where Applicable)
- **Status: Moved to future work (after the defense).**
- **Problem:** While Driver Applications and Resident Verifications are properly filtered by the Admin's barangay, parts of the Overview and User lists show city-wide totals without a clear barangay filter indicator.
- **Solution:**
  - Add an active Barangay badge/filter pill to the Admin Users and Requests tabs so the Admin can seamlessly toggle between "My Barangay ({adminBarangay})" and "City-wide Overview".
- **Verification / Test:**
  - Open Admin Users -> toggle between own barangay and all barangays -> verify list updates cleanly.

---

## 🎨 Phase 2: UI & UX Polish (Priority 2)

**Status: Deferred until after the defense.**

Enhance perceived performance, accessibility, and user feedback without altering core business logic or database schemas.

### Task 2.1: Skeleton Placeholders for Mobile Loading States
- **Problem:** Slow cellular connections in remote barangays cause blank cards or plain spinner indicators that make users wonder if the app froze.
- **Solution:**
  - Create a lightweight `<CardSkeleton />` component using native `Animated` pulse.
  - Display skeletons in `ResidentHome` (Your Ride card) and `DriverHome` (Ride card) while live Firestore listeners initially connect.
- **Verification / Test:**
  - Test on phone in Airplane mode / slow 3G throttle -> observe smooth pulsing card placeholder until data loads.

### Task 2.2: Visual & Haptic Feedback on Mission State Changes
- **Problem:** Tapping step buttons (Accept, En Route, Arrived, Picked Up, Completed) gives immediate database updates, but subtle tactile/audio confirmation is missing.
- **Solution:**
  - Add light haptic vibration feedback (`Haptics.impactAsync` via Expo) and a brief success toast/badge when a driver advances a mission or when a resident's request is accepted.
- **Verification / Test:**
  - Test on driver phone -> tap "En Route" -> feel subtle confirmation vibration and see status badge update.

### Task 2.3: Quick Barangay Hall Shortcuts on Location Picker
- **Problem:** In rural areas where GPS or OpenStreetMap address lookups are slow, typing manual addresses on basic keyboards can be tedious.
- **Solution:**
  - Add a quick shortcut chip: "📍 Barangay Hall of {barangay}" in the pickup/destination modal to pre-fill coordinates and standard address instantly.
- **Verification / Test:**
  - Open Request a Ride form -> tap "Barangay Hall" chip -> verify pickup address and pin update immediately.

### Task 2.4: Design Token & Palette Consistency Sweep
- **Problem:** A few older components still import legacy `COLORS` (`#06774B`, `#17382E`) instead of standardized `DESIGN_COLORS` (`#0B7A4B` Hall Green, `#14211C` Ink) from `DESIGN.md`.
- **Solution:**
  - Safely replace legacy color references with `DESIGN_COLORS` across remaining screens to achieve 100% visual consistency with the design system.
- **Verification / Test:**
  - Inspect all screens in Expo web and Android preview to ensure exact color harmony.

---

## 🧭 Phase 3: Group Lead's Change List (big-update)

**Status (October 17, 2026): Tasks 3.1 to 3.14, 3.13b and 3.16 are done on `big-update`** (each tested by the owner and committed; commits in "Progress on big-update" below). Task 3.15 and Tasks 3.17 onward are not started. **Update October 18, 2026:** these tasks, the destination pin and the C3 fix (`9ab2187`) were merged into `master` at `a18955c`, which is now the live website and the phone-tested **demo-ready-18** APK. Written October 14, 2026 from the group lead's list. Each task still needs its own "explain → OK → build → test → commit" round.

### Ground rules for Phase 3

1. **The defense version stays frozen.** demo-ready-18 + website `a18955c` + rules `d464a70` are the safe defense set (changed October 18, 2026; before that it was demo-ready-17 + website `258258e`). Remember: the website is built from `master` → `main`, and **everything on master goes live**.
2. **Firebase rules are shared by everyone.** The database (and its rules) is the same for demo-ready-18, the live website and `big-update`. A rules deploy changes the defense version too. So: **no rules deploy before the defense** without the owner saying yes, and every rules task waits until after October 23.
3. **Testing while building:** phone changes are tested with the development build. Website changes can be tested on Vercel's preview link for `big-update` (Vercel usually makes one for every pushed branch; check the dashboard). Both still read and write the **real** database, so use test accounts.
4. **One new native package at most** (the date/time picker in Task 3.11). Adding it means a **new development build** before it can be tested on the phone. Everything else is plain screen code.
5. **Every phone change needs a new APK** to reach testers (no over-the-air updates). Plan to build **one** APK at the end of a batch, not one per task.
6. **"Compact UI" vs DESIGN.md:** DESIGN.md's Arm's-Length Rule says text ≥ 15, taps ≥ 48, main buttons ≥ 56 (for seniors). Proposed meaning of "compact": **fewer boxes, less empty space, shorter screens**, but text and tap sizes stay readable. The Admin website (desktop) gets its own denser exception (the "75% zoom" look). DESIGN.md must be updated when this is approved.

### Summary: what each task needs

Size: S = small (one file, under an hour or two), M = medium (a few files / a day), L = large (several days, many files).
Rules = changes `firestore.rules` (must be deployed). Web = needs a website release. APK = needs a new APK.

| # | Task | Size | Risk | Rules | Web | APK |
|---|---|---|---|---|---|---|
| **Stage A: small, screen-only, safest** |||||||
| 3.1 | Driver bottom bar: open tab only turns green (no grey box) | S | Low | No | Yes | Yes |
| 3.2 | Request form wording: remove "e.g. buying medicine" and "(optional)" | S | Low | No | Yes | Yes |
| 3.3 | Map pins: real pin shapes instead of squares | S | Low | No | Yes | Yes |
| 3.4 | Dispatcher: Available drivers listed first | S | Low | No | Yes | No |
| 3.5 | Dispatcher: click a request → map moves and zooms to it | S | Low | No | Yes | No |
| 3.6 | Admin: show the Admin's barangay under the logo | S | Low | No | Yes | No |
| 3.7 | Tap the profile picture → see name, number, email, barangay | S | Low | No | Yes | Yes |
| 3.8 | Phone loading: plain spinner, no card around it | S | Low | No | Yes | Yes |
| **Stage B: medium, screen-only** |||||||
| 3.9 | Request a Ride: compact form, plain radio buttons | M | Low–Med | No | Yes | Yes |
| 3.10 | People riding: type the number, higher limit, "may need another vehicle" note | M | Med | No | Yes | Yes |
| 3.11 | Schedule: real calendar + scroll-wheel time (or typed time) | M | Med | No | Yes | Yes (native package) |
| 3.12 | Driver: history always shown under a fixed duty card; compact buttons | M | Med | No | Yes | Yes |
| 3.13 | Dispatcher home: smaller map, no page scrolling | M | Med | No | Yes | No |
| 3.13b | Dispatcher: alert sound while an emergency rings (added Oct 15) | S | Low | No | Yes | No |
| 3.14 | Admin: compact Emergency Calls, shorter Operations buttons | M | Low–Med | No | Yes | No |
| 3.15 | Settings: Change Password, Delete Account (profile editing moves to Profile) | M | Med–High | Maybe (check) | Yes | Yes |
| 3.16 | Website: skeleton placeholders instead of spinners | M | Low | No | Yes | No |
| 3.17 | Screens touching the phone's navigation bar | S each | Low | No | No | Yes |
| **Stage C: large or risky** |||||||
| 3.18 | Resident bottom bar: Your Ride / History (Chat added in 3.23) | L | **High** (emergency screen) | No | Yes | Yes |
| 3.19 | Admin website layout: top bar + left sidebar + card lists | L | Med | No | Yes | No |
| 3.20 | Live driver location on the dispatcher map | L | Med–High | Probably no (check) | Yes | Yes |
| 3.21 | Live line from the assigned driver to the pickup | M | Med | No | Yes | No |
| 3.22 | Emergency alerts ring the barangay's dispatcher first | M | **High** (emergencies) | No | Yes | No |
| 3.23 | Chat between Resident and Driver | L | Med | **Yes** (new collection) | Yes | Yes |
| 3.24 | Light/Dark theme switch | L | Med | No | Yes | Yes |
| **Stage D: future feature (own plan, after the defense)** |||||||
| 3.25 | City Admin role (Barangay Admin vs City Admin) | XL | **High** (all Admin rules) | **Yes** (big) | Yes | Yes |
| 3.26 | Really assigning a second vehicle/driver to one big group | L | High (ride flow) | Maybe | Yes | Yes |
| 3.27 | Resident drops a destination pin on the map (real lat/lng) | M | Med | No | Yes | Yes |

### Suggested order (safest and most important first)

1. **Stage A (3.1 → 3.8):** quick wins, tiny risk, each easy to test and undo.
2. **Resident form (3.9 → 3.11):** the lead's first and most detailed request. Do all three, then one development build for the date/time picker.
3. **Driver (3.12) and Dispatcher (3.13, then 3.20 → 3.21):** the live map work depends on the smaller-map layout being settled first.
4. **3.22 barangay alerting:** only after a full emergency rehearsal plan is written. It changes who hears an emergency.
5. **Admin website (3.14, 3.16, then 3.19):** website only, does not touch phones.
6. **Profile/Settings (3.15), then resident bottom bar (3.18), then Chat (3.23):** chat is the only rules change in Phase 3 and needs the bottom bar to exist.
7. **3.24 Dark mode last** (or drop it). It touches every screen and goes against DESIGN.md.
8. **Stage D** is its own plan after the defense.

### Progress on big-update (October 19, 2026)

All of these are tested by the owner and committed on `big-update`. Phone changes reach testers only with a new APK (ground rule 5); the website changes go live only after a merge into `master` → `main`.

| Task | Commit(s) | Done |
|---|---|---|
| 3.1 Driver bottom bar | `c7205dd` | ✅ |
| 3.2 Request form wording | `e8284da` | ✅ |
| 3.3 Map pins | `993e62a` | ✅ |
| 3.4 Dispatcher: Available drivers first | `9bbbc9c` | ✅ |
| 3.5 Dispatcher: map follows the clicked request | `56ed795` | ✅ |
| 3.6 Admin barangay under the logo | `620b147` | ✅ |
| 3.7 Tap the profile picture | `6cb94fc` | ✅ |
| 3.8 Phone loading without the card | `562400f` | ✅ |
| 3.9 Compact Request a Ride form | `3b93770` | ✅ |
| 3.10 People riding: typing, cap 50, big-group note | `611663f` | ✅ |
| 3.11 Calendar and time picker | `ac5b02e` (package, Step A), `5521ea4` (pickers, Step B) | ✅ |
| 3.12 Driver history under a fixed duty card | `6d3b908` | ✅ |
| 3.13 Dispatcher home without page scrolling | `2ffc79e`, `0c9cd6b`, `ec954cd`, `c65da10` | ✅ |
| 3.13b Alert sound | `5545656` | ✅ |
| 3.14 Admin Emergency Calls and Operations buttons | `66c04f5` | ✅ |
| 3.16 Website skeleton loaders | `c0147ff` (Admin, part 1), `10be62d` (Dispatcher, part 2) | ✅ |
| 3.20 Live driver location | `ba91b9d` (phone, Step A), `b290e19` (dispatcher map, Step B) | ✅ |
| 3.21 Live route line | the "3.21: live route line" commit (`git log --grep 3.21`) | ✅ |

**Changes made along the way (different from, or more than, the plan above):**
- **3.2:** the passenger's phone is **required** (owner's decision 3).
- **3.4:** inside Available, drivers with the app closed come after those with it open; then On a run, On break, Off duty, not approved. Same group = A to Z by name.
- **3.5:** an exact pin is zoom 16; an address lookup is zoom **15** with its "(approximate geocoded match)" label open. The last thing clicked wins, including the orange "Needs a new driver" banner.
  - **Changed October 17 (destination pin, below):** when the destination is found too, the map fits **both** pins instead of zooming to the pickup only.
- **Dispatcher destination pin (extra, October 17, `LeafletMap.jsx` only):** the selected request's destination shows as the orange flag pin with an always-visible **"Destination"** tag. The map fits pickup and destination with space at the edges (never closer than zoom 16). The destination is only typed text, so its pin is an address lookup ("approximate geocoded match"); vague text like "Lola's house" finds nothing and shows only the pickup, as before. Dispatcher map only (`focusPickup`); Resident and Driver maps are unchanged. Real destination pins are future Task 3.27.
- **3.6:** shows "Barangay Daanglungsod" (", Toledo City" left out), or "Barangay not set".
- **3.8:** the website's loading screens lost the card too; loading words are dark and 17 so they read well on the grey page.
- **3.9:** "Community / Personal Trip" was renamed **"Community Activity"**. Old rides keep the name they were saved with (History, Request Details, driver card, dispatcher), but the Admin counters and the "Ride for" filters count both names as one (`getPurpose` in `requestOptions.js`). The "Does anyone need help?" checkboxes also became plain.
- **3.10:** empty or 0 gives "Enter a number from 1 to 50." on Review; the box takes 3 digits so "100" gets the message.
- **3.11:** needed a new development build (`1efc5840-282f-4e5f-b222-06aa1b8c5437`, fingerprint matched). Any minute can be chosen; the message is "Choose a time at least 1 hour from now and within 1 year." The landing page and Privacy Policy now say "1 year" instead of "7 days".
- **3.12:** the duty card uses at most 60% of the page (it scrolls inside itself if taller); Start break and Punch out sit side by side (48 tall); Punch in / Resume duty are 56 tall.
- **3.13:**
  - The full-screen "Incoming Emergency Call" pop-up was **replaced by a red emergency strip** just under the header: 2 alerts get their own row with fixed Answer / Decline, more alerts go into one "N more waiting" row. Only the extra details move like a ticker (paused on mouse hover, never with "reduce motion"). The tab title says "EMERGENCY – SakayNa" while something rings. All ringing alerts now show (before, only the first one did).
  - Side columns are 260–280 wide; the three titles above the columns were removed (screen readers still get names).
  - **Selected Request** runs along the bottom, full width, in 4 columns, and **never scrolls**: values are one line with "…" and the full text on hover (Notes 2 lines). If the window is too short for everything, the page uses the stacked layout instead, so nothing is cut off.
  - Header: the shield icon with "SakayNa" written next to it and the barangay name under it; Log out moved into an account menu on the initials circle (closes on outside click or Escape). In the stacked layout the header and the strip stay pinned at the top.
- **3.13b (new):** a soft "ding-dong" every 2 seconds while an alert rings (`public/sounds/emergency-alert.wav`, made with a small script, no new package). It stops when the alert is answered, declined or ends. **Mute lasts until the page is reloaded** (not remembered), with an orange "Sound off" button and a "Sound off" line in the strip. If the browser blocks sound until the page is clicked, the strip shows "Sound blocked: click to turn sound on".
- **3.14:**
  - **Emergency Calls:** each call is one row: status pill and time side by side, "Name · Barangay", then what happened on one line. Long text wraps instead of being cut off. Row text is 15, the title 22.
  - Only this section got wider (900 → 1200). Under 760 px wide the rows still stack. The red "No answer" box and the order of calls are unchanged.
  - **Operations:** only the main-page buttons fit their words (Manage profile, Create Dispatcher, Add maintenance record, Save operational settings). The buttons in the pop-ups stay full width, and the Reports download button was not changed.
- **3.16:**
  - One shared piece, `components/ui/ListSkeleton.jsx`: 3 grey cards that fade softly (still with "reduce motion"), with a "Loading …" label for screen readers.
  - **Admin (part 1):** Users, Requests, Vehicles and Emergency Calls show it instead of the spinner. Their existing loading flags already end on success or error, so it can't get stuck.
  - **Dispatcher (part 2):** "Latest queue" and "Driver availability" show it until their first answer or an error arrives. Before, they said "Inbox empty" / "No registered drivers" while still loading. Firebase waits for the server while it can reach it, so no false "empty" flash when online; when offline, "Inbox empty" shows after about 10 seconds, as before. The emergency strip and sound load separately and never wait for it.
  - **Spinners kept on purpose:** Resident Verification, Driver Applications, Duty Records, and the start-up screens ("Checking admin access…" and the login gate, which phones share through `ScreenState.jsx`).
- **3.20:**
  - **Step A (phone, needs a new APK to reach testers):** every **15 seconds** the phone checks its GPS and saves only if the driver moved **20 m** or more, or **60 seconds** passed without a save (the plan said about 30 s / 50 m). Only while SakayNa is on screen and the driver is on duty and not on break; it stops in the background (for example Google Maps from Navigate), on break and at punch out. The saved step follows the ride (Accepted … Picked Up, otherwise Punch in), so `firestore.rules` did not change. Standing still indoors it can save every 30–45 s, because GPS readings jump more than 20 m.
  - **Step B (website only):** the dispatcher map shows every on-duty driver in the "Driver availability" list as a pin labelled "Name · updated X min ago"; tapping the pin shows the step and clock time. After **2 minutes** without an update the pin turns grey and faded and the label starts with **"Old location"**. Pins move by a message into the map page, so the map never rebuilds (no blink, the zoom stays). Pickup and destination pins work as before.
  - **"Show on map"** now **slides** the map to the driver's pin (it does not keep following). Tapping a request card or a "Needs a new driver" banner afterwards brings the ride's pins back.
  - Drivers on APKs before Step A (demo-ready-18 and older) only save at the steps, so their pin is grey "Old location" between steps.
  - **Extra fix (`9f1c6fb`):** the driver card is a plain box with two tap areas and "Show on map" between them, so the website no longer has a button inside a button. Same look.
- **3.21 (website only, straight line as decided):**
  - Every live driver pin with an active ride (Assigned … Arrived) gets a dashed line to the pickup: **green**, ending in a dot labelled **"Pickup · Name"**. After Picked Up it goes to the destination: **orange**, **"Drop-off · Name"**. The label is always visible, so color is never the only cue (DESIGN.md).
  - When the pin is grey "Old location", the line and dot are grey and faded too, with the same label.
  - The assignment only has the places as typed words, so the ride's request is read **once** for its map positions (dispatchers may read any request; no rules change). No map position = no line. Most destinations are typed words only, so after Picked Up most rides show no line until Task 3.27.
  - The lines move like the pins (no map rebuild) and don't change how the map zooms to the selected request's pins.

---

### Stage A tasks

#### Task 3.1: Driver bottom bar highlight ✅ Done (c7205dd)
- **What changes:** in `app/driver-home.jsx`, the open tab shows a green icon and green bold word only. The grey-green box behind the icon (`tabIconOpen`) and the grey flash when pressed (`tabButtonPressed`) are removed.
- **Could break:** nothing important. Only looks. The orange "new ride" dot stays.

#### Task 3.2: Request form wording ✅ Done (e8284da)
- **What changes:** `ResidentRequestForm.jsx`: the "Other" box placeholder becomes plain "Tell us briefly" (no "buying medicine"). The passenger phone label loses "(optional)".
- **Decision needed:** should the passenger's phone become **required**? If yes, `requestValidation.js` must reject an empty phone, and the hint "If they have no phone, the driver will call you" goes away. If no, removing the word would mislead people (it would still be optional). Recommendation: make it required, as the lead seems to want.
- **Could break:** a Resident booking for someone with no phone can't send the request (if required).

#### Task 3.3: Map pins ✅ Done (993e62a)
- **What changes:** `components/LeafletMap.jsx` draws each pin as a small box with a 3px border and a corner rounding that is too small, so it looks like a square. Replace it with a teardrop "map pin" shape drawn in the same file (no new package): green for pickup, orange for the driver, and the destination in its own color.
- **Could break:** every map uses this file (Resident pin picker, Driver map, Dispatcher map). Test all three. The pin's tip must sit exactly on the spot (anchor point), or pins will look shifted.

#### Task 3.4: Dispatcher, Available drivers first ✅ Done (9bbbc9c)
- **What changes:** `app/dispatcher-home.jsx` sorts the driver list: Available → On a run/Handling → On break → Off duty.
- **Could break:** nothing in the data. A dispatcher used to the old order may look in the wrong place at first.

#### Task 3.5: Dispatcher, map follows the clicked request ✅ Done (56ed795)
- **What changes:** when a request is selected, the map centers on its pickup pin at zoom **16** (the map's max zoom 19 minus 3). If there is no exact pin, it uses the address lookup as today.
- **Could break:** "Show on map" for a driver also moves the map; decide which wins when both are chosen (recommend: the last thing clicked).
- **Later change (October 17):** if the destination is also found, the map fits pickup and destination together (see "Dispatcher destination pin" above).

#### Task 3.6: Admin barangay under the logo ✅ Done (620b147)
- **What changes:** `app/admin-home.jsx` shows "Barangay {Admin's barangay}" under the logo (from the Admin's profile).
- **Could break:** nothing. An Admin with no barangay shows "Barangay not set".

#### Task 3.7: Tap the profile picture ✅ Done (6cb94fc)
- **What changes:** in the ☰ menu (`ResidentSideMenu.jsx`, used by Residents and Drivers), the picture becomes a button that opens the existing Profile window showing name, number, email, barangay.
- **Could break:** nothing; Profile already exists. It just gets a second way in.

#### Task 3.8: Phone loading without the card ✅ Done (562400f)
- **What changes:** `components/ui/ScreenState.jsx` shows only the spinner and message (no white card) **when loading**. Error screens like "Account not active" keep their card and Log Out button.
- **Could break:** `AuthRouteGate.jsx` uses this for every role's start-up. Check all start-up screens after the change.

### Stage B tasks

#### Task 3.9: Compact Request a Ride form ✅ Done (3b93770)
- **What changes:** `ResidentRequestForm.jsx`: "What is the ride for?" becomes three plain radio buttons (circle + word) with no border box around each one. The same plain style is used for "When" and "Who is riding" so the form looks the same throughout. Less space between sections (24 → 16). The red "Emergency?" note gets slimmer. Text and tap sizes stay as DESIGN.md says.
- **Decision needed:** the lead's note says community transport is not for personal errands, but one option is called "Community / Personal Trip". Keep that name, or rename it?
- **Could break:** nothing saved changes; only looks. Check with large phone text (1.3×) that nothing gets cut off.

#### Task 3.10: People riding, typing and limit ✅ Done (611663f)
- **What changes:**
  - The number between − and + becomes a box you can type in (numbers only). − and + stay.
  - The limit of 6 (`MAX_PASSENGERS` in `requestOptions.js`) goes up. "Unlimited" is risky (a typo like 500), so recommend a cap of **50**, the same as the emergency form's patients.
  - At **10 or more** people (number to be decided), the form shows: "This is a big group. The dispatcher may need to send more than one vehicle." The dispatcher's request card and Assign window show the same warning.
- **Not included:** actually assigning two vehicles/drivers to one request. Today one request = one driver + one vehicle, the same as emergencies. Doing it for real changes the whole ride flow (Task 3.26, future).
- **Rules:** none. The rules do not check the people count.
- **Could break:** older APKs keep the 6 limit (fine). Screens that show "{n} people" must still fit long numbers.

#### Task 3.11: Calendar and time picker ✅ Done (ac5b02e, 5521ea4)
- **What changes:**
  - **Day:** a real calendar (any month, browse forward) instead of the list of the next 7 days. Past days and days too far ahead are greyed out.
  - **Time:** a scroll-wheel like the phone's alarm clock (|hour|minute|AM/PM|), which is Android's own "spinner" time picker, so it opens as a small pop-up instead of a full-screen list.
  - **How:** one package, `@react-native-community/datetimepicker` (installed with `npx expo install`). It uses Android's built-in calendar and clock, so we don't have to build them ourselves. It does not work on the website, so the website form uses the browser's own date and time boxes (the same idea the Admin Duty Records calendar already uses).
- **Decision needed:** how far ahead can a ride be booked? The lead says "not limited dates". Recommend **up to 1 year**, keeping "at least 1 hour from now". Known-Issue.md warns that assigning a scheduled ride early keeps the vehicle busy, so a far-ahead booking makes dispatchers' lists longer.
- **Could break:** the "too soon" check on Send must still work. A new native package means a **new development build** and changes the APK fingerprint (expected).

#### Task 3.12: Driver history always shown ✅ Done (6d3b908)
- **What changes:** on the Availability page of `app/driver-home.jsx`, the duty card (Punch in/out) stays fixed at the top. Under it, the ride history list scrolls by itself and slides under the card's bottom edge. The "Ride history" button and the History pop-up go away. History rows become short (title, place, date, status) instead of long text blocks. Duty buttons get the compact style.
- **Could break:** the duty card is the punch in/out and break system. Only its layout may change, not `DriverDutyCard`'s logic. On a small phone with large text, the fixed card could fill most of the screen; it needs a check at 1.3× text.

#### Task 3.13: Dispatcher home without page scrolling ✅ Done (2ffc79e, 0c9cd6b, ec954cd, c65da10; sound 3.13b: 5545656)
- **What changes:** `app/dispatcher-home.jsx` uses the full browser height: requests (left), a smaller map (middle), drivers (right). Each column scrolls inside itself; the page itself does not scroll. Today's fixed 560px heights become "fill the window".
- **Could break:** the incoming emergency alert and the active emergency card must stay visible at the top. Narrow screens (a phone using the website) still need a stacked layout that scrolls.

#### Task 3.14: Admin Emergency Calls and Operations buttons ✅ Done (66c04f5)
- **What changes:** `AdminCallSessionsSection.jsx`: shorter rows, one line per call where possible. `AdminOperationsPanel.jsx`: buttons as wide as their words instead of full width.
- **Could break:** only looks. Check the "No answer" overdue list still sorts the same.

#### Task 3.15: Profile and Settings
- **What changes:** for Residents and Drivers:
  - **Profile** (picture tap, 3.7) shows name, number, email, barangay. Editing name/number/email moves here (an "Edit" button) because it is no longer in Settings. **Decision needed**: OK?
  - **Settings** holds only: Change Password (already exists), Delete Account (new), and the theme switch (Task 3.24, shown only when that task is done).
  - **Delete Account, recommended simple version:** ask for the password again → save a "deleted" mark and time on the user's own profile → delete the login (Firebase lets a signed-in person delete their own login). Rides and duty records stay, so dispatch and Admin history do not break. A Driver must be punched out; a Resident must have no ride in progress.
- **Rules:** the user may already save new fields on their own profile, so maybe no rules change. Check carefully before building. If the Admin must approve deletions instead, the `deletionRequests` rules need a change.
- **Could break:** deleting the wrong account is permanent. Google sign-in accounts have no password to re-enter, so they need a different confirm step. The Privacy Policy should say what is kept after deletion.

#### Task 3.16: Website skeleton loaders ✅ Done (c0147ff, 10be62d)
- **What changes:** on the website only, loading spinners become grey placeholder shapes that look like the cards being loaded (Admin sections, Dispatcher lists, start-up screens). One small shared placeholder component; phones keep the plain spinner (3.8).
- **Note:** this **replaces Phase 2's Task 2.1** (skeletons on phones). The lead now wants spinners on phones and skeletons on the website.
- **Could break:** nothing in the data. A placeholder must never stay forever if loading fails; the error message must still appear.

#### Task 3.17: "Should not touch the navbar"
- **What it means (to confirm):** on some phones, content sits under Android's own bottom navigation bar (the ◁ ○ □ or swipe bar).
- **Decision needed:** which screens? Send screenshots. Each fix is usually one line (add the safe-area space at the bottom).

### Stage C tasks

#### Task 3.18: Resident bottom bar
- **What changes:** `app/resident-home.jsx` gets a bottom bar like the Driver's: **Your Ride** (the current home with the map and Request a Ride) and **History** (today's Request History, moved out of the ☰ menu). **Chat** is added as the third tab only when Task 3.23 is built, so there is never a tab that does nothing.
- **Must keep:** DESIGN.md says the Emergency button is "visible and one tap away in every state". It must stay on every tab.
- **Could break:** `resident-home.jsx` (1,646 lines) also contains the whole emergency alert and auto-call system. The bar must only wrap the page; the emergency code must not be moved or changed. Full emergency test afterwards.

#### Task 3.19: Admin website layout
- **What changes:** `app/admin-home.jsx` becomes three parts: **top bar** (logo, barangay, search, Admin's picture) that never scrolls away; **left sidebar** with the sections; **content area** that scrolls and shows lists of cards/rows. Click a card → its detail page. Denser text/spacing for desktop, aiming for how it looks at 75% browser zoom on the Dell monitor. Needs a written "Admin website exception" in DESIGN.md (like the emergency form's).
- **Could break:** every Admin section is moved into the new frame: approvals, Users, Duty Records, Operations, Reports, Emergency Calls. Each must be retested. Logic and rules are not touched.

#### Task 3.20: Live driver location
- **What changes today vs. after:** today a driver's place is saved only at Punch in, Accept, En route, Arrived and Picked up. After: while the driver is on duty **and SakayNa is open on screen**, the phone also saves the place about every 30 seconds (or when they move ~50 m). The Dispatcher map shows all on-duty drivers as pins that move without reloading the map.
- **Rules:** probably **no change**. The rules already allow the driver to save their own location again with the current step name. To be checked before building.
- **Not included:** tracking when the app is closed or the screen is off. That needs a background-location permission, a new native package and a Google Play policy review. Too big for now.
- **Also needed:** `LeafletMap.jsx` today rebuilds the whole map every time something changes (it would blink and lose its zoom every 30 seconds). It must learn to move pins without rebuilding. The Resident and Driver maps must keep working as before.
- **Could break:** phone battery/data use goes up; Firebase writes go up (about 120 per driver per hour). Driver privacy: only dispatchers can read locations (unchanged). Known-Issue.md "Show on map" notes need updating.

#### Task 3.21: Live route line
- **What changes:** after 3.20, when a driver is assigned, the Dispatcher map draws a line from the driver's live pin to the pickup (and from pickup to destination after Picked up).
- **Decision needed:** a straight dashed line (simple, no new service) or a line following the roads (needs a free routing server with a fair-use rule, like the map tiles). Recommend straight line first.
- **Could break:** nothing saved; map only.

#### Task 3.22: Emergency alerts by barangay
- **What changes:** each Dispatcher already has a "service areas" list of barangays (Admin → Operations → Dispatcher scope) and each alert already saves the resident's barangay. The Dispatcher screen would:
  1. **Ring** an alert right away only for dispatchers whose service areas include that barangay.
  2. Show it quietly to the others ("Other barangays").
  3. If nobody answers within **30 seconds**, or no dispatcher covers that barangay, ring it for **every** dispatcher (safety net).
- **Rules:** none (all dispatchers can still see all alerts; the city-wide system stays).
- **Limits:** "nearest" means "same barangay", not GPS distance. There are no push notifications, so a dispatcher only hears alerts while the website is open (same as today). Old APKs still work (the alert format does not change).
- **Could break:** **an emergency could be answered late** if service areas are set wrong. The 30-second safety net is required, not optional. Needs a full test: resident in a covered barangay, in an uncovered barangay, and with the covering dispatcher offline. Also Known-Issue C3 (alerts hidden after 2 minutes) interacts with this timer.

#### Task 3.23: Chat between Resident and Driver
- **What changes:** a new database collection for messages of one ride. Only that ride's Resident and its assigned Driver can read and write; dispatchers and Admins cannot. Messages are short text only (no photos), cannot be edited or deleted, and chat is open from Assigned until Completed/Cancelled. Resident: Chat tab (3.18). Driver: a Chat button on the Ride page.
- **Rules:** **yes**, a new section in `firestore.rules`. It adds a new collection and does not change existing ones, but it is still a live deploy (use the safe deploy steps, after the defense).
- **Limits:** no push notifications, so a new message shows only when the app is open (a dot on the tab).
- **Could break:** the driver's Ride page layout. Privacy Policy must mention saved messages.

#### Task 3.24: Light/Dark theme switch
- **What changes:** a switch in Settings. Every phone screen needs dark colors defined and used. Many screens still have hard-coded colors (`#06774B`, `#FFFFFF`, …), so this touches almost every file.
- **Conflicts with DESIGN.md:** "Theme: light only" (dark mode was removed on purpose on Oct 3, 2026). The group must agree to change DESIGN.md.
- **Recommendation:** do it last, or leave it as future work. It is the most work for the least safety/function value.
- **Could break:** unreadable text in places that were missed (white on white). Emergency red contrast must be rechecked.

### Stage D (future feature: own plan after the defense)

#### Task 3.25: City Admin role
- **What changes:** a new role. **City Admin:** live map of all barangays, city-wide statistics, and the **only** one who creates Dispatcher accounts. **Barangay Admin:** today's Admin, minus the tools that move to the City Admin.
- **Rules:** large. Every `isAdmin()` check must be split into "Barangay Admin" and "City Admin". Add Dispatcher rules move to the City Admin.
- **Also changes:** `lib/roles.js`, `AuthRouteGate.jsx`, a new City Admin website screen, and Admin accounts in the Console. The barangay-scoping questions from Task 1.4 come back here.
- **Could break:** a rules mistake can lock every Admin out or let one see too much. Needs its own full plan, Playground tests, and the safe deploy steps.

#### Task 3.26: Multiple vehicles for one big group
- Real assignment of a second driver and vehicle to one request (HANDOFF F8). It changes how rides, the Resident's progress screen and the Driver's steps work. Only if the lead wants more than the warning in 3.10.

#### Task 3.27: Resident drops a destination pin (future, not now)
- **What changes:** on Request a Ride, the Resident can drop a pin for the destination too (like the pickup pin), so the ride saves the destination's real lat/lng instead of only the typed words. The Dispatcher map then shows the destination exactly, not as an address-lookup guess.
- **Needs:** a phone change, so a **new APK**. No rules change expected (check before building).
- **Could break:** the Request a Ride form gets longer; old rides and old APKs still have text only, so the address lookup must stay as the fallback.

### Owner's decisions (October 14, 2026)

1. Build Phase 3 on `big-update`. On **October 20** the owner decides whether to merge the finished parts. **No rules deploy before October 23.**
2. Compact = fewer boxes and less space. Phone text stays ≥ 15 and taps ≥ 48. The Admin website may be denser (write that exception in DESIGN.md at Task 3.19).
3. Passenger phone (3.2): **required**.
4. "Community / Personal Trip" (3.9): **rename it**; Claude suggests names, the owner chooses.
5. People (3.10): cap **50**, big-group warning from **10**.
6. Schedule (3.11): up to **1 year** ahead, at least **1 hour** from now.
7. Profile/Settings (3.15): editing moves to Profile. Delete Account **keeps** ride and duty history.
8. Live location (3.20): only while the driver app is open.
9. Route line (3.21): straight line first.
10. Navigation bar (3.17): the owner sends screenshots later.
11. Dark mode (3.24): keep it, but do it last.
12. Chat (3.23): "rider" means the **Driver**. Chat is Resident ↔ Driver only.

---

## 📋 Execution Rules & Workflow
1. **Always Work Step-by-Step:** Do not combine multiple tasks into one big commit.
2. **Review First:** Before touching code for any task, explain what files will change and wait for approval.
3. **Phone & Web Testing:** Every single task must be tested on your device and committed before starting the next.
4. **Clean Git State:** Maintain clean Git commits so rollback is trivial if anything fails during rehearsal.

