# SakayNa

SakayNa is an Expo / React Native transport-coordination app for Toledo City. It has
separate **Resident**, **Driver**, **Dispatcher**, and **Admin** workflows, built on
**Firebase Authentication** and **Cloud Firestore**.

The app talks to Firestore directly. There is no separate backend server to run or deploy.

## Technology

- Expo (SDK 54) + Expo Router, React Native, JavaScript/JSX
- Firebase Authentication (email/password)
- Cloud Firestore (database + realtime updates)
- Cloudinary unsigned uploads — only for the optional "Apply to Drive" document upload

## Prerequisites

- **Node.js 20 LTS or 22 LTS** (Expo 54 does not officially support Node 23/24 — use nvm if needed)
- npm
- A Google account for the free Firebase console
- A browser (for the web build) and/or the **Expo Go** app on a phone

You do **not** need: the Firebase CLI, Java, the Firebase emulator, or a billing/Blaze plan.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Firebase project

1. Go to <https://console.firebase.google.com> and create a project (stay on the free Spark plan).
2. Add a **Web app** and copy its config values.
3. **Authentication → Sign-in method →** enable **Email/Password**.
4. **Firestore Database → Create database → Production mode →** choose a location (permanent).
5. **Firestore → Rules tab →** paste the contents of [`firestore.rules`](firestore.rules) and click **Publish**.

### 3. Create `.env`

Copy `.env.example` to `.env` in the project root and fill in the Firebase Web app values:

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=<project-id>
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=<project-id>.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

`EXPO_PUBLIC_CLOUDINARY_*` is optional — only needed to test the driver document upload form.
Restart the dev server after creating or editing `.env`.

### 4. Seed accounts and one vehicle

In the Firebase console, for each test user: **Authentication → Add user** (email + password),
copy its **UID**, then create a Firestore document at `users/{that-UID}`:

| Document | Fields |
| --- | --- |
| `users/{admin}` | `role: "Admin"`, `accountStatus: "Active"`, `fullName`, `email` |
| `users/{dispatcher}` | `role: "Dispatcher"`, `accountStatus: "Active"`, `fullName`, `email` |
| `users/{resident}` | `role: "Resident"`, `accountStatus: "Active"`, `fullName`, `email`, `barangay`, `phone`, `phoneNumber` |
| `users/{driver}` | `role: "Driver"`, `accountStatus: "Approved"`, `fullName`, `email`, `barangay` |
| `users/{pendingDriver}` | `role: "Driver"`, `accountStatus: "Pending"`, `fullName`, `email` |

Then one vehicle at `vehicles/{auto-id}`:

`name: "City Ambulance 1"`, `type: "Ambulance"`, `plateNumber: "ABC 1234"`,
`ownerType: "City/Barangay Vehicle"`, `status: "Available"`

(The `users/{uid}` document ID must exactly match the Authentication UID.)

### 5. Run

```bash
npx expo start
```

Press `w` for the browser, or scan the QR code with Expo Go (phone on the same Wi-Fi).

## Roles and routes

| Role | Profile state | Lands on |
| --- | --- | --- |
| Resident | `accountStatus: "Active"` | `/resident-home` |
| Driver | `Pending` / `Rejected` | `/driver-status` |
| Driver | `Approved` | `/driver-home` |
| Dispatcher | `accountStatus: "Active"` | `/dispatcher-home` |
| Admin | `accountStatus: "Active"` | `/admin-home` |

## Firestore collections

| Collection | Purpose |
| --- | --- |
| `users` | Profiles, roles, account state, driver presence |
| `transportRequests` | Resident transport requests |
| `driverAssignments` | Dispatcher-to-driver assignments |
| `callSessions` | In-app emergency call signaling |
| `Driver_Applications` | Driver applications + uploaded document URLs |
| `vehicles` | City and driver-owned vehicle records |
| `driverSchedules` | Driver availability windows |
| `vehicleChecklists` | Pre-trip vehicle readiness checks |
| `activityLogs`, `vehicleMaintenance`, `staffInvitations`, `deletionRequests`, `systemSettings` | Admin bookkeeping |

Centralized names, roles, statuses, and priorities live in [`constants/app.js`](constants/app.js).

## Verify it works

1. Landing page loads with no red error box; browser console has no permission errors.
2. Each seeded account logs in and reaches the correct dashboard.
3. **Full flow:** Resident submits a request → Dispatcher assigns a driver + vehicle →
   Driver runs the mission (checklist → Accept → En Route → Arrived → Picked Up → Complete) →
   Resident sees it "Completed" → Admin Overview count increases.
4. **Emergency call:** Resident "Open Emergency Call" → Dispatcher "Answer" → connected → end.
5. **Approval:** Admin (Operations → Applications) approves the Pending driver → that account
   can then log in and reach `/driver-home`.

## Notes

- Test only with a non-production Firebase project. Never commit `.env`.
- The `functions/` folder is a previous Cloud Functions backend that is **no longer used** and
  is not required to run or deploy the app. It can be deleted.
- Deactivating a user sets a flag in Firestore; it does not disable their Firebase Auth login.
- Driver document images uploaded via Cloudinary are served from public URLs — use only
  sample documents, not real IDs.
