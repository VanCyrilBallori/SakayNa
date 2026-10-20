import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";

import FeedbackMessage from "../../../components/ui/FeedbackMessage";
import ListSkeleton from "../../../components/ui/ListSkeleton";
import { CORNER, FONT, GREEN, NEUTRAL, ORANGE, SHADOW } from "../../../constants/design";
import { canResidentCancel, formatRequestDate, getPickupLabel, getRequestStatusMeta, getScheduledDate, getStatusBadgeColors, getWhenText } from "../utils/requestMapper";
import { getPurpose, PURPOSE_OPTIONS } from "../utils/requestOptions";
import ResidentRequestDetails from "./ResidentRequestDetails";

const statusOptions = [{ label: "All statuses", value: "All" }, { label: "Active", value: "Active" }, { label: "Completed", value: "Completed" }, { label: "Cancelled", value: "Cancelled" }, { label: "Pending", value: "Pending" }, { label: "Assigned", value: "Assigned" }, { label: "In progress", value: "In Progress" }];
// Filter by what the ride is for. Old requests (before the new form) have no purpose, so they show under "All" only.
const purposeOptions = [{ label: "All rides", value: "All" }, ...PURPOSE_OPTIONS.map((purpose) => ({ label: purpose, value: purpose }))];
const isActive = (status) => ["Pending", "Assigned", "In Progress"].includes(status || "Pending");

// The driver's History tab uses this same page (forDriver). A driver's ride has its own steps, so it has its own status list.
const DRIVER_ACTIVE = ["Assigned", "Accepted", "En Route", "Arrived", "Picked Up"];
const driverStatusOptions = [{ label: "All statuses", value: "All" }, { label: "Active", value: "Active" }, { label: "Completed", value: "Completed" }, { label: "Can't do", value: "Unable" }, { label: "Cancelled", value: "Cancelled" }];
// The words on the driver's status pill. Any other status shows as it is saved (Assigned, Accepted, Arrived, Completed...).
const DRIVER_STATUS_WORDS = { "En Route": "En route", "Picked Up": "Picked up", Unable: "Can't do" };

// The History page of the resident's bottom bar (Task 3.18; before, a pop-up from the ☰ menu).
// The newest 50 requests with filters and a search. Tapping one opens its Request Details.
// forDriver = the driver's History tab: the driver's own rides, driver words, and no tapping (no details pop-up).
export default function ResidentRequestHistory({ requests, loading, error, forDriver = false }) {
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  // The title always stays at the top while the list scrolls under it. The filters and search stay there too,
  // unless the screen is short or the text is very big; then they scroll with the list, so the list keeps room.
  const { height, fontScale } = useWindowDimensions();
  const fixedFilters = height >= 640 && fontScale <= 1.3;

  const filteredRequests = useMemo(() => requests.filter((request) => {
    const active = forDriver ? DRIVER_ACTIVE.includes(request.status) : isActive(request.status);
    const matchesStatus = statusFilter === "All" || (statusFilter === "Active" ? active : request.status === statusFilter);
    const matchesType = typeFilter === "All" || getPurpose(request) === typeFilter;
    const query = search.trim().toLowerCase();
    return matchesStatus && matchesType && (!query || request.reference.toLowerCase().includes(query) || request.id.toLowerCase().includes(query));
  }), [forDriver, requests, search, statusFilter, typeFilter]);

  const filters = (
    <>
      <View style={styles.filters}>
        <Dropdown fontFamily={FONT.regular} style={styles.filter} selectedTextStyle={styles.filterText} itemTextStyle={styles.filterText} data={forDriver ? driverStatusOptions : statusOptions} labelField="label" valueField="value" value={statusFilter} onChange={(item) => setStatusFilter(item.value)} accessibilityLabel="Filter by status" />
        <Dropdown fontFamily={FONT.regular} style={styles.filter} selectedTextStyle={styles.filterText} itemTextStyle={styles.filterText} data={purposeOptions} labelField="label" valueField="value" value={typeFilter} onChange={(item) => setTypeFilter(item.value)} accessibilityLabel="Filter by ride" />
      </View>
      <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search request reference" placeholderTextColor={NEUTRAL[600]} autoCapitalize="characters" />
    </>
  );

  return (
    <View style={styles.page}>
      {/* Fixed header: does not scroll. */}
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">{forDriver ? "Ride history" : "Request history"}</Text>
        {fixedFilters ? filters : null}
      </View>

      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {fixedFilters ? null : filters}
        {error ? <FeedbackMessage message={error} tone="error" /> : null}

        <View style={styles.list}>
          {loading ? (
            <ListSkeleton label={forDriver ? "Loading your rides" : "Loading your requests"} />
          ) : filteredRequests.length ? (
            filteredRequests.map((request) => <HistoryRow key={request.id} request={request} forDriver={forDriver} onPress={() => setSelected(request)} />)
          ) : (
            // Empty state (DESIGN.md Style): an icon in a tinted circle, a title and one sentence.
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <MaterialCommunityIcons name={requests.length ? "filter-variant-remove" : "van-passenger"} size={48} color={GREEN[700]} />
              </View>
              <Text style={styles.emptyTitle}>{requests.length ? "No matching requests" : "No rides yet"}</Text>
              <Text style={styles.emptyText}>{requests.length ? "Try a different status or ride filter." : forDriver ? "Rides dispatch gives you will show here." : "When you request a ride, it will show here."}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {forDriver ? null : <ResidentRequestDetails request={selected} visible={Boolean(selected)} onClose={() => setSelected(null)} />}
    </View>
  );
}

// One request: reference and status badge, what it is for, when, where, and when it was sent.
// For a driver: the same card, but it can't be tapped (no arrow), and it says when the ride was assigned.
function HistoryRow({ request, forDriver, onPress }) {
  const statusLabel = forDriver ? DRIVER_STATUS_WORDS[request.status] || request.status : getRequestStatusMeta(request.status).label;
  // Driver pill colors: a ride still going = green, a finished one = grey (the resident's colors for the same meaning).
  const badge = forDriver ? getStatusBadgeColors(DRIVER_ACTIVE.includes(request.status) ? "Assigned" : "Completed") : getStatusBadgeColors(request.status);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && !forDriver && styles.rowPressed]}
      onPress={forDriver ? undefined : onPress}
      disabled={forDriver}
      accessibilityRole={forDriver ? undefined : "button"}
      accessibilityLabel={forDriver ? undefined : `View ${request.reference}, ${statusLabel}`}
    >
      <View style={styles.rowCopy}>
        <View style={styles.rowTop}>
          <Text style={styles.reference}>{request.reference}</Text>
          <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{statusLabel}</Text>
          </View>
        </View>
        <Text style={styles.rowTitle}>{request.title || request.serviceType || "Transport request"}</Text>
        {getScheduledDate(request) ? <Text style={styles.scheduled}>Scheduled: {getWhenText(request)}</Text> : null}
        <Text style={styles.meta}>{getPickupLabel(request)}</Text>
        <Text style={styles.meta}>{forDriver ? "Assigned" : "Sent"} {formatRequestDate(request.createdAt)}</Text>
        {!forDriver && canResidentCancel(request) ? <Text style={styles.cancelHint}>You can still cancel this request</Text> : null}
      </View>
      {forDriver ? null : <MaterialCommunityIcons name="chevron-right" size={24} color={NEUTRAL[700]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  // The fixed header: a thin line under it shows where the list scrolls.
  header: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: NEUTRAL[200] },
  content: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  title: { fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: NEUTRAL[900] },
  // Filters and search (DESIGN.md Style: inputs have 12 corners and a 1.5 neutral-500 edge, at least 48 tall).
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  filter: { flexGrow: 1, flexBasis: 150, minHeight: 48, paddingHorizontal: 12, borderWidth: 1.5, borderColor: NEUTRAL[500], borderRadius: CORNER.input, backgroundColor: NEUTRAL[0] },
  filterText: { fontSize: 17, color: NEUTRAL[900] },
  search: { minHeight: 48, marginTop: 8, paddingHorizontal: 14, borderWidth: 1.5, borderColor: NEUTRAL[500], borderRadius: CORNER.input, backgroundColor: NEUTRAL[0], fontSize: 17, fontFamily: FONT.regular, color: NEUTRAL[900] },
  list: { marginTop: 12, gap: 12 },
  // A white card with 16 corners, a thin edge and a Level 1 shadow (DESIGN.md Style).
  row: { flexDirection: "row", alignItems: "center", gap: 8, padding: 16, borderRadius: CORNER.card, borderWidth: 1, borderColor: NEUTRAL[200], backgroundColor: NEUTRAL[0], ...SHADOW.level1 },
  rowPressed: { backgroundColor: NEUTRAL[100] },
  rowCopy: { flex: 1 },
  rowTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  reference: { fontSize: 15, lineHeight: 20, fontFamily: FONT.semiBold, color: NEUTRAL[700] },
  // Status badge: a pill with the status word (DESIGN.md Style).
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: CORNER.pill },
  badgeText: { fontSize: 15, lineHeight: 20, fontFamily: FONT.semiBold },
  rowTitle: { marginTop: 8, fontSize: 17, lineHeight: 22, fontFamily: FONT.bold, color: NEUTRAL[900] },
  scheduled: { marginTop: 4, fontSize: 15, lineHeight: 20, fontFamily: FONT.bold, color: ORANGE[700] },
  meta: { marginTop: 4, fontSize: 15, lineHeight: 20, fontFamily: FONT.medium, color: NEUTRAL[700] },
  cancelHint: { marginTop: 8, fontSize: 15, lineHeight: 20, fontFamily: FONT.semiBold, color: ORANGE[700] },
  empty: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 16 },
  emptyIcon: { width: 96, height: 96, borderRadius: CORNER.pill, alignItems: "center", justifyContent: "center", backgroundColor: GREEN[50] },
  emptyTitle: { marginTop: 16, fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: NEUTRAL[900], textAlign: "center" },
  emptyText: { marginTop: 4, fontSize: 17, lineHeight: 24, fontFamily: FONT.regular, color: NEUTRAL[700], textAlign: "center" },
});
