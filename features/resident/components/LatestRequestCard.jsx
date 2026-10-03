import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DESIGN_COLORS } from "../../../constants/design";
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

  if (loading || !request) {
    return (
      <View style={styles.messageBox}>
        <Text style={styles.messageText}>{loading ? "Loading your ride…" : "No rides yet. When you request a ride, it will show here."}</Text>
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
            {request.assignedVehicleName ? <Text style={styles.driverLine}>{request.assignedVehicleName}</Text> : null}
            {request.vehiclePlateNumber ? <Text style={styles.driverLine}>Plate {request.vehiclePlateNumber}</Text> : null}
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
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.detailsLink, pressed && styles.detailsLinkPressed]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="See ride details"
        >
          <Text style={styles.detailsLinkText}>See details</Text>
          <MaterialCommunityIcons name="chevron-right" size={24} color={DESIGN_COLORS.hallGreen} />
        </Pressable>
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
  card: {
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
    // Keeps the band's corners inside the card's rounded corners.
    overflow: "hidden",
  },
  // "Title" size (DESIGN.md): the one big thing on the card.
  band: { minHeight: 56, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 12 },
  bandText: { fontSize: 22, lineHeight: 28, fontWeight: "800", color: "#FFFFFF" },
  body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  progress: { marginBottom: 14 },
  progressBar: { flexDirection: "row", gap: 4 },
  // Fully round ends (DESIGN.md allows fully round for small status pieces). Not-done pieces are a light grey-green.
  progressPiece: { flex: 1, height: 10, borderRadius: 5, backgroundColor: DESIGN_COLORS.rule },
  progressPieceDone: { backgroundColor: DESIGN_COLORS.hallGreen },
  progressText: { marginTop: 6, fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.inkMuted },
  // Label, marker and place sit at the top of the row. The label uses the same line height as the place
  // (22) so their words line up, and the 14-tall marker is moved down 4 to sit in the middle of that line.
  routeLine: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  routeLabel: { width: LABEL_WIDTH, fontSize: 15, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.inkMuted },
  marker: { width: 14, height: 14, marginTop: 4, borderRadius: 7 },
  fromMarker: { borderWidth: 3, borderColor: DESIGN_COLORS.hallGreen, backgroundColor: DESIGN_COLORS.paperWhite },
  toMarker: { backgroundColor: DESIGN_COLORS.sakayOrange },
  routePlace: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: "800", color: DESIGN_COLORS.ink },
  // The short green line between From and To, under the middle of the two markers (label + gap + half a marker).
  routeJoin: { width: 2, height: 14, marginLeft: LABEL_WIDTH + 8 + 6, marginVertical: 2, backgroundColor: DESIGN_COLORS.hallGreen },
  whenLine: { marginTop: 10, fontSize: 15, lineHeight: 20, fontWeight: "500", color: DESIGN_COLORS.inkMuted },
  scheduledWhen: { fontWeight: "700", color: DESIGN_COLORS.orangeDeep },
  // A 1dp line on top separates the driver from the route (DESIGN.md: no card inside a card).
  driverBlock: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: DESIGN_COLORS.rule },
  driverName: { fontSize: 17, lineHeight: 22, fontWeight: "800", color: DESIGN_COLORS.ink },
  driverLine: { marginTop: 2, fontSize: 17, lineHeight: 24, fontWeight: "500", color: DESIGN_COLORS.ink },
  // Full width, 56 tall (DESIGN.md main action), 16 corners.
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 56,
    marginTop: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: DESIGN_COLORS.hallGreen,
  },
  callButtonPressed: { backgroundColor: DESIGN_COLORS.hallGreenDeep },
  callButtonText: { fontSize: 17, lineHeight: 22, fontWeight: "800", color: "#FFFFFF" },
  // "See details ›": a green text button, 48 tall so it is easy to tap.
  detailsLink: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", minHeight: 48, marginTop: 4, paddingRight: 4, borderRadius: 16 },
  detailsLinkPressed: { backgroundColor: DESIGN_COLORS.boardTint },
  detailsLinkText: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.hallGreen },
  messageBox: { padding: 16, borderRadius: 24, backgroundColor: DESIGN_COLORS.boardTint },
  messageText: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted },
  errorBox: { backgroundColor: DESIGN_COLORS.redTint },
  errorText: { color: DESIGN_COLORS.emergencyRed },
});
