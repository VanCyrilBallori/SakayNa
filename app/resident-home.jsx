import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword } from "firebase/auth";
import { addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";

import BrandLogo from "../components/BrandLogo";
import ProfileAvatar from "../components/profile/ProfileAvatar";
import { auth, db } from "../firebase";
import { getAuthErrorMessage, logoutCurrentUser, saveLocalUserProfile, useCurrentUserProfile } from "../lib/session";
import { useTheme } from "../lib/theme";
import ResidentRequestForm from "../features/resident/components/ResidentRequestForm";
import ResidentRequestHistory from "../features/resident/components/ResidentRequestHistory";
import useCurrentLocation from "../features/resident/hooks/useCurrentLocation";
import useResidentRequests from "../features/resident/hooks/useResidentRequests";

const NO_ANSWER_TIMEOUT_MS = 30_000;
const toTelUrl = (phone) => `tel:${String(phone).replace(/\s+/g, "")}`;

const getStatusTone = (value) => {
  if (["Assigned", "In Progress", "Completed"].includes(value)) {
    return styles.tagSuccess;
  }

  if (["Cancelled", "Error"].includes(value)) {
    return styles.tagDanger;
  }

  if (["Pending", "Urgent", "Emergency", "Planned"].includes(value)) {
    return styles.tagWarning;
  }

  return styles.tagNeutral;
};

export default function ResidentHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 920;
  const narrow = width < 560;
  const { authUser, displayName: fallbackDisplayName, profile } = useCurrentUserProfile();
  const { theme, toggleTheme } = useTheme();
  const [residentStatus, setResidentStatus] = useState({
    title: "Current Ride Status",
    description: "No active vehicle has been assigned yet. Once dispatch responds, you will see updates here.",
    meta: "Waiting for your next request",
    tag: "Tracking",
  });
  const { requests: requestHistory, loading: requestHistoryLoading, error: requestHistoryError } = useResidentRequests(authUser?.uid);
  const latestRequest = requestHistory[0] ?? null;
  const [profileOverride, setProfileOverride] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [callConfirmOpen, setCallConfirmOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [callSessionId, setCallSessionId] = useState("");
  const [callStatus, setCallStatus] = useState("idle");
  const [callDispatcherName, setCallDispatcherName] = useState("");
  const [callDispatcherPhone, setCallDispatcherPhone] = useState("");
  const [officePhone, setOfficePhone] = useState("");
  const [alertLocationStatus, setAlertLocationStatus] = useState("idle");
  const [noAnswerTimedOut, setNoAnswerTimedOut] = useState(false);
  const [cancelAlertConfirmOpen, setCancelAlertConfirmOpen] = useState(false);
  const [startingEmergencyCall, setStartingEmergencyCall] = useState(false);
  // Tracks the alert currently on screen so late GPS results can't write to a closed alert.
  const activeAlertIdRef = useRef("");
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

  const activeProfile = profileOverride ?? profile;
  const displayName = activeProfile?.fullName?.trim() || fallbackDisplayName;

  const initials = useMemo(() => {
    const words = displayName.split(" ").filter(Boolean);
    return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "R";
  }, [displayName]);

  useEffect(() => {
    if (!callSessionId) {
      return undefined;
    }

    const unsubscribe = onSnapshot(
      doc(db, "callSessions", callSessionId),
      (snapshot) => {
        const callData = snapshot.data();
        setCallStatus(callData?.status ?? "ended");
        setCallDispatcherName(callData?.dispatcherName ?? "");
        setCallDispatcherPhone(callData?.dispatcherPhone ?? "");
      },
      (error) => console.log("Emergency alert listener warning:", error)
    );

    return unsubscribe;
  }, [callSessionId]);

  useEffect(() => {
    if (!callOpen || callStatus !== "ringing") {
      setNoAnswerTimedOut(false);
      return undefined;
    }

    const timeoutId = setTimeout(() => setNoAnswerTimedOut(true), NO_ANSWER_TIMEOUT_MS);
    return () => clearTimeout(timeoutId);
  }, [callOpen, callStatus]);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

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
  }, [activeProfile?.email, activeProfile?.fullName, activeProfile?.phone, activeProfile?.phoneNumber, authUser?.email, displayName, settingsOpen]);

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
      setCallConfirmOpen(true);
      return;
    }

    if (type === "transport") {
      setSosOpen(true);
      return;
    }

    if (latestRequest) {
      setResidentStatus({
        title: latestRequest.title || `${latestRequest.serviceType || latestRequest.emergencyType || "Transport"} Request`,
        description: latestRequest.assignedDriverName
          ? `${latestRequest.status || "Pending"} | Assigned to ${latestRequest.assignedDriverName}`
          : `${latestRequest.status || "Pending"} | Waiting for dispatcher assignment`,
        meta: `${latestRequest.pickupLocation || "Pickup pending"} | ${latestRequest.vehicle || "Vehicle pending"}`,
        tag: latestRequest.status || latestRequest.level || "Tracking",
      });
      return;
    }

    setResidentStatus({
      title: "Current Ride Status",
      description: "No active vehicle has been assigned yet. Once dispatch responds, you will see updates here.",
      meta: "No recent request found",
      tag: "Tracking",
    });
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

  const loadOfficePhone = async () => {
    try {
      const snapshot = await getDoc(doc(db, "systemSettings", "operational"));
      setOfficePhone(snapshot.exists() ? (snapshot.data()?.publicOfficePhone ?? "").trim() : "");
    } catch (error) {
      console.log("Office phone lookup warning:", error);
      setOfficePhone("");
    }
  };

  const sendEmergencyAlert = async () => {
    if (startingEmergencyCall || callOpen) {
      return;
    }

    if (!authUser?.uid) {
      setResidentStatus({
        title: "Login Required",
        description: "Please log in before sending an emergency alert.",
        meta: "Emergency alert not sent",
        tag: "Action Needed",
      });
      return;
    }

    setStartingEmergencyCall(true);
    setCallOpen(true);
    setCallStatus("ringing");
    setCallDispatcherName("");
    setCallDispatcherPhone("");
    setNoAnswerTimedOut(false);
    setAlertLocationStatus("pending");

    let alertId = "";

    try {
      const alertDoc = await addDoc(collection(db, "callSessions"), {
        residentId: authUser.uid,
        residentName: displayName,
        dispatcherId: "",
        dispatcherName: "",
        dispatcherPhone: "",
        targetRole: "Dispatcher",
        latestRequestId: latestRequest?.id ?? "",
        emergencyType: latestRequest?.emergencyType ?? latestRequest?.serviceType ?? "",
        serviceType: latestRequest?.serviceType ?? latestRequest?.emergencyType ?? "",
        pickupLocation: latestRequest?.pickupLocation ?? activeProfile?.barangay ?? "",
        pickupDetails: latestRequest?.pickupDetails ?? "",
        additionalNotes: latestRequest?.additionalNotes ?? "",
        location: null,
        status: "ringing",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      alertId = alertDoc.id;
      activeAlertIdRef.current = alertId;
      setCallSessionId(alertId);
      setResidentStatus({
        title: "Emergency alert sent",
        description: "Dispatchers can see your alert now. Keep this screen open.",
        meta: "Waiting for a dispatcher to accept",
        tag: "Emergency",
      });
    } catch (error) {
      console.log("Emergency alert failed:", error);
      setCallOpen(false);
      setCallStatus("idle");
      setAlertLocationStatus("idle");
      setResidentStatus({
        title: "Emergency alert not sent",
        description: "We could not reach dispatch. Please call the office or ask someone nearby for help.",
        meta: "Alert not sent",
        tag: "Error",
      });
    } finally {
      setStartingEmergencyCall(false);
    }

    if (!alertId) {
      return;
    }

    loadOfficePhone();
    attachAlertLocation(alertId);
  };

  const closeEmergencyAlert = async () => {
    if (callSessionId && ["ringing", "connected"].includes(callStatus)) {
      try {
        await updateDoc(doc(db, "callSessions", callSessionId), {
          status: callStatus === "connected" ? "ended" : "cancelled",
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.log("Emergency alert close warning:", error);
      }
    }

    activeAlertIdRef.current = "";
    setCancelAlertConfirmOpen(false);
    setCallOpen(false);
    setCallSessionId("");
    setCallStatus("idle");
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
    Linking.openURL(toTelUrl(phone)).catch((error) => console.log("Phone dialer warning:", error));
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
        phoneNumber: settingsForm.phoneNumber.trim(),
        phone: settingsForm.phoneNumber.trim(),
        email: nextEmail,
        updatedAt: serverTimestamp(),
      });

      saveLocalUserProfile({
        uid: authUser.uid,
        email: nextEmail,
        fullName: settingsForm.fullName.trim(),
        barangay: activeProfile?.barangay || "",
        phoneNumber: settingsForm.phoneNumber.trim(),
        phone: settingsForm.phoneNumber.trim(),
        role: activeProfile?.role || "Resident",
        accountStatus: activeProfile?.accountStatus || "Active",
      });

      setProfileOverride({
        ...activeProfile,
        email: nextEmail,
        fullName: settingsForm.fullName.trim(),
        phoneNumber: settingsForm.phoneNumber.trim(),
        phone: settingsForm.phoneNumber.trim(),
      });

      setSettingsMessage("Settings updated successfully.");
      setSettingsOpen(false);
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

  const displayResidentStatus = latestRequest ? {
    title: latestRequest.title || `${latestRequest.serviceType || latestRequest.emergencyType || "Transport"} Request`,
    description: latestRequest.assignedDriverName ? `${latestRequest.status || "Pending"} | Assigned to ${latestRequest.assignedDriverName}` : `${latestRequest.status || "Pending"} | Waiting for dispatcher assignment`,
    meta: `${latestRequest.pickupLocation || "Pickup pending"} | ${latestRequest.vehicle || "Vehicle pending"}`,
    tag: latestRequest.status || latestRequest.level || "Pending",
  } : residentStatus;

  const menuItems = [
    { key: "profile", label: "Profile", icon: "user", action: () => { setProfileMenuOpen(false); setProfileEditorOpen(true); } },
    { key: "history", label: "History", icon: "clock-o", action: () => { setProfileMenuOpen(false); setHistoryOpen(true); } },
    { key: "settings", label: "Settings", icon: "cog", action: () => { setProfileMenuOpen(false); setSettingsOpen(true); } },
  ];

  return (
    <>
      <ScrollView style={[styles.page, { backgroundColor: theme.page }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
          <BrandLogo variant="main" height={compact ? 30 : 36} />

          <View style={[styles.headerRight, narrow && styles.headerRightCompact]}>
            <TouchableOpacity style={[styles.profileTrigger, { backgroundColor: theme.headerBg }]} onPress={() => setProfileMenuOpen(true)}>
              <View style={[styles.avatarCircle, { backgroundColor: theme.avatarBg }]}>
                <Text style={[styles.avatarText, { color: theme.avatarText }]}>{initials}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.container, compact && styles.containerCompact]}>
          <View
            style={[
              styles.heroCard,
              compact && styles.heroCardCompact,
              { backgroundColor: theme.softSurface, borderColor: theme.softSurfaceBorder },
            ]}
          >
            <View style={styles.heroCopy}>
              <Text style={[styles.heroEyebrow, { color: theme.mutedText }]}>Resident Dashboard</Text>
              <Text style={[styles.welcome, compact && styles.welcomeCompact, { color: theme.heading }]}>Help is one tap away.</Text>
              <Text style={[styles.heroText, { color: theme.mutedText }]}>
                Request transport, contact emergency responders, and track your latest ride status from one clean dashboard.
              </Text>
            </View>
          </View>

          <View style={styles.cardsGrid}>
            <View style={[styles.featureCard, { backgroundColor: theme.emergencyCard }]}>
              <FontAwesome name="warning" size={compact ? 32 : 38} color="#C70000" />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Emergency</Text>
              <Text style={[styles.cardSubtitle, { color: theme.mutedText }]}>Send an alert to the dispatchers. They will see your location and can call you back.</Text>
              <TouchableOpacity style={styles.sosButton} onPress={() => handleQuickAction("emergency-call")}>
                <Text style={styles.cardButtonText}>Send emergency alert</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.featureCard, { backgroundColor: theme.transportCard }]}>
              <FontAwesome name="clipboard" size={compact ? 28 : 34} color="#D88400" />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Transport Request</Text>
              <Text style={[styles.cardSubtitle, { color: theme.mutedText }]}>Send your service type, passenger capacity, pickup location, and exact location details.</Text>
              <TouchableOpacity style={styles.bookingButton} onPress={() => handleQuickAction("transport")}>
                <Text style={styles.cardButtonText}>Open Request Form</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.featureCard, { backgroundColor: theme.statusCard }]}>
              <FontAwesome name="map-marker" size={compact ? 32 : 38} color="#06774B" />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Current Ride Status</Text>
              <Text style={[styles.cardSubtitle, { color: theme.mutedText }]}>Check your latest request progress and see when a driver has been assigned.</Text>
              <TouchableOpacity style={styles.statusButton} onPress={() => handleQuickAction("status")}>
                <Text style={styles.cardButtonText}>View Status</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.statusPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.statusPanelHeader}>
              <View>
                <Text style={[styles.panelEyebrow, { color: theme.secondaryText }]}>Latest Request</Text>
                <Text style={[styles.panelTitle, { color: theme.text }]}>{displayResidentStatus.title}</Text>
              </View>

              <View style={[styles.tag, getStatusTone(displayResidentStatus.tag)]}>
                <Text style={[styles.tagText, { color: theme.accentText }]}>{displayResidentStatus.tag}</Text>
              </View>
            </View>

            <Text style={[styles.statusDescription, { color: theme.mutedText }]}>{displayResidentStatus.description}</Text>
            <Text style={[styles.statusMeta, { color: theme.secondaryText }]}>{displayResidentStatus.meta}</Text>

            {latestRequest ? (
              <View style={[styles.requestSnapshot, { backgroundColor: theme.surfaceMuted }]}>
                <View style={styles.snapshotRow}>
                  <Text style={[styles.snapshotLabel, { color: theme.secondaryText }]}>Service Type</Text>
                  <Text style={[styles.snapshotValue, { color: theme.text }]}>{latestRequest.serviceType || latestRequest.emergencyType || "Not set"}</Text>
                </View>
                <View style={styles.snapshotRow}>
                  <Text style={[styles.snapshotLabel, { color: theme.secondaryText }]}>Passenger Capacity</Text>
                  <Text style={[styles.snapshotValue, { color: theme.text }]}>{latestRequest.passengerCapacity || latestRequest.vehicle || latestRequest.vehicleType || "Not set"}</Text>
                </View>
                <View style={styles.snapshotRow}>
                  <Text style={[styles.snapshotLabel, { color: theme.secondaryText }]}>Pickup Location</Text>
                  <Text style={[styles.snapshotValue, { color: theme.text }]}>{latestRequest.pickupLocation || "Not set"}</Text>
                </View>
                <View style={styles.snapshotRow}>
                  <Text style={[styles.snapshotLabel, { color: theme.secondaryText }]}>Exact Pickup</Text>
                  <Text style={[styles.snapshotValue, { color: theme.text }]}>{latestRequest.pickupDetails || "Not provided"}</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.emptyStatusCard, { backgroundColor: theme.emptySurface }]}>
                <Text style={[styles.emptyStatusTitle, { color: theme.text }]}>No request yet</Text>
                <Text style={[styles.emptyStatusText, { color: theme.secondaryText }]}>Your latest transport request details will appear here after submission.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <ResidentRequestForm
        visible={sosOpen}
        onClose={() => setSosOpen(false)}
        uid={authUser?.uid}
        residentName={displayName}
        profile={activeProfile}
        onCreated={({ reference }) => setResidentStatus({ title: "Transport Request Sent", description: "Your request was sent to dispatch.", meta: `Reference: ${reference}`, tag: "Pending" })}
      />
      <Modal visible={callConfirmOpen} transparent animationType="fade" onRequestClose={() => setCallConfirmOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.callCard, compact && styles.modalCardCompact, { backgroundColor: theme.surface }]}>
            <FontAwesome name="warning" size={52} color="#CF0000" />
            <Text style={[styles.callTitle, { color: theme.text }]}>Send emergency alert?</Text>
            <Text style={[styles.callSubtitle, { color: theme.mutedText }]}>Dispatchers will see your name and location right away.</Text>

            <View style={styles.callActionRow}>
              <TouchableOpacity style={[styles.modalButton, styles.callActionButton, styles.cancelButton]} onPress={() => setCallConfirmOpen(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.callActionButton, styles.callConfirmButton]}
                disabled={startingEmergencyCall}
                onPress={() => {
                  setCallConfirmOpen(false);
                  sendEmergencyAlert();
                }}
              >
                <Text style={styles.callConfirmButtonText}>Send alert</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={callOpen} transparent animationType="fade" onRequestClose={handleAlertBack}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.callCard, compact && styles.modalCardCompact, { backgroundColor: theme.surface }]}>
            {cancelAlertConfirmOpen ? (
              <>
                <FontAwesome name="exclamation-circle" size={52} color="#CF0000" />
                <Text style={[styles.callTitle, { color: theme.text }]} accessibilityLiveRegion="polite">
                  Cancel your emergency alert?
                </Text>
                <Text style={[styles.callSubtitle, { color: theme.mutedText }]}>Dispatchers will stop seeing it.</Text>

                <TouchableOpacity style={styles.callNowButton} onPress={() => setCancelAlertConfirmOpen(false)} accessibilityRole="button" accessibilityLabel="Keep the emergency alert">
                  <Text style={styles.callNowButtonText}>Keep alert</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.endCallButton} onPress={closeEmergencyAlert} accessibilityRole="button" accessibilityLabel="Cancel the emergency alert">
                  <Text style={styles.endCallButtonText}>Cancel alert</Text>
                </TouchableOpacity>
              </>
            ) : (() => {
              const dispatcherLabel = callDispatcherName || "the dispatcher";
              const waitingForAnswer = callStatus === "ringing" && !noAnswerTimedOut;
              const unanswered = callStatus === "ringing" && noAnswerTimedOut;
              const accepted = callStatus === "connected";
              const declined = callStatus === "declined";
              const showOfficeFallback = unanswered || declined;

              const icon = accepted ? "check-circle" : waitingForAnswer ? "bell" : "exclamation-circle";
              const iconColor = accepted ? "#06774B" : "#CF0000";
              const title = accepted
                ? "Dispatcher accepted"
                : waitingForAnswer
                  ? "Emergency alert sent"
                  : unanswered
                    ? "No dispatcher has accepted yet"
                    : declined
                      ? "Dispatcher could not accept"
                      : "Alert closed";
              const body = accepted
                ? `${dispatcherLabel} has your alert and can see where you are.`
                : waitingForAnswer
                  ? "Waiting for a dispatcher to accept. Keep this screen open."
                  : showOfficeFallback
                    ? "You can call the office directly while you wait."
                    : "This alert is no longer active.";
              const locationLine =
                alertLocationStatus === "pending"
                  ? "Location: sending…"
                  : alertLocationStatus === "sent"
                    ? "Location: sent"
                    : alertLocationStatus === "failed"
                      ? "Location: not available — dispatchers will see your barangay."
                      : "";

              return (
                <>
                  <FontAwesome name={icon} size={52} color={iconColor} />
                  <Text style={[styles.callTitle, { color: theme.text }]} accessibilityLiveRegion="polite">
                    {title}
                  </Text>
                  <Text style={[styles.callSubtitle, { color: theme.mutedText }]}>{body}</Text>
                  {locationLine && (waitingForAnswer || unanswered || accepted) ? (
                    <Text style={[styles.callSubtitle, { color: theme.secondaryText }]}>{locationLine}</Text>
                  ) : null}

                  {accepted ? (
                    callDispatcherPhone ? (
                      <TouchableOpacity style={styles.callNowButton} onPress={() => openPhone(callDispatcherPhone)} accessibilityRole="button" accessibilityLabel={`Call ${dispatcherLabel}`}>
                        <Text style={styles.callNowButtonText}>Call {dispatcherLabel}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={[styles.callSubtitle, { color: theme.mutedText }]}>
                        {dispatcherLabel} has no phone number on file. They can see your alert and location.
                      </Text>
                    )
                  ) : null}

                  {showOfficeFallback ? (
                    officePhone ? (
                      <TouchableOpacity style={styles.callNowButton} onPress={() => openPhone(officePhone)} accessibilityRole="button" accessibilityLabel="Call the office">
                        <Text style={styles.callNowButtonText}>Call the office</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={[styles.callSubtitle, { color: theme.mutedText }]}>
                        The office phone number is not available. Keep waiting, or ask someone nearby to call for help.
                      </Text>
                    )
                  ) : null}

                  <TouchableOpacity style={styles.endCallButton} onPress={closeEmergencyAlert}>
                    <Text style={styles.endCallButtonText}>{accepted ? "Done" : callStatus === "ringing" ? "Cancel alert" : "Close"}</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      <Modal visible={profileMenuOpen} transparent animationType="fade" onRequestClose={() => setProfileMenuOpen(false)}>
        <Pressable style={[styles.menuOverlay, { backgroundColor: theme.menuOverlay }]} onPress={() => setProfileMenuOpen(false)}>
          <Pressable style={[styles.profileMenuCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]} onPress={() => {}}>
            <View style={[styles.profileMenuHeader, { borderBottomColor: theme.border }]}>
              <ProfileAvatar name={displayName} backgroundColor={theme.avatarBg} color={theme.avatarText} />
              <Text style={[styles.profileMenuName, { color: theme.text }]}>{displayName}</Text>
              <Text style={[styles.profileMenuEmail, { color: theme.secondaryText }]}>{activeProfile?.email || authUser?.email || "Resident account"}</Text>
            </View>

            <View style={styles.profileMenuBody}>
              {menuItems.map((item) => (
                <TouchableOpacity key={item.key} style={styles.menuItem} onPress={item.action}>
                  <View style={styles.menuItemLeft}>
                    <FontAwesome name={item.icon} size={18} color={theme.mutedText} />
                    <Text style={[styles.menuItemText, { color: theme.text }]}>{item.label}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.logoutMenuButton}
              onPress={async () => {
                try {
                  await logoutCurrentUser();
                  setProfileMenuOpen(false);
                  router.replace("/login");
                } catch (error) {
                  Alert.alert("Logout failed", getAuthErrorMessage(error, "We could not log you out. Please try again."));
                }
              }}
            >
              <Text style={styles.logoutMenuButtonText}>Log Out</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

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
        uid={authUser?.uid}
      />
      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.profileEditorCard, compact && styles.modalCardCompact, { backgroundColor: theme.surface }]}>
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

            <View style={[styles.settingsThemeRow, { backgroundColor: theme.surfaceMuted }]}>
              <View style={styles.menuItemLeft}>
                <FontAwesome name={theme.mode === "Dark" ? "moon-o" : "sun-o"} size={18} color={theme.mutedText} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>Dark / Light</Text>
              </View>
              <TouchableOpacity style={[styles.themePill, { backgroundColor: theme.themePillBg }]} onPress={toggleTheme}>
                <Text style={[styles.themePillText, { color: theme.themePillText }]}>{theme.mode}</Text>
              </TouchableOpacity>
            </View>

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
          </View>
        </View>
      </Modal>

      <Modal visible={changePasswordOpen} transparent animationType="fade" onRequestClose={() => setChangePasswordOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.profileEditorCard, compact && styles.modalCardCompact, { backgroundColor: theme.surface }]}>
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
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7F6" },
  content: { paddingBottom: 28 },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#D8E2DD",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerRightCompact: {
    width: "100%",
    justifyContent: "space-between",
  },
  profileTrigger: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#D8EBDD",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#184534",
  },
  container: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    padding: 22,
    gap: 18,
  },
  containerCompact: {
    padding: 14,
    gap: 14,
  },
  heroCard: {
    padding: 22,
    borderRadius: 18,
    backgroundColor: "#E6F1EB",
    borderWidth: 1,
    borderColor: "#D6E6DD",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  heroCardCompact: {
    padding: 18,
  },
  heroCopy: {
    flex: 1,
    minWidth: 250,
  },
  heroEyebrow: {
    fontSize: 14,
    fontWeight: "800",
    color: "#4E6A5F",
  },
  welcome: {
    marginTop: 2,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "900",
    color: "#1C3E31",
  },
  welcomeCompact: {
    fontSize: 28,
    lineHeight: 34,
  },
  heroText: {
    marginTop: 6,
    maxWidth: 620,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: "#4F655C",
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  featureCard: {
    flexGrow: 1,
    flexBasis: 240,
    minHeight: 220,
    padding: 18,
    borderRadius: 16,
  },
  cardTitle: {
    marginTop: 14,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
    color: "#1A1F1C",
  },
  cardSubtitle: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 21,
    color: "#31423B",
  },
  sosButton: {
    marginTop: "auto",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#CF0000",
  },
  bookingButton: {
    marginTop: "auto",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#A48C00",
  },
  statusButton: {
    marginTop: "auto",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#06774B",
  },
  cardButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  statusPanel: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5E0",
  },
  statusPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  panelEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#5A7267",
  },
  panelTitle: {
    marginTop: 5,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: "#111111",
  },
  tag: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#F0F4F2",
  },
  tagNeutral: { backgroundColor: "#EEF2F0" },
  tagWarning: { backgroundColor: "#FFF1CB" },
  tagSuccess: { backgroundColor: "#DDF2E6" },
  tagDanger: { backgroundColor: "#F8DEDE" },
  tagText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#304941",
  },
  statusDescription: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 21,
    color: "#34433D",
  },
  statusMeta: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: "#5B6D66",
  },
  requestSnapshot: {
    marginTop: 18,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#EEF2F0",
    gap: 10,
  },
  snapshotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  snapshotLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#49655B",
  },
  snapshotValue: {
    flex: 1,
    minWidth: 180,
    textAlign: "right",
    fontSize: 13,
    lineHeight: 19,
    color: "#1D2A25",
  },
  emptyStatusCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#F4F7F5",
  },
  emptyStatusTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#23352E",
  },
  emptyStatusText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: "#62746D",
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
  callActionRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    marginTop: 28,
    flexWrap: "wrap",
  },
  modalButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  callActionButton: {
    flex: 0,
    minWidth: 116,
    paddingHorizontal: 22,
  },
  cancelButton: {
    backgroundColor: "#D9D9D9",
  },
  sendButton: {
    backgroundColor: "#06774B",
  },
  callConfirmButton: {
    backgroundColor: "#CF0000",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111111",
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  callConfirmButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  callCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
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
    marginTop: 20,
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "#06774B",
    alignItems: "center",
    justifyContent: "center",
  },
  callNowButtonText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
    paddingTop: 86,
    paddingRight: 18,
    alignItems: "flex-end",
  },
  profileMenuCard: {
    width: 320,
    maxWidth: "92%",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  profileMenuHeader: {
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E6ECE8",
  },
  profileMenuAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#D8EBDD",
    alignItems: "center",
    justifyContent: "center",
  },
  profileMenuAvatarText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#184534",
  },
  profileMenuName: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "800",
    color: "#1A2E26",
  },
  profileMenuEmail: {
    marginTop: 4,
    fontSize: 13,
    color: "#60716B",
  },
  profileMenuBody: {
    paddingTop: 12,
    gap: 4,
  },
  menuItem: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C2D27",
  },
  menuItemSoon: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7B8E86",
  },
  themePill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#EFF5F1",
  },
  themePillText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#234335",
  },
  logoutMenuButton: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B7A4A",
  },
  logoutMenuButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
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
  settingsThemeRow: {
    marginTop: 22,
    minHeight: 56,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
