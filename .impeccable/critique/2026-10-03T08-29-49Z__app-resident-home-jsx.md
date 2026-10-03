---
target: resident home (after follow-up fixes)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\bOdzfest\\Desktop\\SakayNa-main\\app\\resident-home.jsx"
target_fingerprint: "sha256:fc22d2cb5e0400d240ef99ce9dc081df9f756dff942643606895aacbb62d77bd"
target_path: "C:\\Users\\bOdzfest\\Desktop\\SakayNa-main\\app\\resident-home.jsx"
timestamp: 2026-10-03T08-29-49Z
slug: app-resident-home-jsx
---
Method: dual-agent (A: design review from code · B: impeccable detect). No device; code-only.
Scope: resident home only (same as the 26/40 run): app/resident-home.jsx main render, banners, LocationNote, StatusReason, emergency confirm, not-verified pop-ups, alert flow modal; features/resident/components/LatestRequestCard.jsx.

## Heuristics (27/40, Acceptable; was 26)
1 Visibility 3 · 2 Real world 3 · 3 Control 3 · 4 Consistency 2 · 5 Error prevention 3 · 6 Recognition 3 · 7 Flexibility 2 · 8 Minimalist 3 · 9 Error recovery 3 (was 2) · 10 Help 2

## Previous issues
1 Emergency confirm: fixed (817-847, styles 1514-1551). 2 Small phone/large text: partly (overlay capped 640-641, scrollbar 717, strip 1.3x cap); at 1.5x on 360x640 the overlay box is ~64dp. 3 Status band = places 17: open. 4 Rejected reason: fixed (554-569, 656-673), no re-submit path. 5 Peek strip: fixed (48dp, Show more/less). 6 Map layer: open.

## Detector
Real run 0 findings. Simulated tokens: 17 color advisories (was 18). Rendering off-palette: #CF0000/#06774B/#D88400 in alert flow, not-verified pop-ups, Settings; #8F1C13 pressed Emergency. Rest are overridden fallbacks or dead styles.

## Priority issues
- [P1] Map credit + zoom hidden under the sheet on small phones: LeafletMap frame minHeight 280 (LeafletMap.jsx:46) vs ~180dp map area on 360x640 with sheet open; WebView spills ~100dp under the sheet. Fix: optional minHeight 0 for home. adapt.
- [P1] Alert flow + not-verified pop-ups off-system at peak stress (849-987, 768-815): 18/20 corners, FontAwesome, #CF0000/#06774B, 15pt muted body, "Keep this screen open" smallest text. Fix: confirmCard pattern. polish.
- [P2] profileOverride freezes accountStatus after a Settings save (97, 479-485): approved resident stays "Pending" until remount. Fix: override only edited fields. harden.
- [P2] Status band 17 = places 17; order-tracking words; finished rides show "As soon as possible" instead of a date. typeset + clarify.
- [P2] Red for account state (Rejected/on-hold banners) above the red Emergency button (One Red Rule). colorize + clarify.

## New risks from recent changes
Stale reason precedence (verification reason beats a newer accountStatusReason); reason flicker while loading; maxed overlay scroll box captures map drags; on-hold banner lacks the Call button.

## Persona red flags
Jordan: "Show less" first word, unlabeled ☰, jargon. Sam: WebView links before Emergency in TalkBack order, Pending→Active not announced. Casey: top-of-screen actions. Lola Nena: tiny banner scroll box at 1.5x, red "Rejected" over red button, 15pt alert text.

## Questions
Why is status the same size as the street? Should account-state signs be red? Shouldn't the alert screen be redesigned before calmer screens?
