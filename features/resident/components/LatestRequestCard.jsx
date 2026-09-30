import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS } from "../../../constants/design";
import { getPickupLabel, getRequestStatusMeta, getWhenText } from "../utils/requestMapper";

// Light pill colors in Light and Dark mode on purpose (the same pills as Request History and Details).
const PILL_COLORS = {
  danger: { backgroundColor: COLORS.emergencySurface, color: "#7A1A12" },
  success: { backgroundColor: "#E7F5ED", color: "#0B5A38" },
  warning: { backgroundColor: COLORS.warningSurface, color: "#5C3F00" },
};

// The resident's newest request, on the home screen's bottom sheet. Tapping it opens Request Details.
// request = the newest request (null if there is none), loading / error = from useResidentRequests.
export default function LatestRequestCard({ request, loading, error, theme, onPress }) {
  if (loading || error || !request) {
    const message = loading ? "Loading your latest request…" : error || "No rides yet. Your latest request will show here.";
    return (
      <View style={[styles.card, styles.emptyCard, { borderColor: theme.border }]}>
        <Text style={[styles.emptyText, { color: theme.mutedText }]}>{message}</Text>
      </View>
    );
  }

  const status = getRequestStatusMeta(request.status);
  const pill = PILL_COLORS[status.tone] || PILL_COLORS.warning;
  const title = request.title || request.serviceType || "Transport request";
  const driverLine = request.assignedDriverName ? [request.assignedDriverName, request.assignedVehicleName].filter(Boolean).join(" · ") : "";

  return (
    <Pressable
      style={({ pressed }) => [styles.card, { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceMuted : theme.surface }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Latest request: ${title}, ${status.label}. Open details.`}
    >
      <View style={styles.topRow}>
        <View style={[styles.pill, { backgroundColor: pill.backgroundColor }]}>
          <Text style={[styles.pillText, { color: pill.color }]}>{status.label}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={28} color={theme.mutedText} />
      </View>

      <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
        {title}
      </Text>

      <InfoLine icon="clock-outline" text={getWhenText(request)} theme={theme} />
      <InfoLine icon="map-marker-outline" text={getPickupLabel(request)} theme={theme} />
      {driverLine ? <InfoLine icon="car-outline" text={driverLine} theme={theme} /> : null}
    </Pressable>
  );
}

function InfoLine({ icon, text, theme }) {
  return (
    <View style={styles.infoLine}>
      <MaterialCommunityIcons name={icon} size={20} color={theme.mutedText} />
      <Text style={[styles.infoText, { color: theme.mutedText }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16, borderWidth: 1 },
  emptyCard: { borderStyle: "dashed" },
  emptyText: { fontSize: 16, lineHeight: 22 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  pillText: { fontSize: 14, fontWeight: "800" },
  title: { marginTop: 10, marginBottom: 4, fontSize: 19, lineHeight: 25, fontWeight: "800" },
  infoLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  infoText: { flex: 1, fontSize: 16, lineHeight: 22 },
});
