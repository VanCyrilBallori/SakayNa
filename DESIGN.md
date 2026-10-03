<!-- SEED: established with the user before implementation; re-run /impeccable document once there's code to capture the actual tokens and components. -->
---
name: SakayNa
description: Toledo City transport and emergency dispatch: a barangay-hall notice board with route-board type.
---

# Design System: SakayNa

## Overview

**Barangay Hall + Route Board.** SakayNa looks like the plain, named, accountable
signs residents already trust (the barangay hall notice board, the painted door
of a barangay vehicle) and reads like a jeepney route board: one big word, high
contrast, readable at arm's length by a 70-year-old.

- **Scene:** a senior at home in daylight or under a fluorescent tube, phone held
  at arm's length, often worried. This forces a light screen: white ground,
  near-black type.
- **Mode:** Operate. Clarity beats decoration. Character comes from naming, the
  big type, and two signature parts (below).
- **Feel:** friendly and lively, not plain: a bright green, an orange
  highlight, and soft round corners (color update, Oct 2026). Still flat and
  easy to read; the color never costs contrast.
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
- **Sakay Orange (#F97316):** highlights: the "Waiting" and "Your driver is here"
  status bands, small tags and badges, the destination dot on the route board.
  Ink text on it: 5.93:1. White text on it: 2.80:1, so never white.
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

The phone's system font (Roboto on Android). No font packages. Font scaling is
always on.

### Hierarchy (sp; grows with the phone's text-size setting)
- **Board (28/34, weight 800):** route-board place names, the status band line,
  the Emergency label.
- **Title (22/28, 800):** screen and sheet titles.
- **Label (17/22, 700):** field labels, button text, menu rows.
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
  the main action goes on top at full width, Cancel underneath.
- Touch targets at least 48dp, main actions at least 56dp, Emergency at least
  76dp, with at least 8dp between targets.
- Main actions sit in the lower half of the screen (thumb reach). The place
  strip sits at the top.
- Works at text size 1.3× and 1.5×: text wraps, cards grow, sheets scroll.
  Addresses and place names are never cut to one line.

## Elevation & Depth

Flat, like printed signage. Depth comes from solid fills and lines, not shadows.

**The Flat Board Rule.** No soft drop shadows on cards, buttons or banners.
Separate things with a Board Tint field, a 1dp Rule line, or a 2dp Hall Green
line. One exception: a small Android elevation on controls floating over the
map, so they stay visible on busy map tiles.

Pop-ups: the dark background fades; only sheets slide.

## Shapes

Soft, round corners. Two corner sizes, plus fully round for a few small things:
- **Button corner (16dp):** buttons (including Emergency), inputs, the ☰ button,
  small boxes.
- **Card corner (24dp):** cards, banners, info boxes, and the top corners of
  bottom sheets.
- **Fully round:** small tags and count badges, status dots, the destination
  dot, profile pictures. Main buttons are never pill-shaped.

A status band at the top of a card follows the card's 24dp top corners.

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
  promo banners, city skylines.
- Don't use soft shadows, gradients, glass effects, colored stripes down the side
  of cards, or decorative circles.
- Don't put cards inside cards.
- Don't use any corner size besides 16dp, 24dp and fully round.
- Don't put white text on orange, and don't use orange for danger or errors.
- Don't use tiny spaced-out ALL-CAPS labels, even if a reference picture has them.
