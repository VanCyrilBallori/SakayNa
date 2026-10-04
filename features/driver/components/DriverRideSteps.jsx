import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { DESIGN_COLORS } from "../../../constants/design";
import { formatManilaTime } from "../../../lib/dutyTime";

// The ride steps after Accept, in order. "field" = the time each step already saves on the assignment
// (driverMissionService.js TIMESTAMP_FIELD). Nothing new is saved for this list.
const STEPS = [
  { status: "Accepted", label: "Accepted", field: "acceptedAt" },
  { status: "En Route", label: "On the way to pickup", field: "enRouteAt" },
  { status: "Arrived", label: "Arrived at the pickup", field: "arrivedAt" },
  { status: "Picked Up", label: "Rider picked up", field: "pickedUpAt" },
  { status: "Completed", label: "Ride completed", field: "completedAt" },
];

// "Ride steps" list (driver-home-restyle-plan.md Piece 4b). Shown under the step button, only after Accept.
// Done = green circle with a check + the time. Next = orange dot + "Next". Not yet = grey ring, grey words.
// Every color comes with a check or a word (DESIGN.md "Word-With-Every-Color Rule").
// assignment = the driver's assignment (has acceptedAt, enRouteAt...). status = the ride step (getMissionStatus).
export default function DriverRideSteps({ assignment, status }) {
  // How many steps are done: "Accepted" = 1, "En Route" = 2, and so on.
  const doneCount = STEPS.findIndex((step) => step.status === status) + 1;

  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        Ride steps
      </Text>

      {STEPS.map((step, index) => {
        const isDone = index < doneCount;
        const isNext = index === doneCount;
        const isLast = index === STEPS.length - 1;
        // Right after a tap the time is still on its way from Firebase, so it can be blank for a moment.
        const savedAt = assignment[step.field]?.toMillis?.();
        const timeText = isDone && savedAt ? formatManilaTime(savedAt) : "";
        const stateText = isDone ? `done${timeText ? `, ${timeText}` : ""}` : isNext ? "next" : "not yet";

        return (
          <View key={step.status} style={styles.row} accessible accessibilityLabel={`${step.label}, ${stateText}`}>
            {/* The circle, and the thin line down to the next circle. */}
            <View style={styles.markerColumn}>
              {isDone ? (
                <View style={[styles.circle, styles.doneCircle]}>
                  <MaterialCommunityIcons name="check" size={18} color={DESIGN_COLORS.paperWhite} />
                </View>
              ) : (
                <View style={styles.circle}>
                  <View style={isNext ? styles.nextDot : styles.notYetRing} />
                </View>
              )}
              {!isLast ? <View style={styles.line} /> : null}
            </View>

            {/* The words wrap under each other when the phone's text is large. */}
            <View style={[styles.textRow, !isLast && styles.textRowSpace]}>
              <Text style={[styles.label, !isDone && !isNext && styles.notYetLabel]}>{step.label}</Text>
              {timeText ? <Text style={styles.time}>{timeText}</Text> : null}
              {isNext ? <Text style={styles.next}>Next</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const CIRCLE_SIZE = 28;

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 24, backgroundColor: DESIGN_COLORS.paperWhite },
  title: { marginBottom: 12, fontSize: 17, lineHeight: 22, fontWeight: "800", color: DESIGN_COLORS.ink },
  row: { flexDirection: "row", gap: 12 },
  markerColumn: { width: CIRCLE_SIZE, alignItems: "center" },
  circle: { width: CIRCLE_SIZE, height: CIRCLE_SIZE, alignItems: "center", justifyContent: "center" },
  doneCircle: { borderRadius: CIRCLE_SIZE / 2, backgroundColor: DESIGN_COLORS.hallGreen },
  nextDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: DESIGN_COLORS.sakayOrange },
  notYetRing: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: DESIGN_COLORS.controlOutline, backgroundColor: DESIGN_COLORS.paperWhite },
  // Decorative line between the circles (DESIGN.md: Rule is for decoration only).
  line: { flex: 1, width: 2, minHeight: 12, backgroundColor: DESIGN_COLORS.rule },
  // The words line up with the middle of the 28 circle (22 line + 3 above).
  textRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", columnGap: 8, paddingTop: 3 },
  textRowSpace: { paddingBottom: 16 },
  label: { flexShrink: 1, fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  notYetLabel: { fontWeight: "500", color: DESIGN_COLORS.inkMuted },
  time: { fontSize: 15, lineHeight: 22, fontWeight: "500", color: DESIGN_COLORS.inkMuted },
  // Small orange words: Orange Deep (DESIGN.md), never the bright orange on white.
  next: { fontSize: 15, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.orangeDeep },
});
