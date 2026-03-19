import { useRouter } from "expo-router";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";

import AppBrandHeader from "../components/AppBrandHeader";
import { useCurrentUserProfile } from "../lib/session";

export default function ResidentHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const narrow = width < 520;
  const { displayName } = useCurrentUserProfile();
  const [activityFilter, setActivityFilter] = useState("Latest");
  const [residentStatus, setResidentStatus] = useState({
    title: "Clinic Visit",
    description: "Appointment for medical attention",
    meta: "2026/03/19 | Brgy. Talavera",
    tag: "Non-Urgent",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [emergencyType, setEmergencyType] = useState("Select Type");
  const [carType, setCarType] = useState("Select Type");
  const [pickupLocation, setPickupLocation] = useState("Select Where");

  const emergencyTypes = ["Medical", "Accident", "Fire"];
  const carTypes = ["Ambulance", "Barangay Van", "Rescue Vehicle"];
  const pickupLocations = ["Poblacion, Toledo City", "Sangi, Toledo City", "Talavera, Toledo City"];

  const cycleOption = (currentValue, values, fallback) => {
    const currentIndex = values.indexOf(currentValue);

    if (currentIndex === -1) {
      return values[0] ?? fallback;
    }

    return values[(currentIndex + 1) % values.length];
  };

  const handleQuickAction = (type) => {
    if (type === "sos") {
      setSosOpen(true);
      return;
    }

    if (type === "transport") {
      setResidentStatus({
        title: "Transport Request Created",
        description: "Your booking request has been prepared and is waiting for dispatcher review.",
        meta: "Transport queued | Brgy. Talavera",
        tag: "Pending",
      });
      return;
    }

    setResidentStatus({
      title: "Current Ride Status",
      description: "No active vehicle has been assigned yet. You will see trip progress here once dispatch confirms it.",
      meta: "Live updates ready | Waiting for driver",
      tag: "Tracking",
    });
  };

  const handleSendSos = () => {
    setResidentStatus({
      title: "Emergency SOS Sent",
      description: `${emergencyType === "Select Type" ? "Emergency" : emergencyType} request sent for ${carType === "Select Type" ? "available vehicle" : carType}.`,
      meta: `${pickupLocation === "Select Where" ? "Pickup location pending" : pickupLocation} | Waiting for responders`,
      tag: "Emergency",
    });
    setSosOpen(false);
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
            <Text style={styles.cardTitle}>Emergency SOS</Text>
            <Text style={styles.cardSubtitle}>Send a high-priority alert quickly when immediate help is needed.</Text>
            <TouchableOpacity style={styles.sosButton} onPress={() => handleQuickAction("sos")}>
              <Text style={styles.cardButtonText}>Send SOS</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.featureCard, styles.bookingCard]}>
            <Feather name="clipboard" size={compact ? 30 : 34} color="#D88400" />
            <Text style={styles.cardTitle}>Transport Request</Text>
            <Text style={styles.cardSubtitle}>Book a ride, review request details, and keep your transport history in one place.</Text>
            <TouchableOpacity style={styles.bookingButton} onPress={() => handleQuickAction("transport")}>
              <Text style={styles.cardButtonText}>Request Transport</Text>
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

          <View style={styles.sideSummary}>
            <View style={styles.summaryCard}>
              <Ionicons name="time-outline" size={24} color="#0F8A5B" />
              <Text style={styles.summaryTitle}>Fast request view</Text>
              <Text style={styles.summaryText}>Important status info stays visible without crowding the screen.</Text>
            </View>

            <View style={styles.summaryCard}>
              <Ionicons name="phone-portrait-outline" size={24} color="#0F8A5B" />
              <Text style={styles.summaryTitle}>Android-friendly spacing</Text>
              <Text style={styles.summaryText}>Cards now wrap naturally instead of forcing a desktop layout into a phone width.</Text>
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

            <Text style={styles.modalTitle}>Emergency SOS</Text>
            <Text style={styles.modalSubtitle}>Send emergency request to nearest responders</Text>

            <Text style={styles.modalLabel}>Emergency Type</Text>
            <TouchableOpacity style={styles.selectField} onPress={() => setEmergencyType((current) => cycleOption(current, emergencyTypes, "Select Type"))}>
              <Text style={styles.selectFieldText}>{emergencyType}</Text>
              <Text style={styles.selectFieldArrow}>^</Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Choose a Car Type</Text>
            <TouchableOpacity style={styles.selectField} onPress={() => setCarType((current) => cycleOption(current, carTypes, "Select Type"))}>
              <Text style={styles.selectFieldText}>{carType}</Text>
              <Text style={styles.selectFieldArrow}>^</Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Pick up Location</Text>
            <TouchableOpacity
              style={styles.selectField}
              onPress={() => setPickupLocation((current) => cycleOption(current, pickupLocations, "Select Where"))}
            >
              <Text style={styles.selectFieldText}>{pickupLocation}</Text>
              <Text style={styles.selectFieldArrow}>^</Text>
            </TouchableOpacity>

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
  selectField: {
    marginTop: 10,
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: "#D9D9D9",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectFieldText: {
    flex: 1,
    fontSize: 18,
    color: "#222222",
  },
  selectFieldArrow: {
    fontSize: 28,
    color: "#6C6C6C",
    transform: [{ rotate: "180deg" }],
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
});
