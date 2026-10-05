# SakayNa

SakayNa is an Expo / React Native transport-coordination app for Toledo City. It has
separate **Resident**, **Driver**, **Dispatcher**, and **Admin** workflows, built on
**Firebase Authentication** and **Cloud Firestore**.

The app talks to Firestore directly. There is no separate backend server to run or deploy.

- **Live website:** <https://sakay-na-delta.vercel.app>
- **Full feature description** (who uses it, what each role can do): [`PRODUCT.md`](PRODUCT.md)

## Technology

- Expo (SDK 54) + Expo Router, React Native, JavaScript/JSX
- Firebase Authentication (email/password and Google sign-in)
- Cloud Firestore (database + realtime updates)
- Cloudinary unsigned uploads — for the resident's proof-of-residency photo and the driver's document photos
- Leaflet + OpenStreetMap maps (free, no API key)

## Prerequisites

- **Node.js 20 LTS or 22 LTS** (Expo 54 does not officially support Node 23/24 — use nvm if needed)
- npm
- A Google account for the free Firebase console
- A browser (for the web build) and/or an Android phone with the SakayNa **development build**
  (made with EAS, `development` profile in `eas.json`). Expo Go is not enough: Google sign-in and
  direct phone calls need the development build.

You do **not** need: the Firebase CLI, Java, the Firebase emulator, or a billing/Blaze plan.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Firebase project

1. Go to <https://console.firebase.google.com> and create a project (stay on the free Spark plan).
2. Add a **Web app** and copy its config values.
3. **Authentication → Sign-in method →** enable **Email/Password** and **Google**. Copy the
   Google provider's **Web client ID** (used in `.env` below). For Google sign-in on Android, the
   app's SHA-1 fingerprint must also be added to the Android app in the Firebase project settings.
4. **Firestore Database → Create database → Production mode →** choose a location (permanent).
5. **Firestore → Rules tab →** paste the contents of [`firestore.rules`](firestore.rules) and click **Publish**.

### 3. Create `.env`

Create a file named `.env` in the project root with these 10 values:

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=<project-id>
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...   (copy it from the Firebase config; new projects use <project-id>.firebasestorage.app)
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=...
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=...
```

The Cloudinary values are needed for resident registration and driver applications (photo uploads).
Restart the dev server after creating or editing `.env`. The same values must also be saved in
expo.dev (for EAS builds) and in Vercel (for the website), because `.env` is never uploaded.

### 4. Seed accounts and one vehicle

In the Firebase console, for each test user: **Authentication → Add user** (email + password),
copy its **UID**, then create a Firestore document at `users/{that-UID}`:

| Document | Fields |
| --- | --- |
| `users/{admin}` | `role: "Admin"`, `accountStatus: "Active"`, `fullName`, `email`, `barangay`, `createdAt` |
| `users/{dispatcher}` | `role: "Dispatcher"`, `accountStatus: "Active"`, `fullName`, `email`, `createdAt`, and optional `phoneNumber` (the number a resident's phone calls after an emergency alert; without it: `operationalPhone`, then the office number) |
| `users/{resident}` | `role: "Resident"`, `accountStatus: "Active"`, `fullName`, `email`, `barangay`, `phone`, `phoneNumber`, `createdAt` |
| `users/{driver}` | `role: "Driver"`, `accountStatus: "Approved"`, `fullName`, `email`, `barangay`, `createdAt` |

Each Admin reviews only the residents and drivers of **their own barangay**, so every Admin needs a
`barangay` (spelled exactly like the list in `lib/barangays.js`). New residents and drivers don't need
seeding: they sign up in the app and wait as `Pending` until that barangay's Admin approves them.

Then one vehicle at `vehicles/{auto-id}`:

`name: "City Ambulance 1"`, `type: "Ambulance"`, `plateNumber: "ABC 1234"`,
`ownerType: "City/Barangay Vehicle"`, `status: "Available"`, `createdAt`

(The `users/{uid}` document ID must exactly match the Authentication UID.)

**`createdAt` must be added with Firestore's `timestamp` type** (not string or number). The Admin
console orders these collections by `createdAt`, and Firestore silently excludes documents that are
missing the field — a seeded account without it will not appear in the Admin dashboard at all.

### 5. Run

```bash
npx expo start
```

Press `w` for the browser, or open the SakayNa development build on the phone and scan the QR code
(phone on the same Wi-Fi).

## Roles and routes

| Role | Profile state | Lands on |
| --- | --- | --- |
| Resident | `accountStatus: "Active"` | `/resident-home` |
| Resident | `Pending` / `Rejected` | `/resident-home`, with a banner; cannot send emergency alerts or transport requests |
| Anyone | signed in, no profile yet | `/choose-role` (Resident or Driver form) |
| Driver | `Pending` / `Rejected` | `/driver-status` |
| Driver | `Approved` | `/driver-home` |
| Dispatcher | `accountStatus: "Active"` | `/dispatcher-home` |
| Admin | `accountStatus: "Active"` | `/admin-home` |

## Firestore collections

| Collection | Purpose |
| --- | --- |
| `users` | Profiles, roles, account state. Drivers also have their duty status (`dutyStatus`: Off duty, Available, On break, On a run) and `presence` (is the app open) |
| `transportRequests` | Resident transport requests. `purpose`: Medical / Health, Community / Personal Trip, or Other. `timing`: `asap` or `scheduled` (with `scheduledFor`, 1 hour to 7 days ahead). Emergencies use `callSessions`, not this form. A dispatcher can also create one from an emergency alert they answered (Emergency request form: `requestType: "Emergency Request"`, `emergencyType`, `emergencyAlertId`, `createdBy`; firestore.rules checks the alert). |
| `driverAssignments` | Dispatcher-to-driver assignments. Status Assigned, In Progress, Completed, Cancelled, or Unable (the driver sent "I can't do this ride": an inability report with the reason, shown to the dispatcher and in the admin's Duty Records). Old "Declined" ones are kept (older APKs can still decline) |
| `dutyRecords` | Driver time card lines: punch in / out, break start / end, run start / end, with Firestore's time. Never edited or deleted. The admin's Duty Records (DTR) are worked out from these |
| `driverLocations` | One document per driver (id = their uid): last known location (`latitude`, `longitude`, `step`, `at`), saved only when the driver taps Punch in, Accept, En route, Arrived or Picked up. Each step replaces it; Punch out erases it. Only dispatchers can read it (for "Show on map") |
| `callSessions` | In-app emergency alerts (the red Emergency button). After the dispatcher submits the Emergency request form: `linkedRequestId`, `linkedRequestReference`, `emergencyType` |
| `residentVerifications` | Resident proof-of-residency photo link, for the barangay Admin's review |
| `Driver_Applications` | Driver applications + document photo links, for the barangay Admin's review |
| `vehicles` | City and barangay vehicle records (drivers do not register vehicles) |
| `driverSchedules` | Old driver work-hours windows. No longer used by the app since the duty status (Oct 2026); kept |
| `vehicleChecklists` | Old pre-trip vehicle checks. No longer asked before Accept since the driver home restyle (Oct 2026); kept |
| `activityLogs`, `vehicleMaintenance`, `staffInvitations`, `deletionRequests`, `systemSettings` | Admin bookkeeping |

Centralized names, roles, statuses, and priorities live in [`constants/app.js`](constants/app.js).

## Verify it works

1. Landing page loads with no red error box; browser console has no permission errors.
2. Each seeded account logs in and reaches the correct dashboard.
3. **Resident approval:** a new resident signs up (email → verify email → Resident → proof photo)
   → the Admin of the same barangay approves them in **Resident Verification** → the resident's
   banner disappears.
4. **Full flow:** Resident taps **Request a Ride** and sends a request → Dispatcher assigns a
   driver + vehicle → Driver runs the mission (Accept → En Route → Arrived → Picked Up →
   Complete) → Resident sees it "Completed" → Admin Overview count increases.
5. **Emergency alert:** Resident taps **Emergency** → Send alert → Dispatcher "Answer" →
   "Dispatcher accepted" and the call countdown on the resident's phone → the Dispatcher fills in
   the **Emergency request form** (driver + vehicle) → Submit → the resident's "Your ride" card
   shows the driver, and the driver gets the ride → end.
6. **Driver approval:** a new driver applies (Choose Role → Driver) → the Admin of the same
   barangay approves them in **Driver Applications** → the driver can reach `/driver-home`.
7. **Driver can't do a ride:** Dispatcher assigns → Driver taps **I can't do this ride** (before
   the pickup) and chooses a reason → the ride is back in the dispatcher's list with an orange
   "Needs a new driver" banner and a warning on that driver's card → Dispatcher assigns another
   driver → Admin sees the report in **Duty Records** → Inability reports.

## Deploying

Commit and test first (`git status` must be clean). The exact step-by-step commands are in
[`CLAUDE.md`](CLAUDE.md).

- **Website (Vercel):** Vercel builds the website from the `main` branch. Work happens on `master`,
  so copy `master` onto `main` (fast-forward) and push `main`. Everything on `master` goes live.
- **Android preview APK:** `eas build --profile preview --platform android`. Testers uninstall the
  old app and install the new APK.
- **Firestore rules:** after any change to `firestore.rules`, publish it — either paste it into
  **Firestore → Rules → Publish** in the Firebase console, or run
  `firebase deploy --only firestore:rules --project <project-id>` (needs the Firebase CLI). Rules go
  live right away, for every app version at once.

## Notes

- Test only with a non-production Firebase project. Never commit `.env`.
- There is no Cloud Functions backend. The old `functions/` folder was removed.
- Deactivating a user sets a flag in Firestore; it does not disable their Firebase Auth login.
- Proof-of-residency and driver document photos uploaded via Cloudinary are served from public
  URLs — use only sample documents, not real IDs.
- Known problems are listed in [`Known-Issue.md`](Known-Issue.md).
