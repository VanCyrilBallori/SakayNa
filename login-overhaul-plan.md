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

Everyone chooses "Are you a Resident or a Driver?" once, after signing in:
- Email path:  email + password → verify email → choose role → role form
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
  test data. Deleted by hand in the Firebase Console (step 10, done).
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

## Demo priority
- Must-have for the demo: steps 1-7, 9-11.
- After the demo: step 8 (resubmit) and step 12 (paperwork).
- Last 3-4 days before the demo: feature freeze, preview APK, testing only.
- If time runs out: drop the driver steps (9-11) before anything else.

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
4. Resident registration form [UI] [Rules] — DONE (deployed and tested 2026-09-29)
   - New app/register-resident.jsx (design-refs/resident-form.png,
     screens 3-6): Details → Proof → Review → Submitted. Google new users
     can now finish sign-up (replaces the "coming soon" message).
   - lib/roles.js: Pending/Rejected residents may open resident home.
   - Rules: a new Resident may start "Pending" (the old "Active" stays
     until step 5); residentVerifications rules.
5. New email sign-up order [Rules] — DONE (deployed and tested 2026-09-29)
   - signup.jsx asks only email + password → verify email.
   - verify-email refreshes the login token → Choose Role → form.
   - Login + gatekeeper: signed in but no profile → Choose Role
     (instead of logging out).
   - Rules (closes the old door): a new Resident can no longer start
     "Active"; a new Resident needs a verified email.
   - Drivers: verified-email rule waits for step 9 (old Apply to Drive
     saves before the email is verified). Choose Role → Driver shows
     "coming soon" until then.
6. Pending resident limits + status names [UI] [Rules] — DONE (deployed and tested 2026-09-29)
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
7. Admin reviews residents of their barangay [Rules] — DONE (deployed and tested 2026-09-29)
   - Each admin profile gets a barangay (set in Firebase Console).
   - New "Resident Verification" list: photo, Approve / Reject + reason.
   - Rules: lock barangay (only admin can change it). Driver Settings
     shows barangay as read-only.
8. Resident resubmit (after the demo)
   - Rejected banner shows the reason + "Upload new proof" → Pending.
   - Driver: "Fix and resubmit" on driver-status.jsx (moved from step 9).
   - Rules: the only status change a user may make is Rejected → Pending.
9. Driver application form [UI] [Rules] — DONE (deployed and tested 2026-09-29)
   - New app/register-driver.jsx: Personal → License → Clearances →
     Review → Submitted. Must be 18 or older; an expired license is
     blocked. Choose Role → Driver opens it (email and Google users).
   - Rules: a new Driver needs a verified email too (moved from step 5);
     a driver application's id must be the driver's own uid.
   - driver-status.jsx: timeline (Submitted → Pending Review → Approved
     or Rejected), rejection reason, Logout. "Fix and resubmit" moved
     to step 8.
10. Admin driver review (barangay admin only) [Rules] — DONE (deployed and tested 2026-09-29)
   - New "Driver Applications" list in admin home: every document photo
     (tap for full screen). Only Approve / Reject + reason. The old
     Operations → Applications tab was removed.
   - The admin's application list asks only for the admin's own barangay.
   - Rules: only the Admin of the same barangay may read or review
     Driver_Applications, only to "Approved" or "Rejected".
   - Removed the "Sync Driver-Owned Vehicles" button and code. Leftover
     driver-owned code in the dispatcher screen and vehicle editor was
     kept on purpose (harmless without driver-owned vehicles).
   - Old test drivers, applications and driver-owned vehicles deleted
     by hand in the Firebase Console. All roles tested, including an
     emergency alert ("Dispatcher accepted").
11. Website Apply to Drive page — DONE (tested on localhost and live website 2026-09-29)
   - /apply-to-drive is now a signpost (old form removed): not logged in
     → Create Account; logged in without a profile → Verify Email or the
     driver form; has an account → their own home.
   - Website footer link "Jobs" renamed "Apply to Drive".
   - Privacy Policy text updated early (still a DRAFT for the adviser):
     proof-of-residency photo, driver documents incl. medical
     certificate, no vehicle info, photo links are public.
   - Website released (master → main → Vercel). EAS preview variables
     checked: all 10 match .env. Vercel has the 9 web variables.
   - Not fixed (website only): the browser's Back button leaves a form
     and loses what was typed; iPhone HEIC photos can't be read by
     Chrome on a computer (JPG/PNG work); "Call 911" does nothing on a
     computer.
12. Paperwork
   - Privacy Policy: text updated in step 11; still needs the adviser's
     review and the "[time period to be decided]" parts.
   - PRODUCT.md, README.md, Skills/resident.md (still describe the old
     Apply to Drive page and driver-owned vehicles).

## Release warning
- Step 11 is done and the website was updated (2026-09-29). Testers need
  the new preview APK.
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
- MUST FIX BEFORE A REAL PILOT: the old Users and Operations tools are
  still city-wide. Any admin can set any resident "Active" from any
  barangay there, skipping the document review. The same goes for drivers:
  Users → Edit can set any driver "Approved". (Steps 7 and 10 only limit
  the new Resident Verification and Driver Applications lists to the
  admin's own barangay.)
- If an admin changes a Pending resident's barangay in Users → Edit, the
  resident's verification stays with the old barangay's admin.
