# Resident Role — What a Resident Can See and Do

Everything below comes from reading the code. Every claim has a file path
(and usually a line number) so you can check it. Next to each file path is
the name of the function (or screen component) the line is in. "Unclear"
means I could not confirm it from the code alone.

Last checked against the code on 2026-09-30 (after the login overhaul and
resident overhaul Steps 1–8a, commit 6b2c81e). Line numbers can move when
the code changes; the function names are the safer guide.

---

## 1. Overview

A resident is a regular person living in Toledo City who uses SakayNa to get
a ride. They can:

- **request a ride** for themselves or someone else, as soon as possible or
  **scheduled** up to 7 days ahead (section 2.5 b),
- send a one-tap **emergency alert** to the dispatchers (section 2.5 a),
- **follow the status** of their requests until a driver finishes the trip,
  and cancel while it is still early (sections 2.5 c and 2.6).

**Signing up is a check, not just a form.** A new resident sends a photo that
proves they live in their barangay. Their account stays **Pending** until the
Admin of that same barangay approves it (section 2.2). Only **Active**
residents can send. Pending, Rejected and "on hold" residents (for example
Suspended) can log in and look around, but they **cannot send emergency
alerts or transport requests** (sections 2.5 and 4.1).

The home screen is a **map** with a fixed bottom sheet (big Emergency button,
Request a Ride, latest request) and a **☰ side menu** (section 2.5).

On the **Android app**, the resident stays logged in after closing the app
(section 2.4), and the app asks for phone permissions right after a resident
first reaches their home screen (section 2.5).

While an emergency alert is waiting for a dispatcher, the resident's app
keeps the screen on and sends an "I'm still here" signal every 20 seconds
(section 2.5 a).

---

## 2. Screens

After login, a resident has **one real screen**: `ResidentHome` in
`app/resident-home.jsx`. Almost everything else is a **pop-up window** (called
a "modal") that opens on top of it. The exceptions are the Terms of Service
and Privacy Policy pages (`app/terms.jsx`, `app/privacy.jsx`), which are real
pages with a Back button on the phone (section 2.5 d).

Before login there are a few real screens: the landing page, Sign Up, Verify
Email, Choose Role, Resident Registration and Log In.

### 2.1 Start / landing page — `app/index.jsx`

The phone app and the website show different first pages (`Index` in
`app/index.jsx:11-18`).

**On the phone app** (`MobileStart` in `app/index.jsx:21-31`):

1. While the app checks whether someone is already logged in, it shows
   "Starting SakayNa..." with a spinner (`MobileStart` in
   `app/index.jsx:24-26`).
2. If a remembered user has an allowed account, they go **straight to their
   home screen**. For a resident (Active, Pending or Rejected) that is
   `/resident-home` (`MobileStart` in `app/index.jsx:29-30`,
   `getPostAuthenticationRoute` in `lib/roles.js:46-62`).
3. Otherwise, the **mobile landing page** appears (`MobileLanding` in
   `components/MobileLanding.jsx:48`). It is **always light** on purpose (it
   does not follow the phone's theme or the app's Dark / Light switch). It
   shows:
   - **Get Started** → opens a slide-up sheet (`openSheet` in
     `components/MobileLanding.jsx:138`) with:
     - **Continue with Google** (`signInWithGoogle` in
       `components/MobileLanding.jsx:95-136`). A new Google user (no profile
       yet) goes to Choose Role (section 2.3). An existing user goes to their
       home. A disabled or unknown-role account is logged out with "Account
       unavailable".
     - **Sign up with Email** (`openEmailSignup` in
       `components/MobileLanding.jsx:150-162`) → the Sign Up screen. If
       someone who stopped a Google sign-up halfway is still signed in, they
       are logged out first.
     - **Already have an account? Log in with email** (`openEmailLogin` in
       `components/MobileLanding.jsx:144-147`) → the Log In screen.
   - **Already have an account? Log In** under the Get Started button →
     the Log In screen (`MobileLanding` in `components/MobileLanding.jsx:312`).
   - **Terms of Service** link → opens the real Terms page on the website in
     a browser (`openTerms` in `components/MobileLanding.jsx:89-91`,
     `TERMS_URL` in `constants/app.js:56`).

**On the website** (`WebLandingPage` in `app/index.jsx:33`):

- **Sees:** the SakayNa welcome page.
- **Can tap:** "Log In" and "Sign Up", and footer links: "Apply to Drive"
  (for drivers), Terms of Service and Privacy Policy.
- The website is mainly for staff. Residents are meant to use the phone app
  (the map home and location features are built for the phone).

### 2.2 Sign Up — `app/signup.jsx`, `app/verify-email.jsx`, `app/register-resident.jsx`

**Email sign-up has 4 steps: Create Account → Verify Email → Choose Role →
Resident Registration.** A Google sign-up skips the first two (Google emails
count as verified).

**a) Create Account** (`Signup` in `app/signup.jsx`):

- **Fills in:** Email, Password, Confirm Password (both password boxes have a
  show/hide eye button).
- **Taps Next** (`handleNext` in `app/signup.jsx:41-75`):
  1. The email must not be empty.
  2. The password must have at least 6 characters (`MIN_PASSWORD_LENGTH` in
     `app/signup.jsx:21`).
  3. The two passwords must match.
  4. Creates the login account in Firebase Authentication. **No profile is
     saved yet.**
  5. Sends a verification email, then goes to Verify Email.
  6. Clear messages for "This email already has an account" and a too-short
     password (`handleNext` in `app/signup.jsx:66-71`).

**b) Verify Email** (`VerifyEmail` in `app/verify-email.jsx`):

- **Sees:** "We sent a verification link to …".
- **Taps "I verified my email"** (`handleVerified` in
  `app/verify-email.jsx:52-77`): asks Firebase again whether the link was
  opened. If not: "Your email is not verified yet…". If yes: it gets a fresh
  login "ID card" (token) so Firestore sees the verified email right away, and
  goes to Choose Role.
- **"Resend email"** (`handleResend` in `app/verify-email.jsx:79-97`): sends a
  new email, then waits 60 seconds before allowing another
  (`RESEND_COOLDOWN_SECONDS` in `app/verify-email.jsx:20`).
- **"Wrong email? Start over"** (`startOver` in `app/verify-email.jsx:99-107`):
  logs out and goes back to Create Account.
- **Email verification is required now.** The Firestore rules refuse a new
  profile without a verified email (`selfCreateProfileIsSafe` in
  `firestore.rules:56-63`).

**c) Choose Role** (`app/choose-role.jsx`): "Resident" or "Driver"
(`chooseRole` in `app/choose-role.jsx:36-45`). Resident →
`/register-resident`. (Driver → `/register-driver`, not covered here.)

**d) Resident Registration** (`RegisterResident` in
`app/register-resident.jsx:58`). Pages: **Details → Proof → Review →
Submitted**.

| Page | Fills in | Checks (`checkPage` in `app/register-resident.jsx:40-56`) |
|---|---|---|
| Details | Full Name, Phone Number, Barangay (Toledo City list), Address (house no. / street / purok) | name at least 2 letters; a real PH mobile number; a barangay; address at least 3 letters |
| Proof | What the document is (Barangay Certificate of Residency, Barangay ID, Certificate of Indigency, or Other government document with your address — `DOCUMENT_TYPES` in `app/register-resident.jsx:32-37`) + one photo (camera or gallery) | a document type and a photo |
| Review | Everything above | a tick box confirming the details |

**Submit** (`handleSubmit` in `app/register-resident.jsx:146-196`):

1. Shrinks the photo on the phone and uploads it to Cloudinary
   (`uploadPhoto` in `lib/uploadPhoto.js`, called at
   `app/register-resident.jsx:155`).
2. Saves **two documents together** (a "batch": both are saved, or neither)
   (`handleSubmit` in `app/register-resident.jsx:168-186`):
   - `residentVerifications/{uid}` with the details, document type, photo
     link and `status: "Pending"`
   - `users/{uid}` with the details, `role: "Resident"` and
     `accountStatus: "Pending"`
3. Shows "Submitted" with a button to the home screen.

The Admin of the same barangay then approves (`Active`) or rejects the
resident with a reason (section 5.4).

### 2.3 (merged into 2.2)

Choose Role is now part of sign-up (section 2.2 c). The old "Verify Email is
not enforced" screen is gone.

### 2.4 Log In — `app/login.jsx`

- **Fills in:** Email and Password.
- **Taps "Log In"** (`handleLogin` in `app/login.jsx:30-63`):
  1. Checks both fields are filled in.
  2. Signs in with Firebase Authentication.
  3. Reads the user's profile from `users/{uid}`.
  4. **No profile yet** (they stopped halfway through sign-up) → continues
     where they left off: Choose Role if the email is verified, otherwise
     Verify Email (`handleLogin` in `app/login.jsx:44-48`).
  5. Otherwise uses `getPostAuthenticationRoute` (`lib/roles.js:46-62`) to
     decide where to go. For a resident (Active, Pending or Rejected) this is
     `/resident-home`.
  6. If there is no allowed place to go (Deactivated, or an unknown role),
     it logs the user out and shows an error.
- **Taps "Forgot Password?"** (`handlePasswordReset` in `app/login.jsx`):
  sends a password reset email. It shows the same success message even for an
  unknown email, so nobody can use this button to find out which emails have
  accounts.
- **Google users** log in with "Continue with Google" on the landing page
  (section 2.1).

**Staying logged in** (`createAuth` in `firebase.jsx:29-42`):

- **Phone app:** Firebase saves the login in AsyncStorage (a small storage
  box on the phone that keeps data after the app is closed) (`createAuth` in
  `firebase.jsx:35`). So a resident who closes and reopens the app is still
  logged in, and section 2.1 sends them straight to their home screen.
- **Website:** it uses the normal browser login.
- **Being remembered does not skip the account checks.** Every time the app
  opens, the profile is read again from Firestore (`MobileStart` in
  `app/index.jsx:22-30`, `useCurrentUserProfile` in `lib/session.js:91`). A
  Deactivated resident is not let in (section 4.1).

### 2.5 Resident Home — `app/resident-home.jsx`

Before this screen appears, a "gatekeeper" component checks the user
(`AuthRouteGate` in `components/AuthRouteGate.jsx`, see section 4.1).

**Permission pop-ups (phone app only)** (`AuthRouteGate` in
`components/AuthRouteGate.jsx:48-57`, `askResidentPermissionsOnce` in
`lib/permissions.js:15`):

Once a Resident is let through to their home screen, the app asks for these
permissions, one after another:

1. **Notifications** (`askResidentPermissionsOnce` in
   `lib/permissions.js:21-37`)
2. **Location**, only if it was never asked before
   (`askResidentPermissionsOnce` in `lib/permissions.js:39-46`)
3. **Phone calls** (Android only), used by the Call buttons
   (`askResidentPermissionsOnce` in `lib/permissions.js:49-61`)

- Each pop-up is shown **only once per install**. Saved flags remember that
  the app already asked (`lib/permissions.js:6-7`).
- It runs at most once each time the app is opened (`askedThisAppRun` in
  `lib/permissions.js:10`).
- Tapping "Don't allow" never blocks the resident. The app just moves on.
- Other roles and the website are not asked.

**What the resident sees** (`ResidentHome` in `app/resident-home.jsx:524-612`):

- **A full-screen map** of Toledo City (`LeafletMap` in
  `app/resident-home.jsx:533-541`, `components/LeafletMap.jsx`). Free
  OpenStreetMap pictures, no API key. The zoom buttons and the OpenStreetMap
  credit sit bottom-right, lifted above the sheet (`SHEET_OVERLAP` in
  `app/resident-home.jsx:37`).
  - **Your location:** if the resident **already allowed** location and GPS
    is on, the map centers on them with a pin labelled "You are here". The
    home screen **never asks** for permission by itself
    (`useHomeLocation` in `features/resident/hooks/useHomeLocation.js:17`,
    `check` at `25-69`). It checks again when the resident comes back to the
    app (`useHomeLocation.js:72-79`). The position is **not saved** anywhere.
  - **Location messages** (a small card under ☰, `LocationNote` in
    `app/resident-home.jsx:1024`):

    | Situation | Card says | Button |
    |---|---|---|
    | Permission not allowed | "Location is off. You can still pin your pickup or type a landmark." (+ "In Settings, choose Permissions → Location → Allow." if Android won't ask again) | **Allow location**: shows the permission pop-up if Android can still ask, otherwise opens SakayNa's page in the phone's Settings (`allowLocation` in `useHomeLocation.js:82-95`) |
    | GPS switched off | "Turn on Location (GPS) to see where you are on the map." | **Try again** |
    | GPS too slow (15 s) or other error | "We couldn't find your location right now." | **Try again** |
    | Allowed and found, never answered yet, or website | nothing | — |

- **A round ☰ button** at the top left (`ResidentHome` in
  `app/resident-home.jsx:585-593`) → the side menu (section 2.5 d).
- **Account status banner** floating on the map for any resident who is
  not Active, same light colors in Light and Dark mode (`ResidentHome` in
  `app/resident-home.jsx`, the `notActive` banner):
  - Pending (yellow): "Pending Verification — An admin from your barangay is
    checking your proof of residency…"
  - Rejected (red): "Rejected — Your proof of residency was not accepted…"
  - Any other status, "on hold" (red, title = the status, e.g. "Suspended"):
    "Your account is on hold, so you cannot send emergency alerts or
    transport requests. Please contact the office (☰ → Help / Contact
    office)."
- **A fixed bottom sheet** that cannot be dragged away
  (`ResidentHome` in `app/resident-home.jsx:545-581`). It scrolls inside if
  it does not fit (for example with very large text). It holds:
  1. A big red **Emergency** button, "Send an alert to the dispatchers"
     (`ResidentHome` in `app/resident-home.jsx:547-561`)
  2. A green **Request a Ride** button (`app/resident-home.jsx:563-571`)
  3. The **latest request card** (section 2.5 c)

**Residents who are not Active** (`notActive` in `app/resident-home.jsx`,
the same check as `isActiveResident` in `firestore.rules`) who tap Emergency
or Request a Ride get a pop-up instead (`handleQuickAction` and the
not-verified pop-up in `app/resident-home.jsx`):

- Emergency: "Your account is still being verified." (or "was not
  verified." / "is on hold.") "For emergencies, call 911." + **Call 911**
  (opens the dialer with 911 typed in; the person still presses call) +
  **Close**.
- Request a Ride: a similar message + **OK**. On hold: "Your account is on
  hold, so you cannot send transport requests. Please contact the office
  (☰ → Help / Contact office)."
- While the profile is still loading, nothing is blocked (the status is not
  known yet).

#### a) Emergency — `handleQuickAction("emergency-call")` in `app/resident-home.jsx:226`

1. A confirm pop-up appears: "Send emergency alert?" — "Dispatchers will see
   your name and phone number. We will try to send your location." with
   **Cancel** and **Send alert** (`ResidentHome` in
   `app/resident-home.jsx:670-695`). This stops pocket-taps.
2. On **Send alert**, `sendEmergencyAlert` runs (`sendEmergencyAlert` in
   `app/resident-home.jsx:327-355`):
   - It creates a new ID for the alert and opens the alert pop-up.
   - `writeAlert` saves a document in `callSessions/{id}` with the resident's
     name, phone, barangay (as `pickupLocation`), `targetRole: "Dispatcher"`,
     `status: "ringing"` and `lastActiveAt` (the "I'm still here" time)
     (`writeAlert` in `app/resident-home.jsx:281-325`).
   - At the same time, `attachAlertLocation` tries to get the GPS location and
     adds it to the same alert afterwards (`attachAlertLocation` in
     `app/resident-home.jsx:247`). This way, slow GPS never delays the
     alert. (This uses `detectLocation`, which **may ask** for location
     permission, because the resident just asked for help.)
3. **The screen watches the alert live** (a Firestore "listener", which is
   like asking Firestore "tell me every time this alert changes")
   (alert watcher `useEffect` in `ResidentHome`,
   `app/resident-home.jsx:96-127`). The watcher starts **before** the alert
   is saved; the Firestore rules allow this (`match /callSessions` in
   `firestore.rules:117-124`).
4. **"I'm still here" signal (heartbeat)** (heartbeat `useEffect` in
   `ResidentHome`, `app/resident-home.jsx:142-158`):
   - While the alert is saved and still ringing, the app updates
     `lastActiveAt` every **20 seconds** (`ALERT_HEARTBEAT_MS` in
     `app/resident-home.jsx:32`).
   - It stops when a dispatcher accepts, when the resident cancels, or when
     the app is closed.
   - Dispatchers use this signal: an alert that has been quiet for **2
     minutes** is hidden from them (section 5.3).
5. **Screen stays awake** (keep-awake `useEffect` in `ResidentHome`,
   `app/resident-home.jsx:160-178`) while the alert pop-up is open and
   ringing (package `expo-keep-awake`). If this is not available on the phone,
   the error is caught and the alert still works.
6. The alert pop-up changes depending on what is happening (`ResidentHome`
   in `app/resident-home.jsx:697-832`):

   | What is happening | What the resident sees |
   |---|---|
   | Still sending | "Sending alert…", "Sending to dispatchers." with a spinner |
   | Not confirmed within 10 seconds (for example, offline) (`SEND_TIMEOUT_MS` in `app/resident-home.jsx:29`) | "Alert not confirmed" + **Try again** (+ **Call the office** if an office number exists) |
   | Saved, waiting | "Emergency alert sent", "Waiting for a dispatcher to accept." with a spinner |
   | Nobody accepted after 30 seconds (`NO_ANSWER_TIMEOUT_MS` in `app/resident-home.jsx:26`) | "No dispatcher has accepted yet" + **Call the office** (if a number exists) |
   | A dispatcher accepted | "Dispatcher accepted". If the dispatcher has a phone number (phone app only): **"Calling {dispatcher name} in 3…"** (2…, 1…) with **Cancel call**, then the phone calls them (see item 12). After that: **Call {dispatcher name} again**. After Cancel call: **Call {dispatcher name}**. No number: no countdown, no Call button |
   | Sending, waiting, or nobody accepted yet | A bold line: **"Keep this screen open until a dispatcher accepts."** |
   | Location line | "Location: sending…", "Location: sent", or "Location: not available — dispatchers will see your barangay." |

7. **Try again** (`retryEmergencyAlert` in `app/resident-home.jsx:357-361`)
   re-sends using the **same ID**, so you can never end up with two alerts.
8. **Cancel alert / Back button** while the alert is still live asks "Cancel
   your emergency alert?" with **Keep alert** / **Cancel alert**
   (`handleAlertBack` in `app/resident-home.jsx:389-401`).
9. Closing (`closeEmergencyAlert` in `app/resident-home.jsx:363-381`) sets
   the alert's status to `"cancelled"` (if still ringing) or `"ended"` (if a
   dispatcher had accepted).
10. The office phone number is read from `systemSettings/operational` →
    `publicOfficePhone` right after login (`loadOfficePhone` in
    `app/resident-home.jsx:180-189`, called from a `useEffect` at `191-195`).
11. **Call buttons** (`openPhone` in `app/resident-home.jsx:403-405`) all go
    through `startPhoneCall` (`startPhoneCall` in `lib/phoneCall.js:6-26`):
    - On Android, if the resident allowed phone calls, the **call starts
      right away**.
    - Otherwise (website, permission not given, or any error), the phone's
      **dialer opens** with the number already filled in.
12. **Auto call after a dispatcher answers** (added 2026-10-04,
    `emergency-auto-call-plan.md`; "Auto call, part 1" and "part 2"
    `useEffect`s in `app/resident-home.jsx:205-246`, the countdown block at
    `app/resident-home.jsx:940`):
    - **This deliberately changes the earlier rule "nothing calls unless the
      user taps a Call button".** The countdown is the one exception
      (written in the comment in `lib/phoneCall.js:3-6`).
    - When the alert turns "connected" and the dispatcher has a phone
      number, a 3-second countdown starts (`AUTO_CALL_SECONDS` in
      `app/resident-home.jsx:36`): "Calling {name} in 3…" + **Cancel
      call**. At 0 it calls through `startPhoneCall`, like the Call buttons.
    - Only once per alert, only on the phone app, only while SakayNa is on
      screen, and not while "Cancel your emergency alert?" is open.
      Leaving the app during the countdown cancels it. **Done** or Back
      during the countdown closes the pop-up with no call.
    - After the call ends, Android brings the resident back to the same
      pop-up: **Call {name} again** and **Done**.

#### b) Request a Ride — `ResidentRequestForm` in `features/resident/components/ResidentRequestForm.jsx`

A full-screen form (`ResidentRequestForm` in `ResidentRequestForm.jsx:52`)
with 3 pages: **fill in → review → sent**. It starts fresh every time it
opens (`ResidentRequestForm.jsx:67-77`). At the top: "Emergency? Close this
and tap the red Emergency button." (`FillPage` in `ResidentRequestForm.jsx:281`).

**Page 1 — Fill in** (`FillPage` in `ResidentRequestForm.jsx:274`):

| Field | Type | Notes |
|---|---|---|
| What is the ride for? | choose one | Medical / Health, Community / Personal Trip, Other (+ a short text box for Other) (`PURPOSE_OPTIONS` in `features/resident/utils/requestOptions.js:6`) |
| When do you need the ride? | choose one | As soon as possible (default) or Schedule for later → **Day** and **Time** dropdowns (`SchedulePicker` in `ResidentRequestForm.jsx:504`) |
| Who is riding? | choose one | **Me** (shows the profile name and phone) or **Someone else** → passenger's name + passenger's phone (optional) |
| How many people are riding? | − / + buttons | 1 to 6 (`MAX_PASSENGERS` in `requestOptions.js:4`) |
| Pickup barangay | dropdown you can search | starts with the profile barangay; the resident can change it |
| Exact pickup spot (optional) | 2 buttons | **Use Current Location** (GPS) or **Place Map Pin** |
| Landmark / pickup details | text | required, up to 300 letters (e.g. "blue gate beside the chapel") |
| Where are you going? | text | required, up to 180 letters |
| Does anyone need help? (optional) | tick boxes | Senior citizen, PWD / Wheelchair user, Pregnant, Child, Needs help getting in the vehicle, Other (+ text) (`ASSISTANCE_OPTIONS` in `requestOptions.js:8-15`) |
| Notes for the driver (optional) | text | up to 500 letters |

- **Schedule for later** (`requestOptions.js:33-80`): the time is in
  30-minute steps, **at least 1 hour from now** and **at most 7 days ahead**
  (`SCHEDULE_MIN_MINUTES_AHEAD` and `SCHEDULE_MAX_DAYS_AHEAD` in
  `requestOptions.js:35-36`). Only times that can be booked are listed
  (`getScheduleTimeOptions` in `requestOptions.js:57`,
  `getScheduleDayOptions` in `68`). Changing the day clears a time that no
  longer fits (`setScheduleDay` in `ResidentRequestForm.jsx:92-96`).
- **Use Current Location** (`addCurrentLocation` in
  `ResidentRequestForm.jsx:107-119`) → asks for location permission if
  needed, reads the GPS (gives up after 15 seconds), turns the coordinates
  into an address, and saves the exact spot. **The barangay stays as chosen**
  (old issue #20). See `detectLocation` in
  `features/resident/hooks/useCurrentLocation.js`.
- **Place Map Pin** → opens `MapLocationModal` in
  `features/resident/components/MapLocationModal.jsx:10`. The resident taps
  the map, then taps **Confirm pin** (`confirm` in `MapLocationModal.jsx:27`).
- **Review** → `openReview` (`openReview` in `ResidentRequestForm.jsx:123-131`)
  removes extra spaces, checks the form (section 4.2), and either shows red
  messages or moves on to Page 2.

**Page 2 — Review** (`ReviewPage` in `ResidentRequestForm.jsx:462`): a
summary (Ride for, When, Who is riding, Contact number, People riding,
pickup, landmark, destination, help needed, notes) with **Back** and **Send
request**.

**Page 3 — Send** (`submit` in `ResidentRequestForm.jsx:133-155`):

1. Checks the form again (a scheduled time may have become too soon while
   the form was open).
2. Calls `createResidentRequest` (`createResidentRequest` in
   `features/resident/services/residentRequestService.js:11-61`), which
   saves a new document in `transportRequests` with `status: "Pending"`, a
   reference like `SKN-AB12CD34`, and:
   - `purpose`, `timing` ("asap" or "scheduled"), `scheduledFor`
   - `ridingFor`, `passengerName`, `contactNumber`, `residentPhone`,
     `passengerCount`
   - `barangay`, `pickupLocation`, `pickup` (with the exact spot if any),
     `pickupDetails`, `destination`
   - `assistance`, `assistanceOther`, `additionalNotes`
   - `title` (for example "Medical / Health" or "Other: Groceries"),
     `summary`, `priorityLevel` / `level`
   - `requestType` is always "Community Transport Request" (emergencies use
     the alert instead).
   - "Someone else" with no phone → `contactNumber` is the resident's own
     number (`residentRequestService.js:44`).
3. **Priority** (`getResidentReportedPriority` in `requestOptions.js:28-31`):
   Scheduled → **Planned**. Medical / Health as soon as possible → **Urgent**.
   Everything else → **Non-Urgent**.
4. Shows "Request sent" with the reference and a **Done** button
   (`SentPage` in `ResidentRequestForm.jsx:550`). If sending fails: "Your
   request could not be sent. Check your internet and try again."

#### c) Latest request card — `LatestRequestCard` in `features/resident/components/LatestRequestCard.jsx:16`

- Shows the resident's **newest** request: a status pill ("Pending review",
  "Driver assigned", "In progress", "Completed", "Cancelled"), what the ride
  is for, **When** ("Fri, Oct 2, 9:00 AM" or "As soon as possible"), the
  pickup, and — once assigned — the driver and vehicle.
- It updates **live** (for example when a dispatcher assigns a driver),
  because the requests are watched live (`useResidentRequests` in
  `features/resident/hooks/useResidentRequests.js:10`).
- **Tap it** → Request Details (section 2.6), which also reads the live
  request (`ResidentRequestDetails` in `app/resident-home.jsx:614`).
- No requests: "No rides yet. Your latest request will show here."

#### d) ☰ Side menu — `ResidentSideMenu` in `features/resident/components/ResidentSideMenu.jsx:18`

Slides in from the left (`ResidentSideMenu.jsx:31-36`). Closes by tapping the
dark area, the ✕, or the phone's Back button.

- **Top:** initials, name, and account status with a colored dot (green =
  Active / Verified Resident, yellow = Pending Verification, red = anything
  else, e.g. Rejected or Suspended)
  (`getAccountStatusLabel` in `lib/roles.js:13-29`).
- **Request History** → section 2.6.
- **Profile** → a **read-only** pop-up showing Full Name, Email, Phone,
  Barangay, Address (`ResidentHome` in `app/resident-home.jsx:845-881`).
- **Settings** → section 2.7.
- **Help / Contact office** → a pop-up with the office number
  (`publicOfficePhone`), a **Call the office** button, and a red box "For
  life-threatening emergencies, call 911." If no number is saved, it says so
  and hides the Call button (`ResidentSideMenu.jsx:111-154`).
- **Terms of Service** / **Privacy Policy** → the real pages
  (`app/terms.jsx`, `app/privacy.jsx`). On the phone they have a **← Back**
  button at the top (`PageBackButton` in `components/PageBackButton.jsx:7`);
  on the website they look as before.
- **Log out** (`logOut` in `ResidentSideMenu.jsx:43-51`) → signs out and goes
  to `/login`. On the phone, this also removes the saved login
  (`logoutCurrentUser` in `lib/session.js:65`).

### 2.6 Request History and Request Details

**Request History** (`ResidentRequestHistory` in
`features/resident/components/ResidentRequestHistory.jsx:16`):

- **Sees:** a list of their **50 newest** requests (`useResidentRequests` in
  `features/resident/hooks/useResidentRequests.js:35`). Each item shows the
  reference, a status label, what the ride is for, a bold **"Scheduled: …"**
  line for scheduled rides, pickup, date, and "Cancellation is available" if
  the request can still be cancelled.
- **Can filter** by status (All / Active / Completed / Cancelled / Pending /
  Assigned / In progress) and by **what the ride is for** (All rides /
  Medical / Health / Community / Personal Trip / Other), and **search** by
  reference number. Old requests have no purpose, so they only show under
  "All rides".
- **Taps a request** → Request Details.

**Request Details** (`ResidentRequestDetails` in
`features/resident/components/ResidentRequestDetails.jsx:18`) shows:

- Ride for, **When**, Pickup, Landmark, Going to, Passenger, Contact number,
  People riding, Help needed, Notes, Submitted, Latest update
- an "Assigned responder" section (driver, vehicle, plate number, contact)
- a map with the pickup and destination, if coordinates exist
- a **status timeline** (`RequestStatusTimeline` in
  `features/resident/components/RequestStatusTimeline.jsx`, steps from
  `getRequestTimeline` in `features/resident/utils/requestMapper.js:83-98`):
  Submitted → Dispatcher review → Driver assigned → Driver accepted → En
  route → Arrived → Picked up → Completed (or Cancelled / Rejected)
- a **Cancel request** button, only if the status is Pending or Assigned
  (`canResidentCancel` in `requestMapper.js:70`)

**Cancel a request** — the pop-up now lives **inside Request Details**, so it
works the same from History and from the home card (`requestCancellation` in
`ResidentRequestDetails.jsx:34-43`):

1. A pop-up opens **on top of Details** and asks for a reason (3 to 240
   characters).
2. **Keep request** → back to Details. **Confirm cancellation** calls
   `cancelResidentRequest` (`cancelResidentRequest` in
   `residentRequestService.js:64-94`).
3. The request becomes `status: "Cancelled"` and the app saves the reason,
   `previousStatus`, `cancelledBy` and `cancelledAt`. Details closes. If a
   driver was already assigned, the driver's app frees the driver and the
   vehicle and shows the driver the reason (section 5.2, #1).
4. If the request has already moved past Assigned, the resident sees: "This
   request has already moved beyond the cancellation stage."

### 2.7 Settings — `ResidentHome` in `app/resident-home.jsx:890-961`

- **Can edit:** "Username" (this is really the Full Name), Phone Number, Email
  Address. **Barangay cannot be changed** by the resident (only an Admin can,
  `keepsAdminOnlyFields` in `firestore.rules:67-71`).
- **Dark / Light** switch for the app colors. The app starts in Light.
- **Save Settings** → `saveResidentSettings` (`saveResidentSettings` in
  `app/resident-home.jsx:407-475`):
  1. All three fields must be filled in.
  2. The phone must be a real mobile number (same check as sign-up,
     `normalizePhilippinePhone` in
     `features/resident/utils/requestValidation.js:5`), or it shows "Enter a
     mobile number like 0917 123 4567." It is saved in one standard style,
     for example `+639171234567`.
  3. If the email changed, it updates the login email in Firebase
     Authentication (`updateEmail`).
  4. Updates `users/{uid}` with `fullName`, `phoneNumber`, `phone`, `email`
     (`saveResidentSettings` in `app/resident-home.jsx`).
- **Change Password** → another pop-up (`ResidentHome` in
  `app/resident-home.jsx:963-1020`) → `saveResidentPassword`
  (`saveResidentPassword` in `app/resident-home.jsx:477`):
  1. All three password fields must be filled in.
  2. The new password must be at least 6 characters.
  3. The new password and the confirm password must match.
  4. The app checks the current password again with Firebase (this is called
     re-authenticating), then saves the new password.

---

## 3. Functions

| Function | File | What it does |
|---|---|---|
| `createAuth` | `firebase.jsx:29` | Sets up Firebase login. Phone: saves the login in AsyncStorage. Website: normal browser login. |
| `MobileStart` | `app/index.jsx:21` | Phone app start: sends a remembered, allowed user to their home screen; everyone else sees the mobile landing page. |
| `MobileLanding` | `components/MobileLanding.jsx:48` | The always-light phone landing page with Get Started (sheet), Log In and Terms of Service. |
| `signInWithGoogle` | `components/MobileLanding.jsx:95` | Google sign-in. New Google user → Choose Role; existing user → their home. |
| `openEmailSignup` | `components/MobileLanding.jsx:150` | Logs out a half-finished Google sign-up, then opens Sign Up. |
| `handleNext` | `app/signup.jsx:41` | Creates the login account (email + password, min 6) and sends the verification email. No profile yet. |
| `handleVerified` | `app/verify-email.jsx:52` | Checks the email is verified, refreshes the login token, goes to Choose Role. |
| `handleResend` | `app/verify-email.jsx:79` | Sends another verification email, then waits 60 seconds before allowing another. |
| `chooseRole` | `app/choose-role.jsx:36` | Resident → resident registration; Driver → driver application. |
| `checkPage` | `app/register-resident.jsx:40` | Checks each registration page (details, proof, confirm box). |
| `handleSubmit` (registration) | `app/register-resident.jsx:146` | Uploads the proof photo, then saves `residentVerifications/{uid}` and `users/{uid}` (Pending) together. |
| `uploadPhoto` | `lib/uploadPhoto.js` | Shrinks a photo and uploads it to Cloudinary; returns the link. |
| `handleLogin` | `app/login.jsx:30` | Signs in, reads the profile, and sends the user to the correct screen (or back into an unfinished sign-up). |
| `handlePasswordReset` | `app/login.jsx` | Sends a password reset email. |
| `useCurrentUserProfile` | `lib/session.js:91` | Keeps watching who is logged in and their `users/{uid}` profile, live. |
| `getPostAuthenticationRoute` | `lib/roles.js:46` | Decides which screen a user may go to, based on role and account status. |
| `getAccountStatusLabel` | `lib/roles.js:13` | Friendly status names: Pending Verification, Verified Resident, etc. |
| `isDisabledProfile` | `lib/roles.js:7` | Returns true only when `accountStatus` is `"Deactivated"`. |
| `AuthRouteGate` | `components/AuthRouteGate.jsx:13` | The "gatekeeper" that blocks protected screens unless the user is allowed. Also starts the Resident permission pop-ups. |
| `askResidentPermissionsOnce` | `lib/permissions.js:15` | Asks for notifications, location and phone calls, each only once per install. |
| `logoutCurrentUser` | `lib/session.js:65` | Signs the user out of Firebase. On the phone this also removes the saved login. |
| `handleQuickAction` | `app/resident-home.jsx:226` | Emergency → confirm pop-up; Request a Ride → the form. Pending/Rejected → the "not verified" pop-up instead. |
| `useHomeLocation` | `features/resident/hooks/useHomeLocation.js:17` | Home map location: checks only, never asks by itself; re-checks when the app comes back. |
| `allowLocation` | `features/resident/hooks/useHomeLocation.js:82` | The "Allow location" button: permission pop-up if Android can still ask, else the phone's Settings. |
| `LocationNote` | `app/resident-home.jsx:1024` | The "location off" / "GPS off" / "couldn't find you" card on the map. |
| `LatestRequestCard` | `features/resident/components/LatestRequestCard.jsx:16` | The newest request on the home sheet; tap → Request Details. |
| `ResidentSideMenu` | `features/resident/components/ResidentSideMenu.jsx:18` | The ☰ menu, the Help pop-up, and Log out. |
| `PageBackButton` | `components/PageBackButton.jsx:7` | "← Back" on the Terms and Privacy pages (phone app only). |
| `sendEmergencyAlert` | `app/resident-home.jsx:327` | Starts an emergency alert: opens the pop-up, saves the alert, and looks up the GPS. |
| `writeAlert` | `app/resident-home.jsx:281` | Saves the alert to `callSessions` (including the first `lastActiveAt`), with a 10-second "not confirmed" limit. |
| alert watcher (`useEffect` in `ResidentHome`) | `app/resident-home.jsx:96` | Watches the alert live, so the pop-up knows when it is saved and when a dispatcher accepts. |
| heartbeat (`useEffect` in `ResidentHome`) | `app/resident-home.jsx:142` | While the alert is ringing, updates `lastActiveAt` every 20 seconds ("I'm still here"). |
| keep-awake (`useEffect` in `ResidentHome`) | `app/resident-home.jsx:160` | Keeps the phone screen on while the alert pop-up is open and ringing. |
| `attachAlertLocation` | `app/resident-home.jsx:247` | Adds the GPS location to an alert that was already sent. |
| `retryEmergencyAlert` | `app/resident-home.jsx:357` | Sends the same alert again, using the same ID. |
| `closeEmergencyAlert` | `app/resident-home.jsx:363` | Marks the alert cancelled or ended, then resets the pop-up. |
| `handleAlertBack` | `app/resident-home.jsx:389` | Asks "Cancel your emergency alert?" before closing an alert that is still live. |
| `openPhone` | `app/resident-home.jsx:469` | Used by every Call button on the alert pop-up. Calls `startPhoneCall`. |
| auto call, part 1 (`useEffect` in `ResidentHome`) | `app/resident-home.jsx:205` | When a dispatcher with a phone number answers, starts the 3-second "Calling {name} in 3…" countdown (once per alert). Added 2026-10-04. |
| auto call, part 2 (`useEffect` in `ResidentHome`) | `app/resident-home.jsx:218` | Counts down once a second, then calls `startPhoneCall`. Leaving the app cancels it. |
| `startPhoneCall` | `lib/phoneCall.js:9` | Android with permission: starts the call right away. Otherwise: opens the dialer with the number filled in. Called by the Call buttons and by the auto call countdown (the one exception to "only from a tapped button"). |
| `loadOfficePhone` | `app/resident-home.jsx:180` | Reads the public office phone number from `systemSettings/operational`. |
| `saveResidentSettings` | `app/resident-home.jsx:407` | Saves name, phone and email changes. |
| `saveResidentPassword` | `app/resident-home.jsx:477` | Checks the current password, then saves the new one. |
| `useResidentRequests` | `features/resident/hooks/useResidentRequests.js:10` | Watches the resident's own requests live, newest first, and keeps the top 50. |
| `useCurrentLocation` / `detectLocation` | `features/resident/hooks/useCurrentLocation.js` | Gets the phone's GPS location (asks for permission if needed, gives up after 15 s) and turns it into an address. Used by the form and the emergency alert. |
| `addCurrentLocation` | `features/resident/components/ResidentRequestForm.jsx:107` | "Use Current Location" in the form: saves the exact spot, keeps the chosen barangay. |
| `openReview` / `submit` | `ResidentRequestForm.jsx:123`, `133` | Checks the form → Review page; checks again → saves the request. |
| `createResidentRequest` | `features/resident/services/residentRequestService.js:11` | Saves a new transport request with status "Pending" and a reference number. |
| `cancelResidentRequest` | `features/resident/services/residentRequestService.js:64` | Changes a Pending or Assigned request to "Cancelled" and saves the reason. |
| `requestCancellation` | `features/resident/components/ResidentRequestDetails.jsx:34` | The cancel pop-up's Confirm button (inside Request Details). |
| `sanitizeRequestForm` | `features/resident/utils/requestValidation.js:19` | Removes extra spaces from everything typed. |
| `validateResidentRequest` | `features/resident/utils/requestValidation.js:33` | Checks the request form (including the scheduled time) and returns error messages. |
| `validateCancellationReason` | `features/resident/utils/requestValidation.js:67` | Checks that the cancel reason is 3 to 240 characters. |
| `normalizePhilippinePhone` | `features/resident/utils/requestValidation.js:5` | Turns `09…`, `639…` or `+639…` into `+639…`, or returns empty if the number is not valid. |
| `getResidentReportedPriority` | `features/resident/utils/requestOptions.js:28` | Scheduled → Planned; Medical / Health ASAP → Urgent; everything else → Non-Urgent. |
| `buildScheduledDate` / `isAllowedScheduleTime` | `features/resident/utils/requestOptions.js:44`, `50` | Turns the chosen day + time into one date; checks it is 1 hour to 7 days ahead. |
| `getScheduleDayOptions` / `getScheduleTimeOptions` | `features/resident/utils/requestOptions.js:68`, `57` | The Day and Time dropdown choices (only bookable ones). |
| `getScheduledDate` / `getWhenText` | `features/resident/utils/requestMapper.js:9`, `12` | The scheduled date (or null) and the "When" text shown to every role. |
| `getPassengerName` / `getPassengerCountText` / `getAssistanceText` | `features/resident/utils/requestMapper.js:18`, `22`, `30` | Labels shared by all roles; read the new fields first, then the old form's fields. |
| `normalizeResidentRequest` | `features/resident/utils/requestMapper.js:72` | Fills in default values (status, reference, labels) for a request. |
| `getRequestTimeline` | `features/resident/utils/requestMapper.js:83` | Builds the list of timeline steps and marks which ones are done. |
| `canResidentCancel` | `features/resident/utils/requestMapper.js:70` | True if the status is Pending or Assigned. |
| `getRequestStatusMeta` | `features/resident/utils/requestMapper.js:68` | Gives each status a friendly label, color and icon. |

---

## 4. Rules (what limits a resident)

### 4.1 Login and access checks

- **Which screens need a login:** `resident-home` and the other role home
  screens are "protected" (`protectedRoutes` in
  `components/AuthRouteGate.jsx:11`). If the user is not logged in, they are
  sent to `/login` (`AuthRouteGate` in `AuthRouteGate.jsx:27-30`).
- **Signed in but no profile** (stopped halfway through sign-up) → sent to
  Choose Role (email verified) or Verify Email (`AuthRouteGate` in
  `AuthRouteGate.jsx:33-36`).
- **The profile could not be read** → "Account unavailable" with Retry and Log
  Out (`AuthRouteGate` in `AuthRouteGate.jsx:75-77`).
- **The role must be one of Resident / Driver / Dispatcher / Admin**, or the
  user sees "Invalid role" (`AuthRouteGate.jsx:79-81`, `isSupportedRole` in
  `lib/roles.js:5`).
- **Right screen for the role:** if a resident tries to open another role's
  screen, the gatekeeper sends them back to `/resident-home`
  (`AuthRouteGate.jsx:43-45`, `getRoleRoute` in `lib/roles.js:31-44`).
- **Account status** (`isDisabledProfile` in `lib/roles.js:7`,
  `getPostAuthenticationRoute` in `lib/roles.js:46-62`):

  | `accountStatus` | Shown as | What happens to a resident |
  |---|---|---|
  | `Active` (approved by the barangay Admin) | Verified Resident | Allowed in, can use everything (green dot) |
  | `Pending` (new sign-ups) | Pending Verification | Allowed in, yellow banner; **cannot** send emergency alerts or transport requests (app pop-up + Firestore rules) |
  | `Rejected` | Rejected | Same as Pending, with a red banner. Cannot upload a new proof yet (#35) |
  | `Suspended`, `Disabled`, `Approved` or any other non-Active status | the status itself (e.g. Suspended) | **"On hold":** allowed in, red banner "Your account is on hold… contact the office"; **cannot** send (app pop-up + `isActiveResident` in `firestore.rules:32-35`) |
  | `Deactivated` | — | Blocked: login shows an error; a remembered resident who opens the phone app sees the landing page; if already inside, they see "Account disabled" (`AuthRouteGate.jsx:83-85`) |

  The app's "can send" check (`notActive` in `app/resident-home.jsx`) is the
  same as the rules: only `Active` can send.

- The profile is watched **live** (`useCurrentUserProfile` in
  `lib/session.js:91`, listener at `116`), so when the Admin approves a
  resident, the banner disappears and the buttons work right away.
- **Email verification is required** before a profile can be created
  (`selfCreateProfileIsSafe` in `firestore.rules:56-63`).

### 4.2 Form checks (validation)

**Sign Up** (`handleNext` in `app/signup.jsx:41-75`): email filled in,
password at least 6 characters, passwords match.

**Resident Registration** (`checkPage` in `app/register-resident.jsx:40-56`):
name at least 2 letters, a real PH mobile number, a barangay, address at
least 3 letters, a document type, a photo, and the confirm box.

**Transport request** (`validateResidentRequest` in
`features/resident/utils/requestValidation.js:33-65`):

- what the ride is for must be chosen; "Other" needs a short text (up to 100)
- scheduled: a day and a time must be chosen, and the time must still be 1
  hour to 7 days ahead (checked again when sending)
- "Me": the profile must have a valid phone number ("Your profile has no
  phone number. Add it in Settings first.")
- "Someone else": a passenger name (2–80); the phone is optional, but if
  typed it must be a real PH mobile number
- 1 to 6 people
- a pickup barangay
- landmark / pickup details: 1–300 characters (required)
- destination: 1–180 characters (required)
- help "Other" needs a short text (up to 100)
- notes: 500 characters or fewer

**Cancel reason:** 3–240 characters (`validateCancellationReason` in
`requestValidation.js:67-71`, and checked again in `cancelResidentRequest`
in `residentRequestService.js:65-68`).

**Settings:** name, phone and email must not be empty
(`saveResidentSettings` in `app/resident-home.jsx:407`). **Password:** at
least 6 characters and must match the confirm field (`saveResidentPassword`
in `app/resident-home.jsx:477`).

### 4.3 Status changes a resident can cause

| Where | From → To | Where in the code |
|---|---|---|
| Profile (`users`) | (new) → `Pending` | `handleSubmit` in `app/register-resident.jsx:177-184` |
| Proof (`residentVerifications`) | (new) → `Pending` | `handleSubmit` in `app/register-resident.jsx:169-176` |
| Transport request | (new) → `Pending` | `createResidentRequest` in `residentRequestService.js:33` |
| Transport request | `Pending` or `Assigned` → `Cancelled` | `cancelResidentRequest` in `residentRequestService.js:79-90` |
| Emergency alert (`callSessions`) | (new) → `ringing` | `writeAlert` in `app/resident-home.jsx:300` |
| Emergency alert | `ringing` → `ringing` with a new `lastActiveAt` every 20 s (status does not change) | heartbeat `useEffect` in `app/resident-home.jsx:142-158` |
| Emergency alert | `ringing` → `cancelled` | `closeEmergencyAlert` in `app/resident-home.jsx:363-381` |
| Emergency alert | `connected` → `ended` | `closeEmergencyAlert` in `app/resident-home.jsx:363-381` |

Only the barangay Admin can move a resident from Pending to Active or
Rejected (section 5.4).

### 4.4 Firestore rules for a resident — `firestore.rules`

"Read" means see the data. "Write" means create, change or delete it.

| Collection | Resident can… | Rule line |
|---|---|---|
| `users/{uid}` | **read** only their own profile | `match /users` in `firestore.rules:75` |
| `users/{uid}` | **create** their own profile only as `role: "Resident"` + `accountStatus: "Pending"` with a **verified email** (or as a Pending Driver) | `selfCreateProfileIsSafe` in `firestore.rules:56-63`, `match /users` in `76` |
| `users/{uid}` | **update** their own profile, but can **never change** `role`, `accountStatus`, `approvalStatus`, the review fields, or **`barangay`** | `keepsAdminOnlyFields` in `firestore.rules:67-71`, `match /users` in `77-79` |
| `users/{uid}` | **delete**: nobody can | `firestore.rules:80` |
| `residentVerifications/{uid}` | **create** only their own (document id = their uid), only as `status: "Pending"`; **read** only their own. Only the Admin of their barangay may read it too, and only that Admin may change it (to Active or Rejected) | `match /residentVerifications` in `firestore.rules:149-159` |
| `transportRequests` | **read** only requests where `residentId` is their own uid | `match /transportRequests` in `firestore.rules:85-87` |
| `transportRequests` | **create** only if they are an **Active** Resident and `residentId` is their own uid | `isActiveResident` in `firestore.rules:32-35`, `match /transportRequests` in `88` |
| `transportRequests` | **update** any request where `residentId` is their own uid (any field, see #3) | `firestore.rules:89-91` |
| `transportRequests` | **delete**: Admin only | `firestore.rules:92` |
| `callSessions` | **read** their own alerts, **and** an alert ID that does not exist yet (so the app can start watching a new alert before it is saved) | `match /callSessions` in `firestore.rules:120` |
| `callSessions` | **create** only if they are an **Active** Resident and it is their own; **update** their own (any field, see #3); **delete**: staff only | `firestore.rules:121-123` |
| `Driver_Applications` | **create** one only with their own uid as the id and `status: "Pending"`, and **read** their own. (Any logged-in user can, not only drivers.) The resident screens never do this. | `match /Driver_Applications` in `firestore.rules:128-144` |
| `systemSettings/operational` | **read** only (for the office phone) | `firestore.rules:178-181` |
| `driverAssignments`, `vehicles`, `driverSchedules`, `vehicleChecklists`, `activityLogs`, other `systemSettings` | **no access** | `firestore.rules:96-115`, `162-184` |
| everything else | **no access** | `match /{document=**}` in `firestore.rules:188-190` |

Helper functions used above: `signedIn`, `isStaff`, `isAdmin`,
`isActiveResident`, `isAdminOf` (`firestore.rules:10-47`).

### 4.5 Bans and suspensions

- Only an **Admin** can change a resident's account status, using
  `changeAccountStatus` (`changeAccountStatus` in
  `features/admin/services/adminOperationsService.js:162`) in the Admin
  Operations panel. The Admin must type a reason.
- **"Deactivated" is the only status that fully locks a resident out**
  (`isDisabledProfile` in `lib/roles.js:7`). Any status other than Active
  stops them from sending (`isActiveResident` in `firestore.rules:32-35`).
- Deactivating **does not disable the Firebase login account itself**. It
  only changes the Firestore profile. This still works with the remembered
  login, because the app reads the profile again every time it opens
  (section 4.1).
- **Permanent deletion is not available yet**. The button is disabled.

---

## 5. Connections to other roles

### 5.1 Resident sends a transport request → Dispatcher

- The Dispatcher screen listens to every request where `status == "Pending"`
  (`DispatcherHome` in `app/dispatcher-home.jsx:304`), so the new request
  appears in their queue right away.
- **Queue order** (`queueOrder` in `app/dispatcher-home.jsx:65-69`, sort at
  `333`): as-soon-as-possible rides first (longest waiting on top), then
  scheduled rides (soonest first).
- **Queue card:** priority, "ASAP" or **"Scheduled: Fri, Oct 2, 9:00 AM"**,
  in red **"Scheduled time passed"** if nobody assigned it in time
  (`WhenLabel` in `app/dispatcher-home.jsx:56-63`), what the ride is for,
  people, barangay, and a "Needs help" line.
- **Selected Request box** (`SelectedRequestDetails` in
  `app/dispatcher-home.jsx:71`): passenger, a big phone number to call
  (the passenger's, or the resident's), a "booked by" line, pickup, landmark,
  destination, help needed, notes. The map uses the resident's exact pin.
- **Assigning:** the Dispatcher picks a driver and a vehicle, then taps
  Assign. If the ride is scheduled more than 2 hours away, the window warns:
  "…Assign it closer to the time." (`isScheduledFarAhead` in
  `app/dispatcher-home.jsx:50`, warning at `795`).
  `assignDispatcherRequest` (`features/dispatcher/services/dispatcherAssignmentService.js:7`)
  does 3 things together:
  - creates a `driverAssignments` document (with the ride title)
  - sets the request to `status: "Assigned"` and fills in
    `assignedDriverId/Name`, `assignedVehicleName`, `vehiclePlateNumber`,
    `assignedAt`
  - marks the vehicle as `"Assigned"`
- The resident sees this live: the latest request card and Request Details
  show "Driver assigned" with the driver and vehicle.
- Once a request is no longer Pending, it **drops out of the dispatcher's
  queue**.

### 5.2 Driver works on the request → Resident sees progress

- The Driver sees the assignment and watches the linked request live
  (`DriverHome` in `app/driver-home.jsx`).
- **What the driver sees about the passenger** ("Current Ride" card,
  `DriverHome` in `app/driver-home.jsx:700-735`, and "Review details"):
  **When** (`app/driver-home.jsx:713`), the passenger's name, a tap-to-call
  phone (`contactNumber`), people riding, help needed, notes, pickup +
  landmark, destination, and the vehicle. The driver's map uses the
  resident's exact pin (`getPickupCoordinates` in
  `features/driver/utils/driverMissionMapper.js:15`).
- Each driver step runs `transitionMission` (`transitionMission` in
  `features/driver/services/driverMissionService.js:35-100`). It updates
  **both** the assignment and the resident's request:
  - **Accepted / En Route / Arrived / Picked Up** → request `status: "In
    Progress"` plus `missionStatus` and a timestamp (`acceptedAt`,
    `enRouteAt`, `arrivedAt`, `pickedUpAt`)
  - **Completed** → request `status: "Completed"`, `completedAt`
  - **Declined** (older APKs only) → request goes back to `status: "Pending"`,
    the driver fields are cleared, and `lastDeclinedDriverId` is set.
  - **Unable** ("I can't do this ride", driver-pages-plan.md) → the same, but it
    sets `lastUnableDriverId` / `lastUnableReason` and also clears the old step
    times. The resident sees "Finding another driver" in both cases.
  - If the resident already **cancelled** the ride, none of these steps is
    saved; the driver sees "The resident cancelled this ride."
- **The resident cancels while the ride is still Assigned:** the driver's
  app frees the driver and the vehicle by itself (`clearCancelledRide` in
  `features/driver/services/driverMissionService.js`) and shows a red note
  with the ride and the reason. See #1 for the one limit.
- The resident's timeline reads these timestamps (`getRequestTimeline` in
  `features/resident/utils/requestMapper.js:83-98`).

### 5.3 Resident sends an emergency alert → Dispatcher

- The Dispatcher screen listens for `callSessions` where
  `targetRole == "Dispatcher"` and `status == "ringing"` (alert listener in
  `DispatcherHome`, `app/dispatcher-home.jsx:447`). An "Incoming Emergency
  Call" pop-up appears with the resident's name
  (`DispatcherHome` in `app/dispatcher-home.jsx:819-823`).
- **Quiet alerts are hidden** (`STUCK_ALERT_MS` and
  `STUCK_CHECK_INTERVAL_MS` in `app/dispatcher-home.jsx:25-26`, filter at
  `478-488`):
  - For each ringing alert, the dispatcher's screen remembers the last
    `lastActiveAt` it saw, and **when this dispatcher's own device** saw it
    change (`lastSignOfLifeRef` in `app/dispatcher-home.jsx:164`).
  - If it has not changed for **2 minutes**, the alert is treated as stuck
    (for example, the resident's app crashed or was closed) and the pop-up
    does not show it. A clock re-checks this every 10 seconds.
  - This only **hides** the alert on the dispatcher's screen. Nothing is
    changed in Firestore, so the alert is still `"ringing"` there. If the
    signal starts again, the alert shows again.
- **Answer** → sets `status: "connected"`, `dispatcherId`, `dispatcherName`,
  and `dispatcherPhone` (from the dispatcher's `officePhone` or
  `operationalPhone`) (`answerIncomingCall` in
  `app/dispatcher-home.jsx:541-558`). The resident sees "Dispatcher accepted"
  and a Call button. The heartbeat and keep-awake then stop.
- **Decline** → adds the dispatcher's uid to `declinedBy`. The alert keeps
  ringing for the **other** dispatchers (`declineIncomingCall` in
  `app/dispatcher-home.jsx:560-574`).
- When the resident cancels, the status becomes `cancelled`. This no longer
  matches the dispatcher's "ringing" filter, so the pop-up disappears.

### 5.4 Admin

- **Approves new residents** in **Resident Verification** (only residents of
  the Admin's own barangay, `app/admin-home.jsx:329-345`): sees the details
  and the proof photo, then **Approve** (resident becomes `Active`) or
  **Reject** with a reason (`reviewResidentVerification` in
  `features/admin/services/adminOperationsService.js:118`). Both the
  `residentVerifications` document and the profile change together.
- **Sees resident requests:** the Admin dashboard reads the 200 newest
  `transportRequests` (`COLLECTION_LIMIT` in
  `features/admin/hooks/useAdminDashboardData.js:7`) and shows 3 overview
  cards counted on the server by what the ride is for (Medical / Health,
  Community / Personal Trip, Other) (`useAdminDashboardData.js:171-173`).
  The request cards and details show "Ride for" and **"When"**
  (`AdminRequestsSection.jsx:88-89`, `app/admin-home.jsx:928-929`), with a
  "Ride for" filter.
- **Sees resident alerts:** the Admin "Emergency Calls" section lists alerts.
  Alerts ringing for more than 30 seconds are marked as unanswered
  (`STALE_RINGING_THRESHOLD_MS` in
  `features/admin/hooks/useAdminCallSessions.js:8`, `52`). The Admin list
  does **not** use the `lastActiveAt` signal.
- **Edits resident profiles:** phone, barangay, address (Users → Edit in
  `app/admin-home.jsx`).
- **Changes status or role:** `changeAccountStatus` and `changeUserRole`
  (`adminOperationsService.js:162`, `201`). See section 4.5.
- **Sets the office phone** the resident sees on the alert screen and in ☰ →
  Help: `saveSystemSettings` → `systemSettings/operational.publicOfficePhone`
  (`saveSystemSettings` in `adminOperationsService.js:266`).
- **Becoming a driver:** a resident cannot turn their account into a driver
  account from the app. Choose Role happens once, at sign-up.

---

## 6. Unclear or possibly wrong

This list keeps the same numbers as earlier reviews. Each item now says
**Fixed**, **Partly fixed** or **Still open** (checked 2026-09-30). New items
start at #35. Short, repo-wide known problems are also in `Known-Issue.md`.

### Bigger problems

1. **Fixed (one limit left) — Cancelling an "Assigned" request now tells
   the driver** (fixed 2026-09-30). `cancelResidentRequest` still only
   changes the request (the resident may not change assignments or
   vehicles). The driver's side now handles it:
   - `transitionMission` reads the ride first and refuses to save if it is
     "Cancelled" ("The resident cancelled this ride."), so Accept or
     Decline can no longer turn it back into In Progress or Pending
     (`transitionMission` in `features/driver/services/driverMissionService.js`).
   - The driver's app sees the cancel live and runs `clearCancelledRide`
     (same file): the assignment becomes "Cancelled" and the vehicle goes
     back to "Available", in one transaction that only acts if the ride
     really is cancelled. The driver sees a red note with the ride and the
     resident's reason (`cancelledNotice` in `app/driver-home.jsx`).
   - **Limit:** this only happens while the driver's app is open, or the
     next time it opens. Until then the dispatcher still sees that driver
     and vehicle as busy. A dispatcher "Free driver" button is an optional
     follow-up (Known-Issue.md).
2. **Fixed — Suspended and Disabled residents get a clear message**
   (fixed 2026-10-01). They can still log in and look around
   (`isDisabledProfile` only blocks `"Deactivated"`, `lib/roles.js:7`), and
   the rules still stop them from sending (`isActiveResident` in
   `firestore.rules:32-35`). The app now uses the same check: any resident
   who is not Active cannot send (`notActive` in `app/resident-home.jsx`).
   Pending and Rejected look the same as before. Any other status is "on
   hold": a red banner titled with the status, and the Emergency / Request
   a Ride pop-ups say the account is on hold and to contact the office
   (Emergency still offers **Call 911**). The side menu dot is red. They no
   longer see "Alert not confirmed" or "Check your internet".
3. **Partly fixed — The Firestore rules let a resident change any field of
   their own request, and of their own emergency alert.** **New:** only an
   Active resident can **create** one (`firestore.rules:88`, `121`). Still
   open: `update` only checks that `residentId` is theirs
   (`firestore.rules:89-91`, `122`). Someone using the database directly (not
   through the app) could set their own request to "Completed", un-cancel it,
   or fill in a fake driver, or set their own alert to `"connected"`. The
   `create` rule also does not check `status == "Pending"`. The app itself
   never does this.
4. **Partly fixed — The rules check `accountStatus` only when creating.**
   Creating a request or alert needs an Active resident
   (`isActiveResident`). Updating does not, so a Deactivated resident's
   existing requests and alerts could still be changed by them through the
   database directly.
5. **Fixed — A Pending or Rejected resident no longer gets stuck.** They are
   now allowed into `/resident-home` with a banner
   (`getPostAuthenticationRoute` in `lib/roles.js:51-55`).

### Emergency alert

6. **Fixed (2026-10-03) — The Dispatcher sees the resident's phone number and
   location.** The dispatcher's "Incoming Emergency Call" pop-up shows the
   resident's phone (big, tap to call), their barangay or GPS address, and an
   "Open location in Maps" button once the location arrives
   (`EmergencyCallerDetails` in `app/dispatcher-home.jsx`). After Answer, an
   "Active emergency" card at the top of the dispatcher screen keeps showing
   the same details until the resident taps Done or the dispatcher taps "End
   emergency". So the resident's confirm pop-up ("Dispatchers will see your
   name and phone number") is now true. The accepted state only says "can see
   where you are" once the location was really sent.
7. **Still open — The "Dispatcher could not accept" state can never happen.**
   The resident screen checks for `callStatus === "declined"`
   (`app/resident-home.jsx:729`), but the dispatcher's Decline never sets that
   status. It only adds to `declinedBy` (`declineIncomingCall` in
   `app/dispatcher-home.jsx:560-574`).
8. **Partly fixed — Old alerts no longer pop up for dispatchers, but they
   still stay "ringing" forever.** After 2 minutes without the heartbeat,
   dispatchers stop seeing the pop-up (section 5.3). But nothing changes the
   alert's `status` in Firestore, and the Admin call list still shows it as
   unanswered forever, because it does not look at `lastActiveAt`
   (`useAdminCallSessions.js:52`). See also #33 and #34.
9. **Still open — `latestRequestId` is saved on each alert**
   (`writeAlert` in `app/resident-home.jsx:297`), but nothing reads it. The
   Admin alert list shows "Type:" using `emergencyType/serviceType`
   (`AdminCallSessionsSection.jsx:63`), which the resident never saves, so it
   always says "Not specified".
10. **Still open — "Location: sending…" may take longer than 15 seconds.**
    Only the GPS reading has a 15-second limit. Turning the coordinates into
    an address (`reverseGeocodeAsync` in `useCurrentLocation.js`) has no time
    limit. The alert itself is not delayed, only the location line.

33. **Still open — The "I'm still here" signal probably stops when the
    resident leaves the app, so dispatchers may stop seeing a real alert.**
    The heartbeat uses a normal timer (`setInterval` in
    `app/resident-home.jsx:142-158`). On phones, these timers usually pause
    when the app is in the background (power button, another app, or **"Call
    the office"**). After 2 minutes away, every dispatcher's pop-up hides the
    alert, while the resident's screen still says "No dispatcher has accepted
    yet". Needs a phone test: send an alert, tap "Call the office", stay on
    the call for 3 minutes, and watch the dispatcher screen.
34. **Still open — Stuck alerts pop up again for 2 minutes every time a
    dispatcher opens or reloads the dispatcher screen.** The dispatcher's
    memory (`lastSignOfLifeRef` in `app/dispatcher-home.jsx:164`) starts
    empty each time, so every alert still stuck at `"ringing"` counts as
    "just seen". Only one alert pop-up shows at a time, so an old stuck alert
    could sit in front of a real new alert for up to 2 minutes.

### Transport request

11. **Still open — No timeout when sending a request offline.** The emergency
    alert has a 10-second limit, but `createResidentRequest` does not.
    Offline, "Sending..." may keep spinning for a long time (`submit` in
    `ResidentRequestForm.jsx:133-155`).
12. **Fixed — Destination can no longer get stuck.** Destination is now a
    plain text box; the old destination modes were removed (resident overhaul
    Step 2).
13. **Fixed — The driver's map uses the resident's pinned location**
    (`getPickupCoordinates` in `app/driver-home.jsx:391`; resident overhaul
    Step 1). The dispatcher's map does too.
14. **Fixed — The driver sees the passenger's name, phone, people, help
    needed and notes** (Passenger card in `app/driver-home.jsx:718-735`;
    resident overhaul Step 1). "Patient" is now "Passenger", and the name is
    the passenger's, not the account owner's.
15. **Still open — Some Request Details fields are never filled in:**
    `assignedDriverPhone`, `driverContactNumber`, `dispatcherName`,
    `dispatcherOfficePhone` (`ResidentRequestDetails.jsx`). No code writes
    these to the request (the dispatcher's name is only saved on the
    assignment, `dispatcherAssignmentService.js:41`). So the resident always
    sees "Contact is not available yet" and no dispatcher.
16. **Still open — A "Rejected" request status is displayed but never set.**
    The timeline and labels handle it (`statusMeta` in `requestMapper.js:40`,
    `getRequestTimeline` in `96`), but no code sets a request to "Rejected".
17. **Partly fixed — The timeline can be wrong after a driver declines.**
    "I can't do this ride" (which replaced Decline) clears the old step
    times, so it is fixed there. Still open for a Decline from an older APK. A
    decline sets the request back to Pending, but it does not clear
    `assignedAt` or `acceptedAt` (`transitionMission` in
    `driverMissionService.js:71-86`). So "Driver assigned" may still show a
    check mark (`getRequestTimeline` in `requestMapper.js:89`).
18. **Fixed — `submittingRef`** is gone (the form was rewritten in resident
    overhaul Step 2). Double taps are blocked by `saving` (`submit` in
    `ResidentRequestForm.jsx:134`).
19. **Still open — A brand-new request may briefly show at the bottom of the
    list.** `createdAt` is a server time, and it is empty until the server
    confirms it, so the sort puts the request last (`toMillis` in
    `useResidentRequests.js:8`, sort at `34`). This could make the latest
    request card show an older request for a moment.
20. **Fixed — "Use Current Location" no longer changes the barangay.** Only
    the exact spot is saved; the barangay stays as chosen
    (`addCurrentLocation` in `ResidentRequestForm.jsx:107-119`).

35. **(new) Still open — A Rejected resident cannot upload a new proof yet.**
    The banner says the proof was not accepted, but there is no "Upload new
    proof" button. This is planned for later (login-overhaul-plan.md step 8).
    Today an Admin must fix it (for example in Users → Edit).
36. **(new) Still open — Scheduled rides have no reminders.** Nobody is
    reminded when a scheduled ride is near (the app has no notifications).
    The dispatcher watches the list; the tag turns red if the time passes
    unassigned (section 5.1). Assigning early keeps the vehicle busy until
    the trip ends. Left out on purpose (resident-overhaul-plan.md).

### Home screen, profile and settings

21. **Fixed — The "View Status" button is gone.** The home screen now shows
    the latest request card, which always shows the newest request
    (resident overhaul Step 6b).
22. **Still open — The "Settings updated successfully." message is never
    seen.** The Settings pop-up closes right after the message is set
    (`saveResidentSettings` in `app/resident-home.jsx:457-458`).
23. **Still open — Changing the email:** `updateEmail` is rejected by newer
    Firebase projects that have "email enumeration protection" switched on.
    Unclear whether this project has it on. Also, if `updateEmail` works but
    the Firestore update fails, the login email and the profile email no
    longer match.
24. **Fixed — Address is asked at sign-up.** Resident Registration asks for
    it (`checkPage` in `app/register-resident.jsx:45`), so the Profile pop-up
    shows it.
25. **Fixed — Settings checks the phone number format** (fixed 2026-10-01).
    `saveResidentSettings` in `app/resident-home.jsx` now uses the same
    checker as sign-up and the request form (`normalizePhilippinePhone`). A
    bad number shows "Enter a mobile number like 0917 123 4567." and nothing
    is saved; a good one is saved as `+639…`. So a typo in Settings can no
    longer block booking for "Me". Driver Settings (`saveDriverSettings` in
    `app/driver-home.jsx`) got the same check.

### Sign Up

26. **Fixed — Clear sign-up errors.** "This email already has an account" and
    the short-password message are handled (`handleNext` in
    `app/signup.jsx:66-71`).
27. **Fixed — No more half-created accounts.** Sign Up only creates the login
    account; the profile is saved later. Someone who stops halfway is sent
    back to Verify Email or Choose Role when they log in (`handleLogin` in
    `app/login.jsx:44-48`, `AuthRouteGate.jsx:33-36`).
28. **Fixed — Same password rule everywhere.** Sign Up and Settings both need
    at least 6 characters. The old Apply to Drive form (8 characters) is gone;
    `/apply-to-drive` is only a signpost now (`app/apply-to-drive.jsx`).

### App start, landing page and permissions

29. **Still open — The app asks for notification permission, but never sends
    a notification.** `askResidentPermissionsOnce` in
    `lib/permissions.js:21-37` is the only code that uses
    `expo-notifications`.
30. **Fixed — The Terms of Service link is real:**
    `https://sakay-na-delta.vercel.app/terms` (`TERMS_URL` in
    `constants/app.js:56`). The ☰ menu also opens the Terms and Privacy pages
    inside the app.
31. **Still open — On the website, a logged-in resident is not sent to their
    home.** The phone app does this (`MobileStart` in `app/index.jsx:21-31`),
    but the website landing page (`WebLandingPage` in `app/index.jsx:33`) and
    the Log In page never check who is already logged in.

### Unclear

32. **Still unclear — Opening the phone app with no internet.** When the login
    is remembered, the app still needs to read the profile from Firestore
    (`useCurrentUserProfile` in `lib/session.js:91-138`). Without internet,
    the profile may not load, and the resident may see the landing page or
    "Account unavailable". The home map would also be grey. It needs a test
    on a phone in airplane mode.
