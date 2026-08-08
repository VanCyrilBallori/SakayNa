# SakayNa

SakayNa is an Expo and React Native transport coordination application for Toledo City. It supports separate Resident, Driver, Dispatcher, and Admin workflows using Firebase Authentication and Cloud Firestore.

## Technology

- React Native and Expo Router
- JavaScript / JSX
- Firebase Authentication and Cloud Firestore
- Cloudinary unsigned uploads for driver application documents

## Prerequisites

- Node.js 20 LTS or newer
- npm
- An Expo-compatible Android/iOS device or emulator for mobile testing
- A Firebase project with Authentication and Firestore enabled
- A Cloudinary account and unsigned upload preset when driver document uploads are used

## Installation

```bash
npm install
copy .env.example .env
npm run start
```

For web development, run:

```bash
npm run web
```

For validation:

```bash
npm run lint
npx expo export --platform web
```

## Environment variables

Create a local `.env` from `.env.example`. The `.env` file is ignored by Git and must never be committed.

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase web app API key |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase authentication domain |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket name |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging sender ID |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase web app ID |
| `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` | Optional Firebase Analytics measurement ID |
| `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name for driver uploads |
| `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary unsigned upload preset |

`EXPO_PUBLIC_*` values are bundled into the client app. Do not place Firebase service-account files, private keys, admin credentials, or Cloudinary API secrets in this project.

## Firebase setup

1. Create or select the Firebase project.
2. Add a Web app and copy its public configuration into `.env`.
3. Enable Email/Password in Firebase Authentication.
4. Create a Cloud Firestore database.
5. Publish the project `firestore.rules` from Firebase Console or Firebase CLI.
6. Create the initial Admin user and its `users/{uid}` profile through a trusted setup process. Client code must not create privileged Admin or Dispatcher accounts.

## Roles and profiles

Each authenticated user requires a corresponding `users/{uid}` document.

| Role | Required profile state | Primary route |
| --- | --- | --- |
| `Resident` | `accountStatus: Active` | `/resident-home` |
| `Driver` | `accountStatus: Pending`, `Rejected`, or `Approved` | `/driver-status` or `/driver-home` |
| `Dispatcher` | Staff profile | `/dispatcher-home` |
| `Admin` | Staff profile | `/admin-home` |

An approved driver must have `role: "Driver"` and `accountStatus: "Approved"` before being assigned to active transport work.

## Firestore collections

| Collection | Purpose |
| --- | --- |
| `users` | User profiles, roles, account state, and driver presence |
| `transportRequests` | Resident transport requests |
| `driverAssignments` | Dispatcher-to-driver request assignments |
| `callSessions` | Resident emergency call requests for dispatchers |
| `Driver_Applications` | Pending driver applications and uploaded document URLs |
| `vehicles` | City and driver-owned vehicle records |
| `driverSchedules` | Driver availability and shift schedules |

The centralized names, roles, request statuses, priorities, and account states are in `constants/app.js`.

## Test accounts

Use separate Email/Password accounts in a non-production Firebase project. Create a matching `users/{uid}` document for each account:

| Account | `role` | `accountStatus` | Expected result |
| --- | --- | --- | --- |
| Resident test | `Resident` | `Active` | Resident dashboard |
| Pending Driver test | `Driver` | `Pending` | Driver status page |
| Approved Driver test | `Driver` | `Approved` | Driver dashboard |
| Dispatcher test | `Dispatcher` | `Active` | Dispatcher dashboard |
| Admin test | `Admin` | `Active` | Admin dashboard |

Never share real user passwords in source code, documentation, screenshots, or commits.

## Firestore indexes

The currently observed Firestore queries use single-field filters for requests, drivers, assignments, and calls. Firestore automatically provides single-field indexes by default. No composite index is currently required by the checked queries.

If Firebase reports a missing-index error after a future query change, open the link in the Firebase error, create the suggested composite index, and record it in this section with the collection, fields, and sort direction.

## Firestore rules and deployment

Review and publish `firestore.rules` before testing production-like data. Firebase Console document edits bypass client security rules, so rule testing must be done through the app or the Firebase Emulator Suite.

If Firebase CLI is configured:

```bash
firebase deploy --only firestore:rules
```

No Firebase CLI configuration is included in this repository yet. Adding `firebase.json`, emulator configuration, and deployment automation is a future phase.

## Deployment checklist

1. Run `npm run lint`.
2. Run `npx expo export --platform web`.
3. Confirm `.env` is ignored by Git with `git check-ignore .env`.
4. Confirm Firebase Authentication Email/Password is enabled.
5. Publish reviewed Firestore rules.
6. Test each role with separate non-production accounts.
7. Verify Cloudinary's upload preset is restricted to the intended upload use case.
8. Do not deploy any private key, service-account credential, or production user password.
## Authentication and email verification

SakayNa verifies dashboard access using both Firebase Authentication and the current `users/{uid}` Firestore profile. Local browser storage is never used as proof of a user's role, approval, or account state.

New Resident and Driver email/password accounts receive a Firebase verification email and are shown the `/verify-email` screen. The screen reloads the Firebase user before checking verification status and supports resend with a 60-second cooldown.

Email verification is not enforced for dashboard access in this phase. This temporary exemption preserves existing Admin, Dispatcher, approved Driver, and demo accounts that may not have verified emails. Before enforcing it later, verify or migrate existing accounts in Firebase Authentication and test each role in a non-production project.

## Phase 2 Firestore rule update

Publish the updated `firestore.rules`. Ordinary users can now update only basic profile and presence fields. They cannot change role, account status, approval fields, vehicle ownership preferences, or other administrative fields. Creating or approving privileged accounts still requires a trusted administrative workflow; client code must not be used to grant Admin or Dispatcher access.


## Phase 8 backend

Trusted callable Function setup, emulator use, deployment safety, token refresh, and retention behavior are documented in [docs/PHASE_8_BACKEND.md](docs/PHASE_8_BACKEND.md). Do not deploy Functions or hardened rules until all roles have completed emulator testing.
