# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

Android-first installed app. iOS is configured in `app.json` and must keep working, but it is not the priority. The web build exists as an Admin/testing convenience, not a resident-facing target. The app keeps one consistent look across platforms rather than mimicking each OS.

## Users

**Primary: residents of Toledo City, Cebu, who need transport and have no easy way to get a vehicle** — especially senior citizens, persons with disabilities, pregnant residents, children, and medical or emergency cases. They are at home or somewhere in their barangay, often on a basic Android phone, and need a barangay vehicle sent to them. In an emergency they need to reach a dispatcher immediately. Every other role exists to serve them.

Operational roles, all serving the resident:

- **Dispatcher** — city/barangay staff at a station. Answers in-app emergency calls, assigns pending requests to a driver and a vehicle, watches each driver's duty status.
- **Driver** — operates a barangay vehicle. Runs a mission through Accept → En Route → Arrived → Picked Up → Completed, completes a pre-trip vehicle checklist, and punches in and out of duty.
- **Admin** — oversight. Each Admin belongs to one barangay. Verifies the residents and driver applications of their own barangay, manages accounts and the vehicle fleet, monitors unanswered emergency calls, reads reports and the activity log.

## Product Purpose

SakayNa coordinates transport for Toledo City residents using barangay vehicles (vans, and ambulances where a barangay has one). A resident requests a ride (now or scheduled) or sends an emergency alert from their phone; a human dispatcher assigns a real vehicle and driver; the whole trip is tracked from request to completion.

It exists because residents who most need a vehicle are the least able to get one on their own.

**Success now:** a complete, stable, demonstrable 4-role flow for the capstone (already submitted; a UAT is underway).
**Success later:** the LGU or a barangay office runs a real pilot with real vehicles.

## Positioning

A **public-service dispatch system, not a ride-hailing marketplace.** There are no fares, no payments, no surge pricing, and no independent gig drivers anywhere in the product — vehicles are barangay assets driven by drivers an Admin has vetted, and a human dispatcher assigns every trip. A commercial ride-hailing product could not truthfully offer an in-app emergency call answered by a city dispatcher, accountable to the LGU, serving residents regardless of ability to pay.

## Operating Context

- **Place:** Toledo City, Cebu, Philippines. Addresses are barangay-based; the app carries the official Toledo barangay list (`lib/barangays.js`). Dates use the `en-PH` locale.
- **Vehicles:** barangay vehicles only (owned by the barangay, not the city; not every barangay has an ambulance), added and named by an Admin (e.g. "Barangay Van 1", type Van). Drivers do not register vehicles.
- **Transport requests:** one form. The resident picks what the ride is for (Medical / Health, Community / Personal Trip, or Other), when (as soon as possible, or scheduled 1 hour to 7 days ahead), who is riding (themselves or someone else), how many people (1–6), pickup, destination, and help needed (senior citizen, PWD / wheelchair user, pregnant, child, needs help getting in the vehicle, other). Priority is set automatically: scheduled → Planned, Medical / Health as soon as possible → Urgent, everything else → Non-Urgent. Older requests may still show the old types ("Emergency Request", "Community Transport Request") and the Emergency priority.
- **Emergency alert flow:** emergencies do not use the request form. The resident taps the red Emergency button → an alert rings at the dispatcher station → a dispatcher answers or declines. The Admin console flags any alert still ringing after 30 seconds.
- **Resident onboarding:** sign up (email or Google) → proof-of-residency photo → account is Pending → the Admin of the same barangay approves (Active) or rejects with a reason. Pending and Rejected residents can log in but cannot send emergency alerts or transport requests.
- **Driver onboarding:** apply in-app with document photos (license, NBI or police clearance, medical certificate, optional drug test) → account is Pending → the Admin of the same barangay approves or rejects with a reason → an Approved driver reaches the driver dashboard. Dispatcher and Admin accounts are created by an Admin in the Firebase Console, never by self-signup.
- **Evaluation ritual:** a User Acceptance Testing survey ("SakayNa User Acceptance Testing (UAT) Survey") is being run with test users.
- **Who maintains it:** a non-engineer. The project was deliberately simplified so it can be set up and run from a README on the free Firebase tier with no server.

## Capabilities and Constraints

**Confirmed functionality**

- Resident: sign up with proof of residency, request a ride now or schedule one, cancel it, see request status and timeline, send an emergency alert, edit profile. Home is a map (showing their location if already allowed) with a fixed bottom sheet (Emergency, Request a Ride, latest request) and a ☰ side menu.
- Driver: apply with document photos, wait on a status screen until approved, punch in / punch out, take breaks (Meal, Rest, Personal), accept/decline assignments (accepting sets "On a run", completing sets "Available" again), run the mission lifecycle, complete a vehicle readiness checklist.
- Dispatcher: see pending requests on a map (as soon as possible first, then scheduled rides soonest first), see the passenger's details and phone, assign request → driver + vehicle in one transaction, answer/decline emergency alerts, see each driver's duty status and time in it (only Available drivers can be assigned; an "app closed" warning for punched-in drivers whose app is closed).
- Admin: Overview stats (server-side counts for totals, by ride purpose), live Emergency Calls panel with stale-call badge, Resident Verification and Driver Applications lists (own barangay only), Duty Records (each driver's daily time record: first punch in, last punch out, break time, time on duty, rides completed; city-wide), Operations (account status/role changes with required reason and audit log, vehicle maintenance records, reports + CSV export, operational settings, activity log), Requests/Users/Vehicles lists with filters, vehicle add/edit/archive.

**Technical constraints**

- Expo SDK 54 / React Native / expo-router; JavaScript only.
- Firebase Authentication (email/password) and Cloud Firestore, accessed **directly from the client**. There is **no Cloud Functions backend and no server** — this was removed on purpose. Firebase free (Spark) plan.
- Firestore security rules are the only authorization layer. Role is read from `users/{uid}.role`; a user can never change their own `role` or `accountStatus`.
- Admin lists are capped at the latest 200 records per collection; Overview totals use full-collection server counts, but averages, the activity chart, and the Request Status panel use only those 200.
- Cloudinary unsigned uploads hold driver documents; those URLs are public.
- No push notifications (nothing installed). Deactivating a user does not disable their Firebase Auth login.
- One flat `Admin` role; no permission tiers. `ADMIN_PERMISSION_OPTIONS` exists in `constants/app.js` but is unused.

**Terminology** (use exactly): Resident, Driver, Dispatcher, Admin; barangay; *mission* = a driver's assignment; *request* statuses Pending / Assigned / In Progress / Completed / Cancelled; *mission* statuses Assigned / Accepted / En Route / Arrived / Picked Up / Completed / Declined; *account* statuses Active / Approved / Pending / Rejected / Suspended / Disabled / Deactivated.

**Explicitly undecided**

- Whether the "Phase 8" trusted backend (Cloud Functions for role claims, dispatcher invitations, permanent account deletion) will ever be built. It is documented in `docs/PHASE_8_BACKEND.md`; its two UI entry points are disabled and labeled "coming soon".
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
- A UAT survey is in progress (survey intro authored by the owner); results not yet on hand.
- **Absent — do not fabricate:** pilot results, usage numbers, testimonials, LGU endorsement or letters, press, partner logos, response-time benchmarks.

## Product Principles

1. **The resident in need comes first.** Dispatcher, Driver, and Admin exist to get a vehicle to that person; any tradeoff resolves in the resident's favor.
2. **An emergency never rings into a void.** Unanswered calls are surfaced loudly and immediately, never silently dropped.
3. **Public service, not marketplace.** No fares, no gig incentives, no growth mechanics. Human-dispatched city assets, accountable to the LGU.
4. **Vetted drivers, auditable admin.** Vulnerable people ride in these vehicles; driver verification and an activity trail are non-negotiable.
5. **Keep it runnable by a non-engineer.** No backend, free tier, console-provisioned staff. Complexity was removed on purpose and should not creep back without a clear reason.

## Accessibility & Inclusion

The primary audience explicitly includes senior citizens, persons with disabilities, pregnant residents, and children; every request records the help the passenger needs (these groups, plus help getting in the vehicle) and optional notes. Future surfaces must stay usable by people with limited mobility, low vision, low tech familiarity, and basic Android phones, often under stress. No formal standard (e.g. a WCAG level) has been set — this is an open decision, not an inference.
