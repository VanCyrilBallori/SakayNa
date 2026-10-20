# Pre-release test: big-update

Written October 19, 2026. Updated October 20: the driver's ride history (new look, on the Availability page) and the duty
card's "i" label (groups A, B, C, H). This is step 2 of the release plan (ROADMAP.md, Phase 3, "Next steps").
Test everything on `big-update` once, on the phone and the website, before the release.

**Do not start the release** (merge into master, website, demo-ready-19 APK) until every group below
passes and the owner says so.

Time: about 1 hour 50 minutes. Each group shows its time. Do them in this order: later groups use what
earlier groups made (rides, alerts, duty records).

---

## Rules while testing

- **Don't fix anything during the test.** If a step fails, tick ❌, write what you saw (a screenshot helps)
  in "Results" at the end, and keep going. Fixes come after, one at a time.
- Everything uses the **real database**. Use test accounts only. Rides and alerts made today are cleaned
  up on October 22.
- **Never delete** admin1, dispatcher0, dispatcher1 or Driver jeb. Group G uses a throwaway account.
- "Expected" is what should happen. If you see something different, it is a ❌.

---

## 0. Setup (10 min)

- [ ] `git switch big-update` and `git pull`. `git status` is clean. Last commit is the checklist commit
      or newer.
- [ ] Start Metro for the phone development build: `npx expo start`. Open SakayNa on the phone(s) from
      the development build (not the demo-ready-18 APK).
- [ ] Website: in a second terminal, `npx expo start --web` (or the Vercel preview link for `big-update`
      from the Vercel dashboard). Chrome, normal zoom (100%).
- [ ] Phone location is ON. Phone text size is normal (big text is tested in group H).

**Devices**

| Role | Where | Account |
|---|---|---|
| Resident | Phone R (development build) | your test Resident (Active, barangay Daanglungsod) |
| Driver | Phone D (development build) | Driver jeb |
| Dispatcher | Website, Chrome window 1 | dispatcher0 |
| Admin | Website, Chrome window 2 (Incognito, so both can stay logged in) | admin1 |

**Only one phone?** Put the **Driver** on the phone (live location needs the phone's GPS). Use the
Resident on the website in a third Chrome window for groups B and C. For group D (emergency), log out
the Driver and log in as the Resident on the phone: the emergency call only works in the phone app.

**Before group D:** dispatcher0's account phone must be a number you can answer (Admin → Users →
dispatcher0). Answering an alert makes the Resident's phone **really call** that number.

---

## A. Start-up and log in, every role (5 min)

- [ ] Phone R: log in as the Resident. Expected: green header with the barangay, bottom bar **Your ride** /
      **History**, red Emergency at the top. Plus Jakarta Sans font, white cards.
- [ ] Phone D: log in as jeb. Expected: three tabs at the bottom (Ride, Map, Availability). The open tab
      has a light-green pill.
- [ ] Website window 1: log in as dispatcher0. Expected: requests (left), map (middle), drivers (right),
      no page scrolling.
- [ ] Website window 2: log in as admin1. Expected: header shows the icon, "SakayNa", "Daanglungsod".
- [ ] While each screen loads: grey placeholder cards, never a false "Inbox empty", "No rides yet" or 0s.
- [ ] Phone R and D: no buttons or last cards hidden under Android's bottom bar (◁ ○ □ or the swipe line).

## B. Normal ride + live location + route line (25 min)

**Driver goes on duty**
- [ ] Phone D: Availability. Expected: the Off duty card is one line, [clock] **Off duty** with a small
      **"i"** at the right, then the Punch in button. Tap the "i": a small white label with a dark edge shows
      "Dispatch can't give you rides until you punch in." and the location sentence. Tap anywhere: it closes.
- [ ] Phone D: **Punch in**, allow location.
- [ ] Phone D: the card's top line is [dot] **Available**, then "On duty for" with the running time under it,
      then the "i" at the right end. **Start break** and **Punch out** each have their words on one line.
      Tap the "i": "Punched in at …" and "Dispatch can give you rides." Tap outside: it closes.
- [ ] Dispatcher: jeb is in Driver availability as Available. On the map, jeb's pin appears. Hover it:
      "jeb · updated X min ago".
- [ ] Dispatcher: jeb's card → **Show on map**. Expected: the map slides to jeb's pin.

**Resident asks for a ride**
- [ ] Phone R: **Request a Ride**. Purpose **Medical / Health**, **As soon as possible**, Someone else
      (fill in a name and phone), people **2**, pin the pickup on the map, type a destination that exists
      (for example "Toledo City Hall"). **Review** → **Send request**.
- [ ] Phone R: Your ride shows the ride as waiting (orange band). A pinned pickup shows as
      "Pinned location", not numbers.
- [ ] Dispatcher: the request appears in the queue. Click it. Expected: the map moves to the pickup.
      Selected Request along the bottom shows the details on single lines.
- [ ] Dispatcher: assign it to **jeb** and a vehicle.

**Driver does the ride**
- [ ] Phone D: the ride appears on the Ride page. **Accept**.
- [ ] Dispatcher: a **green dashed line** from jeb's pin to the pickup. Hover its end dot:
      "Pickup · jeb".
- [ ] Phone R: the band changes (driver on the way), with the driver's name and vehicle.
- [ ] Phone D: **En route** → **Arrived** → **Picked up**. Phone R updates after each step.
- [ ] Dispatcher after Picked up: the line turns **orange** toward the destination, "Drop-off · jeb".
      (If the destination was not found on the map, there is **no line**. That is expected, not a ❌.)
- [ ] Phone D: **Complete mission**. Issues encountered: leave empty. Confirm.
- [ ] Phone R: the ride shows Completed. **History** tab: the ride is there with a Completed badge.
      Filters and search work.
- [ ] Phone D: **Availability**. Expected: laid out like the Resident's History page: the duty card on top
      (where the Resident has Emergency), then "Ride history" with filters and search, then one white card per
      ride (grey placeholder cards while loading). The card and the title stay put while the list scrolls. The
      ride is there with a grey **Completed** pill, its SKN reference and "Assigned …". Status filter, ride
      filter and search (type the SKN reference) work. The cards have no arrow and nothing opens when tapped.

**Live location (do this during the ride, or right after)**
- [ ] Walk at least 20 m with Phone D, SakayNa open. Expected: within about a minute, jeb's pin moves on
      the dispatcher map. The map does **not** blink or lose its zoom.
- [ ] Phone D: open another app (for example Google Maps from Navigate) for **3 minutes**.
      Expected: jeb's pin turns **grey and faded**, and the label starts with **"Old location"**.
- [ ] Come back to SakayNa on Phone D. Expected: the pin turns normal again within about a minute.

**Duty and break**
- [ ] Phone D: **Start break** (Lunch). Dispatcher: jeb shows On break, and can't be assigned.
- [ ] Phone D: the On break card's top line is [break icon] **On break**, then "Break time" with the running
      time under it, then the "i". Tap the "i": "Lunch break.", the note (if you typed one) and "Dispatch can't
      give you rides. Your time on duty is paused." Android's Back button closes it.
- [ ] Phone D: **Resume duty**. Dispatcher: jeb is Available again.
- [ ] Keep jeb punched in for groups C and D.

## C. Cancellation, scheduled ride, "I can't do this ride" (10 min)

- [ ] Phone R: **Request a Ride**, **Scheduled**. The calendar opens. Past days are greyed out. Pick
      tomorrow, and pick a time with the scroll-wheel. Purpose **Community Activity**. Send.
- [ ] Phone R: open the ride → **Cancel request** → confirm. Expected: Cancelled (grey, not red). The
      dispatcher's queue no longer shows it.
- [ ] Phone R: a new ride, As soon as possible. Dispatcher assigns it to jeb.
- [ ] Phone D: **Accept**, then **I can't do this ride** → Why? **Vehicle problem** → confirm.
- [ ] Dispatcher: orange **"Needs a new driver"** banner. jeb's card says "Reported: can't do a ride".
- [ ] Phone D: **Availability**, Ride history: that ride shows a grey **"Can't do"** pill. Status filter
      **Can't do** shows it.
- [ ] Dispatcher: assign it again to jeb (or another driver). Phone D: **Accept**, then finish the ride or
      leave it for later. Phone R: the ride is back on track.

## D. Emergency (15 min)

Phone R stays **on the SakayNa screen** until Answer.

- [ ] Phone R: tap **Emergency**. Expected: the waiting screen.
- [ ] Dispatcher: a **red strip** under the header, the "ding-dong" sound every 2 seconds, and the tab
      title "EMERGENCY – SakayNa". (If the browser blocks sound: "Sound blocked: click to turn sound on".)
- [ ] Dispatcher: **Sound off** stops the sound. The strip stays.
- [ ] Dispatcher: **Answer**. Phone R: counts down 3 seconds, then **calls** dispatcher0's phone.
      Answer that phone, then hang up.
- [ ] Dispatcher: fill in the Emergency request form (type Medical, 2 patients, a few details), choose
      jeb and a vehicle, **Submit request**.
- [ ] Phone D: the emergency ride appears. **Accept**, then **Complete mission**.
- [ ] End the alert (the Resident or the Dispatcher). The red strip is gone.
- [ ] **Second alert, cancel the countdown:** Phone R: Emergency → Dispatcher **Answer** → Phone R:
      cancel during the 3-second countdown. Expected: no call is made.
- [ ] **Third alert, decline:** Phone R: Emergency → Dispatcher **Decline**. Expected: Phone R shows "Dispatcher could not accept",
      and the strip is gone.
- [ ] Admin window: Emergency Calls lists today's three alerts with the right status.

## E. Admin website, including the new 3.19 layout (20 min)

Use admin1 in window 2. Chrome's size can be set with F12 → Ctrl+Shift+M → Responsive.

**Layout (3.19), at 1366×768**
- [ ] **Side menu**: every section is a row with an icon and its word, left aligned. The open one is a
      green pill with white words. Waiting counts are orange numbers at the end of their row (a red number
      only for an Emergency Call nobody answered).
- [ ] **Title lines**: every section starts the same way: a round icon (red for Emergency calls, green for
      the others), a big title, and a short explanation beside or under it.
- [ ] **Text size**: no Admin text looks tiny. Nothing is cut off or overlapping.

**Each section**
- [ ] **Overview at 1366×768**: two rows, no scrolling. The chart bars and day names stay inside the
      chart card. Numbers match today's tests (the active and completed counts went up).
- [ ] **Overview at 1366×600**: the panel scrolls. Nothing overlaps.
- [ ] **Requests**: short cards, 2 per row, the same height in a row. The emergency ride from group D has
      a **red edge** and a red **"Emergency"** pill. Click a card: the details pop-up opens and shows
      "Pinned location" for a pinned pickup. The Status and Ride for filters still match their counts.
- [ ] **Users**: Search and Role on one line. Search for jeb. Other-barangay and Admin accounts are view
      only. (After group G: the deleted account has a grey Deleted pill.)
- [ ] **Resident Verification / Driver Applications**: grey placeholders while loading, then one white
      list with a **Review** button on each row (or an empty state). Review opens the same pop-up.
- [ ] **Duty Records**: today's record for jeb: punch in, the break, rides completed, and the
      "I can't do this ride" report from group C. The day buttons work.
- [ ] **Operations**: one row of 6 tabs. Accounts: search and filters on one line, cards 2 per row,
      **Manage profile** opens the pop-up (close it without saving). **Logs**: one list, newest first.
- [ ] **Reports** (an Operations tab): download the CSV. It opens in Excel or Sheets.
- [ ] **Vehicles**: the **Add City/Barangay Vehicle** button is on the title line. Cards 3 per row. Edit
      opens the editor (close it without saving).

**Narrow window (900 wide)**
- [ ] The side menu is a row of pills above the panel. Requests and Operations show 1 card per row, the
      Operations tabs wrap onto 2 lines, Vehicles shows 2 per row. Nothing is cut off.

## F. Dispatcher extras (5 min)

- [ ] Hover a pickup pin: its label shows. Move the mouse away: it hides.
- [ ] A request typed without a pin: Selected Request shows "Approximate location (from typed address)".
- [ ] Phone D: **Punch out**. Dispatcher: jeb's pin is removed from the map, and jeb shows Off duty.

## G. Delete Account (10 min)

**First, check that deleting is blocked when it should be:**
- [ ] Phone D: punch in, then ☰ → Settings → **Delete account**. Expected: blocked (on duty).
      **Do not delete jeb.** Then punch out.
- [ ] Phone R: send a ride request (leave it Pending) → Settings → **Delete account**. Expected: blocked
      (open request). Then cancel that request.

**Then, a real delete with a throwaway account:**
- [ ] Create a new Resident account with **email** (not Google), for example `test-delete-1019@…`, finish
      sign-up. It can stay Pending.
- [ ] Settings → **Delete account**. Type the password, tick "I understand…", **Delete my account**.
      Expected: "Account deleted", then back to Log in.
- [ ] Try to log in with it again. Expected: the login fails (the account no longer exists).
- [ ] Admin → Users: the account has a grey **Deleted** pill and "Deleted on …". It is **not** in
      Resident Verification.
- [ ] Settings has **no** Change Password. Log in → **Forgot password** is still there.

## H. Big text (10 min)

Android: Settings → Display → Font size → **largest** (and Display size larger, if your phone has it).
Then reopen SakayNa.

- [ ] Phone R: home, Request a Ride form (all steps to Review), History, the ☰ menu, Settings, the
      Delete account sheet. Expected: words wrap, cards grow, nothing is cut off or overlapping, the sheets
      scroll, and Emergency is still visible.
- [ ] Phone R: ☰ → Terms, then Privacy Policy. They open on top of the menu with no flash. **← Back**
      returns to the menu.
- [ ] Phone D: Ride page with a ride, Availability (the duty card, the label from its "i", and the Ride
      history under it), Complete mission pop-up. Words wrap, the "i" label stays on the screen, the buttons
      stay readable. On the duty card the timer may move under "Available" / "On break", but nothing overlaps;
      Start break and Punch out may stack, but each keeps its words on one line, never cut off. The duty card never covers the whole screen: the Ride history list still has room and
      scrolls.
- [ ] Website: Chrome zoom **125%** (Ctrl and +) on the dispatcher and Admin pages. Expected: still usable,
      and the pages scroll instead of overlapping.
- [ ] Set the phone's font size back to normal.

---

## Results

Date: ________  Tester: ________  Commit tested: ________

| Group | Pass / ❌ | What went wrong (if ❌) |
|---|---|---|
| 0 Setup | | |
| A Start-up | | |
| B Ride + live location | | |
| C Cancel / unable | | |
| D Emergency | | |
| E Admin | | |
| F Dispatcher extras | | |
| G Delete Account | | |
| H Big text | | |

**All pass?** Tell Claude "pre-release test passed". Then the release can start (ROADMAP step 3). Record
the result in HANDOFF.md.
**Any ❌?** Send the list. Each ❌ is fixed and tested on its own. Then re-test only the groups it touches.
