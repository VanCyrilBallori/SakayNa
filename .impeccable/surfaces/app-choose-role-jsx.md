---
version: 1
slug: "app-choose-role-jsx"
primary_target: "app/choose-role.jsx"
related_targets: ["components/MobileLanding.jsx", "constants/design.js"]
---

# Choose Role (Resident or Driver)

Scope: screen opened by "Sign up with Email" in the Get Started sheet. Visitor mode: Operate (one decision, one tap), inside the landing page's always-light world (owner decision, 2026-09-28; was always dark before).

Audience/job: a new user, often a senior on a basic Android phone, picks the account type to create. Resident → /signup, Driver → /apply-to-drive (temporary until the new registration forms, login-overhaul-plan.md steps 4 and 9).

Constraints: LIGHT_COLORS from constants/design.js (shared with MobileLanding). System font, no new packages. 48dp minimum targets (role buttons 60dp). Scrolls under large font scale; safe-area insets; dark status-bar icons. Users cannot change their role later (only an Admin can), so the copy must never promise that.

## Direction contract

LAYOUT (owner's reference screenshot, illustration removed): back arrow top-left; centered title "Are you a Resident or a Driver?" and subtitle "Choose one to create your account."; middle holds two short explanations (icon in a green-tint disc + role name + one sentence) in place of the reference's illustration; two full-width buttons at the bottom. White page.

BUTTONS: Resident filled SakayNa green (#06774B) with white text (most sign-ups are residents); Driver light green-grey panel (#F0F6F3) with a 1.5px green-grey outline (LIGHT_COLORS.outline, #6B8A7D, 3.5:1+) so its edges stay visible on the white page. Each button repeats its explanation in its accessibility label; the visual explanations are hidden from screen readers to avoid reading it twice.

TAP: one tap goes straight to the next screen; no select-then-continue.
