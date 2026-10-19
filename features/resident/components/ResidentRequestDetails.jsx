import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppButton from "../../../components/ui/AppButton";
import CloseButton from "../../../components/ui/CloseButton";
import FeedbackMessage from "../../../components/ui/FeedbackMessage";
import { CORNER, FONT, NEUTRAL, SHADOW } from "../../../constants/design";
import { cancelResidentRequest } from "../services/residentRequestService";
import { canResidentCancel, formatRequestDate, getAssistanceText, getDestinationCoordinates, getDestinationLabel, getPassengerCountText, getPassengerName, getPickupCoordinates, getPickupLabel, getRequestStatusMeta, getStatusBadgeColors, getWhenText } from "../utils/requestMapper";
import { validateCancellationReason } from "../utils/requestValidation";
import RequestStatusTimeline from "./RequestStatusTimeline";
import LeafletMap from "../../../components/LeafletMap";

// One line of details: a small grey label (sentence case, DESIGN.md No-Whisper Rule) and the value under it.
const DetailLine = ({ label, value }) => (
  <View style={styles.detailLine}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value || "Not provided"}</Text>
  </View>
);

// One request's details. The "Cancel request" pop-up lives here too, so this window works the same
// wherever it is opened from (the History page, or the "Your ride" card on the home screen).
export default function ResidentRequestDetails({ request, visible, onClose }) {
  // Android draws this window behind its own bottom bar (◁ ○ □), so leave that much room at the bottom (Task 3.17).
  const insets = useSafeAreaInsets();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  if (!request) return null;
  const status = getRequestStatusMeta(request.status);
  const badge = getStatusBadgeColors(request.status);
  const driverName = request.assignedDriverName || request.driverName;
  const vehicle = request.assignedVehicleName || request.vehicle;
  const dispatcherName = request.dispatcherName || request.assignedDispatcherName;
  const pickupCoordinates = getPickupCoordinates(request);
  const destinationCoordinates = getDestinationCoordinates(request);

  const openCancel = () => { setReason(""); setCancelError(""); setCancelOpen(true); };

  const requestCancellation = async () => {
    if (cancelling) return;
    const normalizedReason = reason.trim().replace(/\s+/g, " ");
    const invalidReason = validateCancellationReason(normalizedReason);
    if (invalidReason) { setCancelError(invalidReason); return; }
    setCancelling(true); setCancelError("");
    try { await cancelResidentRequest({ requestId: request.id, reason: normalizedReason }); setCancelOpen(false); setReason(""); onClose(); }
    catch (error) { setCancelError(error?.message === "not-cancellable" ? "This request has already moved beyond the cancellation stage." : "The request could not be cancelled. Refresh the status and try again."); }
    finally { setCancelling(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* A bottom sheet (DESIGN.md Style): 24 top corners, a grabber bar, Level 3 shadow. */}
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Text style={styles.title} accessibilityRole="header">Request details</Text>
                <Text style={styles.reference}>{request.reference}</Text>
              </View>
              <CloseButton onPress={onClose} label="Close request details" />
            </View>
            <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
              <Text style={[styles.badgeText, { color: badge.color }]}>{status.label}</Text>
            </View>

            <View style={styles.group}>
              <DetailLine label="Ride for" value={request.title || request.serviceType} />
              <DetailLine label="When" value={getWhenText(request)} />
              <DetailLine label="Pickup" value={getPickupLabel(request)} />
              <DetailLine label="Landmark" value={request.pickupDetails} />
              <DetailLine label="Going to" value={getDestinationLabel(request)} />
              <DetailLine label="Passenger" value={getPassengerName(request)} />
              <DetailLine label="Contact number" value={request.contactNumber} />
              <DetailLine label="People riding" value={getPassengerCountText(request)} />
              <DetailLine label="Help needed" value={getAssistanceText(request)} />
              {request.additionalNotes ? <DetailLine label="Notes" value={request.additionalNotes} /> : null}
              <DetailLine label="Sent" value={formatRequestDate(request.createdAt)} />
              <DetailLine label="Latest update" value={formatRequestDate(request.latestUpdatedAt)} />
            </View>

            <Text style={styles.sectionTitle} accessibilityRole="header">Assigned responder</Text>
            <View style={styles.group}>
              {driverName ? (
                <>
                  <DetailLine label="Driver" value={driverName} />
                  <DetailLine label="Vehicle" value={[vehicle, request.vehiclePlateNumber ? `Plate ${request.vehiclePlateNumber}` : ""].filter(Boolean).join(" · ")} />
                  <DetailLine label="Contact" value={request.assignedDriverPhone || request.driverContactNumber || "Contact is not available yet"} />
                </>
              ) : (
                <Text style={styles.muted}>Not yet assigned. Dispatcher contact is shown only when linked to this request.</Text>
              )}
              {dispatcherName ? (
                <>
                  <DetailLine label="Dispatcher" value={dispatcherName} />
                  <DetailLine label="Dispatcher contact" value={request.dispatcherOfficePhone || "Contact is not available yet"} />
                </>
              ) : null}
            </View>

            {pickupCoordinates || destinationCoordinates ? (
              <View style={styles.map}>
                <LeafletMap title={`Route for ${request.reference}`} pickupLabel={getPickupLabel(request)} destinationLabel={getDestinationLabel(request)} pickupCoordinates={pickupCoordinates} destinationCoordinates={destinationCoordinates} />
              </View>
            ) : null}

            <Text style={styles.sectionTitle} accessibilityRole="header">Status timeline</Text>
            <View style={styles.group}>
              <RequestStatusTimeline request={request} />
            </View>

            {canResidentCancel(request) ? <AppButton label="Cancel request" variant="danger" onPress={openCancel} style={styles.cancel} /> : null}
          </ScrollView>
        </View>
      </View>

      {/* Inside the Details window, so it shows on top of it on every phone. */}
      <Modal visible={cancelOpen} transparent animationType="fade" onRequestClose={() => !cancelling && setCancelOpen(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialog}>
            <MaterialCommunityIcons name="close-circle-outline" size={44} color={NEUTRAL[700]} />
            <Text style={styles.dialogTitle} accessibilityRole="header">Cancel request?</Text>
            <Text style={styles.muted}>The request stays in your history, but dispatch will not send a vehicle.</Text>
            <TextInput style={styles.reason} value={reason} onChangeText={setReason} placeholder="Reason for cancelling" placeholderTextColor={NEUTRAL[600]} multiline maxLength={240} textAlignVertical="top" />
            {cancelError ? <FeedbackMessage message={cancelError} tone="error" /> : null}
            {/* The main action on top at full width, Keep underneath (DESIGN.md Layout). */}
            <AppButton label="Cancel request" variant="danger" loading={cancelling} onPress={requestCancellation} style={styles.dialogButton} />
            <AppButton label="Keep request" variant="secondary" disabled={cancelling} onPress={() => setCancelOpen(false)} style={styles.dialogButtonSecond} />
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(20, 33, 28, 0.55)" },
  sheet: { maxHeight: "94%", backgroundColor: NEUTRAL[50], borderTopLeftRadius: CORNER.sheet, borderTopRightRadius: CORNER.sheet, ...SHADOW.level3 },
  grabber: { alignSelf: "center", width: 40, height: 5, marginTop: 10, borderRadius: CORNER.pill, backgroundColor: NEUTRAL[300] },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  titleCopy: { flex: 1, paddingTop: 8 },
  title: { fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: NEUTRAL[900] },
  reference: { marginTop: 2, fontSize: 15, lineHeight: 20, fontFamily: FONT.medium, color: NEUTRAL[700] },
  // Status badge: a pill with the status word (the same colors as the History page).
  badge: { alignSelf: "flex-start", marginTop: 12, paddingHorizontal: 14, paddingVertical: 6, borderRadius: CORNER.pill },
  badgeText: { fontSize: 15, lineHeight: 20, fontFamily: FONT.semiBold },
  // A white card for each group of details (16 corners, thin edge, Level 1 shadow).
  group: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 4, borderRadius: CORNER.card, borderWidth: 1, borderColor: NEUTRAL[200], backgroundColor: NEUTRAL[0], ...SHADOW.level1 },
  detailLine: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: NEUTRAL[100] },
  label: { fontSize: 15, lineHeight: 20, fontFamily: FONT.medium, color: NEUTRAL[700] },
  value: { marginTop: 2, fontSize: 17, lineHeight: 24, fontFamily: FONT.regular, color: NEUTRAL[900] },
  sectionTitle: { marginTop: 24, fontSize: 17, lineHeight: 22, fontFamily: FONT.bold, color: NEUTRAL[900] },
  muted: { paddingVertical: 12, fontSize: 17, lineHeight: 24, fontFamily: FONT.regular, color: NEUTRAL[700] },
  map: { height: 260, marginTop: 24, overflow: "hidden", borderWidth: 1, borderColor: NEUTRAL[200], borderRadius: CORNER.card },
  cancel: { marginTop: 24 },
  dialogOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "rgba(20, 33, 28, 0.55)" },
  dialog: { width: "100%", maxWidth: 440, alignItems: "center", padding: 24, borderRadius: CORNER.card, backgroundColor: NEUTRAL[0], ...SHADOW.level3 },
  dialogTitle: { marginTop: 8, fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: NEUTRAL[900], textAlign: "center" },
  reason: { alignSelf: "stretch", minHeight: 96, marginTop: 8, padding: 14, borderWidth: 1.5, borderColor: NEUTRAL[500], borderRadius: CORNER.input, backgroundColor: NEUTRAL[0], fontSize: 17, fontFamily: FONT.regular, color: NEUTRAL[900] },
  dialogButton: { alignSelf: "stretch", minHeight: 56, marginTop: 16 },
  dialogButtonSecond: { alignSelf: "stretch", minHeight: 56, marginTop: 12 },
});
