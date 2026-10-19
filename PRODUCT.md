# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

Android-first installed app for Residents and Drivers. The website serves Dispatchers and Admins and is also used for testing. iOS is configured in `app.json`, but no iOS release/test is recorded here; Android is the priority. The app keeps one consistent look across platforms rather than mimicking each OS.

Checked October 11, 2026, against **demo-ready-16** at **39e4583**. The owner tested the APK on their phone; the EAS fingerprint says **matches**. The website is at **a25dae1**, with the four UI changes and Privacy Policy update, but without APK 16's separate completion-saving fix.

## Users

**Primary: residents of Toledo City, Cebu, who need transport and have no easy way to get a vehicle** — especially senior citizens, persons with disabilities, pregnant residents, children, and medical or emergency cases. They are at home or somewhere in their barangay, often on a basic Android phone, and need a barangay vehicle sent to them. In an emergency they need to reach a dispatcher immediately. Every other role exists to serve them.

Operational roles, all serving the resident:

- **Dispatcher** — city/barangay staff at a station. Answers emergency alerts on the website, assigns pending requests to a driver and a vehicle, and watches each driver's duty status. After Answer, the Resident's phone makes the SIM call.
- **Driver** — operates a barangay vehicle. Runs a mission through Accept → En Route → Arrived → Picked Up → Completed, and punches in and out of duty.
- **Admin** — oversight. Each Admin belongs to one barangay. Verifies the residents and driver applications of their own barangay, manages accounts and the vehicle fleet, monitors unanswered emergency calls, reads reports and the activity log. Other management tools and Duty Records remain city-wide.

## Product Purpose

SakayNa coordinates transport for Toledo City residents using barangay vehicles (vans, and ambulances where a barangay has one). A resident requests a ride (now or scheduled) or sends an emergency alert from their phone; a human dispatcher assigns a real vehicle and driver; the whole trip is tracked from request to completion.

It exists because residents who most need a vehicle are the least able to get one on their own.

**Success now:** a reliable, demonstrable 4-role Capstone flow. The survey demo is finished; the thesis defense is October 23, 2026. Actual survey scores are not supplied in these notes.
**Success later:** the LGU or a barangay office runs a real pilot with real vehicles.

## Positioning

A **public-service dispatch system, not a ride-hailing marketplace.** There are no fares, no payments, no surge pricing, and no independent gig drivers anywhere in the product — vehicles are barangay assets driven by drivers an Admin has vetted, and a human dispatcher assigns every trip. SakayNa is a Capstone demonstration of barangay transport coordination; a real LGU pilot or endorsement has not been confirmed.

## Operating Context

- **Place:** Toledo City, Cebu, Philippines. Addresses are barangay-based; the app carries the official Toledo barangay list (`lib/barangays.js`). Dates use the `en-PH` locale.
- **Vehicles:** barangay vehicles only (owned by the barangay, not the city; not every barangay has an ambulance), added and named by an Admin (e.g. "Barangay Van 1", type Van). Drivers do not register vehicles.
- **Transport requests:** one form. The resident picks what the ride is for (Medical / Health, Community / Personal Trip, or Other), when (as soon as possible, or scheduled 1 hour to 7 days ahead), who is riding (themselves or someone else), how many people (1–6), pickup, destination, and help needed (senior citizen, PWD / wheelchair user, pregnant, child, needs help getting in the vehicle, other). Priority is set automatically: scheduled → Planned, Medical / Health as soon as possible → Urgent, everything else → Non-Urgent. Older requests may still show the old types ("Emergency Request", "Community Transport Request") and the Emergency priority. Rides a dispatcher makes from an emergency alert (below) also use "Emergency Request".
- **Emergency alert flow:** emergencies do not use the request form. The resident taps the red Emergency button → an alert rings at the dispatcher station → a dispatcher answers or declines. When a dispatcher answers, the resident's phone (app only) calls the dispatcher's own phone (else their Operational phone, else the dispatch office) after a 3-second countdown the resident can cancel. The resident always calls; dispatchers use a computer, so their screen shows the resident's number as text only. During the call the dispatcher fills in an Emergency request form (emergency type, priority, number of patients, incident details, destination, and an Available driver and vehicle, with a rough distance to each driver); Submit creates the ride for the resident, already assigned to that driver and linked to the alert. Emergency form Part A (2026-10-05): Medical, Accident / injury, Fire-related, Pregnancy / labor, or Other (required specifics); 1–50 patients, typed in a box or with −10 / −5 / − / + / +5 / +10; optional approximate age and conscious/breathing Yes / No / Unknown. All types save purpose Medical / Health except Other. Structured facts and incident text are also copied into Notes for existing resident/driver APKs. A large incident still creates one assignment to one driver/vehicle. The Admin console flags any alert still ringing after 30 seconds.
- **Resident onboarding:** sign up (email or Google) → proof-of-residency photo → account is Pending → the Admin of the same barangay approves (Active) or rejects with a reason. Proof choices include National ID (a government ID), between Certificate of Indigency and Other government document with your address. The existing saved document label and photo link work in Admin review/viewing; older labels are kept and no rules change was needed. Pending and Rejected residents can log in but cannot send emergency alerts or transport requests.
- **Driver onboarding:** apply in-app with document photos (license, NBI or police clearance, medical certificate, optional drug test) → account is Pending → the Admin of the same barangay approves or rejects with a reason → an Approved driver reaches the driver dashboard. An Admin creates Dispatcher accounts through Operations → Add Dispatcher with a temporary password. They are not forced to change that password yet. Admin accounts are provisioned through Firebase Console; neither staff role uses public self-signup.
- **Evaluation:** the owner says the User Acceptance Testing survey demo is finished. Any reported scores must come from the actual thesis results.
- **Who maintains it:** a non-engineer. The project was deliberately simplified so it can be set up and run from a README on the free Firebase tier without a custom server.

## Capabilities and Constraints

**Confirmed functionality**

- Resident: sign up with proof of residency, request a ride now or schedule one, cancel it, see request status and timeline, send an emergency alert, edit profile. Home has a green Toledo City/barangay heading with a ☰ side menu. Below it, a scrolling page shows the account banner if needed, Emergency, Request a Ride, and Your ride (an active ride first, otherwise the newest request). Maps remain in the pickup/request and emergency flows; the home no longer shows a full-screen map.
- Password eyes (web and app): Log in and Create Account use hold-to-show, hiding on release, sliding off, cancellation or lost focus. Each eye is 52 × 52 pixels and labelled "Hold to show password", with screen-reader labels and web Space/Enter hold instructions. Pressing the eye keeps the keyboard and cursor; selection/context menus are suppressed on the eye. Resident/Driver registration has no separate password fields; both roles use Create Account first. Settings' Change Password boxes have no eyes.
- Driver: apply with document photos, wait on a status screen until approved, punch in / punch out, take breaks (Lunch, Rest, Personal), accept assignments (accepting sets "On a run", completing sets "Available" again; there is no Decline: the dispatcher chooses the driver, and the driver's "no" is not punching in or taking a break), report "I can't do this ride" with a reason (Vehicle problem, Feeling unwell, Family emergency, Other) until the pickup, which gives the ride back to dispatch, and "Call dispatch" (the office number) once the rider is on board. If the driver allows location (asked at Punch in), it is saved at Punch in, Accept, En route, Arrived and Picked up, and erased at Punch out. While SakayNa is open on screen and the driver is on duty and not on break, it is also saved every 15–60 seconds (never in the background, for example while Google Maps is open). The driver home has three pages with a bottom bar: Ride (one ride card, the step button, a ride steps list with times), Map (big map, a navigation button that follows the step), Availability (the duty card and Ride history). Complete mission has no Completion notes box; Issues encountered stays optional, and the dark backdrop fades separately from the sliding card using the landing sheet's approach. The selected outcome and trimmed issues (maximum 300 characters, empty when blank) save on the driver's assignment only when completion succeeds, together with the request's completion, availability changes and Run end duty record. Existing notes/records are kept. History/Admin do not yet display those two saved fields; Duty Records still use outcome Completed.
- Dispatcher: see pending requests on a map (as soon as possible first, then scheduled rides soonest first), see the passenger's details and phone, assign request → driver + vehicle in one transaction, answer/decline emergency alerts, see each driver's duty status and time in it (only Available drivers can be assigned; an "app closed" warning for punched-in drivers whose app is closed). When a driver can't do a ride: an orange "Needs a new driver" banner, the reason on the ride (listed first), and a "Reported: can't do a ride" warning on that driver's card; the dispatcher assigns another driver. Each on-duty driver's card shows "Last known location: 5 min ago (Arrived)" and a "Show on map" button that slides the map to that driver's pin. The map shows every on-duty driver in the list as a live pin labelled "Name · updated X min ago"; after 2 minutes without an update the pin turns grey and the label starts with "Old location". The location is saved at each step and, while SakayNa is open on the driver's screen, every 15–60 seconds; never in the background.
- Admin: Overview stats (server-side counts for totals, by ride purpose), live Emergency Calls panel with stale-call badge, Resident Verification and Driver Applications lists (own barangay only), Duty Records (each driver's daily time record: first punch in, last punch out, break time, time on duty, rides completed, and the day's inability reports; city-wide), Operations (account status changes with required reason and audit log, Add Dispatcher, vehicle maintenance records, reports + CSV export, operational settings, activity log; Change role is removed), Requests/Users/Vehicles lists with filters, vehicle add/edit/archive.

**Technical constraints**

- Expo SDK 54 / React Native / expo-router; JavaScript only.
- Firebase Authentication (email/password) and Cloud Firestore, accessed **directly from the client**. There is **no Cloud Functions backend and no custom server** — this was removed on purpose. Firebase free (Spark) plan.
- Firestore security rules are the only authorization layer. Role is read from `users/{uid}.role`; a user can never change their own `role` or `accountStatus`.
- Most Admin dashboard collections fetch the newest 200 records. Driver Applications fetch up to 200 for the Admin's barangay and then sort them locally. Overview totals use full-collection server counts, but averages, the activity chart, and Request Status use the fetched requests. Emergency Calls fetch the newest 100, with No answer items first (oldest waiting first). The activity log fetches 50 without ordering first and can miss recent entries.
- Cloudinary unsigned uploads hold proof-of-residency and driver document photos; those URLs are public to anyone with the exact link. The Privacy Policy names National ID as a government ID and repeats this warning. Use sample documents for tests.
- `expo-notifications` is installed and `lib/permissions.js` asks Residents for notification permission, but actual push delivery and scheduled-ride reminders are absent. Deactivating a user does not disable their Firebase Auth login.
- One flat `Admin` role; no permission tiers. `ADMIN_PERMISSION_OPTIONS` exists in `constants/app.js` but is unused.

**Terminology** (use exactly): Resident, Driver, Dispatcher, Admin; barangay; *mission* = a driver's assignment; *request* statuses Pending / Assigned / In Progress / Completed / Cancelled; *mission* statuses Assigned / Accepted / En Route / Arrived / Picked Up / Completed / Unable ("I can't do this ride", an *inability report*) / Declined (older APKs only); *account* statuses Active / Approved / Pending / Rejected / Suspended / Disabled / Deactivated.

**Explicitly undecided**

- Whether the "Phase 8" trusted backend (Cloud Functions for role claims, dispatcher invitations, permanent account deletion) will ever be built. It is documented in `docs/PHASE_8_BACKEND.md`. Add Dispatcher already works directly through the client without that backend; permanent deletion remains unavailable/deferred.
- Push notifications, multiple admin tiers, and a resident support/complaint channel: all absent, none scheduled.
- Whether the LGU pilot will happen, and which office would own it.

## Brand Commitments

- **Name:** SakayNa (app slug `sakayna`).
- **Logo assets (binding):** `Photos_/Logo (main).png` (wide lockup, 871×286) and `Photos_/Logo (Secondary).png` (near-square mark, 324×354; used as app icon, favicon, and splash). Rendered through `components/BrandLogo.jsx`.
- **Design rulebook:** `DESIGN.md` is the visual authority (colors, type, shapes, rules). `constants/design.js` still holds the color, spacing, radius, and type values in the code until each screen is rebuilt to match DESIGN.md.
- **Voice (observed in code, not separately confirmed):** plain, direct, public-service; fallbacks read "Not available" / "Not provided"; no marketing language.

## Evidence on Hand

- `README.md` — setup, roles and routes, Firestore collections, verification checklist.
- `docs/PHASE_8_BACKEND.md` — the deferred trusted-backend plan.
- The owner confirms the UAT survey demo is finished; actual scores/results are not supplied here.
- Phone-tested demo-ready-16 APK, matching EAS fingerprint, and recorded workflow/C1/C2 checks in `HANDOFF.md`. C3's separate three-minute background-call test remains unrecorded.
- **Absent — do not fabricate:** pilot results, usage numbers, testimonials, LGU endorsement or letters, press, partner logos, response-time benchmarks.

## Product Principles

1. **The resident in need comes first.** Dispatcher, Driver, and Admin exist to get a vehicle to that person; any tradeoff resolves in the resident's favor.
2. **Make unanswered alerts visible.** Dispatchers receive alerts and Admin flags No answer after 30 seconds. This does not guarantee a response: the background heartbeat/alert-hiding risk (C3) remains open.
3. **Public service, not marketplace.** No fares, no gig incentives, no growth mechanics. Human-dispatched barangay vehicles. A real LGU pilot/endorsement is not confirmed.
4. **Vetted drivers, auditable admin.** Vulnerable people ride in these vehicles; driver verification and an activity trail are non-negotiable.
5. **Keep it runnable by a non-engineer.** No custom backend, free tier, Admins provisioned in Console and Dispatchers created in Admin Operations. Complexity was removed on purpose and should not creep back without a clear reason.

## Accessibility & Inclusion

The primary audience explicitly includes senior citizens, persons with disabilities, pregnant residents, and children; every request records the help the passenger needs (these groups, plus help getting in the vehicle) and optional notes. Future surfaces must stay usable by people with limited mobility, low vision, low tech familiarity, and basic Android phones, often under stress. No formal standard (e.g. a WCAG level) has been set — this is an open decision, not an inference.
