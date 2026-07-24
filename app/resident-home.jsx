import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword } from "firebase/auth";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";

import BrandLogo from "../components/BrandLogo";
import { auth, db } from "../firebase";
import { TOLEDO_BARANGAY_OPTIONS } from "../lib/barangays";
import { saveLocalUserProfile, useCurrentUserProfile } from "../lib/session";
import { useTheme } from "../lib/theme";

const serviceTypeOptions = [
  { label: "Medical Transport", value: "Medical Transport" },
  { label: "Non-Emergency Medical Transport (NEMT)", value: "Non-Emergency Medical Transport (NEMT)" },
  { label: "Accessible / Wheelchair Van", value: "Accessible / Wheelchair Van" },
  { label: "Assisted Care Ride", value: "Assisted Care Ride" },
  { label: "Special Event / Wedding Charter", value: "Special Event / Wedding Charter" },
  { label: "Memorial / Funeral Procession", value: "Memorial / Funeral Procession" },
  { label: "Hourly / As-Directed Rental", value: "Hourly / As-Directed Rental" },
];

const passengerCapacityOptions = [
  { label: "2 passengers", value: "2 passengers" },
  { label: "4 passengers", value: "4 passengers" },
  { label: "6 passengers", value: "6 passengers" },
  { label: "8 passengers", value: "8 passengers" },
  { label: "10+ passengers", value: "10+ passengers" },
];

const priorityByServiceType = {
  "Medical Transport": "Urgent",
  "Non-Emergency Medical Transport (NEMT)": "Non-Urgent",
  "Accessible / Wheelchair Van": "Non-Urgent",
  "Assisted Care Ride": "Non-Urgent",
  "Special Event / Wedding Charter": "Planned",
  "Memorial / Funeral Procession": "Planned",
  "Hourly / As-Directed Rental": "Planned",
};

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
  const [latestRequest, setLatestRequest] = useState(null);
  const [requestHistory, setRequestHistory] = useState([]);
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
  const [serviceType, setServiceType] = useState("");
  const [passengerCapacity, setPassengerCapacity] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [pickupDetails, setPickupDetails] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
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
    if (!authUser?.uid) {
      return undefined;
    }

    const requestsQuery = query(collection(db, "transportRequests"), where("residentId", "==", authUser.uid));
    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        const requests = snapshot.docs
          .map((requestDoc) => ({
            id: requestDoc.id,
            ...requestDoc.data(),
          }))
          .sort((first, second) => {
            const firstTime = first.createdAt?.toMillis?.() ?? 0;
            const secondTime = second.createdAt?.toMillis?.() ?? 0;
            return secondTime - firstTime;
          });

        const newestRequest = requests[0] ?? null;
        setRequestHistory(requests);
        setLatestRequest(newestRequest);

        if (!newestRequest) {
          return;
        }

        setResidentStatus({
          title: newestRequest.title || `${newestRequest.serviceType || newestRequest.emergencyType || "Transport"} Request`,
          description: newestRequest.assignedDriverName
            ? `${newestRequest.status || "Pending"} | Assigned to ${newestRequest.assignedDriverName}`
            : `${newestRequest.status || "Pending"} | Waiting for dispatcher assignment`,
          meta: `${newestRequest.pickupLocation || "Pickup pending"} | ${newestRequest.vehicle || "Vehicle pending"}`,
          tag: newestRequest.status || newestRequest.level || "Pending",
        });
      },
      (error) => console.log("Resident requests listener warning:", error)
    );

    return unsubscribe;
  }, [authUser?.uid]);

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
      },
      (error) => console.log("Emergency call listener warning:", error)
    );

    return unsubscribe;
  }, [callSessionId]);

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

  const startEmergencyCall = async () => {
    if (!authUser?.uid) {
      setResidentStatus({
        title: "Login Required",
        description: "Please log in before starting an emergency call.",
        meta: "Emergency call not started",
        tag: "Action Needed",
      });
      return;
    }

    try {
      setCallOpen(true);
      setCallStatus("ringing");
      const callDoc = await addDoc(collection(db, "callSessions"), {
        residentId: authUser.uid,
        residentName: displayName,
        dispatcherId: "",
        dispatcherName: "",
        targetRole: "Dispatcher",
        latestRequestId: latestRequest?.id ?? "",
        emergencyType: latestRequest?.emergencyType ?? latestRequest?.serviceType ?? serviceType ?? "",
        serviceType: latestRequest?.serviceType ?? latestRequest?.emergencyType ?? serviceType ?? "",
        pickupLocation: latestRequest?.pickupLocation ?? pickupLocation ?? activeProfile?.barangay ?? "",
        pickupDetails: latestRequest?.pickupDetails ?? pickupDetails.trim(),
        additionalNotes: latestRequest?.additionalNotes ?? additionalNotes.trim(),
        status: "ringing",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setCallSessionId(callDoc.id);
      setResidentStatus({
        title: "Calling Dispatcher",
        description: "Emergency call request sent to the dispatcher station.",
        meta: "Waiting for dispatcher",
        tag: "Emergency",
      });
    } catch (error) {
      console.log("Emergency call failed:", error);
      setCallOpen(false);
      setCallStatus("idle");
      setResidentStatus({
        title: "Emergency Call Failed",
        description: "The in-app call could not start. Please check Firestore permissions.",
        meta: "Call not connected",
        tag: "Error",
      });
    }
  };

  const endEmergencyCall = async () => {
    const nextStatus = callStatus === "connected" ? "ended" : "cancelled";

    if (callSessionId) {
      try {
        await updateDoc(doc(db, "callSessions", callSessionId), {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.log("Emergency call end warning:", error);
      }
    }

    setCallOpen(false);
    setCallSessionId("");
    setCallStatus("idle");
  };

  const resetRequestForm = () => {
    setServiceType("");
    setPassengerCapacity("");
    setPickupLocation("");
    setPickupDetails("");
    setAdditionalNotes("");
  };

  const handleSendSos = async () => {
    if (!authUser?.uid) {
      setResidentStatus({
        title: "Login Required",
        description: "Please log in before sending a transport request.",
        meta: "Transport request not sent",
        tag: "Action Needed",
      });
      return;
    }

    if (!serviceType || !passengerCapacity || !pickupLocation || !pickupDetails.trim()) {
      setResidentStatus({
        title: "Complete Request Details",
        description: "Please complete service type, passenger capacity, pickup location, and exact pickup details.",
        meta: "Request not sent",
        tag: "Action Needed",
      });
      return;
    }

    const priorityLevel = priorityByServiceType[serviceType] ?? "Planned";

    try {
      await addDoc(collection(db, "transportRequests"), {
        residentId: authUser.uid,
        residentName: displayName,
        requestType: "Emergency Request",
        level: priorityLevel,
        priorityLevel,
        status: "Pending",
        title: `${serviceType} Transport Request`,
        emergencyType: serviceType,
        serviceType,
        vehicle: passengerCapacity,
        vehicleType: passengerCapacity,
        passengerCapacity,
        barangay: pickupLocation,
        pickupLocation,
        pickupDetails: pickupDetails.trim(),
        additionalNotes: additionalNotes.trim(),
        destination: "Nearest available response center",
        summary: `${serviceType} transport request from ${pickupLocation}.`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setResidentStatus({
        title: "Transport Request Sent",
        description: `${serviceType} request sent for ${passengerCapacity}.`,
        meta: `${pickupLocation} | Waiting for dispatcher`,
        tag: priorityLevel,
      });
      setSosOpen(false);
      resetRequestForm();
    } catch (error) {
      console.log("Transport request failed:", error);
      setResidentStatus({
        title: "Transport Request Failed",
        description: "The request could not be sent. Please check Firestore permissions.",
        meta: "Request not queued",
        tag: "Error",
      });
    }
  };

  const formatDateValue = (value) => {
    if (!value?.toDate) {
      return "Not available";
    }

    return value.toDate().toLocaleString();
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
              <Text style={[styles.cardSubtitle, { color: theme.mutedText }]}>Call the dispatcher immediately for urgent help and emergency coordination.</Text>
              <TouchableOpacity style={styles.sosButton} onPress={() => handleQuickAction("emergency-call")}>
                <Text style={styles.cardButtonText}>Open Emergency Call</Text>
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
                <Text style={[styles.panelTitle, { color: theme.text }]}>{residentStatus.title}</Text>
              </View>

              <View style={[styles.tag, getStatusTone(residentStatus.tag)]}>
                <Text style={[styles.tagText, { color: theme.accentText }]}>{residentStatus.tag}</Text>
              </View>
            </View>

            <Text style={[styles.statusDescription, { color: theme.mutedText }]}>{residentStatus.description}</Text>
            <Text style={[styles.statusMeta, { color: theme.secondaryText }]}>{residentStatus.meta}</Text>

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

      <Modal visible={sosOpen} transparent animationType="fade" onRequestClose={() => setSosOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.modalCard, compact && styles.modalCardCompact, { backgroundColor: theme.surface }]}>
            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.modalClose} onPress={() => setSosOpen(false)}>
                <Text style={styles.modalCloseText}>X</Text>
              </TouchableOpacity>

              <Text style={[styles.modalTitle, { color: theme.text }]}>Transport Request</Text>
              <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>Complete the request details so responders can find you faster.</Text>

              <Text style={[styles.modalLabel, { color: theme.text }]}>Service Type</Text>
              <Dropdown
                style={[styles.dropdown, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                containerStyle={[styles.dropdownContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}
                itemTextStyle={styles.dropdownItemText}
                placeholderStyle={[styles.dropdownPlaceholder, { color: theme.subtleText }]}
                selectedTextStyle={[styles.dropdownSelectedText, { color: theme.text }]}
                data={serviceTypeOptions}
                labelField="label"
                valueField="value"
                placeholder="Select service type"
                value={serviceType}
                onChange={(item) => setServiceType(item.value)}
              />

              <Text style={[styles.modalLabel, { color: theme.text }]}>Passenger Capacity</Text>
              <Dropdown
                style={[styles.dropdown, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                containerStyle={[styles.dropdownContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}
                itemTextStyle={styles.dropdownItemText}
                placeholderStyle={[styles.dropdownPlaceholder, { color: theme.subtleText }]}
                selectedTextStyle={[styles.dropdownSelectedText, { color: theme.text }]}
                data={passengerCapacityOptions}
                labelField="label"
                valueField="value"
                placeholder="Select passenger capacity"
                value={passengerCapacity}
                onChange={(item) => setPassengerCapacity(item.value)}
              />

              <Text style={[styles.modalLabel, { color: theme.text }]}>Pickup Location</Text>
              <Dropdown
                style={[styles.dropdown, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                containerStyle={[styles.dropdownContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}
                itemTextStyle={styles.dropdownItemText}
                maxHeight={220}
                search
                searchPlaceholder="Search barangay..."
                placeholderStyle={[styles.dropdownPlaceholder, { color: theme.subtleText }]}
                selectedTextStyle={[styles.dropdownSelectedText, { color: theme.text }]}
                data={TOLEDO_BARANGAY_OPTIONS}
                labelField="label"
                valueField="value"
                placeholder="Select pickup location"
                value={pickupLocation}
                onChange={(item) => setPickupLocation(item.value)}
              />

              <Text style={[styles.modalLabel, { color: theme.text }]}>Exact Pickup Details</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                placeholder="Example: Purok 3, near chapel, blue gate beside sari-sari store"
                placeholderTextColor={theme.subtleText}
                value={pickupDetails}
                onChangeText={setPickupDetails}
                multiline
                textAlignVertical="top"
              />

              <Text style={[styles.modalLabel, { color: theme.text }]}>Additional Notes</Text>
              <TextInput
                style={[styles.textArea, styles.notesArea, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                placeholder="Optional notes for responders"
                placeholderTextColor={theme.subtleText}
                value={additionalNotes}
                onChangeText={setAdditionalNotes}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setSosOpen(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.sendButton]} onPress={handleSendSos}>
                  <Text style={styles.sendButtonText}>Send</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={callConfirmOpen} transparent animationType="fade" onRequestClose={() => setCallConfirmOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.callCard, compact && styles.modalCardCompact, { backgroundColor: theme.surface }]}>
            <FontAwesome name="phone" size={52} color="#CF0000" />
            <Text style={[styles.callTitle, { color: theme.text }]}>Call Emergency Help?</Text>
            <Text style={[styles.callSubtitle, { color: theme.mutedText }]}>Are you sure you want to call Emergency Help?</Text>

            <View style={styles.callActionRow}>
              <TouchableOpacity style={[styles.modalButton, styles.callActionButton, styles.cancelButton]} onPress={() => setCallConfirmOpen(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.callActionButton, styles.callConfirmButton]}
                onPress={() => {
                  setCallConfirmOpen(false);
                  startEmergencyCall();
                }}
              >
                <Text style={styles.callConfirmButtonText}>Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={callOpen} transparent animationType="fade" onRequestClose={endEmergencyCall}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.callCard, compact && styles.modalCardCompact, { backgroundColor: theme.surface }]}>
            <FontAwesome name="phone" size={52} color="#CF0000" />
            <Text style={[styles.callTitle, { color: theme.text }]}>
              {callStatus === "connected" ? "Connected to Dispatcher" : callStatus === "ringing" ? "Calling Dispatcher" : "Emergency Call"}
            </Text>
            <Text style={[styles.callSubtitle, { color: theme.mutedText }]}>
              {callStatus === "connected"
                ? `${callDispatcherName || "Dispatcher"} is connected to this in-app emergency call.`
                : "Waiting for the dispatcher station to answer."}
            </Text>

            <TouchableOpacity style={styles.endCallButton} onPress={endEmergencyCall}>
              <Text style={styles.endCallButtonText}>{callStatus === "connected" ? "End Call" : "Cancel Call"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={profileMenuOpen} transparent animationType="fade" onRequestClose={() => setProfileMenuOpen(false)}>
        <Pressable style={[styles.menuOverlay, { backgroundColor: theme.menuOverlay }]} onPress={() => setProfileMenuOpen(false)}>
          <Pressable style={[styles.profileMenuCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]} onPress={() => {}}>
            <View style={[styles.profileMenuHeader, { borderBottomColor: theme.border }]}>
              <View style={[styles.profileMenuAvatar, { backgroundColor: theme.avatarBg }]}>
                <Text style={[styles.profileMenuAvatarText, { color: theme.avatarText }]}>{initials}</Text>
              </View>
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
              onPress={() => {
                setProfileMenuOpen(false);
                router.replace("/login");
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

      <Modal visible={historyOpen} transparent animationType="fade" onRequestClose={() => setHistoryOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.modalCard, compact && styles.modalCardCompact, { backgroundColor: theme.surface }]}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setHistoryOpen(false)}>
              <Text style={styles.modalCloseText}>X</Text>
            </TouchableOpacity>

            <Text style={[styles.modalTitle, { color: theme.text }]}>Request History</Text>
            <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>Your previous and current transport requests are recorded here.</Text>

            <ScrollView contentContainerStyle={styles.historyList} showsVerticalScrollIndicator={false}>
              {requestHistory.length ? (
                requestHistory.map((request) => (
                  <View key={request.id} style={[styles.historyCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                    <View style={styles.historyHeader}>
                      <Text style={[styles.historyTitle, { color: theme.text }]}>{request.serviceType || request.emergencyType || "Transport Request"}</Text>
                      <View style={[styles.tag, getStatusTone(request.status || request.level || "Pending")]}>
                        <Text style={[styles.tagText, { color: theme.accentText }]}>{request.status || "Pending"}</Text>
                      </View>
                    </View>
                    <Text style={[styles.historyText, { color: theme.mutedText }]}>Request ID: {request.id}</Text>
                    <Text style={[styles.historyText, { color: theme.mutedText }]}>Passenger Capacity: {request.passengerCapacity || request.vehicle || request.vehicleType || "Not set"}</Text>
                    <Text style={[styles.historyText, { color: theme.mutedText }]}>Pickup Location: {request.pickupLocation || "Not set"}</Text>
                    <Text style={[styles.historyText, { color: theme.mutedText }]}>Submitted: {formatDateValue(request.createdAt)}</Text>
                    <Text style={[styles.historyText, { color: theme.mutedText }]}>Completed: {formatDateValue(request.completedAt)}</Text>
                  </View>
                ))
              ) : (
                <View style={[styles.emptyStatusCard, { backgroundColor: theme.emptySurface }]}>
                  <Text style={[styles.emptyStatusTitle, { color: theme.text }]}>No history yet</Text>
                  <Text style={[styles.emptyStatusText, { color: theme.secondaryText }]}>Your request history will appear here after you submit transport requests.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
