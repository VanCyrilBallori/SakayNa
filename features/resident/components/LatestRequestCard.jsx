import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { REQUEST_STATUSES } from "../../../constants/app";
import { DESIGN_COLORS } from "../../../constants/design";
import { getDestinationLabel, getPickupLabel, getRequestStatusMeta, getWhenText } from "../utils/requestMapper";

// The color of the status band at the top of the card (DESIGN.md "Status band").
// Waiting = amber, a driver is on it = deep green, finished = grey. Never red: red is only for emergencies.
const BAND_COLORS = {
  [REQUEST_STATUSES.PENDING]: DESIGN_COLORS.waitingAmber,
  [REQUEST_STATUSES.ASSIGNED]: DESIGN_COLORS.hallGreenDeep,
  [REQUEST_STATUSES.IN_PROGRESS]: DESIGN_COLORS.hallGreenDeep,
};

// The resident's newest request, on the home screen's bottom sheet. Tapping it opens Request Details.
// request = the newest request (null if there is none), loading / error = from useResidentRequests.
export default function LatestRequestCard({ request, loading, error, onPress }) {
  if (error) {
    return (
      <View style={[styles.messageBox, styles.errorBox]}>
        <Text style={[styles.messageText, styles.errorText]}>{error}</Text>
      </View>
    );
  }

  if (loading || !request) {
    return (
      <View style={styles.messageBox}>
        <Text style={styles.messageText}>{loading ? "Loading your latest request…" : "No rides yet. Your latest request will show here."}</Text>
      </View>
    );
  }

  const status = getRequestStatusMeta(request.status);
  const bandColor = BAND_COLORS[request.status] || DESIGN_COLORS.inkMuted;
  const from = getPickupLabel(request);
  const to = getDestinationLabel(request);
  // Small line at the bottom: when, then who is driving and which vehicle (DESIGN.md "Named Place Rule").
  const bottomLine = [getWhenText(request), request.assignedDriverName, request.assignedVehicleName].filter(Boolean).join(" · ");

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Latest request: ${status.label}. From ${from}. To ${to}. ${bottomLine}. Open details.`}
    >
      <View style={[styles.band, { backgroundColor: bandColor }]}>
        <Text style={styles.bandText}>{status.label}</Text>
        <MaterialCommunityIcons name="chevron-right" size={26} color="#FFFFFF" />
      </View>

      {/* Route board: From and To like a jeepney signboard, joined by a short green line. */}
      <View style={styles.body}>
        <RouteLine label="From" place={from} />
        <View style={styles.routeJoin} />
        <RouteLine label="To" place={to} />

        <Text style={styles.bottomLine}>{bottomLine}</Text>
      </View>
    </Pressable>
  );
}

// One line of the route board. Long places wrap to 2 lines; the full address is in Request Details.
function RouteLine({ label, place }) {
  return (
    <View style={styles.routeLine}>
      <Text style={styles.routeLabel}>{label}</Text>
      <Text style={styles.routePlace} numberOfLines={2}>
        {place}
      </Text>
    </View>
  );
}

// "From" and "To" share one column width, so the place names line up.
const LABEL_WIDTH = 52;

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
    // Keeps the band's corners inside the card's rounded corners.
    overflow: "hidden",
  },
  cardPressed: { backgroundColor: DESIGN_COLORS.boardTint },
  band: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingLeft: 14, paddingRight: 8, paddingVertical: 8 },
  bandText: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: "800", color: "#FFFFFF" },
  body: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  routeLine: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  routeLabel: { width: LABEL_WIDTH, fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.inkMuted },
  // "Title" size (22). We may try 17 after testing on a small phone.
  routePlace: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.ink },
  // The short green line between From and To, under the place names' left edge.
  routeJoin: { width: 2, height: 14, marginLeft: LABEL_WIDTH + 8 + 6, marginVertical: 2, backgroundColor: DESIGN_COLORS.hallGreen },
  bottomLine: { marginTop: 10, fontSize: 15, lineHeight: 20, fontWeight: "500", color: DESIGN_COLORS.inkMuted },
  messageBox: { padding: 16, borderRadius: 8, backgroundColor: DESIGN_COLORS.boardTint },
  messageText: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted },
  errorBox: { backgroundColor: DESIGN_COLORS.redTint },
  errorText: { color: DESIGN_COLORS.emergencyRed },
});
