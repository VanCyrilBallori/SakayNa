# Known Issues

Problems found but not fixed yet. Newest at the top.

---

## 1. Emergency call error on Android

- **Date found:** [Sept 26, 2026]
- **Status:** Fixed (Sept 27, 2026, commit f827299). The pop-up's
  centering moved into the ScrollView's contentContainerStyle.
- **Steps:**
  1. Log in as Resident on the Android development build
  2. Tap "Send emergency alert" → "Send alert"
- **Expected:** [The alert is sent and I can call]
- **What happened:** [A Render Error Alert Popped out]
- **Error message:** [ERROR  [Invariant Violation: ScrollView child layout (["alignItems"]) must be applied through the contentContainerStyle prop.] 

Call Stack
  invariant (node_modules\invariant\browser.js)
  render (node_modules\react-native\Libraries\Components\ScrollView\ScrollView.js)
  callRender.reactStackBottomFrame (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  finishClassComponent (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  updateClassComponent (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  beginWork (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  runWithFiberInDEV (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  performUnitOfWork (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  workLoopSync (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  renderRootSync (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  performWorkOnRoot (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  performSyncWorkOnRoot (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  flushSyncWorkAcrossRoots_impl (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  processRootScheduleInMicrotask (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)
  scheduleMicrotask$argument_0 (node_modules\react-native\Libraries\Renderer\implementations\ReactFabric-dev.js)]
- **Started after:** the direct phone call change (not sure if
  this change caused it or it was already there)
- **Priority:** HIGH, because emergency alerts are the most
  important feature

  ## Theme plan (future feature, not a bug)

- **Decided (Sept 28, 2026):** the app uses light mode, not dark.
- **Landing page, Get Started sheet and Choose Role:** Always light. They
  do NOT change with the phone's theme or the app's Dark / Light switch.
  This is on purpose.
- **Rest of the app:** Already starts in light mode (lib/theme.js). Users
  can still switch to Dark in the avatar menu.
- **Status:** Done (login-overhaul-plan.md step 2b). Nothing else needs
  building.

  ## Emergency alerts can get stuck "ringing"

- **What happens:** If the app crashes or is closed while an alert is
  ringing, the alert stays "ringing" in Firestore forever. Dispatchers
  keep getting the pop-up, and there's no way to cancel it from the phone.
- **Found:** During testing, a crash left test alerts stuck. I cleared
  them manually in the Firebase Console.
- **Idea for fix:** Alerts should automatically expire (for example,
  after a few minutes with no answer).
- **Status:** Partly fixed (commit cfc717b): dispatchers stop seeing stuck
  alerts after 2 minutes. Firestore still says "ringing", and the Admin
  Emergency Calls list still shows them as "Ringing — Unanswered".
  Important before the pilot.