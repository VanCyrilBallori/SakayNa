# Login Overhaul Plan (Android)

## Goal
"Get Started" on the mobile landing page slides up a sheet:
- Header "Let's Continue with", subtitle "Select an Option to Log in or
  Create an Account"
- Continue with Google (Android account picker)
- Continue with Facebook (greyed out, "Soon")
- divider "or"
- Continue with Mobile Number
- small link: "Log in with email" (for staff and old email accounts)

## Decisions
- Must cost nothing for now.
- Keep email/password login for the website and staff (Dispatcher/Admin).
- Order after sign-in: choose Resident or Driver → Complete your profile
  (name, barangay, phone number, driver-only questions if Driver).
- Driver always starts as Pending until an Admin approves. This must be
  enforced in firestore.rules, not only in the app.
- If a signed-in user has no finished profile, send them back to the
  profile screen.
- Phone login: [Option A: switch Android to @react-native-firebase /
  Option B: "Soon" for now, phone number asked in the profile]
- The Option I picked was Option B

## Phases (one at a time: plan → test → commit)
1. Slide-up sheet UI only (buttons show "coming soon" for now) — DONE
   - Half-screen sheet, drag down from the title area to close
   - Google shows a "Coming soon" pop-up
   - Facebook and Mobile Number are greyed out with a "Soon" tag
   - "Log in with email" link opens the current login screen
2. Google sign-in (new EAS build) — DONE
   - Use Google's official multicolored "G" on the Google button, per
     Google's branding rules
   - Google package gives an ID token, Firebase JS SDK signs in with it
   - Existing profile → home screen; blocked profile → logged out
   - New Google user (no profile) → logged out + "coming soon" message
     (Phase 3 replaces this with role choice + profile)
3. Role choice + Complete your profile + Firestore rules
4. Phone login (depends on the decision above)

## Known issues to watch
- Same person via Google and phone/email = two accounts (for now).
- Unverified email account + later "Continue with Google" with the same
  Gmail may replace the password login.