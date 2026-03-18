import { useRouter } from "expo-router";
import { useWindowDimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Entypo, Feather, FontAwesome, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";

import AppBrandHeader from "../components/AppBrandHeader";
import { useCurrentUserProfile } from "../lib/session";

export default function DriverHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 980;
  const { displayName } = useCurrentUserProfile();

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <AppBrandHeader role="Driver" name={displayName} onLogoutPress={() => router.replace("/")} />

      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.statusBar}>
          <View style={styles.statusLeft}>
            <View style={styles.statusDot} />
            <Text style={[styles.statusText, compact && styles.statusTextCompact]}>Status: Available</Text>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={() => {}}>
            <FontAwesome name="bell" size={compact ? 20 : 24} color="#0F1720" />
          </TouchableOpacity>
        </View>

        <View style={[styles.mainGrid, compact && styles.mainGridCompact]}>
          <View style={styles.sidebar}>
            {[
              ["history", "History"],
              ["user", "Profile"],
              ["settings", "Settings"],
            ].map(([key, label]) => (
              <TouchableOpacity key={label} style={styles.sideCard} onPress={() => {}}>
                <View style={styles.sideCardInner}>
                  {key === "history" ? <MaterialCommunityIcons name="history" size={26} color="#FFFFFF" /> : null}
                  {key === "user" ? <FontAwesome name="user" size={24} color="#FFFFFF" /> : null}
                  {key === "settings" ? <Feather name="settings" size={24} color="#FFFFFF" /> : null}
                  <Text style={styles.sideCardText}>{label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.assignmentPanel}>
            <View style={styles.panelHeader}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Urgent Assignment</Text>
              </View>
              <Text style={styles.assignmentStatus}>Active request</Text>
            </View>

            <Text style={[styles.assignmentTitle, compact && styles.assignmentTitleCompact]}>Patient Transfer</Text>

            <View style={[styles.assignmentGrid, compact && styles.assignmentGridCompact]}>
              <View style={styles.leftColumn}>
                <View style={styles.infoCard}>
                  <Text style={styles.sectionTitle}>Pickup Location</Text>
                  <View style={styles.locationRow}>
                    <Entypo name="location-pin" size={30} color="#111111" />
                    <Text style={styles.locationText}>Barangay Health Center</Text>
                  </View>
                </View>

                <View style={styles.infoCard}>
                  <Text style={styles.sectionTitle}>Destination</Text>
                  <View style={styles.locationRow}>
                    <FontAwesome5 name="flag" size={22} color="#111111" />
                    <Text style={styles.locationText}>Toledo Poblacion Health Center</Text>
                  </View>
                </View>

                <View style={styles.infoCard}>
                  <Text style={styles.sectionTitle}>Trip Summary</Text>
                  <Text style={styles.summaryText}>
                    This space is prepared for trip instructions, ETA updates, and response details once the workflow is implemented.
                  </Text>
                </View>
              </View>

              <View style={styles.mapCard}>
                <View style={styles.mapCardHeader}>
                  <Text style={styles.mapCardTitle}>Map Preview</Text>
                  <TouchableOpacity style={styles.mapHeaderButton} onPress={() => {}}>
                    <Text style={styles.mapHeaderButtonText}>Pending</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.mapBlankState}>
                  <MaterialCommunityIcons name="map-outline" size={58} color="#90A0AA" />
                  <Text style={styles.mapBlankTitle}>Blank driver map area</Text>
                  <Text style={styles.mapBlankText}>The driver dashboard will keep this panel empty until the map experience is added.</Text>
                </View>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={() => {}}>
                <Text style={styles.actionButtonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.startButton]} onPress={() => {}}>
                <Text style={styles.actionButtonText}>Start Trip</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.completeButton]} onPress={() => {}}>
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
  container: { width: "100%", maxWidth: 1320, alignSelf: "center", padding: 24, gap: 20 },
  containerCompact: { padding: 16, gap: 16 },
  statusBar: {
    backgroundColor: "#0B7A4A",
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#20A7F4" },
  statusText: { fontSize: 28, fontWeight: "800", color: "#FFFFFF" },
  statusTextCompact: { fontSize: 20 },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  mainGrid: { flexDirection: "row", gap: 20, alignItems: "flex-start" },
  mainGridCompact: { flexWrap: "wrap" },
  sidebar: { width: 240, gap: 14 },
  sideCard: { borderRadius: 18, overflow: "hidden" },
  sideCardInner: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 18, paddingHorizontal: 18, backgroundColor: "#06774B" },
  sideCardText: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  assignmentPanel: { flex: 1, minWidth: 320, padding: 22, borderRadius: 24, backgroundColor: "#E3E7E5" },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  badge: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, backgroundColor: "#FB7A2E" },
  badgeText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  assignmentStatus: { fontSize: 14, fontWeight: "700", color: "#567167" },
  assignmentTitle: { marginTop: 14, fontSize: 40, fontWeight: "800", color: "#111111" },
  assignmentTitleCompact: { fontSize: 30 },
  assignmentGrid: { flexDirection: "row", gap: 18, marginTop: 20, alignItems: "stretch" },
  assignmentGridCompact: { flexWrap: "wrap" },
  leftColumn: { flex: 1, minWidth: 280, gap: 14 },
  infoCard: { padding: 20, borderRadius: 20, backgroundColor: "#FFFFFF" },
  sectionTitle: { fontSize: 22, fontWeight: "700", color: "#111111" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  locationText: { flex: 1, fontSize: 18, fontWeight: "600", color: "#1C2723" },
  summaryText: { marginTop: 10, fontSize: 16, lineHeight: 24, color: "#475652" },
  mapCard: { flex: 1.05, minWidth: 320, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D5DEDA", overflow: "hidden" },
  mapCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#E4EBE7" },
  mapCardTitle: { fontSize: 18, fontWeight: "700", color: "#2E3C37" },
  mapHeaderButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#EFF4F2" },
  mapHeaderButtonText: { fontSize: 13, fontWeight: "700", color: "#496B5F" },
  mapBlankState: { minHeight: 320, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingVertical: 28 },
  mapBlankTitle: { marginTop: 14, fontSize: 24, fontWeight: "800", color: "#2F3B46", textAlign: "center" },
  mapBlankText: { marginTop: 10, fontSize: 16, lineHeight: 24, color: "#65727C", textAlign: "center" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 20 },
  actionButton: { minWidth: 170, paddingVertical: 15, paddingHorizontal: 22, borderRadius: 16, alignItems: "center" },
  acceptButton: { backgroundColor: "#06774B" },
  startButton: { backgroundColor: "#326CD0" },
  completeButton: { backgroundColor: "#F43434" },
  actionButtonText: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
});
