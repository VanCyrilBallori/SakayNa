---
version: 1
slug: "app-register-resident-jsx"
primary_target: "app/register-resident.jsx"
related_targets: ["app/choose-role.jsx", "lib/uploadPhoto.js", "constants/design.js"]
---

# Resident registration (Details → Proof → Review → Submitted)

Scope: new Resident fills in details and one proof-of-residency photo; profile saves as accountStatus "Pending". Reached from Choose Role → Resident while signed in without a profile (Google now; email users from login-overhaul-plan.md Step 5). Visitor mode: Operate.

Audience/job: a new Resident, often a senior on a basic Android phone, possibly with large system text. Must finish four short pages without confusion and know what happens next.

Constraints: LIGHT_COLORS + COLORS from constants/design.js (always light). System font, no new packages. Photos only via lib/uploadPhoto.js (camera or gallery, shrunk before upload); upload happens on Submit, not on pick. Inputs, choices and buttons ≥56dp; labels 16, inputs 17, helper text 16 in LIGHT_COLORS.muted (≥4.5:1). Never promise emails or notifications; status is shown in the app.

## Direction contract

LAYOUT (owner's reference design-refs/resident-form.png, screens 3-6): real SakayNa main logo centered at top (not the mockup's bus icon); step bar ①─②─③ Details / Proof / Review with 14px labels (done steps show a check; bar hidden from screen readers) plus "Step N of 3" text; page title; one topic per page; Back (outlined green) and Next/Submit (filled green) side by side at the bottom.

DETAILS: Full Name (prefilled from Google), Phone Number (PH mobile, saved normalized +63), Barangay (searchable dropdown, 38 Toledo barangays), House No. / Street / Purok. Each label has a green outline icon.

PROOF: document type as four always-visible radio rows (not a dropdown): Barangay Certificate of Residency, Barangay ID, Certificate of Indigency, Other government document with your address. Dashed green photo box "Take a photo or choose from gallery"; after picking, a full (contain) preview with a "Change photo" button. Hint: "Make sure your name and address are clear in the photo."

REVIEW: one light panel of rows (Full Name, Phone Number, Email, Barangay, Address, Document), document photo preview, confirm checkbox. Submit stays green; an unticked box shows an error message instead of a disabled button.

SUBMITTED: green check in a tinted disc, "Submitted", "Your account is pending verification. An admin from your barangay will review your document. You can check your status in the SakayNa app.", "Go to Home".

NOT HERE: mockup screens 1-2 (Step 5), 7 pending home (Step 6), 8 rejected home (Step 8). The mockup's "Report an Incident" tile and ≡ menu are not part of SakayNa.
