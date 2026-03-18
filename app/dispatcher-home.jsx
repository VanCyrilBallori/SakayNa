import { useRouter } from "expo-router";
import { useWindowDimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather, FontAwesome } from "@expo/vector-icons";

import AppBrandHeader from "../components/AppBrandHeader";
import { useCurrentUserProfile } from "../lib/session";

const requests = [
  { level: "Emergency", status: "Assigned", title: "Medical", color: "#E9B8B8", chip: "#C53A3A" },
  { level: "Urgent", status: "Assigned", title: "Asthma Attack", color: "#F3EFCC", chip: "#989400" },
  { level: "Urgent", status: "Pending", title: "Accident", color: "#F3EFCC", chip: "#989400" },
  { level: "Non-Urgent", status: "Pending", title: "Patient Transfer", color: "#BED4CB", chip: "#06774B" },
];

const drivers = [
  { name: "James Martin", place: "Sangi Toledo", status: "Unavailable" },
  { name: "Andrew Corbin", place: "Poblacion Toledo", status: "Available" },
  { name: "Oliver Gavin", place: "Talavera Toledo", status: "Available" },
  { name: "George Robin", place: "Daanlungsod Toledo", status: "Available" },
];

export default function DispatcherHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 1100;
  const { displayName } = useCurrentUserProfile();

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <AppBrandHeader role="Dispatcher" name={displayName} onLogoutPress={() => router.replace("/")} />

      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={[styles.headerRow, compact && styles.headerRowCompact]}>
          <View style={styles.headerBlock}>
            <Text style={styles.headerBlockText}>Pending Requests</Text>
          </View>
          <View style={[styles.headerBlock, styles.headerBlockWide]}>
            <Text style={styles.headerBlockText}>Live Map</Text>
          </View>
          <View style={styles.headerBlock}>
            <Text style={styles.headerBlockText}>Drivers</Text>
          </View>
        </View>

        <View style={[styles.mainGrid, compact && styles.mainGridCompact]}>
          <View style={styles.leftPanel}>
            <Text style={styles.panelLabel}>Latest queue</Text>
            {requests.map((request) => (
              <TouchableOpacity key={`${request.title}-${request.status}`} style={[styles.requestCard, { backgroundColor: request.color }]} onPress={() => {}}>
                <View style={styles.requestTop}>
                  <View style={[styles.requestChip, { backgroundColor: request.chip }]}>
                    <Text style={styles.requestChipText}>{request.level}</Text>
                  </View>
                  <Text style={styles.requestStatus}>{request.status}</Text>
                </View>
                <Text style={styles.requestTitle}>{request.title}</Text>
                <Text style={styles.requestMeta}>202X/XX/XX • Ambulance • Brgy. Talavera</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.mapPanel}>
            <View style={styles.mapToolbar}>
              <View>
                <Text style={styles.mapToolbarTitle}>OpenStreetMap Area</Text>
                <Text style={styles.mapToolbarSubtext}>Reserved for future dispatcher map integration</Text>
              </View>
              <TouchableOpacity style={styles.mapAction} onPress={() => {}}>
                <Feather name="refresh-cw" size={16} color="#FFFFFF" />
                <Text style={styles.mapActionText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.mapPlaceholder}>
              <View style={styles.mapCrossWrap}>
                <Text style={styles.mapCross}>+</Text>
              </View>
              <Text style={styles.mapPlaceholderTitle}>Blank map canvas</Text>
              <Text style={styles.mapPlaceholderText}>
                This center panel is intentionally empty so OpenStreetMap can be added cleanly later without redesigning the dispatcher page.
              </Text>
            </View>
          </View>

          <View style={styles.rightPanel}>
            <Text style={styles.panelLabel}>Driver availability</Text>
            {drivers.map((driver) => (
              <TouchableOpacity key={driver.name} style={styles.driverCard} onPress={() => {}}>
                <View style={styles.driverTop}>
                  <View style={styles.driverIdentity}>
                    <View style={styles.driverAvatar}>
                      <FontAwesome name="user" size={24} color="#111111" />
                    </View>
                    <View>
                      <Text style={styles.driverName}>{driver.name}</Text>
                      <Text style={styles.driverPlace}>{driver.place}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusPill, driver.status === "Available" ? styles.statusPillAvailable : styles.statusPillUnavailable]}>
                    <Text style={styles.statusPillText}>{driver.status}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7F6" },
  content: { paddingBottom: 24 },
  container: { width: "100%", maxWidth: 1380, alignSelf: "center", padding: 24, gap: 18 },
  containerCompact: { padding: 16, gap: 14 },
  headerRow: { flexDirection: "row", gap: 16 },
  headerRowCompact: { flexWrap: "wrap" },
  headerBlock: { minWidth: 220, paddingVertical: 16, paddingHorizontal: 20, borderRadius: 18, backgroundColor: "#06774B", alignItems: "center" },
  headerBlockWide: { flex: 1 },
  headerBlockText: { fontSize: 24, fontWeight: "800", color: "#FFFFFF" },
  mainGrid: { flexDirection: "row", gap: 18, alignItems: "stretch" },
  mainGridCompact: { flexWrap: "wrap" },
  leftPanel: { width: 320, padding: 18, borderRadius: 22, backgroundColor: "#E3E7E5", gap: 14 },
  panelLabel: { fontSize: 18, fontWeight: "700", color: "#496B5F" },
  requestCard: { borderRadius: 18, padding: 16 },
  requestTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  requestChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  requestChipText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  requestStatus: { fontSize: 13, fontWeight: "700", color: "#344640" },
  requestTitle: { marginTop: 14, fontSize: 22, fontWeight: "800", color: "#111111" },
  requestMeta: { marginTop: 14, fontSize: 14, lineHeight: 20, color: "#465752" },
  mapPanel: { flex: 1, minWidth: 360, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D6DFDB", overflow: "hidden" },
  mapToolbar: { paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#E5ECE8", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  mapToolbarTitle: { fontSize: 20, fontWeight: "800", color: "#1F2E29" },
  mapToolbarSubtext: { marginTop: 4, fontSize: 13, color: "#60716B" },
  mapAction: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#06774B" },
  mapActionText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  mapPlaceholder: { minHeight: 620, alignItems: "center", justifyContent: "center", paddingHorizontal: 48, paddingVertical: 40, backgroundColor: "#F7F9F8" },
  mapCrossWrap: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: "#CDD6D2", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  mapCross: { fontSize: 64, lineHeight: 64, color: "#A4B0AA" },
  mapPlaceholderTitle: { marginTop: 18, fontSize: 28, fontWeight: "800", color: "#2D3934" },
  mapPlaceholderText: { marginTop: 12, maxWidth: 520, fontSize: 17, lineHeight: 26, color: "#61716B", textAlign: "center" },
  rightPanel: { width: 320, padding: 18, borderRadius: 22, backgroundColor: "#E3E7E5", gap: 14 },
  driverCard: { padding: 16, borderRadius: 18, backgroundColor: "#06774B" },
  driverTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  driverIdentity: { flexDirection: "row", gap: 10, alignItems: "center", flex: 1 },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  driverName: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  driverPlace: { marginTop: 2, fontSize: 14, color: "#DDEEE7" },
  statusPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  statusPillAvailable: { backgroundColor: "#E5FFF2" },
  statusPillUnavailable: { backgroundColor: "#F0E8E8" },
  statusPillText: { fontSize: 12, fontWeight: "700", color: "#26433A" },
});
