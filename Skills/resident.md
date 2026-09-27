# Resident Role — What a Resident Can See and Do

Everything below comes from reading the code. Every claim has a file path
(and usually a line number) so you can check it. "Unclear" means I could not
confirm it from the code alone.

Last checked against the code on 2026-09-27 (after the commit "Android:
remember login with AsyncStorage").

---

## 1. Overview

A resident is a regular person living in Toledo City who uses SakayNa to ask
for a ride. They can fill in a **transport request** (for example, a ride to
the hospital), send a one-tap **emergency alert** to the dispatchers, and
**follow the status** of their requests until a driver finishes the trip.
Residents create their own account through the Sign Up screen
(`app/signup.jsx`).

On the **Android app**, the resident stays logged in after closing the app
(section 2.4), and the app asks for phone permissions right after a resident
first reaches their home screen (section 2.5).

---

## 2. Screens

A resident only has **one real screen after login**: `app/resident-home.jsx`.
Everything else on the resident side is a **pop-up window** (called a
"modal") that opens on top of that screen.

### 2.1 Start / landing page — `app/index.jsx`

The phone app and the website show different first pages
(`app/index.jsx:11-18`).

**On the phone app** (`MobileStart`, `app/index.jsx:21-31`):

1. While the app checks whether someone is already logged in, it shows
   "Starting SakayNa..." with a spinner (`app/index.jsx:24-26`).
2. If a remembered user has an allowed account, they go **straight to their
   home screen**. For a resident that is `/resident-home`
   (`app/index.jsx:29-30`).
3. Otherwise, the **mobile landing page** appears
   (`components/MobileLanding.jsx`). It is always dark on purpose
   (`components/MobileLanding.jsx:12-27`). It shows:
   - **Get Started** → the Sign Up screen (`components/MobileLanding.jsx:195-204`)
   - **Already have an account? Log In** → the Log In screen
     (`components/MobileLanding.jsx:206-210`)
   - **Terms of Service** link → opens a web page in a browser
     (`components/MobileLanding.jsx:54-56`, `212-217`). The address is still
     a placeholder (see section 6).
   - There is no "Jobs" link on the phone.

**On the website** (`WebLandingPage`, `app/index.jsx:33`):

- **Sees:** the SakayNa welcome page.
- **Can tap:** "Log In" (`app/index.jsx:100`) and "Sign Up"
  (`app/index.jsx:103`). There is also a "Jobs" footer link that opens the
  driver application page (`app/index.jsx:184-185`). That page is for
  drivers, not residents (see section 5.4).

### 2.2 Sign Up — `app/signup.jsx`

- **Sees / fills in:** Full Name, Email Address, Password, Confirm Password
  (both have a show/hide eye button), a Barangay dropdown you can search
  (Toledo City barangays from `lib/barangays.js`), Phone Number.
- **Taps "Create Account"** (`app/signup.jsx:174`):
  1. Checks that every field is filled in (`app/signup.jsx:33`).
  2. Checks that the two passwords match (`app/signup.jsx:38`).
  3. Creates the login account in Firebase Authentication
     (`app/signup.jsx:46`).
  4. Saves a profile in Firestore at `users/{uid}` with
     `role: "Resident"` and `accountStatus: "Active"` (`app/signup.jsx:49-58`).
  5. Sends a verification email in the background (`app/signup.jsx:60`).
  6. Goes to the Verify Email screen (`app/signup.jsx:63`).
  7. If something fails, it logs the user out and shows an error message
     (`app/signup.jsx:64-73`).
- **Other taps:** back arrow → start page (`app/signup.jsx:84`). On the phone
  that is the mobile landing page. "Already have an account? Log In" → login
  (`app/signup.jsx:178-179`).

### 2.3 Verify Email — `app/verify-email.jsx`

- **Sees:** "We sent a verification link to …" and a note that email
  verification **is not enforced** (`app/verify-email.jsx:83`).
- **Can tap:**
  - "I Verified My Email" → asks Firebase again whether the email is verified
    and shows "Email verified." or "Email not verified yet."
    (`app/verify-email.jsx:25-38`).
  - "Resend Verification Email" → sends a new email, then you must wait 60
    seconds before you can send another (`app/verify-email.jsx:13`, `54-69`).
  - "Continue to SakayNa" → goes to the resident home screen if the profile is
    ready (`app/verify-email.jsx:71-78`). You can do this **even if the email
    is not verified**.

### 2.4 Log In — `app/login.jsx`

- **Fills in:** Email and Password.
- **Taps "Log In"** (`app/login.jsx:30-56`):
  1. Checks both fields are filled in.
  2. Signs in with Firebase Authentication.
  3. Reads the user's profile from `users/{uid}`.
  4. Uses `getPostAuthenticationRoute` (`lib/roles.js:27`) to decide where to
     go. For an allowed resident this is `/resident-home`.
  5. If there is no allowed place to go (no profile, wrong role, or a blocked
     status), it logs the user out and shows an error.
- **Taps "Forgot Password?"** (`app/login.jsx:58-76`): sends a password reset
  email. It always shows the same success message, so nobody can use this
  button to find out which emails have accounts.
- **Back arrow** → start page (`app/login.jsx:79`).

**Staying logged in** (`firebase.jsx:27-42`):

- **Phone app:** Firebase saves the login in AsyncStorage (a small storage
  box on the phone that keeps data after the app is closed)
  (`firebase.jsx:35`). So a resident who closes and reopens the app is still
  logged in, and section 2.1 sends them straight to their home screen.
- **Website:** it uses the normal browser login (`firebase.jsx:30-32`).
- **Being remembered does not skip the account checks.** Every time the app
  opens, the profile is read again from Firestore (`app/index.jsx:22-30`,
  `lib/session.js:116`). A Deactivated resident is not let in (section 4.1).

### 2.5 Resident Home (dashboard) — `app/resident-home.jsx`

Before this screen appears, a "gatekeeper" component checks the user
(`components/AuthRouteGate.jsx`, see section 4.1).

**Permission pop-ups (phone app only)** (`components/AuthRouteGate.jsx:42-51`,
`lib/permissions.js`):

Once a Resident is let through to their home screen, the app asks for these
permissions, one after another (`lib/permissions.js:15-61`):

1. **Notifications** (`lib/permissions.js:21-36`)
2. **Location**, only if it was never asked before (`lib/permissions.js:38-45`)
3. **Phone calls** (Android only), used by the Call buttons
   (`lib/permissions.js:47-60`)

- Each pop-up is shown **only once per install**. Saved flags remember that
  the app already asked (`lib/permissions.js:6-7`).
- It runs at most once each time the app is opened
  (`lib/permissions.js:9-19`).
- Tapping "Don't allow" never blocks the resident. The app just moves on.
- Other roles and the website are not asked.

**What the resident sees:**

- A header with the SakayNa logo and a round avatar showing their initials
  (`app/resident-home.jsx:533-543`).
- A welcome card: "Help is one tap away." (`app/resident-home.jsx:546-560`).
- Three cards (`app/resident-home.jsx:562-589`):
  1. **Emergency** → "Send emergency alert" button
  2. **Transport Request** → "Open Request Form" button
  3. **Current Ride Status** → "View Status" button
- A **"Latest Request"** panel (`app/resident-home.jsx:591-631`) showing the
  newest request's title, a colored status tag, driver name (if assigned),
  service type, passenger count, pickup location and exact pickup details. If
  the resident has no requests, it shows "No request yet".

**What each button does:**

#### a) "Send emergency alert" (SOS) — `app/resident-home.jsx:567`

1. A confirm pop-up appears: "Send emergency alert?" with **Cancel** and
   **Send alert** (`app/resident-home.jsx:643-668`).
2. On **Send alert**, `sendEmergencyAlert` runs (`app/resident-home.jsx:314`):
   - If not logged in, it shows "Login Required" and stops.
   - It creates a new ID for the alert and opens the alert pop-up.
   - `writeAlert` saves a document in `callSessions/{id}` with the resident's
     name, phone, barangay, `targetRole: "Dispatcher"`,
     `status: "ringing"` (`app/resident-home.jsx:269-312`).
   - At the same time, `attachAlertLocation` tries to get the GPS location and
     adds it to the same alert afterwards (`app/resident-home.jsx:235-265`).
     This way, slow GPS never delays the alert.
3. The alert pop-up changes depending on what is happening
   (`app/resident-home.jsx:694-798`). The pop-up can scroll on small screens
   (`app/resident-home.jsx:672-676`):

   | What is happening | What the resident sees |
   |---|---|
   | Still sending | "Sending alert…" with a spinner |
   | Not confirmed within 10 seconds (for example, offline) | "Alert not confirmed" + **Try again** button (+ **Call the office** if an office number exists) |
   | Saved, waiting | "Emergency alert sent", "Waiting for a dispatcher to accept" |
   | Nobody accepted after 30 seconds | "No dispatcher has accepted yet" + **Call the office** (if a number exists) |
   | A dispatcher accepted | "Dispatcher accepted" + **Call {dispatcher name}** (if the dispatcher has a phone number) |
   | Location line | "Location: sending…", "Location: sent", or "Location: not available — dispatchers will see your barangay." |

4. **Try again** (`app/resident-home.jsx:349`) re-sends using the **same ID**,
   so you can never end up with two alerts.
5. **Cancel alert / Back button** while the alert is still live asks "Cancel
   your emergency alert?" with **Keep alert** / **Cancel alert**
   (`app/resident-home.jsx:382-394`, `677-693`).
6. Closing (`closeEmergencyAlert`, `app/resident-home.jsx:355-378`) sets the
   alert's status to `"cancelled"` (if still ringing) or `"ended"` (if a
   dispatcher had accepted).
7. The office phone number is read from `systemSettings/operational` →
   `publicOfficePhone` right after login (`app/resident-home.jsx:145-160`).
8. **Call buttons** (`openPhone`, `app/resident-home.jsx:396-398`) all go
   through `startPhoneCall` (`lib/phoneCall.js:6-26`):
   - On Android, if the resident allowed phone calls, the **call starts right
     away** (`lib/phoneCall.js:9-19`).
   - Otherwise (website, permission not given, or any error), the phone's
     **dialer opens** with the number already filled in
     (`lib/phoneCall.js:25`).

#### b) "Open Request Form" — `features/resident/components/ResidentRequestForm.jsx`

The form has 3 steps: **fill in → review → sent**.

**Step 1 — Fill in** (`ResidentRequestForm.jsx:62-74`):

| Field | Type | Notes |
|---|---|---|
| Request category | dropdown | "Community transport" or "Emergency transport" |
| Service type | dropdown | 8 choices, from `features/resident/utils/requestOptions.js:1-10` |
| Passenger count | dropdown | 1, 2, 4, 6, 8, 10+ (`requestOptions.js:12-19`) |
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

- **Use current location** (`ResidentRequestForm.jsx:38-43`) → asks for
  location permission, reads the GPS (gives up after 15 seconds), turns the
  coordinates into an address, and fills the pickup field. See
  `features/resident/hooks/useCurrentLocation.js`.
- **Place map pin** → opens `features/resident/components/MapLocationModal.jsx`.
  The resident taps the map, can type an address or landmark, then taps
  **Confirm pin** (`MapLocationModal.jsx:44`).
- **Review request** → `openReview` (`ResidentRequestForm.jsx:45-51`) cleans
  up the text, checks the form (section 4.2), and either shows red error
  messages or moves on to Step 2.

**Step 2 — Review** (`ResidentRequestForm.jsx:62`): shows a summary with
**Back** and **Submit request** buttons.

**Step 3 — Submit** (`ResidentRequestForm.jsx:53-59`): calls
`createResidentRequest` (`features/resident/services/residentRequestService.js:13`),
which saves a new document in `transportRequests` with `status: "Pending"`
and a reference number like `SKN-AB12CD34`. The form then shows "Request sent —
Your reference is SKN-…" and a **Done** button.

#### c) "View Status" — `app/resident-home.jsx:585`

Calls `handleQuickAction("status")` (`app/resident-home.jsx:202-231`), which
updates the Latest Request panel. (See section 6, this button may look like
it does nothing.)

#### d) Avatar menu — `app/resident-home.jsx:804-840`

Tapping the avatar opens a menu with the resident's name and email and these
choices:

- **Profile** → a **read-only** pop-up showing Full Name, Email, Phone,
  Barangay, Address (`app/resident-home.jsx:842-878`). You cannot edit
  anything here.
- **History** → the Request History pop-up (below).
- **Settings** → the Settings pop-up (below).
- **Log Out** → signs out and goes to `/login` (`app/resident-home.jsx:824-836`).
  On the phone, this also removes the saved login, so the next app start
  shows the landing page (`lib/session.js:65-73`).

### 2.6 Request History — `features/resident/components/ResidentRequestHistory.jsx`

- **Sees:** a list of their **50 newest** requests (`ResidentRequestHistory.jsx:46`,
  `features/resident/hooks/useResidentRequests.js:35`). Each item shows the
  reference, a status label, the service type, pickup, date, and "Cancellation
  is available" if the request can still be cancelled.
- **Can filter** by status (All / Active / Completed / Cancelled / Pending /
  Assigned / In progress) and by type (Emergency / Community), and **search**
  by reference number (`ResidentRequestHistory.jsx:13-33`).
- **Taps a request** → opens **Request Details**
  (`features/resident/components/ResidentRequestDetails.jsx`), which shows:
  - every field of the request
  - an "Assigned responder" section (driver, vehicle, plate number, contact)
  - a map with the pickup and destination, if coordinates exist
  - a **status timeline** (`features/resident/components/RequestStatusTimeline.jsx`):
    Submitted → Dispatcher review → Driver assigned → Driver accepted → En
    route → Arrived → Picked up → Completed (or Cancelled / Rejected)
  - a **Cancel request** button, but only if the status is Pending or Assigned
- **Cancel a request** (`ResidentRequestHistory.jsx:35-44`):
  1. A pop-up asks for a reason (3 to 240 characters).
  2. **Confirm cancellation** calls `cancelResidentRequest`
     (`residentRequestService.js:57-87`).
  3. The request becomes `status: "Cancelled"` and the app saves the reason,
     `previousStatus`, `cancelledBy` and `cancelledAt`.
  4. If the request has already moved past Assigned, the resident sees: "This
     request has already moved beyond the cancellation stage."

### 2.7 Settings — `app/resident-home.jsx:888-959`

- **Can edit:** "Username" (this is really the Full Name), Phone Number, Email
  Address.
- **Dark / Light** switch for the app colors (`app/resident-home.jsx:928-936`).
- **Save Settings** → `saveResidentSettings` (`app/resident-home.jsx:400-468`):
  1. All three fields must be filled in.
  2. If the email changed, it updates the login email in Firebase
     Authentication (`updateEmail`).
  3. Updates `users/{uid}` with `fullName`, `phoneNumber`, `phone`, `email`.
- **Change Password** → another pop-up (`app/resident-home.jsx:961-1015`)
  → `saveResidentPassword` (`app/resident-home.jsx:470-515`):
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
| `handleQuickAction` | `app/resident-home.jsx:202` | Runs the right action when one of the three dashboard cards is tapped. |
| `sendEmergencyAlert` | `app/resident-home.jsx:314` | Starts an emergency alert: opens the pop-up, saves the alert, and looks up the GPS. |
| `writeAlert` | `app/resident-home.jsx:269` | Saves the alert to `callSessions`, with a 10-second "not confirmed" limit. |
| `attachAlertLocation` | `app/resident-home.jsx:235` | Adds the GPS location to an alert that was already sent. |
| `retryEmergencyAlert` | `app/resident-home.jsx:349` | Sends the same alert again, using the same ID. |
| `closeEmergencyAlert` | `app/resident-home.jsx:355` | Marks the alert cancelled or ended, then resets the pop-up. |
| `handleAlertBack` | `app/resident-home.jsx:382` | Asks "Cancel your emergency alert?" before closing an alert that is still live. |
| `openPhone` | `app/resident-home.jsx:396` | Used by every Call button on the alert pop-up. Calls `startPhoneCall`. |
| `startPhoneCall` | `lib/phoneCall.js:6` | Android with permission: starts the call right away. Otherwise: opens the dialer with the number filled in. |
| `loadOfficePhone` | `app/resident-home.jsx:145` | Reads the public office phone number from `systemSettings/operational`. |
| `saveResidentSettings` | `app/resident-home.jsx:400` | Saves name, phone and email changes. |
| `saveResidentPassword` | `app/resident-home.jsx:470` | Checks the current password, then saves the new one. |
| `useResidentRequests` | `features/resident/hooks/useResidentRequests.js:10` | Watches the resident's own requests live, newest first, and keeps the top 50. |
| `useCurrentLocation` / `detectLocation` | `features/resident/hooks/useCurrentLocation.js:9` | Gets the phone's GPS location (gives up after 15 s) and turns it into an address. |
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
  screens are "protected" (`components/AuthRouteGate.jsx:11`). If the user is
  not logged in, they are sent to `/login` (`AuthRouteGate.jsx:27-30`).
- **The profile must exist**, or the user sees "Account unavailable" with Retry
  and Log Out buttons (`AuthRouteGate.jsx:65-67`).
- **The role must be one of Resident / Driver / Dispatcher / Admin**, or the
  user sees "Invalid role" (`AuthRouteGate.jsx:69-71`, `lib/roles.js:5`).
- **Right screen for the role:** if a resident tries to open another role's
  screen, the gatekeeper sends them back to `/resident-home`
  (`AuthRouteGate.jsx:37-39`, `lib/roles.js:12-25`).
- **Account status** (`lib/roles.js:7`, `lib/roles.js:27-41`):

  | `accountStatus` | What happens to a resident |
  |---|---|
  | `Active` (set at signup) | Allowed in |
  | `Approved` | Allowed in |
  | `Deactivated` | Blocked: login shows an error; a remembered resident who opens the phone app sees the landing page, not their home (`app/index.jsx:29-30`); if already inside, they see "Account disabled" (`AuthRouteGate.jsx:73-75`) |
  | `Pending` or `Rejected` | Login is refused (`app/login.jsx:44-47`); a remembered resident sees the landing page on app start; if already inside, see section 6 |
  | `Suspended` or `Disabled` | **Not blocked**, see section 6 |

- The profile is watched **live** (`lib/session.js:116`), so a status change by
  an Admin affects an open app right away. It is also read again every time
  the app opens, even when the login is remembered (`app/index.jsx:22-30`).
- **Email verification is not required** (`app/verify-email.jsx:83`).

### 4.2 Form checks (validation)

**Sign Up** (`app/signup.jsx:33-41`): every field must be filled in and the
passwords must match. There is no minimum password length check in the app
(Firebase itself needs at least 6 characters), and no phone number format
check.

**Transport request** (`features/resident/utils/requestValidation.js:34-54`):

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

**Cancel reason:** 3–240 characters (`requestValidation.js:56-60`, and checked
again in `residentRequestService.js:58-61`).

**Settings:** name, phone and email must not be empty
(`app/resident-home.jsx:406`). **Password:** at least 6 characters and must
match the confirm field (`app/resident-home.jsx:476-489`).

### 4.3 Status changes a resident can cause

| Where | From → To | Where in the code |
|---|---|---|
| Transport request | (new) → `Pending` | `residentRequestService.js:25` |
| Transport request | `Pending` or `Assigned` → `Cancelled` | `residentRequestService.js:72-83` |
| Emergency alert (`callSessions`) | (new) → `ringing` | `app/resident-home.jsx:288` |
| Emergency alert | `ringing` → `cancelled` | `app/resident-home.jsx:359-363` |
| Emergency alert | `connected` → `ended` | `app/resident-home.jsx:359-363` |

### 4.4 Firestore rules for a resident — `firestore.rules`

"Read" means see the data. "Write" means create, change or delete it.

| Collection | Resident can… | Rule line |
|---|---|---|
| `users/{uid}` | **read** only their own profile | `firestore.rules:48` |
| `users/{uid}` | **create** their own profile only as `role: "Resident"` + `accountStatus: "Active"` (or as a Pending Driver) | `firestore.rules:34-37`, `49` |
| `users/{uid}` | **update** their own profile, but can **never change `role` or `accountStatus`** | `firestore.rules:41-44`, `50-52` |
| `users/{uid}` | **delete**: nobody can | `firestore.rules:53` |
| `transportRequests` | **read** only requests where `residentId` is their own uid | `firestore.rules:58-60` |
| `transportRequests` | **create** only if `residentId` is their own uid | `firestore.rules:61` |
| `transportRequests` | **update** any request where `residentId` is their own uid (any field, see section 6) | `firestore.rules:62-64` |
| `transportRequests` | **delete**: Admin only | `firestore.rules:65` |
| `callSessions` | **read / create / update** only alerts where `residentId` is their own uid; **delete**: staff only | `firestore.rules:90-95` |
| `Driver_Applications` | **create** one where `driverUid` is their own uid, and **read** their own. (Any logged-in user can, not only drivers.) The resident screens never do this. | `firestore.rules:98-103` |
| `systemSettings/operational` | **read** only (for the office phone) | `firestore.rules:122-125` |
| `driverAssignments`, `vehicles`, `driverSchedules`, `vehicleChecklists`, `activityLogs`, other `systemSettings` | **no access** | `firestore.rules:69-87`, `105-129` |
| everything else | **no access** | `firestore.rules:132-134` |

### 4.5 Bans and suspensions

- Only an **Admin** can change a resident's account status, using
  `changeAccountStatus` (`features/admin/services/adminOperationsService.js:114`)
  in the Admin Operations panel (`features/admin/components/AdminOperationsPanel.jsx:212-213`).
  The Admin must type a reason of at least 3 characters
  (`adminOperationsService.js:116`).
- **"Deactivated" is the only status that the app really treats as a ban**
  (`lib/roles.js:7`). The Admin screen says so too: "Use Deactivated status
  above to revoke access today" (`AdminOperationsPanel.jsx:218`).
- Deactivating **does not disable the Firebase login account itself**
  (`AdminOperationsPanel.jsx:210`). It only changes the Firestore profile.
  This still works with the remembered login, because the app reads the
  profile again every time it opens (section 4.1).
- **Permanent deletion is not available yet**. The button is disabled
  (`AdminOperationsPanel.jsx:218-219`).

---

## 5. Connections to other roles

### 5.1 Resident sends a transport request → Dispatcher

- The Dispatcher screen listens to every request where `status == "Pending"`
  (`app/dispatcher-home.jsx:192`), so the new request appears in their queue
  right away.
- The Dispatcher picks a driver and a vehicle, then taps Assign.
  `assignDispatcherRequest` (`features/dispatcher/services/dispatcherAssignmentService.js:7-76`)
  does 3 things together:
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

- The Driver sees the assignment (`app/driver-home.jsx:254-265`) and watches
  the linked request (`app/driver-home.jsx:278`).
- Each driver step runs `transitionMission`
  (`features/driver/services/driverMissionService.js:35-101`). It updates
  **both** the assignment and the resident's request:
  - **Accepted / En Route / Arrived / Picked Up** → request `status: "In Progress"`
    plus `missionStatus` and a timestamp (`acceptedAt`, `enRouteAt`,
    `arrivedAt`, `pickedUpAt`)
  - **Completed** → request `status: "Completed"`, `completedAt`
  - **Declined** → request goes back to `status: "Pending"`, the driver fields
    are cleared, and `lastDeclinedDriverId` is set. The Dispatcher then sees it
    as "Reassignment needed" (`features/dispatcher/utils/dispatcherRequestMapper.js:5`)
- The resident's timeline reads these timestamps
  (`features/resident/utils/requestMapper.js:46-62`).
- The driver's "Open pickup" button uses the resident's pinned GPS/map
  coordinates if there are any (`features/driver/utils/driverMissionMapper.js:15`).
- What the driver sees about the resident: the resident's name as "Patient",
  the summary, pickup location, pickup details, destination and passenger
  count (`app/driver-home.jsx:714-742`, `776-782`).

### 5.3 Resident sends an emergency alert → Dispatcher

- The Dispatcher screen listens for `callSessions` where
  `targetRole == "Dispatcher"` and `status == "ringing"`
  (`app/dispatcher-home.jsx:326`). An "Incoming Emergency Call" pop-up appears
  with the resident's name (`app/dispatcher-home.jsx:664-680`).
- **Answer** → sets `status: "connected"`, `dispatcherId`, `dispatcherName`,
  and `dispatcherPhone` (from the dispatcher's `officePhone` or
  `operationalPhone`) (`app/dispatcher-home.jsx:396-413`). The resident then
  sees "Dispatcher accepted" and a Call button. On Android, that button starts
  the call directly if the resident allowed phone calls (section 2.5 a).
- **Decline** → adds the dispatcher's uid to `declinedBy`. The alert keeps
  ringing for the **other** dispatchers (`app/dispatcher-home.jsx:415-429`,
  `330-336`).
- When the resident cancels, the status becomes `cancelled`. This no longer
  matches the dispatcher's "ringing" filter, so the pop-up disappears.

### 5.4 Admin

- **Sees resident requests:** the Admin dashboard reads the 100 newest
  `transportRequests` and counts them by type and status
  (`features/admin/hooks/useAdminDashboardData.js:92`, `152-160`).
- **Sees resident alerts:** the Admin "call sessions" section lists up to 100
  alerts. Alerts that have been ringing for more than 30 seconds are marked
  "No dispatcher has answered this call yet"
  (`features/admin/hooks/useAdminCallSessions.js:8`, `52`;
  `features/admin/components/AdminCallSessionsSection.jsx:57-59`).
- **Edits resident profiles:** phone, barangay, address
  (`app/admin-home.jsx:606-649`). This is the **only** place an `address` is
  written, and that is the Address shown on the resident's Profile pop-up.
- **Changes status or role:** `changeAccountStatus` and `changeUserRole`
  (`adminOperationsService.js:114`, `153`). See section 4.5.
- **Sets the office phone** the resident sees on the alert screen:
  `saveSystemSettings` → `systemSettings/operational.publicOfficePhone`
  (`adminOperationsService.js:218-223`).
- **Driver application** (`app/apply-to-drive.jsx`): this page always creates
  a **brand-new** login account (`createUserWithEmailAndPassword`). A resident
  cannot turn their existing account into a driver account from the app.

---

## 6. Unclear or possibly wrong

Nothing here has been changed. This is only a list for you to check.
Items marked **(new)** were found in the latest review. Items marked
**(updated)** got extra details.

### Bigger problems

1. **Cancelling an "Assigned" request does not tell the driver.**
   `cancelResidentRequest` only changes the request
   (`residentRequestService.js:76-83`). The `driverAssignments` document stays
   "Assigned", and the vehicle stays "Assigned". The driver still sees the
   mission (`app/driver-home.jsx:263`). If the driver then taps Accept,
   `transitionMission` changes the request back to **"In Progress"**, because
   it never checks for "Cancelled" (`driverMissionService.js:89-92`). The
   rules allow this, because the driver is still the `assignedDriverId`
   (`firestore.rules:64`). The dispatcher also still sees that driver as busy
   (`dispatcherRequestMapper.js:15`).
2. **"Suspended" and "Disabled" do not block a resident.** The Admin can pick
   these statuses (`adminOperationsService.js:115`, `constants/app.js:15-16`),
   but `isDisabledProfile` only checks `"Deactivated"` (`lib/roles.js:7`).
   `getPostAuthenticationRoute` only blocks Pending/Rejected
   (`lib/roles.js:32`). So a Suspended or Disabled resident can still log in
   and use everything.
3. **The Firestore rules let a resident change any field of their own
   request.** `firestore.rules:62-63` only checks that `residentId` is theirs.
   Someone using the database directly (not through the app) could set their
   own request to "Completed", un-cancel it, or fill in a fake driver. The
   `create` rule (`firestore.rules:61`) also does not check that
   `status == "Pending"`, and it does not check that the user is a Resident.
4. **The rules never check `accountStatus`.** A Deactivated resident is only
   blocked by the app screens (`components/AuthRouteGate.jsx`,
   `app/index.jsx:29-30`). The database itself would still accept their
   writes (`firestore.rules:61`, `92`).
5. **(updated) A resident set to "Pending" or "Rejected" while inside the app
   may get stuck.** The gatekeeper finds no place to send them
   (`lib/roles.js:32-34`), and it is not the "disabled" case, so it shows
   "Redirecting to your dashboard..." with a spinner forever
   (`components/AuthRouteGate.jsx:77-78`). There is no Log Out button on that
   loading screen. On the phone, closing and reopening the app gets them out
   of this: they land on the landing page (`app/index.jsx:29-30`).

### Emergency alert

6. **(updated) The Dispatcher cannot see the resident's phone number or
   location in the app.** The resident is told "They will see your location
   and can call you back" (`app/resident-home.jsx:566`), "Dispatchers will
   see your name and phone number" (`app/resident-home.jsx:648`) and "can see
   where you are" (`app/resident-home.jsx:736`). But the dispatcher's pop-up
   only shows `residentName` (`app/dispatcher-home.jsx:668`). The saved
   `residentPhone` and `location` fields are not displayed anywhere I could
   find. The Admin call list shows `pickupLocation` only
   (`AdminCallSessionsSection.jsx:66`).
7. **The "Dispatcher could not accept" state can never happen.** The resident
   screen checks for `status === "declined"` (`app/resident-home.jsx:702`),
   but the dispatcher's Decline never sets that status. It only adds to
   `declinedBy` (`app/dispatcher-home.jsx:421-424`).
8. **Old alerts can ring forever.** If the resident closes or kills the app
   while an alert is ringing, nothing changes its status. Dispatchers keep
   getting it until someone answers it. The Admin screen only marks it as
   "stale" (`useAdminCallSessions.js:52`).
9. `latestRequestId` is saved on each alert (`app/resident-home.jsx:285`), but
   nothing reads it. The Admin alert list shows "Type:" using
   `emergencyType/serviceType` (`AdminCallSessionsSection.jsx:63`), which
   the resident never saves, so it always says "Not specified".
10. **(new) "Location: sending…" may take longer than 15 seconds.** The code
    comment says the location lookup finishes within 15 seconds
    (`app/resident-home.jsx:233-234`). But only the GPS reading has a 15-second
    limit (`useCurrentLocation.js:24-27`). Turning the coordinates into an
    address (`useCurrentLocation.js:33`) has no time limit. Unclear how long
    this can take on a real phone. The alert itself is not delayed, only the
    location line.

### Transport request

11. **No timeout when sending a request offline.** The emergency alert has a
    10-second limit, but `createResidentRequest` does not. Offline, the
    "Submit request" button may keep spinning for a long time
    (`ResidentRequestForm.jsx:56`). Unclear how long, because it depends on
    Firestore's offline behavior.
12. **Destination can get stuck.** If the resident picks Emergency → "No
    destination" and then switches the category to Community, the
    `destinationMode` stays "no-destination". That option is hidden for
    Community (`ResidentRequestForm.jsx:71`), and the text box only shows for
    "manual". The resident gets "Enter a destination…" with no box to type in,
    until they choose the destination dropdown again.
13. **The driver's map ignores the resident's pinned location.** The resident
    form saves the coordinates as `pickup.latitude/longitude`
    (`residentRequestService.js:39`). The driver's map only reads
    `pickupLatitude` or `latitude` (`app/driver-home.jsx:385-390`), so no
    pickup pin appears there. (The driver's "Open pickup" button **does** use
    the right field, `driverMissionMapper.js:15`.)
14. **(updated) The driver does not see the contact number, the assistance
    needs, the notes, or the passenger name** entered by the resident. I found
    no use of `contactNumber`, `vulnerableGroups`, `accessibilityNotes` or
    `passengerName` in `app/driver-home.jsx`. The driver's "Patient" line shows
    the resident's account name instead (`app/driver-home.jsx:716`, `778`). So
    if a resident books a ride for someone else, the driver sees the wrong
    name.
15. **Some Request Details fields are never filled in:** `assignedDriverPhone`,
    `driverContactNumber`, `dispatcherName`, `dispatcherOfficePhone`
    (`ResidentRequestDetails.jsx:17`, `24`). No code writes these to the
    request. The dispatcher's `officePhone` is passed to
    `assignDispatcherRequest` (`app/dispatcher-home.jsx:376`) but never saved.
    So the resident will always see "Contact is not available yet" and no
    dispatcher.
16. **A "Rejected" request status is displayed but never set.** The timeline
    and labels handle it (`requestMapper.js:9`, `60`), but no code sets a
    request to "Rejected".
17. **The timeline can be wrong after a driver declines.** A decline sets the
    request back to Pending, but it does not clear `assignedAt` or
    `acceptedAt` (`driverMissionService.js:71-81`). So "Driver assigned" may
    still show a check mark (`requestMapper.js:52`).
18. `submittingRef` in `ResidentRequestForm.jsx:31` is never set to `true`, so
    it does nothing. Double taps are still blocked, because the button is
    disabled while `saving` is true (`components/ui/AppButton.jsx:6`).
19. **A brand-new request may briefly show at the bottom of the list.**
    `createdAt` is a server time, and it is empty until the server confirms it,
    so the sort puts the request last (`useResidentRequests.js:8`, `34`,
    `requestMapper.js:42`). This could make "Latest Request" show an older
    request for a moment. Unclear how noticeable this is.
20. **(new) "Use current location" may fill in a barangay that is not in the
    list.** The GPS result's area name is used as the barangay
    (`useCurrentLocation.js:35`) and copied into the form
    (`ResidentRequestForm.jsx:41`). If that name does not exactly match one of
    the Toledo City barangays in the dropdown (`lib/barangays.js`), the
    dropdown may look empty while the form still accepts it. Unclear how often
    the phone's name matches the list.

### Home screen, profile and settings

21. **The "View Status" button often looks like it does nothing.** If the
    resident has any request at all, the panel always shows `latestRequest`
    and ignores what the button set (`app/resident-home.jsx:517-522`). For the
    same reason, the "Emergency alert sent" message
    (`app/resident-home.jsx:162-171`) is hidden for anyone who has made a
    request before.
22. **The "Settings updated successfully." message is never seen.** The
    Settings pop-up closes right after the message is set, and the message is
    cleared the next time it opens (`app/resident-home.jsx:450-451`, `173-179`).
23. **Changing the email:** `updateEmail` (`app/resident-home.jsx:420`) is
    rejected by newer Firebase projects that have "email enumeration
    protection" switched on. Unclear whether this project has it on. Also, if
    `updateEmail` works but the Firestore update fails, the login email and
    the profile email no longer match.
24. **The Address on the Profile pop-up is always "Not set" for new residents.**
    Sign Up never asks for an address (`app/signup.jsx:49-58`). Only an Admin
    can fill it in (`app/admin-home.jsx:620`).
25. Settings does not check the phone number format
    (`app/resident-home.jsx:406`).

### Sign Up

26. **Some sign-up errors show a confusing message.** "Weak password" and
    "email already used" are not in `getAuthErrorMessage` (`lib/session.js:42-63`).
    The resident sees "Check your connection and try again", which is
    misleading.
27. **Half-created accounts.** If the login account is created but saving the
    profile fails, the login account stays (`app/signup.jsx:64-73`). Signing
    up again with that email fails, and logging in shows "profile could not be
    found".
28. **Different password rules.** Sign Up has no minimum length in the app,
    Settings requires 6 (`app/resident-home.jsx:481`), and Apply to Drive
    requires 8 (`app/apply-to-drive.jsx:26`).

### App start, landing page and permissions

29. **(new) The app asks for notification permission, but never sends a
    notification.** `lib/permissions.js:21-36` is the only code that uses
    `expo-notifications`. Residents see this pop-up, but nothing in the app
    uses it yet.
30. **(new) The Terms of Service link is a placeholder.** It opens
    `https://example.com/sakayna-terms` (`constants/app.js:55-56`, used in
    `components/MobileLanding.jsx:54-56`). The landing page says "By
    continuing, you agree to SakayNa's Terms of Service"
    (`components/MobileLanding.jsx:212-217`), but there is no real page yet.
31. **(new) On the website, a logged-in resident is not sent to their home.**
    The phone app does this (`app/index.jsx:21-31`), but the website landing
    page (`app/index.jsx:33`) and the Log In page (`app/login.jsx`) never check
    who is already logged in. A resident who comes back to the website sees
    the landing page and must log in again, even though the browser still
    remembers them.

### Unclear

32. **(new) Opening the phone app with no internet.** When the login is
    remembered, the app still needs to read the profile from Firestore
    (`app/index.jsx:22-30`, `lib/session.js:116-138`). Without internet, the
    profile may not load. What the resident then sees depends on how Firestore
    behaves offline: probably the landing page, or "Account unavailable" with a
    "profile could not be found" message (`lib/session.js:119-124`,
    `components/AuthRouteGate.jsx:65-67`), which would be misleading. I could
    not confirm this from the code. It needs a test on a phone in airplane
    mode.
