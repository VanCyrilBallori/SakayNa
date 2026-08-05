import { useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";

import AppButton from "../../../components/ui/AppButton";
import FeedbackMessage from "../../../components/ui/FeedbackMessage";
import { COLORS, RADIUS, SPACING } from "../../../constants/design";
import { cancelResidentRequest } from "../services/residentRequestService";
import { canResidentCancel, formatRequestDate, getPickupLabel, getRequestStatusMeta } from "../utils/requestMapper";
import { validateCancellationReason } from "../utils/requestValidation";
import ResidentRequestDetails from "./ResidentRequestDetails";

const statusOptions = [{ label: "All statuses", value: "All" }, { label: "Active", value: "Active" }, { label: "Completed", value: "Completed" }, { label: "Cancelled", value: "Cancelled" }, { label: "Pending", value: "Pending" }, { label: "Assigned", value: "Assigned" }, { label: "In progress", value: "In Progress" }];
const typeOptions = [{ label: "All request types", value: "All" }, { label: "Emergency", value: "Emergency Request" }, { label: "Community", value: "Community Transport Request" }];
const isActive = (status) => ["Pending", "Assigned", "In Progress"].includes(status || "Pending");

export default function ResidentRequestHistory({ visible, onClose, requests, loading, error, uid }) {
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [reason, setReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const filteredRequests = useMemo(() => requests.filter((request) => {
    const matchesStatus = statusFilter === "All" || (statusFilter === "Active" ? isActive(request.status) : request.status === statusFilter);
    const category = request.category || request.requestType || "";
    const matchesType = typeFilter === "All" || category === typeFilter;
    const query = search.trim().toLowerCase();
    return matchesStatus && matchesType && (!query || request.reference.toLowerCase().includes(query) || request.id.toLowerCase().includes(query));
  }), [requests, search, statusFilter, typeFilter]);

  const requestCancellation = async () => {
    const normalizedReason = reason.trim().replace(/\s+/g, " ");
    const invalidReason = validateCancellationReason(normalizedReason);
    if (invalidReason) { setCancelError(invalidReason); return; }
    if (!cancelTarget || cancelling) return;
    setCancelling(true); setCancelError("");
    try { await cancelResidentRequest({ requestId: cancelTarget.id, uid, reason: normalizedReason }); setCancelTarget(null); setReason(""); setSelected(null); }
    catch (error) { setCancelError(error?.message === "not-cancellable" ? "This request has already moved beyond the cancellation stage." : "The request could not be cancelled. Refresh the status and try again."); }
    finally { setCancelling(false); }
  };

  return <><Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.overlay}><View style={styles.card}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close request history" style={styles.close} onPress={onClose}><Text style={styles.closeText}>X</Text></TouchableOpacity><Text style={styles.title}>Request history</Text><Text style={styles.subtitle}>Your 50 most recent requests are shown. Select one to see its full status and details.</Text><View style={styles.filters}><Dropdown style={styles.filter} data={statusOptions} labelField="label" valueField="value" value={statusFilter} onChange={(item) => setStatusFilter(item.value)} /><Dropdown style={styles.filter} data={typeOptions} labelField="label" valueField="value" value={typeFilter} onChange={(item) => setTypeFilter(item.value)} /></View><TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search request reference" placeholderTextColor={COLORS.subtleText} autoCapitalize="characters" />{error ? <FeedbackMessage message={error} tone="error" /> : null}<ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>{loading ? <Text style={styles.muted}>Loading your requests...</Text> : filteredRequests.length ? filteredRequests.map((request) => { const status = getRequestStatusMeta(request.status); return <TouchableOpacity key={request.id} accessibilityRole="button" accessibilityLabel={`View ${request.reference}`} style={styles.item} onPress={() => setSelected(request)}><View style={styles.itemHeader}><Text style={styles.reference}>{request.reference}</Text><View style={[styles.pill, { backgroundColor: status.tone === "danger" ? COLORS.emergencySurface : status.tone === "success" ? "#E7F5ED" : COLORS.warningSurface }]}><Text style={styles.pillText}>{status.label}</Text></View></View><Text style={styles.itemTitle}>{request.serviceType || request.emergencyType || "Transport request"}</Text><Text style={styles.itemMeta}>{getPickupLabel(request)}</Text><Text style={styles.itemMeta}>{formatRequestDate(request.createdAt)}</Text>{canResidentCancel(request) ? <Text style={styles.cancelHint}>Cancellation is available</Text> : null}</TouchableOpacity>; }) : <View style={styles.empty}><Text style={styles.emptyTitle}>No matching requests</Text><Text style={styles.muted}>Try a different status or request type filter.</Text></View>}</ScrollView></View></View></Modal><ResidentRequestDetails request={selected} visible={Boolean(selected)} onClose={() => setSelected(null)} onCancel={(request) => { setSelected(null); setCancelTarget(request); setReason(""); setCancelError(""); }} /><Modal visible={Boolean(cancelTarget)} transparent animationType="fade" onRequestClose={() => !cancelling && setCancelTarget(null)}><View style={styles.dialogOverlay}><View style={styles.dialog}><Text style={styles.dialogTitle}>Cancel request?</Text><Text style={styles.muted}>This keeps the request record but removes it from the active queue when it is still eligible.</Text><TextInput style={styles.reason} value={reason} onChangeText={setReason} placeholder="Reason for cancellation" placeholderTextColor={COLORS.subtleText} multiline maxLength={240} textAlignVertical="top" />{cancelError ? <FeedbackMessage message={cancelError} tone="error" /> : null}<View style={styles.actions}><AppButton label="Keep request" variant="secondary" disabled={cancelling} onPress={() => setCancelTarget(null)} style={styles.button} /><AppButton label="Confirm cancellation" variant="danger" loading={cancelling} onPress={requestCancellation} style={styles.button} /></View></View></View></Modal></>;
}

const styles = StyleSheet.create({ overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(13,31,24,.62)" }, card: { minHeight: "76%", maxHeight: "94%", padding: SPACING.lg, backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg }, close: { alignSelf: "flex-end", width: 36, height: 36, alignItems: "center", justifyContent: "center" }, closeText: { color: COLORS.text, fontSize: 17, fontWeight: "800" }, title: { color: COLORS.text, fontSize: 23, fontWeight: "800" }, subtitle: { marginTop: 6, color: COLORS.mutedText, lineHeight: 20 }, filters: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md }, filter: { flex: 1, minHeight: 46, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm }, search: { minHeight: 46, marginTop: SPACING.sm, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, color: COLORS.text }, list: { paddingVertical: SPACING.md, gap: SPACING.sm }, item: { padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceMuted }, itemHeader: { flexDirection: "row", gap: SPACING.sm, alignItems: "center", justifyContent: "space-between" }, reference: { color: COLORS.text, fontSize: 13, fontWeight: "800" }, pill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: RADIUS.pill }, pillText: { color: COLORS.text, fontSize: 11, fontWeight: "700" }, itemTitle: { marginTop: 8, color: COLORS.text, fontSize: 16, fontWeight: "700" }, itemMeta: { marginTop: 4, color: COLORS.mutedText, fontSize: 13 }, cancelHint: { marginTop: 8, color: COLORS.warning, fontSize: 12, fontWeight: "700" }, muted: { color: COLORS.mutedText, lineHeight: 20 }, empty: { marginTop: SPACING.xl, alignItems: "center" }, emptyTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800", marginBottom: 5 }, dialogOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg, backgroundColor: "rgba(13,31,24,.62)" }, dialog: { width: "100%", maxWidth: 480, padding: SPACING.lg, backgroundColor: COLORS.surface, borderRadius: RADIUS.md }, dialogTitle: { color: COLORS.text, fontSize: 20, fontWeight: "800" }, reason: { minHeight: 92, marginTop: SPACING.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, color: COLORS.text }, actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg }, button: { flex: 1 } });
