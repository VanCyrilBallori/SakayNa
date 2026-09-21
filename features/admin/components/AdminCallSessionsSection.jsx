import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { formatDateTime, getDurationLabel } from "../../../lib/dates";

const STATUS_LABELS = {
  ringing: "Ringing",
  connected: "Connected",
  declined: "Declined",
  ended: "Ended",
  cancelled: "Cancelled by resident",
};

const getStatusLabel = (call) => {
  if (call.status === "ringing" && call.isStaleRinging) {
    return "Ringing — Unanswered";
  }

  return STATUS_LABELS[call.status] || call.status || "Unknown";
};

export default function AdminCallSessionsSection({ theme, callSessions, isLoadingCallSessions, callSessionsError }) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionHeaderText, { color: theme.text }]}>Emergency Calls</Text>
      </View>
      <Text style={[styles.subtitle, { color: theme.mutedText }]}>
        Every in-app SOS call from Residents. A call still Ringing after 30 seconds with no Dispatcher is flagged as unanswered below.
      </Text>

      {callSessionsError ? <Text style={styles.errorText}>{callSessionsError}</Text> : null}

      {isLoadingCallSessions ? (
        <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ActivityIndicator color="#C53A3A" />
          <Text style={[styles.emptyText, { color: theme.mutedText }]}>Loading emergency call history...</Text>
        </View>
      ) : callSessions.length ? (
        <View style={styles.list}>
          {callSessions.map((call) => (
            <View
              key={call.id}
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: call.isStaleRinging ? "#C53A3A" : theme.border },
                call.isStaleRinging && styles.cardStale,
              ]}
            >
              <View style={styles.cardTop}>
                <Text style={[styles.residentName, { color: theme.text }]}>{call.residentName || "Resident"}</Text>
                <View style={[styles.statusPill, { backgroundColor: call.isStaleRinging ? "#C53A3A" : call.status === "connected" ? "#0B8E59" : theme.softSurface }]}>
                  <Text style={[styles.statusPillText, { color: call.isStaleRinging || call.status === "connected" ? "#FFFFFF" : theme.text }]}>
                    {getStatusLabel(call)}
                  </Text>
                </View>
              </View>

              {call.isStaleRinging ? (
                <Text style={styles.staleWarning}>No dispatcher has answered this call yet.</Text>
              ) : null}

              <Text style={[styles.line, { color: theme.mutedText }]}>
                Type: {call.emergencyType || call.serviceType || "Not specified"}
              </Text>
              <Text style={[styles.line, { color: theme.mutedText }]}>
                Pickup: {call.pickupLocation || "Not available"}
              </Text>
              {call.dispatcherName ? (
                <Text style={[styles.line, { color: theme.mutedText }]}>Dispatcher: {call.dispatcherName}</Text>
              ) : null}
              <Text style={[styles.line, { color: theme.mutedText }]}>
                {call.status === "ringing" && typeof call.waitingMs === "number"
                  ? `Ringing for ${getDurationLabel(call.waitingMs)}`
                  : `Started: ${formatDateTime(call.createdAt)}`}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.emptyText, { color: theme.mutedText }]}>No emergency calls have been made yet.</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { marginBottom: 6 },
  sectionHeaderText: { fontSize: 22, fontWeight: "800" },
  subtitle: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  errorText: { color: "#C53A3A", fontSize: 13, fontWeight: "700", marginBottom: 10 },
  list: { gap: 10 },
  card: { borderWidth: 1, borderRadius: 8, padding: 14, gap: 4 },
  cardStale: { borderWidth: 2 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  residentName: { fontSize: 16, fontWeight: "800" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPillText: { fontSize: 12, fontWeight: "800" },
  staleWarning: { color: "#C53A3A", fontSize: 13, fontWeight: "800", marginBottom: 2 },
  line: { fontSize: 13, lineHeight: 19 },
  emptyState: { borderWidth: 1, borderRadius: 8, padding: 20, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, textAlign: "center" },
});
