# Resident Role — What a Resident Can See and Do

Everything below comes from reading the code. Every claim has a file path
(and usually a line number) so you can check it. Next to each file path is
the name of the function (or screen component) the line is in. "Unclear"
means I could not confirm it from the code alone.

Last checked against the code on 2026-09-27 (after the commit "Fix: resident
can watch own alert before it exists (rules)").

---

## 1. Overview

A resident is a regular person living in Toledo City who uses SakayNa to ask
for a ride. They can fill in a **transport request** (for example, a ride to
the hospital), send a one-tap **emergency alert** to the dispatchers, and
**follow the status** of their requests until a driver finishes the trip.
Residents create their own account through the Sign Up screen (`Signup` in
`app/signup.jsx`).

On the **Android app**, the resident stays logged in after closing the app
(section 2.4), and the app asks for phone permissions right after a resident
first reaches their home screen (section 2.5).

While an emergency alert is waiting for a dispatcher, the resident's app
keeps the screen on and sends an "I'm still here" signal every 20 seconds
(section 2.5 a).

---

## 2. Screens

A resident only has **one real screen after login**: `ResidentHome` in
`app/resident-home.jsx`. Everything else on the resident side is a **pop-up
window** (called a "modal") that opens on top of that screen.

### 2.1 Start / landing page — `app/index.jsx`

The phone app and the website show different first pages (`Index` in
`app/index.jsx:11-18`).

**On the phone app** (`MobileStart` in `app/index.jsx:21-31`):

1. While the app checks whether someone is already logged in, it shows
   "Starting SakayNa..." with a spinner (`MobileStart` in
   `app/index.jsx:24-26`).
2. If a remembered user has an allowed account, they go **straight to their
   home screen**. For a resident that is `/resident-home` (`MobileStart` in
   `app/index.jsx:29-30`).
3. Otherwise, the **mobile landing page** appears (`MobileLanding` in
   `components/MobileLanding.jsx`). It is always dark on purpose
   (`MobileLanding` in `components/MobileLanding.jsx:12-27`). It shows:
   - **Get Started** → the Sign Up screen (`MobileLanding` in
     `components/MobileLanding.jsx:195-204`)
   - **Already have an account? Log In** → the Log In screen
     (`MobileLanding` in `components/MobileLanding.jsx:206-210`)
   - **Terms of Service** link → opens a web page in a browser (`openTerms`
     in `components/MobileLanding.jsx:54-56`, `MobileLanding` in
     `212-217`). The address is still a placeholder (see section 6).
   - There is no "Jobs" link on the phone.

**On the website** (`WebLandingPage` in `app/index.jsx:33`):

- **Sees:** the SakayNa welcome page.
- **Can tap:** "Log In" (`WebLandingPage` in `app/index.jsx:100`) and "Sign
  Up" (`WebLandingPage` in `app/index.jsx:103`). There is also a "Jobs"
  footer link that opens the driver application page (`WebLandingPage` in
  `app/index.jsx:184-185`). That page is for drivers, not residents (see
  section 5.4).

### 2.2 Sign Up — `app/signup.jsx`

- **Sees / fills in:** Full Name, Email Address, Password, Confirm Password
  (both have a show/hide eye button), a Barangay dropdown you can search
  (Toledo City barangays from the `TOLEDO_BARANGAY_OPTIONS` list in
  `lib/barangays.js`), Phone Number.
- **Taps "Create Account"** (`Signup` in `app/signup.jsx:174`):
  1. Checks that every field is filled in (`handleSignup` in
     `app/signup.jsx:33`).
  2. Checks that the two passwords match (`handleSignup` in
     `app/signup.jsx:38`).
  3. Creates the login account in Firebase Authentication (`handleSignup` in
     `app/signup.jsx:46`).
  4. Saves a profile in Firestore at `users/{uid}` with
     `role: "Resident"` and `accountStatus: "Active"` (`handleSignup` in
     `app/signup.jsx:49-58`).
  5. Sends a verification email in the background (`handleSignup` in
     `app/signup.jsx:60`).
  6. Goes to the Verify Email screen (`handleSignup` in `app/signup.jsx:63`).
  7. If something fails, it logs the user out and shows an error message
     (`handleSignup` in `app/signup.jsx:64-73`).
- **Other taps:** back arrow → start page (`Signup` in `app/signup.jsx:84`).
  On the phone that is the mobile landing page. "Already have an account?
  Log In" → login (`Signup` in `app/signup.jsx:178-179`).

### 2.3 Verify Email — `app/verify-email.jsx`

- **Sees:** "We sent a verification link to …" and a note that email
  verification **is not enforced** (`VerifyEmail` in
  `app/verify-email.jsx:83`).
- **Can tap:**
  - "I Verified My Email" → asks Firebase again whether the email is verified
    and shows "Email verified." or "Email not verified yet."
    (`refreshVerificationStatus` in `app/verify-email.jsx:25-38`).
  - "Resend Verification Email" → sends a new email, then you must wait 60
    seconds before you can send another (`VerifyEmail` in
    `app/verify-email.jsx:13`, `handleResend` in `54-69`).
  - "Continue to SakayNa" → goes to the resident home screen if the profile is
    ready (`handleContinue` in `app/verify-email.jsx:71-78`). You can do this
    **even if the email is not verified**.

### 2.4 Log In — `app/login.jsx`

- **Fills in:** Email and Password.
- **Taps "Log In"** (`handleLogin` in `app/login.jsx:30-56`):
  1. Checks both fields are filled in.
  2. Signs in with Firebase Authentication.
  3. Reads the user's profile from `users/{uid}`.
  4. Uses `getPostAuthenticationRoute` (`lib/roles.js:27`) to decide where to
     go. For an allowed resident this is `/resident-home`.
  5. If there is no allowed place to go (no profile, wrong role, or a blocked
     status), it logs the user out and shows an error.
- **Taps "Forgot Password?"** (`handlePasswordReset` in
  `app/login.jsx:58-76`): sends a password reset email. It always shows the
  same success message, so nobody can use this button to find out which
  emails have accounts.
- **Back arrow** → start page (`Login` in `app/login.jsx:79`).

**Staying logged in** (`createAuth` in `firebase.jsx:27-42`):

- **Phone app:** Firebase saves the login in AsyncStorage (a small storage
  box on the phone that keeps data after the app is closed) (`createAuth` in
  `firebase.jsx:35`). So a resident who closes and reopens the app is still
  logged in, and section 2.1 sends them straight to their home screen.
- **Website:** it uses the normal browser login (`createAuth` in
  `firebase.jsx:30-32`).
- **Being remembered does not skip the account checks.** Every time the app
  opens, the profile is read again from Firestore (`MobileStart` in
  `app/index.jsx:22-30`, `useCurrentUserProfile` in `lib/session.js:116`). A
  Deactivated resident is not let in (section 4.1).

### 2.5 Resident Home (dashboard) — `app/resident-home.jsx`

Before this screen appears, a "gatekeeper" component checks the user
(`AuthRouteGate` in `components/AuthRouteGate.jsx`, see section 4.1).

**Permission pop-ups (phone app only)** (`AuthRouteGate` in
`components/AuthRouteGate.jsx:42-51`, `askResidentPermissionsOnce` in
`lib/permissions.js`):

Once a Resident is let through to their home screen, the app asks for these
permissions, one after another (`askResidentPermissionsOnce` in
`lib/permissions.js:15-61`):

1. **Notifications** (`askResidentPermissionsOnce` in
   `lib/permissions.js:21-36`)
2. **Location**, only if it was never asked before
   (`askResidentPermissionsOnce` in `lib/permissions.js:38-45`)
3. **Phone calls** (Android only), used by the Call buttons
   (`askResidentPermissionsOnce` in `lib/permissions.js:47-60`)

- Each pop-up is shown **only once per install**. Saved flags remember that
  the app already asked (top of `lib/permissions.js:6-7`, used by
  `askResidentPermissionsOnce`).
- It runs at most once each time the app is opened (`askedThisAppRun` flag
  checked by `askResidentPermissionsOnce` in `lib/permissions.js:9-19`).
- Tapping "Don't allow" never blocks the resident. The app just moves on.
- Other roles and the website are not asked.

**What the resident sees:**

- A header with the SakayNa logo and a round avatar showing their initials
  (`ResidentHome` in `app/resident-home.jsx:579-589`).
- A welcome card: "Help is one tap away." (`ResidentHome` in
  `app/resident-home.jsx:592-606`).
- Three cards (`ResidentHome` in `app/resident-home.jsx:608-635`):
  1. **Emergency** → "Send emergency alert" button
  2. **Transport Request** → "Open Request Form" button
  3. **Current Ride Status** → "View Status" button
- A **"Latest Request"** panel (`ResidentHome` in
  `app/resident-home.jsx:637-677`) showing the newest request's title, a
  colored status tag, driver name (if assigned), service type, passenger
  count, pickup location and exact pickup details. If the resident has no
  requests, it shows "No request yet".

**What each button does:**

#### a) "Send emergency alert" (SOS) — `ResidentHome` in `app/resident-home.jsx:613`

1. A confirm pop-up appears: "Send emergency alert?" with **Cancel** and
   **Send alert** (`ResidentHome` in `app/resident-home.jsx:689-714`).
2. On **Send alert**, `sendEmergencyAlert` runs (`sendEmergencyAlert` in
   `app/resident-home.jsx:360-393`):
   - If not logged in, it shows "Login Required" and stops.
   - It creates a new ID for the alert and opens the alert pop-up.
   - `writeAlert` saves a document in `callSessions/{id}` with the resident's
     name, phone, barangay, `targetRole: "Dispatcher"`, `status: "ringing"`
     and `lastActiveAt` (the "I'm still here" time) (`writeAlert` in
     `app/resident-home.jsx:314-358`).
   - At the same time, `attachAlertLocation` tries to get the GPS location and
     adds it to the same alert afterwards (`attachAlertLocation` in
     `app/resident-home.jsx:280-310`). This way, slow GPS never delays the
     alert.
3. **The screen watches the alert live** (a Firestore "listener", which is
   like asking Firestore "tell me every time this alert changes")
   (alert watcher `useEffect` in `ResidentHome`,
   `app/resident-home.jsx:106-136`). This is how the pop-up learns that a
   dispatcher accepted. The watcher starts **before** the alert is saved, so
   at first the alert does not exist yet. The Firestore rules now allow this
   (`match /callSessions` in `firestore.rules:91-93`), so "Dispatcher
   accepted" now shows up. Before this rules fix, Firestore refused the
   watcher, and the resident never saw "Dispatcher accepted".
4. **"I'm still here" signal (heartbeat)** (heartbeat `useEffect` in
   `ResidentHome`, `app/resident-home.jsx:149-164`):
   - While the alert is saved and still ringing, the app updates
     `lastActiveAt` every **20 seconds** (`ALERT_HEARTBEAT_MS` at the top of
     `app/resident-home.jsx:25`).
   - It stops when a dispatcher accepts, when the resident cancels, or when
     the app is closed.
   - Dispatchers use this signal: an alert that has been quiet for **2
     minutes** is hidden from them (section 5.3).
5. **Screen stays awake** (keep-awake `useEffect` in `ResidentHome`,
   `app/resident-home.jsx:166-188`):
   - While the alert pop-up is open and the alert is ringing, the phone
     screen does not turn off by itself (package `expo-keep-awake`).
   - If this feature is not available on the phone, the app catches the error
     and the alert still works. The screen just turns off as usual.
   - Once a dispatcher accepts, or the alert closes, the screen can turn off
     normally again.
6. The alert pop-up changes depending on what is happening (`ResidentHome`
   in `app/resident-home.jsx:740-848`). The pop-up can scroll on small screens
   (`ResidentHome` in `app/resident-home.jsx:718-722`):

   | What is happening | What the resident sees |
   |---|---|
   | Still sending | "Sending alert…", "Sending to dispatchers." with a spinner |
   | Not confirmed within 10 seconds (for example, offline) | "Alert not confirmed" + **Try again** button (+ **Call the office** if an office number exists) |
   | Saved, waiting | "Emergency alert sent", "Waiting for a dispatcher to accept." with a spinner |
   | Nobody accepted after 30 seconds | "No dispatcher has accepted yet" + **Call the office** (if a number exists) |
   | A dispatcher accepted | "Dispatcher accepted" + **Call {dispatcher name}** (if the dispatcher has a phone number) |
   | Sending, waiting, or nobody accepted yet | A bold line: **"Keep this screen open until a dispatcher accepts."** (`ResidentHome` in `app/resident-home.jsx:812-814`) |
   | Location line | "Location: sending…", "Location: sent", or "Location: not available — dispatchers will see your barangay." |

7. **Try again** (`retryEmergencyAlert` in `app/resident-home.jsx:395-399`)
   re-sends using the **same ID**, so you can never end up with two alerts.
8. **Cancel alert / Back button** while the alert is still live asks "Cancel
   your emergency alert?" with **Keep alert** / **Cancel alert**
   (`handleAlertBack` in `app/resident-home.jsx:428-440`, `ResidentHome` in
   `723-739`).
9. Closing (`closeEmergencyAlert` in `app/resident-home.jsx:401-424`) sets
   the alert's status to `"cancelled"` (if still ringing) or `"ended"` (if a
   dispatcher had accepted).
10. The office phone number is read from `systemSettings/operational` →
    `publicOfficePhone` right after login (`loadOfficePhone` in
    `app/resident-home.jsx:190-198`, called from a `useEffect` in
    `ResidentHome` at `200-205`).
11. **Call buttons** (`openPhone` in `app/resident-home.jsx:442-444`) all go
    through `startPhoneCall` (`startPhoneCall` in `lib/phoneCall.js:6-26`):
    - On Android, if the resident allowed phone calls, the **call starts
      right away** (`startPhoneCall` in `lib/phoneCall.js:9-19`).
    - Otherwise (website, permission not given, or any error), the phone's
      **dialer opens** with the number already filled in (`startPhoneCall`
      in `lib/phoneCall.js:25`).

#### b) "Open Request Form" — `ResidentRequestForm` in `features/resident/components/ResidentRequestForm.jsx`

The form has 3 steps: **fill in → review → sent**.

**Step 1 — Fill in** (`ResidentRequestForm` in `ResidentRequestForm.jsx:62-74`):

| Field | Type | Notes |
|---|---|---|
| Request category | dropdown | "Community transport" or "Emergency transport" |
| Service type | dropdown | 8 choices, from `SERVICE_TYPE_OPTIONS` in `features/resident/utils/requestOptions.js:1-10` |
| Passenger count | dropdown | 1, 2, 4, 6, 8, 10+ (`PASSENGER_CAPACITY_OPTIONS` in `requestOptions.js:12-19`) |
| Passenger name | text | filled in from the profile name, max 80 characters |
| Contact number | text | filled in from the profile phone, max 16 characters |
| Pickup barangay | dropdown you can search | filled in from the profile barangay |
| Pickup location | text | plus two buttons: **Use current location** (GPS) and **Place map pin** |
| Exact pickup details | text | e.g. "blue gate beside the chapel", max 300 characters |
| Destination | dropdown | "Enter destination" (shows a text box), "Nearest appropriate facility", and **only for Emergency** "No destination (emergency only)" |
| Reason for transport | text | max 500 characters |
| Assistance needs | 5 on/off switches | Senior citizen, PWD, Pregnant passenger, Child, Other (`requestOptions.js:21-27`) |
| Accessibility/medical notes | text | optional |
| Additional notes | text | optional |

- **Use current location** (`useGps` in `ResidentRequestForm.jsx:38-43`) →
  asks for location permission, reads the GPS (gives up after 15 seconds),
  turns the coordinates into an address, and fills the pickup field. See
  `detectLocation` in `features/resident/hooks/useCurrentLocation.js`.
- **Place map pin** → opens `MapLocationModal` in
  `features/resident/components/MapLocationModal.jsx`. The resident taps the
  map, can type an address or landmark, then taps **Confirm pin** (`confirm`
  → `MapLocationModal` in `MapLocationModal.jsx:44`).
- **Review request** → `openReview` (`openReview` in
  `ResidentRequestForm.jsx:45-51`) cleans up the text, checks the form
  (section 4.2), and either shows red error messages or moves on to Step 2.

**Step 2 — Review** (`ResidentRequestForm` in `ResidentRequestForm.jsx:62`):
shows a summary with **Back** and **Submit request** buttons.

**Step 3 — Submit** (`submit` in `ResidentRequestForm.jsx:53-59`): calls
`createResidentRequest` (`createResidentRequest` in
`features/resident/services/residentRequestService.js:13`), which saves a new
document in `transportRequests` with `status: "Pending"` and a reference
number like `SKN-AB12CD34`. The form then shows "Request sent — Your reference
is SKN-…" and a **Done** button.

#### c) "View Status" — `ResidentHome` in `app/resident-home.jsx:631`

Calls `handleQuickAction("status")` (`handleQuickAction` in
`app/resident-home.jsx:247-276`), which updates the Latest Request panel. (See
section 6, this button may look like it does nothing.)

#### d) Avatar menu — `ResidentHome` in `app/resident-home.jsx:853-889`

Tapping the avatar opens a menu with the resident's name and email and these
choices:

- **Profile** → a **read-only** pop-up showing Full Name, Email, Phone,
  Barangay, Address (`ResidentHome` in `app/resident-home.jsx:891-927`). You
  cannot edit anything here.
- **History** → the Request History pop-up (below).
- **Settings** → the Settings pop-up (below).
- **Log Out** → signs out and goes to `/login` (`ResidentHome` in
  `app/resident-home.jsx:873-886`). On the phone, this also removes the saved
  login, so the next app start shows the landing page (`logoutCurrentUser` in
  `lib/session.js:65-73`).

### 2.6 Request History — `ResidentRequestHistory` in `features/resident/components/ResidentRequestHistory.jsx`

- **Sees:** a list of their **50 newest** requests (`ResidentRequestHistory`
  in `ResidentRequestHistory.jsx:46`, `useResidentRequests` in
  `features/resident/hooks/useResidentRequests.js:35`). Each item shows the
  reference, a status label, the service type, pickup, date, and "Cancellation
  is available" if the request can still be cancelled.
- **Can filter** by status (All / Active / Completed / Cancelled / Pending /
  Assigned / In progress) and by type (Emergency / Community), and **search**
  by reference number (`ResidentRequestHistory` in
  `ResidentRequestHistory.jsx:13-33`).
- **Taps a request** → opens **Request Details** (`ResidentRequestDetails` in
  `features/resident/components/ResidentRequestDetails.jsx`), which shows:
  - every field of the request
  - an "Assigned responder" section (driver, vehicle, plate number, contact)
  - a map with the pickup and destination, if coordinates exist
  - a **status timeline** (`RequestStatusTimeline` in
    `features/resident/components/RequestStatusTimeline.jsx`):
    Submitted → Dispatcher review → Driver assigned → Driver accepted → En
    route → Arrived → Picked up → Completed (or Cancelled / Rejected)
  - a **Cancel request** button, but only if the status is Pending or Assigned
- **Cancel a request** (`requestCancellation` in
  `ResidentRequestHistory.jsx:35-44`):
  1. A pop-up asks for a reason (3 to 240 characters).
  2. **Confirm cancellation** calls `cancelResidentRequest`
     (`cancelResidentRequest` in `residentRequestService.js:57-87`).
  3. The request becomes `status: "Cancelled"` and the app saves the reason,
     `previousStatus`, `cancelledBy` and `cancelledAt`.
  4. If the request has already moved past Assigned, the resident sees: "This
     request has already moved beyond the cancellation stage."

### 2.7 Settings — `ResidentHome` in `app/resident-home.jsx:937-1008`

- **Can edit:** "Username" (this is really the Full Name), Phone Number, Email
  Address.
- **Dark / Light** switch for the app colors (`ResidentHome` in
  `app/resident-home.jsx:977-985`).
- **Save Settings** → `saveResidentSettings` (`saveResidentSettings` in
  `app/resident-home.jsx:446-514`):
  1. All three fields must be filled in.
  2. If the email changed, it updates the login email in Firebase
     Authentication (`updateEmail`).
  3. Updates `users/{uid}` with `fullName`, `phoneNumber`, `phone`, `email`.
- **Change Password** → another pop-up (`ResidentHome` in
  `app/resident-home.jsx:1010-1064`) → `saveResidentPassword`
  (`saveResidentPassword` in `app/resident-home.jsx:516-561`):
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
| `MobileLanding` | `components/MobileLanding.jsx:43` | The dark phone landing page with Get Started, Log In and Terms of Service. |
| `handleSignup` | `app/signup.jsx:30` | Creates the login account and a Resident profile in Firestore. |
| `refreshVerificationStatus` | `app/verify-email.jsx:25` | Asks Firebase again whether the email is verified. |
| `handleResend` | `app/verify-email.jsx:54` | Sends another verification email, then waits 60 seconds before allowing another. |
| `handleLogin` | `app/login.jsx:30` | Signs in, reads the profile, and sends the user to the correct home screen. |
| `handlePasswordReset` | `app/login.jsx:58` | Sends a password reset email. |
| `useCurrentUserProfile` | `lib/session.js:91` | Keeps watching who is logged in and their `users/{uid}` profile, live. |
| `getPostAuthenticationRoute` | `lib/roles.js:27` | Decides which screen a user may go to, based on role and account status. |
| `isDisabledProfile` | `lib/roles.js:7` | Returns true only when `accountStatus` is `"Deactivated"`. |
| `AuthRouteGate` | `components/AuthRouteGate.jsx:13` | The "gatekeeper" that blocks protected screens unless the user is allowed. Also starts the Resident permission pop-ups. |
| `askResidentPermissionsOnce` | `lib/permissions.js:15` | Asks for notifications, location and phone calls, each only once per install. |
| `logoutCurrentUser` | `lib/session.js:65` | Signs the user out of Firebase. On the phone this also removes the saved login. |
| `handleQuickAction` | `app/resident-home.jsx:247` | Runs the right action when one of the three dashboard cards is tapped. |
| `sendEmergencyAlert` | `app/resident-home.jsx:360` | Starts an emergency alert: opens the pop-up, saves the alert, and looks up the GPS. |
| `writeAlert` | `app/resident-home.jsx:314` | Saves the alert to `callSessions` (including the first `lastActiveAt`), with a 10-second "not confirmed" limit. |
| alert watcher (`useEffect` in `ResidentHome`) | `app/resident-home.jsx:106` | Watches the alert live, so the pop-up knows when it is saved and when a dispatcher accepts. |
| heartbeat (`useEffect` in `ResidentHome`) | `app/resident-home.jsx:149` | While the alert is ringing, updates `lastActiveAt` every 20 seconds ("I'm still here"). |
| keep-awake (`useEffect` in `ResidentHome`) | `app/resident-home.jsx:166` | Keeps the phone screen on while the alert pop-up is open and ringing. |
| `attachAlertLocation` | `app/resident-home.jsx:280` | Adds the GPS location to an alert that was already sent. |
| `retryEmergencyAlert` | `app/resident-home.jsx:395` | Sends the same alert again, using the same ID. |
| `closeEmergencyAlert` | `app/resident-home.jsx:401` | Marks the alert cancelled or ended, then resets the pop-up. |
| `handleAlertBack` | `app/resident-home.jsx:428` | Asks "Cancel your emergency alert?" before closing an alert that is still live. |
| `openPhone` | `app/resident-home.jsx:442` | Used by every Call button on the alert pop-up. Calls `startPhoneCall`. |
| `startPhoneCall` | `lib/phoneCall.js:6` | Android with permission: starts the call right away. Otherwise: opens the dialer with the number filled in. |
| `loadOfficePhone` | `app/resident-home.jsx:190` | Reads the public office phone number from `systemSettings/operational`. |
| `saveResidentSettings` | `app/resident-home.jsx:446` | Saves name, phone and email changes. |
| `saveResidentPassword` | `app/resident-home.jsx:516` | Checks the current password, then saves the new one. |
| `useResidentRequests` | `features/resident/hooks/useResidentRequests.js:10` | Watches the resident's own requests live, newest first, and keeps the top 50. |
| `useCurrentLocation` / `detectLocation` | `features/resident/hooks/useCurrentLocation.js:9`, `12` | Gets the phone's GPS location (gives up after 15 s) and turns it into an address. |
| `createResidentRequest` | `features/resident/services/residentRequestService.js:13` | Saves a new transport request with status "Pending" and a reference number. |
| `cancelResidentRequest` | `features/resident/services/residentRequestService.js:57` | Changes a Pending or Assigned request to "Cancelled" and saves the reason. |
| `sanitizeRequestForm` | `features/resident/utils/requestValidation.js:16` | Removes extra spaces and converts the phone number to `+63` format. |
| `validateResidentRequest` | `features/resident/utils/requestValidation.js:34` | Checks the request form and returns error messages. |
| `validateCancellationReason` | `features/resident/utils/requestValidation.js:56` | Checks that the cancel reason is 3 to 240 characters. |
| `normalizePhilippinePhone` | `features/resident/utils/requestValidation.js:3` | Turns `09…`, `639…` or `+639…` into `+639…`, or returns empty if the number is not valid. |
| `getResidentReportedPriority` | `features/resident/utils/requestOptions.js:36` | Sets priority to Urgent (emergency or medical), Planned (events or rentals), or Non-Urgent. |
| `normalizeResidentRequest` | `features/resident/utils/requestMapper.js:35` | Fills in default values (status, reference, labels) for a request. |
| `getRequestTimeline` | `features/resident/utils/requestMapper.js:46` | Builds the list of timeline steps and marks which ones are done. |
| `canResidentCancel` | `features/resident/utils/requestMapper.js:33` | True if the status is Pending or Assigned. |
| `getRequestStatusMeta` | `features/resident/utils/requestMapper.js:31` | Gives each status a friendly label, color and icon. |

---

## 4. Rules (what limits a resident)

### 4.1 Login and access checks

- **Which screens need a login:** `resident-home` and the other role home
  screens are "protected" (list at the top of
  `components/AuthRouteGate.jsx:11`, used by `AuthRouteGate`). If the user is
  not logged in, they are sent to `/login` (`AuthRouteGate` in
  `AuthRouteGate.jsx:27-30`).
- **The profile must exist**, or the user sees "Account unavailable" with Retry
  and Log Out buttons (`AuthRouteGate` in `AuthRouteGate.jsx:65-67`).
- **The role must be one of Resident / Driver / Dispatcher / Admin**, or the
  user sees "Invalid role" (`AuthRouteGate` in `AuthRouteGate.jsx:69-71`,
  `isSupportedRole` in `lib/roles.js:5`).
- **Right screen for the role:** if a resident tries to open another role's
  screen, the gatekeeper sends them back to `/resident-home` (`AuthRouteGate`
  in `AuthRouteGate.jsx:37-39`, `getRoleRoute` in `lib/roles.js:12-25`).
- **Account status** (`isDisabledProfile` in `lib/roles.js:7`,
  `getPostAuthenticationRoute` in `lib/roles.js:27-41`):

  | `accountStatus` | What happens to a resident |
  |---|---|
  | `Active` (set at signup) | Allowed in |
  | `Approved` | Allowed in |
  | `Deactivated` | Blocked: login shows an error; a remembered resident who opens the phone app sees the landing page, not their home (`MobileStart` in `app/index.jsx:29-30`); if already inside, they see "Account disabled" (`AuthRouteGate` in `AuthRouteGate.jsx:73-75`) |
  | `Pending` or `Rejected` | Login is refused (`handleLogin` in `app/login.jsx:44-47`); a remembered resident sees the landing page on app start; if already inside, see section 6 |
  | `Suspended` or `Disabled` | **Not blocked**, see section 6 |

- The profile is watched **live** (`useCurrentUserProfile` in
  `lib/session.js:116`), so a status change by an Admin affects an open app
  right away. It is also read again every time the app opens, even when the
  login is remembered (`MobileStart` in `app/index.jsx:22-30`).
- **Email verification is not required** (`VerifyEmail` in
  `app/verify-email.jsx:83`).

### 4.2 Form checks (validation)

**Sign Up** (`handleSignup` in `app/signup.jsx:33-41`): every field must be
filled in and the passwords must match. There is no minimum password length
check in the app (Firebase itself needs at least 6 characters), and no phone
number format check.

**Transport request** (`validateResidentRequest` in
`features/resident/utils/requestValidation.js:34-54`):

- category, service type and passenger count must be chosen
- passenger name: 1–80 characters
- contact number must be a valid Philippine mobile number (`09XXXXXXXXX`,
  `639…`, or `+639…`)
- barangay: 1–80 characters
- pickup location: 1–180 characters
- exact pickup details: 1–300 characters (required)
- destination: required, unless "Nearest appropriate facility" is chosen, or
  the category is Emergency and "No destination" is chosen
- reason for transport: 1–500 characters
- accessibility and additional notes: 500 characters or fewer

**Cancel reason:** 3–240 characters (`validateCancellationReason` in
`requestValidation.js:56-60`, and checked again in `cancelResidentRequest` in
`residentRequestService.js:58-61`).

**Settings:** name, phone and email must not be empty
(`saveResidentSettings` in `app/resident-home.jsx:452`). **Password:** at
least 6 characters and must match the confirm field (`saveResidentPassword`
in `app/resident-home.jsx:522-535`).

### 4.3 Status changes a resident can cause

| Where | From → To | Where in the code |
|---|---|---|
| Transport request | (new) → `Pending` | `createResidentRequest` in `residentRequestService.js:25` |
| Transport request | `Pending` or `Assigned` → `Cancelled` | `cancelResidentRequest` in `residentRequestService.js:72-83` |
| Emergency alert (`callSessions`) | (new) → `ringing` | `writeAlert` in `app/resident-home.jsx:333` |
| Emergency alert | `ringing` → `ringing` with a new `lastActiveAt` every 20 s (status does not change) | heartbeat `useEffect` in `ResidentHome`, `app/resident-home.jsx:157-161` |
| Emergency alert | `ringing` → `cancelled` | `closeEmergencyAlert` in `app/resident-home.jsx:405-410` |
| Emergency alert | `connected` → `ended` | `closeEmergencyAlert` in `app/resident-home.jsx:405-410` |

### 4.4 Firestore rules for a resident — `firestore.rules`

"Read" means see the data. "Write" means create, change or delete it.

| Collection | Resident can… | Rule line |
|---|---|---|
| `users/{uid}` | **read** only their own profile | `match /users` in `firestore.rules:48` |
| `users/{uid}` | **create** their own profile only as `role: "Resident"` + `accountStatus: "Active"` (or as a Pending Driver) | `selfCreateProfileIsSafe` in `firestore.rules:34-37`, `match /users` in `49` |
| `users/{uid}` | **update** their own profile, but can **never change `role` or `accountStatus`** | `keepsRoleAndStatus` in `firestore.rules:41-44`, `match /users` in `50-52` |
| `users/{uid}` | **delete**: nobody can | `match /users` in `firestore.rules:53` |
| `transportRequests` | **read** only requests where `residentId` is their own uid | `match /transportRequests` in `firestore.rules:58-60` |
| `transportRequests` | **create** only if `residentId` is their own uid | `match /transportRequests` in `firestore.rules:61` |
| `transportRequests` | **update** any request where `residentId` is their own uid (any field, see section 6) | `match /transportRequests` in `firestore.rules:62-64` |
| `transportRequests` | **delete**: Admin only | `match /transportRequests` in `firestore.rules:65` |
| `callSessions` | **read** their own alerts, **and** an alert ID that does not exist yet (so the app can start watching a new alert before it is saved) | `match /callSessions` in `firestore.rules:91-93` |
| `callSessions` | **create / update** only alerts where `residentId` is their own uid (any field, see section 6); **delete**: staff only | `match /callSessions` in `firestore.rules:94-96` |
| `Driver_Applications` | **create** one where `driverUid` is their own uid, and **read** their own. (Any logged-in user can, not only drivers.) The resident screens never do this. | `match /Driver_Applications` in `firestore.rules:100-105` |
| `systemSettings/operational` | **read** only (for the office phone) | `match /systemSettings/operational` in `firestore.rules:124-127` |
| `driverAssignments`, `vehicles`, `driverSchedules`, `vehicleChecklists`, `activityLogs`, other `systemSettings` | **no access** | `firestore.rules:69-87`, `107-131` |
| everything else | **no access** | `match /{document=**}` in `firestore.rules:134-136` |

Helper functions used above: `signedIn`, `isStaff`, `isAdmin`
(`firestore.rules:10-29`).

### 4.5 Bans and suspensions

- Only an **Admin** can change a resident's account status, using
  `changeAccountStatus` (`changeAccountStatus` in
  `features/admin/services/adminOperationsService.js:114`) in the Admin
  Operations panel (`renderAccounts` / `AdminOperationsPanel` in
  `features/admin/components/AdminOperationsPanel.jsx:212-213`). The Admin
  must type a reason of at least 3 characters (`changeAccountStatus` in
  `adminOperationsService.js:116`).
- **"Deactivated" is the only status that the app really treats as a ban**
  (`isDisabledProfile` in `lib/roles.js:7`). The Admin screen says so too:
  "Use Deactivated status above to revoke access today"
  (`AdminOperationsPanel` in `AdminOperationsPanel.jsx:218`).
- Deactivating **does not disable the Firebase login account itself**
  (`AdminOperationsPanel` in `AdminOperationsPanel.jsx:210`). It only changes
  the Firestore profile. This still works with the remembered login, because
  the app reads the profile again every time it opens (section 4.1).
- **Permanent deletion is not available yet**. The button is disabled
  (`AdminOperationsPanel` in `AdminOperationsPanel.jsx:218-219`).

---

## 5. Connections to other roles

### 5.1 Resident sends a transport request → Dispatcher

- The Dispatcher screen listens to every request where `status == "Pending"`
  (`useEffect` in `DispatcherHome`, `app/dispatcher-home.jsx:204`), so the new
  request appears in their queue right away.
- The Dispatcher picks a driver and a vehicle, then taps Assign.
  `assignDispatcherRequest` (`assignDispatcherRequest` in
  `features/dispatcher/services/dispatcherAssignmentService.js:7-76`) does 3
  things together:
  - creates a `driverAssignments` document
  - sets the request to `status: "Assigned"` and fills in
    `assignedDriverId/Name`, `assignedVehicleName`, `vehiclePlateNumber`,
    `assignedAt`
  - marks the vehicle as `"Assigned"`
- The resident sees this live. The status becomes "Driver assigned" and the
  driver and vehicle appear in Request Details.
- Once a request is no longer Pending, it **drops out of the dispatcher's
  queue**, because the queue only shows Pending requests.

### 5.2 Driver works on the request → Resident sees progress

- The Driver sees the assignment (`useEffect` in `DriverHome`,
  `app/driver-home.jsx:254-265`) and watches the linked request (`useEffect`
  in `DriverHome`, `app/driver-home.jsx:278`).
- Each driver step runs `transitionMission` (`transitionMission` in
  `features/driver/services/driverMissionService.js:35-101`). It updates
  **both** the assignment and the resident's request:
  - **Accepted / En Route / Arrived / Picked Up** → request `status: "In Progress"`
    plus `missionStatus` and a timestamp (`acceptedAt`, `enRouteAt`,
    `arrivedAt`, `pickedUpAt`)
  - **Completed** → request `status: "Completed"`, `completedAt`
  - **Declined** → request goes back to `status: "Pending"`, the driver fields
    are cleared, and `lastDeclinedDriverId` is set. The Dispatcher then sees it
    as "Reassignment needed" (`getQueueBucket` in
    `features/dispatcher/utils/dispatcherRequestMapper.js:5`)
- The resident's timeline reads these timestamps (`getRequestTimeline` in
  `features/resident/utils/requestMapper.js:46-62`).
- The driver's "Open pickup" button uses the resident's pinned GPS/map
  coordinates if there are any (`getPickupCoordinates` in
  `features/driver/utils/driverMissionMapper.js:15`).
- What the driver sees about the resident: the resident's name as "Patient",
  the summary, pickup location, pickup details, destination and passenger
  count (`DriverHome` in `app/driver-home.jsx:714-742`, `776-782`).

### 5.3 Resident sends an emergency alert → Dispatcher

- The Dispatcher screen listens for `callSessions` where
  `targetRole == "Dispatcher"` and `status == "ringing"` (alert listener
  `useEffect` in `DispatcherHome`, `app/dispatcher-home.jsx:337-365`). An
  "Incoming Emergency Call" pop-up appears with the resident's name
  (`DispatcherHome` in `app/dispatcher-home.jsx:700-716`).
- **Quiet alerts are hidden** (`DispatcherHome` in
  `app/dispatcher-home.jsx:20-24`, `350-357`, `368-380`):
  - For each ringing alert, the dispatcher's screen remembers the last
    `lastActiveAt` it saw, and **when this dispatcher's own device** saw it
    change.
  - If it has not changed for **2 minutes** (`STUCK_ALERT_MS`), the alert is
    treated as stuck (for example, the resident's app crashed or was closed)
    and the pop-up does not show it.
  - A clock re-checks this every 10 seconds (`STUCK_CHECK_INTERVAL_MS`),
    because a crashed app sends nothing that would cause a re-check.
  - This only **hides** the alert on the dispatcher's screen. Nothing is
    changed in Firestore, so the alert is still `"ringing"` there. If the
    signal starts again, the alert shows again.
- **Answer** → sets `status: "connected"`, `dispatcherId`, `dispatcherName`,
  and `dispatcherPhone` (from the dispatcher's `officePhone` or
  `operationalPhone`) (`answerIncomingCall` in
  `app/dispatcher-home.jsx:432-449`). The resident's alert watcher sees this
  (section 2.5 a, step 3), so the resident sees "Dispatcher accepted" and a
  Call button. On Android, that button starts the call directly if the
  resident allowed phone calls. The heartbeat and keep-awake then stop.
- **Decline** → adds the dispatcher's uid to `declinedBy`. The alert keeps
  ringing for the **other** dispatchers (`declineIncomingCall` in
  `app/dispatcher-home.jsx:451-465`, filter in the alert listener at `348`).
- When the resident cancels, the status becomes `cancelled`. This no longer
  matches the dispatcher's "ringing" filter, so the pop-up disappears.

### 5.4 Admin

- **Sees resident requests:** the Admin dashboard reads the 100 newest
  `transportRequests` and counts them by type and status
  (`useAdminDashboardData` in
  `features/admin/hooks/useAdminDashboardData.js:92`, `152-160`).
- **Sees resident alerts:** the Admin "call sessions" section lists up to 100
  alerts. Alerts that have been ringing for more than 30 seconds are marked
  "No dispatcher has answered this call yet" (`useAdminCallSessions` in
  `features/admin/hooks/useAdminCallSessions.js:8`, `52`;
  `AdminCallSessionsSection` in
  `features/admin/components/AdminCallSessionsSection.jsx:57-59`). The Admin
  list does **not** use the new `lastActiveAt` signal; it only looks at when
  the alert was created.
- **Edits resident profiles:** phone, barangay, address (`saveUserChanges` in
  `app/admin-home.jsx:606-649`). This is the **only** place an `address` is
  written, and that is the Address shown on the resident's Profile pop-up.
- **Changes status or role:** `changeAccountStatus` and `changeUserRole`
  (`changeAccountStatus` in `adminOperationsService.js:114`, `changeUserRole`
  in `153`). See section 4.5.
- **Sets the office phone** the resident sees on the alert screen:
  `saveSystemSettings` → `systemSettings/operational.publicOfficePhone`
  (`saveSystemSettings` in `adminOperationsService.js:218-223`).
- **Driver application** (`ApplyToDrive` in `app/apply-to-drive.jsx`): this
  page always creates a **brand-new** login account
  (`createUserWithEmailAndPassword` in `handleSubmit`). A resident cannot turn
  their existing account into a driver account from the app.

---

## 6. Unclear or possibly wrong

Nothing here has been changed in the code. This is only a list for you to
check. Items marked **(new)** were found in this review. Items marked
**(updated)** were changed in this review. The item numbers are the same as
in the last review, so the new items are numbered from 33.

### Bigger problems

1. **Cancelling an "Assigned" request does not tell the driver.**
   `cancelResidentRequest` only changes the request (`cancelResidentRequest`
   in `residentRequestService.js:76-83`). The `driverAssignments` document
   stays "Assigned", and the vehicle stays "Assigned". The driver still sees
   the mission (`useEffect` in `DriverHome`, `app/driver-home.jsx:263`). If
   the driver then taps Accept, `transitionMission` changes the request back
   to **"In Progress"**, because it never checks for "Cancelled"
   (`transitionMission` in `driverMissionService.js:89-92`). The rules allow
   this, because the driver is still the `assignedDriverId`
   (`match /transportRequests` in `firestore.rules:64`). The dispatcher also
   still sees that driver as busy (`isEligibleDispatcherDriver` in
   `dispatcherRequestMapper.js:15`).
2. **"Suspended" and "Disabled" do not block a resident.** The Admin can pick
   these statuses (`changeAccountStatus` in `adminOperationsService.js:115`,
   `ACCOUNT_STATUSES` in `constants/app.js:15-16`), but `isDisabledProfile`
   only checks `"Deactivated"` (`isDisabledProfile` in `lib/roles.js:7`).
   `getPostAuthenticationRoute` only blocks Pending/Rejected
   (`getPostAuthenticationRoute` in `lib/roles.js:32`). So a Suspended or
   Disabled resident can still log in and use everything.
3. **(updated) The Firestore rules let a resident change any field of their
   own request, and of their own emergency alert.**
   `match /transportRequests` in `firestore.rules:62-63` only checks that
   `residentId` is theirs. Someone using the database directly (not through
   the app) could set their own request to "Completed", un-cancel it, or fill
   in a fake driver. The `create` rule (`firestore.rules:61`) also does not
   check that `status == "Pending"`, and it does not check that the user is a
   Resident. The same is true for alerts: `match /callSessions` in
   `firestore.rules:95` would let a resident set their own alert to
   `"connected"` or fill in a fake dispatcher name. The app itself never does
   this.
4. **The rules never check `accountStatus`.** A Deactivated resident is only
   blocked by the app screens (`AuthRouteGate` in
   `components/AuthRouteGate.jsx`, `MobileStart` in `app/index.jsx:29-30`).
   The database itself would still accept their writes
   (`match /transportRequests` in `firestore.rules:61`,
   `match /callSessions` in `94`).
5. **A resident set to "Pending" or "Rejected" while inside the app may get
   stuck.** The gatekeeper finds no place to send them
   (`getPostAuthenticationRoute` in `lib/roles.js:32-34`), and it is not the
   "disabled" case, so it shows "Redirecting to your dashboard..." with a
   spinner forever (`AuthRouteGate` in `components/AuthRouteGate.jsx:77-78`).
   There is no Log Out button on that loading screen. On the phone, closing
   and reopening the app gets them out of this: they land on the landing page
   (`MobileStart` in `app/index.jsx:29-30`).

### Emergency alert

6. **The Dispatcher cannot see the resident's phone number or location in the
   app.** The resident is told "They will see your location and can call you
   back" (`ResidentHome` in `app/resident-home.jsx:612`), "Dispatchers will
   see your name and phone number" (`ResidentHome` in
   `app/resident-home.jsx:694`) and "can see where you are" (`ResidentHome`
   in `app/resident-home.jsx:782`). But the dispatcher's pop-up only shows
   `residentName` (`DispatcherHome` in `app/dispatcher-home.jsx:704`). The
   saved `residentPhone` and `location` fields are not displayed anywhere I
   could find. The Admin call list shows `pickupLocation` only
   (`AdminCallSessionsSection` in `AdminCallSessionsSection.jsx:66`).
7. **The "Dispatcher could not accept" state can never happen.** The resident
   screen checks for `status === "declined"` (`ResidentHome` in
   `app/resident-home.jsx:748`), but the dispatcher's Decline never sets that
   status. It only adds to `declinedBy` (`declineIncomingCall` in
   `app/dispatcher-home.jsx:457-460`).
8. **(updated) Old alerts no longer pop up for dispatchers, but they still
   stay "ringing" forever.** This is **partly fixed**. If the resident's app
   crashes or is closed while an alert is ringing, the heartbeat stops, and
   after 2 minutes dispatchers stop seeing the pop-up (section 5.3). But:
   - Nothing changes the alert's `status` in Firestore. It stays `"ringing"`
     forever (the dispatcher only hides it, `DispatcherHome` in
     `app/dispatcher-home.jsx:373-380`).
   - The Admin call list still shows it as "No dispatcher has answered this
     call yet" forever, because the Admin screen does not look at
     `lastActiveAt` (`useAdminCallSessions` in `useAdminCallSessions.js:50-52`).
   - See also #33 and #34 below for two side effects of the new signal.
9. `latestRequestId` is saved on each alert (`writeAlert` in
   `app/resident-home.jsx:330`), but nothing reads it. The Admin alert list
   shows "Type:" using `emergencyType/serviceType`
   (`AdminCallSessionsSection` in `AdminCallSessionsSection.jsx:63`), which
   the resident never saves, so it always says "Not specified".
10. **"Location: sending…" may take longer than 15 seconds.** The code
    comment says the location lookup finishes within 15 seconds (above
    `attachAlertLocation` in `app/resident-home.jsx:278-279`). But only the
    GPS reading has a 15-second limit (`detectLocation` in
    `useCurrentLocation.js:24-27`). Turning the coordinates into an address
    (`detectLocation` in `useCurrentLocation.js:33`) has no time limit.
    Unclear how long this can take on a real phone. The alert itself is not
    delayed, only the location line.

*Found in this review:*

33. **(new) The "I'm still here" signal probably stops when the resident
    leaves the app, so dispatchers may stop seeing a real alert.**
    - The heartbeat uses a normal timer (`setInterval`) in the heartbeat
      `useEffect` in `ResidentHome` (`app/resident-home.jsx:149-164`). On
      phones, these timers usually pause when the app is in the background.
    - The app goes to the background when the resident presses the power
      button, switches to another app, **or taps "Call the office"**, which
      opens the phone call (`openPhone` in `app/resident-home.jsx:442-444`).
      Keeping the screen awake (section 2.5 a, step 5) does not help here.
    - If the resident is away for more than 2 minutes (for example, a long
      call with the office), every dispatcher's pop-up hides the alert
      (`DispatcherHome` in `app/dispatcher-home.jsx:373-380`). The resident's
      screen still says "No dispatcher has accepted yet", so they do not know.
    - When the resident comes back to the app, the signal should start again
      within 20 seconds, and the alert should show again for dispatchers.
    - Unclear: I could not confirm from the code how long timers keep running
      in the background on Android. It needs a phone test: send an alert,
      tap "Call the office", stay on the call for 3 minutes, and watch the
      dispatcher screen.
34. **(new) Stuck alerts pop up again for 2 minutes every time a dispatcher
    opens or reloads the dispatcher screen.** The dispatcher's memory of
    "when did I last see a change" starts empty each time the screen opens
    (`lastSignOfLifeRef` in `DispatcherHome`, `app/dispatcher-home.jsx:64`).
    So every alert still stuck at `"ringing"` counts as "just seen" and shows
    again (`DispatcherHome` in `app/dispatcher-home.jsx:350-357`). Because
    only one alert pop-up shows at a time (`DispatcherHome` in
    `app/dispatcher-home.jsx:374`, the first live alert in the list), an old
    stuck alert could also sit in front of a real new alert for up to 2
    minutes. This gets worse over time, because stuck alerts are never
    cleaned up (#8).

### Transport request

11. **No timeout when sending a request offline.** The emergency alert has a
    10-second limit, but `createResidentRequest` does not. Offline, the
    "Submit request" button may keep spinning for a long time (`submit` in
    `ResidentRequestForm.jsx:56`). Unclear how long, because it depends on
    Firestore's offline behavior.
12. **Destination can get stuck.** If the resident picks Emergency → "No
    destination" and then switches the category to Community, the
    `destinationMode` stays "no-destination". That option is hidden for
    Community (`ResidentRequestForm` in `ResidentRequestForm.jsx:71`), and the
    text box only shows for "manual". The resident gets "Enter a
    destination…" with no box to type in, until they choose the destination
    dropdown again.
13. **The driver's map ignores the resident's pinned location.** The resident
    form saves the coordinates as `pickup.latitude/longitude`
    (`createResidentRequest` in `residentRequestService.js:39`). The driver's
    map only reads `pickupLatitude` or `latitude` (`requestMapProps` in
    `app/driver-home.jsx:385-390`), so no pickup pin appears there. (The
    driver's "Open pickup" button **does** use the right field,
    `getPickupCoordinates` in `driverMissionMapper.js:15`.)
14. **The driver does not see the contact number, the assistance needs, the
    notes, or the passenger name** entered by the resident. I found no use of
    `contactNumber`, `vulnerableGroups`, `accessibilityNotes` or
    `passengerName` in `app/driver-home.jsx`. The driver's "Patient" line
    shows the resident's account name instead (`DriverHome` in
    `app/driver-home.jsx:716`, `778`). So if a resident books a ride for
    someone else, the driver sees the wrong name.
15. **Some Request Details fields are never filled in:** `assignedDriverPhone`,
    `driverContactNumber`, `dispatcherName`, `dispatcherOfficePhone`
    (`ResidentRequestDetails` in `ResidentRequestDetails.jsx:17`, `24`). No
    code writes these to the request. The dispatcher's `officePhone` is passed
    to `assignDispatcherRequest` (`DispatcherHome` in
    `app/dispatcher-home.jsx:412`) but never saved. So the resident will
    always see "Contact is not available yet" and no dispatcher.
16. **A "Rejected" request status is displayed but never set.** The timeline
    and labels handle it (`statusMeta` in `requestMapper.js:9`,
    `getRequestTimeline` in `60`), but no code sets a request to "Rejected".
17. **The timeline can be wrong after a driver declines.** A decline sets the
    request back to Pending, but it does not clear `assignedAt` or
    `acceptedAt` (`transitionMission` in `driverMissionService.js:71-81`). So
    "Driver assigned" may still show a check mark (`getRequestTimeline` in
    `requestMapper.js:52`).
18. `submittingRef` in `ResidentRequestForm` (`ResidentRequestForm.jsx:31`)
    is never set to `true`, so it does nothing. Double taps are still blocked,
    because the button is disabled while `saving` is true (`AppButton` in
    `components/ui/AppButton.jsx:6`).
19. **A brand-new request may briefly show at the bottom of the list.**
    `createdAt` is a server time, and it is empty until the server confirms it,
    so the sort puts the request last (`toMillis` in
    `useResidentRequests.js:8`, `useResidentRequests` in `34`,
    `normalizeResidentRequest` in `requestMapper.js:42`). This could make
    "Latest Request" show an older request for a moment. Unclear how
    noticeable this is.
20. **"Use current location" may fill in a barangay that is not in the
    list.** The GPS result's area name is used as the barangay
    (`detectLocation` in `useCurrentLocation.js:35`) and copied into the form
    (`useGps` in `ResidentRequestForm.jsx:41`). If that name does not exactly
    match one of the Toledo City barangays in the dropdown
    (`TOLEDO_BARANGAY_OPTIONS` in `lib/barangays.js`), the dropdown may look
    empty while the form still accepts it. Unclear how often the phone's name
    matches the list.

### Home screen, profile and settings

21. **The "View Status" button often looks like it does nothing.** If the
    resident has any request at all, the panel always shows `latestRequest`
    and ignores what the button set (`displayResidentStatus` in `ResidentHome`,
    `app/resident-home.jsx:563-568`). For the same reason, the "Emergency
    alert sent" message (`useEffect` in `ResidentHome`,
    `app/resident-home.jsx:207-216`) is hidden for anyone who has made a
    request before.
22. **The "Settings updated successfully." message is never seen.** The
    Settings pop-up closes right after the message is set, and the message is
    cleared the next time it opens (`saveResidentSettings` in
    `app/resident-home.jsx:496-497`, `useEffect` in `ResidentHome` at
    `218-233`).
23. **Changing the email:** `updateEmail` (`saveResidentSettings` in
    `app/resident-home.jsx:466`) is rejected by newer Firebase projects that
    have "email enumeration protection" switched on. Unclear whether this
    project has it on. Also, if `updateEmail` works but the Firestore update
    fails, the login email and the profile email no longer match.
24. **The Address on the Profile pop-up is always "Not set" for new residents.**
    Sign Up never asks for an address (`handleSignup` in
    `app/signup.jsx:49-58`). Only an Admin can fill it in (`saveUserChanges`
    in `app/admin-home.jsx:620`).
25. Settings does not check the phone number format (`saveResidentSettings`
    in `app/resident-home.jsx:452`).

### Sign Up

26. **Some sign-up errors show a confusing message.** "Weak password" and
    "email already used" are not in `getAuthErrorMessage`
    (`getAuthErrorMessage` in `lib/session.js:42-63`). The resident sees
    "Check your connection and try again", which is misleading.
27. **Half-created accounts.** If the login account is created but saving the
    profile fails, the login account stays (`handleSignup` in
    `app/signup.jsx:64-73`). Signing up again with that email fails, and
    logging in shows "profile could not be found".
28. **Different password rules.** Sign Up has no minimum length in the app,
    Settings requires 6 (`saveResidentPassword` in
    `app/resident-home.jsx:527`), and Apply to Drive requires 8
    (`minimumPasswordLength` in `app/apply-to-drive.jsx:26`, used by
    `validateForm`).

### App start, landing page and permissions

29. **The app asks for notification permission, but never sends a
    notification.** `askResidentPermissionsOnce` in
    `lib/permissions.js:21-36` is the only code that uses
    `expo-notifications`. Residents see this pop-up, but nothing in the app
    uses it yet.
30. **The Terms of Service link is a placeholder.** It opens
    `https://example.com/sakayna-terms` (`TERMS_URL` in
    `constants/app.js:55-56`, used by `openTerms` in
    `components/MobileLanding.jsx:54-56`). The landing page says "By
    continuing, you agree to SakayNa's Terms of Service" (`MobileLanding` in
    `components/MobileLanding.jsx:212-217`), but there is no real page yet.
31. **On the website, a logged-in resident is not sent to their home.**
    The phone app does this (`MobileStart` in `app/index.jsx:21-31`), but the
    website landing page (`WebLandingPage` in `app/index.jsx:33`) and the Log
    In page (`Login` in `app/login.jsx`) never check who is already logged
    in. A resident who comes back to the website sees the landing page and
    must log in again, even though the browser still remembers them.

### Unclear

32. **Opening the phone app with no internet.** When the login is
    remembered, the app still needs to read the profile from Firestore
    (`MobileStart` in `app/index.jsx:22-30`, `useCurrentUserProfile` in
    `lib/session.js:116-138`). Without internet, the profile may not load.
    What the resident then sees depends on how Firestore behaves offline:
    probably the landing page, or "Account unavailable" with a "profile could
    not be found" message (`useCurrentUserProfile` in
    `lib/session.js:119-124`, `AuthRouteGate` in
    `components/AuthRouteGate.jsx:65-67`), which would be misleading. I could
    not confirm this from the code. It needs a test on a phone in airplane
    mode.
