# SakayNa defense notes

Prepared October 11, 2026, for the October 23 defense; updated October 14, 2026. These are short practice answers, based on the current project notes and code. Say the first sentence, then add the next one if the panel asks for more detail.

Last checked October 14, 2026, against Git:

- **APK:** **demo-ready-17**, tagged at app-code commit **258258e** (EAS build 34d17f8a). The owner tested this APK on their phone, and its EAS fingerprint says **matches** (the built app matches the checked source).
- **Website:** **258258e**, the same app code as the APK.
- **Firestore rules:** **d464a70**, live ruleset e9a236c9, as reported by the owner's before/after comparison. Git alone does not prove live rules.

Later docs commits do not change the app. The app is frozen until the defense.

**Keep the facts clear:** C1, C2 and the security hardening (Tasks 1.1, 1.3 and 1.2) are fixed according to the recorded tests/releases. C3 is still untested. Future work is proposed, not already built. The survey demo is finished, but do not invent survey scores, response-time improvements, or LGU approval.

## Purpose and design choices

### 1. What does SakayNa do?

SakayNa helps Toledo City residents request barangay transport. A Dispatcher chooses a driver and vehicle, and the Resident can follow the ride until it is finished.

### 2. How is it different from a ride-hailing app?

It uses barangay vehicles and approved drivers, with no fares or payments. The office assigns the ride instead of letting drivers choose customers.

### 3. Why does an emergency send an alert before making a phone call?

The alert gives the office a record, the Resident's name and number, and their location if available. It also lets a Dispatcher accept responsibility before the Resident's phone calls them; a direct call by itself would not create the linked transport request or show its progress.

### 4. Does alert-first mean the Resident cannot call the office directly?

No. The office number is available in Help, and a waiting alert offers Call the office after 30 seconds if a number is saved. SakayNa helps coordinate transport; it does not guarantee that somebody answers or replace official emergency services.

### 5. Is the emergency voice call inside SakayNa?

No. After Answer, the Resident's Android phone counts down three seconds and uses its normal Phone app. The website chooses one saved number: the Dispatcher's account number, otherwise their Operational number, otherwise the office number. It does not automatically try another number if that call is unanswered.

### 6. Why make the Resident call the Dispatcher?

Dispatchers use a computer, while the Resident has a phone. The website shows the Resident's number for reference, and the Resident's phone makes the call.

### 7. Can the automatic call happen without warning?

There is a visible countdown and Cancel call button. It runs once per alert while SakayNa is on screen; leaving the app during the countdown stops it. Depending on Android permission, it starts the call or opens the dialer with the number filled in.

### 8. Why is there no Decline button for drivers?

The Dispatcher chooses the driver as part of an office assignment. Drivers show whether they can work by punching in, taking a break, or punching out; a serious problem after assignment uses I can't do this ride and records a reason.

### 9. Are drivers forced to finish an unsafe ride?

Before pickup, they can report Vehicle problem, Feeling unwell, Family emergency, or Other. The ride returns to dispatch for reassignment. After pickup, they call dispatch so a person can decide what to do with the passenger already on board.

### 10. What does Available mean? Is it the same as app open?

Available means the driver punched in and is not on break or on a run. App open is a separate signal, so a driver can remain on duty even after closing or logging out of the app.

## Driver location and privacy

### 11. Do you track drivers all day?

No. The app saves a location only when an on-duty driver taps Punch in, Accept, En route, Arrived, or Picked up. It does not collect location continuously or in the background.

### 12. Who can see a driver's saved location?

Dispatchers can read it, and the driver can read their own record. Residents, Admins, and other drivers do not have access to that location collection. The Dispatcher screen shows locations only for on-duty drivers.

### 13. What happens to old locations?

Each new step replaces the previous saved location, so there is no route history. Punch out attempts to delete it; even if that deletion fails, the Dispatcher screen hides an Off duty driver's location. Forgetting to punch out can leave the last location visible longer.

### 14. Can a driver refuse location permission?

Yes. The Android permission request happens at Punch in, after the duty save. Refusing location does not stop the driver from working; Dispatchers see No location shared when there is no saved location.

### 15. Why collect any driver location at all?

It helps the Dispatcher see where an on-duty driver last was and compare rough distances during emergency assignment. The screen shows how old the location is, because it may no longer be the driver's current place.

### 16. How does this relate to the Data Privacy Act?

An identifiable driver's location is personal information. We explain its purpose and limit collection and access; this supports transparency, a proper purpose, and collecting only what is needed. These are the general principles in Section 11 of RA 10173. [National Privacy Commission: Data Privacy Act](https://privacy.gov.ph/data-privacy-act-/)

### 17. Does Android's Allow location button prove legal compliance?

No. Phone permission is a device setting, not proof that every privacy duty is met. A real pilot still needs a suitable lawful basis, clear notices, safeguards, and a process for people's rights. Sections 12 and 20 address lawful processing and security. [RA 10173](https://privacy.gov.ph/data-privacy-act-/)

### 18. What about the patient's age and health details?

Age and health information are sensitive personal information under Section 3. Emergency rides store facts needed for transport, but their lawful basis, access, and retention need review before real use; Section 13 has specific conditions. [RA 10173, Sections 3 and 13](https://privacy.gov.ph/data-privacy-act-/)

### 19. Can you claim the whole system is fully privacy-compliant?

Not yet. The Privacy Policy is a draft; document links are public to anyone with the exact URL, and retention periods remain undecided. Section 11 calls for keeping identifiable data only as long as necessary, subject to its stated grounds. [RA 10173, Section 11](https://privacy.gov.ph/data-privacy-act-/)

### 20. Who sees emergency health details in the app?

The Resident whose account holds the ride, the assigned Driver, Dispatchers, and Admins can read them. The form tells the Dispatcher to write only what the driver needs. This access still needs review before a real pilot.

## No-server design and database rules

### 21. Why did you choose no separate server?

It keeps the Capstone easier to finish, understand, and maintain on our current Firebase setup. Firebase already provides login and database services, so we did not add a separate backend program.

### 22. Does no server mean the data stays only on the phone?

No. Firebase runs servers that store the shared data. No server here means we have no custom backend or Cloud Functions running our own trusted background jobs.

### 23. What is the main disadvantage?

Work that should continue after phones and browser pages close has no custom process to handle it. Stuck alerts and forgotten shifts do not close automatically, and there are no working push notifications or automatic account-deletion service.

### 24. What protects the database if the app talks to it directly?

Firestore security rules are the guard at the database door. They check who is asking and what that person may read or save; hiding a button is not enough because someone could bypass the app.

### 25. What do the current rules check well?

A person cannot make themselves Admin or approve their own account. New Resident requests need an Active account; duty changes need an Approved Driver, allowed status changes, and the database's time. Duty records cannot be edited or deleted, even by an Admin.

### 26. What can't the location rules prove?

They can check the driver, duty status, allowed fields, coordinate ranges, step name, and database time. They cannot prove that a GPS point is the driver's real physical location or that the claimed step actually happened.

### 27. What don't the current duty rules verify?

They do not fully link On a run to a real accepted assignment, or stop a driver with an unaccepted ride from starting a break. The app handles those checks, so they are weaker than checks enforced at the database. This is a gap in our current rules, not a claim that Firestore can never enforce more.

### 28. What do the emergency-form rules verify?

The Dispatcher creating the ride must be the one who answered the linked alert, for that same Resident. They do not check every medical or ride field. The alert may already be ended, so the Dispatcher can finish an open form after the Resident taps Done.

### 29. Can someone bypass the app and change data they should not change?

Some update rules still allow too many fields on a person's own requests, alerts, or assignments. The review recommends restricting ownership changes and allowed fields. This remains open; we do not claim every possible database misuse is blocked.

### 30. How do you stop a save from updating only half a ride?

Important operations use an all-or-nothing save. For example, assignment updates the request, driver assignment, and vehicle together. Some checks are still missing, such as a complete check against two Dispatchers choosing the same van at once.

Since APK 16, the app also saves the selected completion outcome and optional issues on the driver's assignment in the same save as completion, driver/van availability, and the Run end duty record. Issues are trimmed to 300 characters and empty when blank; failed completion saves none of these changes. Old completion notes and records are kept. The duty record still says Completed, and history/Admin do not yet display the two new fields.

## Security findings, fixes, and tests

### 31. What was C1?

A Pending Driver account could change vehicles even before approval, because the old rule checked only the Driver role. The same weak check affected schedules and vehicle checklists; the normal screens hid these actions, but the database rule still allowed them.

### 32. How did you fix C1?

Commit **93867d3** changed those write permissions to require an Approved Driver. Staff retain their allowed access. This fixed the unapproved-driver write gap; it does not restrict every Approved Driver to only their assigned vehicle.

### 33. How do you know C1 was tested?

The review records that Firebase Rules Playground denied a Pending Driver's vehicle update and allowed an Approved Driver's update. It also records tests of ride completion, inability reporting, Resident cancellation, emergency-form submission, and Admin vehicle editing. The deployed rules were compared before and after release.

### 34. What was C2? Was it another permission problem?

It was a missing-alert problem in the Admin list. The page fetched any 100 alerts and only then sorted them, so once there were more than 100 records a new emergency might not be included.

### 35. How did you fix and test C2?

Commit **ddda3f3** fetches the newest 100 alerts from the database. The recorded test confirmed a new unanswered alert appeared at the top with the unanswered badge, and its status changed after Answer. The current Admin screen puts overdue unanswered alerts first, oldest first, with a red No answer label; the remaining alerts are newest first. Older alerts outside those 100 are not loaded.

### 36. What security hardening did you do after C1 and C2?

Three rules changes, one at a time: Task 1.1 limits Admin edits to their own barangay, Task 1.3 protects the activity log, and Task 1.2 refuses staff who are not Active. Each was committed, deployed to **sakayna-571e8**, compared afterwards (the live rules exactly matched the commit), and tested in the Rules Playground and the real app. A before-deploy comparison is recorded only for Task 1.2. A small app change (**258258e**) then shows refused staff a clear "Account not active" screen.

### 37. What was Task 1.1?

Before, an Admin could change any user's profile in any barangay. Now (rules **c92f5a1**) an Admin may edit only non-Admin accounts in their own barangay, only an approved list of fields, and can never change a user's role or barangay. Add Dispatcher uses the Admin's own barangay. The screens (**b62c724**) lock the barangay and show other-barangay and Admin accounts as view only.

### 38. How did you prove Task 1.1?

In the Rules Playground, as the Daanglungsod Admin: editing another Admin, editing a user from another barangay, changing a role, changing a barangay, and changing a field not on the list were all Denied; changing only a Daanglungsod Dispatcher's phone number was Allowed. The real-app tests passed: Resident approval, Driver status change, phone edit, punch in/out, emergency form, Add Dispatcher, and the other-barangay view-only screen. The after-deploy comparison said exact match. Not tested: the denial when an Admin with a missing barangay tries Add Dispatcher.

### 39. What was Task 1.3?

The activity log is the list of Admin actions. Before, any staff member could write a log line in someone else's name. Now (rules **98db008**) only an Admin can create a line, using their own account ID, their own role, and Firebase's clock, with only eight allowed fields; lines cannot be edited or deleted. The Logs screen (**94d2cb3**) also loads the newest 50 lines first, so recent actions are not missed (A5).

### 40. How did you prove Task 1.3?

In the Rules Playground, creating a line with another person's ID, with the role "Dispatcher", with an extra field, as a Dispatcher, or while signed out was Denied each time. Editing and deleting one real log line were both Denied. In the real app, Admin actions (Driver status change, phone edit, vehicle create/edit/archive, Resident approval, Add Dispatcher) passed, and Logs showed the newest lines first. The after-deploy comparison said exact match.

### 41. What was Task 1.2?

Before, the rules checked only a staff member's role, so a Pending or Deactivated Dispatcher or Admin could still read and change data by going around the app (A2). Now (rules **d464a70**) the Admin and Dispatcher checks also require the person's own account status to be exactly "Active". They may still read their own profile, so the app can show them a message. Driver and Resident checks were not changed. The app change **258258e** then shows "Account not active" with Log Out, instead of a spinner or empty lists.

### 42. How did you prove Task 1.2?

Before deploying, the live rules matched the previous version (98db008); the dry run compiled; after deploying, live matched exactly. In the Rules Playground, the Active admin1 and dispatcher0 could read a log line; dispatcher1, with no account status, was Denied for the log line and for another Dispatcher's profile but Allowed for its own profile; a Driver could still read a vehicle. In the real app, Admin screens, a full emergency, punch in/out, and a ride request passed, and dispatcher1 was deactivated ("Account disabled") and then restored. On the demo-ready-17 APK, dispatcher1 Active → Pending → Active passed.

### 43. What are the honest limits of this hardening?

- **Reading the Users list is still city-wide.** An Admin can only edit users in their own barangay, but can still see the list for every barangay.
- **Refused staff can still sign in.** The database refuses their data and the app shows "Account not active", but blocking the sign-in itself needs a server.
- **The activity log proves who and when, not what.** The rules prove which Admin wrote a line and when, but not that the described action really happened.
- **Some cases are tested only once or not at all.** Edit/delete of log lines was tested on one real line, and the Add Dispatcher missing-barangay case was not tested.

### 44. What is C3, and is it fixed?

It is a possible real alert disappearing from Dispatcher screens after two minutes without a phone activity update. Call the office can put SakayNa in the background and pause that update. **It is not fixed or confirmed by a recorded phone test yet**; the test is to keep the phone call open for three minutes and watch the Dispatcher screen.

### 45. How would you approach C3?

Test it first. If confirmed, the review suggests increasing the website hiding delay from two to ten minutes, with approval and testing. This also keeps crashed-phone alerts visible longer; automatic cleanup would need a stronger background design.

### 46. What other important review findings remain?

Two Dispatchers may answer one alert or assign one vehicle at the same time. Owners can change too many fields of their own rides and alerts by going around the app, and sign-up submissions need stronger checks. Task 1.2 changed staff only; Driver checks were not changed, although C1 already requires an Approved Driver for vehicle, schedule and checklist writes. These are open findings, not fixes already delivered.

### 47. Does deactivating an account disable its Firebase login?

No. Firebase Authentication still lets the person sign in; blocking sign-in needs a server. But since Task 1.2 the database refuses any Admin or Dispatcher who is not Active, and the app shows "Account not active" (or "Account disabled" for a Deactivated account) with only a Log Out button. To fully remove someone now, also disable their login in Firebase Console → Authentication. The old advice to change role in Operations is outdated because that option was removed.

### 48. How do you deploy rule changes safely?

We commit first, compare live rules against the previously deployed version, deploy to **sakayna-571e8**, then download and compare again. That checks we changed the intended project and did not silently overwrite unexpected live rules.

## Known limits the panel may ask about

These answers cover the open entries in Known-Issue.md. Many are deliberate Capstone limits; they are not proof the system is ready for real emergency operations.

### 49. What if nobody answers, the phone has no load, or the app is in the background?

The alert needs internet, and a normal phone call needs working phone service. The fallback is Call the office when its number is saved. Auto-call does not run on the website, while backgrounded, or without any saved number; a manual Call button is available when there is a number.

### 50. What happens to an alert from a crashed phone?

It can remain ringing in the database. Dispatchers hide it after two minutes without an activity update, but Admin may still show it unanswered. Reloading the Dispatcher page can make old stuck alerts appear again temporarily.

### 51. Can an unfinished emergency form be recovered after closing it?

An unfinished form is not saved as a draft, so Cancel, Back, reload, or browser close loses typed details. If the Resident has ended the alert and the form is then closed, it cannot be reopened. Keeping an already open form allows Submit after Done.

### 52. Do 50 patients mean you dispatch enough vehicles for all of them?

No. The count describes the incident, but Submit creates one ride for one driver and vehicle. Multiple-vehicle response is future work; different patient conditions go in Incident details.

### 53. Is 'about 2 km' road distance or a live arrival estimate?

No. It is a rough straight-line distance from saved locations, not a road distance or arrival estimate. A driver's location can be old or approximate, and no Resident GPS means no distance. A typed replacement pickup is saved without the original GPS pin.

### 54. What happens if a driver reports a vehicle problem?

The ride returns to dispatch, but the vehicle becomes available again. The Dispatcher must choose another van and can ask the Admin to record maintenance. Automatically blocking that van until checked is future work.

### 55. What happens if a driver forgets to punch out or the phone dies?

The shift stays open, and logout does not punch out. A phone crash or dead battery may also leave a stale app-open signal. Drivers must punch out, and Dispatchers should contact them if their availability is doubtful; automatic shift closing is not built.

### 56. Do daily time records cover any shift length?

The daily view reads the start day and the following day, which covers normal overnight shifts. A shift left open longer can still show Still on duty instead of a complete record. The app does not calculate salary, and saved duty records are not editable.

### 57. Does cancelling immediately free the driver and vehicle?

The request is cancelled first. The driver's app frees the assignment and van while it is open, or the next time it opens. Until then, dispatch can still see them as busy.

### 58. Do scheduled rides have reminders?

No. The Dispatcher watches the list, with a warning when the time passes. Assigning too early makes the ride current and keeps the vehicle busy, so the assignment window warns when it is more than two hours away.

### 59. Does every Admin see only their own barangay?

Application reviews and, since Task 1.1, Admin edits of user profiles are limited to the Admin's barangay. Reading the Users list, Operations, and Duty Records remain city-wide. A user's barangay can no longer be changed in the app after sign-up, so a typo must be fixed in the Firebase Console. These need work before a real pilot.

### 60. What if a barangay has no Admin?

Its new residents and drivers can remain Pending because nobody is assigned to review them. Each participating barangay needs a provisioned Admin.

### 61. Are uploaded document photos private?

The app shows them only to the owner and their barangay's Admin, but anyone with the exact Cloudinary link can open the photo. National ID is now a proof-of-residency option, between Certificate of Indigency and Other government document with your address. The Privacy Policy identifies it as a government ID and explains that document photos, including National ID photos, use public links. We use sample documents for tests; private uploads and controlled access are future work.

### 62. Are new Dispatchers forced to change their temporary password?

No. The Admin should share it privately and confirm that the Dispatcher resets it through Forgot password. A required first-login password change is future work.

### 63. What if the internet or map provider is unavailable?

Shared updates and submissions need internet, and some saves can wait a long time before failing. Free map/address services can also slow down or apply usage limits. SakayNa does not have a complete offline dispatch mode.

### 64. Can Google and email sign-in create duplicate accounts?

Yes, the same email used through both methods can lead to duplicate accounts or changed login behavior, especially if email verification was unfinished. Account linking needs further work.

### 65. Do old APKs still work?

Compatibility code is kept, but very old Driver APKs cannot receive assignments because they lack Punch in. APKs before 11 still show Decline, before 12 lack auto-call and driver location sharing. The latest phone-tested APK is **demo-ready-17** at **258258e**; testers should install that release.

APK 17 adds the new start screen picture, the Admin barangay lock and view-only screens, newest-first Logs, and the "Account not active" screen for staff who are not Active. It has no native changes (same fingerprint as APK 16).

APK 16 removes only the Completion notes box and fades the completion pop-up's dark background separately from its sliding card. It keeps Issues encountered optional and saves outcome/issues when completion succeeds. Log in and Create Account show passwords only while holding the eye; releasing or sliding off hides them. The eyes are 52 × 52 pixels, labelled "Hold to show password", with screen-reader labels and Space/Enter hold controls on the web. Pressing the eye keeps the input's keyboard and cursor, and the phone-browser selection/context menu is suppressed on the eye. The Resident and Driver registration forms have no separate password boxes; both use Create Account first. National ID is also available as proof of residency.

## Future work and honest conclusions

### 66. What would you improve first after the defense?

First test C3, then prioritize emergency reliability, simultaneous-answer/assignment checks, stronger permissions on rides and alerts, barangay-limited reads, and privacy gaps. Those come before pictures or general code cleanup.

### 67. What could a trusted backend add later?

It could close stuck alerts and forgotten shifts, send real push notifications, block sign-in for removed staff, manage account deletion, and support private document uploads. These are future possibilities, not features in the current app.

### 68. What would a larger pilot need?

Barangay-based queues, vehicle pools, office numbers, usage measurements, and agreed privacy/retention processes. Other ideas include several vehicles for one incident, live driver tracking, and a suitable map-provider plan.

### 69. What maintenance improvements are proposed?

Smaller screen files, fewer repeated helpers, and fewer unnecessary database downloads. Automated tests could check permissions, time calculations, and form validation. These are deferred improvements, not requirements being added during the freeze.

### 70. Is SakayNa ready to run real emergency services today?

We can demonstrate the four-role Capstone workflow, but a real pilot needs further reliability, security, privacy, and operating arrangements. We do not claim guaranteed response times or government endorsement.

### 71. What evidence supports your project?

We have recorded phone and website workflow tests, specific C1/C2 test results, and Rules Playground and real-app results for Tasks 1.1, 1.3 and 1.2 (architecture-review.md). The survey demo is finished, but any claim about scores or acceptance must use the actual thesis results. This document does not supply or invent those results.

## Quick facts to remember

- **C1:** unapproved Driver writes blocked; commit 93867d3; recorded deploy and tests.
- **C2:** newest 100 Admin alerts fetched first; commit ddda3f3; recorded website test/release.
- **Task 1.1:** Admin edits limited to own barangay, approved fields, no role/barangay change; rules c92f5a1, screens b62c724.
- **Task 1.3:** activity log lines only by an Admin, as themselves, with Firebase's clock; no edit/delete; rules 98db008. Logs newest 50 first: 94d2cb3.
- **Task 1.2:** staff must be Active; rules d464a70, "Account not active" screen 258258e.
- **Hardening limits:** Users-list reads city-wide; refused staff can still sign in; the log proves who and when, not that the action happened.
- **C3:** background alert-hiding risk; still needs the three-minute phone test.
- **Location:** five action points, no background tracking, latest record only, Dispatcher/self read access, Punch out deletion attempt.
- **No backend:** Firebase servers exist; no custom trusted background program.
- **Privacy:** current safeguards are not proof of full compliance; policy and retention remain unfinished.
- **Release:** phone-tested APK demo-ready-17 at 258258e (build 34d17f8a); EAS fingerprint matches. Website at 258258e. Rules at d464a70 (ruleset e9a236c9).

## Project references

- [HANDOFF.md](HANDOFF.md): verified release state and stale-note corrections.
- [Known-Issue.md](Known-Issue.md): known limits and current workarounds.
- [architecture-review.md](architecture-review.md): C1-C3, remaining findings, and future work.
- [driver-pages-plan.md](driver-pages-plan.md): why there is no Decline and how inability reporting works.
- [driver-location-plan.md](driver-location-plan.md): location permissions, access, and limits.
- [emergency-auto-call-plan.md](emergency-auto-call-plan.md), [emergency-request-form-plan.md](emergency-request-form-plan.md): emergency workflow and limits.
- [app/privacy.jsx](app/privacy.jsx): current draft privacy wording; unfinished retention periods.

The legal links beside questions 16-19 are the National Privacy Commission's published text of RA 10173. Their relevance to SakayNa is an explanation of design choices and open responsibilities, not a legal compliance certification. No code, rules, or live data were changed to prepare these notes.

This text-only update checked the demo-ready-17 tag, the website commit and the rules commit against Git. It did not run new phone tests or compare deployed Firebase rules. APK 17's phone test and the Task 1.1/1.3/1.2 results are the owner's recorded confirmations. C1/C2 test results remain the previously recorded evidence; C3 still needs its separate three-minute phone test.
