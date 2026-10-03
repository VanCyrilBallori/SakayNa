---
target: resident landing, Get Started sheet, home, side menu, Settings
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\bOdzfest\\Desktop\\SakayNa-main\\app\\resident-home.jsx"
target_fingerprint: "sha256:22d654f21daa03de267adfd37434dac13014804d2bba360d8ef5ee260f60d562"
target_path: "C:\\Users\\bOdzfest\\Desktop\\SakayNa-main\\app\\resident-home.jsx"
timestamp: 2026-10-03T03-20-30Z
slug: app-resident-home-jsx
---
Method: dual-agent (A: design review from code · B: impeccable detect). No device/emulator; code-only review.
Scope: components/MobileLanding.jsx (landing + Get Started sheet), app/resident-home.jsx (home + Settings), features/resident/components/ResidentSideMenu.jsx.

## Design specificity verdict
Generic: an inDrive clone painted green (design-refs/indrive-*.png). Tells: full-screen map with no job, floating round ☰, bottom sheet with grab bar, avatar-header drawer; landing hero kit (corner arcs, invented skyline MobileLanding.jsx:36-46, phone-in-app mock :238-291, giant van-passenger glyph :295, "Get Started →"); 8+ radii with uniform soft shadows, RADIUS tokens ignored; UI green #06774B diverges from logo forest green; two emergency reds (#B42318, #CF0000); copy "Request a Ride now", "Let's Continue with", Title Case subtitle, "Username"; no Cebuano; sedan icon for a van/ambulance fleet.
Detector: 0 findings in all three files (exit 0, verified not suppressed; detector coverage of static JSX is partial).

## Heuristics (23/40, Acceptable)
1 Visibility 3 · 2 Real world 1 · 3 Control 3 · 4 Consistency 2 · 5 Error prevention 2 · 6 Recognition 3 · 7 Flexibility 2 · 8 Minimalist 2 · 9 Error recovery 3 · 10 Help 2

## Strengths
- Emergency alert stages honest and grounded (resident-home.jsx:798-887).
- Senior-sized targets on home/menu (76/60/58/52dp; office phone 28pt).
- Safe fallbacks for not-Active residents (911 path, always-light banners).

## Priority issues
- [P1] Ride-hailing visual language contradicts "public service, not marketplace". Fix: new direction; wordmark; city vehicle livery; van/ambulance icon; logo-matched green; give the map a job or shrink it. shape → bolder.
- [P1] English only; ride-hailing/developer words ("Username" :964, "Firestore permissions" :484, "Let's Continue with"). Fix: Cebuano-first key labels (owner supplies/verifies), rename, de-jargon. clarify.
- [P1] Accepted alert copy always claims "can see where you are" (:822-825) even when location failed (:840). Also scary warning triangle and equal Cancel/Send. harden + clarify.
- [P2] Settings legacy: 13-15px text, 42dp red "X" read as "X", ~30dp theme pill, unlabeled inputs, faint placeholders, dark-mode error contrast, save success never shown (:472-473). audit → polish.
- [P2] Login/menu recall: Google only under Get Started, Log In is email-only (app/login.jsx), Profile/Settings duplicate, Log out no confirm. distill + clarify.

## Persona red flags
Jordan: no statement of what SakayNa is; Get Started vs Log In; fake button in phone mock. Sam: "X" close, unlabeled pill/inputs, 1.3:1 grab bar. Casey: ☰ top-left, stray swipe → peek, one-tap logout. Lola Nena: English only, jargon labels, large font pushes Request a Ride out of sheet, Google user can't use Log In.

## Minor
Dark mode light-map/dark-sheet seam; theme may not persist on Android (lib/theme.js:7, untested); "Log In" vs "Log in"; dead styles.

## Questions
Cover the logo: what proves a city dispatcher? Why does an empty map take 60%? Why isn't Emergency "Call 911" for Pending residents? Why talk like Silicon Valley instead of the Toledo terminal conductor?

## Directions proposed
A Barangay Hall notice board (recommended, + B's type discipline) · B Route Board (jeepney/bus signboard type) · C Health Center Card (OSCA/PWD ID, priority-lane pictograms).
