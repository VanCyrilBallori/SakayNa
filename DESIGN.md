<!-- SEED: established with the user before implementation; re-run /impeccable document once there's code to capture the actual tokens and components. -->
---
name: SakayNa
description: Toledo City transport and emergency dispatch: a friendly, modern local service (see Style).
---

# Design System: SakayNa

## Overview

**Friendly local service.** SakayNa looks like a modern, well-made app that
clearly belongs to Toledo City: named, accountable and local (the barangay, the
vehicle, the person), with one big word per card, high contrast, readable at
arm's length by a 70-year-old. The look is set in "Style" below (UI refresh,
October 2026).

- **Scene:** a senior at home in daylight or under a fluorescent tube, phone held
  at arm's length, often worried. This forces a light screen: white ground,
  near-black type.
- **Mode:** Operate. Clarity beats decoration. Character comes from naming, the
  big type, and two signature parts (below).
- **Feel:** friendly and lively, not plain: a bright green, an orange
  highlight, soft round corners and soft shadows (UI refresh, Oct 2026).
  Easy to read; the style never costs contrast.
- **Scope:** every app screen for all four roles, including the mobile landing
  page and Get Started sheet (components/MobileLanding.jsx).
- **Theme:** light only. The Dark / Light switch is removed when Settings is
  redone. Dark mode may come back later as its own plan.
- **Language:** English for now. Layouts leave room for labels about 30% longer
  (for a later Cebuano version).

**Signature parts** (reused everywhere):
- **Place strip:** a full-width Hall Green strip with white text naming the
  place: "Toledo City · Barangay {resident's barangay}".
- **Route board:** any trip shows "From" and "To" as two stacked lines, place
  names in Board size, joined by a short vertical Hall Green line. "From" has a
  Hall Green ring; "To" has a solid Sakay Orange dot.
- **Status band:** the top of a request card is one solid colored band with one
  status in Board or Title text ("Waiting for a driver", "Driver on the way").
  Band color and text color follow the state (see "Status band colors").
- **Barangay vehicle:** vehicles are named ("Barangay Van 1") and drawn like a
  barangay van with a Hall Green stripe, never as a sedan. [Illustration to be made
  during the build]

**The Named Place Rule.** Every main screen says where and who: the barangay,
the vehicle's name, the dispatcher's name when known. Never a faceless
"a driver".

**The Arm's-Length Rule.** If it can't be read at arm's length on a basic phone,
it is too small or too faint.

## Colors

Strategy: Lively but disciplined. White and ink, one bright green, one orange
for highlights, one red only for emergencies. Green carries the screen; orange
is spent on a few things the resident should notice; red stays rare.

### Primary
- **Hall Green (#0B7A4B):** primary buttons, place strip, links, selected
  states, route-board line. White text on it: 5.39:1. As text: 5.39:1 on white,
  4.80:1 on Board Tint, 4.65:1 on Peach Tint.
- **Hall Green Deep (#0B5A37):** pressed state; status band for "Assigned" and
  "On the way". White text on it: 8.29:1.

### Secondary
- **Emergency Red (#B42318):** the Emergency button, emergency alert screens, and
  "can't be undone" confirms only. White text on it: 6.57:1.
- **Red Tint (#FCE9E7):** background behind red message text (5.62:1).

### Tertiary
- **Sakay Orange (#FF8A00):** highlights: the "Waiting" and "Your driver is here"
  status bands, small tags and badges, the destination dot on the route board.
  Ink text on it: 7.03:1. White text on it: 2.36:1, so never white. Chosen by
  the group (Oct 2026) over #F97316: more golden, and easier for colorblind
  people to tell apart from Emergency Red. Don't move it toward red.
- **Orange Deep (#B34D00):** small orange words only, on white or Peach Tint
  (a scheduled time like "Fri, Oct 9, 9:00 AM", an icon in a peach box).
  5.28:1 on white, 4.55:1 on Peach Tint. Never a large fill.
- **Peach Tint (#FDECD3):** background of important info boxes (account pending,
  scheduled-ride notes). Ink 14.3:1, Ink Muted 6.1:1.

Retired: Waiting Amber (#8A5A00) and Amber Tint (#FFF4D6). Orange and Peach
replace them.

### Neutral
- **Paper White (#FFFFFF):** screens, sheets, cards.
- **Board Tint (#EEF3F0):** grouped sections and list backgrounds. Never cream.
- **Ink (#14211C):** all main text and route-board type (16.6:1).
- **Ink Muted (#4A5C55):** secondary text (7.1:1 on white, 6.3:1 on Board Tint);
  status band for "Completed" and "Cancelled".
- **Control Outline (#6B8079):** edges of inputs and outline buttons (4.2:1).
- **Placeholder (#5E6E68):** placeholder text in inputs (5.4:1).
- **Rule (#C5D1CB):** decorative dividers only. Never the only edge of something
  you can tap.

**The One Red Rule.** Red means emergency or "this can't be undone". One red
(#B42318) everywhere; #CF0000 and other reds are retired. A ride the resident
cancelled is shown in Ink Muted, not red.

**The One Green Rule.** One green family (Hall Green and Hall Green Deep). The old
greens (#06774B, #3B6255, #2B4A40) and other hard-coded greens are retired in
redesigned screens. The logo keeps its own green; the app does not copy it.

**Red has white words. Orange has dark words.** Any orange dark enough to hold
white text looks like Emergency Red to red-green colorblind people. So big
orange areas are always Sakay Orange with Ink text, and Orange Deep is only for
small orange words. Orange is never used for errors, warnings about danger, or
anything that can't be undone; that is red's job.

**Status band colors.** Waiting / Pending / Scheduled: Sakay Orange, Ink text.
Assigned / On the way: Hall Green Deep, white text. Your driver is here: Sakay
Orange, Ink text. Completed / Cancelled: Ink Muted, white text. Never red.

**The Word-With-Every-Color Rule.** No state is shown by color alone. Every color
comes with a word ("Waiting", "On the way").

## Typography

Plus Jakarta Sans (see "Style", Font). Font scaling is always on.

### Hierarchy (sp; grows with the phone's text-size setting)
- **Board (28/34, weight 800):** route-board place names, the status band line,
  the Emergency label.
- **Title (22/28, 700):** screen and sheet titles.
- **Label (17/22, 600):** field labels, button text, menu rows.
- **Body (17/24, 400–500):** sentences and explanations.
- **Small (15/20, 500):** dates and reference numbers. This is the floor: nothing
  smaller, except the map's own credit line.

**The Route-Board Rule.** One big thing per card: the place or the status, in
Board size. Everything else on that card is at least two steps smaller.

**The No-Whisper Rule.** No small, spaced-out ALL-CAPS labels. Sentence case;
capitals only for proper names.

## Layout

- 16dp side margins. Spacing from the existing scale: 4, 8, 12, 16, 24, 32.
- One column. A choice that matters is never two equal buttons side by side:
  the main action goes on top at full width, Cancel underneath. (Only
  exception: the website Emergency request form, see "Website exception".)
- Touch targets at least 48dp, main actions at least 56dp, Emergency at least
  76dp, with at least 8dp between targets.
- Main actions sit in the lower half of the screen (thumb reach). The place
  strip sits at the top.
- Works at text size 1.3× and 1.5×: text wraps, cards grow, sheets scroll.
  Addresses and place names are never cut to one line.

## Style (UI refresh, October 2026)

**Friendly local service.** SakayNa should feel like a modern, well-made app
that still clearly belongs to Toledo City: it names the barangay, the vehicle
and the person, and never looks like a ride-hailing or government app. Calm
white cards on an off-white page, one green, one orange highlight, and red
only for emergencies. The accessibility rules in this file (type sizes, text
scaling, touch sizes, contrast, word with every color, colorblind rules)
always win over this section.

### Font
- **Plus Jakarta Sans** everywhere (phone and website), loaded with
  `@expo-google-fonts/plus-jakarta-sans`. Font scaling stays on.
- Weights: Board and the Emergency label 800 (ExtraBold); Title 700 (Bold);
  Label and buttons 600 (SemiBold); Body 400 (Regular); Small 500 (Medium).
- Each weight is its own font name (Android needs this), so text styles use the
  font names in `constants/design.js` (`FONT`) instead of `fontWeight`.

### Color scales (brand colors unchanged)
Hall Green = green 600, Hall Green Deep = green 800, Sakay Orange = orange 500,
Orange Deep = orange 700, Peach Tint = orange 100, Board Tint = neutral 100,
Ink = neutral 900. Ratios are against white unless stated.

| Step | Green | Orange | Neutral |
|---|---|---|---|
| 50  | #EAF6F0 | #FFF6EA | #F5F8F6 (page) |
| 100 | #D2ECDF | #FDECD3 | #EEF3F0 |
| 200 | #A6D8BF | #FFD7A3 | #DDE5E1 |
| 300 | #72C09B | #FFBE6B | #C5D1CB |
| 400 | #3FA474 | #FFA43A | #93A39C |
| 500 | #1A8C5B | #FF8A00 | #6B8079 |
| 600 | #0B7A4B | #D96F00 | #5E6E68 |
| 700 | #0A6A41 | #B34D00 | #4A5C55 |
| 800 | #0B5A37 | #8A3A00 | #2B3A34 |
| 900 | #083F27 | #5E2700 | #14211C |

- Text colors: neutral 900 (main), 700 (secondary), 600 (placeholder).
  Green 600-900 as text: 5.4:1 or more. Orange as text: 700 and darker, small words only.
- Tinted boxes: 50/100 background with 700-900 words (green 600 on green 50
  4.9:1, orange 700 on orange 50 4.9:1).
- Orange fills: 100-500 only, always with Ink words. Orange 600-900 are never
  large fills (they look red to colorblind people).
- Neutral 200-400 are edges and dividers only, never text.
- Red: red 50 #FCE9E7 (tint), red 600 #B42318 (Emergency Red), red 700
  #8E1B12 (pressed). Still only emergency and "can't be undone".
- Page background: neutral 50. Cards, sheets and inputs: white.

### Elevation (soft shadows)
- Level 1, cards and list groups: `0 1px 3px rgba(20,33,28,.08), 0 1px 2px rgba(20,33,28,.04)`,
  plus a 1dp neutral-200 edge (white on off-white is too faint in daylight).
- Level 2, floating buttons, menus, map controls: `0 4px 12px rgba(20,33,28,.12)`.
- Level 3, bottom sheets and dialogs: `0 -8px 24px rgba(20,33,28,.16)`, with
  the dark backdrop behind.
- No card inside a card. No shadow on text or icons.

### Corners
- 8: small tags inside tables, checkboxes, map +/- controls.
- 12: inputs, dropdowns, selected list rows.
- 16: cards, banners, info boxes, dialogs, map frames.
- 24: top corners of bottom sheets; the Emergency button.
- Pill (fully round): all buttons except Emergency, chips, segmented
  controls, status badges, count badges, avatars.
- The Emergency button keeps its 24 corners, so its shape differs from every
  other button.

### Buttons
- Primary: green 600 fill, white words; pressed green 800. Secondary: white
  with a 1.5dp neutral-500 edge, green 700 words. Text button: green 700
  words, no fill. Destructive: red 600 fill, white words. Heights 48
  (normal) / 56 (main action).
- Disabled: neutral 200 fill with neutral 700 words (5.5:1), and the reason
  nearby (not color only).

### Icons
- Material Community Icons only (`@expo/vector-icons`), outline variants.
  20 inside text and chips, 24 in rows and buttons, 28 in big tiles and the
  bottom bar.
- Icon color follows its text. An icon never stands alone without a word
  (except the documented "Back to home" house button, and the driver duty
  card's "i" button: 48 to tap, read as "Punch info" by screen readers; it
  opens a small label with the card's explaining sentences. Owner's choice,
  Oct 20, 2026; and the dispatcher's muted-bell button at the end of the red
  emergency strip's first line while the sound is off: 48 to tap, never
  shrinks, hover and screen readers say "Sound is off. Turn it on in your
  profile menu.", a click turns the sound back on. Owner's choice, Oct 25,
  2026).

### Motion
- Press: 100 ms, slightly darker fill (and scale 0.98 for cards and big buttons).
- Bottom sheets: slide up 250 ms ease-out, backdrop fades in 200 ms, close in 200 ms.
- Dialogs: fade and grow from 96%, 200 ms. Content updates: 150 ms fade.
- Nothing loops except loading skeletons and the dispatcher emergency strip.
- **Reduce motion** (phone setting or browser): no sliding or scaling; things
  appear at once (at most a 150 ms fade).

### Patterns
- **Bottom sheets** for choices and short forms (grabber bar, 24 top corners, level 3).
- **Chips** (pill, 48 tall): filters and quick choices. Selected = green 600
  fill with white words and a check icon.
- **Segmented controls** (pill track neutral 100, white selected part with
  level 1) for 2-3 views of the same thing.
- **List rows**: at least 56 tall, leading icon in a 40dp green-50 circle,
  title (Label) and one detail line (Small), chevron if it opens something.
- **Status badges**: pill, tinted background with the status word. Status
  band colors still apply to full bands.
- **Empty states**: a 48 icon in a 96dp tinted circle, a title, one
  sentence, and the next action if there is one.
- **Request in the resident's bottom bar** (owner's choice, Oct 20, 2026):
  the middle of three buttons (Your ride | Request | History), the same size
  and look as the other two: a white "+" in a 36 green 600 circle (in the
  bar, not raised above it), with the word "Request" under it. It opens the
  Request a Ride form, so it never shows the green "open" pill.
- **Place strip** and **route board** stay (they make it local and clear),
  restyled with the new font, scales and corners.

### Gradients
- Only on the landing and welcome screens (mobile landing, website landing,
  the website Log In / Create Account green panel): green 600 to green 800,
  or green 50 to white. Never on cards, buttons, or anything with small
  text on top.
- Still no glass, blur, or see-through panels.

### Dates and times (one format everywhere, Philippine time)
- Date and time: "Tue, Oct 20, 2:00 PM". Date only: "Tue, Oct 20". Time
  only: "2:00 PM".
- Add the year only when it isn't this year: "Sun, Oct 4, 2025".
- Never seconds, never number-only dates like "29/9/2026".
- Durations: "1 hr 5 min". "just now" / "5 min ago" only for live things
  under an hour (locations, alerts); otherwise the full date.
- One helper in `lib/dates.js` makes all of these.
- Exception: Admin CSV/report downloads keep their current date format
  (spreadsheets need their own format).

## Do's and Don'ts

### Do:
- Name the place, the vehicle, and the person when known.
- Use the route board for every trip and the status band for every request.
- Use one icon set (Material Community Icons, outline style), always with a
  word. Vans and ambulances, never sedans.
- Keep Emergency visible and one tap away on the home screen, in every state.

### Don't:
- Don't use the Toledo City seal, any LGU logo, the word "Official", or wording
  that says the city government runs or endorses SakayNa.
- Don't use ride-hailing language or pictures: fares, "Book now", sedan icons,
  promo banners, city skylines. Exception: the mobile landing page heading
  "Request a Ride now" is allowed (owner's choice, Oct 2026). Don't change it.
- Don't use glass effects, blur, or colored stripes down the side of cards.
  Shadows and gradients only as "Style" allows.
- Don't put cards inside cards.
- Don't use corner sizes outside the Style scale (8, 12, 16, 24, pill).
- Don't put white text on orange, and don't use orange for danger or errors.
- Don't use tiny spaced-out ALL-CAPS labels, even if a reference picture has them.

**Android illustration exception:** The Android landing middle illustration (`assets/images/landing-roadscape.png`) is an AI-generated picture allowed to have soft shading and several greens; this applies to this one picture only.

## Website exception

The dispatcher's Emergency request form is a computer task. On wide website
screens it may use 2–3 columns, with 12dp gaps and 16dp outer padding, to
reduce scrolling. Incident details and the quick facts sit beside each
other; driver and vehicle choices sit beside each other. Narrow screens
stack in one column. Keep the existing type scale, 48dp minimum controls,
and 16/24dp corners. This exception applies only to this form; the
dispatcher header and other screens keep their own layout.

Look of this form (approved by the group, Oct 2026):
- Each section sits on its own soft color inside the white card: Board
  Tint for caller and call information, Red Tint for emergency details,
  Peach Tint for driver and vehicle. Each section title has a round
  color badge (Hall Green or Emergency Red with a white icon, Sakay
  Orange with an Ink icon). Red is used for the emergency itself: the
  Emergency details section and the Emergency priority choice.
- Choices (Priority, Conscious, Breathing) are pill-shaped (fully
  round). The chosen one fills Hall Green with white words; a chosen
  "Emergency" priority fills Emergency Red with white words. The patient
  + and − buttons are fully round (48 × 48). The reference tag is a
  Sakay Orange pill with Ink words.
- Submit request and Cancel sit side by side on the right:
  [Submit request] [Cancel], each as wide as its words and 48dp tall.
  The "After Submit" note sits to their left. On a narrow screen they
  wrap under the note.

The website landing page (app/index.jsx) and the green left panel of the
website Log In and Create Account pages (wide screens only,
components/WebAuthPanel.jsx) may use the landing page style:

- the landing green (#0F6B4F) instead of Hall Green, and
- its two soft see-through circles in the corners.

On those two website pages, the top-right "Back to home" button may be a
house icon without a word, because there is a screen-reader label
("Back to home") and the button is at least 48px.

Everything else on those pages, and every phone screen, follows the rules
above.

## Admin website exception (Task 3.19, October 2026)

The Admin website is a computer task with a mouse, often with long lists.
It may be **denser** than the phone screens: less empty space, not smaller
text. This applies only to the Admin website (`app/admin-home.jsx` and
`features/admin/components`). Phone screens and the dispatcher website keep
their own rules.

- **Text:** the normal type scale. Nothing under 15 (Small). The section
  title is 28, card titles 17-22, rows and details 15-17.
- **Frame:** the header (icon, "SakayNa", barangay, the Admin's initials)
  stays at the top. On wide windows (1080 px and up) the side menu is on the
  left and the section panel on the right; only the panel scrolls. Narrower
  windows put the side menu above the panel as a row of pills, and the page
  scrolls.
- **Side menu:** one row per section: an icon (24) and its word, left
  aligned, at least 48 tall. The open section is a green 600 pill with white
  words. Count badges sit at the right end (red only for Emergency Calls).
- **Section title line:** every section starts the same way: a 40 round
  badge with a white icon (Emergency Calls red, all others Hall Green), the
  title, and one short explanation beside it (or under it when there is no
  room).
- **Spacing:** gaps 8 or 12; card and row padding 12-16. Lists are short
  rows or cards, in 2-3 columns on wide windows and one column on narrow
  ones. A row's details open in the existing pop-ups.
- **Controls:** small buttons and chips inside lists and filters may be 40
  tall (a mouse is precise), with at least 8 between them. Main actions in
  pop-ups (Save, Approve, Reject) stay at least 48.
- Colors, corners, shadows, the word-with-every-color rule and the one red
  rule are unchanged.
