---
target: app/resident-home.jsx
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 4
target_identity: "file:C:\\Users\\bOdzfest\\Desktop\\SakayNa-main\\app\\resident-home.jsx"
target_fingerprint: "sha256:a8f9870f62e6c639a365de125fc9fad4f77d1634a05847fdda7ed057ac28e6c7"
target_path: "C:\\Users\\bOdzfest\\Desktop\\SakayNa-main\\app\\resident-home.jsx"
timestamp: 2026-09-22T05-48-31Z
slug: app-resident-home-jsx
closed: true
---
**Method: dual-agent (A: af17eac200abf4b17 · B: abc1f70dcc9c9435c)**

# Critique — app/resident-home.jsx (Resident home, request flow, SOS)

Scored against WCAG 2.1 AA, Android Material touch-target spec (48 dp), and PRODUCT.md: primary user is a senior, PWD, pregnant, or emergency-case resident on a basic Android phone, limited English, possibly panicking. Ranked by impact on that resident.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Declined/ended call renders "Waiting for the dispatcher station to answer." forever — resident-home.jsx:511-518 only branches on ringing/connected. |
| 2 | Match System / Real World | 1 | "NEMT", "As-Directed Rental", "dispatcher station", "operational priority", resident-facing "check Firestore permissions". Zero Cebuano/Filipino. |
| 3 | User Control and Freedom | 3 | Hardware Back on ringing modal silently cancels the emergency call (:507); closing the form discards 15 fields without asking. |
| 4 | Consistency and Standards | 2 | Home is theme-aware; form/history/details/map import COLORS, never useTheme. Two close-button designs (42 dp red circle vs 36 dp bare X). |
| 5 | Error Prevention | 2 | emergencyCallStartRef set true at :176, never reset — second SOS in a session does nothing. |
| 6 | Recognition Rather Than Recall | 2 | Success screen says "Follow its status from Request History," which is behind the avatar menu with no home-screen cue. |
| 7 | Flexibility and Efficiency | 2 | No hotline shortcut, no "request again"; Emergency card doesn't pre-select Emergency category. |
| 8 | Aesthetic and Minimalist Design | 2 | Hero card is marketing filler; "View Status" (:423) is a no-op when a request exists. |
| 9 | Error Recovery | 2 | Inline form validation good; call-failure copy references Firestore. |
| 10 | Help and Documentation | 1 | States "not a replacement for official emergency hotlines" — provides no hotline number or tel: link. |
| **Total** | | **19/40** | **Poor** |

## Design Specificity Verdict

**LLM assessment:** Half-authored. Request form is genuinely Toledo's (38-barangay picker, PH phone normalization, vulnerable-group toggles, "blue gate beside the chapel" hint, GPS privacy note). Home screen is category-interchangeable SaaS ("Resident Dashboard", "one clean dashboard", three equal cards) and requestOptions.js:1-10 lists "Special Event / Wedding Charter" and "Hourly / As-Directed Rental" — commercial charter products contradicting the no-fares public-service positioning. Nothing is in Cebuano or Filipino.

**Deterministic scan:** Detector exit 0, zero findings on app/resident-home.jsx and features/resident/components/. Not evidence of absence — it is a web/CSS detector and does not parse RN StyleSheet; arithmetic finds 5 light-mode and 6 dark-mode contrast failures and 12 sub-spec touch targets. No false positives.

**Visual overlays:** None available. No adb, no browser automation, no dev server; target is a Firebase-authenticated native screen. All evidence source-derived. Device pass at font_scale 1.3 and uimode night has not happened.

## Overall Impression

The request form is the best-considered thing in the app. But the one action the product exists for — get help now — is the most fragile: SOS is 43 dp, announces as plain text to a screen reader, sends no location, can be silently cancelled by Back, and then never works again that session. The "call" delivers no call, no sound, no fallback number, and on decline an infinite "Waiting…". Biggest opportunity: treat the Emergency card as a life-safety control — bigger, louder, bilingual, location-carrying, one tap, honest about what happens next.

## What's Working

- Form built for this population: profile prefill, normalizePhilippinePhone, GPS with privacy note, map-pin fallback, Review step.
- RequestStatusTimeline: honest 8-step model a waiting resident can read.
- AppButton (48 dp min, accessibilityRole/State) and FeedbackMessage (role="alert") set a correct floor — the home screen just doesn't use them.

## Priority Issues

**[P0] Emergency call path fails under stress — three compounding ways.** (a) resident-home.jsx:161,176 — emergencyCallStartRef never reset in endEmergencyCall (:219) or catch; any cancel (incl. accidental hardware Back, which cancels with no confirm) locks out SOS until force-quit. (b) :511-518 — declined/ended/cancelled all render "Waiting…" with no timeout. (c) No hotline number or tel: link despite the on-screen disclaimer; the "call" is a Firestore flag with no audio. Fix: reset the ref in endEmergencyCall and catch, guard on callOpen; branch on declined/ended/cancelled; after 30 s ringing show "No answer yet — call the hotline" with Linking.openURL("tel:…"); put the number on the Emergency card permanently. Command: /impeccable harden

**[P1] SOS sends no location unless a request already exists.** :189 falls back to profile.barangay only. Fix: request GPS silently on confirm, write coordinates into the session, show "Sending: Barangay X" with edit. Command: /impeccable harden

**[P1] Below-spec touch targets and zero a11y semantics on every home-screen control — hard WCAG 2.1 AA fail (4.1.2, 2.5.5).** sosButton/bookingButton/statusButton ≈43 dp (:868-882, paddingVertical 13, no minHeight); modalClose 42×42 (:1013); all feature-component closes 36×36; locationButton overrides AppButton to 44; history filter/search 46; themePill ≈28; hitSlop 0 occurrences; accessibilityLabel/Role/Hint 0/0/0 in resident-home.jsx across 16 TouchableOpacity, 2 Pressable, 6 TextInput; five Switches unlabeled; no live region on call status. Fix: whole Emergency card pressable ≥64 dp with accessibilityRole="button"; minHeight 48 everywhere; hitSlop on closes; labels on every input/switch/icon control; accessibilityLiveRegion on call status. Command: /impeccable audit → harden

**[P1] English-only, jargon-heavy, emergency form as long as planned-trip form.** Zero Cebuano/Filipino. "Open Emergency Call", "NEMT", "Hourly / As-Directed Rental", "Dispatch confirms operational priority", "dispatcher station", "Firestore permissions" (:210, :300). requestValidation.js:85 requires "Exact pickup details" prose even for Emergency; 15 inputs, 8 service types, 6 passenger counts. Fix: bilingual labels on the six SOS/status strings; Emergency requires only barangay + pickup + contact; cut service types to four, remove charter options; rewrite failure copy. Command: /impeccable clarify

**[P1] Contrast fails on five light pairs; dark mode effectively broken.** Light: white on #A48C00 3.32; placeholder #8B8B8B on #FCFCFC 3.32 (6 inputs); white on modalClose #F51D1D 4.14; subtleText on surfaceMuted 3.98 (12 px reviewLabel); icon #D88400 on #F5EECA 2.49. Dark: status tags accentText #D9E8E1 on hardcoded light backgrounds (:436) 1.01–1.13 — invisible; hardcoded errorText/feedbackText (:668-669, :724-725) 2.43/2.85 on dark surface; feature components have no dark tokens at all. userInterfaceStyle is automatic. Fix: theme tokens for tags/error/feedback; darken #A48C00 and #D88400; placeholder ≥4.5:1; dark variants for feature components. Command: /impeccable colorize

## Persona Red Flags

**Sam (TalkBack, low vision, tremor):** SOS at :405 announces as text, not button. Three closes announce as "X". Form inputs read "edit box" (detached labels); five assistance Switches read "switch, off" with no name. No live region — "Connected" never spoken. 43 dp SOS and 36 dp closes are misses with a tremor. Dark mode: status tag disappears.

**Casey (one-handed, bus, 2G):** SOS at ~480–525 dp on 360×640 — thumb-reachable only after header wraps and hero pushes it down. Confirm dialog Cancel/Call 116 dp each, side by side, centred — fat-finger on Cancel then SOS is dead for the session. Slow network: modal shows ringing before addDoc completes; on failure modal closes and error lands below the fold about Firestore.

**Lola Nena (68, daughter in labour, basic Android, Cebuano-first):** "Open Emergency Call" reads as a menu heading. Taps Call: phone icon, "Calling Dispatcher", no ring, no voice. Dispatcher busy: "Waiting…" forever. Presses Back by reflex: call cancels silently, next tap does nothing. Tries the form: must choose "NEMT" vs "Medical Transport", type required "Exact pickup details" and "Reason for transport", read "Dispatch confirms operational priority." Nothing in her language; nothing marks it as her city's.

## Minor Observations

- allowFontScaling never disabled, no numberOfLines — scaling works. 42 dp fixed close boxes with 18 px glyphs crowd at 200 %. 24 fontSize occurrences below 14 (1×11, 10×12, 13×13); body should be 16 for 60+.
- Settings labels name field "Username" with placeholder "Full name" (:621-624).
- History requires 3–240-char reason to cancel a Pending request.
- menuItem gap 4 dp; Android spec 8.
- Card subtitles restate their buttons.
- Modal overlay rgba(0,0,0,0.28) too light for low vision.
- Two form TextInputs (accessibilityNotes, additionalNotes) have no placeholderTextColor.
- 22 unused style keys in resident-home.jsx.

## Questions to Consider

1. If the "call" has no audio, why frame it as a phone call? What if SOS were one tap that sends location + vulnerable flags and shows "Dispatcher Maria saw this at 10:42 — vehicle on the way"?
2. Should Emergency Request be a two-field screen (where are you, what's wrong) reusing the profile, with the 15-field form for planned rides?
3. Would a Toledo senior recognise this as their city's screen? Where is the barangay, the hotline, the LGU seal, the Cebuano?
