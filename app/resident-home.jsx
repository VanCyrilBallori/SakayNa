import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, LayoutAnimation, Linking, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import LeafletMap from "../components/LeafletMap";
import { ACCOUNT_STATUSES } from "../constants/app";
import { DESIGN_COLORS } from "../constants/design";
import { auth, db } from "../firebase";
import { startPhoneCall } from "../lib/phoneCall";
import { getAccountStatusLabel } from "../lib/roles";
import { saveLocalUserProfile, useCurrentUserProfile } from "../lib/session";
import { useTheme } from "../lib/theme";
import LatestRequestCard from "../features/resident/components/LatestRequestCard";
import ResidentRequestDetails from "../features/resident/components/ResidentRequestDetails";
import ResidentRequestForm from "../features/resident/components/ResidentRequestForm";
import ResidentRequestHistory from "../features/resident/components/ResidentRequestHistory";
import ResidentSideMenu from "../features/resident/components/ResidentSideMenu";
import useCurrentLocation from "../features/resident/hooks/useCurrentLocation";
import useHomeLocation from "../features/resident/hooks/useHomeLocation";
import useResidentRequests from "../features/resident/hooks/useResidentRequests";
import { normalizePhilippinePhone } from "../features/resident/utils/requestValidation";

const NO_ANSWER_TIMEOUT_MS = 30_000;
// Firestore queues writes while offline and the promise simply stays pending, so an
// unconfirmed write after this long is treated as failed even though it may sync later.
const SEND_TIMEOUT_MS = 10_000;
// While an alert is ringing, the app saves "I'm still here" (lastActiveAt) this often.
// Dispatchers hide a ringing alert that has gone 2 minutes without one (crashed or closed app).
const ALERT_HEARTBEAT_MS = 20_000;
const KEEP_AWAKE_TAG = "emergency-alert";

// The bottom sheet's rounded top overlaps the map by this much (16 = DESIGN.md's sheet corner).
// The map moves its zoom buttons and OpenStreetMap credit up by the same amount, so they stay visible.
const SHEET_OVERLAP = 16;

export default function ResidentHome() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 920;
  const { authUser, displayName: fallbackDisplayName, profile } = useCurrentUserProfile();
  const { theme } = useTheme();
  const { requests: requestHistory, loading: requestHistoryLoading, error: requestHistoryError } = useResidentRequests(authUser?.uid);
  const latestRequest = requestHistory[0] ?? null;
  const [profileOverride, setProfileOverride] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // false = the bottom sheet is open (all buttons). true = "peek": only Emergency shows, so the map is almost all visible.
  // It starts open every time the home screen opens.
  const [sheetPeek, setSheetPeek] = useState(false);
  const [latestDetailsOpen, setLatestDetailsOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [callConfirmOpen, setCallConfirmOpen] = useState(false);
  // "" = closed. "emergency" or "transport" = the "your account is not verified yet" pop-up for that button.
  const [notVerifiedPopup, setNotVerifiedPopup] = useState("");
  const [callOpen, setCallOpen] = useState(false);
  const [callSessionId, setCallSessionId] = useState("");
  const [callStatus, setCallStatus] = useState("idle");
  const [callDispatcherName, setCallDispatcherName] = useState("");
  const [callDispatcherPhone, setCallDispatcherPhone] = useState("");
  const [officePhone, setOfficePhone] = useState("");
  const [alertLocationStatus, setAlertLocationStatus] = useState("idle");
  const [noAnswerTimedOut, setNoAnswerTimedOut] = useState(false);
  const [cancelAlertConfirmOpen, setCancelAlertConfirmOpen] = useState(false);
  // "sending" until the server confirms the write; "failed" on rejection or timeout;
  // "sent" once confirmed. callStatus only means anything once this is "sent".
  const [sendPhase, setSendPhase] = useState("idle");
  // Tracks the alert currently on screen so late GPS results can't write to a closed alert.
  const activeAlertIdRef = useRef("");
  // True once a snapshot without pending writes proves the alert reached the server.
  const serverConfirmedRef = useRef(false);
  const { detectLocation } = useCurrentLocation();
  // Only for the home map. It never asks for permission by itself (see useHomeLocation.js).
  const homeLocation = useHomeLocation();
  const [settingsForm, setSettingsForm] = useState({
    fullName: "",
    phoneNumber: "",
    email: "",
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");

  const activeProfile = profileOverride ?? profile;
  const displayName = activeProfile?.fullName?.trim() || fallbackDisplayName;
  // Only Active residents can send alerts or requests (same as isActiveResident in firestore.rules).
  // Everyone else can open this screen but gets a pop-up instead. While the profile is still
  // loading we don't know the status yet, so nothing is blocked.
  const notActive = Boolean(activeProfile) && activeProfile.accountStatus !== ACCOUNT_STATUSES.ACTIVE;
  const isRejected = activeProfile?.accountStatus === ACCOUNT_STATUSES.REJECTED;
  const isPending = activeProfile?.accountStatus === ACCOUNT_STATUSES.PENDING;
  // For the place strip. The profile saves "Poblacion, Toledo City"; the strip already says Toledo City, so drop that part.
  const barangayName = (activeProfile?.barangay || "").replace(/,\s*Toledo City$/i, "").trim();
  // Any other non-Active status (for example Suspended or Disabled) means the account is on hold.
  const isOnHold = notActive && !isRejected && !isPending;

  useEffect(() => {
    if (!callSessionId) {
      return undefined;
    }

    const unsubscribe = onSnapshot(
      doc(db, "callSessions", callSessionId),
      (snapshot) => {
        // The listener is attached before the write lands, so a missing document is
        // "not there yet", not "ended".
        if (!snapshot.exists()) {
          return;
        }

        const callData = snapshot.data();
        setCallStatus(callData?.status ?? "ringing");
        setCallDispatcherName(callData?.dispatcherName ?? "");
        setCallDispatcherPhone(callData?.dispatcherPhone ?? "");

        // A snapshot with no pending writes means the server has it — including a
        // queued offline write that synced after we already showed the error state.
        if (!snapshot.metadata.hasPendingWrites) {
          serverConfirmedRef.current = true;
          setSendPhase((current) => (current === "sending" || current === "failed" ? "sent" : current));
        }
      },
      (error) => console.log("Emergency alert listener warning:", error)
    );

    return unsubscribe;
  }, [callSessionId]);

  // The 30 s no-answer clock only starts once the alert actually exists on the server.
  useEffect(() => {
    if (sendPhase !== "sent" || callStatus !== "ringing") {
      setNoAnswerTimedOut(false);
      return undefined;
    }

    const timeoutId = setTimeout(() => setNoAnswerTimedOut(true), NO_ANSWER_TIMEOUT_MS);
    return () => clearTimeout(timeoutId);
  }, [sendPhase, callStatus]);

  // "I'm still here" signal: while this screen shows a ringing alert, refresh lastActiveAt so
  // dispatchers know someone is still waiting. It stops when the alert is answered, cancelled,
  // or the app closes — and that silence is how dispatchers spot a stuck alert.
  useEffect(() => {
    if (!callSessionId || sendPhase !== "sent" || callStatus !== "ringing") {
      return undefined;
    }

    const intervalId = setInterval(() => {
      updateDoc(doc(db, "callSessions", callSessionId), {
        lastActiveAt: serverTimestamp(),
      }).catch((error) => console.log("Emergency alert heartbeat warning:", error));
    }, ALERT_HEARTBEAT_MS);

    return () => clearInterval(intervalId);
  }, [callSessionId, sendPhase, callStatus]);

  // Keeps the screen from locking by itself while the alert is ringing.
  // Loaded here instead of at the top of the file (like expo-intent-launcher in lib/phoneCall.js):
  // if the native module is missing, loading it throws, and we catch that so the alert keeps
  // working — the screen just sleeps as usual. Browsers without wake lock support are caught too.
  useEffect(() => {
    if (!callOpen || callStatus !== "ringing") {
      return undefined;
    }

    let KeepAwake;
    try {
      KeepAwake = require("expo-keep-awake");
    } catch (error) {
      console.log("Keep awake unavailable:", error);
      return undefined;
    }

    KeepAwake.activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch((error) => console.log("Keep awake warning:", error));

    return () => {
      KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [callOpen, callStatus]);

  const loadOfficePhone = useCallback(async () => {
    try {
      const snapshot = await getDoc(doc(db, "systemSettings", "operational"));
      setOfficePhone(snapshot.exists() ? (snapshot.data()?.publicOfficePhone ?? "").trim() : "");
    } catch (error) {
      console.log("Office phone lookup warning:", error);
      setOfficePhone("");
    }
  }, []);

  // Loaded at sign-in, not at send time, so the number is already on hand if a send fails.
  useEffect(() => {
    if (authUser?.uid) {
      loadOfficePhone();
    }
  }, [authUser?.uid, loadOfficePhone]);

  // Clears old messages and fills the form, once, when Settings opens.
  // (Not every time the profile changes: saving changes the profile, and that would wipe the "updated successfully" message.)
  const openSettings = () => {
    setSettingsError("");
    setSettingsMessage("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSettingsForm({
      fullName: activeProfile?.fullName || displayName,
      phoneNumber: activeProfile?.phoneNumber || activeProfile?.phone || "",
      email: activeProfile?.email || authUser?.email || "",
    });
    setSettingsOpen(true);
  };

  useEffect(() => {
    if (!changePasswordOpen) {
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSettingsError("");
    setSettingsMessage("");
  }, [changePasswordOpen]);

  const handleQuickAction = (type) => {
    if (type === "emergency-call") {
      if (notActive) {
        setNotVerifiedPopup("emergency");
        return;
      }
      setCallConfirmOpen(true);
      return;
    }

    if (type === "transport") {
      if (notActive) {
        setNotVerifiedPopup("transport");
        return;
      }
      setSosOpen(true);
    }
  };

  // GPS is attached after the alert is already sent, so a slow or denied location never delays it.
  // detectLocation() resolves within 15 s at most and never rejects.
  const attachAlertLocation = async (alertId) => {
    const result = await detectLocation();

    if (activeAlertIdRef.current !== alertId) {
      return;
    }

    if (result.error || !result.location) {
      setAlertLocationStatus("failed");
      return;
    }

    const { latitude, longitude, address, barangay } = result.location;

    try {
      await updateDoc(doc(db, "callSessions", alertId), {
        location: { latitude, longitude, address, barangay: barangay ?? null, source: "gps" },
        pickupLocation: address,
        updatedAt: serverTimestamp(),
      });

      if (activeAlertIdRef.current === alertId) {
        setAlertLocationStatus("sent");
      }
    } catch (error) {
      console.log("Emergency alert location warning:", error);
      if (activeAlertIdRef.current === alertId) {
        setAlertLocationStatus("failed");
      }
    }
  };

  // Writes the alert under the ID generated once per attempt. Retries reuse the same ID,
  // so a queued offline write that syncs later and a retry can never become two alerts.
  const writeAlert = async (alertId) => {
    if (serverConfirmedRef.current) {
      setSendPhase("sent");
      return;
    }

    setSendPhase("sending");

    const payload = {
      residentId: authUser.uid,
      residentName: displayName,
      residentPhone: activeProfile?.phoneNumber || activeProfile?.phone || "",
      dispatcherId: "",
      dispatcherName: "",
      dispatcherPhone: "",
      targetRole: "Dispatcher",
      latestRequestId: latestRequest?.id ?? "",
      pickupLocation: activeProfile?.barangay ?? "",
      location: null,
      status: "ringing",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    };

    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("send-timeout")), SEND_TIMEOUT_MS);
    });

    try {
      await Promise.race([setDoc(doc(db, "callSessions", alertId), payload), timeout]);
      if (activeAlertIdRef.current === alertId) {
        serverConfirmedRef.current = true;
        setSendPhase("sent");
      }
    } catch (error) {
      console.log("Emergency alert send warning:", error?.message ?? error);
      if (activeAlertIdRef.current === alertId) {
        setSendPhase((current) => (current === "sent" ? current : "failed"));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const sendEmergencyAlert = async () => {
    if (callOpen) {
      return;
    }

    // Can't happen on this screen (only signed-in residents reach it), but never send an alert with no owner.
    if (!authUser?.uid) {
      return;
    }

    const alertId = doc(collection(db, "callSessions")).id;
    activeAlertIdRef.current = alertId;
    serverConfirmedRef.current = false;

    setCallOpen(true);
    setCallStatus("ringing");
    setCallDispatcherName("");
    setCallDispatcherPhone("");
    setNoAnswerTimedOut(false);
    setAlertLocationStatus("pending");
    setCallSessionId(alertId);

    if (!officePhone) {
      loadOfficePhone();
    }

    writeAlert(alertId);
    attachAlertLocation(alertId);
  };

  const retryEmergencyAlert = () => {
    if (activeAlertIdRef.current) {
      writeAlert(activeAlertIdRef.current);
    }
  };

  const closeEmergencyAlert = () => {
    // Fire-and-forget: offline this promise would hang and trap the modal open. It is
    // still worth sending — a queued create syncs before this queued update, so a
    // late-arriving alert is cancelled rather than left ringing.
    if (callSessionId && ["ringing", "connected"].includes(callStatus)) {
      updateDoc(doc(db, "callSessions", callSessionId), {
        status: callStatus === "connected" ? "ended" : "cancelled",
        updatedAt: serverTimestamp(),
      }).catch((error) => console.log("Emergency alert close warning:", error));
    }

    activeAlertIdRef.current = "";
    serverConfirmedRef.current = false;
    setCancelAlertConfirmOpen(false);
    setCallOpen(false);
    setCallSessionId("");
    setCallStatus("idle");
    setSendPhase("idle");
    setCallDispatcherName("");
    setCallDispatcherPhone("");
    setNoAnswerTimedOut(false);
    setAlertLocationStatus("idle");
  };

  // Hardware Back while an alert is still ringing asks first; a Back press on that
  // question keeps the alert. Any other state closes as before.
  const handleAlertBack = () => {
    if (cancelAlertConfirmOpen) {
      setCancelAlertConfirmOpen(false);
      return;
    }

    if (callStatus === "ringing") {
      setCancelAlertConfirmOpen(true);
      return;
    }

    closeEmergencyAlert();
  };

  const openPhone = (phone) => {
    startPhoneCall(phone);
  };

  const saveResidentSettings = async () => {
    if (!authUser?.uid) {
      setSettingsError("Login is required before updating your settings.");
      return;
    }

    if (!settingsForm.fullName.trim() || !settingsForm.phoneNumber.trim() || !settingsForm.email.trim()) {
      setSettingsError("Username, phone number, and email address are required.");
      return;
    }

    // Same phone check as sign-up. A valid number is saved in one standard style (+639171234567).
    const nextPhone = normalizePhilippinePhone(settingsForm.phoneNumber);
    if (!nextPhone) {
      setSettingsError("Enter a mobile number like 0917 123 4567.");
      return;
    }

    setSavingSettings(true);
    setSettingsError("");
    setSettingsMessage("");

    try {
      const currentAuthUser = auth.currentUser ?? authUser;
      const nextEmail = settingsForm.email.trim().toLowerCase();

      if (nextEmail !== (authUser.email || activeProfile?.email || "").trim().toLowerCase()) {
        await updateEmail(currentAuthUser, nextEmail);
      }

      await updateDoc(doc(db, "users", authUser.uid), {
        fullName: settingsForm.fullName.trim(),
        phoneNumber: nextPhone,
        phone: nextPhone,
        email: nextEmail,
        updatedAt: serverTimestamp(),
      });

      saveLocalUserProfile({
        uid: authUser.uid,
        email: nextEmail,
        fullName: settingsForm.fullName.trim(),
        barangay: activeProfile?.barangay || "",
        phoneNumber: nextPhone,
        phone: nextPhone,
        role: activeProfile?.role || "Resident",
        accountStatus: activeProfile?.accountStatus || "Active",
      });

      setProfileOverride({
        ...activeProfile,
        email: nextEmail,
        fullName: settingsForm.fullName.trim(),
        phoneNumber: nextPhone,
        phone: nextPhone,
      });

      // Settings stays open so the resident sees this message. They close it with the X.
      setSettingsMessage("Settings updated successfully.");
    } catch (error) {
      console.log("Resident settings save failed:", error);

      if (error?.code === "auth/requires-recent-login") {
        setSettingsError("Please log in again before changing your email address.");
      } else if (error?.code === "auth/invalid-email") {
        setSettingsError("Please enter a valid email address.");
      } else if (error?.code === "auth/email-already-in-use") {
        setSettingsError("That email address is already being used by another account.");
      } else {
        setSettingsError("Settings could not be updated. Please check Firestore permissions and your email details.");
      }
      return;
    } finally {
      setSavingSettings(false);
    }
  };

  const saveResidentPassword = async () => {
    if (!authUser?.email) {
      setSettingsError("This account has no email address available for password update.");
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      setSettingsError("Enter your current password, new password, and confirm password.");
      return;
    }

    if (newPassword.length < 6) {
      setSettingsError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setSettingsError("New password and confirm password do not match.");
      return;
    }

    setSavingSettings(true);
    setSettingsError("");
    setSettingsMessage("");

    try {
      const currentAuthUser = auth.currentUser ?? authUser;
      const credential = EmailAuthProvider.credential(authUser.email, currentPassword);
      await reauthenticateWithCredential(currentAuthUser, credential);
      await updatePassword(currentAuthUser, newPassword);
      setSettingsMessage("Password updated successfully.");
      setChangePasswordOpen(false);
    } catch (error) {
      console.log("Resident password update failed:", error);

      if (error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential") {
        setSettingsError("Current password is incorrect.");
      } else if (error?.code === "auth/requires-recent-login") {
        setSettingsError("Please log in again before changing your password.");
      } else {
        setSettingsError("Password could not be updated. Please check your password details.");
      }
    } finally {
      setSavingSettings(false);
    }
  };

  // Moves the sheet to open or peek. LayoutAnimation makes the change glide instead of jump.
  const moveSheet = useCallback((peek) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSheetPeek(peek);
  }, []);

  // Watches a finger on the sheet's grey bar. Swipe down = peek, swipe up = open.
  // "Capture" lets this take the finger away from the bar's tap once it moves up or down, so a swipe doesn't also count as a tap.
  const sheetSwipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (event, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (event, gesture) => {
          if (gesture.dy > 30) moveSheet(true);
          else if (gesture.dy < -30) moveSheet(false);
        },
      }),
    [moveSheet]
  );

  return (
    <>
      <View style={[styles.home, { backgroundColor: theme.page }]}>
        {/* The place strip at the top is green, so the phone's clock and battery icons are drawn white. */}
        <StatusBar style="light" />

        {/* Place strip (DESIGN.md): names the place, like the sign on a barangay hall. It also holds the ☰ button. */}
        {/* paddingTop = the height of the phone's clock area, so the green goes behind the clock. */}
        <View style={[styles.placeStrip, { paddingTop: insets.top + 4 }]}>
          <Pressable
            style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
            onPress={() => setMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
          >
            <MaterialCommunityIcons name="menu" size={30} color="#FFFFFF" />
          </Pressable>

          {/* Two pieces in a wrapping row: one line when both fit, otherwise "Barangay …" moves down as a whole. */}
          <View style={styles.placeNames} accessible accessibilityRole="header" accessibilityLabel={barangayName ? `Toledo City, Barangay ${barangayName}` : "Toledo City"}>
            <Text style={styles.placeText}>{barangayName ? "Toledo City · " : "Toledo City"}</Text>
            {barangayName ? <Text style={styles.placeText}>Barangay {barangayName}</Text> : null}
          </View>
        </View>

        {/* Map below the strip. The sheet below overlaps its bottom edge by SHEET_OVERLAP. */}
        <View style={[styles.mapArea, { marginBottom: -SHEET_OVERLAP }]}>
          {/* With your position: the map centers on you with a "You are here" pin. Without it: Toledo City, no pin. */}
          <LeafletMap
            title="Toledo City map"
            showPins={Boolean(homeLocation.coordinates)}
            pickupCoordinates={homeLocation.coordinates}
            pickupLabel="You are here"
            zoomPosition="bottomright"
            bottomSpace={SHEET_OVERLAP}
          />

          {/* Floating on top of the map, just under the strip. box-none = taps between these items still reach the map. */}
          <View style={styles.mapOverlay} pointerEvents="box-none">
            {notActive ? (
              // A flat sign: amber while waiting, red when the account can't send emergency alerts.
              <View style={[styles.statusBanner, isPending ? styles.statusBannerPending : styles.statusBannerRejected]}>
                <MaterialCommunityIcons
                  name={isPending ? "clock-outline" : isRejected ? "close-circle-outline" : "pause-circle-outline"}
                  size={28}
                  color={isPending ? DESIGN_COLORS.waitingAmber : DESIGN_COLORS.emergencyRed}
                />
                <View style={styles.statusBannerCopy}>
                  <Text style={styles.statusBannerTitle}>{getAccountStatusLabel(activeProfile) || "On hold"}</Text>
                  <Text style={styles.statusBannerText}>
                    {isPending
                      ? "An admin from your barangay is checking your proof of residency. You can send emergency alerts and transport requests after you are verified."
                      : isRejected
                        ? "Your proof of residency was not accepted. You cannot send emergency alerts or transport requests."
                        : "Your account is on hold, so you cannot send emergency alerts or transport requests. Please contact the office (☰ → Help / Contact office)."}
                  </Text>
                </View>
              </View>
            ) : null}

            <LocationNote location={homeLocation} />
          </View>
        </View>

        {/* Bottom sheet with two positions: open, or "peek" (pulled down). Emergency shows in both, so it is always one tap away. */}
        {/* It scrolls inside if it doesn't fit (for example with very large text). */}
        <View style={styles.sheet}>
          {/* Grey bar: swipe it down or up, or tap it, to switch between open and peek. */}
          {/* It sits outside the scroll list below so the swipe and the scrolling don't fight. */}
          <View {...sheetSwipe.panHandlers}>
            <Pressable
              style={styles.sheetGrabArea}
              onPress={() => moveSheet(!sheetPeek)}
              accessibilityRole="button"
              accessibilityLabel={sheetPeek ? "Show more. Shows Request a Ride and your latest request." : "Show less. Makes the map bigger."}
            >
              <View style={styles.sheetHandle} />
            </Pressable>
          </View>

          <ScrollView style={styles.sheetScroll} contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 16 }]} bounces={false} showsVerticalScrollIndicator={false}>
            <Pressable
              style={({ pressed }) => [styles.emergencyButton, pressed && styles.emergencyButtonPressed]}
              onPress={() => handleQuickAction("emergency-call")}
              android_ripple={{ color: "rgba(255, 255, 255, 0.2)" }}
              accessibilityRole="button"
              accessibilityLabel="Emergency. Send an alert to the dispatchers."
            >
              <MaterialCommunityIcons name="alarm-light-outline" size={36} color="#FFFFFF" />
              <View style={styles.emergencyCopy}>
                <Text style={styles.emergencyTitle}>Emergency</Text>
                <Text style={styles.emergencySubtitle}>Send an alert to the dispatchers</Text>
              </View>
            </Pressable>

            {/* Peek shows only the Emergency button above. */}
            {sheetPeek ? null : (
              <>
                <Pressable
                  style={({ pressed }) => [styles.rideButton, pressed && styles.rideButtonPressed]}
                  onPress={() => handleQuickAction("transport")}
                  android_ripple={{ color: "rgba(255, 255, 255, 0.2)" }}
                  accessibilityRole="button"
                >
                  {/* A van, not a car: the city's vehicles are vans and ambulances. */}
                  <MaterialCommunityIcons name="van-passenger" size={30} color="#FFFFFF" />
                  <Text style={styles.rideButtonText}>Request a Ride</Text>
                </Pressable>

                <LatestRequestCard
                  request={latestRequest}
                  loading={requestHistoryLoading}
                  error={requestHistoryError}
                  onPress={() => setLatestDetailsOpen(true)}
                />
              </>
            )}
          </ScrollView>
        </View>
      </View>

      {/* The latest request's details. It reads the live request, so the status updates while it is open. */}
      <ResidentRequestDetails request={latestRequest} visible={latestDetailsOpen && Boolean(latestRequest)} onClose={() => setLatestDetailsOpen(false)} />

      <ResidentRequestForm
        visible={sosOpen}
        onClose={() => setSosOpen(false)}
        uid={authUser?.uid}
        residentName={displayName}
        profile={activeProfile}
      />
      <Modal visible={Boolean(notVerifiedPopup)} transparent animationType="fade" onRequestClose={() => setNotVerifiedPopup("")}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.callCard, styles.callCardContent, compact && styles.modalCardCompact, { backgroundColor: theme.surface }]}>
            {notVerifiedPopup === "emergency" ? (
              <>
                <FontAwesome name="warning" size={52} color="#CF0000" />
                <Text style={[styles.callTitle, { color: theme.text }]}>Emergency</Text>
                <Text style={[styles.notVerifiedText, { color: theme.text }]}>
                  {isOnHold ? "Your account is on hold." : isRejected ? "Your account was not verified." : "Your account is still being verified."} For emergencies, call 911.
                </Text>
                {/* Opens the dialer with 911 typed in. The person still presses call, so a wrong tap never calls 911.
                    (startPhoneCall is not used here because it can start the call right away.) */}
                <TouchableOpacity
                  style={[styles.endCallButton, styles.call911Button]}
                  onPress={() => Linking.openURL("tel:911").catch((error) => console.log("Phone dialer warning:", error))}
                  accessibilityRole="button"
                  accessibilityLabel="Call 911. Opens the phone dialer."
                >
                  <FontAwesome name="phone" size={22} color="#FFFFFF" />
                  <Text style={styles.endCallButtonText}>Call 911</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.notVerifiedCloseButton, { borderColor: theme.mutedText }]}
                  onPress={() => setNotVerifiedPopup("")}
                  accessibilityRole="button"
                >
                  <Text style={[styles.notVerifiedCloseText, { color: theme.text }]}>Close</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <FontAwesome name="clipboard" size={48} color="#D88400" />
                <Text style={[styles.callTitle, { color: theme.text }]}>Transport Request</Text>
                <Text style={[styles.notVerifiedText, { color: theme.text }]}>
                  {isOnHold
                    ? "Your account is on hold, so you cannot send transport requests. Please contact the office (☰ → Help / Contact office)."
                    : isRejected
                      ? "Your account was not verified, so you cannot send transport requests."
                      : "Your account is still being verified. You can send transport requests after an admin from your barangay approves your account."}
                </Text>
                <TouchableOpacity style={styles.callNowButton} onPress={() => setNotVerifiedPopup("")} accessibilityRole="button">
                  <Text style={styles.callNowButtonText}>OK</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={callConfirmOpen} transparent animationType="fade" onRequestClose={() => setCallConfirmOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          {/* DESIGN.md look: same siren icon as the Emergency button, big dark text, */}
          {/* the main action on top at full width and Cancel underneath, so they are hard to mix up. */}
          <View style={styles.confirmCard}>
            <MaterialCommunityIcons name="alarm-light-outline" size={52} color={DESIGN_COLORS.emergencyRed} />
            <Text style={styles.confirmTitle}>Send emergency alert?</Text>
            <Text style={styles.confirmText}>Dispatchers will see your name and phone number. We will try to send your location.</Text>

            <Pressable
              style={({ pressed }) => [styles.confirmSendButton, pressed && styles.emergencyButtonPressed]}
              onPress={() => {
                setCallConfirmOpen(false);
                sendEmergencyAlert();
              }}
              android_ripple={{ color: "rgba(255, 255, 255, 0.2)" }}
              accessibilityRole="button"
              accessibilityLabel="Send the emergency alert"
            >
              <Text style={styles.confirmSendText}>Send alert</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.confirmCancelButton, pressed && styles.confirmCancelPressed]}
              onPress={() => setCallConfirmOpen(false)}
              accessibilityRole="button"
            >
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={callOpen} transparent animationType="fade" onRequestClose={handleAlertBack}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <ScrollView
            style={[styles.callCard, compact && styles.modalCardCompact, { backgroundColor: theme.surface }]}
            contentContainerStyle={styles.callCardContent}
            showsVerticalScrollIndicator={false}
          >
            {cancelAlertConfirmOpen ? (
              <>
                <FontAwesome name="exclamation-circle" size={52} color="#CF0000" />
                <Text style={[styles.callTitle, { color: theme.text }]} accessibilityLiveRegion="polite">
                  Cancel your emergency alert?
                </Text>
                <Text style={[styles.callSubtitle, { color: theme.mutedText }]}>
                  {sendPhase === "sent" ? "Dispatchers will stop seeing it." : "It will be cancelled, even if it is still sending."}
                </Text>

                <TouchableOpacity style={styles.callNowButton} onPress={() => setCancelAlertConfirmOpen(false)} accessibilityRole="button" accessibilityLabel="Keep the emergency alert">
                  <Text style={styles.callNowButtonText}>Keep alert</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.endCallButton} onPress={closeEmergencyAlert} accessibilityRole="button" accessibilityLabel="Cancel the emergency alert">
                  <Text style={styles.endCallButtonText}>Cancel alert</Text>
                </TouchableOpacity>
              </>
            ) : (() => {
              const dispatcherLabel = callDispatcherName || "the dispatcher";
              const sending = sendPhase === "sending";
              const sendFailed = sendPhase === "failed";
              const confirmed = sendPhase === "sent";
              const waitingForAnswer = confirmed && callStatus === "ringing" && !noAnswerTimedOut;
              const unanswered = confirmed && callStatus === "ringing" && noAnswerTimedOut;
              const accepted = confirmed && callStatus === "connected";
              const declined = confirmed && callStatus === "declined";
              const showOfficeFallback = sendFailed || unanswered || declined;
              // While the alert is still live (sending, waiting, or possibly queued), the
              // bottom button cancels and goes through the confirmation question.
              const stillLive = sending || sendFailed || waitingForAnswer || unanswered;

              const icon = accepted ? "check-circle" : sending || waitingForAnswer ? "bell" : "exclamation-circle";
              const iconColor = accepted ? "#06774B" : "#CF0000";
              const title = sending
                ? "Sending alert…"
                : sendFailed
                  ? "Alert not confirmed"
                  : accepted
                    ? "Dispatcher accepted"
                    : waitingForAnswer
                      ? "Emergency alert sent"
                      : unanswered
                        ? "No dispatcher has accepted yet"
                        : declined
                          ? "Dispatcher could not accept"
                          : "Alert closed";

              // The body states what the resident can do next, so it never promises a
              // call button that isn't there.
              let body = "This alert is no longer active.";
              if (sending) {
                body = "Sending to dispatchers.";
              } else if (sendFailed) {
                // The queued write only survives while the app stays open (memory cache).
                body = officePhone
                  ? "We could not confirm the alert reached dispatch. It may still go through if you keep this screen open. Try again, or call the office."
                  : "We could not confirm the alert reached dispatch. It may still go through if you keep this screen open. Try again, or ask someone nearby to call for help.";
              } else if (accepted) {
                // Only say "can see where you are" once the location really was sent.
                // This is worked out again every time the screen redraws, so it updates by itself when "sending" turns into "sent".
                const hasAlert = alertLocationStatus === "sent" ? "has your alert and can see where you are." : "has your alert.";
                body = callDispatcherPhone
                  ? `${dispatcherLabel} ${hasAlert}`
                  : `${dispatcherLabel} ${hasAlert} No phone number is on file for them.`;
              } else if (waitingForAnswer) {
                body = "Waiting for a dispatcher to accept.";
              } else if (showOfficeFallback) {
                body = officePhone
                  ? "You can call the office directly while you wait."
                  : "The office phone number is not available. Keep waiting, or ask someone nearby to call for help.";
              }

              const locationLine =
                alertLocationStatus === "pending"
                  ? "Location: sending…"
                  : alertLocationStatus === "sent"
                    ? "Location: sent"
                    : alertLocationStatus === "failed"
                      ? "Location: not available — dispatchers will see your barangay."
                      : "";
              const showCallDispatcher = accepted && Boolean(callDispatcherPhone);
              const showCallOffice = showOfficeFallback && Boolean(officePhone);
              const closeLabel = accepted ? "Done" : stillLive ? "Cancel alert" : "Close";
              const onClosePress = stillLive ? handleAlertBack : closeEmergencyAlert;

              return (
                <>
                  <FontAwesome name={icon} size={52} color={iconColor} />
                  <Text style={[styles.callTitle, { color: theme.text }]} accessibilityLiveRegion="polite">
                    {title}
                  </Text>
                  <Text style={[styles.callSubtitle, { color: theme.mutedText }]}>{body}</Text>
                  {sending || waitingForAnswer || unanswered ? (
                    <Text style={[styles.callSubtitle, { color: theme.text, fontWeight: "700" }]}>Keep this screen open until a dispatcher accepts.</Text>
                  ) : null}
                  {sending || waitingForAnswer ? <ActivityIndicator color="#CF0000" style={styles.alertSpinner} /> : null}
                  {locationLine && (sending || waitingForAnswer || unanswered || accepted) ? (
                    <Text style={[styles.callSubtitle, { color: theme.secondaryText }]}>{locationLine}</Text>
                  ) : null}

                  {sendFailed ? (
                    <TouchableOpacity style={styles.callNowButton} onPress={retryEmergencyAlert} accessibilityRole="button" accessibilityLabel="Try sending the alert again">
                      <Text style={styles.callNowButtonText}>Try again</Text>
                    </TouchableOpacity>
                  ) : null}

                  {showCallDispatcher ? (
                    <TouchableOpacity style={styles.callNowButton} onPress={() => openPhone(callDispatcherPhone)} accessibilityRole="button" accessibilityLabel={`Call ${dispatcherLabel}`}>
                      <Text style={styles.callNowButtonText}>Call {dispatcherLabel}</Text>
                    </TouchableOpacity>
                  ) : null}

                  {showCallOffice ? (
                    <TouchableOpacity style={styles.callNowButton} onPress={() => openPhone(officePhone)} accessibilityRole="button" accessibilityLabel="Call the office">
                      <Text style={styles.callNowButtonText}>Call the office</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={stillLive ? styles.cancelAlertButton : styles.endCallButton}
                    onPress={onClosePress}
                    accessibilityRole="button"
                    accessibilityLabel={closeLabel}
                  >
                    <Text style={stillLive ? styles.cancelAlertButtonText : styles.endCallButtonText}>{closeLabel}</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </ScrollView>
        </View>
      </Modal>

      <ResidentSideMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        name={displayName}
        profile={activeProfile}
        officePhone={officePhone}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenProfile={() => setProfileEditorOpen(true)}
        onOpenSettings={openSettings}
      />

      <Modal visible={profileEditorOpen} transparent animationType="fade" onRequestClose={() => setProfileEditorOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.profileEditorCard, compact && styles.modalCardCompact, { backgroundColor: theme.surface }]}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setProfileEditorOpen(false)}>
              <Text style={styles.modalCloseText}>X</Text>
            </TouchableOpacity>

            <Text style={[styles.modalTitle, { color: theme.text }]}>Profile</Text>
            <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>Resident account details currently saved in your profile.</Text>

            <View style={[styles.profileInfoCard, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.profileInfoLabel, { color: theme.secondaryText }]}>Full Name</Text>
              <Text style={[styles.profileInfoValue, { color: theme.text }]}>{displayName || "Not set"}</Text>
            </View>

            <View style={[styles.profileInfoCard, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.profileInfoLabel, { color: theme.secondaryText }]}>Email Address</Text>
              <Text style={[styles.profileInfoValue, { color: theme.text }]}>{activeProfile?.email || authUser?.email || "Not set"}</Text>
            </View>

            <View style={[styles.profileInfoCard, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.profileInfoLabel, { color: theme.secondaryText }]}>Phone Number</Text>
              <Text style={[styles.profileInfoValue, { color: theme.text }]}>{activeProfile?.phoneNumber || activeProfile?.phone || "Not set"}</Text>
            </View>

            <View style={[styles.profileInfoCard, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.profileInfoLabel, { color: theme.secondaryText }]}>Barangay</Text>
              <Text style={[styles.profileInfoValue, { color: theme.text }]}>{activeProfile?.barangay || "Not set"}</Text>
            </View>

            <View style={[styles.profileInfoCard, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.profileInfoLabel, { color: theme.secondaryText }]}>Address</Text>
              <Text style={[styles.profileInfoValue, { color: theme.text }]}>{activeProfile?.address || "Not set"}</Text>
            </View>
          </View>
        </View>
      </Modal>

      <ResidentRequestHistory
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        requests={requestHistory}
        loading={requestHistoryLoading}
        error={requestHistoryError}
      />
      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)} statusBarTranslucent navigationBarTranslucent>
        {/* The keyboard helper adds space for the keyboard; the card gets shorter and scrolls,
            so the box being typed in stays visible. Full-screen (translucent) so the space is measured correctly. */}
        <KeyboardAvoidingView behavior="padding" style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.profileEditorCard, styles.editorCardFit, compact && styles.modalCardCompact, { backgroundColor: theme.surface }]}>
            <ScrollView style={styles.editorScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.modalClose} onPress={() => setSettingsOpen(false)}>
                <Text style={styles.modalCloseText}>X</Text>
              </TouchableOpacity>

              <Text style={[styles.modalTitle, { color: theme.text }]}>Settings</Text>
              <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>Update your resident account details, password, and theme mode.</Text>

              <Text style={[styles.modalLabel, { color: theme.text }]}>Username</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                placeholder="Full name"
                placeholderTextColor={theme.subtleText}
                value={settingsForm.fullName}
                onChangeText={(value) => setSettingsForm((current) => ({ ...current, fullName: value }))}
              />

              <Text style={[styles.modalLabel, { color: theme.text }]}>Phone Number</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                placeholder="Phone number"
                placeholderTextColor={theme.subtleText}
                value={settingsForm.phoneNumber}
                onChangeText={(value) => setSettingsForm((current) => ({ ...current, phoneNumber: value }))}
                keyboardType="phone-pad"
              />

              <Text style={[styles.modalLabel, { color: theme.text }]}>Email Address</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                placeholder="Email address"
                placeholderTextColor={theme.subtleText}
                value={settingsForm.email}
                onChangeText={(value) => setSettingsForm((current) => ({ ...current, email: value }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.secondaryActionButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                onPress={() => setChangePasswordOpen(true)}
              >
                <Text style={[styles.secondaryActionButtonText, { color: theme.text }]}>Change Password</Text>
              </TouchableOpacity>

              {settingsError ? <Text style={styles.errorText}>{settingsError}</Text> : null}
              {settingsMessage ? <Text style={styles.feedbackText}>{settingsMessage}</Text> : null}

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: savingSettings ? theme.disabledButtonBg : "#06774B" }]}
                onPress={saveResidentSettings}
                disabled={savingSettings}
              >
                <Text style={[styles.saveButtonText, { color: savingSettings ? theme.disabledButtonText : "#FFFFFF" }]}>
                  {savingSettings ? "Saving..." : "Save Settings"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={changePasswordOpen} transparent animationType="fade" onRequestClose={() => setChangePasswordOpen(false)} statusBarTranslucent navigationBarTranslucent>
        <KeyboardAvoidingView behavior="padding" style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.profileEditorCard, styles.editorCardFit, compact && styles.modalCardCompact, { backgroundColor: theme.surface }]}>
            <ScrollView style={styles.editorScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.modalClose} onPress={() => setChangePasswordOpen(false)}>
                <Text style={styles.modalCloseText}>X</Text>
              </TouchableOpacity>

              <Text style={[styles.modalTitle, { color: theme.text }]}>Change Password</Text>
              <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>Enter your current password, then set a new one.</Text>

              <Text style={[styles.modalLabel, { color: theme.text }]}>Current Password</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                placeholder="Enter current password"
                placeholderTextColor={theme.subtleText}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
              />

              <Text style={[styles.modalLabel, { color: theme.text }]}>New Password</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                placeholder="Enter new password"
                placeholderTextColor={theme.subtleText}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />

              <Text style={[styles.modalLabel, { color: theme.text }]}>Confirm New Password</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                placeholder="Confirm new password"
                placeholderTextColor={theme.subtleText}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />

              {settingsError ? <Text style={styles.errorText}>{settingsError}</Text> : null}
              {settingsMessage ? <Text style={styles.feedbackText}>{settingsMessage}</Text> : null}

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: savingSettings ? theme.disabledButtonBg : "#06774B" }]}
                onPress={saveResidentPassword}
                disabled={savingSettings}
              >
                <Text style={[styles.saveButtonText, { color: savingSettings ? theme.disabledButtonText : "#FFFFFF" }]}>
                  {savingSettings ? "Saving..." : "Update Password"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// The small card on the map when your location can't be shown. location = what useHomeLocation() returns.
// Nothing shows when your location was found, is still being checked the first time, or on the website.
function LocationNote({ location }) {
  let icon = "map-marker-off-outline";
  let message = "";
  let buttonLabel = "";
  let onPress = null;

  if (location.status === "denied") {
    message = "Location is off. You can still pin your pickup or type a landmark.";
    // Blocked = Android won't show the pop-up again, so the button opens the phone's Settings.
    if (location.blocked) message += " In Settings, choose Permissions → Location → Allow.";
    buttonLabel = "Allow location";
    onPress = location.allowLocation;
  } else if (location.status === "gps-off") {
    icon = "crosshairs-off";
    message = "Turn on Location (GPS) to see where you are on the map.";
    buttonLabel = "Try again";
    onPress = location.retry;
  } else if (location.status === "error") {
    icon = "crosshairs-question";
    message = "We couldn't find your location right now.";
    buttonLabel = "Try again";
    onPress = location.retry;
  }

  if (!message) return null;

  return (
    <View style={styles.locationNote}>
      <MaterialCommunityIcons name={icon} size={26} color={DESIGN_COLORS.inkMuted} />
      <View style={styles.locationNoteCopy}>
        <Text style={styles.locationNoteText}>{message}</Text>
        <Pressable
          style={({ pressed }) => [styles.locationNoteButton, pressed && styles.locationNoteButtonPressed]}
          onPress={onPress}
          disabled={location.checking}
          accessibilityRole="button"
        >
          <Text style={styles.locationNoteButtonText}>{location.checking ? "Checking…" : buttonLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  home: { flex: 1 },
  mapArea: { flex: 1 },
  // Place strip: Hall Green across the top, white text. The ☰ button sits at its left.
  placeStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 4,
    paddingRight: 16,
    paddingBottom: 4,
    backgroundColor: DESIGN_COLORS.hallGreen,
  },
  // 48 x 48 so it is easy to tap. Square with 8 corners (DESIGN.md), darker green while pressed.
  menuButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  menuButtonPressed: { backgroundColor: DESIGN_COLORS.hallGreenDeep },
  placeNames: { flex: 1, flexDirection: "row", flexWrap: "wrap", paddingVertical: 10 },
  placeText: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: "#FFFFFF" },
  // Floating layer over the top of the map, just under the strip: the account status banner (not Active only)
  // and the "Location is off" note.
  mapOverlay: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    gap: 12,
    alignItems: "flex-start",
  },
  // Flat sign (DESIGN.md "Flat Board Rule"): white with a grey edge, no shadow.
  locationNote: {
    alignSelf: "stretch",
    maxWidth: 640,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  locationNoteCopy: { flex: 1 },
  locationNoteText: { fontSize: 17, lineHeight: 24, fontWeight: "600", color: DESIGN_COLORS.ink },
  // Outline button: the edge is dark enough to see where the button starts and ends.
  locationNoteButton: {
    alignSelf: "flex-start",
    minHeight: 48,
    marginTop: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    alignItems: "center",
    justifyContent: "center",
  },
  locationNoteButtonPressed: { backgroundColor: DESIGN_COLORS.boardTint },
  locationNoteButtonText: { fontSize: 17, fontWeight: "700", color: DESIGN_COLORS.hallGreen },
  sheet: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "68%",
    alignSelf: "center",
    borderTopLeftRadius: SHEET_OVERLAP,
    borderTopRightRadius: SHEET_OVERLAP,
    // Flat like a printed sign (DESIGN.md "Flat Board Rule"): a green line on top instead of a soft shadow.
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: DESIGN_COLORS.hallGreen,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  // The whole top strip of the sheet can be swiped or tapped, not just the small bar, so it is easy to hit.
  sheetGrabArea: { alignItems: "center", justifyContent: "center", minHeight: 40, paddingVertical: 12 },
  // Dark enough to see (4.2:1 on white). Square ends: DESIGN.md has no pill shapes.
  sheetHandle: { width: 48, height: 5, backgroundColor: DESIGN_COLORS.controlOutline },
  emergencyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 76,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: DESIGN_COLORS.emergencyRed,
  },
  emergencyButtonPressed: { backgroundColor: "#8F1C13" },
  emergencyCopy: { flex: 1 },
  // "Board" size from DESIGN.md: the biggest text in the app.
  emergencyTitle: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: "#FFFFFF" },
  emergencySubtitle: { marginTop: 2, fontSize: 17, lineHeight: 22, fontWeight: "600", color: "#FFE9E7" },
  rideButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 16,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: DESIGN_COLORS.hallGreen,
  },
  rideButtonPressed: { backgroundColor: DESIGN_COLORS.hallGreenDeep },
  // "Title" size from DESIGN.md: the home screen's second big action.
  rideButtonText: { fontSize: 22, lineHeight: 28, fontWeight: "800", color: "#FFFFFF" },
  // Account status banner (residents who are not Active only). Big, dark text for seniors.
  // Flat sign (DESIGN.md "Flat Board Rule"): tinted background and a 2dp colored edge, no shadow.
  statusBanner: {
    alignSelf: "stretch",
    maxWidth: 640,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
  },
  statusBannerPending: {
    backgroundColor: DESIGN_COLORS.amberTint,
    borderColor: DESIGN_COLORS.waitingAmber,
  },
  statusBannerRejected: {
    backgroundColor: DESIGN_COLORS.redTint,
    borderColor: DESIGN_COLORS.emergencyRed,
  },
  statusBannerCopy: {
    flex: 1,
  },
  statusBannerTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    color: DESIGN_COLORS.ink,
  },
  statusBannerText: {
    marginTop: 4,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
    color: DESIGN_COLORS.ink,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  modalCard: {
    width: "100%",
    maxWidth: 700,
    maxHeight: "92%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
  },
  modalCardCompact: {
    borderRadius: 18,
    padding: 18,
  },
  modalScrollContent: {
    paddingBottom: 4,
  },
  modalClose: {
    alignSelf: "flex-end",
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F51D1D",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  modalTitle: {
    marginTop: 8,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "800",
    textAlign: "center",
    color: "#111111",
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    color: "#333333",
  },
  modalLabel: {
    marginTop: 22,
    fontSize: 15,
    fontWeight: "700",
    color: "#111111",
  },
  dropdown: {
    marginTop: 10,
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#D7D7D7",
    borderRadius: 13,
    backgroundColor: "#FCFCFC",
    paddingHorizontal: 14,
  },
  dropdownContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D7D7D7",
    backgroundColor: "#FFFFFF",
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: "#8B8B8B",
  },
  dropdownSelectedText: {
    fontSize: 15,
    color: "#111111",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#111111",
  },
  textArea: {
    marginTop: 10,
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#D7D7D7",
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#FCFCFC",
    fontSize: 15,
    lineHeight: 21,
    color: "#111111",
  },
  notesArea: {
    minHeight: 78,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 28,
  },
  sendButton: {
    backgroundColor: "#06774B",
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  // "Send emergency alert?" pop-up (DESIGN.md look). Its own styles, so the other pop-ups don't change yet.
  confirmCard: {
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    padding: 24,
    borderRadius: 8,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  confirmTitle: { marginTop: 12, fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.ink, textAlign: "center" },
  confirmText: { marginTop: 8, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.ink, textAlign: "center" },
  // Same height and red as the Emergency button on home.
  confirmSendButton: {
    alignSelf: "stretch",
    minHeight: 76,
    marginTop: 20,
    paddingHorizontal: 16,
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DESIGN_COLORS.emergencyRed,
  },
  confirmSendText: { fontSize: 22, lineHeight: 28, fontWeight: "800", color: "#FFFFFF" },
  confirmCancelButton: {
    alignSelf: "stretch",
    minHeight: 56,
    marginTop: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  confirmCancelPressed: { backgroundColor: DESIGN_COLORS.boardTint },
  confirmCancelText: { fontSize: 17, fontWeight: "700", color: DESIGN_COLORS.ink },
  callCard: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "90%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
  },
  // Centering lives here, not in callCard: a ScrollView only accepts it through contentContainerStyle.
  callCardContent: {
    alignItems: "center",
  },
  callTitle: {
    marginTop: 14,
    fontSize: 24,
    fontWeight: "800",
    color: "#111111",
    textAlign: "center",
  },
  callSubtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 23,
    color: "#4A5C55",
    textAlign: "center",
  },
  // "Not verified yet" / "on hold" pop-up (residents who are not Active). Bigger, darker text than callSubtitle for seniors.
  notVerifiedText: {
    marginTop: 10,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "600",
    textAlign: "center",
  },
  call911Button: {
    flexDirection: "row",
    gap: 10,
  },
  notVerifiedCloseButton: {
    width: "100%",
    marginTop: 12,
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  notVerifiedCloseText: {
    fontSize: 17,
    fontWeight: "800",
  },
  endCallButton: {
    width: "100%",
    marginTop: 24,
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "#CF0000",
    alignItems: "center",
    justifyContent: "center",
  },
  endCallButtonText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  callNowButton: {
    width: "100%",
    marginTop: 24,
    minHeight: 58,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "#06774B",
    alignItems: "center",
    justifyContent: "center",
  },
  callNowButtonText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  alertSpinner: {
    marginTop: 14,
  },
  // Low-emphasis on purpose: while an alert is live, the solid green "Keep alert" /
  // "Call" actions should win the eye over cancelling.
  cancelAlertButton: {
    width: "100%",
    marginTop: 24,
    minHeight: 58,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#CF0000",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelAlertButtonText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#CF0000",
    textAlign: "center",
  },
  menuItemSoon: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7B8E86",
  },
  // Settings / Change Password cards: flexShrink lets the card get shorter when the keyboard is open, and the
  // ScrollView inside (flexGrow 0 = only as tall as its content) scrolls instead.
  editorCardFit: { flexShrink: 1 },
  editorScroll: { flexGrow: 0 },
  profileEditorCard: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
  },
  profileInfoCard: {
    marginTop: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#F4F7F5",
  },
  profileInfoLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#60716B",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  profileInfoValue: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    color: "#1C2D27",
  },
  historyList: {
    paddingTop: 18,
    paddingBottom: 6,
    gap: 14,
  },
  historyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  historyTitle: {
    flex: 1,
    minWidth: 180,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: "#1C2D27",
  },
  historyText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#4F655C",
  },
  profileInput: {
    marginTop: 10,
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#D7D7D7",
    borderRadius: 13,
    paddingHorizontal: 14,
    backgroundColor: "#FCFCFC",
    fontSize: 15,
    color: "#111111",
  },
  secondaryActionButton: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryActionButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1C2D27",
  },
  errorText: {
    marginTop: 16,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: "#B42318",
  },
  feedbackText: {
    marginTop: 16,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: "#06774B",
  },
  saveButton: {
    marginTop: 24,
    minHeight: 52,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#06774B",
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  disabledSaveButton: {
    marginTop: 28,
    minHeight: 52,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#CFD8D3",
  },
  disabledSaveButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#466157",
  },
});
