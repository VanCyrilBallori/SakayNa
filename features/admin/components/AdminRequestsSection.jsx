import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import ListSkeleton from "../../../components/ui/ListSkeleton";
import AdminSectionHeader from "./AdminSectionHeader";
import { CORNER, DESIGN_COLORS, FONT, GREEN, NEUTRAL, ORANGE, RED } from "../../../constants/design";
import { formatDateTime } from "../../../lib/dates";
import { getWhenText } from "../../resident/utils/requestMapper";
import { getPurpose } from "../../resident/utils/requestOptions";
import { formatPlace } from "../../../lib/placeText";

// The colored band at the top of each card (DESIGN.md "Status band colors": orange has dark words, never red).
const STATUS_BANDS = {
  Pending: { icon: "timer-sand", backgroundColor: DESIGN_COLORS.sakayOrange, color: DESIGN_COLORS.ink },
  Assigned: { icon: "account-check-outline", backgroundColor: DESIGN_COLORS.hallGreenDeep, color: DESIGN_COLORS.paperWhite },
  "In Progress": { icon: "van-passenger", backgroundColor: DESIGN_COLORS.hallGreenDeep, color: DESIGN_COLORS.paperWhite },
  Completed: { icon: "check-circle-outline", backgroundColor: DESIGN_COLORS.inkMuted, color: DESIGN_COLORS.paperWhite },
  Cancelled: { icon: "cancel", backgroundColor: DESIGN_COLORS.inkMuted, color: DESIGN_COLORS.paperWhite },
};

const getStatusBand = (status) =>
  STATUS_BANDS[status] || { icon: "help-circle-outline", backgroundColor: DESIGN_COLORS.inkMuted, color: DESIGN_COLORS.paperWhite };

// The status pill on each card (DESIGN.md Style: status badges are tinted pills with the status word).
const STATUS_PILLS = {
  Pending: { icon: "timer-sand", backgroundColor: ORANGE[100], color: ORANGE[800] },
  Assigned: { icon: "account-check-outline", backgroundColor: GREEN[100], color: GREEN[800] },
  "In Progress": { icon: "van-passenger", backgroundColor: GREEN[100], color: GREEN[800] },
  Completed: { icon: "check-circle-outline", backgroundColor: NEUTRAL[100], color: NEUTRAL[700] },
  Cancelled: { icon: "cancel", backgroundColor: NEUTRAL[100], color: NEUTRAL[700] },
};

const getStatusPill = (status) => STATUS_PILLS[status] || { icon: "help-circle-outline", backgroundColor: NEUTRAL[100], color: NEUTRAL[700] };

// Cards per row: 3 on a very wide window, 2 on a wide one, 1 otherwise.
const getColumnCount = (width) => (width >= 1700 ? 3 : width >= 1100 ? 2 : 1);

// Splits the list into rows of `size` cards, so every card in a row is the same width and height.
const toRows = (items, size) => {
  const rows = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
};

const PURPOSE_ICONS = {
  "Medical / Health": "medical-bag",
  "Community Activity": "account-group-outline",
  Other: "dots-horizontal",
};

// Priority tag colors. Emergency is red with white words; Urgent is orange with dark words.
const PRIORITY_TAGS = {
  Emergency: { backgroundColor: DESIGN_COLORS.emergencyRed, color: DESIGN_COLORS.paperWhite },
  Urgent: { backgroundColor: DESIGN_COLORS.sakayOrange, color: DESIGN_COLORS.ink },
  Planned: { backgroundColor: DESIGN_COLORS.peachTint, color: DESIGN_COLORS.orangeDeep },
};

// The short reference the resident also sees, like "SKN-KQ7RB2LM".
const getReference = (request) => request.reference || `SKN-${request.id.slice(0, 8).toUpperCase()}`;

// One round choice. When it has a count, the count sits in a small bubble in front of the word.
function PillChoice({ label, selected, onPress, count, countColors }) {
  const hasCount = typeof count === "number";
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, hasCount && styles.pillWithCount, selected && styles.pillSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={hasCount ? `${label}, ${count}` : label}
    >
      {hasCount ? (
        <View style={[styles.countBubble, selected ? styles.countBubbleSelected : countColors && { backgroundColor: countColors.backgroundColor }]}>
          <Text style={[styles.countText, selected ? styles.countTextSelected : countColors && { color: countColors.color }]}>{count}</Text>
        </View>
      ) : null}
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

// One short request card (Task 3.19, DESIGN.md "Admin website exception"). The whole card is one button that opens
// the existing details pop-up; "View details" inside it is only words, so there is never a button inside a button.
// Emergency rides get a 2 px red edge and a red "Emergency" pill, like the dispatcher's queue.
function RequestCard({ request, onViewDetails }) {
  const status = request.status || "Pending";
  const statusPill = getStatusPill(status);
  // Old requests have no purpose; old Emergency requests count as emergencies too.
  const isOldEmergency = !request.purpose && request.requestTypeLabel === "Emergency Request";
  const isEmergency = request.priorityLabel === "Emergency" || isOldEmergency;
  const priorityTag = PRIORITY_TAGS[request.priorityLabel] || { backgroundColor: DESIGN_COLORS.boardTint, color: DESIGN_COLORS.ink };
  const name = request.residentName || "Resident";
  const vehicle = request.vehicleLabel === "Not assigned" ? "" : request.vehicleLabel;

  return (
    <Pressable
      onPress={() => onViewDetails(request)}
      style={({ pressed, hovered }) => [styles.card, isEmergency && styles.cardEmergency, (pressed || hovered) && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${isEmergency ? "Emergency. " : ""}${status} request from ${name}. View details`}
    >
      <View style={styles.topRow}>
        <View style={[styles.tag, { backgroundColor: statusPill.backgroundColor }]}>
          <MaterialCommunityIcons name={statusPill.icon} size={17} color={statusPill.color} />
          <Text style={[styles.tagText, { color: statusPill.color }]}>{status}</Text>
        </View>
        {isEmergency ? (
          <View style={[styles.tag, { backgroundColor: DESIGN_COLORS.emergencyRed }]}>
            <MaterialCommunityIcons name="ambulance" size={17} color={DESIGN_COLORS.paperWhite} />
            <Text style={[styles.tagText, { color: DESIGN_COLORS.paperWhite }]}>Emergency</Text>
          </View>
        ) : (
          <View style={[styles.tag, { backgroundColor: priorityTag.backgroundColor }]}>
            <Text style={[styles.tagText, { color: priorityTag.color }]}>{request.priorityLabel}</Text>
          </View>
        )}
        {isOldEmergency ? null : (
          <View style={styles.tag}>
            <MaterialCommunityIcons name={PURPOSE_ICONS[getPurpose(request)] || "dots-horizontal"} size={17} color={DESIGN_COLORS.ink} />
            <Text style={styles.tagText}>{request.purpose || request.requestTypeLabel}</Text>
          </View>
        )}
        <Text style={styles.reference}>{getReference(request)}</Text>
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {name}
        {request.barangay ? <Text style={styles.nameBarangay}> · {request.barangay}</Text> : null}
      </Text>

      {/* A short route board: "From" has a green ring, "To" an orange dot. One line each; the full text is in the details. */}
      <View style={styles.route}>
        <View style={styles.routeRow}>
          <View style={styles.fromRing} />
          <Text style={styles.place} numberOfLines={1}>
            {formatPlace(request.pickupLocation) || request.barangay || "Not available"}
          </Text>
        </View>
        <View style={styles.routeRow}>
          <View style={styles.toDot} />
          <Text style={styles.place} numberOfLines={1}>
            {request.destination || "Not available"}
          </Text>
        </View>
      </View>

      <Text style={styles.small}>
        {getWhenText(request)} · Driver: <Text style={styles.smallStrong}>{request.assignedDriverName || "not assigned yet"}</Text>
        {vehicle ? ` · ${vehicle}` : ""}
      </Text>

      <View style={styles.footer}>
        <Text style={[styles.small, styles.footerDate]}>
          Sent {formatDateTime(request.createdAt)}
          {request.completedAt ? ` · Completed ${formatDateTime(request.completedAt)}` : ""}
        </Text>
        <View style={styles.viewDetails}>
          <Text style={styles.viewDetailsText}>View details</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={DESIGN_COLORS.hallGreen} />
        </View>
      </View>
    </Pressable>
  );
}

export default function AdminRequestsSection({
  requests,
  requestTypeFilters,
  requestTypeFilter,
  setRequestTypeFilter,
  requestStatusFilters,
  requestStatusFilter,
  setRequestStatusFilter,
  isLoadingRequests,
  filteredRequests,
  requestsError,
  setSelectedRequestRecord,
  atLimit,
  collectionLimit,
}) {
  const { width } = useWindowDimensions();
  const columns = getColumnCount(width);

  // The status counts follow the "Ride for" choice, so the numbers match what you will see.
  const requestsForPurpose = requests.filter((request) => requestTypeFilter === "All" || getPurpose(request) === requestTypeFilter);
  const countFor = (status) =>
    status === "All" ? requestsForPurpose.length : requestsForPurpose.filter((request) => (request.status || "Pending") === status).length;

  return (
    <View style={styles.page}>
      <AdminSectionHeader
        icon="clipboard-list-outline"
        title="Requests"
        subtitle="Every ride request from residents, newest first. Click a request to see the passenger, help needed and all times."
      />

      <View style={styles.filters}>
        <View style={styles.filterGroup}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.pills}>
            {requestStatusFilters.map((status) => {
              const band = status === "All" ? null : getStatusBand(status);
              return (
                <PillChoice
                  key={status}
                  label={status}
                  count={countFor(status)}
                  countColors={band}
                  selected={requestStatusFilter === status}
                  onPress={() => setRequestStatusFilter(status)}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.label}>Ride for</Text>
          <View style={styles.pills}>
            {requestTypeFilters.map((type) => (
              <PillChoice key={type} label={type} selected={requestTypeFilter === type} onPress={() => setRequestTypeFilter(type)} />
            ))}
          </View>
        </View>
      </View>

      {isLoadingRequests ? (
        <ListSkeleton label="Loading request history" />
      ) : filteredRequests.length ? (
        <View style={styles.grid}>
          {toRows(filteredRequests, columns).map((row) => (
            <View key={row[0].id} style={styles.gridRow}>
              {row.map((request) => (
                <View key={request.id} style={styles.gridCell}>
                  <RequestCard request={request} onViewDetails={setSelectedRequestRecord} />
                </View>
              ))}
              {/* Empty places keep the last row's cards the same width as the others. */}
              {Array.from({ length: columns - row.length }, (_, index) => (
                <View key={`empty-${index}`} style={styles.gridCell} />
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.label}>No requests match these filters.</Text>
          <Text style={styles.small}>{requestsError || "Choose All under Status or Ride for to see more."}</Text>
        </View>
      )}

      {atLimit ? <Text style={styles.small}>Showing the latest {collectionLimit} requests. Older ones are not loaded.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: "100%", gap: 12 },
  body: { fontFamily: FONT.regular, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.ink },
  label: { fontSize: 17, lineHeight: 22, fontFamily: FONT.bold, color: DESIGN_COLORS.ink },
  small: { fontFamily: FONT.regular, fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.inkMuted },

  smallStrong: { fontFamily: FONT.semiBold, color: DESIGN_COLORS.ink },

  // Pill-shaped choices, like the range choices on Overview. 40 tall: filter chips on the Admin website
  // (DESIGN.md "Admin website exception").
  filters: { flexDirection: "row", flexWrap: "wrap", columnGap: 32, rowGap: 12 },
  filterGroup: { gap: 6, flexShrink: 1 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  pillWithCount: { paddingLeft: 6 },
  pillSelected: { borderColor: DESIGN_COLORS.hallGreen, backgroundColor: DESIGN_COLORS.hallGreen },
  pillText: { fontSize: 17, fontFamily: FONT.semiBold, color: DESIGN_COLORS.ink },
  pillTextSelected: { color: DESIGN_COLORS.paperWhite },
  countBubble: { minWidth: 28, height: 28, paddingHorizontal: 7, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: DESIGN_COLORS.boardTint },
  countBubbleSelected: { backgroundColor: DESIGN_COLORS.paperWhite },
  countText: { fontSize: 15, fontFamily: FONT.bold, color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },
  countTextSelected: { color: DESIGN_COLORS.hallGreenDeep },

  // Rows of equal cards: every card in a row has the same width and height.
  grid: { gap: 12 },
  gridRow: { flexDirection: "row", gap: 12, alignItems: "stretch" },
  gridCell: { flex: 1, minWidth: 0 },
  // A short card: white, 16 corners, a thin edge (DESIGN.md Style). Emergency: a 2 px red edge, like the dispatcher's queue.
  card: { flex: 1, gap: 8, padding: 14, borderRadius: CORNER.card, borderWidth: 1, borderColor: NEUTRAL[200], backgroundColor: DESIGN_COLORS.paperWhite },
  cardEmergency: { borderWidth: 2, borderColor: RED[600] },
  cardPressed: { backgroundColor: NEUTRAL[50] },

  topRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, backgroundColor: DESIGN_COLORS.boardTint },
  tagText: { fontSize: 15, lineHeight: 20, fontFamily: FONT.bold, color: DESIGN_COLORS.ink },
  reference: { marginLeft: "auto", fontSize: 15, lineHeight: 20, fontFamily: FONT.medium, color: DESIGN_COLORS.inkMuted, fontVariant: ["tabular-nums"] },

  name: { fontSize: 17, lineHeight: 22, fontFamily: FONT.bold, color: DESIGN_COLORS.ink },
  nameBarangay: { fontFamily: FONT.regular, color: DESIGN_COLORS.inkMuted },

  route: { gap: 2 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fromRing: { width: 12, height: 12, borderRadius: 999, borderWidth: 3, borderColor: DESIGN_COLORS.hallGreen, backgroundColor: DESIGN_COLORS.paperWhite },
  toDot: { width: 12, height: 12, borderRadius: 999, backgroundColor: DESIGN_COLORS.sakayOrange },
  place: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20, fontFamily: FONT.semiBold, color: DESIGN_COLORS.ink },

  // The last line sits at the bottom of the card, so cards of different lengths in one row still line up.
  footer: { marginTop: "auto", flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 12, rowGap: 4 },
  footerDate: { flexShrink: 1 },
  viewDetails: { flexDirection: "row", alignItems: "center", gap: 2 },
  viewDetailsText: { fontSize: 15, lineHeight: 20, fontFamily: FONT.semiBold, color: GREEN[700] },

  emptyState: { padding: 20, borderRadius: CORNER.card, alignItems: "center", gap: 8, backgroundColor: DESIGN_COLORS.boardTint },
});
