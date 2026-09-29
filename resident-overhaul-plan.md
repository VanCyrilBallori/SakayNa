# Resident UI Overhaul Plan

## Goal
1. A new, simpler transport request form.
2. A side menu (☰) instead of the avatar pop-up.
3. A map-first home screen with a big Emergency button.

## Decisions
- Must cost nothing. Keep the free map we already use (Leaflet +
  OpenStreetMap). No Google Maps.
- No new packages → no step needs a new EAS build (testers still need a
  new preview APK at the end).
- No Firestore rules changes. The rules only check who owns a request
  (firestore.rules:84-93), not which fields it has.
- Emergency = the red Emergency alert only. The form no longer has
  "Emergency transport". Top of the form: "Emergency? Close this and tap
  the red Emergency button."
- Old requests (old form, old APKs) must still show correctly. Screens
  read the new fields first, then fall back to the old ones.
- design-refs/indrive-*.png are layout ideas only (kept on this computer
  only, not in git; see .gitignore). SakayNa colors, and
  the current Dark/Light switch stays.

## Answers (2026-09-29)
1. Max passengers: 6 (MAX_PASSENGERS in requestOptions.js, easy to change).
2. Schedule: at least 1 hour from now, at most 7 days ahead.
3. Help / Contact: show the one city office number (publicOfficePhone).
4. Old transport requests: test data. You delete them by hand later,
   using "Deleting old test requests" below.
5. Pickup barangay: starts filled from the profile, resident can change it.

## What I found

### Vehicle capacity
- A vehicle saves only name, type (free text, e.g. "Ambulance") and plate
  number. No seat count anywhere (admin-home.jsx:646-654).
- So the passenger limit is one fixed number: MAX_PASSENGERS = 6.

### Map library and cost
- Leaflet inside a WebView (components/LeafletMap.jsx), free OpenStreetMap
  map pictures, free Nominatim address search.
- No Google Cloud, no API key, no billing account, no cost. Full screen
  is the same map, just bigger.
- OpenStreetMap "fair use": fine for small projects; the credit line
  must show (it already does). See Known-Issue.md.
- Google Maps would need a new package, a new EAS build, and a Google
  Cloud billing account (credit card) even if you stay free. Not needed.

### Location denied / GPS off
The home map never shows a new permission pop-up. It only uses location
if already allowed (the once-per-install pop-ups stay as they are).

| Situation | Home map | Request form | Emergency alert |
|---|---|---|---|
| Allowed, GPS on | Centers on you with a pin | "Use Current Location" fills pickup | Location sent (as today) |
| Permission denied | Shows Toledo City + "Location is off. You can still pin your pickup or type a landmark." | Message explains; use Map Pin or type | Still sends; dispatchers see your barangay (as today) |
| GPS off | Same + "Turn on Location (GPS)" + Try again | Same message as today | Same |
| No internet | Map area grey; buttons still work | Map pin won't load; typing works | "Alert not confirmed" + Try again (as today) |

### Emergency stays one tap
- Big red button always visible at the top of the bottom sheet. The sheet
  cannot be dragged away.
- It is a normal app button, not inside the map, so a broken map can
  never block it.
- Flow stays: tap Emergency → "Send emergency alert?" → Send alert. The
  confirm stops pocket-taps.

### "Schedule for later" — what changes for dispatchers
1. Scheduled requests sit in the same waiting list with a tag like
   "Scheduled: Fri Oct 3, 9:00 AM". ASAP requests on top (oldest first),
   then scheduled ones (soonest first). Today the list has no order.
2. Nobody gets a reminder (the app has no notifications). The dispatcher
   watches the list and assigns near the time.
3. Assigning too early locks the vehicle: the driver sees it as their
   current trip right away and the vehicle stays "busy" until the trip
   ends. The assign window warns: "This ride is scheduled for later.
   Assign closer to the time."
4. If the time passes and nobody assigned it, the tag turns red:
   "Scheduled time passed".
5. Priority becomes "Planned" automatically.

### Screens that read transport requests
| Screen | What must change |
|---|---|
| Dispatcher list + map (dispatcher-home.jsx:204-225, 513-514, 539) | Purpose, passengers, when, assistance. Bug: the list copies only some fields and drops the pinned coordinates, so the map guesses from the address text (same bug as #13). |
| Dispatcher assign window (626-627, 675) | Same labels + "scheduled for later" warning |
| Driver mission + Review details (driver-home.jsx:385-400, 714-782, 915) | Map pin (#13); passenger name, phone, count, assistance, notes, scheduled time (#14); "Patient" → "Passenger" |
| Resident Latest Request (resident-home.jsx:580-585, 686-700) | Service Type / Passenger Capacity → Purpose / Passengers / When |
| Request History (ResidentRequestHistory.jsx:14, 29, 46) | Type filter Emergency/Community → Purpose filter |
| Request Details (ResidentRequestDetails.jsx:20-23) | Show the new fields |
| Admin list, details, filter, counters (admin-home.jsx:50-77, 420, 450, 499; AdminRequestsSection.jsx:86; useAdminDashboardData.js:169-170) | "Emergency Type" → Purpose; count and filter by purpose. Bug: without this, admin would call every new Medical trip an "Emergency Request". |
| Priority (requestOptions.js getResidentReportedPriority) | New rule below; dispatcher colors unchanged |

### Old issues fixed on the way (Skills/resident.md section 6)
- #12 destination stuck → gone (destination becomes a plain text box).
- #13 driver map → uses getPickupCoordinates (already used by "Open
  pickup"). Same fix for the dispatcher map.
- #14 driver sees passenger name, phone, assistance, notes.
- Free: #20 (GPS no longer changes the barangay), #21 ("View Status"
  button removed).

## New form: fields and saved data
| Field | Saved as |
|---|---|
| Purpose: Medical/Health, Community/Personal Trip, Other | purpose (+ purposeOther if Other) |
| When: ASAP (default) / Schedule for later | timing ("asap"/"scheduled") + scheduledFor |
| Who is riding: Me / Someone else | ridingFor + passengerName + contactNumber ("Me" = from profile); residentPhone always |
| Passengers − / + (1 to 6) | passengerCount (number) |
| Pickup: barangay (from profile, can change), Use Current Location / Place Map Pin, details/landmark | barangay, pickup, pickupDetails |
| Destination (text) | destination |
| Assistance (multi): Senior, PWD/Wheelchair, Pregnant, Child, Help boarding, Other | assistance (list) + assistanceOther |
| Notes (optional) | additionalNotes |

- Still saved so older screens keep working: title, summary, status,
  reference, priorityLevel / level.
- No longer saved: category, serviceType, emergencyType, vehicle,
  passengerCapacity, vulnerableGroups, description.
- Date/time: date dropdown (Today, Tomorrow, … up to 7 days) + time
  dropdown in 30-minute steps (existing dropdown package). A calendar
  picker would need a new package + EAS build and works badly on the
  website.
- Priority rule: Scheduled → Planned. Medical/Health + ASAP → Urgent.
  Everything else → Non-Urgent.

## Steps (one at a time: plan → test on phone → commit)
[UI] = design with Impeccable. No step needs [Build] or [Rules].

1. Driver + dispatcher see the right pin and the passenger info (#13,
   #14) — DONE (tested 2026-09-29)
   - Driver map uses the resident's pin. Driver sees a Passenger card:
     name, tap-to-call phone, people, help needed, notes. "Vehicle" shows
     the real vehicle name.
   - Dispatcher map uses the resident's pin.
2. New request form, ASAP only [UI] — DONE (tested 2026-09-29)
   - Full-screen form like the resident registration: purpose, who is
     riding, people − / + (max 6), pickup barangay + optional GPS / map
     pin + landmark, destination, help needed, notes → Review → Sent.
   - "Someone else" phone is optional; if empty, the driver gets the
     resident's number.
   - Priority: Medical / Health → Urgent, others → Non-Urgent.
   - requestType stays "Community Transport Request".
3. Other screens show the new fields.
   3a. Dispatcher and driver — DONE (tested 2026-09-29)
       - Queue cards: priority + ASAP, title, people, barangay, "Needs
         help" line. Longest-waiting request on top.
       - New "Selected Request" box: passenger, big phone number
         (0917 123 4567), booked-by line, pickup, landmark, destination,
         help needed, notes.
       - Assignments save the ride title ("Handling: …", driver History).
       - Driver: landmark on the pickup card; "Patient Transfer" →
         "Current Ride".
       - Shared label helpers in features/resident/utils/requestMapper.js.
   3b. Resident and Admin — DONE (tested 2026-09-29)
       - Resident: Latest Request rows, History purpose filter, new
         Request Details rows (incl. notes).
       - Admin: 3 purpose overview cards (server counts) replace
         "Total Emergency / Community Requests"; "Ride for" filter,
         pills and details.
4. Schedule for later — DONE (tested 2026-09-30)
   4a. Form + dispatcher — DONE (tested 2026-09-30)
       - Form: "When do you need the ride?" ASAP / Schedule for later,
         Day + Time dropdowns (30-minute steps, 1 hour to 7 days ahead),
         time checked again when sending. Scheduled → priority "Planned".
       - Dispatcher: "Scheduled: Fri, Oct 2, 9:00 AM" tag (red "Scheduled
         time passed" when late); ASAP first, then scheduled soonest
         first; assign window warns when the ride is > 2 hours away.
   4b. Time shown to driver, resident and admin — DONE (tested
       2026-09-30). A "When" line reads
       "Fri, Oct 2, 9:00 AM" or "As soon as possible" (old requests
       = ASAP).
       - Driver: Current Mission card + Review details.
       - Resident: Latest Request card, Request Details, and a
         "Scheduled: ..." line on scheduled rides in Request History.
       - Admin: request cards (AdminRequestsSection.jsx) + request
         details pop-up (admin-home.jsx).
5. Side menu [UI]: slide-in pop-up from the left (no new package). Name +
   status at the top, Request History, Profile, Settings, Help / Contact
   office, Terms & Privacy (existing /terms and /privacy), Log out.
   Help = office number (publicOfficePhone) + Call button + "For
   life-threatening emergencies, call 911."
6. Map home layout [UI]: map on top, ☰ in the corner, Pending/Rejected
   banner floating on the map, fixed bottom sheet (like the Get Started
   sheet): big Emergency → Request a Ride → latest request card (tap →
   details). Removes the welcome card, the 3 cards and the avatar.
7. Home map shows your location (only if already allowed) + the
   "location off" / "GPS off" messages.
8. Paperwork: Skills/resident.md, PRODUCT.md (request types), Privacy
   Policy draft note (drivers see the passenger's name and phone;
   requests can be scheduled).
9. Release: website (master → main → Vercel) + new preview APK.

Release rule: don't update the website in the middle of steps 2–3b
(dispatchers would see half-finished labels).

## Releases
- 2026-09-29: website released with Steps 1–3b (master → main → Vercel,
  commit daa310a). Live checks passed (admin, dispatcher, resident).
  Testers' phones still have the old form until a new preview APK is
  built. That is safe: all screens still read old-form requests.

Order: form first (it changes the data every role reads), then menu
(the new home removes the avatar, so History / Profile / Settings need a
new place first), then map home.

## Deleting old test requests (answer 4)
Do this in the Firebase Console, when no driver is on a trip:
1. driverAssignments: delete every document (each one points to a
   request through requestId).
2. vehicles: for any vehicle with status "Assigned", set status to
   "Available" and clear assignedRequestId and assignedDriverId.
3. transportRequests: delete every document.
4. Log in as admin, dispatcher, driver and resident: every list should
   be empty, with no errors.
Emergency alerts (callSessions) can stay. Their latestRequestId is
never read.

## Left out on purpose
"My location" re-center button, reminders for scheduled rides, one office
number per barangay, calendar-style date picker, rules that stop
residents editing their own request (resident.md #3).
