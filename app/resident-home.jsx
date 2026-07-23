import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";

import BrandLogo from "../components/BrandLogo";
import { db } from "../firebase";
import { TOLEDO_BARANGAY_OPTIONS } from "../lib/barangays";
import { useCurrentUserProfile } from "../lib/session";
import { useTheme } from "../lib/theme";

const emergencyTypeOptions = [
  { label: "Medical", value: "Medical" },
  { label: "Accident", value: "Accident" },
  { label: "Fire", value: "Fire" },
  { label: "Rescue", value: "Rescue" },
  { label: "Traffic", value: "Traffic" },
  { label: "Disaster", value: "Disaster" },
];

const patientConditionOptions = [
  { label: "Can walk", value: "Can walk" },
  { label: "Needs assistance", value: "Needs assistance" },
  { label: "Needs stretcher", value: "Needs stretcher" },
  { label: "Critical / urgent", value: "Critical / urgent" },
];

const vehicleTypeOptions = [
  { label: "Ambulance", value: "Ambulance" },
  { label: "SUV", value: "SUV" },
  { label: "Pickup Truck", value: "Pickup Truck" },
  { label: "Sedan", value: "Sedan" },
  { label: "Cargo Van", value: "Cargo Van" },
  { label: "Passenger Van", value: "Passenger Van" },
];

const priorityByEmergencyType = {
  Disaster: "Emergency",
  Fire: "Emergency",
  Rescue: "Emergency",
  Accident: "Urgent",
  Medical: "Urgent",
  Traffic: "Non-Urgent",
};

const getStatusTone = (value) => {
  if (["Assigned", "In Progress", "Completed"].includes(value)) {
    return styles.tagSuccess;
  }

  if (["Cancelled", "Error"].includes(value)) {
    return styles.tagDanger;
  }

  if (["Pending", "Urgent", "Emergency"].includes(value)) {
    return styles.tagWarning;
  }

  return styles.tagNeutral;
};

export default function ResidentHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 920;
  const narrow = width < 560;
  const { authUser, displayName, profile } = useCurrentUserProfile();
  const { theme, toggleTheme } = useTheme();
  const [residentStatus, setResidentStatus] = useState({
    title: "Current Ride Status",
    description: "No active vehicle has been assigned yet. Once dispatch responds, you will see updates here.",
    meta: "Waiting for your next request",
    tag: "Tracking",
  });
  const [latestRequest, setLatestRequest] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [callConfirmOpen, setCallConfirmOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [callSessionId, setCallSessionId] = useState("");
  const [callStatus, setCallStatus] = useState("idle");
  const [callDispatcherName, setCallDispatcherName] = useState("");
  const [emergencyType, setEmergencyType] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [pickupDetails, setPickupDetails] = useState("");
  const [patientCondition, setPatientCondition] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

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
        setLatestRequest(newestRequest);

        if (!newestRequest) {
          return;
        }

        setResidentStatus({
          title: newestRequest.title || `${newestRequest.emergencyType || "Transport"} Request`,
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
        title: latestRequest.title || `${latestRequest.emergencyType || "Transport"} Request`,
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
        emergencyType: latestRequest?.emergencyType ?? emergencyType ?? "",
        pickupLocation: latestRequest?.pickupLocation ?? pickupLocation ?? profile?.barangay ?? "",
        pickupDetails: latestRequest?.pickupDetails ?? pickupDetails.trim(),
        patientCondition: latestRequest?.patientCondition ?? patientCondition,
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
    setEmergencyType("");
    setVehicleType("");
    setPickupLocation("");
    setPickupDetails("");
    setPatientCondition("");
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

    if (!emergencyType || !vehicleType || !pickupLocation || !pickupDetails.trim()) {
      setResidentStatus({
        title: "Complete Request Details",
        description: "Please complete emergency type, vehicle type, pickup barangay, and exact pickup details.",
        meta: "Request not sent",
        tag: "Action Needed",
      });
      return;
    }

    const priorityLevel = priorityByEmergencyType[emergencyType] ?? "Emergency";

    try {
      await addDoc(collection(db, "transportRequests"), {
        residentId: authUser.uid,
        residentName: displayName,
        requestType: "Emergency Request",
        level: priorityLevel,
        priorityLevel,
        status: "Pending",
        title: `${emergencyType} Transport Request`,
        emergencyType,
        vehicle: vehicleType,
        vehicleType,
        barangay: pickupLocation,
        pickupLocation,
        pickupDetails: pickupDetails.trim(),
        patientCondition: patientCondition || "Not specified",
        additionalNotes: additionalNotes.trim(),
        destination: "Nearest available response center",
        summary: `${emergencyType} transport request from ${pickupLocation}.`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setResidentStatus({
        title: "Emergency Transport Request Sent",
        description: `${emergencyType} request sent for ${vehicleType}.`,
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

  const menuItems = [
    { key: "profile", label: "Profile", icon: "user", action: () => { setProfileMenuOpen(false); setProfileEditorOpen(true); } },
    { key: "history", label: "History", icon: "clock-o", action: () => {} },
    { key: "settings", label: "Settings", icon: "cog", action: () => {} },
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
              <Text style={[styles.cardSubtitle, { color: theme.mutedText }]}>Send your emergency type, vehicle type, pickup barangay, and exact location details.</Text>
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
                  <Text style={[styles.snapshotLabel, { color: theme.secondaryText }]}>Emergency Type</Text>
                  <Text style={[styles.snapshotValue, { color: theme.text }]}>{latestRequest.emergencyType || "Not set"}</Text>
                </View>
                <View style={styles.snapshotRow}>
                  <Text style={[styles.snapshotLabel, { color: theme.secondaryText }]}>Vehicle</Text>
                  <Text style={[styles.snapshotValue, { color: theme.text }]}>{latestRequest.vehicle || latestRequest.vehicleType || "Not set"}</Text>
                </View>
                <View style={styles.snapshotRow}>
                  <Text style={[styles.snapshotLabel, { color: theme.secondaryText }]}>Pickup Barangay</Text>
                  <Text style={[styles.snapshotValue, { color: theme.text }]}>{latestRequest.pickupLocation || "Not set"}</Text>
                </View>
                <View style={styles.snapshotRow}>
                  <Text style={[styles.snapshotLabel, { color: theme.secondaryText }]}>Exact Pickup</Text>
                  <Text style={[styles.snapshotValue, { color: theme.text }]}>{latestRequest.pickupDetails || "Not provided"}</Text>
                </View>
                <View style={styles.snapshotRow}>
                  <Text style={[styles.snapshotLabel, { color: theme.secondaryText }]}>Passenger Condition</Text>
                  <Text style={[styles.snapshotValue, { color: theme.text }]}>{latestRequest.patientCondition || "Not specified"}</Text>
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

              <Text style={[styles.modalLabel, { color: theme.text }]}>Emergency Type</Text>
              <Dropdown
                style={[styles.dropdown, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                containerStyle={[styles.dropdownContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}
                itemTextStyle={styles.dropdownItemText}
                placeholderStyle={[styles.dropdownPlaceholder, { color: theme.subtleText }]}
                selectedTextStyle={[styles.dropdownSelectedText, { color: theme.text }]}
                data={emergencyTypeOptions}
                labelField="label"
                valueField="value"
                placeholder="Select emergency type"
                value={emergencyType}
                onChange={(item) => setEmergencyType(item.value)}
              />

              <Text style={[styles.modalLabel, { color: theme.text }]}>Vehicle Type</Text>
              <Dropdown
                style={[styles.dropdown, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                containerStyle={[styles.dropdownContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}
                itemTextStyle={styles.dropdownItemText}
                placeholderStyle={[styles.dropdownPlaceholder, { color: theme.subtleText }]}
                selectedTextStyle={[styles.dropdownSelectedText, { color: theme.text }]}
                data={vehicleTypeOptions}
                labelField="label"
                valueField="value"
                placeholder="Select vehicle type"
                value={vehicleType}
                onChange={(item) => setVehicleType(item.value)}
              />

              <Text style={[styles.modalLabel, { color: theme.text }]}>Pickup Barangay</Text>
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
                placeholder="Select pickup barangay"
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

              <Text style={[styles.modalLabel, { color: theme.text }]}>Patient / Passenger Condition</Text>
              <Dropdown
                style={[styles.dropdown, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                containerStyle={[styles.dropdownContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}
                itemTextStyle={styles.dropdownItemText}
                placeholderStyle={[styles.dropdownPlaceholder, { color: theme.subtleText }]}
                selectedTextStyle={[styles.dropdownSelectedText, { color: theme.text }]}
                data={patientConditionOptions}
                labelField="label"
                valueField="value"
                placeholder="Select condition"
                value={patientCondition}
                onChange={(item) => setPatientCondition(item.value)}
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

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setCallConfirmOpen(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.callConfirmButton]}
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
              <Text style={[styles.profileMenuEmail, { color: theme.secondaryText }]}>{profile?.email || authUser?.email || "Resident account"}</Text>
            </View>

            <View style={styles.profileMenuBody}>
              {menuItems.map((item) => (
                <TouchableOpacity key={item.key} style={styles.menuItem} onPress={item.action}>
                  <View style={styles.menuItemLeft}>
                    <FontAwesome name={item.icon} size={18} color={theme.mutedText} />
                    <Text style={[styles.menuItemText, { color: theme.text }]}>{item.label}</Text>
                  </View>
                  {item.key === "profile" ? null : <Text style={[styles.menuItemSoon, { color: theme.secondaryText }]}>Soon</Text>}
                </TouchableOpacity>
              ))}

              <View style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <FontAwesome name={theme.mode === "Dark" ? "moon-o" : "sun-o"} size={18} color={theme.mutedText} />
                  <Text style={[styles.menuItemText, { color: theme.text }]}>Dark / Light</Text>
                </View>
                <TouchableOpacity style={[styles.themePill, { backgroundColor: theme.themePillBg }]} onPress={toggleTheme}>
                  <Text style={[styles.themePillText, { color: theme.themePillText }]}>{theme.mode}</Text>
                </TouchableOpacity>
              </View>
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
            <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>You can prepare your profile details here. Save/edit functions are not connected yet.</Text>

            <Text style={[styles.modalLabel, { color: theme.text }]}>Full Name</Text>
            <TextInput
              style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="Full name"
              placeholderTextColor={theme.subtleText}
              defaultValue={profile?.fullName || displayName}
            />

            <Text style={[styles.modalLabel, { color: theme.text }]}>Phone Number</Text>
            <TextInput
              style={[styles.profileInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="Phone number"
              placeholderTextColor={theme.subtleText}
              defaultValue={profile?.phoneNumber || ""}
              keyboardType="phone-pad"
            />

            <Text style={[styles.modalLabel, { color: theme.text }]}>Barangay</Text>
            <Dropdown
              style={[styles.dropdown, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
              containerStyle={[styles.dropdownContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}
              itemTextStyle={styles.dropdownItemText}
              placeholderStyle={[styles.dropdownPlaceholder, { color: theme.subtleText }]}
              selectedTextStyle={[styles.dropdownSelectedText, { color: theme.text }]}
              data={TOLEDO_BARANGAY_OPTIONS}
              labelField="label"
              valueField="value"
              placeholder="Select barangay"
              value={profile?.barangay || ""}
              onChange={() => {}}
            />

            <TouchableOpacity style={[styles.disabledSaveButton, { backgroundColor: theme.disabledButtonBg }]} activeOpacity={1}>
              <Text style={[styles.disabledSaveButtonText, { color: theme.disabledButtonText }]}>Save Changes Soon</Text>
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
  modalButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
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
