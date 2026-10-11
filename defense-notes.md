# SakayNa defense notes

Prepared October 11, 2026, for the October 23 defense. These are short practice answers, based on the current project notes and code. Say the first sentence, then add the next one if the panel asks for more detail.

Last checked October 11, 2026, against **demo-ready-16**, tagged at app-code commit **39e4583**. The owner tested this APK on their phone, and its EAS fingerprint says **matches** (the built app matches the checked source). Later release-note commits do not change the app. The live website remains at **a25dae1**: it has the hold-to-show eyes and Privacy Policy update, but not the separate outcome/issues saving fix included in APK 16.

**Keep the facts clear:** C1 and C2 are fixed according to the recorded tests/releases. C3 is still untested. Future work is proposed, not already built. The survey demo is finished, but do not invent survey scores, response-time improvements, or LGU approval.

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

APK 16 also saves the selected completion outcome and optional issues on the driver's assignment in the same save as completion, driver/van availability, and the Run end duty record. Issues are trimmed to 300 characters and empty when blank; failed completion saves none of these changes. Old completion notes and records are kept. The duty record still says Completed, and history/Admin do not yet display the two new fields.

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

Commit **ddda3f3** fetches the newest 100 alerts from the database. The recorded test confirmed a new alert appeared, became marked unanswered after about 30 seconds, and changed status after Answer. The current Admin screen puts overdue unanswered alerts first, oldest first, with a red No answer label; the remaining alerts are newest first. Older alerts outside those 100 are not loaded.

### 36. What is C3, and is it fixed?

It is a possible real alert disappearing from Dispatcher screens after two minutes without a phone activity update. Call the office can put SakayNa in the background and pause that update. **It is not fixed or confirmed by a recorded phone test yet**; the test is to keep the phone call open for three minutes and watch the Dispatcher screen.

### 37. How would you approach C3?

Test it first. If confirmed, the review suggests increasing the website hiding delay from two to ten minutes, with approval and testing. This also keeps crashed-phone alerts visible longer; automatic cleanup would need a stronger background design.

### 38. What other important review findings remain?

Two Dispatchers may answer one alert or assign one vehicle at the same time. Removed staff may retain database powers, sign-up submissions need stronger checks, and the activity log may miss recent entries. These are open findings, not fixes already delivered.

### 39. Does deactivating an account disable its Firebase login?

No. It changes the profile and affects app access, but does not switch off Firebase Authentication. Some staff rules also rely on role alone. Staff removal needs Console handling now; the old advice to change role in Operations is outdated because that option was removed.

### 40. How do you deploy rule changes safely?

We commit first, compare live rules against the previously deployed version, deploy to **sakayna-571e8**, then download and compare again. That checks we changed the intended project and did not silently overwrite unexpected live rules.

## Known limits the panel may ask about

These answers cover the open entries in Known-Issue.md. Many are deliberate Capstone limits; they are not proof the system is ready for real emergency operations.

### 41. What if nobody answers, the phone has no load, or the app is in the background?

The alert needs internet, and a normal phone call needs working phone service. The fallback is Call the office when its number is saved. Auto-call does not run on the website, while backgrounded, or without any saved number; a manual Call button is available when there is a number.

### 42. What happens to an alert from a crashed phone?

It can remain ringing in the database. Dispatchers hide it after two minutes without an activity update, but Admin may still show it unanswered. Reloading the Dispatcher page can make old stuck alerts appear again temporarily.

### 43. Can an unfinished emergency form be recovered after closing it?

An unfinished form is not saved as a draft, so Cancel, Back, reload, or browser close loses typed details. If the Resident has ended the alert and the form is then closed, it cannot be reopened. Keeping an already open form allows Submit after Done.

### 44. Do 50 patients mean you dispatch enough vehicles for all of them?

No. The count describes the incident, but Submit creates one ride for one driver and vehicle. Multiple-vehicle response is future work; different patient conditions go in Incident details.

### 45. Is 'about 2 km' road distance or a live arrival estimate?

No. It is a rough straight-line distance from saved locations, not a road distance or arrival estimate. A driver's location can be old or approximate, and no Resident GPS means no distance. A typed replacement pickup is saved without the original GPS pin.

### 46. What happens if a driver reports a vehicle problem?

The ride returns to dispatch, but the vehicle becomes available again. The Dispatcher must choose another van and can ask the Admin to record maintenance. Automatically blocking that van until checked is future work.

### 47. What happens if a driver forgets to punch out or the phone dies?

The shift stays open, and logout does not punch out. A phone crash or dead battery may also leave a stale app-open signal. Drivers must punch out, and Dispatchers should contact them if their availability is doubtful; automatic shift closing is not built.

### 48. Do daily time records cover any shift length?

The daily view reads the start day and the following day, which covers normal overnight shifts. A shift left open longer can still show Still on duty instead of a complete record. The app does not calculate salary, and saved duty records are not editable.

### 49. Does cancelling immediately free the driver and vehicle?

The request is cancelled first. The driver's app frees the assignment and van while it is open, or the next time it opens. Until then, dispatch can still see them as busy.

### 50. Do scheduled rides have reminders?

No. The Dispatcher watches the list, with a warning when the time passes. Assigning too early makes the ride current and keeps the vehicle busy, so the assignment window warns when it is more than two hours away.

### 51. Does every Admin see only their own barangay?

Application reviews are limited to the Admin's barangay, but Users, Operations, and Duty Records remain city-wide. Changing a Resident's barangay can also leave their proof with the old Admin. These need work before a real pilot.

### 52. What if a barangay has no Admin?

Its new residents and drivers can remain Pending because nobody is assigned to review them. Each participating barangay needs a provisioned Admin.

### 53. Are uploaded document photos private?

The app shows them only to the owner and their barangay's Admin, but anyone with the exact Cloudinary link can open the photo. National ID is now a proof-of-residency option, between Certificate of Indigency and Other government document with your address. The Privacy Policy identifies it as a government ID and explains that document photos, including National ID photos, use public links. We use sample documents for tests; private uploads and controlled access are future work.

### 54. Are new Dispatchers forced to change their temporary password?

No. The Admin should share it privately and confirm that the Dispatcher resets it through Forgot password. A required first-login password change is future work.

### 55. What if the internet or map provider is unavailable?

Shared updates and submissions need internet, and some saves can wait a long time before failing. Free map/address services can also slow down or apply usage limits. SakayNa does not have a complete offline dispatch mode.

### 56. Can Google and email sign-in create duplicate accounts?

Yes, the same email used through both methods can lead to duplicate accounts or changed login behavior, especially if email verification was unfinished. Account linking needs further work.

### 57. Do old APKs still work?

Compatibility code is kept, but very old Driver APKs cannot receive assignments because they lack Punch in. APKs before 11 still show Decline, before 12 lack auto-call and driver location sharing. The latest phone-tested APK is **demo-ready-16** at **39e4583**; testers should install that release.

APK 16 removes only the Completion notes box and fades the completion pop-up's dark background separately from its sliding card. It keeps Issues encountered optional and saves outcome/issues when completion succeeds. Log in and Create Account show passwords only while holding the eye; releasing or sliding off hides them. The eyes are 52 × 52 pixels, labelled "Hold to show password", with screen-reader labels and Space/Enter hold controls on the web. Pressing the eye keeps the input's keyboard and cursor, and the phone-browser selection/context menu is suppressed on the eye. The Resident and Driver registration forms have no separate password boxes; both use Create Account first. National ID is also available as proof of residency.

## Future work and honest conclusions

### 58. What would you improve first after the defense?

First test C3, then prioritize emergency reliability, simultaneous-answer/assignment checks, stronger permissions, staff removal, barangay limits, and privacy gaps. Those come before pictures or general code cleanup.

### 59. What could a trusted backend add later?

It could close stuck alerts and forgotten shifts, send real push notifications, manage account deletion, and support private document uploads. These are future possibilities, not features in the current app.

### 60. What would a larger pilot need?

Barangay-based queues, vehicle pools, office numbers, usage measurements, and agreed privacy/retention processes. Other ideas include several vehicles for one incident, live driver tracking, and a suitable map-provider plan.

### 61. What maintenance improvements are proposed?

Smaller screen files, fewer repeated helpers, and fewer unnecessary database downloads. Automated tests could check permissions, time calculations, and form validation. These are deferred improvements, not requirements being added during the freeze.

### 62. Is SakayNa ready to run real emergency services today?

We can demonstrate the four-role Capstone workflow, but a real pilot needs further reliability, security, privacy, and operating arrangements. We do not claim guaranteed response times or government endorsement.

### 63. What evidence supports your project?

We have recorded phone and website workflow tests and specific C1/C2 test results. The survey demo is finished, but any claim about scores or acceptance must use the actual thesis results. This document does not supply or invent those results.

## Quick facts to remember

- **C1:** unapproved Driver writes blocked; commit 93867d3; recorded deploy and tests.
- **C2:** newest 100 Admin alerts fetched first; commit ddda3f3; recorded website test/release.
- **C3:** background alert-hiding risk; still needs the three-minute phone test.
- **Location:** five action points, no background tracking, latest record only, Dispatcher/self read access, Punch out deletion attempt.
- **No backend:** Firebase servers exist; no custom trusted background program.
- **Privacy:** current safeguards are not proof of full compliance; policy and retention remain unfinished.
- **Release:** phone-tested APK 16 at 39e4583; EAS fingerprint matches. Website at a25dae1 includes the four UI changes and Privacy Policy update, but not the completion-saving fix.

## Project references

- [HANDOFF.md](HANDOFF.md): verified release state and stale-note corrections.
- [Known-Issue.md](Known-Issue.md): known limits and current workarounds.
- [architecture-review.md](architecture-review.md): C1-C3, remaining findings, and future work.
- [driver-pages-plan.md](driver-pages-plan.md): why there is no Decline and how inability reporting works.
- [driver-location-plan.md](driver-location-plan.md): location permissions, access, and limits.
- [emergency-auto-call-plan.md](emergency-auto-call-plan.md), [emergency-request-form-plan.md](emergency-request-form-plan.md): emergency workflow and limits.
- [app/privacy.jsx](app/privacy.jsx): current draft privacy wording; unfinished retention periods.

The legal links beside questions 16-19 are the National Privacy Commission's published text of RA 10173. Their relevance to SakayNa is an explanation of design choices and open responsibilities, not a legal compliance certification. No code, rules, or live data were changed to prepare these notes.

This text-only update checked the demo-ready-16 source and recorded releases. It did not run new phone tests or compare deployed Firebase rules. APK 16's phone test is the owner's recorded confirmation. C1/C2 test results remain the previously recorded evidence; C3 still needs its separate three-minute phone test.
