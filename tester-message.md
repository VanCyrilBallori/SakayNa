SakayNa preview APK: password eye, National ID and mission completion

Hi everyone! A new SakayNa preview app is ready for testing.
Please update before your next test.

EVERYONE
- Uninstall the old SakayNa app, then install the new APK: https://expo.dev/artifacts/eas/bij3WUHjKK9mVaTYRiAxOApXahaGUPAluF7zEPWab2Y.apk
- On Log in and Create Account, press and hold the eye to show your
  password. Let go or slide your finger off the eye to hide it again.
- While holding the eye, the keyboard should stay open and the cursor
  should stay in the password box. No text-selection or context menu
  should open.
- The Privacy Policy now includes National ID as a government ID and
  explains that document photos use public web links.

RESIDENTS
- Proof of residency now includes National ID, between Certificate of
  Indigency and Other government document with your address.
- Use sample document photos when testing. Anyone with the exact photo
  link can open it.

DRIVERS
- Complete mission no longer has a Completion notes box. The outcome
  choice and Issues encountered (optional) box remain.
- The dark background now fades in and out when the pop-up opens and
  closes.
- Your selected outcome and optional issues are now saved when
  completion succeeds. Issues are limited to 300 characters; leaving
  them blank is allowed.
- Old completion notes and records are kept.
- Test one ride with issues and one with issues blank. After each,
  check that the ride is Completed and the driver and van are Available.
- Logging out does not punch you out. If you are done for the day,
  punch out first.

ADMIN / TEST OWNER
- Check the new fields in Firebase Console -> driverAssignments:
  completionOutcome and completionIssues. Blank issues should be "".
  Existing history/Admin screens do not display these two fields.
- Check Duty Records after each completed ride and check an older
  completed record still has its original notes.
- For a National ID application, check the saved label, open the full
  document photo and check approval still works.

This APK is awaiting the owner's final phone test. No release tag has
been added yet.

Questions or problems? Message me.
