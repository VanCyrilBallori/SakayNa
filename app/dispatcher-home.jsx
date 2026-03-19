import { useRouter } from "expo-router";
import { Feather, FontAwesome } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";

import AppBrandHeader from "../components/AppBrandHeader";
import { useCurrentUserProfile } from "../lib/session";

const requests = [
  { level: "Emergency", status: "Assigned", title: "Medical", color: "#F6D0D0", chip: "#C53A3A" },
  { level: "Urgent", status: "Assigned", title: "Asthma Attack", color: "#F5EFCE", chip: "#989400" },
  { level: "Urgent", status: "Pending", title: "Accident", color: "#F5EFCE", chip: "#989400" },
  { level: "Non-Urgent", status: "Pending", title: "Patient Transfer", color: "#D1E6DD", chip: "#06774B" },
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
  const [selectedRequest, setSelectedRequest] = useState(requests[0]);
  const [selectedDriver, setSelectedDriver] = useState(drivers[1]);
  const [mapStatus, setMapStatus] = useState("Ready");

  const driverSummary = useMemo(() => {
    if (!selectedDriver) {
      return "No driver selected";
    }

    return `${selectedDriver.name} | ${selectedDriver.status}`;
  }, [selectedDriver]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppBrandHeader role="Dispatcher" name={displayName} onLogoutPress={() => router.replace("/")} />

      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.sectionLabels}>
          <View style={styles.sectionLabelLeft}>
            <Text style={styles.sectionLabelText}>Pending Requests</Text>
          </View>
          <View style={styles.sectionLabelMap}>
            <Text style={styles.sectionLabelText}>Live Map</Text>
          </View>
          <View style={styles.sectionLabelRight}>
            <Text style={styles.sectionLabelText}>Drivers</Text>
          </View>
        </View>

        <View style={styles.mainGrid}>
          <View style={styles.leftPanel}>
            <Text style={styles.panelLabel}>Latest queue</Text>
            {requests.map((request) => (
              <TouchableOpacity
                key={`${request.title}-${request.status}`}
                style={[
                  styles.requestCard,
                  { backgroundColor: request.color },
                  selectedRequest.title === request.title && styles.requestCardActive,
                ]}
                onPress={() => setSelectedRequest(request)}
              >
                <View style={styles.requestTop}>
                  <View style={[styles.requestChip, { backgroundColor: request.chip }]}>
                    <Text style={styles.requestChipText}>{request.level}</Text>
                  </View>
                  <Text style={styles.requestStatus}>{request.status}</Text>
                </View>
                <Text style={styles.requestTitle}>{request.title}</Text>
                <Text style={styles.requestMeta}>2026/03/19 | Ambulance | Brgy. Talavera</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.mapPanel}>
            <View style={styles.mapToolbar}>
              <View style={styles.mapToolbarCopy}>
                <Text style={styles.mapToolbarTitle}>{selectedRequest.title} | {selectedRequest.status}</Text>
                <Text style={styles.mapToolbarSubtext}>{driverSummary}</Text>
              </View>
              <TouchableOpacity
                style={styles.mapAction}
                onPress={() => setMapStatus((current) => (current === "Ready" ? "Refreshing" : "Ready"))}
              >
                <Feather name="refresh-cw" size={16} color="#FFFFFF" />
                <Text style={styles.mapActionText}>{mapStatus}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.mapPlaceholder}>
              <View style={styles.mapCrossWrap}>
                <Text style={styles.mapCross}>+</Text>
              </View>
              <Text style={styles.mapPlaceholderTitle}>Blank map canvas</Text>
              <Text style={styles.mapPlaceholderText}>
                The center panel remains spacious on desktop and stacks cleanly beneath the request list on smaller Android layouts.
              </Text>
            </View>
          </View>

          <View style={styles.rightPanel}>
            <Text style={styles.panelLabel}>Driver availability</Text>
            {drivers.map((driver) => (
              <TouchableOpacity
                key={driver.name}
                style={[styles.driverCard, selectedDriver.name === driver.name && styles.driverCardActive]}
                onPress={() => setSelectedDriver(driver)}
              >
                <View style={styles.driverTop}>
                  <View style={styles.driverIdentity}>
                    <View style={styles.driverAvatar}>
                      <FontAwesome name="user" size={22} color="#111111" />
                    </View>
                    <View style={styles.driverCopy}>
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
  container: { width: "100%", maxWidth: 1320, alignSelf: "center", padding: 24, gap: 18 },
  containerCompact: { padding: 16, gap: 14 },
  sectionLabels: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-end" },
  sectionLabelLeft: { width: 170, alignItems: "flex-start" },
  sectionLabelMap: { flex: 2.3, minWidth: 420, alignItems: "center" },
  sectionLabelRight: { width: 170, alignItems: "flex-start" },
  sectionLabelText: { fontSize: 24, fontWeight: "800", color: "#06774B" },
  mainGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "stretch" },
  leftPanel: { width: 170, flexGrow: 1, padding: 14, borderRadius: 20, backgroundColor: "#E3E7E5", gap: 10 },
  panelLabel: { fontSize: 16, fontWeight: "700", color: "#496B5F" },
  requestCard: { borderRadius: 18, padding: 16 },
  requestCardActive: { borderWidth: 2, borderColor: "#06774B" },
  requestTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  requestChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  requestChipText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  requestStatus: { fontSize: 13, fontWeight: "700", color: "#344640" },
  requestTitle: { marginTop: 10, fontSize: 18, fontWeight: "800", color: "#111111" },
  requestMeta: { marginTop: 10, fontSize: 12, lineHeight: 17, color: "#465752" },
  mapPanel: { flex: 2.3, minWidth: 420, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D6DFDB", overflow: "hidden" },
  mapToolbar: { paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#E5ECE8", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  mapToolbarCopy: { flex: 1, minWidth: 220 },
  mapToolbarTitle: { fontSize: 20, fontWeight: "800", color: "#1F2E29" },
  mapToolbarSubtext: { marginTop: 4, fontSize: 13, lineHeight: 20, color: "#60716B" },
  mapAction: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#06774B" },
  mapActionText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  mapPlaceholder: { minHeight: 680, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 36, backgroundColor: "#F7F9F8" },
  mapCrossWrap: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: "#CDD6D2", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  mapCross: { fontSize: 58, lineHeight: 58, color: "#A4B0AA" },
  mapPlaceholderTitle: { marginTop: 18, fontSize: 26, fontWeight: "800", color: "#2D3934", textAlign: "center" },
  mapPlaceholderText: { marginTop: 12, maxWidth: 520, fontSize: 16, lineHeight: 24, color: "#61716B", textAlign: "center" },
  rightPanel: { width: 170, flexGrow: 1, padding: 14, borderRadius: 20, backgroundColor: "#E3E7E5", gap: 10 },
  driverCard: { padding: 14, borderRadius: 18, backgroundColor: "#06774B" },
  driverCardActive: { borderWidth: 2, borderColor: "#DFF5EA" },
  driverTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" },
  driverIdentity: { flexDirection: "row", gap: 10, alignItems: "center", flex: 1, minWidth: 180 },
  driverAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  driverCopy: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  driverPlace: { marginTop: 2, fontSize: 12, color: "#DDEEE7" },
  statusPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  statusPillAvailable: { backgroundColor: "#E5FFF2" },
  statusPillUnavailable: { backgroundColor: "#F0E8E8" },
  statusPillText: { fontSize: 12, fontWeight: "700", color: "#26433A" },
});
