# Phase 8 Trusted Backend

## Local development

1. Install Node.js 22 LTS and the Firebase CLI: `npm install -g firebase-tools`.
2. From `functions`, run `npm install`.
3. Authenticate only when you intend to use Firebase tooling: `firebase login`.
4. Start the isolated local suite from the repository root: `firebase emulators:start --project demo-sakayna --only auth,firestore,functions`.
5. Set `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=true` in a local Expo `.env` before launching the app. Do not use that value for production builds.
6. Run backend checks: `cd functions && npm run lint && npm test`.

The repository intentionally has no `.firebaserc`; select production projects explicitly with `--project` to avoid accidental deployment.

## Claims and token refresh

Trusted Functions set compact claims: normalized `role`, allowlisted `permissions`, optional `serviceAreas`, `accountActive`, and `claimsVersion`. The Expo helper refreshes the signed-in user's ID token after a callable response includes `refreshToken: true`. Sign out/in is a safe fallback after an administrator changes another user's role or scope.

## Data retention

`processUserDeletion` deletes the Firebase Authentication account, anonymizes the Firestore profile, and retains requests, assignments, maintenance, and trusted audit references. This is an operational retention policy, not a legal-compliance statement. Review retention periods and privacy obligations with the organization before production use.

## Deployment order

1. Run emulator tests against `demo-sakayna`.
2. Review `firebase.json`, Firestore rules, and indexes.
3. Select the intended Firebase project: `firebase use --add` or pass `--project YOUR_PROJECT_ID`.
4. Deploy indexes first: `firebase deploy --only firestore:indexes --project YOUR_PROJECT_ID`.
5. Deploy Functions: `firebase deploy --only functions --project YOUR_PROJECT_ID`.
6. Verify callable functions in Firebase Console and with non-production role accounts.
7. Deploy hardened rules only after all required client releases use callable operations: `firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`.

Do not run a production deploy until every role has been tested. Cloud Functions deployment generally requires a Firebase billing-enabled project. No service-account JSON is needed in deployed Functions; Firebase uses application default credentials.

## Rollback

If a callable workflow fails after deployment, first stop exposing its UI action or roll the client back, then redeploy the previous reviewed Functions revision. Do not weaken Firestore rules as an emergency workaround. Keep the prior Function source tag available for a deliberate rollback.

## Remaining Phase 8 migration items

Schedule creation and updates remain on their existing client workflow until a dedicated trusted schedule function is integrated. Cloudinary uploads are outside Firebase Storage rules; restrict the Cloudinary unsigned preset and migrate private-document storage to a trusted provider before treating document URLs as private.
