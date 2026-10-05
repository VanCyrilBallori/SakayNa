# Emergency Auto Call Plan

**Status: DONE. Released as demo-ready-12 (2026-10-04).** Step A (commit ab3ca7a) and Step B notes (commit 698cd91) done; tested on the phone.
**Fix (2026-10-05):** which number is called, and no call button on the
website. See "Fix: the dispatcher's own phone" at the bottom.

## Goal (in simple words)
When a dispatcher taps **Answer** on a resident's emergency alert, the
resident's phone calls that dispatcher by itself (Android's normal Phone
app), after a short countdown the resident can cancel. Today it only
shows "Dispatcher accepted" and waits for the resident to tap **Call**.

**This deliberately changes an earlier rule:** "nothing calls unless the
user taps a Call button" (the comment in lib/phoneCall.js). The emergency
alert's countdown is the one exception.

## What happens
1. Dispatcher taps Answer. The alert gets their name and phone
   (`dispatcherPhone`). Since the 2026-10-05 fix: their own account
   phone, else their Operational phone, else the office number (see
   the fix section at the bottom).
2. Resident's pop-up: "Dispatcher accepted", and if there is a number,
   **"Calling Maria in 3…"** (2…, 1…) with **Cancel call** underneath.
3. At 0: `startPhoneCall` (lib/phoneCall.js), unchanged: a direct call if
   the phone permission is allowed, otherwise the dialer opens with the
   number filled in.
4. After the call, Android brings the resident back to the same pop-up:
   **Call Maria again** and **Done**.
5. **Cancel call**: no call; the pop-up shows **Call Maria** and **Done**
   (today's screen).
6. No number: no countdown, no call. Today's screen ("No phone number is
   on file for them.").

## Decisions (2026-10-04)
1. After the auto call, the button says **"Call [name] again"**. After
   Cancel call (no call made), it stays "Call [name]".

## Safety rules
- Once per alert (the app remembers which alert it already counted
  down for).
- Only while the app is on screen. The countdown doesn't start if the
  app is in the background, and leaving the app (Home button, another
  app) during the countdown cancels it, so it can never call later by
  surprise. The Call button stays.
- Not while "Cancel your emergency alert?" is open: then no countdown.
- **Done** or Back during the countdown closes the pop-up and stops it.
- Phone app only. The website doesn't change.
- The countdown is announced by TalkBack (screen reader).
- DESIGN.md: countdown in Board text, **Cancel call** a full-width
  outline button at least 56 tall, never red.

## Steps (one at a time: build → test on phone → commit → next)

### Step A — Code
- Files: app/resident-home.jsx (countdown, "already counted down"
  memory, the countdown block, "again" label, styles), lib/phoneCall.js
  (comment only).
- **Test** (resident on the phone's dev build, dispatcher on the
  website, a second phone set as the dispatcher's Operational phone):
  1. Alert → Answer → countdown 3, 2, 1 → call (or dialer) → second
     phone rings.
  2. Hang up → back on "Dispatcher accepted" with **Call [name] again**
     (calls again) and **Done** (closes; dispatcher's card ends as today).
  3. Cancel call during the countdown → no call; **Call [name]** + Done.
  4. Dispatcher with no Operational phone → no countdown, no call.
  5. Done during the countdown → closes, no call.
  6. Home button right after Answer → no call; Call button there.
  7. Waiting, "No dispatcher has accepted yet", Cancel alert, dispatcher
     declines: all as before.

### Step B — Notes
- Skills/resident.md: the "A dispatcher accepted" row, item 11 (Call
  buttons), the function list. Say it deliberately changes the earlier
  rule, with the date.
- Known-Issue.md: limits. The call is a normal call from the resident's
  own SIM (no load or signal = it fails like any call; the Call button
  stays). No auto call on the website or in the background. Older APKs
  don't auto call.
- PRODUCT.md: one sentence on the alert flow.
- Privacy Policy: no change (no new information; the resident already
  sees the dispatcher's number).

## Release
- New preview APK: yes (phone app code; no over-the-air updates).
- New development build: no (no new package; expo-intent-launcher is
  already in the app).
- No rules change. Website: nothing visible changes.
- Old APKs keep today's tap-to-call.

## Releases
- 2026-10-04: **demo-ready-12** (driver location + emergency auto call,
  released together).
  - Website: master → main → Vercel, fast-forward 37454ba..698cd91;
    the new version was live at 22:36 (checked: the live /privacy page
    has "Only dispatchers see a driver's last saved location"). Live
    checks passed: Vercel "Ready", the location line and Show on map,
    the privacy page, the queue, assigning, an emergency alert.
  - No rules change.
  - Preview APK: EAS build 1e6d609e-2ae8-446f-9ff0-972051685484,
    profile preview, built from commit 698cd91, finished 23:02,
    `eas fingerprint:compare` says "matches". Tested on the phone.
    Tagged demo-ready-12 (on 698cd91) and pushed.
  - Tester message: tester-message.md with the new APK link and the
    driver, dispatcher and resident lines (commit c7d337e).

## Fix: the dispatcher's own phone (2026-10-05)
The resident always calls the dispatcher, never the other way around,
because dispatchers use a computer.

1. **Which number the resident's phone calls** (Step 1, commit 5ebd525).
   Before: `officePhone || operationalPhone`, and nothing ever saved an
   `officePhone`, so it was always the Operational phone. Now, when the
   dispatcher taps Answer (`answerIncomingCall` in
   app/dispatcher-home.jsx):
   1. the dispatcher's own account phone (`phoneNumber`, or the older
      `phone`; an admin sets it in Users → Edit),
   2. else their Operational phone (Operations → Manage profile),
   3. else the office number (`systemSettings/operational` →
      `publicOfficePhone`, the one residents see in ☰ → Help). Then the
      alert also gets `dispatcherPhoneIsOffice: true`, and the
      resident's phone says **"Calling the dispatch office in 3…"** and
      **"Call the dispatch office (again)"** instead of the dispatcher's
      name (app/resident-home.jsx, `autoCallLabel`).
   - The countdown and Cancel call are unchanged.
2. **No call button on the website** (Step 2, commit 67378fc). The
   Incoming Emergency pop-up and the Active emergency card show
   "Resident's number:" and the number as plain text, for reference
   (`EmergencyCallerDetails` in app/dispatcher-home.jsx). Normal ride
   requests still have tap-to-call.
3. Not changed: anything after "Dispatcher accepted" except the names
   above, and ride assignment (`handleAssignRequest` still saves
   `officePhone || operationalPhone` for drivers to call dispatch).

**Release:** website (both steps) + a new preview APK (only for the
"dispatch office" wording). No rules change: dispatchers could already
save any field on an alert. Older APKs (demo-ready-12 and before) call
the right number with the new website, but on the office fallback they
still say the dispatcher's name.

**Privacy:** the resident now calls the dispatcher's own account phone
when one is saved, so that number shows in the resident's dialer and
call log. Dispatchers should know this. The Privacy Policy is about
residents' and drivers' information, so it doesn't change.
