import { FontAwesome } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";

import { ACCOUNT_STATUSES } from "../../../constants/app";
import ListSkeleton from "../../../components/ui/ListSkeleton";
import { CORNER, FONT, GREEN, NEUTRAL, ORANGE, RED, SHADOW } from "../../../constants/design";
import { formatDateTime } from "../../../lib/dates";
import { reviewResidentVerification } from "../services/adminOperationsService";

// Admin → Resident Verification: the Pending residents of the Admin's own barangay.
// The Admin opens one, looks at the proof-of-residency photo, then Approves or Rejects with a reason.
// admin-home.jsx loads the list (only this barangay) and passes it in.
export default function AdminResidentVerificationSection({ theme, adminId, adminBarangay, verifications, isLoading, loadError }) {
  const { height } = useWindowDimensions();
  const [selected, setSelected] = useState(null);
  // "review" = Approve / Reject buttons. "approve" = are-you-sure. "reject" = reason box.
  const [mode, setMode] = useState("review");
  const [reason, setReason] = useState("");
  const [fullPhoto, setFullPhoto] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [doneMessage, setDoneMessage] = useState("");

  const openReview = (verification) => {
    setSelected(verification);
    setMode("review");
    setReason("");
    setFullPhoto(false);
    setPhotoFailed(false);
    setErrorMessage("");
    setDoneMessage("");
  };

  const closeReview = () => {
    if (!saving) {
      setSelected(null);
    }
  };

  const submitDecision = async (decision) => {
    if (decision === ACCOUNT_STATUSES.REJECTED && reason.trim().length < 3) {
      setErrorMessage("Write a reason of at least 3 characters, so the resident knows what to fix.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    try {
      await reviewResidentVerification({ adminId, residentUid: selected.id, decision, reason });
      setDoneMessage(`${selected.fullName || "The resident"} was ${decision === ACCOUNT_STATUSES.ACTIVE ? "approved" : "rejected"}.`);
      setSelected(null);
    } catch (error) {
      console.log("Resident verification review failed:", error);
      setErrorMessage(error?.code === "permission-denied" ? "This change was not allowed. You can only manage non-Admin accounts in your own barangay. Check that this account belongs to your barangay." : error?.message || "The review could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!adminBarangay) {
    return (
      <View style={[styles.notice, { backgroundColor: ORANGE[100], borderColor: ORANGE[300] }]}>
        <FontAwesome name="info-circle" size={24} color={ORANGE[800]} />
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeTitle}>Your admin account has no barangay yet</Text>
          <Text style={styles.noticeText}>It must be set in the Firebase Console. After that, the residents of your barangay who are waiting for review will appear here.</Text>
        </View>
      </View>
    );
  }

  const photoHeight = Math.min(Math.max(height * 0.5, 300), 520);
  // Lighter red and green in Dark mode, so the text stays readable on the dark background.
  const dangerText = theme.mode === "Dark" ? "#FF9C94" : RED[600];
  const successText = theme.mode === "Dark" ? "#8FD9B3" : GREEN[700];

  return (
    <>
      <Text style={[styles.title, { color: theme.text }]}>Resident Verification</Text>
      <Text style={[styles.subtitle, { color: theme.text }]}>
        {adminBarangay} · {isLoading ? "Loading..." : `${verifications.length} waiting for review`}
      </Text>

      {doneMessage ? <Text style={[styles.doneText, { color: successText }]}>{doneMessage}</Text> : null}

      {isLoading ? (
        <ListSkeleton label="Loading residents waiting for review" />
      ) : loadError ? (
        <Text style={[styles.errorText, { color: dangerText }]}>{loadError}</Text>
      ) : verifications.length ? (
        <View style={styles.list}>
          {verifications.map((verification) => (
            <View key={verification.id} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowName, { color: theme.text }]}>{verification.fullName || "Unnamed resident"}</Text>
                <Text style={[styles.rowLine, { color: theme.text }]}>{verification.documentType || "Document type not given"}</Text>
                <Text style={[styles.rowLine, { color: theme.mutedText }]}>Submitted {formatDateTime(verification.submittedAt)}</Text>
              </View>
              <TouchableOpacity style={styles.reviewButton} onPress={() => openReview(verification)} accessibilityRole="button" accessibilityLabel={`Review ${verification.fullName || "resident"}`}>
                <Text style={styles.reviewButtonText}>Review</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyState, { borderColor: theme.border }]}>
          <FontAwesome name="check-circle" size={28} color={GREEN[600]} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No residents are waiting for review.</Text>
        </View>
      )}

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={fullPhoto ? () => setFullPhoto(false) : closeReview}>
        {fullPhoto ? (
          // Full-screen photo inside the same pop-up, so two pop-ups never stack.
          <Pressable style={styles.fullPhotoPage} onPress={() => setFullPhoto(false)} accessibilityRole="button" accessibilityLabel="Close full screen photo">
            <Image source={{ uri: selected?.documentPhotoUrl }} style={styles.fullPhoto} resizeMode="contain" />
            <Text style={styles.fullPhotoHint}>Tap anywhere to close</Text>
          </Pressable>
        ) : (
          <View style={[styles.overlay, { backgroundColor: theme.modalOverlay }]}>
            <ScrollView style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]} contentContainerStyle={styles.cardContent} keyboardShouldPersistTaps="handled">
              <View style={styles.cardHeader}>
                <View style={styles.rowCopy}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{selected?.fullName || "Resident"}</Text>
                  <Text style={[styles.rowLine, { color: theme.text }]}>{selected?.documentType || "Document type not given"}</Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={closeReview} accessibilityRole="button" accessibilityLabel="Close">
                  <FontAwesome name="close" size={20} color={NEUTRAL[900]} />
                </TouchableOpacity>
              </View>

              {photoFailed || !selected?.documentPhotoUrl ? (
                <View style={[styles.photoBox, styles.photoMissing, { height: 160, backgroundColor: theme.surfaceMuted }]}>
                  <Text style={[styles.rowLine, { color: theme.text }]}>The photo could not be loaded. Check the internet connection, then open this again.</Text>
                </View>
              ) : (
                <Pressable onPress={() => setFullPhoto(true)} accessibilityRole="imagebutton" accessibilityLabel="Document photo. Tap to see it full screen.">
                  <Image
                    source={{ uri: selected.documentPhotoUrl }}
                    style={[styles.photoBox, { height: photoHeight, backgroundColor: theme.surfaceMuted }]}
                    resizeMode="contain"
                    onError={() => setPhotoFailed(true)}
                  />
                  <View style={styles.photoHintRow}>
                    <FontAwesome name="expand" size={15} color={theme.mutedText} />
                    <Text style={[styles.photoHint, { color: theme.mutedText }]}>Tap the photo to see it full screen</Text>
                  </View>
                </Pressable>
              )}

              <View style={[styles.details, { backgroundColor: theme.surfaceMuted }]}>
                {[
                  ["Full Name", selected?.fullName],
                  ["Phone Number", selected?.phoneNumber],
                  ["Email", selected?.email],
                  ["Barangay", selected?.barangay],
                  ["Address", selected?.address],
                  ["Submitted", formatDateTime(selected?.submittedAt)],
                ].map(([label, value]) => (
                  <View key={label} style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.mutedText }]}>{label}</Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>{value || "Not provided"}</Text>
                  </View>
                ))}
              </View>

              {mode === "review" ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.actionButton, styles.rejectButton, { borderColor: dangerText }]} onPress={() => { setMode("reject"); setErrorMessage(""); }} accessibilityRole="button">
                    <Text style={[styles.rejectButtonText, { color: dangerText }]}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => { setMode("approve"); setErrorMessage(""); }} accessibilityRole="button">
                    <Text style={styles.approveButtonText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {mode === "approve" ? (
                <View style={styles.decisionBox}>
                  <Text style={[styles.decisionText, { color: theme.text }]}>
                    Approve {selected?.fullName || "this resident"}? They will be able to send emergency alerts and transport requests.
                  </Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionButton, styles.cancelButton, { borderColor: theme.mutedText }]} onPress={() => setMode("review")} disabled={saving} accessibilityRole="button">
                      <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => submitDecision(ACCOUNT_STATUSES.ACTIVE)} disabled={saving} accessibilityRole="button">
                      {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.approveButtonText}>Yes, approve</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {mode === "reject" ? (
                <View style={styles.decisionBox}>
                  <Text style={[styles.decisionText, { color: theme.text }]}>Why are you rejecting this?</Text>
                  <TextInput
                    style={[styles.reasonInput, { backgroundColor: theme.inputBg, borderColor: theme.mutedText, color: theme.text }]}
                    placeholder="e.g. The photo is blurry. Please upload a clearer photo."
                    placeholderTextColor={theme.mutedText}
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    maxLength={300}
                    editable={!saving}
                  />
                  <Text style={[styles.reasonHint, { color: theme.mutedText }]}>The resident will see this reason.</Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionButton, styles.cancelButton, { borderColor: theme.mutedText }]} onPress={() => setMode("review")} disabled={saving} accessibilityRole="button">
                      <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.confirmRejectButton]} onPress={() => submitDecision(ACCOUNT_STATUSES.REJECTED)} disabled={saving} accessibilityRole="button">
                      {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.approveButtonText}>Confirm reject</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {errorMessage ? <Text style={[styles.errorText, { color: dangerText }]}>{errorMessage}</Text> : null}
            </ScrollView>
          </View>
        )}
      </Modal>
    </>
  );
}

// UI refresh (DESIGN.md "Style"): 16-corner cards, pill buttons, Style weights. Sizes unchanged (Task 3.19 decides density).
const styles = StyleSheet.create({
  title: { fontSize: 24, fontFamily: FONT.bold },
  subtitle: { marginTop: 4, fontSize: 15, lineHeight: 22, fontFamily: FONT.bold },
  doneText: { marginTop: 12, fontSize: 15, fontFamily: FONT.semiBold, color: GREEN[700] },
  errorText: { marginTop: 12, fontSize: 15, lineHeight: 22, fontFamily: FONT.semiBold, color: RED[600] },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 18, borderRadius: CORNER.card, borderWidth: 1 },
  noticeCopy: { flex: 1 },
  noticeTitle: { fontSize: 17, fontFamily: FONT.bold, color: NEUTRAL[900] },
  noticeText: { marginTop: 4, fontSize: 15, lineHeight: 22, fontFamily: FONT.semiBold, color: NEUTRAL[900] },
  emptyState: { marginTop: 14, padding: 22, borderRadius: CORNER.card, borderWidth: 1, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: FONT.bold, textAlign: "center" },
  list: { marginTop: 14, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: CORNER.card, borderWidth: 1, flexWrap: "wrap" },
  rowCopy: { flex: 1, minWidth: 180 },
  rowName: { fontSize: 18, fontFamily: FONT.bold },
  rowLine: { marginTop: 4, fontSize: 15, lineHeight: 21, fontFamily: FONT.semiBold },
  reviewButton: { minHeight: 48, paddingHorizontal: 22, borderRadius: CORNER.pill, backgroundColor: GREEN[600], alignItems: "center", justifyContent: "center" },
  reviewButtonText: { fontSize: 16, fontFamily: FONT.semiBold, color: "#FFFFFF" },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 12 },
  card: { width: "100%", maxWidth: 620, maxHeight: "94%", borderRadius: CORNER.card, borderWidth: 1, ...SHADOW.level3 },
  cardContent: { padding: 18, gap: 14 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardTitle: { fontSize: 22, fontFamily: FONT.bold },
  closeButton: { width: 48, height: 48, borderRadius: CORNER.pill, backgroundColor: NEUTRAL[100], alignItems: "center", justifyContent: "center" },
  photoBox: { width: "100%", borderRadius: 12 },
  photoMissing: { alignItems: "center", justifyContent: "center", padding: 16 },
  photoHintRow: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  photoHint: { fontSize: 14, fontFamily: FONT.medium },
  details: { padding: 14, borderRadius: 12, gap: 10 },
  detailRow: { gap: 2 },
  detailLabel: { fontSize: 14, fontFamily: FONT.medium },
  detailValue: { fontSize: 16, lineHeight: 22, fontFamily: FONT.semiBold },
  actionRow: { flexDirection: "row", gap: 12 },
  actionButton: { flex: 1, minHeight: 52, borderRadius: CORNER.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  approveButton: { backgroundColor: GREEN[600] },
  approveButtonText: { fontSize: 16, fontFamily: FONT.semiBold, color: "#FFFFFF" },
  rejectButton: { borderWidth: 2, borderColor: RED[600] },
  rejectButtonText: { fontSize: 16, fontFamily: FONT.semiBold, color: RED[600] },
  confirmRejectButton: { backgroundColor: RED[600] },
  cancelButton: { borderWidth: 2 },
  cancelButtonText: { fontSize: 16, fontFamily: FONT.semiBold },
  decisionBox: { gap: 12 },
  decisionText: { fontSize: 16, lineHeight: 23, fontFamily: FONT.semiBold },
  reasonInput: { fontFamily: FONT.regular, minHeight: 96, borderWidth: 1.5, borderRadius: 12, padding: 12, fontSize: 16, lineHeight: 22, textAlignVertical: "top" },
  reasonHint: { fontFamily: FONT.regular, fontSize: 15, lineHeight: 20 },
  fullPhotoPage: { flex: 1, backgroundColor: "#000000", alignItems: "center", justifyContent: "center", padding: 8 },
  fullPhoto: { width: "100%", height: "90%" },
  fullPhotoHint: { marginTop: 8, fontSize: 15, fontFamily: FONT.bold, color: "#FFFFFF" },
});
