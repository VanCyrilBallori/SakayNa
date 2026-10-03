---
target: resident home (after DESIGN.md pieces 1-4)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\bOdzfest\\Desktop\\SakayNa-main\\app\\resident-home.jsx"
target_fingerprint: "sha256:22fe855cc675c7dc158a3f9fa2c52a09a7d686d31045e9e7dbeac9bdac4ffef4"
target_path: "C:\\Users\\bOdzfest\\Desktop\\SakayNa-main\\app\\resident-home.jsx"
timestamp: 2026-10-03T06-09-43Z
slug: app-resident-home-jsx
---
Method: dual-agent (A: design review from code · B: impeccable detect). No device/emulator; code-only.
Scope: resident home only (app/resident-home.jsx main render + LocationNote + banners; features/resident/components/LatestRequestCard.jsx), after DESIGN.md pieces 1-4. Previous 23/40 covered landing + home + menu + Settings, so the comparison is not like-for-like (~+1 to +1.5 is real redesign gain, the rest is narrower scope).

## Heuristics (26/40, Acceptable)
1 Visibility 3 · 2 Real world 3 · 3 Control 3 · 4 Consistency 2 · 5 Error prevention 3 · 6 Recognition 3 · 7 Flexibility 2 · 8 Minimalist 3 · 9 Error recovery 2 · 10 Help 2

## Design specificity
Mostly specific now: place strip "Toledo City · Barangay X", flat 8dp signage, van icon, From/To route board. Remaining ride-hailing skeleton: full map + grab-bar sheet + "Request a Ride"; map is decoration; generic red pin with shadow (LeafletMap.jsx:10); stock Leaflet zoom.
Detector: 0 findings (exit 0). DESIGN.md is a seed (prose only, no frontmatter tokens), so design-system rules had nothing to check. Simulated tokens flagged retired colors (#CF0000, #06774B, #111111) mostly in un-redesigned pop-ups/Settings in the same file.

## Strengths
- Place strip (resident-home.jsx:566-585): strongest anti-ride-hailing signal; handles missing barangay; TalkBack header.
- Emergency fixture: both sheet states, 76dp+, Board 28, full label.
- LocationNote: distinct copy + recovery per state; never ambushes with a permission prompt.

## Priority issues
- [P1] Emergency confirm pop-up off-system at peak stress (resident-home.jsx:740-764): FontAwesome triangle #CF0000, 15pt muted body, Cancel/Send side by side equal. Fix: same siren icon, Title 22 / Body 17 Ink, full-width red Send on top, Cancel below, 8 corners. polish.
- [P1] Small phone / large text: ~140dp map on 360x640 with sheet open; banner + LocationNote overlay can slide under the sheet (Allow location untappable); at 1.5x Request a Ride scrolls away with hidden scroll indicator (640). Fix: shorter pending copy, show scroll indicator, fit overlay. adapt.
- [P2] Status band 17 = place names 17, no "one big thing" (LatestRequestCard.jsx:92,97); order-tracking words. Fix: band at 22, plain words. typeset + clarify.
- [P2] Rejected resident never sees the admin's reason (saved at adminOperationsService.js:140, never shown in resident app). Fix: show reason + next step. harden.
- [P2] Peek grab area 40dp (<48, resident-home.jsx:1217); no visible "Show more". Fix: 48dp + word. clarify.
- [P3] Map layer off-system: red shadowed pin, ~30px zoom buttons, no offline state, TalkBack order. audit.

## Persona red flags
Jordan: "Pending review"/"dispatchers" jargon, unlabeled ☰, invisible peek. Sam: WebView links in swipe path, banner not announced, "Checking…" has no busy state. Casey: ☰ top-left, tiny zoom above sheet. Lola Nena: strip 2-3 lines at 1.5x, map sliver, Request a Ride scrolls away, smallest text in the emergency confirm.

## Minor
Dangling "Toledo City ·" on wrap; raw coordinates as From place when geocoding fails; #8F1C13 pressed red not in DESIGN.md; sheet side borders along screen edges.

## Questions
What does the map earn on home? Should Emergency say "Call 911" for Pending residents before the emergency? Should the status band answer "is someone coming?" at 22?
