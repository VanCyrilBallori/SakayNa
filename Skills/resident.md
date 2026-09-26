# Resident Role — What a Resident Can See and Do

Everything below comes from reading the code. Every claim has a file path
(and usually a line number) so you can check it. "Unclear" means I could not
confirm it from the code alone.

---

## 1. Overview

A resident is a regular person living in Toledo City who uses SakayNa to ask
for a ride. They can fill in a **transport request** (for example, a ride to
the hospital), send a one-tap **emergency alert** to the dispatchers, and
**follow the status** of their requests until a driver finishes the trip.
Residents create their own account through the Sign Up screen
(`app/signup.jsx`).

---

## 2. Screens

A resident only has **one real screen after login**: `app/resident-home.jsx`.
Everything else on the resident side is a **pop-up window** (called a
"modal") that opens on top of that screen.

### 2.1 Landing page — `app/index.jsx`

- **Sees:** the SakayNa welcome page.
- **Can tap:** "Log In" (`app/index.jsx:74`) and "Sign Up"
  (`app/index.jsx:77`). There is also a "Jobs" footer link that opens the
  driver application page (`app/index.jsx:158`). That page is for drivers,
  not residents (see section 5.4).

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
- **Other taps:** back arrow → landing page (`app/signup.jsx:84`);
  "Already have an account? Log In" → login (`app/signup.jsx:178`).

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

### 2.5 Resident Home (dashboard) — `app/resident-home.jsx`

Before this screen appears, a "gatekeeper" component checks the user
(`components/AuthRouteGate.jsx`, see section 4.1).

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
   (`app/resident-home.jsx:694-798`):

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
   "Call" buttons open the phone's dialer (`app/resident-home.jsx:396-398`).

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
  **Confirm pin**.
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
| `handleSignup` | `app/signup.jsx:30` | Creates the login account and a Resident profile in Firestore. |
| `refreshVerificationStatus` | `app/verify-email.jsx:25` | Asks Firebase again whether the email is verified. |
| `handleResend` | `app/verify-email.jsx:54` | Sends another verification email, then waits 60 seconds before allowing another. |
| `handleLogin` | `app/login.jsx:30` | Signs in, reads the profile, and sends the user to the correct home screen. |
| `handlePasswordReset` | `app/login.jsx:58` | Sends a password reset email. |
| `useCurrentUserProfile` | `lib/session.js:91` | Keeps watching who is logged in and their `users/{uid}` profile, live. |
| `getPostAuthenticationRoute` | `lib/roles.js:27` | Decides which screen a user may go to, based on role and account status. |
| `isDisabledProfile` | `lib/roles.js:7` | Returns true only when `accountStatus` is `"Deactivated"`. |
| `AuthRouteGate` | `components/AuthRouteGate.jsx:10` | The "gatekeeper" that blocks protected screens unless the user is allowed. |
| `logoutCurrentUser` | `lib/session.js:65` | Signs the user out of Firebase. |
| `handleQuickAction` | `app/resident-home.jsx:202` | Runs the right action when one of the three dashboard cards is tapped. |
| `sendEmergencyAlert` | `app/resident-home.jsx:314` | Starts an emergency alert: opens the pop-up, saves the alert, and looks up the GPS. |
| `writeAlert` | `app/resident-home.jsx:269` | Saves the alert to `callSessions`, with a 10-second "not confirmed" limit. |
| `attachAlertLocation` | `app/resident-home.jsx:235` | Adds the GPS location to an alert that was already sent. |
| `retryEmergencyAlert` | `app/resident-home.jsx:349` | Sends the same alert again, using the same ID. |
| `closeEmergencyAlert` | `app/resident-home.jsx:355` | Marks the alert cancelled or ended, then resets the pop-up. |
| `handleAlertBack` | `app/resident-home.jsx:382` | Asks "Cancel your emergency alert?" before closing an alert that is still live. |
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
  screens are "protected" (`components/AuthRouteGate.jsx:8`). If the user is
  not logged in, they are sent to `/login` (`AuthRouteGate.jsx:24-27`).
- **The profile must exist**, or the user sees "Account unavailable" with Retry
  and Log Out buttons (`AuthRouteGate.jsx:51-53`).
- **The role must be one of Resident / Driver / Dispatcher / Admin**, or the
  user sees "Invalid role" (`AuthRouteGate.jsx:55-57`, `lib/roles.js:5`).
- **Right screen for the role:** if a resident tries to open another role's
  screen, the gatekeeper sends them back to `/resident-home`
  (`AuthRouteGate.jsx:34-36`, `lib/roles.js:12-25`).
- **Account status** (`lib/roles.js:7`, `lib/roles.js:27-41`):

  | `accountStatus` | What happens to a resident |
  |---|---|
  | `Active` (set at signup) | Allowed in |
  | `Approved` | Allowed in |
  | `Deactivated` | Blocked: login shows an error; if already inside, they see "Account disabled" |
  | `Pending` or `Rejected` | Login is refused (`app/login.jsx:44-47`); if already inside, see section 6 |
  | `Suspended` or `Disabled` | **Not blocked**, see section 6 |

- The profile is watched **live** (`lib/session.js:116`), so a status change by
  an Admin affects an open app right away.
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
| `systemSettings/operational` | **read** only (for the office phone) | `firestore.rules:122-125` |
| `driverAssignments`, `vehicles`, `driverSchedules`, `vehicleChecklists`, `activityLogs`, other `systemSettings` | **no access** | `firestore.rules:69-129` |
| everything else | **no access** | `firestore.rules:132-134` |

### 4.5 Bans and suspensions

- Only an **Admin** can change a resident's account status, using
  `changeAccountStatus` (`features/admin/services/adminOperationsService.js:114`)
  in the Admin Operations panel (`features/admin/components/AdminOperationsPanel.jsx:212-213`).
  The Admin must type a reason of at least 3 characters.
- **"Deactivated" is the only status that the app really treats as a ban**
  (`lib/roles.js:7`). The Admin screen says so too: "Use Deactivated status
  above to revoke access today" (`AdminOperationsPanel.jsx:218`).
- Deactivating **does not disable the Firebase login account itself**
  (`AdminOperationsPanel.jsx:210`). It only changes the Firestore profile.
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
  sees "Dispatcher accepted" and a Call button.
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
   blocked by the app screens (`components/AuthRouteGate.jsx`). The database
   itself would still accept their writes (`firestore.rules:61`, `92`).
5. **A resident set to "Pending" or "Rejected" while logged in may get stuck.**
   The gatekeeper finds no place to send them (`lib/roles.js:32-34`), and it
   is not the "disabled" case, so it shows "Redirecting to your dashboard..."
   with a spinner forever (`components/AuthRouteGate.jsx:63-64`). There is no
   Log Out button on that loading screen.

### Emergency alert

6. **The Dispatcher cannot see the resident's phone number or location in the
   app.** The resident is told "Dispatchers will see your name and phone
   number" and "can see where you are" (`app/resident-home.jsx:648`, `736`).
   But the dispatcher's pop-up only shows `residentName`
   (`app/dispatcher-home.jsx:668`). The saved `residentPhone` and `location`
   fields are not displayed anywhere I could find. The Admin call list shows
   `pickupLocation` only.
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
   `emergencyType/serviceType` (`AdminCallSessionsSection.jsx:61-62`), which
   the resident never saves, so it always says "Not specified".

### Transport request

10. **No timeout when sending a request offline.** The emergency alert has a
    10-second limit, but `createResidentRequest` does not. Offline, the
    "Submit request" button may keep spinning for a long time
    (`ResidentRequestForm.jsx:56`). Unclear how long, because it depends on
    Firestore's offline behavior.
11. **Destination can get stuck.** If the resident picks Emergency → "No
    destination" and then switches the category to Community, the
    `destinationMode` stays "no-destination". That option is hidden for
    Community (`ResidentRequestForm.jsx:71`), and the text box only shows for
    "manual". The resident gets "Enter a destination…" with no box to type in,
    until they choose the destination dropdown again.
12. **The driver's map ignores the resident's pinned location.** The resident
    form saves the coordinates as `pickup.latitude/longitude`
    (`residentRequestService.js:39`). The driver's map only reads
    `pickupLatitude` or `latitude` (`app/driver-home.jsx:385-390`), so no
    pickup pin appears there. (The driver's "Open pickup" button **does** use
    the right field, `driverMissionMapper.js:15`.)
13. **The driver does not see the contact number, the assistance needs or the
    notes** entered by the resident. I found no use of `contactNumber`,
    `vulnerableGroups` or `accessibilityNotes` in `app/driver-home.jsx`.
14. **Some Request Details fields are never filled in:** `assignedDriverPhone`,
    `driverContactNumber`, `dispatcherName`, `dispatcherOfficePhone`
    (`ResidentRequestDetails.jsx:24`). No code writes these to the request.
    The dispatcher's `officePhone` is passed to `assignDispatcherRequest`
    (`app/dispatcher-home.jsx:376`) but never saved. So the resident will
    always see "Contact is not available yet" and no dispatcher.
15. **A "Rejected" request status is displayed but never set.** The timeline
    and labels handle it (`requestMapper.js:9`, `60`), but no code sets a
    request to "Rejected".
16. **The timeline can be wrong after a driver declines.** A decline sets the
    request back to Pending, but it does not clear `assignedAt` or
    `acceptedAt` (`driverMissionService.js:71-81`). So "Driver assigned" may
    still show a check mark (`requestMapper.js:52`).
17. `submittingRef` in `ResidentRequestForm.jsx:31` is never set to `true`, so
    it does nothing. Double taps are still blocked, because the button is
    disabled while `saving` is true (`components/ui/AppButton.jsx:6`).
18. **A brand-new request may briefly show at the bottom of the list.**
    `createdAt` is a server time, and it is empty until the server confirms it,
    so the sort puts the request last (`useResidentRequests.js:8`, `34`). This
    could make "Latest Request" show an older request for a moment. Unclear
    how noticeable this is.

### Home screen, profile and settings

19. **The "View Status" button often looks like it does nothing.** If the
    resident has any request at all, the panel always shows `latestRequest`
    and ignores what the button set (`app/resident-home.jsx:517-522`). For the
    same reason, the "Emergency alert sent" message
    (`app/resident-home.jsx:162-171`) is hidden for anyone who has made a
    request before.
20. **The "Settings updated successfully." message is never seen.** The
    Settings pop-up closes right after the message is set, and the message is
    cleared the next time it opens (`app/resident-home.jsx:450-451`, `173-179`).
21. **Changing the email:** `updateEmail` (`app/resident-home.jsx:420`) is
    rejected by newer Firebase projects that have "email enumeration
    protection" switched on. Unclear whether this project has it on. Also, if
    `updateEmail` works but the Firestore update fails, the login email and
    the profile email no longer match.
22. **The Address on the Profile pop-up is always "Not set" for new residents.**
    Sign Up never asks for an address (`app/signup.jsx:49-58`). Only an Admin
    can fill it in (`app/admin-home.jsx:620`).
23. Settings does not check the phone number format
    (`app/resident-home.jsx:406`).

### Sign Up

24. **Some sign-up errors show a confusing message.** "Weak password" and
    "email already used" are not in `getAuthErrorMessage` (`lib/session.js:42-63`).
    The resident sees "Check your connection and try again", which is
    misleading.
25. **Half-created accounts.** If the login account is created but saving the
    profile fails, the login account stays (`app/signup.jsx:64-73`). Signing
    up again with that email fails, and logging in shows "profile could not be
    found".
26. **Different password rules.** Sign Up has no minimum length in the app,
    Settings requires 6 (`app/resident-home.jsx:481`), and Apply to Drive
    requires 8 (`app/apply-to-drive.jsx:26`).

### Unclear

27. **Does the resident stay logged in after closing the app?** The landing
    page (`app/index.jsx`) and the login page do not send an already-logged-in
    user to their home screen. `firebase.jsx:24` uses `getAuth(app)` without
    choosing where to save the login. I could not confirm from the code
    whether the login survives an app restart on a phone.
