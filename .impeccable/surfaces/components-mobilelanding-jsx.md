---
version: 1
slug: "components-mobilelanding-jsx"
primary_target: "components/MobileLanding.jsx"
related_targets: ["app/index.jsx"]
---

# Mobile landing (Android start screen) and Get Started sheet

Scope: native-only start screen shown by `app/index.jsx` MobileStart after first-launch permissions when no user is logged in, plus its Get Started slide-up sheet. Web landing page is untouched. Visitor mode: Persuade, inside the DESIGN.md world and colors. History: the signboard redesign (2026-10-03) was reverted the same week at the owner's and groupmates' request: the page is the demo-ready-5 phone + van composition again, recolored to DESIGN.md (bright Hall Green, orange accent) and flattened. The Get Started sheet from the redesign stays.

Audience/job: a Toledo City resident opening the app, often a senior on a basic Android phone. In one look they must understand "this is the barangay's transport and emergency help" and tap Get Started; a returning user taps Log In.

Constraints: no fares, prices, payment UI, speed or time promises, and no "official" / LGU seal or endorsement wording (public service, PRODUCT.md). Vehicles are barangay vehicles; not every barangay has an ambulance, so the copy never promises one. System font, no new packages. Always light; does not follow the phone theme. Colors come from DESIGN_COLORS in constants/design.js (plus two drawing-only colors in ART_COLORS); LIGHT_COLORS stays unchanged because other screens (Choose Role, registration, driver status) still use it. 48dp touch targets, text never below 15, font scaling on for all real text, scrolls under large font scale, safe-area insets. The one exception: the tiny words inside the phone drawing keep allowFontScaling={false}, because they are part of the picture and would spill out of the drawn phone. Behavior to keep exactly: Get Started opens the sheet (background fades, sheet slides, drag down to close); Continue with Google, Sign up with Email, "Already have an account? Log in with email", Log In and the Terms of Service link work as before.

Approved words (owner, 2026-10-03): card heading "Transport and emergency help for Toledo City"; line under it "Barangay vehicles, sent by a dispatcher."; sheet title "Log in or sign up"; sheet subtitle "Choose how you want to continue." Buttons and links keep their existing words. Not "Request a Ride now".

## Direction contract

THESIS: The demo-ready-5 picture the group chose: a phone asking for a barangay van, then one action. Kept from it: the round logo disc, the phone + van drawing on a ground line, the card with Get Started at the bottom. Left out on purpose (DESIGN.md rules, owner's choice 2026-10-03): the city skyline, the two big decorative circles, the card shadow, and the "Request a Ride now" heading.

OWN-WORLD: Paper White page. Round Hall Green (#0B7A4B) logo disc with the white SakayNa mark. Drawing: Ink phone frame, white screen, pale green map (#DCEFE5) with white roads and a Sakay Orange (#F97316) map pin, a Hall Green van with a white logo badge, a faint ground line. Inside the drawn phone, "Request a Ride" is a picture of a button: Board Tint fill with Ink Muted words, never solid green with white words, so it never looks tappable. Rule: on this page only real buttons are solid green with white words. The drawing is one accessible image ("A phone requesting a SakayNa van in Toledo City") and does nothing when tapped. Card: flat Board Tint, 24dp corners, no shadow; Title-size (22) Ink heading, 17 Ink Muted line under it; Hall Green Get Started button, 16dp corners, 56dp, 22 white text. Sheet: white, 24dp top corners, a 2dp Hall Green top line, visible Control Outline grab bar, option buttons white with a 1.5dp Control Outline edge and 16dp corners. Dark status-bar icons.

STORY: The resident sees the SakayNa mark, a phone calling a barangay van, reads "Transport and emergency help for Toledo City" and "Barangay vehicles, sent by a dispatcher.", and taps Get Started.

FIRST VIEWPORT: Top: the logo disc centered. Middle: the phone + van drawing, scaled to fit the phone (at most 36% of the screen height). Bottom, in thumb reach: the card with the heading, the line, full-width Get Started, the Log In line, and the Terms of Service line at 15. On small phones the page scrolls; nothing is hidden.

FORM: Owner-pinned composition restored from the demo-ready-5 tag; no concept roll. Code-led: drawn with Views and Material Community Icons; no image generation; no raster artwork besides the existing logo files.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
