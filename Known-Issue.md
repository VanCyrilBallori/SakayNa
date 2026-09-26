# Known Issues

Problems found but not fixed yet. Newest at the top.

---

## 1. Emergency call error on Android

- **Date found:** [Sept 26, 2026]
- **Status:** Not fixed yet
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

- **Mobile landing page ("Get Started" page):** Always dark. It should NOT
  change with the phone's theme or the app's theme setting. This is on
  purpose.
- **Rest of the app (future):** Default theme is dark for everyone. Users can
  switch to light mode anytime in Settings, and switch back to dark.
- **Status:** Not built yet. The landing page is already dark, so nothing
  needs fixing there.