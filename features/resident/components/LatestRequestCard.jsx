import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import ListSkeleton from "../../../components/ui/ListSkeleton";
import { CORNER, DESIGN_COLORS, FONT, GREEN, NEUTRAL, RED, SHADOW } from "../../../constants/design";
import { startPhoneCall } from "../../../lib/phoneCall";
import { getDestinationLabel, getPickupLabel, getRideProgress, getWhenText, RIDE_STEPS } from "../utils/requestMapper";

// The color of the status band for each step (DESIGN.md "Status band colors").
// Waiting (1) and "Your driver is here!" (5) = orange. A driver is on it (2, 3, 4, 6) = deep green.
// Completed (7) and Cancelled (0) = grey. Never red: red is only for emergencies.
const getBandColor = (step) => {
  if (step === 1 || step === 5) return DESIGN_COLORS.sakayOrange;
  if (step >= 2 && step <= 6) return DESIGN_COLORS.hallGreenDeep;
  return DESIGN_COLORS.inkMuted;
};

// The home screen's "Your ride" card: the ride's step, a progress bar, From / To, and the driver once assigned.
// request = the ride to show (getHomeRide in requestMapper.js), null if there is none.
// loading / error = from useResidentRequests. onPress = opens Request Details.
export default function LatestRequestCard({ request, loading, error, onPress }) {
  if (error) {
    return (
      <View style={[styles.messageBox, styles.errorBox]}>
        <Text style={[styles.messageText, styles.errorText]}>{error}</Text>
      </View>
    );
  }

  // Still loading: a grey placeholder card (the same as the History page's), not a box of words.
  if (loading) {
    return <ListSkeleton rows={1} label="Loading your ride" />;
  }

  // Empty state (DESIGN.md Style): an icon in a tinted circle, a title and one sentence.
  if (!request) {
    return (
      <View style={[styles.card, styles.emptyCard]}>
        <View style={styles.emptyIcon}>
          <MaterialCommunityIcons name="van-passenger" size={48} color={GREEN[700]} />
        </View>
        <Text style={styles.emptyTitle}>No rides yet</Text>
        <Text style={styles.emptyText}>When you request a ride, it will show here.</Text>
      </View>
    );
  }

  const { step, title } = getRideProgress(request);
  const bandColor = getBandColor(step);
  // "Orange has dark words": white text on orange is too hard to read. Every other band has white words.
  const bandTextColor = bandColor === DESIGN_COLORS.sakayOrange ? DESIGN_COLORS.ink : "#FFFFFF";
  const whenText = getWhenText(request);
  const isScheduled = request.timing === "scheduled";

  // The driver part shows once a driver is assigned (step 2 or later). A declined ride has no driver, so it hides again.
  // A cancelled ride (step 0) still has the driver's name saved, so step is checked too.
  const driverName = step >= 2 && request.assignedDriverId ? request.assignedDriverName : "";
  const driverPhone = request.assignedDriverPhone || "";
  // Call driver only until the passenger is picked up (steps 2 to 5), and only if the phone was saved.
  // Rides assigned before the phone was saved (Step 1) have no number, so the button stays hidden.
  const canCallDriver = Boolean(driverName && driverPhone && step >= 2 && step <= 5);
  const vehicleText = [request.assignedVehicleName, request.vehiclePlateNumber ? `Plate ${request.vehiclePlateNumber}` : ""].filter(Boolean).join(" · ");

  return (
    <View style={styles.card}>
      <View style={[styles.band, { backgroundColor: bandColor }]}>
        <Text style={[styles.bandText, { color: bandTextColor }]} accessibilityRole="header">
          {title}
        </Text>
      </View>

      <View style={styles.body}>
        {step > 0 ? <ProgressBar step={step} /> : null}

        {/* Route board: From (green ring) and To (orange dot) like a jeepney signboard, joined by a short green line. */}
        <RouteLine label="From" place={getPickupLabel(request)} markerStyle={styles.fromMarker} />
        <View style={styles.routeJoin} />
        <RouteLine label="To" place={getDestinationLabel(request)} markerStyle={styles.toMarker} />

        {/* A scheduled time is shown in orange so it stands out. "As soon as possible" stays grey. */}
        <Text style={[styles.whenLine, isScheduled && styles.scheduledWhen]}>{whenText}</Text>

        {/* The driver, by name, and the vehicle (DESIGN.md "Named Place Rule"). A thin line separates it from the route. */}
        {driverName ? (
          <View style={styles.driverBlock}>
            <Text style={styles.driverName}>{driverName}</Text>
            {/* Vehicle and plate on one line, so the card stays short (it wraps with large text). */}
            {vehicleText ? <Text style={styles.driverLine}>{vehicleText}</Text> : null}
          </View>
        ) : null}

        {/* Call driver and See details share one row (they wrap to two rows with large text). */}
        <View style={styles.actions}>
          {canCallDriver ? (
            <Pressable
              style={({ pressed }) => [styles.callButton, pressed && styles.callButtonPressed]}
              onPress={() => startPhoneCall(driverPhone)}
              android_ripple={{ color: "rgba(255, 255, 255, 0.2)" }}
              accessibilityRole="button"
              accessibilityLabel={`Call driver ${driverName}`}
            >
              <MaterialCommunityIcons name="phone-outline" size={24} color="#FFFFFF" />
              <Text style={styles.callButtonText}>Call driver</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.detailsLink, pressed && styles.detailsLinkPressed]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel="See ride details"
          >
            <Text style={styles.detailsLinkText}>See details</Text>
            <MaterialCommunityIcons name="chevron-right" size={24} color={GREEN[700]} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// 7 short pieces, one per step. Done pieces are green. The words under it say the same thing,
// so the bar never relies on color alone (DESIGN.md "Word-With-Every-Color Rule").
function ProgressBar({ step }) {
  const stepText = `Step ${step} of ${RIDE_STEPS.length} · ${RIDE_STEPS[step - 1]}`;
  return (
    <View
      style={styles.progress}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={stepText}
      accessibilityValue={{ min: 1, max: RIDE_STEPS.length, now: step }}
    >
      <View style={styles.progressBar}>
        {RIDE_STEPS.map((name, index) => (
          <View key={name} style={[styles.progressPiece, index < step && styles.progressPieceDone]} />
        ))}
      </View>
      <Text style={styles.progressText}>{stepText}</Text>
    </View>
  );
}

// One line of the route board. Long places wrap to 2 lines; the full address is in Request Details.
function RouteLine({ label, place, markerStyle }) {
  return (
    <View style={styles.routeLine}>
      <Text style={styles.routeLabel}>{label}</Text>
      <View style={[styles.marker, markerStyle]} />
      <Text style={styles.routePlace} numberOfLines={2}>
        {place}
      </Text>
    </View>
  );
}

// "From" and "To" share one column width, so the place names line up.
const LABEL_WIDTH = 52;

const styles = StyleSheet.create({
  // A white card (DESIGN.md Style): 16 corners, a thin neutral edge and a Level 1 shadow.
  card: {
    borderRadius: CORNER.card,
    borderWidth: 1,
    borderColor: NEUTRAL[200],
    backgroundColor: NEUTRAL[0],
    ...SHADOW.level1,
  },
  // "Title" size (DESIGN.md): the one big thing on the card. The band follows the card's top corners.
  band: { minHeight: 48, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 10, borderTopLeftRadius: CORNER.card - 1, borderTopRightRadius: CORNER.card - 1 },
  bandText: { fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: "#FFFFFF" },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  progress: { marginBottom: 12 },
  progressBar: { flexDirection: "row", gap: 4 },
  // Fully round ends (DESIGN.md allows fully round for small status pieces). Not-done pieces are a light grey-green.
  progressPiece: { flex: 1, height: 8, borderRadius: CORNER.pill, backgroundColor: NEUTRAL[200] },
  progressPieceDone: { backgroundColor: GREEN[600] },
  progressText: { marginTop: 6, fontSize: 15, lineHeight: 20, fontFamily: FONT.semiBold, color: NEUTRAL[700] },
  // Label, marker and place sit at the top of the row. The label uses the same line height as the place
  // (22) so their words line up, and the 14-tall marker is moved down 4 to sit in the middle of that line.
  routeLine: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  routeLabel: { width: LABEL_WIDTH, fontSize: 15, lineHeight: 22, fontFamily: FONT.medium, color: NEUTRAL[700] },
  marker: { width: 14, height: 14, marginTop: 4, borderRadius: 7 },
  fromMarker: { borderWidth: 3, borderColor: DESIGN_COLORS.hallGreen, backgroundColor: DESIGN_COLORS.paperWhite },
  toMarker: { backgroundColor: DESIGN_COLORS.sakayOrange },
  routePlace: { flex: 1, fontSize: 17, lineHeight: 22, fontFamily: FONT.bold, color: NEUTRAL[900] },
  // The short green line between From and To, under the middle of the two markers (label + gap + half a marker).
  routeJoin: { width: 2, height: 14, marginLeft: LABEL_WIDTH + 8 + 6, marginVertical: 2, backgroundColor: DESIGN_COLORS.hallGreen },
  whenLine: { marginTop: 8, fontSize: 15, lineHeight: 20, fontFamily: FONT.medium, color: DESIGN_COLORS.inkMuted },
  scheduledWhen: { fontFamily: FONT.bold, color: DESIGN_COLORS.orangeDeep },
  // A 1dp line on top separates the driver from the route (DESIGN.md: no card inside a card).
  driverBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: NEUTRAL[200] },
  driverName: { fontSize: 17, lineHeight: 22, fontFamily: FONT.bold, color: NEUTRAL[900] },
  driverLine: { marginTop: 2, fontSize: 15, lineHeight: 20, fontFamily: FONT.medium, color: NEUTRAL[700] },
  // Call driver (left, grows) and See details (right). Wraps to two rows when they don't fit.
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12 },
  // 56 tall (DESIGN.md main action), a green pill (DESIGN.md Style).
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    flexGrow: 1,
    minHeight: 56,
    paddingHorizontal: 20,
    borderRadius: CORNER.pill,
    overflow: "hidden",
    backgroundColor: GREEN[600],
  },
  callButtonPressed: { backgroundColor: GREEN[800] },
  callButtonText: { fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: "#FFFFFF" },
  // "See details ›": a green text button, 48 tall so it is easy to tap.
  detailsLink: { flexDirection: "row", alignItems: "center", minHeight: 48, paddingLeft: 4, paddingRight: 8, borderRadius: CORNER.pill },
  detailsLinkPressed: { backgroundColor: GREEN[50] },
  detailsLinkText: { fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: GREEN[700] },
  messageBox: { padding: 16, borderRadius: CORNER.card, backgroundColor: NEUTRAL[100] },
  messageText: { fontFamily: FONT.regular, fontSize: 17, lineHeight: 24, color: NEUTRAL[700] },
  errorBox: { backgroundColor: RED[50] },
  errorText: { color: RED[600] },
  // "No rides yet" (DESIGN.md Style empty state).
  emptyCard: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 16 },
  emptyIcon: { width: 96, height: 96, borderRadius: CORNER.pill, alignItems: "center", justifyContent: "center", backgroundColor: GREEN[50] },
  emptyTitle: { marginTop: 16, fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: NEUTRAL[900], textAlign: "center" },
  emptyText: { marginTop: 4, fontSize: 17, lineHeight: 24, fontFamily: FONT.regular, color: NEUTRAL[700], textAlign: "center" },
});
