# Login Overhaul Plan (Android + website)

## Done so far
1. Slide-up "Get Started" sheet UI — DONE
2. Google sign-in (new EAS build) — DONE
   - New Google user (no profile) → logged out + "coming soon" message
     (Phase 3 replaces this with role choice + registration)

## Goal (Phase 3, updated 2026-09-28)
"Get Started" sheet on the phone:
- Continue with Google
- divider "or"
- Sign up with Email   (was "Continue with Mobile Number") → opens registration
- small link: "Already have an account? Log in with email"
- Facebook button removed.

Registration always starts with "Are you a Resident or a Driver?"
- Email path:  choose role → email + password → verify email → role form
- Google path: Google → (new user) choose role → role form (no email/password)
- Existing accounts log in like before.

## Decisions
- Must cost nothing. Keep Cloudinary for photos.
- Keep email/password login for the website and staff.
- Phone-number login is cancelled (old Phase 4). Facebook is cancelled.
- Status words: keep the words already saved in Firestore, show friendlier
  names on screen. Existing residents are "Active", so they count as
  Verified with no data changes.

  | Saved (accountStatus) | Resident sees        | Driver sees       |
  |-----------------------|----------------------|-------------------|
  | Pending               | Pending Verification | Pending Review    |
  | Active                | Verified Resident    | -                 |
  | Approved              | -                    | Verified Driver   |
  | Rejected              | Rejected + reason    | Rejected + reason |

- A new profile needs a verified email (Google counts as verified).
  Enforced in firestore.rules.
- Document links are saved ONLY in Driver_Applications/{uid} and
  residentVerifications/{uid}. Only the owner and their barangay's admin
  can read those. Never in users/{uid}, because dispatchers can read users.
- Each admin sees and reviews only their own barangay (residents AND
  drivers). No city-wide admin. Each admin profile needs a barangay.
- Barangay is locked after sign-up. Only an admin can change it.
- Photos only (no PDFs). Camera or gallery (expo-image-picker).
  Photos are shrunk on the phone before upload (about 1600px, JPEG).
- Documents are kept after approval. An admin deletes them by hand in
  the Cloudinary dashboard if needed.
- Pending/Rejected residents can log in, but cannot send emergency alerts
  or transport requests (blocked in the app AND in firestore.rules).
- SakayNa does not replace 911 (Terms of Service).
- No face scans, no automatic ID checks. An admin looks at the photo.
- Drivers: no vehicle info, OR/CR, own-vehicle option, or operator
  documents. Vehicles belong to the barangay.
- Old driver accounts, driver applications and driver-owned vehicles are
  test data. Delete them by hand in the Firebase Console (step 10).
- New screens are light mode (white background, SakayNa green buttons).
  The landing page, Get Started sheet and Choose Role are always light.

## Resident registration form
- Full Name, Phone Number, Barangay, Address (house no. / street / purok)
  (Phone stays: emergency alerts already send it so dispatchers can call.)
- 1 proof-of-residency photo + what it is: Barangay Certificate of
  Residency / Barangay ID / other government document with address
- Submit → Pending → admin of the SAME barangay approves (Active) or
  rejects with a reason → resident uploads a new proof → Pending again.

## Driver application form
- Full Name, Date of Birth (must be 18 or older), Contact Number,
  Barangay, Address, Profile Picture
- Professional Driver's License: front photo, back photo, number,
  expiration date
- NBI Clearance OR Police Clearance (pick one, 1 photo)
- Medical Certificate (1 photo)
- Drug Test Clearance (optional, 1 photo)
- Checkbox: "The information I gave is true, and I allow SakayNa admins
  to review these documents."
- Submit → Pending → admin of the SAME barangay approves, or rejects with
  a reason → driver fixes it and resubmits → Pending again.

## Steps (one at a time: plan → test on phone → commit)
[UI] = design with Impeccable   [Build] = new EAS build   [Rules] = deploy rules

1. Close the two rules gaps [Rules] — DONE (deployed 2026-09-28, tested)
   - A new driver application must have status "Pending".
   - Users cannot change their own role, accountStatus, approvalStatus,
     or review fields.
2. Sheet + Choose Role screen [UI] — DONE (tested 2026-09-28)
   - Remove Facebook, rename the button, add the new Choose Role screen.
   - For now: Resident → current signup, Driver → current Apply to Drive.
2b. Light mode for the start screens [UI] — DONE (tested 2026-09-28)
   - Landing page, Get Started sheet and Choose Role switch from dark to
     light. Shared colors in constants/design.js become LIGHT_COLORS.
   - Google and Email buttons in the sheet get a visible outline.
3. Photo upload helper [Build] — DONE (tested on phone 2026-09-29)
   - npx expo install expo-image-picker expo-image-manipulator
   - New lib/uploadPhoto.js: take/pick photo → shrink → upload to
     Cloudinary (one photo at a time) → return the link.
   - Tighten the upload preset in the Cloudinary dashboard (images only,
     small max file size, one folder).
   - Test it inside the current Apply to Drive page.
4. Resident registration form [UI] [Rules]
   - New app/register-resident.jsx (design-refs/resident-form.png,
     screens 3-6): Details → Proof → Review → Submitted. Google new users
     can now finish sign-up (replaces the "coming soon" message).
   - lib/roles.js: Pending/Rejected residents may open resident home.
   - Rules: a new Resident may start "Pending" (the old "Active" stays
     until step 5); residentVerifications rules.
5. New email sign-up order [Rules]
   - signup.jsx asks only email + password → verify email.
   - verify-email refreshes the login token → Choose Role → form.
   - Login + gatekeeper: signed in but no profile → Choose Role
     (instead of logging out).
   - Rules (closes the old door): a new Resident can no longer start
     "Active"; a new profile needs a verified email.
6. Pending resident limits + status names [UI] [Rules]
   - lib/roles.js: friendly status names (Pending Verification, Verified
     Resident, Pending Review, Verified Driver).
   - Status banner on resident home.
   - Tap Emergency → "Your account is still being verified. For
     emergencies, call 911." + "Call 911" button (opens the dialer).
   - Tap Request → similar message.
   - Rules: only Active residents can create transportRequests and
     callSessions.
   - Terms: unverified accounts cannot send alerts; SakayNa does not
     replace 911.
7. Admin reviews residents of their barangay [Rules]
   - Each admin profile gets a barangay (set in Firebase Console).
   - New "Resident Verification" list: photo, Approve / Reject + reason.
   - Rules: lock barangay (only admin can change it). Driver Settings
     shows barangay as read-only.
8. Resident resubmit
   - Rejected banner shows the reason + "Upload new proof" → Pending.
   - Rules: the only status change a user may make is Rejected → Pending.
9. Driver application form [UI] [Rules]
   - New app/register-driver.jsx (checks age 18+).
   - driver-status.jsx: new status names, rejection reason, "Fix and
     resubmit".
10. Admin driver review (barangay admin only)
   - Review window shows every document photo. Only Approve / Reject.
   - Remove the "sync driver-owned vehicles" code in admin-home.jsx.
   - Delete old test drivers, applications and driver-owned vehicles in
     the Firebase Console.
11. Website Apply to Drive page
   - /apply-to-drive opens the new driver flow (old form removed).
12. Paperwork
   - Privacy Policy (new documents, incl. medical certificate; photo
     links are public), PRODUCT.md, README.md, Skills/resident.md.

## Release warning
- Do not update the website or send out a new APK until step 11 is done.
- Rules go live the moment they're deployed. After step 5, OLD APKs
  can't create new accounts (they save residents as "Active"). Existing
  users can still log in. Testers need the new APK.
- Check that EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and
  EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET are saved in expo.dev and Vercel
  (.env is not uploaded).

## Known issues to watch
- Same person via Google and email = two accounts (for now).
- Unverified email account + later "Continue with Google" with the same
  Gmail may replace the password login.
- Cloudinary photo links are public: anyone who has the link can open it.
- If a barangay has no admin, its residents and drivers stay Pending.
