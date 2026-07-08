import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";

import AppBrandHeader from "../components/AppBrandHeader";
import { db } from "../firebase";
import { useCurrentUserProfile } from "../lib/session";

const emergencyTypeOptions = [
  { label: "Medical", value: "Medical" },
  { label: "Accident", value: "Accident" },
  { label: "Fire", value: "Fire" },
  { label: "Rescue", value: "Rescue" },
  { label: "Traffic", value: "Traffic" },
  { label: "Disaster", value: "Disaster" },
];

const priorityByEmergencyType = {
  Disaster: "Emergency",
  Fire: "Emergency",
  Rescue: "Emergency",
  Accident: "Urgent",
  Medical: "Urgent",
  Traffic: "Non-Urgent",
};

const vehicleTypeOptions = [
  { label: "Ambulance", value: "Ambulance" },
  { label: "Rescue Vehicle", value: "Rescue Vehicle" },
  { label: "SUV", value: "SUV" },
  { label: "Pickup Truck", value: "Pickup Truck" },
  { label: "Sedan", value: "Sedan" },
  { label: "Hatchback", value: "Hatchback" },
  { label: "Cargo Van", value: "Cargo Van" },
  { label: "Passenger Van", value: "Passenger Van" },
  { label: "Flatbed Trailer", value: "Flatbed Trailer" },
];

const pickupLocationOptions = [
  { label: "Awihao, Toledo City", value: "Awihao, Toledo City" },
  { label: "Bagakay, Toledo City", value: "Bagakay, Toledo City" },
  { label: "Bato, Toledo City", value: "Bato, Toledo City" },
  { label: "Biga, Toledo City", value: "Biga, Toledo City" },
  { label: "Bulongan, Toledo City", value: "Bulongan, Toledo City" },
  { label: "Bunga, Toledo City", value: "Bunga, Toledo City" },
  { label: "Cabitoonan, Toledo City", value: "Cabitoonan, Toledo City" },
  { label: "Calongcalong, Toledo City", value: "Calongcalong, Toledo City" },
  { label: "Cambang-ug, Toledo City", value: "Cambang-ug, Toledo City" },
  { label: "Camp 8, Toledo City", value: "Camp 8, Toledo City" },
  { label: "Canlumampao, Toledo City", value: "Canlumampao, Toledo City" },
  { label: "Cantabaco, Toledo City", value: "Cantabaco, Toledo City" },
  { label: "Capitan Claudio, Toledo City", value: "Capitan Claudio, Toledo City" },
  { label: "Carmen, Toledo City", value: "Carmen, Toledo City" },
  { label: "Daanglungsod, Toledo City", value: "Daanglungsod, Toledo City" },
  { label: "Don Andres Soriano (Lutopan), Toledo City", value: "Don Andres Soriano (Lutopan), Toledo City" },
  { label: "Dumlog, Toledo City", value: "Dumlog, Toledo City" },
  { label: "Gen. Climaco (Malubog), Toledo City", value: "Gen. Climaco (Malubog), Toledo City" },
  { label: "Ibo, Toledo City", value: "Ibo, Toledo City" },
  { label: "Ilihan, Toledo City", value: "Ilihan, Toledo City" },
  { label: "Juan Climaco, Sr. (Magdugo), Toledo City", value: "Juan Climaco, Sr. (Magdugo), Toledo City" },
  { label: "Landahan, Toledo City", value: "Landahan, Toledo City" },
  { label: "Loay, Toledo City", value: "Loay, Toledo City" },
  { label: "Luray II, Toledo City", value: "Luray II, Toledo City" },
  { label: "Matab-ang, Toledo City", value: "Matab-ang, Toledo City" },
  { label: "Media Once, Toledo City", value: "Media Once, Toledo City" },
  { label: "Pangamihan, Toledo City", value: "Pangamihan, Toledo City" },
  { label: "Poblacion, Toledo City", value: "Poblacion, Toledo City" },
  { label: "Poog, Toledo City", value: "Poog, Toledo City" },
  { label: "Putingbato, Toledo City", value: "Putingbato, Toledo City" },
  { label: "Sagay, Toledo City", value: "Sagay, Toledo City" },
  { label: "Sam-ang, Toledo City", value: "Sam-ang, Toledo City" },
  { label: "Sangi, Toledo City", value: "Sangi, Toledo City" },
  { label: "Santo Nino (Mainggit), Toledo City", value: "Santo Nino (Mainggit), Toledo City" },
  { label: "Subayon, Toledo City", value: "Subayon, Toledo City" },
  { label: "Talavera, Toledo City", value: "Talavera, Toledo City" },
  { label: "Tubod, Toledo City", value: "Tubod, Toledo City" },
  { label: "Tungkay, Toledo City", value: "Tungkay, Toledo City" },
];

export default function ResidentHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const narrow = width < 520;
  const { authUser, displayName } = useCurrentUserProfile();
  const [activityFilter, setActivityFilter] = useState("Latest");
  const [residentStatus, setResidentStatus] = useState({
    title: "Clinic Visit",
    description: "Appointment for medical attention",
    meta: "2026/03/19 | Brgy. Talavera",
    tag: "Non-Urgent",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [emergencyType, setEmergencyType] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [callConfirmOpen, setCallConfirmOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [callSessionId, setCallSessionId] = useState("");
  const [callStatus, setCallStatus] = useState("idle");
  const [callDispatcherName, setCallDispatcherName] = useState("");

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
        status: "ringing",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setCallSessionId(callDoc.id);
      setResidentStatus({
        title: "Calling Dispatcher",
        description: "Emergency call request sent to the dispatcher station.",
        meta: "In-app call ringing | Waiting for dispatcher",
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

  const handleQuickAction = (type) => {
    if (type === "emergency-call") {
      setCallConfirmOpen(true);
      return;
    }

    if (type === "transport") {
      setSosOpen(true);
      return;
    }

    setResidentStatus({
      title: "Current Ride Status",
      description: "No active vehicle has been assigned yet. You will see trip progress here once dispatch confirms it.",
      meta: "Live updates ready | Waiting for driver",
      tag: "Tracking",
    });
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

    const requestTitle = emergencyType || "Emergency";
    const priorityLevel = priorityByEmergencyType[emergencyType] ?? "Emergency";
    const requestedVehicle = vehicleType || "Available Vehicle";
    const requestedPickup = pickupLocation || "Pickup location pending";

    try {
      await addDoc(collection(db, "transportRequests"), {
        residentId: authUser.uid,
        residentName: displayName,
        level: priorityLevel,
        priorityLevel,
        status: "Pending",
        title: requestTitle,
        emergencyType: requestTitle,
        vehicle: requestedVehicle,
        barangay: requestedPickup,
        pickupLocation: requestedPickup,
        destination: "Nearest available response center",
        summary: `${requestTitle} transport request from ${requestedPickup}.`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setResidentStatus({
        title: "Emergency Transport Request Sent",
        description: `${requestTitle} request sent for ${requestedVehicle}.`,
        meta: `${requestedPickup} | Waiting for dispatcher`,
        tag: priorityLevel,
      });
      setSosOpen(false);
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

  return (
    <>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppBrandHeader role="Resident" name={displayName} onLogoutPress={() => router.replace("/")} />

        <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={[styles.heroCard, compact && styles.heroCardCompact]}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>Resident Dashboard</Text>
            <Text style={[styles.welcome, compact && styles.welcomeCompact]}>Welcome back, {displayName}.</Text>
            <Text style={styles.heroText}>Quick actions, request tracking, and emergency tools are arranged to stay readable on Android and desktop.</Text>
          </View>

          <TouchableOpacity
            style={[styles.settingsButton, narrow && styles.fullWidthButton]}
            onPress={() => setSettingsOpen((current) => !current)}
          >
            <Feather name="settings" size={18} color="#124131" />
            <Text style={styles.settingsText}>{settingsOpen ? "Hide Settings" : "Settings"}</Text>
          </TouchableOpacity>
        </View>

        {settingsOpen ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Resident preferences</Text>
            <Text style={styles.noticeText}>Notification sounds, saved contact details, and trip preferences can be managed here later.</Text>
          </View>
        ) : null}

        <View style={styles.cardsGrid}>
          <View style={[styles.featureCard, styles.sosCard]}>
            <MaterialCommunityIcons name="alarm-light-outline" size={compact ? 34 : 38} color="#C70000" />
            <Text style={styles.cardTitle}>Call Emergency Help</Text>
            <Text style={styles.cardSubtitle}>Keep emergency calling access visible for situations that need immediate contact.</Text>
            <TouchableOpacity style={styles.sosButton} onPress={() => handleQuickAction("emergency-call")}>
              <Text style={styles.cardButtonText}>Open Emergency Call</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.featureCard, styles.bookingCard]}>
            <Feather name="clipboard" size={compact ? 30 : 34} color="#D88400" />
            <Text style={styles.cardTitle}>Transport Request</Text>
            <Text style={styles.cardSubtitle}>Choose emergency details, vehicle type, and pickup location before sending the request.</Text>
            <TouchableOpacity style={styles.bookingButton} onPress={() => handleQuickAction("transport")}>
              <Text style={styles.cardButtonText}>Open Request Options</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.featureCard, styles.statusCard]}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={compact ? 34 : 38} color="#06774B" />
            <Text style={styles.cardTitle}>Current Ride Status</Text>
            <Text style={styles.cardSubtitle}>Check trip progress and stay updated once your request has been assigned.</Text>
            <TouchableOpacity style={styles.statusButton} onPress={() => handleQuickAction("status")}>
              <Text style={styles.cardButtonText}>View Request</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.lowerGrid}>
          <View style={styles.activityPanel}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.panelEyebrow}>Recent</Text>
                <Text style={styles.panelTitle}>Latest activity</Text>
              </View>
              <TouchableOpacity
                style={styles.filterChip}
                onPress={() => setActivityFilter((current) => (current === "Latest" ? "Priority" : "Latest"))}
              >
                <Text style={styles.filterChipText}>{activityFilter}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.activityCard, compact && styles.activityCardCompact]}>
              <View style={styles.activityMain}>
                <Text style={styles.activityTitle}>{residentStatus.title}</Text>
                <Text style={styles.activityDesc}>{residentStatus.description}</Text>
                <Text style={styles.activityMeta}>{residentStatus.meta}</Text>
              </View>

              <View style={styles.tag}>
                <Text style={styles.tagText}>{residentStatus.tag}</Text>
              </View>
            </View>
          </View>
        </View>
        </View>
      </ScrollView>

      <Modal visible={sosOpen} transparent animationType="fade" onRequestClose={() => setSosOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, compact && styles.modalCardCompact]}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSosOpen(false)}>
              <Text style={styles.modalCloseText}>X</Text>
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Transport Request Options</Text>
            <Text style={styles.modalSubtitle}>Send emergency transport request to nearest responders</Text>

            <Text style={styles.modalLabel}>Emergency Type</Text>
            <Dropdown
              style={styles.dropdown}
              maxHeight={260}
              placeholderStyle={styles.dropdownPlaceholder}
              selectedTextStyle={styles.dropdownSelectedText}
              data={emergencyTypeOptions}
              labelField="label"
              valueField="value"
              placeholder="Select emergency type"
              value={emergencyType}
              onChange={(item) => setEmergencyType(item.value)}
            />

            <Text style={styles.modalLabel}>Vehicle Type</Text>
            <Dropdown
              style={styles.dropdown}
              maxHeight={260}
              placeholderStyle={styles.dropdownPlaceholder}
              selectedTextStyle={styles.dropdownSelectedText}
              data={vehicleTypeOptions}
              labelField="label"
              valueField="value"
              placeholder="Select vehicle type"
              value={vehicleType}
              onChange={(item) => setVehicleType(item.value)}
            />

            <Text style={styles.modalLabel}>Pickup Location</Text>
            <Dropdown
              style={styles.dropdown}
              maxHeight={260}
              search
              searchPlaceholder="Search barangay..."
              placeholderStyle={styles.dropdownPlaceholder}
              selectedTextStyle={styles.dropdownSelectedText}
              data={pickupLocationOptions}
              labelField="label"
              valueField="value"
              placeholder="Select pickup location"
              value={pickupLocation}
              onChange={(item) => setPickupLocation(item.value)}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setSosOpen(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.sendButton]} onPress={handleSendSos}>
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={callConfirmOpen} transparent animationType="fade" onRequestClose={() => setCallConfirmOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.callCard, compact && styles.modalCardCompact]}>
            <MaterialCommunityIcons name="phone-alert-outline" size={52} color="#CF0000" />
            <Text style={styles.callTitle}>Call Emergency Help?</Text>
            <Text style={styles.callSubtitle}>Are you sure you want to call Emergency Help?</Text>

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
        <View style={styles.modalOverlay}>
          <View style={[styles.callCard, compact && styles.modalCardCompact]}>
            <MaterialCommunityIcons name="phone-in-talk-outline" size={52} color="#CF0000" />
            <Text style={styles.callTitle}>
              {callStatus === "connected" ? "Connected to Dispatcher" : callStatus === "ringing" ? "Calling Dispatcher" : "Emergency Call"}
            </Text>
            <Text style={styles.callSubtitle}>
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
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7F6" },
  content: { paddingBottom: 24 },
  container: { width: "100%", maxWidth: 1240, alignSelf: "center", padding: 24, gap: 20 },
  containerCompact: { padding: 16, gap: 16 },
  heroCard: {
    padding: 22,
    borderRadius: 26,
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
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#4E6A5F",
  },
  welcome: { marginTop: 10, fontSize: 42, fontWeight: "800", color: "#1C3E31" },
  welcomeCompact: { fontSize: 30, lineHeight: 38 },
  heroText: {
    marginTop: 12,
    maxWidth: 700,
    fontSize: 16,
    lineHeight: 24,
    color: "#4F655C",
  },
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  fullWidthButton: {
    width: "100%",
    justifyContent: "center",
  },
  settingsText: { fontSize: 15, fontWeight: "700", color: "#124131" },
  noticeCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5E0",
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#17382E",
  },
  noticeText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: "#5B756B",
  },
  cardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  featureCard: {
    flexGrow: 1,
    flexBasis: 280,
    minHeight: 230,
    padding: 20,
    borderRadius: 24,
  },
  sosCard: { backgroundColor: "#F6D4D4" },
  bookingCard: { backgroundColor: "#F5EECA" },
  statusCard: { backgroundColor: "#D0E8DE" },
  cardTitle: { marginTop: 16, fontSize: 24, fontWeight: "800", color: "#1A1F1C" },
  cardSubtitle: { marginTop: 8, fontSize: 15, lineHeight: 23, color: "#31423B" },
  sosButton: { marginTop: "auto", borderRadius: 16, paddingVertical: 15, alignItems: "center", backgroundColor: "#CF0000" },
  bookingButton: { marginTop: "auto", borderRadius: 16, paddingVertical: 15, alignItems: "center", backgroundColor: "#A48C00" },
  statusButton: { marginTop: "auto", borderRadius: 16, paddingVertical: 15, alignItems: "center", backgroundColor: "#06774B" },
  cardButtonText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  lowerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "stretch" },
  activityPanel: {
    flex: 1.4,
    minWidth: 280,
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5E0",
  },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  panelEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#5A7267",
  },
  panelTitle: { marginTop: 6, fontSize: 28, fontWeight: "800", color: "#111111" },
  filterChip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#F0F4F2" },
  filterChipText: { fontSize: 14, fontWeight: "700", color: "#476F63" },
  activityCard: {
    marginTop: 18,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#EEF2F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  activityCardCompact: {
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  activityMain: { flex: 1, minWidth: 220 },
  activityTitle: { fontSize: 24, fontWeight: "800", color: "#111111" },
  activityDesc: { marginTop: 8, fontSize: 16, color: "#34433D" },
  activityMeta: { marginTop: 16, fontSize: 14, color: "#56655F" },
  tag: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999, backgroundColor: "#FFFFFF" },
  tagText: { fontSize: 14, fontWeight: "700", color: "#8C8B00" },
  sideSummary: { flex: 0.9, minWidth: 260, gap: 16 },
  summaryCard: {
    padding: 20,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5E0",
  },
  summaryTitle: { marginTop: 14, fontSize: 20, fontWeight: "800", color: "#17382E" },
  summaryText: { marginTop: 8, fontSize: 15, lineHeight: 23, color: "#5B756B" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 700,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
  },
  modalCardCompact: {
    borderRadius: 22,
    padding: 18,
  },
  modalClose: {
    alignSelf: "flex-end",
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F51D1D",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  modalTitle: {
    marginTop: 8,
    fontSize: 34,
    fontWeight: "800",
    textAlign: "center",
    color: "#111111",
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 15,
    textAlign: "center",
    color: "#333333",
  },
  modalLabel: {
    marginTop: 22,
    fontSize: 17,
    fontWeight: "700",
    color: "#111111",
  },
  dropdown: {
    marginTop: 10,
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: "#D9D9D9",
    paddingHorizontal: 18,
  },
  dropdownPlaceholder: {
    fontSize: 18,
    color: "#696969",
  },
  dropdownSelectedText: {
    fontSize: 18,
    color: "#222222",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 28,
  },
  modalButton: {
    flex: 1,
    minHeight: 64,
    borderRadius: 20,
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
    fontSize: 18,
    fontWeight: "700",
    color: "#111111",
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  callConfirmButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  callCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
  },
  callTitle: {
    marginTop: 14,
    fontSize: 28,
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
});
