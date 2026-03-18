import { useRouter } from "expo-router";
import { useWindowDimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import AppBrandHeader from "../components/AppBrandHeader";
import { useCurrentUserProfile } from "../lib/session";

export default function ResidentHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const { displayName } = useCurrentUserProfile();

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <AppBrandHeader role="Resident" name={displayName} onLogoutPress={() => router.replace("/")} />

      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={[styles.toolbar, compact && styles.toolbarCompact]}>
          <View style={styles.toolbarLeft}>
            <Ionicons name="partly-sunny" size={compact ? 28 : 36} color="#355E50" />
            <Text style={[styles.toolbarLabel, compact && styles.toolbarLabelCompact]}>Resident Dashboard</Text>
          </View>

          <TouchableOpacity style={styles.settingsButton} onPress={() => {}}>
            <Feather name="settings" size={compact ? 18 : 20} color="#111111" />
            <Text style={[styles.settingsText, compact && styles.settingsTextCompact]}>Settings</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.welcome, compact && styles.welcomeCompact]}>Welcome back, {displayName}!</Text>

        <View style={[styles.cardsGrid, compact && styles.cardsGridCompact]}>
          <View style={[styles.featureCard, styles.sosCard]}>
            <MaterialCommunityIcons name="alarm-light-outline" size={compact ? 34 : 40} color="#C70000" />
            <Text style={[styles.cardTitle, compact && styles.cardTitleCompact]}>Emergency SOS</Text>
            <Text style={[styles.cardSubtitle, compact && styles.cardSubtitleCompact]}>One-tap emergency alert for urgent situations.</Text>
            <TouchableOpacity style={styles.sosButton} onPress={() => {}}>
              <Text style={styles.cardButtonText}>Send SOS</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.featureCard, styles.bookingCard]}>
            <Feather name="clipboard" size={compact ? 32 : 38} color="#FF9800" />
            <Text style={[styles.cardTitle, compact && styles.cardTitleCompact]}>Transport Request</Text>
            <Text style={[styles.cardSubtitle, compact && styles.cardSubtitleCompact]}>Review bookings and request emergency transport from one place.</Text>
            <TouchableOpacity style={styles.bookingButton} onPress={() => {}}>
              <Text style={styles.cardButtonText}>Request Transport</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.featureCard, styles.statusCard]}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={compact ? 34 : 40} color="#06774B" />
            <Text style={[styles.cardTitle, compact && styles.cardTitleCompact]}>Current Ride Status</Text>
            <Text style={[styles.cardSubtitle, compact && styles.cardSubtitleCompact]}>Track your active request and view trip progress once available.</Text>
            <TouchableOpacity style={styles.statusButton} onPress={() => {}}>
              <Text style={styles.cardButtonText}>View Request</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.activityPanel, compact && styles.activityPanelCompact]}>
          <View style={styles.activityHeader}>
            <Text style={[styles.activityHeading, compact && styles.activityHeadingCompact]}>Recent Activity</Text>
            <TouchableOpacity style={styles.activityFilter} onPress={() => {}}>
              <Text style={styles.activityFilterText}>Latest</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.activityCard, compact && styles.activityCardCompact]}>
            <View style={styles.activityMain}>
              <Text style={[styles.activityTitle, compact && styles.activityTitleCompact]}>Clinic Visit</Text>
              <Text style={[styles.activityDesc, compact && styles.activityDescCompact]}>Appointment for medical attention</Text>
              <Text style={styles.activityMeta}>202X/XX/XX • Brgy. Talavera</Text>
            </View>

            <View style={styles.tag}>
              <Text style={styles.tagText}>Non-Urgent</Text>
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
  container: { width: "100%", maxWidth: 1280, alignSelf: "center", padding: 24, gap: 22 },
  containerCompact: { padding: 16, gap: 16 },
  toolbar: {
    backgroundColor: "#E2E7E4",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  toolbarCompact: { flexWrap: "wrap" },
  toolbarLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  toolbarLabel: { fontSize: 22, fontWeight: "700", color: "#355E50" },
  toolbarLabelCompact: { fontSize: 18 },
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  settingsText: { fontSize: 16, fontWeight: "700", color: "#111111" },
  settingsTextCompact: { fontSize: 14 },
  welcome: { fontSize: 48, fontWeight: "800", color: "#476F63" },
  welcomeCompact: { fontSize: 30, lineHeight: 38 },
  cardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  cardsGridCompact: { gap: 14 },
  featureCard: {
    flexGrow: 1,
    flexBasis: 280,
    minHeight: 220,
    padding: 22,
    borderRadius: 24,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sosCard: { backgroundColor: "#EBC0C0" },
  bookingCard: { backgroundColor: "#F5F0CB" },
  statusCard: { backgroundColor: "#BFD8CF" },
  cardTitle: { marginTop: 18, fontSize: 28, fontWeight: "800", color: "#1B1B1B" },
  cardTitleCompact: { fontSize: 22 },
  cardSubtitle: { marginTop: 8, fontSize: 18, lineHeight: 26, color: "#25322D" },
  cardSubtitleCompact: { fontSize: 15, lineHeight: 22 },
  sosButton: { marginTop: "auto", borderRadius: 16, paddingVertical: 15, alignItems: "center", backgroundColor: "#CF0000" },
  bookingButton: { marginTop: "auto", borderRadius: 16, paddingVertical: 15, alignItems: "center", backgroundColor: "#A3A300" },
  statusButton: { marginTop: "auto", borderRadius: 16, paddingVertical: 15, alignItems: "center", backgroundColor: "#06774B" },
  cardButtonText: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  activityPanel: {
    padding: 24,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5E0",
  },
  activityPanelCompact: { padding: 18 },
  activityHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  activityHeading: { fontSize: 34, fontWeight: "800", color: "#111111" },
  activityHeadingCompact: { fontSize: 26 },
  activityFilter: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#F0F4F2" },
  activityFilterText: { fontSize: 14, fontWeight: "700", color: "#476F63" },
  activityCard: {
    marginTop: 18,
    padding: 24,
    borderRadius: 20,
    backgroundColor: "#EEF2F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
  },
  activityCardCompact: { flexWrap: "wrap", alignItems: "flex-start" },
  activityMain: { flex: 1 },
  activityTitle: { fontSize: 28, fontWeight: "800", color: "#111111" },
  activityTitleCompact: { fontSize: 22 },
  activityDesc: { marginTop: 8, fontSize: 20, color: "#34433D" },
  activityDescCompact: { fontSize: 16 },
  activityMeta: { marginTop: 20, fontSize: 15, color: "#56655F" },
  tag: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 999, backgroundColor: "#FFFFFF" },
  tagText: { fontSize: 15, fontWeight: "700", color: "#8C8B00" },
});
