# SakayNa: Admin System Security & UI/UX Roadmap

**Created:** October 13, 2026  
**Target Defense Date:** October 23, 2026 (10 days remaining)  
**Rule:** One change at a time. Plan first -> Review & get user OK -> Implement smallest possible change -> Test on phone/web -> Commit -> Move to next.

---

## 🎯 Goal
Make the Admin system secure and easy to defend to the panel (barangay scoping, account rules, security logs), followed by high-impact UI/UX polish (loading states, visual feedback) without destabilizing existing working flows.

---

## 📍 Phase 1: Admin System & Security Hardening (Priority 1)

These fixes directly solve the open security questions so you can confidently answer the panel: *"How do you prevent an Admin from modifying accounts outside their barangay or suspended staff from accessing data?"*

### Task 1.1: Restrict Admin Firestore Rules to Own Barangay & Allowed Fields
- **Problem:** Currently, `firestore.rules` allows an Admin to update any user profile without restricting barangay or fields (`isAdmin() && request.auth.uid != userId`).
- **Solution:** 
  - Restrict Admin profile modifications so Admins can only manage users within their own assigned barangay (`isAdminOf(resource.data.barangay)`).
  - Limit which fields an Admin can modify (e.g. `accountStatus`, `accountStatusReason`, `approvalStatus`), preventing arbitrary overwrites of sensitive system flags or credentials.
- **Verification / Test:**
  - Log in as Daanglungsod Admin -> verify you can approve/modify a Daanglungsod user.
  - Attempt (or test via emulator/rules test) to modify a user from another barangay -> correctly denied by rules.

### Task 1.2: Enforce Account Status for Staff in Security Rules & Route Gates
- **Problem:** `isStaff()` currently checks only `myRole() in ['Admin', 'Dispatcher']` without ensuring the account status is `"Active"`. If an Admin sets a Dispatcher or Admin to "Suspended" or "Disabled", their token role still allows database reads/writes.
- **Solution:**
  - Update `isStaff()`, `isAdmin()`, and `isDispatcher()` helper functions in `firestore.rules` to require `accountStatus == "Active"`.
  - Ensure `dispatcher-home.jsx` and `admin-home.jsx` route gates immediately block/sign out users whose `accountStatus !== "Active"`.
- **Verification / Test:**
  - Set a test Dispatcher account to "Suspended" via Admin panel.
  - Verify that the Dispatcher screen immediately prevents viewing requests or assigning vehicles.

### Task 1.3: Secure the Admin Activity Log (`activityLogs`)
- **Problem:** Any staff member can create activity log entries with arbitrary `actorId` fields.
- **Solution:**
  - In `firestore.rules`, require that `request.resource.data.actorId == request.auth.uid` and `actorRole == myRole()`.
  - In `useAdminDashboardData.js`, add `orderBy("createdAt", "desc")` to activity logs so recent entries are never missed.
- **Verification / Test:**
  - Perform an admin approval -> check that the activity log entry appears immediately at the top of the Admin Operations log with the correct admin ID.

### Task 1.4: Scope Admin Dashboard Views by Barangay (Where Applicable)
- **Problem:** While Driver Applications and Resident Verifications are properly filtered by the Admin's barangay, parts of the Overview and User lists show city-wide totals without a clear barangay filter indicator.
- **Solution:**
  - Add an active Barangay badge/filter pill to the Admin Users and Requests tabs so the Admin can seamlessly toggle between "My Barangay ({adminBarangay})" and "City-wide Overview".
- **Verification / Test:**
  - Open Admin Users -> toggle between own barangay and all barangays -> verify list updates cleanly.

---

## 🎨 Phase 2: UI & UX Polish (Priority 2)

Enhance perceived performance, accessibility, and user feedback without altering core business logic or database schemas.

### Task 2.1: Skeleton Placeholders for Mobile Loading States
- **Problem:** Slow cellular connections in remote barangays cause blank cards or plain spinner indicators that make users wonder if the app froze.
- **Solution:**
  - Create a lightweight `<CardSkeleton />` component using native `Animated` pulse.
  - Display skeletons in `ResidentHome` (Your Ride card) and `DriverHome` (Ride card) while live Firestore listeners initially connect.
- **Verification / Test:**
  - Test on phone in Airplane mode / slow 3G throttle -> observe smooth pulsing card placeholder until data loads.

### Task 2.2: Visual & Haptic Feedback on Mission State Changes
- **Problem:** Tapping step buttons (Accept, En Route, Arrived, Picked Up, Completed) gives immediate database updates, but subtle tactile/audio confirmation is missing.
- **Solution:**
  - Add light haptic vibration feedback (`Haptics.impactAsync` via Expo) and a brief success toast/badge when a driver advances a mission or when a resident's request is accepted.
- **Verification / Test:**
  - Test on driver phone -> tap "En Route" -> feel subtle confirmation vibration and see status badge update.

### Task 2.3: Quick Barangay Hall Shortcuts on Location Picker
- **Problem:** In rural areas where GPS or OpenStreetMap address lookups are slow, typing manual addresses on basic keyboards can be tedious.
- **Solution:**
  - Add a quick shortcut chip: "📍 Barangay Hall of {barangay}" in the pickup/destination modal to pre-fill coordinates and standard address instantly.
- **Verification / Test:**
  - Open Request a Ride form -> tap "Barangay Hall" chip -> verify pickup address and pin update immediately.

### Task 2.4: Design Token & Palette Consistency Sweep
- **Problem:** A few older components still import legacy `COLORS` (`#06774B`, `#17382E`) instead of standardized `DESIGN_COLORS` (`#0B7A4B` Hall Green, `#14211C` Ink) from `DESIGN.md`.
- **Solution:**
  - Safely replace legacy color references with `DESIGN_COLORS` across remaining screens to achieve 100% visual consistency with the design system.
- **Verification / Test:**
  - Inspect all screens in Expo web and Android preview to ensure exact color harmony.

---

## 📋 Execution Rules & Workflow
1. **Always Work Step-by-Step:** Do not combine multiple tasks into one big commit.
2. **Review First:** Before touching code for any task, explain what files will change and wait for approval.
3. **Phone & Web Testing:** Every single task must be tested on your device and committed before starting the next.
4. **Clean Git State:** Maintain clean Git commits so rollback is trivial if anything fails during rehearsal.

