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

**Update October 19, 2026:** on `big-update` (after `a18955c`, not released yet): **3.15** (Delete Account part), **3.17**, **3.18**, **3.20** and **3.21** are done, plus the **UI refresh** (DESIGN.md "Style") for every role and the sign-up screens, skeleton loading on phone and website, the Terms/Privacy menu fix, hover labels for every dispatcher map pin, the Admin Overview one-screen layout and header, Privacy Policy sections 2 and 7, Admin text at least 15 px and **3.19** Admin layout (decision 14). Every item was tested by the owner and committed; commits are in "Progress on big-update" and "Other work on big-update" below. **Not done:** see "Not done yet" and "Next steps" at the end of this section. The defense set is still demo-ready-18 / `a18955c` / rules `d464a70` until the release.

**Owner's decision, October 19, 2026 (decision 13):** because there is not enough time, **3.23 Chat** and **3.25 City Admin / Super Admin role** will **not** be built for the capstone. **3.19** Admin layout, **3.22** barangay-first emergency ringing and **3.24** dark mode are future work too. **3.27** resident destination pin is optional, only if there is time after the release test. See "Future work / recommendations" below.

**Changed later on October 19, 2026 (decision 14):** the owner chose to build **3.19** after all, that evening. It is **done** (steps 1–10 below, tag `pre-admin-layout` = `604ed84` marks the code before it). 3.22, 3.23, 3.24 and 3.25 stay future work.

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

**Changed October 19, 2026 (decisions 13 and 14):** 3.22, 3.23, 3.24 and 3.25 are future work, not part of the capstone; 3.27 is optional; 3.19 is done. The order below is kept as the original plan.

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
| 3.21 Live route line | `66e11f2`, `e9bf92a` (labels on hover) | ✅ |
| 3.17 Not touching the navigation bar | `4f46ef6` (Step 1), `4e727f5` (Step 2), `84a4deb` (Step 3) | ✅ |
| 3.18 Resident bottom bar (Your ride / History) | `a7e77ec` (with the resident home UI refresh) | ✅ |
| 3.15 Delete Account (+ Change Password removed) | `5171780` | ✅ (Delete Account part; Profile-editing part not done) |
| 3.19 Admin website layout | `02d4c54` (DESIGN.md exception), `10c1395` (side menu), `f11ec69` (title lines), `d840673` (Requests), `df31234` (Users), `e9b9cd1` (Verification, Applications), `0ee8cdd` (Operations), `d7394d1` (Vehicles), `c94fdbe` (Duty Records, Reports) | ✅ |

**Changes made along the way (different from, or more than, the plan above):**
- **3.2:** the passenger's phone is **required** (owner's decision 3).
- **3.4:** inside Available, drivers with the app closed come after those with it open; then On a run, On break, Off duty, not approved. Same group = A to Z by name.
- **3.5:** an exact pin is zoom 16; an address lookup is zoom **15** with its "(approximate geocoded match)" label open. The last thing clicked wins, including the orange "Needs a new driver" banner.
  - **Changed October 17 (destination pin, below):** when the destination is found too, the map fits **both** pins instead of zooming to the pickup only.
  - **Changed October 19 (`b8d38e0`):** the "(approximate geocoded match)" label no longer opens by itself; it shows on hover. Selected Request says "Approximate location (from typed address)" instead.
- **Dispatcher destination pin (extra, October 17, `LeafletMap.jsx` only):** the selected request's destination shows as the orange flag pin with an always-visible **"Destination"** tag. The map fits pickup and destination with space at the edges (never closer than zoom 16). The destination is only typed text, so its pin is an address lookup ("approximate geocoded match"); vague text like "Lola's house" finds nothing and shows only the pickup, as before. Dispatcher map only (`focusPickup`); Resident and Driver maps are unchanged. Real destination pins are future Task 3.27. **Changed October 19 (`b8d38e0`):** the always-visible tag is gone; "Destination: …" shows on hover, click or keyboard focus.
- **3.6:** shows "Barangay Daanglungsod" (", Toledo City" left out), or "Barangay not set". **Changed October 19 (`6fc80a0`):** the Admin header now uses the dispatcher's title: the icon, "SakayNa", and only "Daanglungsod" under it.
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
  - Every live driver pin with an active ride (Assigned … Arrived) gets a dashed line to the pickup: **green**, ending in a dot labelled **"Pickup · Name"**. After Picked Up it goes to the destination: **orange**, **"Drop-off · Name"**. The label has a word, so color is never the only cue (DESIGN.md).
  - When the pin is grey "Old location", the line and dot are grey and faded too, with the same label.
  - The assignment only has the places as typed words, so the ride's request is read **once** for its map positions (dispatchers may read any request; no rules change). No map position = no line. Most destinations are typed words only, so after Picked Up most rides show no line until Task 3.27.
  - The lines move like the pins (no map rebuild) and don't change how the map zooms to the selected request's pins.
  - **Labels on hover (changed after testing, October 19):** always-visible labels under the driver pins and next to the end dots covered the map. Now a pin's or dot's label shows only while the mouse is over it, while the keyboard is on it (pins and dots are Tab stops), or after a tap; tapping a driver pin still opens its pop-up. "Old location" pins and lines stay grey **and faded**, so old is not shown by color alone.
- **3.17 (phone, needs demo-ready-19; the owner's 13 screenshots, October 19):**
  - **Step 1, navigation bar:** Pin Pickup Location (Cancel / Confirm pin), Request history (last card) and Request details (Cancel request) now leave room for Android's bottom bar (safe-area inset), like the request form and menu already did. Tested with the 3-button bar and swipe gestures.
  - **Step 2, clock area:** the Request a Ride form has a green strip (home header green) behind the clock, so the form no longer scrolls under it and the white icons are readable (the old "dark icons" line did not reach this pop-up window and was removed). The resident ☰ menu panel starts below the clock area.
  - **Step 3, small fixes:** the Complete mission "Issues encountered (optional)" hint has a color and shows; the driver header drops ", Toledo City" like the resident header; the map's "© OpenStreetMap contributors" credit has a margin so a rounded corner never cuts it (license requirement, all maps).
  - **"Pinned location" (display only, `lib/placeText.js`):** a pickup/"From" text that is only map numbers ("10.390482, 123.649995") shows as "Pinned location" on the resident home card, Request history and details, the driver's ride card, ride history, review pop-up and map, the dispatcher's Selected Request, caller details, alert strip and map, and the Admin request details, request list and Emergency Calls. Saved data is unchanged; the driver's Navigate button still sends the real text to Google Maps; the pin picker and the request form still show the numbers while the resident places the pin.
  - **Left out on purpose:** the different date formats (for the UI refresh) and old "Transport Transport" titles (data cleanup will remove them).
- **3.15, Delete Account part (phone and website, Residents and Drivers; the Profile-editing part of 3.15 is not done):**
  - Settings has a red-edged **Delete account** button at the bottom. **Change Password was removed** from Settings in the same commit (owner's decision, October 19); a forgotten password is reset with Forgot password on Log in.
  - It is **blocked** (never cancels anything by itself) while a resident has a request that is Pending, Assigned or In Progress or an emergency alert open, or while a driver is on duty or has a ride.
  - Confirm: the person types their password (or, on the phone, chooses their Google account again; Google accounts can't be deleted on the website) and ticks "I understand this can't be undone".
  - Then the profile gets `deletedAt` and loses phone, phone number, address and picture fields (name and barangay stay), and the login is deleted. Rides, alerts and duty records stay (Privacy Policy section 7). No `firestore.rules` change.
  - If deleting the login fails after the mark is saved, logging in shows "This account was deleted" with **Finish deleting** / **Log out**.
  - Admin: Users shows a grey **Deleted** pill and "Deleted on …"; deleted accounts are left out of Resident Verification and Driver Applications (and their counts). Dispatcher: deleted drivers are not in Driver availability.
- **3.18 (`a7e77ec`):** the resident home has a bottom bar with **Your ride** and **History**; Emergency stays at the top of both. History moved out of the ☰ menu into its own page (fixed header with filters and search, cards with status badges). Built together with the resident home's UI refresh. Chat (3.23) is not added.
- **UI refresh (DESIGN.md "Style", `fd5a790`), every role (look only; no saving, rules or ride logic changed):**
  - **Step 1 (`f71d34e`):** Plus Jakarta Sans everywhere, the color scales / corners / shadows as tokens in `constants/design.js`, one date format in `lib/dates.js`.
  - **Resident (`a7e77ec`, `df73822`):** off-white page, white cards with soft shadows, pill buttons; Emergency keeps its 24 corners and stays the most obvious thing. No text under 15 on these screens.
  - **Sign-up screens (`4df10ed`):** Create Account, Verify email, Choose role, resident registration, driver application.
  - **Driver (`37c414b`):** three tabs (the open tab has a light-green pill behind its icon, like the resident bar; **this replaces 3.1's no-pill look, owner's choice October 19**), white ride card and Ride steps, pill buttons, "Inbox empty" empty state, duty card with 16 corners (Off duty is white), all pop-ups. The cancelled-ride **OK** and Ride details **Close** buttons are white, not red/green (red is only for emergencies).
  - **Dispatcher website (`b4b7917`):** white request cards with the level as a pill (Emergency red, Urgent peach, others light green); **Emergency cards also get a 2 px red edge all around** (owner's choice; DESIGN.md allows no side stripes). White driver cards with tinted status pills (On a run stays solid deep green). Selected Request, map frame and header in the Style. The red emergency strip and the emergency form keep their colors and layout. Paddings and line heights of the no-scrolling layout (3.13) are unchanged.
  - **Admin website (`c69a88d`):** `lib/theme.js` (only Admin uses it) moves onto the Style scales; white side menu and panel, count badges as pills (red for emergencies, orange with dark numbers for waiting approvals), pill buttons, 16-corner pop-ups, grey read-only boxes. **Text sizes and spacing were left as they were** here; later fixed by the Admin text 15 px change (`ec140b1`) and 3.19 (denser layout).
- **Skeleton loading (extends 3.16):**
  - **Phone (`34525d4`, `5233ce4`):** the driver's Ride page, duty card and Ride history, the resident's "Your ride" card, and the driver Application Status page show the grey 3.16 placeholder until Firebase answers. Before, they briefly showed a false "Inbox empty", "Off duty" with Punch in, "No rides yet" or "No reason was given.". Each "has it answered?" flag turns on at the first answer or at an error, so a placeholder never stays.
  - **Admin (`c69a88d`):** Resident Verification, Driver Applications and both Duty Records lists (the spinners 3.16 kept). **Overview** waits for users, requests, vehicles and applications, and **Reports** for the requests, so neither shows 0s or "No ride requests are loaded yet" while loading.
  - Spinners kept on purpose: the start-up / access-check screens, "Opening the map…", the emergency "waiting for the dispatcher" circle, and small spinners inside buttons.
- **Terms / Privacy from the ☰ menu (`801fa37`, phone):** they open in a full-screen window **on top of** the open menu, so the menu no longer closes and reopens (the flash). "← Back" and the phone's Back button return straight to the menu. The website still opens them in a new tab.
- **Dispatcher map labels (`b8d38e0`, website):** the pickup and destination pins now behave like the driver pins (`e9bf92a`): their label shows only on mouse-over, click or keyboard focus and closes when the mouse leaves. **This replaces** the always-visible "Destination" tag (destination pin note above) and the self-opening "(approximate geocoded match)" label (3.5 note above). Instead, Selected Request shows a one-line **"Approximate location (from typed address)"** with a warning icon under the pickup when the pickup has no exact pin. Phone maps are unchanged.
- **Admin Overview and header (`6fc80a0`, website):**
  - From **1280 px** wide, Overview is a one-screen dashboard: top row Needs attention (1/3) + Requests over time (2/3, the 7 days / 4 weeks / 12 months choices next to its title); bottom row Ride requests, Drivers and vehicles, What rides were for, Waiting time. The two rows split the height evenly; the chart fits inside its half. The bottom cards measure their content, and no row gets shorter than the tallest card, so a too-short window scrolls instead of cutting text. Tested 1366×768 to 1920×1080. Narrower windows keep the stacked layout.
  - The Admin panel is now the window height minus the header and margins, so the Admin page itself does not scroll.
  - The Admin header uses the dispatcher's title (`HeaderBrand` in `AppBrandHeader.jsx`): the icon, "SakayNa", and only the barangay name under it (**this replaces 3.6's "Barangay Daanglungsod" under the big logo**).
- **3.19 Admin website layout (website only; layout and spacing only, no saving, rules or logic changed; text stays ≥ 15):**
  - **Step 1 (`02d4c54`):** DESIGN.md "Admin website exception": less empty space, not smaller text; small list buttons and filter chips may be 40 tall; main pop-up actions stay ≥ 48.
  - **Step 2 (`10c1395`), side menu:** one left-aligned row per section with an icon and its word; the open one is a green pill; count badges at the end. Under 1080 px wide the menu is a row of wrapping pills above the panel.
  - **Step 3 (`f11ec69`), title lines:** every section starts like Overview (`AdminSectionHeader.jsx`): a 40 round icon (red for Emergency Calls), the title, a short explanation. Vehicles and Operations got a title; Reports (inside Operations) has a smaller sub-heading.
  - **Step 4 (`d840673`), Requests:** short cards, 1/2/3 per row, equal height; the whole card opens the details pop-up. **Emergency rides keep a 2 px red edge and a red "Emergency" pill**, like the dispatcher's queue (old "Emergency Request" rides too). Status pills are tinted with their word.
  - **Step 5 (`df31234`), Users:** search and Role on one line, tighter rows, 40-tall buttons and chips, tinted status pills.
  - **Step 6 (`e9b9cd1`), Resident Verification and Driver Applications:** one white list with thin lines, one detail line per person, Review button at the end. The review pop-ups are unchanged.
  - **Step 7 (`0ee8cdd`), Operations:** one row of tabs; Accounts (search and filters on one line) and Maintenance as cards, 2 per row; Logs as one list; Add Dispatcher and Settings forms at most 560 wide.
  - **Step 8 (`d7394d1`), Vehicles:** the Add button on the title line; cards 3/2/1 per row with Edit/Delete at the bottom.
  - **Step 9 (`c94fdbe`), Duty Records and Reports:** Duty Records list in a white box, 40-tall day buttons; Reports card titles 18 (under the 21 "Reports" heading). Emergency Calls unchanged (already compact since 3.14).
  - **Left out on purpose:** a search box in the top bar for every section, and separate detail pages (the existing pop-ups are kept).
- **Privacy Policy (`8609091`, `5319b3a`):** section 7 says how long records are kept (ride requests and alerts 1 year, duty records 1 year, photos removed within 30 days after an account is rejected or deleted, a deleted account's history 1 year; removal is done by hand by the system administrator). Section 2 says the driver's location is also saved every 15–60 s while SakayNa is open (3.20).

#### Other work on big-update (October 19, 2026)

Also tested by the owner and committed on `big-update`.

| Work | Commit(s) | Reaches testers via |
|---|---|---|
| DESIGN.md "Style" section (UI refresh, approved) | `fd5a790` | docs |
| UI refresh Step 1: Plus Jakarta Sans, design tokens, one date format | `f71d34e` | APK + website |
| UI refresh: resident home + 3.18 bottom bar | `a7e77ec` | APK + website |
| UI refresh: rest of the resident screens | `df73822` | APK + website |
| UI refresh: account-creation (sign-up) screens | `4df10ed` | APK + website |
| UI refresh: driver screens | `37c414b` | APK |
| UI refresh: dispatcher website | `b4b7917` | website |
| UI refresh: Admin website + Admin skeletons + no 0s while loading | `c69a88d` | website |
| Privacy Policy section 7 (how long records are kept) and section 2 (live driver location) | `8609091`, `5319b3a` | website + APK |
| Terms / Privacy from the ☰ menu: open on top of the menu, no flash | `801fa37` | APK |
| Skeletons on the phone (driver Ride page, duty card, Ride history; resident Your ride) | `34525d4` | APK |
| Skeleton on the driver Application Status page | `5233ce4` | APK |
| Dispatcher map: every pin's label on hover; approximate-pickup line in Selected Request | `b8d38e0` (earlier: `e9bf92a` driver/route labels, `9f1c6fb` Show on map button) | website |
| Admin Overview on one screen + Admin header like the dispatcher's | `6fc80a0` | website |
| Release plan: release as soon as done; Oct 22 noon is the latest | `3ec93b8` | docs |
| Admin text at least 15 px (no layout change) | `ec140b1` | website |
| Admin Overview chart fits its card on short windows (measured box, scrolls if too short) | `60f2747` | website |
| PRODUCT.md (no Change Password, new UI, activity log line) | `a30599a` | docs |
| Pre-release test checklist (`docs/pre-release-test.md`) | `604ed84` | docs |

#### Not done yet (October 19, 2026)

| Item | Status |
|---|---|
| 3.15, Profile-editing part | Not done (editing still lives in Settings). The Delete Account part is done. |
| 3.22, 3.23, 3.24, 3.25 | **Future work** (owner's decision 13, October 19): not built for the capstone. See "Future work / recommendations" below. (3.19 was also on this list until decision 14; it is done.) |
| 3.27 Resident drops a destination pin | Not started. **Optional, only if there is time after the release test.** |

#### Future work / recommendations (not built for the capstone)

Owner's decision 13 (October 19, 2026): these are left out because there is not enough time before the defense. They can be presented to the panel as recommendations. Details of each are in its task below.

| Item | What it would add | Why it waits / what it needs |
|---|---|---|
| 3.22 Barangay-first emergency ringing | Alerts ring the barangay's own dispatcher first, then everyone after 30 seconds | Changes who hears an emergency; needs a full emergency rehearsal plan and tests (covered, uncovered, covering dispatcher offline). |
| 3.23 Chat between Resident and Driver | Short text messages for one ride | A new database collection and a `firestore.rules` change (live deploy); Privacy Policy update. |
| 3.24 Light/Dark theme switch | A dark look for every screen | Touches almost every file; goes against DESIGN.md "light only"; emergency red contrast must be rechecked. |
| 3.25 City Admin / Super Admin role | City Admin (city-wide map, statistics, creates Dispatchers) above Barangay Admins | Splits every Admin rule in `firestore.rules`; needs its own plan, Playground tests and the safe deploy steps. |
| 3.26 Several vehicles for one big group | Already Stage D (future) | Changes the ride flow; see HANDOFF F8. |

#### Next steps (in this order)

1. ~~**Admin text 15 px fix**~~ **Done** (`ec140b1`), and **3.19** Admin layout **done** (decision 14).
2. **Full pre-release test** of `big-update` from `docs/pre-release-test.md`: every role on the phone (development build) and the website: a normal ride, cancellation, emergency with the form, duty/break, Admin approval and the new Admin layout (group E), Delete Account, big text.
3. **Release** (owner decision 1): merge `big-update` into `master` **once**, then `master` → `main` for Vercel (check "Ready" and the live pages), then the **local build** of **demo-ready-19** from that merge (EAS free builds are used up until November 1; same steps as demo-ready-18), phone-tested, tagged. Testers must uninstall the old SakayNa first. **Noon, October 22 is the latest**, not the target.
4. **October 22:** data cleanup (old test rides, alerts and accounts), demo accounts for every role, and the defense rehearsal.

---

### Stage A tasks

#### Task 3.1: Driver bottom bar highlight ✅ Done (c7205dd)
- **What changes:** in `app/driver-home.jsx`, the open tab shows a green icon and green bold word only. The grey-green box behind the icon (`tabIconOpen`) and the grey flash when pressed (`tabButtonPressed`) are removed.
- **Could break:** nothing important. Only looks. The orange "new ride" dot stays.
- **Changed October 19 (`37c414b`, owner's choice):** with the UI refresh the open tab has a light-green pill behind its icon again, like the resident bar (3.18).

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
- **Status October 19, 2026:** the **Delete Account** part is done (`5171780`), and **Change Password was removed** from Settings instead of kept (owner's decision; Forgot password on Log in resets a password). The Profile-editing part below is **not done**: editing still lives in Settings. Details in "Progress on big-update".
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

#### Task 3.17: "Should not touch the navbar" ✅ Done (see Progress)
- **What it means (to confirm):** on some phones, content sits under Android's own bottom navigation bar (the ◁ ○ □ or swipe bar).
- **Decision needed:** which screens? Send screenshots. Each fix is usually one line (add the safe-area space at the bottom).

### Stage C tasks

#### Task 3.18: Resident bottom bar
- **What changes:** `app/resident-home.jsx` gets a bottom bar like the Driver's: **Your Ride** (the current home with the map and Request a Ride) and **History** (today's Request History, moved out of the ☰ menu). **Chat** is added as the third tab only when Task 3.23 is built, so there is never a tab that does nothing.
- **Must keep:** DESIGN.md says the Emergency button is "visible and one tap away in every state". It must stay on every tab.
- **Could break:** `resident-home.jsx` (1,646 lines) also contains the whole emergency alert and auto-call system. The bar must only wrap the page; the emergency code must not be moved or changed. Full emergency test afterwards.

#### Task 3.19: Admin website layout ✅ Done (decision 14; commits in "Progress on big-update", details in "Changes made along the way")
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

#### Task 3.22: Emergency alerts by barangay (future work, decision 13)
- **What changes:** each Dispatcher already has a "service areas" list of barangays (Admin → Operations → Dispatcher scope) and each alert already saves the resident's barangay. The Dispatcher screen would:
  1. **Ring** an alert right away only for dispatchers whose service areas include that barangay.
  2. Show it quietly to the others ("Other barangays").
  3. If nobody answers within **30 seconds**, or no dispatcher covers that barangay, ring it for **every** dispatcher (safety net).
- **Rules:** none (all dispatchers can still see all alerts; the city-wide system stays).
- **Limits:** "nearest" means "same barangay", not GPS distance. There are no push notifications, so a dispatcher only hears alerts while the website is open (same as today). Old APKs still work (the alert format does not change).
- **Could break:** **an emergency could be answered late** if service areas are set wrong. The 30-second safety net is required, not optional. Needs a full test: resident in a covered barangay, in an uncovered barangay, and with the covering dispatcher offline. Also Known-Issue C3 (alerts hidden after 2 minutes) interacts with this timer.

#### Task 3.23: Chat between Resident and Driver (not built for the capstone, decision 13)
- **What changes:** a new database collection for messages of one ride. Only that ride's Resident and its assigned Driver can read and write; dispatchers and Admins cannot. Messages are short text only (no photos), cannot be edited or deleted, and chat is open from Assigned until Completed/Cancelled. Resident: Chat tab (3.18). Driver: a Chat button on the Ride page.
- **Rules:** **yes**, a new section in `firestore.rules`. It adds a new collection and does not change existing ones, but it is still a live deploy (use the safe deploy steps, after the defense).
- **Limits:** no push notifications, so a new message shows only when the app is open (a dot on the tab).
- **Could break:** the driver's Ride page layout. Privacy Policy must mention saved messages.

#### Task 3.24: Light/Dark theme switch (future work, decision 13)
- **What changes:** a switch in Settings. Every phone screen needs dark colors defined and used. Many screens still have hard-coded colors (`#06774B`, `#FFFFFF`, …), so this touches almost every file.
- **Conflicts with DESIGN.md:** "Theme: light only" (dark mode was removed on purpose on Oct 3, 2026). The group must agree to change DESIGN.md.
- **Recommendation:** do it last, or leave it as future work. It is the most work for the least safety/function value.
- **Could break:** unreadable text in places that were missed (white on white). Emergency red contrast must be rechecked.

### Stage D (future feature: own plan after the defense)

#### Task 3.25: City Admin / Super Admin role (not built for the capstone, decision 13)
- **What changes:** a new role. **City Admin:** live map of all barangays, city-wide statistics, and the **only** one who creates Dispatcher accounts. **Barangay Admin:** today's Admin, minus the tools that move to the City Admin.
- **Rules:** large. Every `isAdmin()` check must be split into "Barangay Admin" and "City Admin". Add Dispatcher rules move to the City Admin.
- **Also changes:** `lib/roles.js`, `AuthRouteGate.jsx`, a new City Admin website screen, and Admin accounts in the Console. The barangay-scoping questions from Task 1.4 come back here.
- **Could break:** a rules mistake can lock every Admin out or let one see too much. Needs its own full plan, Playground tests, and the safe deploy steps.

#### Task 3.26: Multiple vehicles for one big group
- Real assignment of a second driver and vehicle to one request (HANDOFF F8). It changes how rides, the Resident's progress screen and the Driver's steps work. Only if the lead wants more than the warning in 3.10.

#### Task 3.27: Resident drops a destination pin (optional, only if there is time after the release test)
- **What changes:** on Request a Ride, the Resident can drop a pin for the destination too (like the pickup pin), so the ride saves the destination's real lat/lng instead of only the typed words. The Dispatcher map then shows the destination exactly, not as an address-lookup guess.
- **Needs:** a phone change, so a **new APK**. No rules change expected (check before building).
- **Could break:** the Request a Ride form gets longer; old rides and old APKs still have text only, so the address lookup must stay as the fallback.

### Owner's decisions (October 14, 2026)

1. Build Phase 3 on `big-update`. **No rules deploy before October 23.**
   - **Changed October 19 (replaces "decide on October 20"):** **one** release: big-update is merged into master **once** (then master → main for the website), and the **demo-ready-19** APK is built from that merge.
   - **Updated October 19:** the release happens **as soon as everything is done and tested**. **Noon, October 22 is the latest, not the target** (feature freeze: only work that is tested and committed by then goes in). **October 22 is kept for rehearsal, data cleanup and demo accounts.**
2. Compact = fewer boxes and less space. Phone text stays ≥ 15 and taps ≥ 48. The Admin website may be denser (write that exception in DESIGN.md at Task 3.19).
3. Passenger phone (3.2): **required**.
4. "Community / Personal Trip" (3.9): **rename it**; Claude suggests names, the owner chooses.
5. People (3.10): cap **50**, big-group warning from **10**.
6. Schedule (3.11): up to **1 year** ahead, at least **1 hour** from now.
7. Profile/Settings (3.15): editing moves to Profile. Delete Account **keeps** ride and duty history.
8. Live location (3.20): only while the driver app is open.
9. Route line (3.21): straight line first.
10. Navigation bar (3.17): the owner sends screenshots later.
11. Dark mode (3.24): keep it, but do it last. **Changed October 19: future work (decision 13).**
12. Chat (3.23): "rider" means the **Driver**. Chat is Resident ↔ Driver only. **Changed October 19: not built for the capstone (decision 13).**
13. **(October 19, 2026)** Because of time, Chat (3.23) and the City Admin / Super Admin role (3.25) will **not** be built for the capstone. 3.19 Admin layout, 3.22 barangay-first emergency ringing and 3.24 dark mode are future work too. 3.27 destination pin is optional, only if there is time after the release test. All are listed in "Future work / recommendations".
14. **(October 19, 2026, evening)** Build **3.19** Admin layout after all (replaces decision 13 for 3.19 only). Layout and spacing only, text ≥ 15, Overview and header not redone. Done in 10 steps; the tag `pre-admin-layout` (`604ed84`) marks the code before it.

---

## 📋 Execution Rules & Workflow
1. **Always Work Step-by-Step:** Do not combine multiple tasks into one big commit.
2. **Review First:** Before touching code for any task, explain what files will change and wait for approval.
3. **Phone & Web Testing:** Every single task must be tested on your device and committed before starting the next.
4. **Clean Git State:** Maintain clean Git commits so rollback is trivial if anything fails during rehearsal.

