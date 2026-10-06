import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { DESIGN_COLORS } from "../../../constants/design";
import { formatDateTime } from "../../../lib/dates";
import { getWhenText } from "../../resident/utils/requestMapper";

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

const PURPOSE_ICONS = {
  "Medical / Health": "medical-bag",
  "Community / Personal Trip": "account-group-outline",
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

function Fact({ icon, label, value, fallback }) {
  return (
    <View style={styles.fact}>
      <View style={styles.factLabelRow}>
        <MaterialCommunityIcons name={icon} size={17} color={DESIGN_COLORS.hallGreen} />
        <Text style={styles.small}>{label}</Text>
      </View>
      <Text style={[styles.factValue, !value && styles.factValueEmpty]}>{value || fallback}</Text>
    </View>
  );
}

function RequestCard({ request, onViewDetails, half, narrow }) {
  const status = request.status || "Pending";
  const band = getStatusBand(status);
  // Old requests have no purpose; they show their old type (red only for old Emergency requests).
  const isOldEmergency = !request.purpose && request.requestTypeLabel === "Emergency Request";
  const priorityTag = PRIORITY_TAGS[request.priorityLabel] || { backgroundColor: DESIGN_COLORS.boardTint, color: DESIGN_COLORS.ink };

  return (
    <View style={[styles.card, half && styles.cardHalf]}>
      <View style={[styles.band, { backgroundColor: band.backgroundColor }]}>
        <MaterialCommunityIcons name={band.icon} size={26} color={band.color} />
        <Text style={[styles.bandText, { color: band.color }]}>{status}</Text>
        {narrow ? null : <Text style={[styles.bandReference, { color: band.color }]}>{getReference(request)}</Text>}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.who}>
          <Text style={styles.name}>{request.residentName || "Resident"}</Text>
          <View style={styles.tags}>
            {isOldEmergency ? (
              <View style={[styles.tag, { backgroundColor: DESIGN_COLORS.redTint }]}>
                <MaterialCommunityIcons name="ambulance" size={17} color={DESIGN_COLORS.emergencyRed} />
                <Text style={[styles.tagText, { color: DESIGN_COLORS.emergencyRed }]}>Emergency Request</Text>
              </View>
            ) : (
              <View style={styles.tag}>
                <MaterialCommunityIcons name={PURPOSE_ICONS[request.purpose] || "dots-horizontal"} size={17} color={DESIGN_COLORS.ink} />
                <Text style={styles.tagText}>{request.purpose || request.requestTypeLabel}</Text>
              </View>
            )}
            <View style={[styles.tag, { backgroundColor: priorityTag.backgroundColor }]}>
              <Text style={[styles.tagText, { color: priorityTag.color }]}>{request.priorityLabel}</Text>
            </View>
          </View>
          {request.title || request.emergencyType ? <Text style={styles.small}>{request.title || request.emergencyType}</Text> : null}
          {narrow ? <Text style={styles.small}>{getReference(request)}</Text> : null}
        </View>

        {/* Route board: "From" has a green ring, "To" has an orange dot, joined by a green line. */}
        <View>
          <View style={styles.routeRow}>
            <View style={styles.routeMarks}>
              <View style={styles.fromRing} />
              <View style={styles.routeLine} />
            </View>
            <View style={styles.routeStop}>
              <Text style={styles.small}>From</Text>
              <Text style={styles.place}>{request.pickupLocation || request.barangay || "Not available"}</Text>
            </View>
          </View>
          <View style={styles.routeRow}>
            <View style={styles.routeMarks}>
              <View style={styles.toDot} />
            </View>
            <View style={styles.routeStop}>
              <Text style={styles.small}>To</Text>
              <Text style={styles.place}>{request.destination || "Not available"}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.facts, narrow && styles.factsStacked]}>
          <Fact icon="calendar-clock" label="When" value={getWhenText(request)} />
          <Fact icon="steering" label="Driver" value={request.assignedDriverName} fallback="Not assigned yet" />
          <Fact
            icon="van-passenger"
            label="Vehicle"
            value={request.vehicleLabel === "Not assigned" ? "" : request.vehicleLabel}
            fallback="Not assigned yet"
          />
        </View>

        <View style={styles.footer}>
          <View style={styles.footerDates}>
            <Text style={styles.small}>Sent {formatDateTime(request.createdAt)}</Text>
            {request.completedAt ? <Text style={styles.small}>Completed {formatDateTime(request.completedAt)}</Text> : null}
          </View>
          <Pressable
            onPress={() => onViewDetails(request)}
            style={({ pressed }) => [styles.button, narrow && styles.buttonFull, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel={`View details for ${request.residentName || "this request"}`}
          >
            <Text style={styles.buttonText}>View details</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={DESIGN_COLORS.paperWhite} />
          </Pressable>
        </View>
      </View>
    </View>
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
  // Two cards side by side on a big screen, one card per row on a smaller one.
  const twoColumns = width >= 1100;
  const narrow = width < 520;

  // The status counts follow the "Ride for" choice, so the numbers match what you will see.
  const requestsForPurpose = requests.filter((request) => requestTypeFilter === "All" || request.purpose === requestTypeFilter);
  const countFor = (status) =>
    status === "All" ? requestsForPurpose.length : requestsForPurpose.filter((request) => (request.status || "Pending") === status).length;

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <MaterialCommunityIcons name="van-passenger" size={24} color={DESIGN_COLORS.paperWhite} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Requests</Text>
          <Text style={styles.subtitle}>
            Every ride request from residents, newest first. Tap View details to see the passenger, help needed and all times.
          </Text>
        </View>
      </View>

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
        <View style={styles.emptyState}>
          <ActivityIndicator color={DESIGN_COLORS.hallGreen} />
          <Text style={styles.body}>Loading request history...</Text>
        </View>
      ) : filteredRequests.length ? (
        <View style={[styles.grid, twoColumns && styles.gridTwo]}>
          {filteredRequests.map((request) => (
            <RequestCard key={request.id} request={request} onViewDetails={setSelectedRequestRecord} half={twoColumns} narrow={narrow} />
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
  page: { width: "100%", gap: 16, padding: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerBadge: { width: 48, height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: DESIGN_COLORS.hallGreen },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: DESIGN_COLORS.ink },
  subtitle: { marginTop: 2, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted },
  body: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.ink },
  label: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  small: { fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.inkMuted },

  // Pill-shaped choices, like the range choices on Overview.
  filters: { flexDirection: "row", flexWrap: "wrap", columnGap: 32, rowGap: 16 },
  filterGroup: { gap: 8, flexShrink: 1 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  pillWithCount: { paddingLeft: 8 },
  pillSelected: { borderColor: DESIGN_COLORS.hallGreen, backgroundColor: DESIGN_COLORS.hallGreen },
  pillText: { fontSize: 17, fontWeight: "600", color: DESIGN_COLORS.ink },
  pillTextSelected: { color: DESIGN_COLORS.paperWhite },
  countBubble: { minWidth: 32, height: 32, paddingHorizontal: 8, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: DESIGN_COLORS.boardTint },
  countBubbleSelected: { backgroundColor: DESIGN_COLORS.paperWhite },
  countText: { fontSize: 15, fontWeight: "800", color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },
  countTextSelected: { color: DESIGN_COLORS.hallGreenDeep },

  grid: { gap: 16 },
  gridTwo: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
  // Cards: 24 corners, a thin line around, no shadow (DESIGN.md "Flat Board Rule").
  card: { width: "100%", borderRadius: 24, borderWidth: 1, borderColor: DESIGN_COLORS.rule, overflow: "hidden", backgroundColor: DESIGN_COLORS.paperWhite },
  cardHalf: { width: "48.5%" },
  band: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 18 },
  bandText: { flexShrink: 1, fontSize: 22, lineHeight: 28, fontWeight: "800" },
  bandReference: { marginLeft: "auto", fontSize: 15, lineHeight: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
  cardBody: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 18, gap: 14 },

  who: { gap: 8 },
  name: { fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.ink },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, backgroundColor: DESIGN_COLORS.boardTint },
  tagText: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.ink },

  routeRow: { flexDirection: "row", gap: 12 },
  routeMarks: { width: 22, alignItems: "center", paddingTop: 4 },
  fromRing: { width: 16, height: 16, borderRadius: 999, borderWidth: 4, borderColor: DESIGN_COLORS.hallGreen, backgroundColor: DESIGN_COLORS.paperWhite },
  routeLine: { flex: 1, width: 3, minHeight: 16, marginVertical: 3, borderRadius: 2, backgroundColor: DESIGN_COLORS.hallGreen },
  toDot: { width: 16, height: 16, borderRadius: 999, backgroundColor: DESIGN_COLORS.sakayOrange },
  routeStop: { flex: 1, minWidth: 0, paddingBottom: 10 },
  place: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },

  // A soft box, not a card inside a card: no border, just Board Tint.
  facts: { flexDirection: "row", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: DESIGN_COLORS.boardTint },
  factsStacked: { flexDirection: "column" },
  fact: { flex: 1, minWidth: 0, gap: 2 },
  factLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  factValue: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.ink },
  factValueEmpty: { fontWeight: "500", color: DESIGN_COLORS.inkMuted },

  footer: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 },
  footerDates: { flexShrink: 1 },
  button: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: DESIGN_COLORS.hallGreen,
  },
  buttonFull: { width: "100%" },
  buttonPressed: { backgroundColor: DESIGN_COLORS.hallGreenDeep },
  buttonText: { fontSize: 17, fontWeight: "700", color: DESIGN_COLORS.paperWhite },

  emptyState: { padding: 20, borderRadius: 24, alignItems: "center", gap: 8, backgroundColor: DESIGN_COLORS.boardTint },
});
