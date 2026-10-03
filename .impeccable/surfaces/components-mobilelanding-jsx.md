---
version: 1
slug: "components-mobilelanding-jsx"
primary_target: "components/MobileLanding.jsx"
related_targets: ["app/index.jsx"]
---

# Mobile landing (Android start screen) and Get Started sheet

Scope: native-only start screen shown by `app/index.jsx` MobileStart after first-launch permissions when no user is logged in, plus its Get Started slide-up sheet. Web landing page is untouched. Visitor mode: Persuade, inside the DESIGN.md world ("Barangay Hall + Route Board"). Redesigned 2026-10-03; replaces the earlier skyline / phone-mockup composition.

Audience/job: a Toledo City resident opening the app, often a senior on a basic Android phone. In one look they must understand "this is the barangay's transport and emergency help" and tap Get Started; a returning user taps Log In.

Constraints: no fares, prices, payment UI, speed or time promises, and no "official" / LGU seal or endorsement wording (public service, PRODUCT.md). Vehicles are barangay vehicles; not every barangay has an ambulance, so the copy never promises one. System font, no new packages. Always light; does not follow the phone theme. Colors come from DESIGN_COLORS in constants/design.js; LIGHT_COLORS stays unchanged because other screens (Choose Role, registration, driver status) still use it. 48dp touch targets, text never below 15, font scaling on everywhere (no allowFontScaling={false}), scrolls under large font scale, safe-area insets. Behavior to keep exactly: Get Started opens the sheet (background fades, sheet slides, drag down to close); Continue with Google, Sign up with Email, "Already have an account? Log in with email", Log In and the Terms of Service link work as before.

Approved words (owner, 2026-10-03): under the logo "Transport and emergency help for Toledo City"; route board From "Your barangay", To "Where you need to go"; line under the board "Barangay vehicles, sent by a dispatcher."; sheet title "Log in or sign up"; sheet subtitle "Choose how you want to continue." Buttons and links keep their existing words.

## Direction contract

THESIS: A barangay signboard, not a ride-hailing poster: the service named in words, the trip shown as a route board, one action. Refuses the marketplace hero (city skyline, phone-in-the-app mockup, giant stock vehicle, decorative circles, "Request a Ride now").

OWN-WORLD: Paper White page, Ink (#14211C) text, Ink Muted (#4A5C55) secondary. The wide SakayNa logo (Photos_/Logo (main).png) shows the name. The route board is a solid Hall Green (#3B6255) sign with 8dp corners, white Board-size (28) place lines and small white "From" / "To" labels joined by a short white vertical rule: it reads as a painted sign, never as a field or button (no chevrons, no input borders, no press state). Hall Green Get Started button, 8dp, 56dp. Flat: no shadows, no gradients. Sheet: white, 16dp top corners, a 2dp Hall Green top line, visible Control Outline grab bar, option buttons white with a 1.5dp Control Outline edge and 8dp corners. Dark status-bar icons.

STORY: The resident sees the SakayNa name and "Transport and emergency help for Toledo City", reads the sign "From your barangay → to where you need to go", learns it is barangay vehicles sent by a dispatcher, and taps Get Started.

FIRST VIEWPORT: Top: wide logo centered, the one-line purpose under it. Middle: the full-width route board sign, then the van icon with "Barangay vehicles, sent by a dispatcher." Bottom, in thumb reach: full-width Get Started, the Log In line, and the Terms of Service line at 15. On small phones the page scrolls; nothing is hidden.

FORM: Owner-pinned composition from the DESIGN.md signature parts (route board, Hall Green sign); no concept roll. Code-led: no image generation; no raster artwork.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
