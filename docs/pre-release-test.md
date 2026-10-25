# Pre-release test: big-update

Written October 19, 2026. Updated October 20: the driver's ride history (new look, on the Availability page) and the duty
card's "i" label (groups A, B, C, H); the Resident's Request button in the bottom bar and the
empty "Your ride" card after a ride ends (groups A, B, C, G, H). Updated October 25: the demo accounts
(AdminDemo, DispDemo, DriDemo, ResDemo); the emergency form that stays open until Submit or End emergency,
"Help is on the way", "Pinned location" instead of Plus Codes, the "Live" / "Last known" location labels and the
muted bell (group D); the Operations status buttons (group E) and the driver's "Account on hold" page
(group F). This is step 2 of the release plan (ROADMAP.md, Phase 3, "Next steps").
Test everything on `big-update` once, on the phone and the website, before the release.

**Do not start the release** (merge into master, website, demo-ready-19 APK) until every group below
passes and the owner says so.

Time: about 2 hours. Each group shows its time. Do them in this order: later groups use what
earlier groups made (rides, alerts, duty records).

---

## Rules while testing

- **Don't fix anything during the test.** If a step fails, tick ❌, write what you saw (a screenshot helps)
  in "Results" at the end, and keep going. Fixes come after, one at a time.
- Everything uses the **real database**. Use the demo accounts below only.
- **Never delete** AdminDemo, DispDemo, DriDemo or ResDemo. Group G uses a throwaway account.
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
| Resident | Phone R (development build) | ResDemo (Juan Dela Cruz) |
| Driver | Phone D (development build) | DriDemo (Gwen Dolyn) |
| Dispatcher | Website, Chrome window 1 | DispDemo (Jonathan Joestar) |
| Admin | Website, Chrome window 2 (Incognito, so both can stay logged in) | AdminDemo (Jose Joestar) |

All four are in barangay Daanglungsod.

**Only one phone?** Put the **Driver** on the phone (live location needs the phone's GPS). Use the
Resident on the website in another browser window (for example Edge InPrivate) for groups B and C. For
group D (emergency), log out the Driver and log in as the Resident on the phone: the emergency call only
works in the phone app. DriDemo stays punched in while logged out. When a step needs the Driver, log out
the Resident and log in as DriDemo.

**Before group D:** DispDemo's account phone must be a number you can answer (Admin → Users →
DispDemo). Answering an alert makes the Resident's phone **really call** that number. (If it is the same
phone's own number, the call can't connect: seeing the phone start the call is enough.)

---

## A. Start-up and log in, every role (5 min)

- [ ] Phone R: log in as the Resident. Expected: green header with the barangay, red Emergency at the top,
      no green Request a Ride button on the page. Bottom bar: **Your ride**, **Request** (white + in a green circle),
      **History**, all three the same size, nothing sticking up above the bar. Plus Jakarta Sans font, white cards.
- [ ] Phone R: Your ride with no open ride: "No ride right now" and "Tap Request below to ask for a ride.
      Your past rides are in History."
- [ ] Phone D: log in as DriDemo. Expected: three tabs at the bottom (Ride, Map, Availability). The open tab
      has a light-green pill.
- [ ] Website window 1: log in as DispDemo. Expected: requests (left), map (middle), drivers (right),
      no page scrolling.
- [ ] Website window 2: log in as AdminDemo. Expected: header shows the icon, "SakayNa", "Daanglungsod".
- [ ] While each screen loads: grey placeholder cards, never a false "Inbox empty", "No rides yet" or 0s.
- [ ] Phone R and D: no buttons or last cards hidden under Android's bottom bar (◁ ○ □ or the swipe line).
- [ ] Phone R: scroll to the bottom of Your ride and of History. The last card is fully visible above the bar.

## B. Normal ride + live location + route line (25 min)

**Driver goes on duty**
- [ ] Phone D: Availability. Expected: the Off duty card is one line, [clock] **Off duty** with a small
      **"i"** at the right, then the Punch in button. Tap the "i": a small white label with a dark edge shows
      "Dispatch can't give you rides until you punch in." and the location sentence. Tap anywhere: it closes.
- [ ] Phone D: **Punch in**, allow location.
- [ ] Phone D: the card's top line is [dot] **Available**, then "On duty for" with the running time under it,
      then the "i" at the right end. **Start break** and **Punch out** each have their words on one line.
      Tap the "i": "Punched in at …" and "Dispatch can give you rides." Tap outside: it closes.
- [ ] Dispatcher: Gwen Dolyn (DriDemo) is in Driver availability as Available. On the map, her pin appears.
      Hover it: "Gwen Dolyn · updated X min ago".
- [ ] Dispatcher: DriDemo's card → **Show on map**. Expected: the map slides to DriDemo's pin.

**Resident asks for a ride**
- [ ] Phone R: tap **Request** (+) in the bottom bar. The Request a Ride form opens. Purpose
      **Medical / Health**, **As soon as possible**, Someone else (fill in a name and phone), people **2**, pin the pickup on the map, type a destination that exists
      (for example "Toledo City Hall"). **Review** → **Send request**.
- [ ] Phone R: Your ride shows the ride as waiting (orange band). A pinned pickup shows as
      "Pinned location", not numbers.
- [ ] Dispatcher: the request appears in the queue. Click it. Expected: the map moves to the pickup.
      Selected Request along the bottom shows the details on single lines.
- [ ] Dispatcher: assign it to **DriDemo** and a vehicle.

**Driver does the ride**
- [ ] Phone D: the ride appears on the Ride page. **Accept**.
- [ ] Dispatcher: a **green dashed line** from DriDemo's pin to the pickup. Hover its end dot:
      "Pickup · Gwen Dolyn".
- [ ] Phone R: the band changes (driver on the way), with the driver's name and vehicle.
- [ ] Phone D: **En route** → **Arrived** → **Picked up**. Phone R updates after each step.
- [ ] Dispatcher after Picked up: the line turns **orange** toward the destination, "Drop-off · Gwen Dolyn".
      (If the destination was not found on the map, there is **no line**. That is expected, not a ❌.)
- [ ] Phone D: **Complete mission**. Issues encountered: leave empty. Confirm.
- [ ] Phone R: Your ride goes back to empty ("No ride right now"), with a small grey line
      "Last ride: Completed · [time]". **History** tab: the ride is there with a Completed badge.
      Filters and search work.
- [ ] Phone D: **Availability**. Expected: laid out like the Resident's History page: the duty card on top
      (where the Resident has Emergency), then "Ride history" with filters and search, then one white card per
      ride (grey placeholder cards while loading). The card and the title stay put while the list scrolls. The
      ride is there with a grey **Completed** pill, its SKN reference and "Assigned …". Status filter, ride
      filter and search (type the SKN reference) work. The cards have no arrow and nothing opens when tapped.

**Live location (do this during the ride, or right after)**
- [ ] Walk at least 20 m with Phone D, SakayNa open. Expected: within about a minute, DriDemo's pin moves on
      the dispatcher map. The map does **not** blink or lose its zoom.
- [ ] Phone D: open another app (for example Google Maps from Navigate) for **3 minutes**.
      Expected: DriDemo's pin turns **grey and faded**, and the label starts with **"Old location"**.
- [ ] Come back to SakayNa on Phone D. Expected: the pin turns normal again within about a minute.

**Duty and break**
- [ ] Phone D: **Start break** (Lunch). Dispatcher: DriDemo shows On break, and can't be assigned.
- [ ] Phone D: the On break card's top line is [break icon] **On break**, then "Break time" with the running
      time under it, then the "i". Tap the "i": "Lunch break.", the note (if you typed one) and "Dispatch can't
      give you rides. Your time on duty is paused." Android's Back button closes it.
- [ ] Phone D: **Resume duty**. Dispatcher: DriDemo is Available again.
- [ ] Keep DriDemo punched in for groups C and D.

## C. Cancellation, scheduled ride, "I can't do this ride" (10 min)

- [ ] Phone R: **Request** (+), **Scheduled**. The calendar opens. Past days are greyed out. Pick
      tomorrow, and pick a time with the scroll-wheel. Purpose **Community Activity**. Send.
- [ ] Phone R: open the ride → **Cancel request** → confirm. Expected: Your ride goes back to empty, with
      **no** "Last ride" line. History shows it as Cancelled (grey, not red). The dispatcher's queue no
      longer shows it.
- [ ] Phone R: a new ride, As soon as possible. Dispatcher assigns it to DriDemo.
- [ ] Phone D: **Accept**, then **I can't do this ride** → Why? **Vehicle problem** → confirm.
- [ ] Dispatcher: orange **"Needs a new driver"** banner. DriDemo's card says "Reported: can't do a ride".
- [ ] Phone D: **Availability**, Ride history: that ride shows a grey **"Can't do"** pill. Status filter
      **Can't do** shows it.
- [ ] Dispatcher: assign it again to DriDemo (or another driver). Phone D: **Accept**, then finish the ride or
      leave it for later. Phone R: the ride is back on track.

## D. Emergency (20 min)

Phone R stays **on the SakayNa screen** until Answer.

**First alert: a ride is sent**
- [ ] Phone R: tap **Emergency**. Expected: the waiting screen. Under it a location line: first
      "Location: sending…", then "Location: sent" (or "Location: last known sent, still looking…" while
      the phone looks for a fresh position).
- [ ] Dispatcher: a **red strip** under the header, the "ding-dong" sound every 2 seconds, and the tab
      title "EMERGENCY – SakayNa". (If the browser blocks sound: "Sound blocked: click to turn sound on".)
- [ ] Dispatcher: the strip says "GPS location (live): …" or "GPS location (last known · X min ago): …".
      No Plus Code (like "9JQX+XH7") anywhere in the strip.
- [ ] Dispatcher: profile circle → **Sound off** stops the sound. The strip stays. A muted-speaker icon
      shows next to the profile circle, and a round **muted-bell** button is at the end of the strip's first
      row. Hover the bell: "Sound is off. Turn it on in your profile menu." Click the bell: the sound comes
      back, and the bell and the speaker icon go away.
- [ ] Dispatcher: **Answer**. Phone R: counts down 3 seconds, then **calls** DispDemo's phone.
      Answer that phone, then hang up.
- [ ] Dispatcher: the **Emergency request form** opens at once and covers the page. There is no "Active
      emergency" card. The form has **no** Back or Cancel button, only **Submit request** and
      **End emergency (no ride needed)**.
- [ ] Dispatcher: the form's top box shows Juan Dela Cruz, "Resident's number: …", "Barangay / place:
      Daanglungsod" (no Plus Code), "Live" or "Last known · X min ago", and **Open location in Maps**.
      Click it: Google Maps opens at the pin. The Pickup location box says "Pinned location".
- [ ] Dispatcher: reload the page (F5). Expected: the form opens again by itself for this alert.
- [ ] Dispatcher: fill in the form (type Medical, 2 patients, a few details, a destination), choose
      DriDemo and a vehicle, **Submit request**. Expected: the form closes, the dashboard and the map
      come back (the map is not blank), and there is no red strip: Submit also ended the alert.
- [ ] Phone R: the pop-up says **"Help is on the way"** and "Gwen Dolyn is coming with [vehicle]. See Your
      ride for updates." Tap **Done**. Your ride shows the emergency ride.
- [ ] Phone D: the emergency ride appears. **Accept**, then **Complete mission**.

**Second alert: End emergency (no ride needed)**
- [ ] Phone R: Emergency → Dispatcher **Answer** (let the call start, then hang up).
- [ ] Dispatcher: in the form, **End emergency (no ride needed)**. Expected: a question "End this
      emergency?" with **End emergency** and **Keep it open**. Click **Keep it open**: the form stays.
      Then End emergency (no ride needed) → **End emergency**: the form closes, no ride is made.
- [ ] Phone R: the pop-up says "Alert closed".

**Third alert, cancel the countdown; fourth alert, decline**
- [ ] Phone R: Emergency → Dispatcher **Answer** → Phone R: cancel during the 3-second countdown.
      Expected: no call is made. (The dispatcher's form still opens: close it with End emergency (no ride
      needed).)
- [ ] Phone R: Emergency → Dispatcher **Decline**. Expected: Phone R shows "Dispatcher could not accept",
      and the strip is gone.
- [ ] Admin window: Emergency Calls lists today's four alerts with the right status.

## E. Admin website, including the new 3.19 layout (20 min)

Use AdminDemo in window 2. Chrome's size can be set with F12 → Ctrl+Shift+M → Responsive.

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
- [ ] **Users**: Search and Role on one line. Search for DriDemo. Other-barangay and Admin accounts are view
      only. (After group G: the deleted account has a grey Deleted pill.)
- [ ] **Resident Verification / Driver Applications**: grey placeholders while loading, then one white
      list with a **Review** button on each row (or an empty state). Review opens the same pop-up.
- [ ] **Duty Records**: today's record for DriDemo: punch in, the break, rides completed, and the
      "I can't do this ride" report from group C. The day buttons work.
- [ ] **Operations**: one row of 6 tabs. Accounts: search and filters on one line, cards 2 per row,
      **Manage profile** opens the pop-up (close it without saving). **Logs**: one list, newest first.
- [ ] **Operations → Accounts, status buttons** (look only, don't apply): Manage profile on ResDemo.
      Account status says "Now: Active" and offers only **Suspended** and **Deactivated**. DriDemo: "Now:
      Approved", only Suspended and Deactivated. (No Pending, Rejected or Disabled buttons.) Close.
- [ ] **Reports** (an Operations tab): download the CSV. It opens in Excel or Sheets.
- [ ] **Vehicles**: the **Add City/Barangay Vehicle** button is on the title line. Cards 3 per row. Edit
      opens the editor (close it without saving).

**Narrow window (900 wide)**
- [ ] The side menu is a row of pills above the panel. Requests and Operations show 1 card per row, the
      Operations tabs wrap onto 2 lines, Vehicles shows 2 per row. Nothing is cut off.

## F. Dispatcher extras, driver on hold (10 min)

- [ ] Hover a pickup pin: its label shows. Move the mouse away: it hides.
- [ ] A request typed without a pin: Selected Request shows "Approximate location (from typed address)".
- [ ] Phone D: **Punch out**. Dispatcher: DriDemo's pin is removed from the map, and DriDemo shows Off duty.

**Driver "Account on hold"** (DriDemo must be punched out with no open ride)
- [ ] Admin → Operations → Accounts → DriDemo → Manage profile. Reason "Test hold". Choose **Suspended** →
      **Apply status: Suspended** → confirm. Expected: "Now: Suspended", and the buttons change to
      **Approved** and **Deactivated**.
- [ ] Phone D: log out and log in as DriDemo. Expected: "Account on hold", a peach box "Your driver account
      is on hold.", "You can't punch in or take rides for now.", "Reason: Test hold". **Not** "Application
      Status" or "being reviewed".
- [ ] Admin: DriDemo → reason "Test done" → **Approved** → Apply → confirm. Expected: "Now: Approved".
- [ ] Phone D: log out and log in as DriDemo again. Expected: the normal driver home (Ride, Map,
      Availability).

## G. Delete Account (10 min)

**First, check that deleting is blocked when it should be:**
- [ ] Phone D: punch in, then ☰ → Settings → **Delete account**. Expected: blocked (on duty).
      **Do not delete DriDemo.** Then punch out.
- [ ] Phone R: send a ride request (leave it Pending) → Settings → **Delete account**. Expected: blocked
      (open request). Then cancel that request.

**Then, a real delete with a throwaway account:**
- [ ] Create a new Resident account with **email** (not Google), for example `test-delete-1025@…`, finish
      sign-up. It can stay Pending.
- [ ] Admin → Operations → Accounts → that new account → Manage profile. Expected: **no** status buttons,
      only the note "A Pending or Rejected resident is decided in Resident Verification, where the proof of
      residency is." Close.
- [ ] Settings → **Delete account**. Type the password, tick "I understand…", **Delete my account**.
      Expected: "Account deleted", then back to Log in.
- [ ] Try to log in with it again. Expected: the login fails (the account no longer exists).
- [ ] Admin → Users: the account has a grey **Deleted** pill and "Deleted on …". It is **not** in
      Resident Verification.
- [ ] Settings has **no** Change Password. Log in → **Forgot password** is still there.

## H. Big text (10 min)

Android: Settings → Display → Font size → **largest** (and Display size larger, if your phone has it).
Then reopen SakayNa.

- [ ] Phone R: home, the bottom bar (the three words not cut off), Request a Ride form (all steps to Review), History, the ☰ menu, Settings, the
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
| F Dispatcher extras + on hold | | |
| G Delete Account | | |
| H Big text | | |

**All pass?** Tell Claude "pre-release test passed". Then the release can start (ROADMAP step 3). Record
the result in HANDOFF.md.
**Any ❌?** Send the list. Each ❌ is fixed and tested on its own. Then re-test only the groups it touches.
