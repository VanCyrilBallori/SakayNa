import { useRouter } from "expo-router";
import { Entypo, Feather, FontAwesome, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";

import AppBrandHeader from "../components/AppBrandHeader";
import { useCurrentUserProfile } from "../lib/session";

export default function DriverHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 980;
  const { displayName } = useCurrentUserProfile();
  const [activeTab, setActiveTab] = useState("History");
  const [tripStage, setTripStage] = useState("Pending");
  const [assignmentState, setAssignmentState] = useState("Active request");
  const [notificationsSeen, setNotificationsSeen] = useState(false);

  const assignmentContent = {
    History: {
      title: "Patient Transfer",
      summary: "This trip has previous updates available for review before you start the route.",
    },
    Profile: {
      title: "Driver Profile",
      summary: "Your assigned route uses the saved driver identity and response profile for dispatch records.",
    },
    Settings: {
      title: "Driver Settings",
      summary: "Trip alerts and driving preferences can be configured here once settings are connected.",
    },
  };

  const currentContent = assignmentContent[activeTab];

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppBrandHeader role="Driver" name={displayName} onLogoutPress={() => router.replace("/")} />

      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.statusBar}>
          <View style={styles.statusLeft}>
            <View style={styles.statusDot} />
            <View>
              <Text style={[styles.statusText, compact && styles.statusTextCompact]}>
                {notificationsSeen ? "Notifications checked" : "Available for dispatch"}
              </Text>
              <Text style={styles.statusSubtext}>Trip-ready layout for desktop and Android</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={() => setNotificationsSeen((current) => !current)}>
            <FontAwesome name="bell" size={20} color="#0F1720" />
          </TouchableOpacity>
        </View>

        <View style={styles.mainGrid}>
          <View style={styles.sidebar}>
            {[
              ["history", "History"],
              ["user", "Profile"],
              ["settings", "Settings"],
            ].map(([key, label]) => (
              <TouchableOpacity key={label} style={styles.sideCard} onPress={() => setActiveTab(label)}>
                <View style={styles.sideCardInner}>
                  {key === "history" ? <MaterialCommunityIcons name="history" size={24} color="#FFFFFF" /> : null}
                  {key === "user" ? <FontAwesome name="user" size={22} color="#FFFFFF" /> : null}
                  {key === "settings" ? <Feather name="settings" size={22} color="#FFFFFF" /> : null}
                  <Text style={styles.sideCardText}>{label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.assignmentPanel}>
            <View style={styles.panelHeader}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tripStage} Assignment</Text>
              </View>
              <Text style={styles.assignmentStatus}>{assignmentState}</Text>
            </View>

            <Text style={[styles.assignmentTitle, compact && styles.assignmentTitleCompact]}>{currentContent.title}</Text>

            <View style={styles.assignmentGrid}>
              <View style={styles.leftColumn}>
                <View style={styles.infoCard}>
                  <Text style={styles.sectionTitle}>Pickup Location</Text>
                  <View style={styles.locationRow}>
                    <Entypo name="location-pin" size={26} color="#111111" />
                    <Text style={styles.locationText}>Barangay Health Center</Text>
                  </View>
                </View>

                <View style={styles.infoCard}>
                  <Text style={styles.sectionTitle}>Destination</Text>
                  <View style={styles.locationRow}>
                    <FontAwesome5 name="flag" size={20} color="#111111" />
                    <Text style={styles.locationText}>Toledo Poblacion Health Center</Text>
                  </View>
                </View>

                <View style={styles.infoCard}>
                  <Text style={styles.sectionTitle}>Trip Summary</Text>
                  <Text style={styles.summaryText}>{currentContent.summary}</Text>
                </View>
              </View>

              <View style={styles.mapCard}>
                <View style={styles.mapCardHeader}>
                  <Text style={styles.mapCardTitle}>Map Preview</Text>
                  <TouchableOpacity
                    style={styles.mapHeaderButton}
                    onPress={() => setTripStage((current) => (current === "Pending" ? "Ready" : "Pending"))}
                  >
                    <Text style={styles.mapHeaderButtonText}>{tripStage}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.mapBlankState}>
                  <MaterialCommunityIcons name="map-outline" size={56} color="#90A0AA" />
                  <Text style={styles.mapBlankTitle}>Blank driver map area</Text>
                  <Text style={styles.mapBlankText}>The map panel stays roomy on desktop and collapses naturally below the trip details on smaller Android screens.</Text>
                </View>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() => {
                  setTripStage("Accepted");
                  setAssignmentState("Driver confirmed");
                }}
              >
                <Text style={styles.actionButtonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.startButton]}
                onPress={() => {
                  setTripStage("In Transit");
                  setAssignmentState("Trip started");
                }}
              >
                <Text style={styles.actionButtonText}>Start Trip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.completeButton]}
                onPress={() => {
                  setTripStage("Completed");
                  setAssignmentState("Trip completed");
                }}
              >
                <Text style={styles.actionButtonText}>Complete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7F6" },
  content: { paddingBottom: 24 },
  container: { width: "100%", maxWidth: 1280, alignSelf: "center", padding: 24, gap: 18 },
  containerCompact: { padding: 16, gap: 16 },
  statusBar: {
    backgroundColor: "#0B7A4A",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 14,
  },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 220 },
  statusDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#20A7F4" },
  statusText: { fontSize: 26, fontWeight: "800", color: "#FFFFFF" },
  statusTextCompact: { fontSize: 21 },
  statusSubtext: { marginTop: 2, fontSize: 13, color: "#D8EEE3" },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  mainGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" },
  sidebar: { width: 220, gap: 12, flexGrow: 1 },
  sideCard: { borderRadius: 18, overflow: "hidden" },
  sideCardInner: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 17, paddingHorizontal: 18, backgroundColor: "#06774B" },
  sideCardText: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  assignmentPanel: { flex: 3, minWidth: 280, padding: 20, borderRadius: 24, backgroundColor: "#E3E7E5" },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  badge: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, backgroundColor: "#FB7A2E" },
  badgeText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  assignmentStatus: { fontSize: 14, fontWeight: "700", color: "#567167" },
  assignmentTitle: { marginTop: 14, fontSize: 38, fontWeight: "800", color: "#111111" },
  assignmentTitleCompact: { fontSize: 30 },
  assignmentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 20, alignItems: "stretch" },
  leftColumn: { flex: 1, minWidth: 260, gap: 14 },
  infoCard: { padding: 18, borderRadius: 20, backgroundColor: "#FFFFFF" },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#111111" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  locationText: { flex: 1, fontSize: 17, fontWeight: "600", color: "#1C2723" },
  summaryText: { marginTop: 10, fontSize: 15, lineHeight: 23, color: "#475652" },
  mapCard: { flex: 1.05, minWidth: 280, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D5DEDA", overflow: "hidden" },
  mapCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#E4EBE7", gap: 12, flexWrap: "wrap" },
  mapCardTitle: { fontSize: 18, fontWeight: "700", color: "#2E3C37" },
  mapHeaderButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#EFF4F2" },
  mapHeaderButtonText: { fontSize: 13, fontWeight: "700", color: "#496B5F" },
  mapBlankState: { minHeight: 280, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 28 },
  mapBlankTitle: { marginTop: 14, fontSize: 24, fontWeight: "800", color: "#2F3B46", textAlign: "center" },
  mapBlankText: { marginTop: 10, fontSize: 15, lineHeight: 23, color: "#65727C", textAlign: "center" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 20 },
  actionButton: { flexGrow: 1, minWidth: 150, paddingVertical: 15, paddingHorizontal: 18, borderRadius: 16, alignItems: "center" },
  acceptButton: { backgroundColor: "#06774B" },
  startButton: { backgroundColor: "#326CD0" },
  completeButton: { backgroundColor: "#F43434" },
  actionButtonText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
