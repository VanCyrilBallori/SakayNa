import { useRouter } from "expo-router";
import { useWindowDimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather, FontAwesome } from "@expo/vector-icons";

import AppBrandHeader from "../components/AppBrandHeader";
import { useCurrentUserProfile } from "../lib/session";

const sideLinks = ["City Dashboard", "Residents", "Drivers", "Dispatchers", "Vehicles"];
const dayLabels = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

export default function AdminHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 1080;
  const { displayName } = useCurrentUserProfile();

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <AppBrandHeader role="Admin" name={displayName} onLogoutPress={() => router.replace("/")} />

      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={[styles.layoutRow, compact && styles.layoutRowCompact]}>
          <View style={styles.sidebar}>
            <Text style={styles.sidebarLabel}>Quick Navigation</Text>
            {sideLinks.map((label) => (
              <TouchableOpacity key={label} style={styles.sideBlock} onPress={() => {}}>
                <Text style={styles.sideBlockText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.mainArea}>
            <View style={[styles.topControls, compact && styles.topControlsCompact]}>
              <View style={styles.searchBar}>
                <Feather name="search" size={20} color="#335E50" />
                <TextInput style={styles.searchInput} placeholder="Search dashboard..." placeholderTextColor="#7D9086" editable={false} />
              </View>

              <TouchableOpacity style={styles.filterButton} onPress={() => {}}>
                <Text style={styles.filterButtonText}>Week</Text>
                <Feather name="chevron-down" size={18} color="#111111" />
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Dashboard Overview</Text>
            </View>

            <View style={styles.chartCard}>
              <View style={styles.chartTabs}>
                <Text style={[styles.chartTab, styles.chartTabActive]}>Requests</Text>
                <Text style={styles.chartTab}>Actions</Text>
                <Text style={styles.chartTab}>Active Vehicles</Text>
              </View>

              <View style={styles.chartArea}>
                <View style={styles.chartShapeA} />
                <View style={styles.chartShapeB} />
                <View style={styles.chartMarkerLine} />
                <View style={styles.chartMarkerDot} />
              </View>

              <View style={styles.daysRow}>
                {dayLabels.map((day) => (
                  <View key={day} style={day === "Mon" ? styles.dayPillActive : styles.dayWrap}>
                    <Text style={day === "Mon" ? styles.dayTextActive : styles.dayText}>{day}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.emailCard}>
              <View style={styles.emailHeader}>
                <Text style={styles.emailHeading}>Recent Emails</Text>
                <TouchableOpacity style={styles.emailHeaderButton} onPress={() => {}}>
                  <Text style={styles.emailHeaderButtonText}>View All</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.emailRow, compact && styles.emailRowCompact]}>
                <View style={styles.emailSender}>
                  <View style={styles.emailAvatar}>
                    <FontAwesome name="user" size={22} color="#111111" />
                  </View>
                  <View>
                    <Text style={styles.emailName}>Juan Tapang</Text>
                    <Text style={styles.emailSubtext}>Dispatcher</Text>
                  </View>
                </View>

                <Text style={styles.emailSubject}>Open Meeting</Text>
                <Text style={styles.emailTime}>08:00 AM</Text>
              </View>
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
  container: { width: "100%", maxWidth: 1360, alignSelf: "center", padding: 24 },
  containerCompact: { padding: 16 },
  layoutRow: { flexDirection: "row", gap: 20, alignItems: "flex-start" },
  layoutRowCompact: { flexWrap: "wrap" },
  sidebar: { width: 250, padding: 18, borderRadius: 22, backgroundColor: "#E3E7E5", gap: 12 },
  sidebarLabel: { marginBottom: 4, fontSize: 18, fontWeight: "700", color: "#496B5F" },
  sideBlock: { paddingVertical: 18, paddingHorizontal: 16, borderRadius: 16, backgroundColor: "#08A967" },
  sideBlockText: { fontSize: 18, fontWeight: "800", color: "#0C1612" },
  mainArea: { flex: 1, minWidth: 320, gap: 18 },
  topControls: { flexDirection: "row", gap: 12, alignItems: "center" },
  topControlsCompact: { flexWrap: "wrap" },
  searchBar: {
    flex: 1,
    minWidth: 240,
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7E2DC",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#214238" },
  filterButton: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D7E2DC" },
  filterButtonText: { fontSize: 15, fontWeight: "700", color: "#111111" },
  sectionHeader: { paddingVertical: 16, paddingHorizontal: 20, borderRadius: 18, backgroundColor: "#2E3834" },
  sectionHeaderText: { fontSize: 28, fontWeight: "800", color: "#FFFFFF" },
  chartCard: { padding: 20, borderRadius: 24, backgroundColor: "#08A967" },
  chartTabs: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  chartTab: { fontSize: 17, fontWeight: "700", color: "#D7FFF0" },
  chartTabActive: { textDecorationLine: "underline", color: "#FFFFFF" },
  chartArea: { height: 280, marginTop: 18, borderRadius: 24, overflow: "hidden", position: "relative", backgroundColor: "rgba(255,255,255,0.14)" },
  chartShapeA: { position: "absolute", left: 0, right: 0, bottom: 0, height: 200, backgroundColor: "rgba(255,255,255,0.65)", borderTopLeftRadius: 160, borderTopRightRadius: 160 },
  chartShapeB: { position: "absolute", left: "30%", right: -30, top: 46, bottom: 0, backgroundColor: "rgba(255,255,255,0.35)", borderTopLeftRadius: 180, borderTopRightRadius: 120 },
  chartMarkerLine: { position: "absolute", left: "42%", top: 24, bottom: 18, width: 3, backgroundColor: "#0B8E59" },
  chartMarkerDot: { position: "absolute", left: "41.4%", top: 20, width: 14, height: 14, borderRadius: 7, backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: "#0B8E59" },
  daysRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginTop: 16, gap: 8 },
  dayWrap: { paddingVertical: 6, paddingHorizontal: 10 },
  dayPillActive: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "#0AA866" },
  dayText: { fontSize: 16, fontWeight: "700", color: "#0F1F19" },
  dayTextActive: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  emailCard: { padding: 20, borderRadius: 24, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D8E2DD" },
  emailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  emailHeading: { fontSize: 24, fontWeight: "800", color: "#111111" },
  emailHeaderButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#EFF4F2" },
  emailHeaderButtonText: { fontSize: 14, fontWeight: "700", color: "#476F63" },
  emailRow: { marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: "#F4F7F5", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16 },
  emailRowCompact: { flexWrap: "wrap", alignItems: "flex-start" },
  emailSender: { flexDirection: "row", alignItems: "center", gap: 12, minWidth: 220 },
  emailAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  emailName: { fontSize: 18, fontWeight: "700", color: "#111111" },
  emailSubtext: { marginTop: 2, fontSize: 13, color: "#61716B" },
  emailSubject: { fontSize: 18, color: "#1E2D28" },
  emailTime: { fontSize: 16, color: "#43534D" },
});
