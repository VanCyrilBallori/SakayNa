import { MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, onSnapshot, query, Timestamp, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { DESIGN_COLORS } from "../../../constants/design";
import { db } from "../../../firebase";
import { getTimestampMillis } from "../../../lib/dates";
import {
  buildDailyDtr,
  DAY_MS,
  formatDutyDuration,
  formatManilaDay,
  formatManilaTime,
  fromDateBoxValue,
  getManilaDayStart,
  toDateBoxValue,
} from "../../../lib/dutyTime";

// The ride step when the driver sent "I can't do this ride" (unableAtStep), in plain words.
const STEP_WORDS = {
  Assigned: "Before Accept",
  Accepted: "After Accept, not on the way yet",
  "En Route": "On the way to the pickup",
  Arrived: "At the pickup",
};

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
  // "Inability reports" (driver-pages-plan.md Step 2c): every driverAssignment with status "Unable".
  const [reports, setReports] = useState([]);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [reportsError, setReportsError] = useState("");

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

  // Inability reports, live. Only the chosen day's reports are shown (filtered below), so no extra index is needed.
  useEffect(() => {
    const reportsQuery = query(collection(db, "driverAssignments"), where("status", "==", "Unable"));
    return onSnapshot(
      reportsQuery,
      (snapshot) => {
        setReports(snapshot.docs.map((reportDoc) => ({ id: reportDoc.id, ...reportDoc.data(), atMs: getTimestampMillis(reportDoc.data().unableAt) })));
        setReportsLoaded(true);
        setReportsError("");
      },
      (listenError) => {
        console.log("Inability reports listener warning:", listenError);
        setReportsError("The inability reports could not be loaded. Check your internet and try again.");
        setReportsLoaded(true);
      }
    );
  }, []);

  // "Still on duty" times keep counting: refresh once a minute.
  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(intervalId);
  }, []);

  const lines = buildDailyDtr(records, dayStartMs, now);
  // The chosen day's reports, earliest first.
  const dayReports = reports
    .filter((report) => report.atMs !== null && report.atMs >= dayStartMs && report.atMs < dayStartMs + DAY_MS)
    .sort((first, second) => first.atMs - second.atMs);
  const isToday = dayStartMs >= todayStartMs;

  // The calendar box gives a date like "2026-10-04". Days after today are ignored, like Next day.
  const pickDay = (value) => {
    const pickedMs = fromDateBoxValue(value);
    if (pickedMs === null || pickedMs > todayStartMs) return;
    setDayStartMs(pickedMs);
  };

  return (
    <View>
      <Text style={styles.title} accessibilityRole="header">
        Duty Records (DTR)
      </Text>
      <Text style={styles.intro}>
        Each driver&apos;s time card for one day, worked out from their punch records. Times are Manila time. A shift is listed on the day it
        started. The records can&apos;t be changed.
      </Text>

      {/* Day picker: one day back or forward, or any day from the calendar box. No date package needed. */}
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
        {/* The browser's own calendar (a plain web date box). The admin panel is a website, so this is web only. */}
        {Platform.OS === "web" ? (
          <input
            type="date"
            aria-label="Pick a day"
            value={toDateBoxValue(dayStartMs)}
            max={toDateBoxValue(todayStartMs)}
            onChange={(event) => pickDay(event.target.value)}
            style={dateBoxStyle}
          />
        ) : null}
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

              {/* Each break with its reason: "12:01 PM – 12:45 PM · Lunch · the driver's note". */}
              {line.breaks.length ? (
                <View style={styles.breakList}>
                  <Text style={styles.cellLabel}>Breaks</Text>
                  {line.breaks.map((breakItem) => (
                    <Text key={breakItem.startMs} style={styles.breakLine}>
                      {[
                        `${formatManilaTime(breakItem.startMs)} – ${breakItem.endMs === null ? "Still on break" : formatManilaTime(breakItem.endMs)}`,
                        breakItem.breakType || "Break",
                        breakItem.breakNote ? `"${breakItem.breakNote}"` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="clipboard-text-clock-outline" size={36} color={DESIGN_COLORS.inkMuted} />
          <Text style={styles.emptyText}>No driver punched in on this day.</Text>
        </View>
      )}

      {/* Inability reports (driver-pages-plan.md Step 2c): "I can't do this ride", for the same day.
          Each one is a report, not a decline. The dispatcher gave the ride to another driver. */}
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Inability reports
      </Text>
      <Text style={styles.intro}>
        Rides a driver said they couldn&apos;t do (&quot;I can&apos;t do this ride&quot;) on this day, with their reason. The ride went
        back to dispatch.
      </Text>

      {reportsError ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {reportsError}
        </Text>
      ) : null}

      {!reportsLoaded ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={DESIGN_COLORS.hallGreen} />
          <Text style={styles.emptyText}>Loading inability reports...</Text>
        </View>
      ) : dayReports.length ? (
        <View style={styles.list}>
          {dayReports.map((report, index) => (
            <View key={report.id} style={[styles.line, index > 0 && styles.lineDivider]}>
              <Text style={styles.reportTime}>{formatManilaTime(report.atMs)}</Text>
              <View style={styles.reportCopy}>
                <Text style={styles.driverName}>{report.driverName || "Driver"}</Text>
                <Text style={styles.reportReason}>{report.unableReason || "No reason"}</Text>
                <Text style={styles.smallMuted}>
                  {[report.title || "Transport request", report.vehicleName, STEP_WORDS[report.unableAtStep] || report.unableAtStep].filter(Boolean).join(" · ")}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No inability reports on this day.</Text>
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

// The calendar box is a plain web element, so it takes a web style (not a StyleSheet one). Same look as the day buttons.
const dateBoxStyle = {
  minHeight: 48,
  boxSizing: "border-box",
  padding: "0 12px",
  borderRadius: 16,
  border: `1.5px solid ${DESIGN_COLORS.controlOutline}`,
  backgroundColor: DESIGN_COLORS.paperWhite,
  color: DESIGN_COLORS.ink,
  fontSize: 17,
  fontWeight: 700,
  fontFamily: "inherit",
};

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
  // The break list sits under the numbers, across the whole row.
  breakList: { flexBasis: "100%", gap: 2 },
  breakLine: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },
  cellValue: { marginTop: 2, fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },

  // Inability reports: same plain list as the time cards. Time on the left, then who, why, and which ride.
  sectionTitle: { marginTop: 32, fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.ink },
  reportTime: { flexBasis: 100, fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },
  reportCopy: { flexBasis: 240, flexGrow: 1, gap: 2 },
  reportReason: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.ink },

  emptyState: { marginTop: 16, padding: 24, borderRadius: 24, alignItems: "center", gap: 8, backgroundColor: DESIGN_COLORS.boardTint },
  emptyText: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted, textAlign: "center" },
});
