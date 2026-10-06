import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { DESIGN_COLORS } from "../../../constants/design";
import { formatDateTime, getDurationLabel } from "../../../lib/dates";

// The colored pill for each call status (DESIGN.md: red only for "No answer", orange has dark words).
const STATUS_PILLS = {
  stale: { label: "No answer", backgroundColor: DESIGN_COLORS.emergencyRed, color: DESIGN_COLORS.paperWhite },
  ringing: { label: "Ringing", backgroundColor: DESIGN_COLORS.sakayOrange, color: DESIGN_COLORS.ink },
  connected: { label: "Connected", backgroundColor: DESIGN_COLORS.hallGreenDeep, color: DESIGN_COLORS.paperWhite },
  declined: { label: "Declined", backgroundColor: DESIGN_COLORS.inkMuted, color: DESIGN_COLORS.paperWhite },
  ended: { label: "Ended", backgroundColor: DESIGN_COLORS.inkMuted, color: DESIGN_COLORS.paperWhite },
  cancelled: { label: "Cancelled by resident", backgroundColor: DESIGN_COLORS.inkMuted, color: DESIGN_COLORS.paperWhite },
};

const getStatusPill = (call) => {
  if (call.isStaleRinging) {
    return STATUS_PILLS.stale;
  }

  return STATUS_PILLS[call.status] || { label: call.status || "Unknown", backgroundColor: DESIGN_COLORS.inkMuted, color: DESIGN_COLORS.paperWhite };
};

// The small counts at the top: how many calls have each status.
const COUNT_CHIPS = [
  { key: "stale", label: "No answer", test: (call) => call.isStaleRinging },
  { key: "ringing", label: "Ringing", test: (call) => call.status === "ringing" && !call.isStaleRinging },
  { key: "connected", label: "Connected", test: (call) => call.status === "connected" },
  { key: "ended", label: "Ended", test: (call) => call.status === "ended" },
  { key: "cancelled", label: "Cancelled by resident", test: (call) => call.status === "cancelled" },
];

// A call nobody answered: a red box at the top with the resident's phone, so the Admin can follow up.
function UnansweredCallBox({ call }) {
  return (
    <View style={styles.alarm}>
      <View style={styles.alarmBand}>
        <MaterialCommunityIcons name="alert-circle-outline" size={26} color={DESIGN_COLORS.paperWhite} />
        <Text style={styles.alarmBandText}>
          No answer for {typeof call.waitingMs === "number" ? getDurationLabel(call.waitingMs) : "over 30 sec"}
        </Text>
      </View>
      <View style={styles.alarmBody}>
        <View style={styles.alarmWho}>
          <Text style={styles.alarmName}>{call.residentName || "Resident"}</Text>
          <Text style={styles.body}>
            {call.pickupLocation || "Barangay not available"} · started {formatDateTime(call.createdAt)}
          </Text>
        </View>
        <View style={styles.phoneBox}>
          <Text style={styles.small}>{"Resident's phone"}</Text>
          <Text style={styles.phoneText} selectable>
            {call.residentPhone || "Not provided"}
          </Text>
        </View>
      </View>
      <Text style={styles.alarmMessage}>No dispatcher has answered this call yet.</Text>
    </View>
  );
}

// The "What happened" column of a row.
function CallOutcome({ call }) {
  if (call.status === "ringing") {
    return (
      <Text style={styles.mutedBody}>
        Ringing for <Text style={styles.bold}>{getDurationLabel(call.waitingMs)}</Text>. Waiting for a dispatcher.
      </Text>
    );
  }

  if (call.status === "cancelled") {
    return <Text style={styles.mutedBody}>The resident cancelled before anyone answered.</Text>;
  }

  return (
    <View style={styles.outcome}>
      <Text style={styles.body}>
        {call.emergencyType ? <Text style={styles.bold}>{call.emergencyType} · </Text> : null}
        {call.dispatcherName ? `Answered by ${call.dispatcherName}` : "No dispatcher name saved"}
      </Text>
      {/* The ride the dispatcher made from this call (saved by the Emergency request form). */}
      {call.linkedRequestReference ? (
        <>
          <View style={styles.rideTag}>
            <Text style={styles.rideTagText}>Ride {call.linkedRequestReference}</Text>
          </View>
          <Text style={styles.small}>
            {call.linkedVehicleName || "Vehicle"} · {call.linkedDriverName || "Driver"}
          </Text>
        </>
      ) : (
        <Text style={styles.small}>No ride was made from this call.</Text>
      )}
    </View>
  );
}

export default function AdminCallSessionsSection({ callSessions, isLoadingCallSessions, callSessionsError }) {
  const { width } = useWindowDimensions();
  // Wide screens: one row with 3 columns. Narrow screens: the 3 parts stack.
  const wide = width >= 760;

  const unansweredCalls = callSessions.filter((call) => call.isStaleRinging);
  const otherCalls = callSessions.filter((call) => !call.isStaleRinging);

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <MaterialCommunityIcons name="phone-outline" size={24} color={DESIGN_COLORS.paperWhite} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Emergency calls</Text>
          <Text style={styles.subtitle}>
            Every Emergency alert from residents, newest first. A call with no answer after 30 seconds moves to the top.
          </Text>
        </View>
      </View>

      {callSessionsError ? <Text style={styles.errorText}>{callSessionsError}</Text> : null}

      {isLoadingCallSessions ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={DESIGN_COLORS.emergencyRed} />
          <Text style={styles.body}>Loading emergency call history...</Text>
        </View>
      ) : callSessions.length ? (
        <>
          <View style={styles.chips}>
            {COUNT_CHIPS.map((chip) => {
              const pill = STATUS_PILLS[chip.key];
              return (
                <View key={chip.key} style={styles.chip}>
                  <View style={[styles.chipCount, { backgroundColor: pill.backgroundColor }]}>
                    <Text style={[styles.chipCountText, { color: pill.color }]}>{callSessions.filter(chip.test).length}</Text>
                  </View>
                  <Text style={styles.chipText}>{chip.label}</Text>
                </View>
              );
            })}
          </View>

          {unansweredCalls.map((call) => (
            <UnansweredCallBox key={call.id} call={call} />
          ))}

          {otherCalls.length ? (
            <View style={styles.list}>
              {wide ? (
                <View style={[styles.row, styles.listHeader]}>
                  <Text style={[styles.columnWhen, styles.listHeaderText]}>Status and time</Text>
                  <Text style={[styles.columnWho, styles.listHeaderText]}>Resident</Text>
                  <Text style={[styles.columnWhat, styles.listHeaderText]}>What happened</Text>
                </View>
              ) : null}

              {otherCalls.map((call, index) => {
                const pill = getStatusPill(call);
                return (
                  <View key={call.id} style={[styles.row, !wide && styles.rowStacked, index > 0 && styles.rowDivider]}>
                    <View style={[wide && styles.columnWhen, styles.whenCell]}>
                      <View style={[styles.statusPill, { backgroundColor: pill.backgroundColor }]}>
                        <Text style={[styles.statusPillText, { color: pill.color }]}>{pill.label}</Text>
                      </View>
                      <Text style={styles.small}>{formatDateTime(call.createdAt)}</Text>
                    </View>
                    <View style={wide && styles.columnWho}>
                      <Text style={styles.name}>{call.residentName || "Resident"}</Text>
                      <Text style={styles.small}>{call.pickupLocation || "Barangay not available"}</Text>
                    </View>
                    <View style={wide && styles.columnWhat}>
                      <CallOutcome call={call} />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.body}>No emergency calls have been made yet.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Not wider than about 900px, so the page doesn't stretch across a big screen.
  page: { width: "100%", maxWidth: 900, gap: 16, padding: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerBadge: { width: 48, height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: DESIGN_COLORS.emergencyRed },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: DESIGN_COLORS.ink },
  subtitle: { marginTop: 2, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted },
  body: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.ink },
  mutedBody: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted },
  bold: { fontWeight: "700", color: DESIGN_COLORS.ink },
  small: { fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.inkMuted },
  errorText: { padding: 12, borderRadius: 16, overflow: "hidden", fontSize: 17, lineHeight: 24, fontWeight: "700", color: DESIGN_COLORS.emergencyRed, backgroundColor: DESIGN_COLORS.redTint },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingLeft: 6, paddingRight: 14, borderRadius: 999, backgroundColor: DESIGN_COLORS.boardTint },
  chipCount: { minWidth: 28, height: 28, paddingHorizontal: 8, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  chipCountText: { fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
  chipText: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.ink },

  // Red has white words (DESIGN.md).
  alarm: { borderRadius: 24, overflow: "hidden", backgroundColor: DESIGN_COLORS.redTint },
  alarmBand: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: DESIGN_COLORS.emergencyRed },
  alarmBandText: { flexShrink: 1, fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.paperWhite },
  alarmBody: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 16, paddingTop: 16, paddingHorizontal: 16 },
  alarmWho: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 },
  alarmName: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: DESIGN_COLORS.ink },
  phoneBox: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 16, backgroundColor: DESIGN_COLORS.paperWhite },
  phoneText: { fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },
  alarmMessage: { paddingTop: 8, paddingBottom: 16, paddingHorizontal: 16, fontSize: 17, lineHeight: 24, fontWeight: "700", color: DESIGN_COLORS.emergencyRed },

  list: { borderRadius: 24, borderWidth: 1, borderColor: DESIGN_COLORS.rule, overflow: "hidden", backgroundColor: DESIGN_COLORS.paperWhite },
  listHeader: { paddingVertical: 10, backgroundColor: DESIGN_COLORS.boardTint },
  listHeaderText: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.inkMuted },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 16, paddingVertical: 14, paddingHorizontal: 16 },
  rowStacked: { flexDirection: "column", gap: 8 },
  rowDivider: { borderTopWidth: 1, borderTopColor: DESIGN_COLORS.rule },
  columnWhen: { width: 170 },
  columnWho: { flex: 1, minWidth: 0 },
  columnWhat: { flex: 1.25, minWidth: 0 },
  whenCell: { gap: 6, alignItems: "flex-start" },
  statusPill: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999 },
  statusPillText: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  name: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  outcome: { gap: 2, alignItems: "flex-start" },
  // The ride reference: a small peach tag with dark words.
  rideTag: { marginTop: 2, paddingVertical: 2, paddingHorizontal: 10, borderRadius: 999, backgroundColor: DESIGN_COLORS.peachTint },
  rideTagText: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },

  emptyState: { padding: 20, borderRadius: 24, alignItems: "center", gap: 8, backgroundColor: DESIGN_COLORS.boardTint },
});
