import { FontAwesome } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import AppButton from "../../../components/ui/AppButton";
import FeedbackMessage from "../../../components/ui/FeedbackMessage";
import { COLORS, RADIUS, SPACING } from "../../../constants/design";
import { cancelResidentRequest } from "../services/residentRequestService";
import { canResidentCancel, formatRequestDate, getAssistanceText, getDestinationCoordinates, getDestinationLabel, getPassengerCountText, getPassengerName, getPickupCoordinates, getPickupLabel, getRequestStatusMeta, getWhenText } from "../utils/requestMapper";
import { validateCancellationReason } from "../utils/requestValidation";
import RequestStatusTimeline from "./RequestStatusTimeline";
import LeafletMap from "../../../components/LeafletMap";

const DetailLine = ({ label, value }) => <View style={styles.detailLine}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value || "Not provided"}</Text></View>;

// One request's details. The "Cancel request" pop-up lives here too, so this window works the same
// wherever it is opened from (Request History, or the latest request card on the home screen).
export default function ResidentRequestDetails({ request, visible, onClose }) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  if (!request) return null;
  const status = getRequestStatusMeta(request.status);
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

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.overlay}><View style={styles.card}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close request details" style={styles.close} onPress={onClose}><Text style={styles.closeText}>X</Text></TouchableOpacity><Text style={styles.title}>Request details</Text><Text style={styles.reference}>{request.reference}</Text><View style={[styles.status, { backgroundColor: status.tone === "danger" ? COLORS.emergencySurface : status.tone === "success" ? "#E7F5ED" : COLORS.warningSurface }]}><FontAwesome name={status.icon} size={14} color={status.tone === "danger" ? COLORS.emergency : status.tone === "success" ? COLORS.success : COLORS.warning} /><Text style={styles.statusText}>{status.label}</Text></View>
  <DetailLine label="Ride for" value={request.title || request.serviceType} /><DetailLine label="When" value={getWhenText(request)} /><DetailLine label="Pickup" value={getPickupLabel(request)} /><DetailLine label="Landmark" value={request.pickupDetails} /><DetailLine label="Going to" value={getDestinationLabel(request)} /><DetailLine label="Passenger" value={getPassengerName(request)} /><DetailLine label="Contact number" value={request.contactNumber} /><DetailLine label="People riding" value={getPassengerCountText(request)} /><DetailLine label="Help needed" value={getAssistanceText(request)} />{request.additionalNotes ? <DetailLine label="Notes" value={request.additionalNotes} /> : null}<DetailLine label="Submitted" value={formatRequestDate(request.createdAt)} /><DetailLine label="Latest update" value={formatRequestDate(request.latestUpdatedAt)} />
  <View style={styles.section}><Text style={styles.sectionTitle}>Assigned responder</Text>{driverName ? <><DetailLine label="Driver" value={driverName} /><DetailLine label="Vehicle" value={[vehicle, request.vehiclePlateNumber ? `Plate ${request.vehiclePlateNumber}` : ""].filter(Boolean).join(" | ")} /><DetailLine label="Contact" value={request.assignedDriverPhone || request.driverContactNumber || "Contact is not available yet"} /></> : <Text style={styles.muted}>Not yet assigned. Dispatcher contact is shown only when linked to this request.</Text>}{dispatcherName ? <><DetailLine label="Dispatcher" value={dispatcherName} /><DetailLine label="Dispatcher contact" value={request.dispatcherOfficePhone || "Contact is not available yet"} /></> : null}</View>
  {pickupCoordinates || destinationCoordinates ? <View style={styles.map}><LeafletMap title={`Route for ${request.reference}`} pickupLabel={getPickupLabel(request)} destinationLabel={getDestinationLabel(request)} pickupCoordinates={pickupCoordinates} destinationCoordinates={destinationCoordinates} /></View> : null}
  <View style={styles.section}><Text style={styles.sectionTitle}>Status timeline</Text><RequestStatusTimeline request={request} /></View>
  {canResidentCancel(request) ? <AppButton label="Cancel request" variant="danger" onPress={openCancel} style={styles.cancel} /> : null}</ScrollView></View></View>
  {/* Inside the Details window, so it shows on top of it on every phone. */}
  <Modal visible={cancelOpen} transparent animationType="fade" onRequestClose={() => !cancelling && setCancelOpen(false)}><View style={styles.dialogOverlay}><View style={styles.dialog}><Text style={styles.dialogTitle}>Cancel request?</Text><Text style={styles.muted}>This keeps the request record but removes it from the active queue when it is still eligible.</Text><TextInput style={styles.reason} value={reason} onChangeText={setReason} placeholder="Reason for cancellation" placeholderTextColor={COLORS.subtleText} multiline maxLength={240} textAlignVertical="top" />{cancelError ? <FeedbackMessage message={cancelError} tone="error" /> : null}<View style={styles.actions}><AppButton label="Keep request" variant="secondary" disabled={cancelling} onPress={() => setCancelOpen(false)} style={styles.button} /><AppButton label="Confirm cancellation" variant="danger" loading={cancelling} onPress={requestCancellation} style={styles.button} /></View></View></View></Modal></Modal>;
}

const styles = StyleSheet.create({ overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(13,31,24,.62)" }, card: { maxHeight: "94%", backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg }, content: { padding: SPACING.lg, paddingBottom: 32 }, close: { alignSelf: "flex-end", width: 36, height: 36, justifyContent: "center", alignItems: "center" }, closeText: { fontSize: 17, fontWeight: "800", color: COLORS.text }, title: { fontSize: 22, fontWeight: "800", color: COLORS.text }, reference: { marginTop: 4, color: COLORS.mutedText, fontSize: 13, fontWeight: "700" }, status: { alignSelf: "flex-start", flexDirection: "row", gap: 7, marginTop: SPACING.md, paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.pill }, statusText: { color: COLORS.text, fontSize: 13, fontWeight: "700" }, detailLine: { marginTop: SPACING.md }, label: { color: COLORS.subtleText, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }, value: { marginTop: 3, color: COLORS.text, fontSize: 15, lineHeight: 21 }, section: { marginTop: SPACING.xl, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border }, sectionTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800" }, muted: { marginTop: SPACING.sm, color: COLORS.mutedText, lineHeight: 20 }, map: { height: 260, marginTop: SPACING.xl, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm }, cancel: { marginTop: SPACING.xl }, dialogOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg, backgroundColor: "rgba(13,31,24,.62)" }, dialog: { width: "100%", maxWidth: 480, padding: SPACING.lg, backgroundColor: COLORS.surface, borderRadius: RADIUS.md }, dialogTitle: { color: COLORS.text, fontSize: 20, fontWeight: "800" }, reason: { minHeight: 92, marginTop: SPACING.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, color: COLORS.text }, actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg }, button: { flex: 1 } });
