import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DESIGN_COLORS } from "../../../constants/design";
import { startPhoneCall } from "../../../lib/phoneCall";
import { getAssistanceText, getPassengerCountText, getPassengerName, getScheduledDate, getWhenText } from "../../resident/utils/requestMapper";
import { getDestinationLabel, getEmergencyRideTitle, getPatientCountText, getPickupLabel, isEmergencyFormRide } from "../utils/driverMissionMapper";

// The words and color of the status band for each ride step (DESIGN.md "Status band colors").
// A driver is on it = deep green with white words. "At the pickup" = orange with dark words. Cancelled = grey. Never red.
const BAND = {
  Assigned: { text: "New ride from dispatch", color: DESIGN_COLORS.hallGreenDeep },
  Accepted: { text: "Accepted", color: DESIGN_COLORS.hallGreenDeep },
  "En Route": { text: "On the way to pickup", color: DESIGN_COLORS.hallGreenDeep },
  Arrived: { text: "At the pickup", color: DESIGN_COLORS.sakayOrange },
  "Picked Up": { text: "Rider on board", color: DESIGN_COLORS.hallGreenDeep },
};

// The driver's task card (driver-home-restyle-plan.md Piece 3): status band, title, time, Pickup / Destination,
// Riders and Vehicle, the help the rider needs, the passenger with Call passenger, and "Ride details".
// missionStatus = the ride step (getMissionStatus). vehicleName = from driver-home.jsx. onOpenDetails = opens the details pop-up.
export default function DriverRideCard({ request, assignment, missionStatus, vehicleName, onOpenDetails }) {
  const band = request.status === "Cancelled" ? { text: "Cancelled by the resident", color: DESIGN_COLORS.inkMuted } : BAND[missionStatus] || BAND.Assigned;
  // "Orange has dark words": white on orange is too hard to read. Every other band has white words.
  const bandTextColor = band.color === DESIGN_COLORS.sakayOrange ? DESIGN_COLORS.ink : DESIGN_COLORS.paperWhite;
  const isScheduled = Boolean(getScheduledDate(request));
  const assistance = getAssistanceText(request);
  const passengerName = getPassengerName(request, assignment);
  // A ride the dispatcher made from an emergency alert (emergency-request-form-plan.md Part B). Ordinary rides keep the card as before.
  const fromEmergencyForm = isEmergencyFormRide(request);
  const title = fromEmergencyForm ? getEmergencyRideTitle(request) : request.emergencyType ?? request.title ?? "Transport request";
  // Emergency rides made before Part A have no quick facts: the driver reads them in Ride details → Notes, as before.
  const showQuickFacts = fromEmergencyForm && Boolean(request.conscious);

  return (
    <View style={styles.card}>
      <View style={[styles.band, { backgroundColor: band.color }]}>
        <Text style={[styles.bandText, { color: bandTextColor }]} accessibilityRole="header">
          {band.text}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>

        {/* A scheduled time is shown in orange so it stands out. "As soon as possible" stays grey. */}
        <View style={styles.whenRow}>
          <MaterialCommunityIcons name="clock-outline" size={20} color={isScheduled ? DESIGN_COLORS.orangeDeep : DESIGN_COLORS.inkMuted} />
          <Text style={[styles.whenText, isScheduled && styles.scheduledWhen]}>{getWhenText(request)}</Text>
        </View>

        {/* Route board: Pickup (green ring) and Destination (orange dot), joined by a green line.
            The label sits above the place, because "Destination" is too long to fit beside it. Places are never cut off. */}
        <View style={styles.route}>
          <View style={styles.routeRow}>
            <View style={styles.markerColumn}>
              <View style={[styles.marker, styles.pickupMarker]} />
              <View style={styles.routeJoin} />
            </View>
            <View style={styles.routeText}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routePlace}>{getPickupLabel(request)}</Text>
              {request.pickupDetails ? <Text style={styles.landmark}>Landmark: {request.pickupDetails}</Text> : null}
            </View>
          </View>
          <View style={styles.routeRow}>
            <View style={styles.markerColumn}>
              <View style={[styles.marker, styles.destinationMarker]} />
            </View>
            <View style={styles.routeText}>
              <Text style={styles.routeLabel}>Destination</Text>
              <Text style={styles.routePlace}>{getDestinationLabel(request)}</Text>
            </View>
          </View>
        </View>

        {/* Two small boxes. They wrap under each other when the phone's text is large. */}
        <View style={styles.boxes}>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>{fromEmergencyForm ? "Patients" : "Riders"}</Text>
            <Text style={styles.boxValue}>{fromEmergencyForm ? getPatientCountText(request) : getPassengerCountText(request)}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Vehicle</Text>
            <Text style={styles.boxValue}>{vehicleName}</Text>
            {request.vehiclePlateNumber ? <Text style={styles.boxSmall}>Plate {request.vehiclePlateNumber}</Text> : null}
          </View>
        </View>

        {/* Only when the resident asked for help (wheelchair, senior citizen...). Peach = important info (DESIGN.md). */}
        {assistance !== "None" ? (
          <View style={styles.helpBox}>
            <Text style={styles.helpText}>
              <Text style={styles.helpLabel}>Needs help: </Text>
              {assistance}
            </Text>
          </View>
        ) : null}

        {/* The emergency's quick facts, from the dispatcher's form. Peach = important info (DESIGN.md).
            Incident details stop at 3 lines ("…"); the full text is in Ride details → Notes. */}
        {showQuickFacts ? (
          <View style={[styles.helpBox, styles.factsBox]}>
            <Text style={styles.helpText}>
              <Text style={styles.helpLabel}>Approximate age: </Text>
              {request.approximateAge || "Unknown"}
            </Text>
            <Text style={styles.helpText}>
              <Text style={styles.helpLabel}>Conscious: </Text>
              {request.conscious}
            </Text>
            <Text style={styles.helpText}>
              <Text style={styles.helpLabel}>Breathing: </Text>
              {request.breathing || "Unknown"}
            </Text>
            {request.incidentDetails ? (
              <Text style={styles.helpText} numberOfLines={3}>
                <Text style={styles.helpLabel}>Incident details: </Text>
                {request.incidentDetails}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* The passenger, by name. A thin line separates it from the ride (DESIGN.md: no card inside a card). */}
        <View style={styles.passenger}>
          <Text style={styles.passengerName}>{passengerName}</Text>
          {request.contactNumber ? (
            <Pressable
              style={({ pressed }) => [styles.callButton, pressed && styles.callButtonPressed]}
              onPress={() => startPhoneCall(request.contactNumber)}
              accessibilityRole="button"
              accessibilityLabel={`Call passenger at ${request.contactNumber}`}
            >
              <MaterialCommunityIcons name="phone-outline" size={24} color={DESIGN_COLORS.hallGreen} />
              <Text style={styles.callButtonText}>Call passenger</Text>
            </Pressable>
          ) : (
            <Text style={styles.noPhone}>Phone: not provided</Text>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [styles.detailsLink, pressed && styles.detailsLinkPressed]}
          onPress={onOpenDetails}
          accessibilityRole="button"
          accessibilityLabel="See ride details"
        >
          <Text style={styles.detailsLinkText}>Ride details</Text>
          <MaterialCommunityIcons name="chevron-right" size={24} color={DESIGN_COLORS.hallGreen} />
        </Pressable>
      </View>
    </View>
  );
}

const MARKER_SIZE = 14;

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: DESIGN_COLORS.paperWhite,
    // Keeps the band's corners inside the card's rounded corners.
    overflow: "hidden",
  },
  // "Title" size (DESIGN.md): the one big thing on the card.
  band: { minHeight: 56, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 12 },
  bandText: { fontSize: 22, lineHeight: 28, fontWeight: "800" },
  body: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: "800", color: DESIGN_COLORS.ink },
  whenRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  whenText: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: "500", color: DESIGN_COLORS.inkMuted },
  scheduledWhen: { fontWeight: "700", color: DESIGN_COLORS.orangeDeep },

  route: { marginTop: 16 },
  routeRow: { flexDirection: "row", gap: 12 },
  // The marker sits beside the label line (20 tall), and the green line runs down to the next marker.
  markerColumn: { width: MARKER_SIZE, alignItems: "center", paddingTop: 3 },
  marker: { width: MARKER_SIZE, height: MARKER_SIZE, borderRadius: MARKER_SIZE / 2 },
  pickupMarker: { borderWidth: 3, borderColor: DESIGN_COLORS.hallGreen, backgroundColor: DESIGN_COLORS.paperWhite },
  destinationMarker: { backgroundColor: DESIGN_COLORS.sakayOrange },
  routeJoin: { flex: 1, width: 2, minHeight: 12, marginVertical: 4, backgroundColor: DESIGN_COLORS.hallGreen },
  routeText: { flex: 1, paddingBottom: 12 },
  routeLabel: { fontSize: 15, lineHeight: 20, fontWeight: "500", color: DESIGN_COLORS.inkMuted },
  routePlace: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  landmark: { marginTop: 2, fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.inkMuted },

  boxes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  box: { flexGrow: 1, flexBasis: 130, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, backgroundColor: DESIGN_COLORS.boardTint },
  boxLabel: { fontSize: 15, lineHeight: 20, fontWeight: "500", color: DESIGN_COLORS.inkMuted },
  boxValue: { marginTop: 2, fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  boxSmall: { marginTop: 2, fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.inkMuted },

  helpBox: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, backgroundColor: DESIGN_COLORS.peachTint },
  helpText: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.ink },
  helpLabel: { fontWeight: "700" },
  factsBox: { gap: 4 },

  passenger: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: DESIGN_COLORS.rule },
  passengerName: { fontSize: 17, lineHeight: 22, fontWeight: "800", color: DESIGN_COLORS.ink },
  // A white button with an edge, so it doesn't compete with the green Accept / next-step button.
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 48,
    marginTop: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  callButtonPressed: { backgroundColor: DESIGN_COLORS.boardTint },
  callButtonText: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.hallGreen },
  noPhone: { marginTop: 4, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted },

  // "Ride details ›": a green text button, 48 tall so it is easy to tap.
  detailsLink: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", minHeight: 48, marginTop: 4, paddingRight: 4, borderRadius: 16 },
  detailsLinkPressed: { backgroundColor: DESIGN_COLORS.boardTint },
  detailsLinkText: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.hallGreen },
});
