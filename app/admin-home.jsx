import { useRouter } from "expo-router";
import { Feather, FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";

import AppBrandHeader from "../components/AppBrandHeader";
import { useCurrentUserProfile } from "../lib/session";

const sideLinks = ["City Dashboard", "Residents", "Drivers", "Dispatchers", "Vehicles"];
const dayLabels = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const residentRecords = [
  { name: "John Doe", email: "John.Doe@gmail.com", phone: "0917-123-4567", barangay: "Poblacion, Toledo City", status: "Pending" },
  { name: "Jane Doe", email: "Jane.Doe@gmail.com", phone: "0918-123-7654", barangay: "Sangi, Toledo City", status: "Pending" },
  { name: "Richard Roe", email: "Richard.Roe@gmail.com", phone: "0919-123-5467", barangay: "Talavera, Toledo City", status: "Pending" },
];
const driverRecords = [
  { name: "James Martin", vehicle: "Ambulance", license: "Verified", priority: "Critical", feedback: "5 stars", status: "Active" },
  { name: "Andrew Corbin", vehicle: "Car", license: "Verified", priority: "Non-urgent", feedback: "3 stars", status: "Active" },
  { name: "Oliver Gavin", vehicle: "Barangay Van", license: "Verified", priority: "Urgent", feedback: "4 stars", status: "Inactive" },
];
const dispatcherRecords = [
  { name: "Saige Fuentes", barangay: "Daanlungsod", account: "Verified", shift: "Offshift", status: "Active" },
  { name: "Jasper Reed", barangay: "Sangi", account: "Verified", shift: "Onshift", status: "Active" },
  { name: "Elena Stein", barangay: "Talavera", account: "Verified", shift: "Offshift", status: "Inactive" },
];
const vehicleRecords = [
  { name: "Toyota HiAce Van", type: "van" },
  { name: "Ambulance", type: "ambulance" },
];

export default function AdminHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 1080;
  const { displayName } = useCurrentUserProfile();
  const [selectedSection, setSelectedSection] = useState("City Dashboard");
  const [searchValue, setSearchValue] = useState("");
  const [rangeLabel, setRangeLabel] = useState("Week");
  const [assignedDriver, setAssignedDriver] = useState("");
  const [viewedDispatcher, setViewedDispatcher] = useState("");
  const [viewedVehicle, setViewedVehicle] = useState("");

  const filteredResidents = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return residentRecords.filter((item) => {
      if (!query) {
        return true;
      }

      return (
        item.name.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query) ||
        item.barangay.toLowerCase().includes(query)
      );
    });
  }, [searchValue]);

  const filteredDrivers = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return driverRecords.filter((item) => {
      if (!query) {
        return true;
      }

      return item.name.toLowerCase().includes(query) || item.vehicle.toLowerCase().includes(query) || item.status.toLowerCase().includes(query);
    });
  }, [searchValue]);

  const filteredDispatchers = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return dispatcherRecords.filter((item) => {
      if (!query) {
        return true;
      }

      return item.name.toLowerCase().includes(query) || item.barangay.toLowerCase().includes(query) || item.status.toLowerCase().includes(query);
    });
  }, [searchValue]);

  const filteredVehicles = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return vehicleRecords.filter((item) => {
      if (!query) {
        return true;
      }

      return item.name.toLowerCase().includes(query);
    });
  }, [searchValue]);

  const renderDashboard = () => (
    <>
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
    </>
  );

  const renderResidents = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Resident Management</Text>
      </View>

      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.nameCol]}>Name</Text>
          <Text style={[styles.tableHeaderCell, styles.emailCol]}>Email Adress</Text>
          <Text style={[styles.tableHeaderCell, styles.phoneCol]}>Phone No.</Text>
          <Text style={[styles.tableHeaderCell, styles.barangayCol]}>Brgy</Text>
          <Text style={[styles.tableHeaderCell, styles.statusCol]}>Status</Text>
        </View>

        {filteredResidents.map((resident) => (
          <View key={resident.email} style={styles.tableRow}>
            <Text style={[styles.tableCellStrong, styles.nameCol]}>{resident.name}</Text>
            <Text style={[styles.tableCell, styles.emailCol]}>{resident.email}</Text>
            <Text style={[styles.tableCell, styles.phoneCol]}>{resident.phone}</Text>
            <Text style={[styles.tableCell, styles.barangayCol]}>{resident.barangay}</Text>
            <Text style={[styles.tableCell, styles.statusCol]}>{resident.status}</Text>
          </View>
        ))}
      </View>
    </>
  );

  const renderDrivers = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Drivers Management</Text>
      </View>

      <View style={styles.cardsRow}>
        {filteredDrivers.map((driver) => (
          <View key={driver.name} style={styles.managementCard}>
            <View style={styles.avatarCircle}>
              <FontAwesome name="user" size={68} color="#000000" />
            </View>
            <Text style={styles.managementName}>{driver.name}</Text>

            <View style={styles.detailsCard}>
              <Text style={styles.detailLine}>Last Assigned Vehicle : {driver.vehicle}</Text>
              <Text style={styles.detailLine}>License : {driver.license}</Text>
              <Text style={styles.detailLine}>Last Trip Priority : {driver.priority}</Text>
              <Text style={styles.detailLine}>Feedback: {driver.feedback}</Text>
              <Text style={styles.detailLine}>Status: {driver.status}</Text>
            </View>

            <TouchableOpacity style={styles.viewButton} onPress={() => setAssignedDriver(driver.name)}>
              <Text style={styles.viewButtonText}>Assign Vehicle</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {assignedDriver ? <Text style={styles.feedbackText}>Vehicle assignment opened for {assignedDriver}.</Text> : null}
    </>
  );

  const renderDispatchers = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Dispatchers</Text>
      </View>

      <View style={styles.cardsRow}>
        {filteredDispatchers.map((dispatcher) => (
          <View key={dispatcher.name} style={styles.managementCard}>
            <View style={styles.avatarCircle}>
              <FontAwesome name="user" size={68} color="#000000" />
            </View>
            <Text style={styles.managementName}>{dispatcher.name}</Text>

            <View style={styles.detailsCard}>
              <Text style={styles.detailLine}>Assigned Brgy : {dispatcher.barangay}</Text>
              <Text style={styles.detailLine}>Account : {dispatcher.account}</Text>
              <Text style={styles.detailLine}>Shift : {dispatcher.shift}</Text>
              <Text style={styles.detailLine}>Status: {dispatcher.status}</Text>
            </View>

            <TouchableOpacity style={styles.viewButton} onPress={() => setViewedDispatcher(dispatcher.name)}>
              <Text style={styles.viewButtonText}>View</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {viewedDispatcher ? <Text style={styles.feedbackText}>Viewing dispatcher profile for {viewedDispatcher}.</Text> : null}
    </>
  );

  const renderVehicles = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Vehicles</Text>
      </View>

      <View style={styles.vehicleRow}>
        {filteredVehicles.map((vehicle) => (
          <View key={vehicle.name} style={styles.vehicleCard}>
            <Text style={styles.vehicleTitle}>{vehicle.name}</Text>
            <View style={styles.vehicleImageWrap}>
              {vehicle.type === "ambulance" ? (
                <FontAwesome name="ambulance" size={120} color="#FFFFFF" />
              ) : (
                <MaterialCommunityIcons name="van-passenger" size={130} color="#FFFFFF" />
              )}
            </View>
            <TouchableOpacity style={styles.vehicleButton} onPress={() => setViewedVehicle(vehicle.name)}>
              <Text style={styles.vehicleButtonText}>View</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {viewedVehicle ? <Text style={styles.feedbackText}>Viewing vehicle record for {viewedVehicle}.</Text> : null}
    </>
  );

  const renderSectionContent = () => {
    if (selectedSection === "Residents") {
      return renderResidents();
    }

    if (selectedSection === "Drivers") {
      return renderDrivers();
    }

    if (selectedSection === "Dispatchers") {
      return renderDispatchers();
    }

    if (selectedSection === "Vehicles") {
      return renderVehicles();
    }

    return renderDashboard();
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppBrandHeader role="Admin" name={displayName} onLogoutPress={() => router.replace("/")} />

      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.layoutRow}>
          <View style={styles.sidebar}>
            {sideLinks.map((label) => (
              <TouchableOpacity
                key={label}
                style={[styles.sideBlock, selectedSection === label && styles.sideBlockActive]}
                onPress={() => setSelectedSection(label)}
              >
                <Text style={styles.sideBlockText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.mainArea}>
            <View style={styles.topControls}>
              <View style={styles.searchBar}>
                <Feather name="search" size={20} color="#335E50" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search dashboard..."
                  placeholderTextColor="#7D9086"
                  value={searchValue}
                  onChangeText={setSearchValue}
                />
              </View>

              <TouchableOpacity
                style={styles.filterButton}
                onPress={() =>
                  setRangeLabel((current) => (current === "Week" ? "Month" : current === "Month" ? "Year" : "Week"))
                }
              >
                <Text style={styles.filterButtonText}>{rangeLabel}</Text>
                <Feather name="chevron-down" size={18} color="#111111" />
              </TouchableOpacity>
            </View>

            {renderSectionContent()}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7F6" },
  content: { paddingBottom: 24 },
  container: { width: "100%", maxWidth: 1460, alignSelf: "center", padding: 24 },
  containerCompact: { padding: 16 },
  layoutRow: { flexDirection: "row", flexWrap: "wrap", gap: 18, alignItems: "flex-start" },
  sidebar: { width: 250, gap: 14 },
  sideBlock: { paddingVertical: 28, paddingHorizontal: 18, borderRadius: 6, backgroundColor: "#08A967" },
  sideBlockActive: { backgroundColor: "#06774B" },
  sideBlockText: { fontSize: 17, fontWeight: "800", color: "#0C1612", textAlign: "center" },
  mainArea: { flex: 1, minWidth: 300, gap: 14 },
  topControls: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" },
  searchBar: {
    flex: 1,
    minWidth: 260,
    height: 54,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: "#06774B",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    fontSize: 15,
    color: "#214238",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7E2DC",
  },
  filterButtonText: { fontSize: 15, fontWeight: "700", color: "#111111" },
  sectionHeader: { paddingVertical: 16, paddingHorizontal: 20, borderRadius: 0, backgroundColor: "#4B4B4B" },
  sectionHeaderText: { fontSize: 28, fontWeight: "800", color: "#FFFFFF", fontStyle: "italic" },
  chartCard: { padding: 20, borderRadius: 24, backgroundColor: "#08A967" },
  chartTabs: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  chartTab: { fontSize: 16, fontWeight: "700", color: "#D7FFF0" },
  chartTabActive: { textDecorationLine: "underline", color: "#FFFFFF" },
  chartArea: { height: 260, marginTop: 18, borderRadius: 24, overflow: "hidden", position: "relative", backgroundColor: "rgba(255,255,255,0.14)" },
  chartShapeA: { position: "absolute", left: 0, right: 0, bottom: 0, height: 190, backgroundColor: "rgba(255,255,255,0.65)", borderTopLeftRadius: 160, borderTopRightRadius: 160 },
  chartShapeB: { position: "absolute", left: "30%", right: -30, top: 46, bottom: 0, backgroundColor: "rgba(255,255,255,0.35)", borderTopLeftRadius: 180, borderTopRightRadius: 120 },
  chartMarkerLine: { position: "absolute", left: "42%", top: 24, bottom: 18, width: 3, backgroundColor: "#0B8E59" },
  chartMarkerDot: { position: "absolute", left: "41.4%", top: 20, width: 14, height: 14, borderRadius: 7, backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: "#0B8E59" },
  daysRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginTop: 16, gap: 8 },
  dayWrap: { paddingVertical: 6, paddingHorizontal: 10 },
  dayPillActive: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "#0AA866" },
  dayText: { fontSize: 15, fontWeight: "700", color: "#0F1F19" },
  dayTextActive: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  tableCard: { borderWidth: 1, borderColor: "#1B1B1B", backgroundColor: "#FFFFFF" },
  tableHeader: { flexDirection: "row", backgroundColor: "#0B8E59" },
  tableHeaderCell: { paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, fontWeight: "700", color: "#FFFFFF", borderRightWidth: 1, borderRightColor: "#1B1B1B" },
  tableRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#1B1B1B" },
  tableCell: { paddingVertical: 14, paddingHorizontal: 10, fontSize: 13, color: "#1F1F1F", borderRightWidth: 1, borderRightColor: "#1B1B1B" },
  tableCellStrong: { paddingVertical: 14, paddingHorizontal: 10, fontSize: 13, fontWeight: "700", color: "#1F1F1F", borderRightWidth: 1, borderRightColor: "#1B1B1B" },
  nameCol: { width: 170 },
  emailCol: { width: 250 },
  phoneCol: { width: 180 },
  barangayCol: { flex: 1, minWidth: 260 },
  statusCol: { width: 140, borderRightWidth: 0 },
  cardsRow: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  managementCard: {
    flexGrow: 1,
    flexBasis: 290,
    maxWidth: 360,
    padding: 22,
    borderRadius: 18,
    backgroundColor: "#08A967",
    alignItems: "center",
  },
  avatarCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 10,
    borderColor: "#000000",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  managementName: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: "800",
    color: "#000000",
    fontStyle: "italic",
    textAlign: "center",
  },
  detailsCard: {
    width: "100%",
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  detailLine: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: "700",
    color: "#111111",
  },
  viewButton: {
    width: "70%",
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  viewButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111111",
  },
  vehicleRow: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  vehicleCard: {
    flexGrow: 1,
    flexBasis: 360,
    maxWidth: 520,
    padding: 24,
    borderRadius: 22,
    backgroundColor: "#08A967",
    alignItems: "center",
  },
  vehicleTitle: {
    fontSize: 34,
    fontWeight: "800",
    fontStyle: "italic",
    color: "#FFFFFF",
    textAlign: "center",
  },
  vehicleImageWrap: {
    width: "100%",
    minHeight: 300,
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: "#BDBDBD",
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleButton: {
    width: "58%",
    marginTop: 18,
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  vehicleButtonText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#08A967",
  },
  feedbackText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: "700",
    color: "#335E50",
  },
});
