---
version: 1
slug: "components-mobilelanding-jsx"
primary_target: "components/MobileLanding.jsx"
related_targets: ["app/index.jsx"]
---

# Mobile landing (Android start screen)

Scope: native-only start screen shown by `app/index.jsx` MobileStart after first-launch permissions when no user is logged in. Web landing page is untouched. Visitor mode: Persuade (inside the incumbent SakayNa world; layout pinned by the owner's reference screenshot).

Audience/job: a Toledo City resident opening the app, often on a basic Android phone. They must understand "this gets me a ride" and tap Get Started (Sign Up), or Log In if returning.

Constraints: no fares, prices or payment UI (public service). System font (incumbent). No new packages. Always dark on purpose (owner decision); does not follow the phone or app theme. 48dp touch targets; scrolls under large font scale; safe-area insets.

## Direction contract

THESIS: A calm public-service welcome, not a ride-hailing ad: one mark, one scene, one action. Refuses the marketplace hero with fares, vehicle price lists and payment chips.

OWN-WORLD: SakayNa green #06774B on a green-black #111815 field (always dark). White S-mark inside a solid green disc. Faint green city skyline at low opacity. Phone frame with a mini Toledo City map and pickup pin; a SakayNa van beside it. Rounded bottom sheet in surface color holding the action.

STORY: The resident sees the SakayNa mark, a phone summoning a city van, then "Request a Ride now" and acts.

FIRST VIEWPORT: Top: green disc logo centered. Middle (flexible, shrinks on small phones): skyline behind a phone at left-center and a van at right, grounded by a soft floor shadow. Bottom sheet: heading, full-width Get Started button with arrow (primary action), Log In text link, small Terms of Service line with link.

FORM: Brief-pinned composition from the owner's reference; no concept roll (precisely specified request). Code-led: no image generation available.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
