import { MaterialCommunityIcons } from "@expo/vector-icons";
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ACCOUNT_STATUSES, FIRESTORE_COLLECTIONS } from "../constants/app";
import { CORNER, FONT, GREEN, NEUTRAL, ORANGE, RED, SHADOW } from "../constants/design";
import { auth, db } from "../firebase";
import { startPhoneCall } from "../lib/phoneCall";
import { getAccountStatusLabel } from "../lib/roles";
import { saveLocalUserProfile, useCurrentUserProfile } from "../lib/session";
import CloseButton from "../components/ui/CloseButton";
import LatestRequestCard from "../features/resident/components/LatestRequestCard";
import ResidentRequestDetails from "../features/resident/components/ResidentRequestDetails";
import ResidentRequestForm from "../features/resident/components/ResidentRequestForm";
import ResidentRequestHistory from "../features/resident/components/ResidentRequestHistory";
import ResidentSideMenu from "../features/resident/components/ResidentSideMenu";
import useCurrentLocation from "../features/resident/hooks/useCurrentLocation";
import useResidentRequests from "../features/resident/hooks/useResidentRequests";
import { getHomeRide } from "../features/resident/utils/requestMapper";
import { normalizePhilippinePhone } from "../features/resident/utils/requestValidation";

const NO_ANSWER_TIMEOUT_MS = 30_000;
// Firestore queues writes while offline and the promise simply stays pending, so an
// unconfirmed write after this long is treated as failed even though it may sync later.
const SEND_TIMEOUT_MS = 10_000;
// While an alert is ringing, the app saves "I'm still here" (lastActiveAt) this often.
// Dispatchers hide a ringing alert that has gone 2 minutes without one (crashed or closed app).
const ALERT_HEARTBEAT_MS = 20_000;
const KEEP_AWAKE_TAG = "emergency-alert";
// After a dispatcher answers, the phone calls them after this many seconds, unless the resident taps Cancel call.
const AUTO_CALL_SECONDS = 3;
// The bottom bar's pages (ROADMAP Task 3.18). "Chat" is added only when Task 3.23 is built.
const PAGES = [
  { key: "ride", label: "Your ride", icon: "van-passenger" },
  { key: "history", label: "History", icon: "history" },
];

export default function ResidentHome() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 920;
  const { authUser, displayName: fallbackDisplayName, profile } = useCurrentUserProfile();
  const { requests: requestHistory, loading: requestHistoryLoading, error: requestHistoryError } = useResidentRequests(authUser?.uid);
  const latestRequest = requestHistory[0] ?? null;
  // The ride on the "Your ride" card: a ride a driver is on right now first, otherwise the newest one.
  const homeRide = getHomeRide(requestHistory);
  const [menuOpen, setMenuOpen] = useState(false);
  // A Rejected resident's reason from the proof-of-residency review. null = not read (yet), or the read failed.
  const [verificationReason, setVerificationReason] = useState(null);
  const [latestDetailsOpen, setLatestDetailsOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  // The open page of the bottom bar: "ride" (Emergency, Request a Ride, Your ride) or "history" (Task 3.18).
  const [activePage, setActivePage] = useState("ride");
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
  // True when the dispatcher had no phone, so the website gave the office number instead.
  const [callDispatcherPhoneIsOffice, setCallDispatcherPhoneIsOffice] = useState(false);
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
  // Auto call after a dispatcher answers (emergency-auto-call-plan.md).
  // Seconds left in the "Calling Maria in 3…" countdown, or null when no countdown is running.
  const [autoCallSeconds, setAutoCallSeconds] = useState(null);
  // True once the countdown reached 0 and the call was started: the button then says "Call Maria again".
  const [autoCalled, setAutoCalled] = useState(false);
  // The alert the countdown already ran for, so each alert counts down (and calls) only once.
  const autoCallAlertRef = useRef("");
  const { detectLocation } = useCurrentLocation();
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

  // Always the live profile from Firestore (useCurrentUserProfile listens for changes), so an admin approving or
  // suspending the resident updates the banners and the Emergency button right away, even after a Settings save.
  const activeProfile = profile;
  const displayName = activeProfile?.fullName?.trim() || fallbackDisplayName;
  // Only Active residents can send alerts or requests (same as isActiveResident in firestore.rules).
  // Everyone else can open this screen but gets a pop-up instead. While the profile is still
  // loading we don't know the status yet, so nothing is blocked.
  const notActive = Boolean(activeProfile) && activeProfile.accountStatus !== ACCOUNT_STATUSES.ACTIVE;
  const isRejected = activeProfile?.accountStatus === ACCOUNT_STATUSES.REJECTED;
  const isPending = activeProfile?.accountStatus === ACCOUNT_STATUSES.PENDING;
  // For the place strip. The profile saves "Poblacion, Toledo City"; the strip already says Toledo City, so drop that part.
  const barangayName = (activeProfile?.barangay || "").replace(/,\s*Toledo City$/i, "").trim();
  // Why the account is Rejected or on hold, in the admin's own words.
  // Rejected: from the proof-of-residency review first, then from an Operations status change (accountStatusReason).
  // On hold (Suspended, Disabled): only from an Operations status change.
  const savedStatusReason = activeProfile?.accountStatusReason || "";
  let statusReason = "";
  if (isRejected) {
    statusReason = verificationReason || savedStatusReason || (verificationReason === null ? "" : "No reason was given.");
  } else if (notActive && !isPending) {
    statusReason = savedStatusReason || "No reason was given.";
  }
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
        setCallDispatcherPhoneIsOffice(callData?.dispatcherPhoneIsOffice === true);

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

  // Auto call, part 1 (emergency-auto-call-plan.md): when a dispatcher with a phone number answers,
  // start the "Calling Maria in 3…" countdown. Only on the phone app, only while SakayNa is on screen,
  // not while "Cancel your emergency alert?" is open, and only once per alert.
  // This deliberately changes the old rule "nothing calls unless the user taps a Call button".
  useEffect(() => {
    const accepted = callOpen && sendPhase === "sent" && callStatus === "connected";
    if (Platform.OS === "web" || !accepted || !callDispatcherPhone || cancelAlertConfirmOpen) return;
    if (autoCallAlertRef.current === callSessionId || AppState.currentState !== "active") return;

    autoCallAlertRef.current = callSessionId;
    setAutoCallSeconds(AUTO_CALL_SECONDS);
  }, [callOpen, sendPhase, callStatus, callDispatcherPhone, cancelAlertConfirmOpen, callSessionId]);

  // Auto call, part 2: count down once a second, then call through the same startPhoneCall as the Call buttons.
  // Leaving the app (Home button, another app) stops the countdown, so it can never call later by surprise.
  useEffect(() => {
    if (autoCallSeconds === null) return undefined;

    const timeoutId = setTimeout(() => {
      if (autoCallSeconds > 1) {
        setAutoCallSeconds(autoCallSeconds - 1);
        return;
      }
      setAutoCallSeconds(null);
      if (AppState.currentState === "active") {
        setAutoCalled(true);
        startPhoneCall(callDispatcherPhone);
      }
    }, 1000);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") setAutoCallSeconds(null);
    });

    return () => {
      clearTimeout(timeoutId);
      appStateSubscription.remove();
    };
  }, [autoCallSeconds, callDispatcherPhone]);

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
    setCallDispatcherPhoneIsOffice(false);
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
    setCallDispatcherPhoneIsOffice(false);
    setNoAnswerTimedOut(false);
    setAlertLocationStatus("idle");
    // Done or Back during the countdown: no call.
    setAutoCallSeconds(null);
    setAutoCalled(false);
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

      // No local copy of the profile here: the live profile listener already picks up this save right away.

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

  // A Rejected resident: read the admin's reason once from their own verification record.
  // (Firestore lets a resident read their own residentVerifications document.) If the read fails, no reason line shows.
  useEffect(() => {
    if (!isRejected || !authUser?.uid) return undefined;

    let cancelled = false;
    getDoc(doc(db, FIRESTORE_COLLECTIONS.RESIDENT_VERIFICATIONS, authUser.uid))
      .then((snapshot) => {
        if (!cancelled) setVerificationReason(snapshot.data()?.rejectionReason || "");
      })
      .catch((error) => console.log("Rejection reason warning:", error));

    return () => {
      cancelled = true;
    };
  }, [isRejected, authUser?.uid]);

  return (
    <>
      <View style={[styles.home, { backgroundColor: NEUTRAL[50] }]}>
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
            {/* maxFontSizeMultiplier: the strip grows with the phone's text size only up to 1.3x, so it stays 1-2 lines */}
            {/* and Emergency stays near the top. Emergency, the buttons and the card still grow fully. */}
            <Text style={styles.placeText} maxFontSizeMultiplier={1.3}>
              {barangayName ? "Toledo City · " : "Toledo City"}
            </Text>
            {barangayName ? (
              <Text style={styles.placeText} maxFontSizeMultiplier={1.3}>
                Barangay {barangayName}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Everything under the place strip scrolls, so with very large text nothing is cut off. */}
        {/* persistentScrollbar: on Android the scroll bar stays visible, so it shows there is more below. */}
        {activePage === "ride" ? (
        <ScrollView style={styles.homeScroll} contentContainerStyle={styles.homeContent} bounces={false} persistentScrollbar>
          {notActive ? (
            // A flat sign: peach and orange while waiting, red when the account can't send emergency alerts.
            <View style={[styles.statusBanner, isPending ? styles.statusBannerPending : styles.statusBannerRejected]}>
              <MaterialCommunityIcons
                name={isPending ? "clock-outline" : isRejected ? "close-circle-outline" : "pause-circle-outline"}
                size={28}
                color={isPending ? ORANGE[700] : RED[600]}
              />
              <View style={styles.statusBannerCopy}>
                <Text style={styles.statusBannerTitle}>{getAccountStatusLabel(activeProfile) || "On hold"}</Text>
                {isPending ? (
                  <Text style={styles.statusBannerText}>
                    Your barangay admin is checking your proof of residency. You can send emergency alerts and ride requests once approved.
                  </Text>
                ) : isRejected ? (
                  <>
                    <Text style={styles.statusBannerText}>Your proof of residency was not accepted.</Text>
                    <StatusReason reason={statusReason} />
                    <Text style={styles.statusBannerText}>You cannot send emergency alerts or ride requests.</Text>
                    {officePhone ? (
                      <Pressable
                        style={({ pressed }) => [styles.bannerCallButton, pressed && styles.bannerCallButtonPressed]}
                        onPress={() => openPhone(officePhone)}
                        accessibilityRole="button"
                        accessibilityLabel="Call the office"
                      >
                        <MaterialCommunityIcons name="phone-outline" size={22} color={NEUTRAL[900]} />
                        <Text style={styles.bannerCallText}>Call the office</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.statusBannerText}>Please contact your barangay office.</Text>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.statusBannerText}>
                      Your account is on hold, so you cannot send emergency alerts or ride requests. Please contact the office (☰ → Help /
                      Contact office).
                    </Text>
                    <StatusReason reason={statusReason} />
                  </>
                )}
              </View>
            </View>
          ) : null}

          {/* Emergency is always the first button under the place strip (and the banner), so it is always one tap away. */}
          <EmergencyButton onPress={() => handleQuickAction("emergency-call")} />

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

          {/* No "Your ride" heading: the open tab says it, and the card's status band is its title. This keeps the
              page on one screen at normal text size; it still scrolls when it doesn't fit (small phone, big text). */}
          <LatestRequestCard
            request={homeRide}
            loading={requestHistoryLoading}
            error={requestHistoryError}
            onPress={() => setLatestDetailsOpen(true)}
          />
        </ScrollView>
        ) : (
          // History page (Task 3.18, moved here from the ☰ menu). Emergency stays at the top, outside the list,
          // so it is one tap away on this page too (DESIGN.md: Emergency visible in every state).
          <View style={styles.historyPage}>
            <View style={styles.historyEmergency}>
              <EmergencyButton onPress={() => handleQuickAction("emergency-call")} />
            </View>
            <ResidentRequestHistory requests={requestHistory} loading={requestHistoryLoading} error={requestHistoryError} />
          </View>
        )}

        {/* Bottom bar (Task 3.18): icon + word for each page. The open page has a green pill behind its icon and a
            bold green word (shape and weight, not color alone). paddingBottom keeps it above the phone's own buttons. */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom }]}>
          <View style={styles.bottomBarRow} accessibilityRole="tablist">
            {PAGES.map((page) => {
              const isOpen = activePage === page.key;
              return (
                <Pressable
                  key={page.key}
                  style={styles.tabButton}
                  onPress={() => setActivePage(page.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isOpen }}
                  accessibilityLabel={page.label}
                >
                  <View style={[styles.tabIcon, isOpen && styles.tabIconOpen]}>
                    <MaterialCommunityIcons name={page.icon} size={28} color={isOpen ? GREEN[700] : NEUTRAL[700]} />
                  </View>
                  <Text style={[styles.tabLabel, isOpen && styles.tabLabelOpen]}>{page.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* The details of the ride on the "Your ride" card. It reads the live request, so the status updates while it is open. */}
      <ResidentRequestDetails request={homeRide} visible={latestDetailsOpen && Boolean(homeRide)} onClose={() => setLatestDetailsOpen(false)} />

      <ResidentRequestForm
        visible={sosOpen}
        onClose={() => setSosOpen(false)}
        uid={authUser?.uid}
        residentName={displayName}
        profile={activeProfile}
      />
      <Modal visible={Boolean(notVerifiedPopup)} transparent animationType="fade" onRequestClose={() => setNotVerifiedPopup("")}>
        <View style={styles.modalOverlay}>
          {/* DESIGN.md look, like the "Send emergency alert?" pop-up. Same words and buttons as before. */}
          <View style={[styles.callCard, styles.callCardContent]}>
            {notVerifiedPopup === "emergency" ? (
              <>
                <MaterialCommunityIcons name="alert-circle-outline" size={52} color={RED[600]} />
                <Text style={styles.callTitle}>Emergency</Text>
                <Text style={styles.notVerifiedText}>
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
                  <MaterialCommunityIcons name="phone" size={24} color="#FFFFFF" />
                  <Text style={styles.endCallButtonText}>Call 911</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.alertDoneButton}
                  onPress={() => setNotVerifiedPopup("")}
                  accessibilityRole="button"
                >
                  <Text style={styles.alertDoneText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* The same van as the Request a Ride button. */}
                <MaterialCommunityIcons name="van-passenger" size={52} color={NEUTRAL[700]} />
                <Text style={styles.callTitle}>Request a Ride</Text>
                <Text style={styles.notVerifiedText}>
                  {isOnHold
                    ? "Your account is on hold, so you cannot send ride requests. Please contact the office (☰ → Help / Contact office)."
                    : isRejected
                      ? "Your account was not verified, so you cannot send ride requests."
                      : "Your account is still being verified. You can send ride requests after an admin from your barangay approves your account."}
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
        <View style={styles.modalOverlay}>
          {/* DESIGN.md look: same siren icon as the Emergency button, big dark text, */}
          {/* the main action on top at full width and Cancel underneath, so they are hard to mix up. */}
          <View style={styles.confirmCard}>
            <MaterialCommunityIcons name="alarm-light-outline" size={52} color={RED[600]} />
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
        <View style={styles.modalOverlay}>
          {/* DESIGN.md look, like the "Send emergency alert?" pop-up. Same states, words and buttons as before. */}
          <ScrollView
            style={styles.callCard}
            contentContainerStyle={styles.callCardContent}
            showsVerticalScrollIndicator={false}
          >
            {cancelAlertConfirmOpen ? (
              <>
                <MaterialCommunityIcons name="alert-circle-outline" size={52} color={RED[600]} />
                <Text style={styles.callTitle} accessibilityLiveRegion="polite">
                  Cancel your emergency alert?
                </Text>
                <Text style={styles.callSubtitle}>
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

              const icon = accepted ? "check-circle-outline" : sending || waitingForAnswer ? "bell-ring-outline" : "alert-circle-outline";
              const iconColor = accepted ? GREEN[600] : RED[600];
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
              // "Calling Maria in 3…" replaces the Call button until it calls or the resident taps Cancel call.
              const countingDown = accepted && autoCallSeconds !== null;
              const showCallDispatcher = accepted && Boolean(callDispatcherPhone) && !countingDown;
              // Who the countdown and the Call button say they are calling: the office when the number is the office number.
              const autoCallLabel = callDispatcherPhoneIsOffice ? "the dispatch office" : dispatcherLabel;
              const callDispatcherLabel = `Call ${autoCallLabel}${autoCalled ? " again" : ""}`;
              const showCallOffice = showOfficeFallback && Boolean(officePhone);
              const closeLabel = accepted ? "Done" : stillLive ? "Cancel alert" : "Close";
              // Cancel alert = white with a red edge. Done / Close = white with a grey edge.
              const onClosePress = stillLive ? handleAlertBack : closeEmergencyAlert;

              return (
                <>
                  <MaterialCommunityIcons name={icon} size={52} color={iconColor} />
                  <Text style={styles.callTitle} accessibilityLiveRegion="polite">
                    {title}
                  </Text>
                  <Text style={styles.callSubtitle}>{body}</Text>
                  {/* The most important instruction while waiting, so it gets its own light strip. */}
                  {sending || waitingForAnswer || unanswered ? (
                    <View style={styles.keepOpenStrip}>
                      <Text style={styles.keepOpenText}>Keep this screen open until a dispatcher accepts.</Text>
                    </View>
                  ) : null}
                  {sending || waitingForAnswer ? <ActivityIndicator color={RED[600]} style={styles.alertSpinner} /> : null}
                  {locationLine && (sending || waitingForAnswer || unanswered || accepted) ? <Text style={styles.alertLocationText}>{locationLine}</Text> : null}

                  {sendFailed ? (
                    <TouchableOpacity style={styles.callNowButton} onPress={retryEmergencyAlert} accessibilityRole="button" accessibilityLabel="Try sending the alert again">
                      <Text style={styles.callNowButtonText}>Try again</Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* Auto call countdown (emergency-auto-call-plan.md): never a surprise call. */}
                  {countingDown ? (
                    <>
                      <View style={styles.autoCallBox}>
                        <Text style={styles.autoCallText} accessibilityLiveRegion="polite">
                          Calling {autoCallLabel} in {autoCallSeconds}…
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.alertDoneButton} onPress={() => setAutoCallSeconds(null)} accessibilityRole="button" accessibilityLabel={`Cancel the call to ${autoCallLabel}`}>
                        <Text style={styles.alertDoneText}>Cancel call</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}

                  {showCallDispatcher ? (
                    <TouchableOpacity style={styles.callNowButton} onPress={() => openPhone(callDispatcherPhone)} accessibilityRole="button" accessibilityLabel={callDispatcherLabel}>
                      <Text style={styles.callNowButtonText}>{callDispatcherLabel}</Text>
                    </TouchableOpacity>
                  ) : null}

                  {showCallOffice ? (
                    <TouchableOpacity style={styles.callNowButton} onPress={() => openPhone(officePhone)} accessibilityRole="button" accessibilityLabel="Call the office">
                      <Text style={styles.callNowButtonText}>Call the office</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={stillLive ? styles.cancelAlertButton : styles.alertDoneButton}
                    onPress={onClosePress}
                    accessibilityRole="button"
                    accessibilityLabel={closeLabel}
                  >
                    <Text style={stillLive ? styles.cancelAlertButtonText : styles.alertDoneText}>{closeLabel}</Text>
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
        onReopen={() => setMenuOpen(true)}
        name={displayName}
        profile={activeProfile}
        officePhone={officePhone}
        onOpenProfile={() => setProfileEditorOpen(true)}
        onOpenSettings={openSettings}
      />

      <Modal visible={profileEditorOpen} transparent animationType="fade" onRequestClose={() => setProfileEditorOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.profileEditorCard, compact && styles.modalCardCompact]}>
            <CloseButton onPress={() => setProfileEditorOpen(false)} label="Close profile" style={styles.closeInCorner} />

            <Text style={styles.modalTitle}>Profile</Text>
            <Text style={styles.modalSubtitle}>Resident account details currently saved in your profile.</Text>

            <View style={styles.profileInfoCard}>
              <Text style={styles.profileInfoLabel}>Full name</Text>
              <Text style={styles.profileInfoValue}>{displayName || "Not set"}</Text>
            </View>

            <View style={styles.profileInfoCard}>
              <Text style={styles.profileInfoLabel}>Email address</Text>
              <Text style={styles.profileInfoValue}>{activeProfile?.email || authUser?.email || "Not set"}</Text>
            </View>

            <View style={styles.profileInfoCard}>
              <Text style={styles.profileInfoLabel}>Phone number</Text>
              <Text style={styles.profileInfoValue}>{activeProfile?.phoneNumber || activeProfile?.phone || "Not set"}</Text>
            </View>

            <View style={styles.profileInfoCard}>
              <Text style={styles.profileInfoLabel}>Barangay</Text>
              <Text style={styles.profileInfoValue}>{activeProfile?.barangay || "Not set"}</Text>
            </View>

            <View style={styles.profileInfoCard}>
              <Text style={styles.profileInfoLabel}>Address</Text>
              <Text style={styles.profileInfoValue}>{activeProfile?.address || "Not set"}</Text>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)} statusBarTranslucent navigationBarTranslucent>
        {/* The keyboard helper adds space for the keyboard; the card gets shorter and scrolls,
            so the box being typed in stays visible. Full-screen (translucent) so the space is measured correctly. */}
        <KeyboardAvoidingView behavior="padding" style={[styles.modalOverlay, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.profileEditorCard, styles.editorCardFit, compact && styles.modalCardCompact]}>
            <ScrollView style={styles.editorScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <CloseButton onPress={() => setSettingsOpen(false)} label="Close settings" style={styles.closeInCorner} />

              <Text style={styles.modalTitle}>Settings</Text>
              <Text style={styles.modalSubtitle}>Update your name, phone number, email or password.</Text>

              <Text style={styles.modalLabel}>Username</Text>
              <TextInput
                style={styles.profileInput}
                placeholder="Full name"
                placeholderTextColor={NEUTRAL[600]}
                value={settingsForm.fullName}
                onChangeText={(value) => setSettingsForm((current) => ({ ...current, fullName: value }))}
              />

              <Text style={styles.modalLabel}>Phone Number</Text>
              <TextInput
                style={styles.profileInput}
                placeholder="Phone number"
                placeholderTextColor={NEUTRAL[600]}
                value={settingsForm.phoneNumber}
                onChangeText={(value) => setSettingsForm((current) => ({ ...current, phoneNumber: value }))}
                keyboardType="phone-pad"
              />

              <Text style={styles.modalLabel}>Email Address</Text>
              <TextInput
                style={styles.profileInput}
                placeholder="Email address"
                placeholderTextColor={NEUTRAL[600]}
                value={settingsForm.email}
                onChangeText={(value) => setSettingsForm((current) => ({ ...current, email: value }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={styles.secondaryActionButton}
                onPress={() => setChangePasswordOpen(true)}
              >
                <Text style={styles.secondaryActionButtonText}>Change Password</Text>
              </TouchableOpacity>

              {settingsError ? <Text style={styles.errorText}>{settingsError}</Text> : null}
              {settingsMessage ? <Text style={styles.feedbackText}>{settingsMessage}</Text> : null}

              <TouchableOpacity
                style={[styles.saveButton, savingSettings && styles.saveButtonDisabled]}
                onPress={saveResidentSettings}
                disabled={savingSettings}
              >
                <Text style={[styles.saveButtonText, savingSettings && styles.saveButtonTextDisabled]}>
                  {savingSettings ? "Saving..." : "Save Settings"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={changePasswordOpen} transparent animationType="fade" onRequestClose={() => setChangePasswordOpen(false)} statusBarTranslucent navigationBarTranslucent>
        <KeyboardAvoidingView behavior="padding" style={[styles.modalOverlay, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.profileEditorCard, styles.editorCardFit, compact && styles.modalCardCompact]}>
            <ScrollView style={styles.editorScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <CloseButton onPress={() => setChangePasswordOpen(false)} label="Close change password" style={styles.closeInCorner} />

              <Text style={styles.modalTitle}>Change Password</Text>
              <Text style={styles.modalSubtitle}>Enter your current password, then set a new one.</Text>

              <Text style={styles.modalLabel}>Current Password</Text>
              <TextInput
                style={styles.profileInput}
                placeholder="Enter current password"
                placeholderTextColor={NEUTRAL[600]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
              />

              <Text style={styles.modalLabel}>New Password</Text>
              <TextInput
                style={styles.profileInput}
                placeholder="Enter new password"
                placeholderTextColor={NEUTRAL[600]}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />

              <Text style={styles.modalLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.profileInput}
                placeholder="Confirm new password"
                placeholderTextColor={NEUTRAL[600]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />

              {settingsError ? <Text style={styles.errorText}>{settingsError}</Text> : null}
              {settingsMessage ? <Text style={styles.feedbackText}>{settingsMessage}</Text> : null}

              <TouchableOpacity
                style={[styles.saveButton, savingSettings && styles.saveButtonDisabled]}
                onPress={saveResidentPassword}
                disabled={savingSettings}
              >
                <Text style={[styles.saveButtonText, savingSettings && styles.saveButtonTextDisabled]}>
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

// "Reason: …" line in the Rejected / on-hold banner. Shows nothing when there is no reason to show.
// The Emergency button (the same on the Your ride and History pages). Emergency Red, the biggest words in the
// app, 24 corners (its own shape: every other button is a pill) and the only Level 2 shadow on the page.
function EmergencyButton({ onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.emergencyButton, pressed && styles.emergencyButtonPressed]}
      onPress={onPress}
      android_ripple={{ color: "rgba(255, 255, 255, 0.2)" }}
      accessibilityRole="button"
      accessibilityLabel="Emergency. Send an alert to the dispatchers."
    >
      <View style={styles.emergencyIcon}>
        <MaterialCommunityIcons name="alarm-light-outline" size={30} color="#FFFFFF" />
      </View>
      <View style={styles.emergencyCopy}>
        <Text style={styles.emergencyTitle}>Emergency</Text>
        <Text style={styles.emergencySubtitle}>Send an alert to the dispatchers</Text>
      </View>
    </Pressable>
  );
}

function StatusReason({ reason }) {
  if (!reason) return null;
  return (
    <Text style={styles.statusBannerText}>
      <Text style={styles.statusBannerReasonLabel}>Reason: </Text>
      {reason}
    </Text>
  );
}

const styles = StyleSheet.create({
  home: { flex: 1 },
  // Everything under the place strip. One column, as wide as a phone, centered on a wide screen (the website).
  homeScroll: { flex: 1 },
  homeContent: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 12 },
  // History page: Emergency on top (does not scroll away), the list under it.
  historyPage: { flex: 1 },
  historyEmergency: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 16, paddingTop: 12 },
  // Place strip: Hall Green across the top, white text. The ☰ button sits at its left.
  placeStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 4,
    paddingRight: 16,
    paddingBottom: 4,
    backgroundColor: GREEN[600],
  },
  // 48 x 48 so it is easy to tap. Fully round (DESIGN.md Style: buttons are pills), darker green while pressed.
  menuButton: {
    width: 48,
    height: 48,
    borderRadius: CORNER.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  menuButtonPressed: { backgroundColor: GREEN[800] },
  placeNames: { flex: 1, flexDirection: "row", flexWrap: "wrap", paddingVertical: 10 },
  placeText: { fontSize: 17, lineHeight: 22, fontFamily: FONT.bold, color: "#FFFFFF" },
  // Emergency (DESIGN.md Style): at least 76 tall (here 80), Emergency Red, 24 corners, Level 2 shadow.
  emergencyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 80,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: CORNER.sheet,
    overflow: "hidden",
    backgroundColor: RED[600],
    ...SHADOW.level2,
  },
  emergencyButtonPressed: { backgroundColor: RED[700] },
  // The alarm in a soft white circle, so the icon reads at a glance.
  emergencyIcon: { width: 52, height: 52, borderRadius: CORNER.pill, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255, 255, 255, 0.18)" },
  emergencyCopy: { flex: 1 },
  // "Board" size from DESIGN.md: the biggest text in the app.
  emergencyTitle: { fontSize: 28, lineHeight: 34, fontFamily: FONT.extraBold, color: "#FFFFFF" },
  emergencySubtitle: { marginTop: 2, fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: "#FFE9E7" },
  // Request a Ride: a green pill (DESIGN.md Style), smaller and calmer than Emergency.
  rideButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 20,
    borderRadius: CORNER.pill,
    overflow: "hidden",
    backgroundColor: GREEN[600],
    ...SHADOW.level1,
  },
  rideButtonPressed: { backgroundColor: GREEN[800] },
  // "Title" size from DESIGN.md: the home screen's second big action.
  rideButtonText: { fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: "#FFFFFF" },
  // Account status banner (residents who are not Active only). Big, dark text for seniors.
  // Tinted info box (DESIGN.md Style): 16 corners and a thin colored edge.
  statusBanner: {
    alignSelf: "stretch",
    maxWidth: 640,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: CORNER.card,
    borderWidth: 1,
  },
  statusBannerPending: {
    backgroundColor: ORANGE[100],
    borderColor: ORANGE[300],
  },
  statusBannerRejected: {
    backgroundColor: RED[50],
    borderColor: RED[600],
  },
  statusBannerCopy: {
    flex: 1,
  },
  statusBannerTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: FONT.extraBold,
    color: NEUTRAL[900],
  },
  statusBannerText: {
    marginTop: 4,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: FONT.semiBold,
    color: NEUTRAL[900],
  },
  statusBannerReasonLabel: { fontFamily: FONT.extraBold },
  // "Call the office" in the Rejected banner: white outline button, 48 tall.
  bannerCallButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    marginTop: 10,
    paddingHorizontal: 18,
    borderRadius: CORNER.pill,
    borderWidth: 1.5,
    borderColor: NEUTRAL[500],
    backgroundColor: NEUTRAL[0],
  },
  bannerCallButtonPressed: { backgroundColor: NEUTRAL[100] },
  bannerCallText: { fontSize: 17, fontFamily: FONT.semiBold, color: NEUTRAL[900] },
  // Bottom bar (Task 3.18): white, a thin line and a soft shadow on top, two equal tabs at least 56 tall.
  bottomBar: { borderTopWidth: 1, borderTopColor: NEUTRAL[200], backgroundColor: NEUTRAL[0], boxShadow: "0 -2px 8px rgba(20, 33, 28, 0.06)" },
  bottomBarRow: { flexDirection: "row", width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 8, paddingVertical: 6 },
  tabButton: { flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 4, borderRadius: CORNER.card },
  // The open tab: a green-100 pill behind the icon (a shape, so it is not color alone) and a bold green word.
  tabIcon: { paddingHorizontal: 20, paddingVertical: 4, borderRadius: CORNER.pill },
  tabIconOpen: { backgroundColor: GREEN[100] },
  tabLabel: { fontSize: 15, lineHeight: 20, fontFamily: FONT.medium, color: NEUTRAL[700], textAlign: "center" },
  tabLabelOpen: { fontFamily: FONT.bold, color: GREEN[700] },
  // ---- Pop-ups (DESIGN.md Style): a dark see-through backdrop, white dialogs with 16 corners and a
  // Level 3 shadow, pill buttons. Emergency-sized red buttons keep the 24 corners of the Emergency button. ----
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(20, 33, 28, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCardCompact: {
    padding: 20,
  },
  // The X at the top-right of Profile, Settings and Change Password.
  closeInCorner: { alignSelf: "flex-end" },
  modalTitle: {
    marginTop: 4,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: FONT.bold,
    textAlign: "center",
    color: NEUTRAL[900],
  },
  modalSubtitle: {
    fontFamily: FONT.regular,
    marginTop: 4,
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
    color: NEUTRAL[700],
  },
  modalLabel: {
    marginTop: 16,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: FONT.semiBold,
    color: NEUTRAL[900],
  },
  // "Send emergency alert?" pop-up.
  confirmCard: {
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    padding: 24,
    borderRadius: CORNER.card,
    backgroundColor: NEUTRAL[0],
    ...SHADOW.level3,
  },
  confirmTitle: { marginTop: 12, fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: NEUTRAL[900], textAlign: "center" },
  confirmText: { fontFamily: FONT.regular, marginTop: 8, fontSize: 17, lineHeight: 24, color: NEUTRAL[900], textAlign: "center" },
  // Same height, red and 24 corners as the Emergency button on home.
  confirmSendButton: {
    alignSelf: "stretch",
    minHeight: 76,
    marginTop: 20,
    paddingHorizontal: 16,
    borderRadius: CORNER.sheet,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: RED[600],
  },
  confirmSendText: { fontSize: 22, lineHeight: 28, fontFamily: FONT.extraBold, color: "#FFFFFF" },
  confirmCancelButton: {
    alignSelf: "stretch",
    minHeight: 56,
    marginTop: 12,
    paddingHorizontal: 16,
    borderRadius: CORNER.pill,
    borderWidth: 1.5,
    borderColor: NEUTRAL[500],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: NEUTRAL[0],
  },
  confirmCancelPressed: { backgroundColor: NEUTRAL[100] },
  confirmCancelText: { fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: NEUTRAL[900] },
  // Alert screen and "not verified" pop-ups.
  callCard: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "90%",
    backgroundColor: NEUTRAL[0],
    borderRadius: CORNER.card,
    padding: 24,
    ...SHADOW.level3,
  },
  // Centering lives here, not in callCard: a ScrollView only accepts it through contentContainerStyle.
  callCardContent: {
    alignItems: "center",
  },
  callTitle: { marginTop: 12, fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: NEUTRAL[900], textAlign: "center" },
  callSubtitle: { fontFamily: FONT.regular, marginTop: 8, fontSize: 17, lineHeight: 24, color: NEUTRAL[900], textAlign: "center" },
  notVerifiedText: { marginTop: 8, fontSize: 17, lineHeight: 24, fontFamily: FONT.regular, color: NEUTRAL[900], textAlign: "center" },
  // "Keep this screen open…": the most important line while waiting, on an orange tint (a highlight, not danger).
  keepOpenStrip: { alignSelf: "stretch", marginTop: 12, padding: 12, borderRadius: CORNER.input, backgroundColor: ORANGE[100] },
  keepOpenText: { fontSize: 17, lineHeight: 24, fontFamily: FONT.bold, color: NEUTRAL[900], textAlign: "center" },
  // "Calling Maria in 3…": one big thing in Board size on a light strip (DESIGN.md), not red.
  autoCallBox: { alignSelf: "stretch", marginTop: 16, padding: 16, borderRadius: CORNER.card, backgroundColor: NEUTRAL[100] },
  autoCallText: { fontSize: 28, lineHeight: 34, fontFamily: FONT.extraBold, color: NEUTRAL[900], textAlign: "center", fontVariant: ["tabular-nums"] },
  alertLocationText: { marginTop: 8, fontSize: 15, lineHeight: 20, fontFamily: FONT.medium, color: NEUTRAL[700], textAlign: "center" },
  alertSpinner: {
    marginTop: 14,
  },
  // Solid red: "Call 911" and the final "Cancel alert" (it can't be undone).
  endCallButton: {
    width: "100%",
    marginTop: 16,
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: CORNER.pill,
    backgroundColor: RED[600],
    alignItems: "center",
    justifyContent: "center",
  },
  endCallButtonText: { fontSize: 17, lineHeight: 22, fontFamily: FONT.bold, color: "#FFFFFF", textAlign: "center" },
  // "Call 911" is as tall as the Emergency button on home, with its 24 corners.
  call911Button: {
    flexDirection: "row",
    gap: 10,
    minHeight: 76,
    borderRadius: CORNER.sheet,
  },
  // Hall Green: Try again, Call {dispatcher}, Call the office, Keep alert, OK.
  callNowButton: {
    width: "100%",
    marginTop: 16,
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: CORNER.pill,
    backgroundColor: GREEN[600],
    alignItems: "center",
    justifyContent: "center",
  },
  callNowButtonText: { fontSize: 17, lineHeight: 22, fontFamily: FONT.bold, color: "#FFFFFF", textAlign: "center" },
  // Low-emphasis on purpose: while an alert is live, the solid green "Keep alert" /
  // "Call" actions should win the eye over cancelling.
  cancelAlertButton: {
    width: "100%",
    marginTop: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: CORNER.pill,
    borderWidth: 2,
    borderColor: RED[600],
    backgroundColor: NEUTRAL[0],
    alignItems: "center",
    justifyContent: "center",
  },
  cancelAlertButtonText: { fontSize: 17, lineHeight: 22, fontFamily: FONT.bold, color: RED[600], textAlign: "center" },
  // "Done" / "Close" (the alert is over), and "Close" in the not-verified pop-up: white with a grey edge.
  alertDoneButton: {
    width: "100%",
    marginTop: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: CORNER.pill,
    borderWidth: 1.5,
    borderColor: NEUTRAL[500],
    backgroundColor: NEUTRAL[0],
    alignItems: "center",
    justifyContent: "center",
  },
  alertDoneText: { fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: NEUTRAL[900], textAlign: "center" },
  // Settings / Change Password cards: flexShrink lets the card get shorter when the keyboard is open, and the
  // ScrollView inside (flexGrow 0 = only as tall as its content) scrolls instead.
  editorCardFit: { flexShrink: 1 },
  editorScroll: { flexGrow: 0 },
  // Profile, Settings and Change Password dialogs.
  profileEditorCard: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: NEUTRAL[0],
    borderRadius: CORNER.card,
    padding: 24,
    ...SHADOW.level3,
  },
  // One profile detail: a tinted box with a small grey label (sentence case) and the value.
  profileInfoCard: {
    marginTop: 12,
    borderRadius: CORNER.input,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: NEUTRAL[100],
  },
  profileInfoLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FONT.medium,
    color: NEUTRAL[700],
  },
  profileInfoValue: {
    marginTop: 2,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: FONT.semiBold,
    color: NEUTRAL[900],
  },
  profileInput: {
    fontFamily: FONT.regular,
    marginTop: 8,
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: NEUTRAL[500],
    borderRadius: CORNER.input,
    paddingHorizontal: 14,
    backgroundColor: NEUTRAL[0],
    fontSize: 17,
    color: NEUTRAL[900],
  },
  // "Change Password": a secondary pill (white, grey edge, green words).
  secondaryActionButton: {
    marginTop: 20,
    minHeight: 48,
    borderRadius: CORNER.pill,
    borderWidth: 1.5,
    borderColor: NEUTRAL[500],
    backgroundColor: NEUTRAL[0],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  secondaryActionButtonText: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: FONT.semiBold,
    color: GREEN[700],
  },
  errorText: {
    marginTop: 16,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FONT.semiBold,
    color: RED[600],
  },
  feedbackText: {
    marginTop: 16,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FONT.semiBold,
    color: GREEN[700],
  },
  // Save: a green pill, 56 tall. While saving: neutral 200 with neutral 700 words (DESIGN.md disabled look).
  saveButton: {
    marginTop: 24,
    minHeight: 56,
    borderRadius: CORNER.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GREEN[600],
  },
  saveButtonDisabled: { backgroundColor: NEUTRAL[200] },
  saveButtonText: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: FONT.semiBold,
    color: "#FFFFFF",
  },
  saveButtonTextDisabled: { color: NEUTRAL[700] },
});
