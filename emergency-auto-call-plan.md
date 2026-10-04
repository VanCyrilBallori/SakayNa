# Emergency Auto Call Plan

**Status: Step A DONE and tested on the phone (commit ab3ca7a), Step B notes written (2026-10-04). Release: demo-ready-12.**

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
   (`dispatcherPhone` = their Operational phone, set by an admin in
   Operations → Manage profile). Unchanged.
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
