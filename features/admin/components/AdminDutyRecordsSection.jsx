import { MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, onSnapshot, query, Timestamp, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { DESIGN_COLORS } from "../../../constants/design";
import { db } from "../../../firebase";
import { buildDailyDtr, DAY_MS, formatDutyDuration, formatManilaDay, formatManilaTime, getManilaDayStart } from "../../../lib/dutyTime";

// Admin "Duty Records": the daily DTR (driver-duty-plan.md Step 6, DESIGN.md look).
// One line per driver for the chosen day, worked out from the dutyRecords (which can't be edited).
// City-wide, like the other older admin tools (Known-Issue.md).
export default function AdminDutyRecordsSection() {
  const todayStartMs = getManilaDayStart();
  const [dayStartMs, setDayStartMs] = useState(todayStartMs);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  // Read the chosen day AND the next day, so a night shift that ends after midnight is complete.
  // Live: a driver who punches in or out now shows up without a refresh.
  useEffect(() => {
    setLoading(true);
    setError("");
    const dayQuery = query(
      collection(db, "dutyRecords"),
      where("at", ">=", Timestamp.fromMillis(dayStartMs)),
      where("at", "<", Timestamp.fromMillis(dayStartMs + 2 * DAY_MS))
    );

    return onSnapshot(
      dayQuery,
      (snapshot) => {
        setRecords(snapshot.docs.map((recordDoc) => recordDoc.data()));
        setLoading(false);
      },
      (listenError) => {
        console.log("Duty records listener warning:", listenError);
        setError("The duty records could not be loaded. Check your internet and try again.");
        setLoading(false);
      }
    );
  }, [dayStartMs]);

  // "Still on duty" times keep counting: refresh once a minute.
  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(intervalId);
  }, []);

  const lines = buildDailyDtr(records, dayStartMs, now);
  const isToday = dayStartMs >= todayStartMs;

  return (
    <View>
      <Text style={styles.title} accessibilityRole="header">
        Duty Records (DTR)
      </Text>
      <Text style={styles.intro}>
        Each driver&apos;s time card for one day, worked out from their punch records. Times are Manila time. A shift is listed on the day it
        started. The records can&apos;t be changed.
      </Text>

      {/* Day picker: one day back or forward. No date package needed. */}
      <View style={styles.dayPicker}>
        <Pressable
          style={({ pressed }) => [styles.dayButton, pressed && styles.dayButtonPressed]}
          onPress={() => setDayStartMs(dayStartMs - DAY_MS)}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color={DESIGN_COLORS.ink} />
          <Text style={styles.dayButtonText}>Previous day</Text>
        </Pressable>
        <Text style={styles.dayLabel} accessibilityRole="header">
          {formatManilaDay(dayStartMs)}
          {isToday ? " (today)" : ""}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.dayButton, pressed && styles.dayButtonPressed, isToday && styles.dayButtonDisabled]}
          onPress={() => setDayStartMs(dayStartMs + DAY_MS)}
          disabled={isToday}
          accessibilityRole="button"
          accessibilityState={{ disabled: isToday }}
        >
          <Text style={[styles.dayButtonText, isToday && styles.dayButtonTextDisabled]}>Next day</Text>
          <MaterialCommunityIcons name="chevron-right" size={24} color={isToday ? DESIGN_COLORS.inkMuted : DESIGN_COLORS.ink} />
        </Pressable>
        {!isToday ? (
          <Pressable
            style={({ pressed }) => [styles.dayButton, pressed && styles.dayButtonPressed]}
            onPress={() => setDayStartMs(todayStartMs)}
            accessibilityRole="button"
          >
            <Text style={styles.dayButtonText}>Today</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={DESIGN_COLORS.hallGreen} />
          <Text style={styles.emptyText}>Loading duty records...</Text>
        </View>
      ) : lines.length ? (
        <View style={styles.list}>
          {lines.map((line, index) => (
            <View key={line.driverId} style={[styles.line, index > 0 && styles.lineDivider]}>
              <View style={styles.nameCell}>
                <Text style={styles.driverName}>{line.driverName}</Text>
                {line.shifts > 1 ? <Text style={styles.smallMuted}>{line.shifts} shifts</Text> : null}
                {line.stillOnDuty ? (
                  <View style={styles.onDutyBadge}>
                    <Text style={styles.onDutyBadgeText}>Still on duty</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.cells}>
                <Cell label="First punch in" value={formatManilaTime(line.firstPunchInMs)} />
                <Cell label="Last punch out" value={line.stillOnDuty ? "Still on duty" : formatManilaTime(line.lastPunchOutMs)} />
                <Cell label="Break time" value={formatDutyDuration(line.breakMs)} />
                <Cell label="Time on duty" value={formatDutyDuration(line.onDutyMs)} />
                <Cell label="Medical / Health rides" value={`${line.medicalRides}`} />
                <Cell label="Community / Other rides" value={`${line.communityRides}`} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="clipboard-text-clock-outline" size={36} color={DESIGN_COLORS.inkMuted} />
          <Text style={styles.emptyText}>No driver punched in on this day.</Text>
        </View>
      )}
    </View>
  );
}

// One number with its label above it. The cells wrap: a row on a wide screen, a grid on a phone.
function Cell({ label, value }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.ink },
  intro: { marginTop: 6, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted, maxWidth: 760 },

  dayPicker: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  dayButton: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dayButtonPressed: { backgroundColor: DESIGN_COLORS.boardTint },
  dayButtonDisabled: { borderColor: DESIGN_COLORS.rule, backgroundColor: DESIGN_COLORS.boardTint },
  dayButtonText: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  dayButtonTextDisabled: { color: DESIGN_COLORS.inkMuted },
  dayLabel: { paddingHorizontal: 8, fontSize: 17, lineHeight: 22, fontWeight: "800", color: DESIGN_COLORS.ink },

  errorText: { marginTop: 12, padding: 12, borderRadius: 16, fontSize: 17, lineHeight: 24, fontWeight: "600", color: DESIGN_COLORS.emergencyRed, backgroundColor: DESIGN_COLORS.redTint },

  // A plain list with thin lines between drivers (no cards inside the admin panel).
  list: { marginTop: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: DESIGN_COLORS.rule },
  line: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingVertical: 16 },
  lineDivider: { borderTopWidth: 1, borderTopColor: DESIGN_COLORS.rule },
  nameCell: { flexBasis: 200, flexGrow: 1, maxWidth: 260, gap: 4 },
  driverName: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  smallMuted: { fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.inkMuted },
  onDutyBadge: { alignSelf: "flex-start", marginTop: 2, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, backgroundColor: DESIGN_COLORS.hallGreen },
  onDutyBadgeText: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.paperWhite },
  cells: { flexBasis: 480, flexGrow: 3, flexDirection: "row", flexWrap: "wrap", rowGap: 12, columnGap: 16 },
  cell: { flexBasis: 140, flexGrow: 1 },
  cellLabel: { fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.inkMuted },
  cellValue: { marginTop: 2, fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },

  emptyState: { marginTop: 16, padding: 24, borderRadius: 24, alignItems: "center", gap: 8, backgroundColor: DESIGN_COLORS.boardTint },
  emptyText: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted, textAlign: "center" },
});
