---
target: app/resident-home.jsx
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
target_identity: "file:C:\\Users\\bOdzfest\\Desktop\\SakayNa-main\\app\\resident-home.jsx"
target_fingerprint: "sha256:e9cb0bb9e095f6c653de4679253861fe211c06e911421328f924a70ca5e6a9f7"
target_path: "C:\\Users\\bOdzfest\\Desktop\\SakayNa-main\\app\\resident-home.jsx"
timestamp: 2026-09-22T09-42-10Z
slug: app-resident-home-jsx
---
**Method: dual-agent (A: ae912050db4698e5a · B: ab9f3b2d408a2c076)**

# Critique — app/resident-home.jsx (run 2, post-harden/polish)

Same criteria as run 1: WCAG 2.1 AA, Android 48 dp, PRODUCT.md resident (senior/PWD/pregnant/emergency, basic Android, limited English, under stress). Ranked by impact on that resident.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Alert modal shows live state + location line; 30 s flip has no countdown; send failure announced below the fold. |
| 2 | Match System / Real World | 1 | English-only; "dispatch" noun, "NEMT", "As-Directed Rental", "operational priority". No Cebuano. |
| 3 | User Control and Freedom | 2 | On-screen "Cancel alert" (:706) unconfirmed; only hardware Back asks. "Done" after accept writes ended. |
| 4 | Consistency and Standards | 2 | Two close-button designs; themed home vs unthemed sheets; inconsistent "Passenger" terms. |
| 5 | Error Prevention | 2 | Confirm-before-send good; no confirm on cancel; OS location prompt over modal mid-emergency. |
| 6 | Recognition Rather Than Recall | 3 | Review step restates form; history search needs SKN ref from memory. |
| 7 | Flexibility and Efficiency | 2 | No saved address/repeat; alert silently reuses previous request's pickup (:262). |
| 8 | Aesthetic and Minimalist Design | 2 | 150 dp hero above emergency card; status shown twice. |
| 9 | Error Recovery | 2 | Send failure closes modal, no retry, no phone; "Firestore permissions" reaches residents (:408). |
| 10 | Help and Documentation | 1 | No hotline number on the home screen. |
| **Total** | | **20/40** | **Acceptable** (bottom of band) |

## Design Specificity Verdict

**LLM:** Home screen still category-interchangeable ("Resident Dashboard"/"one clean dashboard" :500-504, three equal cards, duplicated status panel); requestOptions.js:1-10 still a US NEMT catalogue. Zero Cebuano. Only product-specific authoring is the emergency-alert lifecycle logic — thoughtful in code, not in the UI.

**Deterministic scan:** Exit 0, zero findings. B proved the detector matches CSS-syntax only (probe: `font-family: Inter` in .jsx → finding; `fontFamily: "Inter"` in StyleSheet → none) and reference/audit.native.md:3 states detect does not apply to React Native. Clean exit is expected for this platform, not evidence of quality.

**Visual overlays:** None (no adb/emulator/browser automation/dev server; Firebase-authenticated native screen). All numbers source-derived; reproduce run 1 exactly. Device pass at font_scale 1.3 and dark mode still not done.

## Overall Impression

The life-safety core now works — alert sends before GPS, second alert works after cancel, no infinite "Waiting…", phone fallback exists — confirmed by an unanchored reviewer. The rewrite exposed the next layer: the waiting screen's only button is a full-width red "Cancel alert" in the send button's red; a failed send closes the modal and says "call the office" with no number or button; the alert claims "sent"/"location" before either is true.

## What's Working

- Optimistic, non-blocking send: modal opens before write (:242-247); GPS attaches after doc exists (:300).
- Hardware Back while ringing asks; "Keep alert" is green and first (:328-340).
- Fallback ladder: 30 s → Call the office; no GPS → barangay text; no allowFontScaling=false / numberOfLines anywhere.

## Priority Issues

**[P0] Waiting-screen "Cancel alert" (:706) is unconfirmed, full-width, same #CF0000 as Send; cancelling leaves home panel saying "Emergency alert sent" (closeEmergencyAlert :307 never resets residentStatus).** Fix: route through handleAlertBack; restyle low-emphasis/outlined; reset residentStatus on close. Note: user deferred the on-screen button last round; independent reviewer rates it P0. Command: /impeccable harden

**[P0] Send failure is silent (:280-290): modal closes, message below the fold; loadOfficePhone only runs on success (:299) so "call the office" has no number/button.** Fix: keep modal open in error state with Try again + Call the office; load office phone on mount. Command: /impeccable harden

**[P1] Alert claims "sent"/"location"/"can call you back" before or without truth.** (a) Title "Emergency alert sent" (:648) while addDoc pending; 30 s timer starts on callOpen (:112-120) not on doc existing. (b) Confirm says "see your name and location right away" (:594) but location: null (:265). (c) pickupLocation/emergencyType fall back to previous request (:260-262). (d) Card says "can call you back" (:512) but no residentPhone in payload (:252-269). Fix: "Sending alert…" while startingEmergencyCall; timer from callSessionId; add residentPhone; drop stale fallback; reword confirm. Command: /impeccable harden

**[P1] Touch targets below 48 dp — unchanged, deferred.** sosButton/bookingButton/statusButton 42.8 dp derived (:1054-1074); modalClose 42×42 ×3; sheet closes 36×36 ×4; locationButton 44; history filter/search 46; themePill 28.4; hitSlop 0. Command: /impeccable audit → harden

**[P1] English-only, jargon, 12-required-input form — unchanged, deferred.** Plus: "Emergency transport" as a form category on card 2 vs "Send emergency alert" on card 1 forces a choice under stress. Command: /impeccable clarify

## Persona Red Flags

**Sam:** Emergency path clean — 8 of 22 tappables have accessibilityRole, exactly the alert flow + SOS card. Other 14 still bare (profile trigger, booking/status, menu, three X closes, settings). Alert card (:619) has no ScrollView — at 1.5× scale the 58 dp buttons push off a 640 dp screen. Switches unnamed. Input borders 1.26:1.

**Casey:** Sees "Emergency alert sent" while write pending; on 2G the 30 s timer can expire before the alert exists. Write failure → modal vanishes, explanation below the fold.

**Lola (68, daughter in labour, Cebuano-first):** Two taps — good. Denies location prompt; with no prior request/profile barangay dispatcher gets pickupLocation "". Faces spinner + one big red "Cancel alert". Presses red. Cancelled, no question, home still says sent. No Cebuano except "barangay".

## Minor Observations

- Dark mode (deferred): modal icons/spinner/button bgs 2.77–2.85:1 vs dark surface (under 3:1 non-text); button text passes; tags 1.01–1.13; errorText 2.43; feedbackText 2.85; feature sheets have zero useTheme.
- New (B): confirm Cancel button #D9D9D9 on white = 1.41:1 boundary.
- New (B): AppButton disabled composites 2.52 (primary) / 2.95 (danger).
- "Done"/Back after acceptance both write ended without asking.
- "View Status" (:531) still no-op; "Help is one tap away" (:501) is two.
- 24 font sizes <14; 22 unused style keys; bookingButton 3.32 — unchanged.

## Questions to Consider

1. Why is the biggest red button on the waiting screen the one that cancels help, in the same colour as the one that sent it?
2. If a dispatcher can't call back without a number and can't find her without a location, what has she "sent"?
3. Would Lola recognise one word on this screen — and is "barangay" enough?
