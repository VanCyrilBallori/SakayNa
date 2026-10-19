import { FontAwesome } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";

import { ACCOUNT_STATUSES } from "../../../constants/app";
import ListSkeleton from "../../../components/ui/ListSkeleton";
import AdminSectionHeader from "./AdminSectionHeader";
import { CORNER, FONT, GREEN, NEUTRAL, ORANGE, RED, SHADOW } from "../../../constants/design";
import { formatDate, formatDateTime } from "../../../lib/dates";
import { reviewDriverApplication } from "../services/adminOperationsService";

// Dates are saved as text like "1985-01-15" (see register-driver.jsx). This turns that text back into a date.
const readSavedDate = (text) => {
  const [year, month, day] = String(text || "").split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
};

const getAge = (birthDate) => {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayNotYet =
    today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (birthdayNotYet) age -= 1;
  return age;
};

const getBirthDateLabel = (text) => {
  const birthDate = readSavedDate(text);
  return birthDate ? `${formatDate(birthDate)} (age ${getAge(birthDate)})` : "";
};

// One document photo: its name, the photo as big as the resident proof photo, and "tap for full screen".
// If this photo cannot load, only this box shows a message. The other photos still show.
function DocumentPhoto({ label, url, optional, height, theme, onOpen }) {
  const [failed, setFailed] = useState(false);

  return (
    <View style={styles.document}>
      <Text style={[styles.documentLabel, { color: theme.text }]}>{label}</Text>
      {!url ? (
        <View style={[styles.photoBox, styles.photoMissing, { height: 72, backgroundColor: theme.surfaceMuted }]}>
          <Text style={[styles.rowLine, { color: theme.text }]}>{optional ? "Not submitted (optional)" : "No photo was submitted."}</Text>
        </View>
      ) : failed ? (
        <View style={[styles.photoBox, styles.photoMissing, { height: 160, backgroundColor: theme.surfaceMuted }]}>
          <Text style={[styles.rowLine, { color: theme.text }]}>The photo could not be loaded. Check the internet connection, then open this again.</Text>
        </View>
      ) : (
        <Pressable onPress={() => onOpen({ url, label })} accessibilityRole="imagebutton" accessibilityLabel={`${label}. Tap to see it full screen.`}>
          <Image
            source={{ uri: url }}
            style={[styles.photoBox, { height, backgroundColor: theme.surfaceMuted }]}
            resizeMode="contain"
            onError={() => setFailed(true)}
          />
          <View style={styles.photoHintRow}>
            <FontAwesome name="expand" size={15} color={theme.mutedText} />
            <Text style={[styles.photoHint, { color: theme.mutedText }]}>Tap the photo to see it full screen</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

// A small round profile picture. Shows a person icon if there is no photo or it cannot load.
function ProfilePhoto({ url, size, theme }) {
  const [failed, setFailed] = useState(false);
  const shape = { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.surfaceMuted };

  if (!url || failed) {
    return (
      <View style={[shape, styles.profileFallback]}>
        <FontAwesome name="user" size={size / 2} color={theme.mutedText} />
      </View>
    );
  }
  return <Image source={{ uri: url }} style={shape} resizeMode="cover" onError={() => setFailed(true)} />;
}

// Admin → Driver Applications: the Pending driver applications of the Admin's own barangay.
// The Admin opens one, looks at every document photo, then Approves or Rejects with a reason.
// admin-home.jsx loads the list (only this barangay) and passes it in.
export default function AdminDriverApplicationsSection({ theme, adminId, adminBarangay, applications, isLoading, loadError }) {
  const { height } = useWindowDimensions();
  const [selected, setSelected] = useState(null);
  // "review" = Approve / Reject buttons. "approve" = are-you-sure. "reject" = reason box.
  const [mode, setMode] = useState("review");
  const [reason, setReason] = useState("");
  // The photo shown full screen: { url, label }, or null when none is open.
  const [fullPhoto, setFullPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [doneMessage, setDoneMessage] = useState("");

  const openReview = (application) => {
    setSelected(application);
    setMode("review");
    setReason("");
    setFullPhoto(null);
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
      setErrorMessage("Write a reason of at least 3 characters, so the driver knows what to fix.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    try {
      await reviewDriverApplication({ adminId, applicationId: selected.id, decision, reason });
      setDoneMessage(`${selected.fullName || "The driver"} was ${decision === ACCOUNT_STATUSES.APPROVED ? "approved" : "rejected"}.`);
      setSelected(null);
    } catch (error) {
      console.log("Driver application review failed:", error);
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
          <Text style={styles.noticeText}>It must be set in the Firebase Console. After that, the drivers of your barangay who are waiting for review will appear here.</Text>
        </View>
      </View>
    );
  }

  const photoHeight = Math.min(Math.max(height * 0.5, 300), 520);
  // Lighter red and green in Dark mode, so the text stays readable on the dark background.
  const dangerText = theme.mode === "Dark" ? "#FF9C94" : RED[600];
  const successText = theme.mode === "Dark" ? "#8FD9B3" : GREEN[700];

  const renderDetails = (rows) => (
    <View style={[styles.details, { backgroundColor: theme.surfaceMuted }]}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: theme.mutedText }]}>{label}</Text>
          <Text style={[styles.detailValue, { color: theme.text }]}>{value || "Not provided"}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <>
      <AdminSectionHeader
        icon="card-account-details-outline"
        title="Driver Applications"
        subtitle={`${adminBarangay} · ${isLoading ? "Loading..." : `${applications.length} waiting for review`}`}
      />

      {doneMessage ? <Text style={[styles.doneText, { color: successText }]}>{doneMessage}</Text> : null}

      {isLoading ? (
        <ListSkeleton label="Loading driver applications" />
      ) : loadError ? (
        <Text style={[styles.errorText, { color: dangerText }]}>{loadError}</Text>
      ) : applications.length ? (
        // One white list with thin lines between drivers, like Users (DESIGN.md "Admin website exception").
        <View style={[styles.list, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {applications.map((application, index) => (
            <View key={application.id} style={[styles.listRow, index > 0 && styles.listRowDivider]}>
              <ProfilePhoto url={application.profilePhotoUrl} size={40} theme={theme} />
              <View style={styles.rowCopy}>
                <Text style={[styles.rowName, { color: theme.text }]}>{application.fullName || "Unnamed driver"}</Text>
                <Text style={[styles.listDetail, { color: theme.mutedText }]}>
                  License {application.licenseNumber || "not given"} · Submitted {formatDateTime(application.submittedAt || application.createdAt)}
                </Text>
              </View>
              <TouchableOpacity style={styles.reviewButton} onPress={() => openReview(application)} accessibilityRole="button" accessibilityLabel={`Review ${application.fullName || "driver"}`}>
                <Text style={styles.reviewButtonText}>Review</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyState, { borderColor: theme.border }]}>
          <FontAwesome name="check-circle" size={28} color={GREEN[600]} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No drivers are waiting for review.</Text>
        </View>
      )}

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={fullPhoto ? () => setFullPhoto(null) : closeReview}>
        {fullPhoto ? (
          // Full-screen photo inside the same pop-up, so two pop-ups never stack.
          <Pressable style={styles.fullPhotoPage} onPress={() => setFullPhoto(null)} accessibilityRole="button" accessibilityLabel="Close full screen photo">
            <Text style={styles.fullPhotoLabel}>{fullPhoto.label}</Text>
            <Image source={{ uri: fullPhoto.url }} style={styles.fullPhoto} resizeMode="contain" />
            <Text style={styles.fullPhotoHint}>Tap anywhere to close</Text>
          </Pressable>
        ) : (
          <View style={[styles.overlay, { backgroundColor: theme.modalOverlay }]}>
            <ScrollView style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]} contentContainerStyle={styles.cardContent} keyboardShouldPersistTaps="handled">
              <View style={styles.cardHeader}>
                <Pressable
                  onPress={() => selected?.profilePhotoUrl && setFullPhoto({ url: selected.profilePhotoUrl, label: "Profile Picture" })}
                  accessibilityRole="imagebutton"
                  accessibilityLabel="Profile picture. Tap to see it full screen."
                >
                  <ProfilePhoto url={selected?.profilePhotoUrl} size={72} theme={theme} />
                </Pressable>
                <View style={styles.rowCopy}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{selected?.fullName || "Driver"}</Text>
                  <Text style={[styles.rowLine, { color: theme.text }]}>Driver application</Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={closeReview} accessibilityRole="button" accessibilityLabel="Close">
                  <FontAwesome name="close" size={20} color={NEUTRAL[900]} />
                </TouchableOpacity>
              </View>

              {renderDetails([
                ["Date of Birth", getBirthDateLabel(selected?.birthDate)],
                ["Contact Number", selected?.phoneNumber || selected?.phone],
                ["Email", selected?.email],
                ["Barangay", selected?.barangay],
                ["Address", selected?.address],
                ["Submitted", formatDateTime(selected?.submittedAt || selected?.createdAt)],
              ])}

              <DocumentPhoto label="Driver's License — Front" url={selected?.licenseFrontUrl} height={photoHeight} theme={theme} onOpen={setFullPhoto} />
              <DocumentPhoto label="Driver's License — Back" url={selected?.licenseBackUrl} height={photoHeight} theme={theme} onOpen={setFullPhoto} />
              {/* What the driver typed, right under the license photos, so the Admin can check they match. */}
              {renderDetails([
                ["License Number", selected?.licenseNumber],
                ["License Expires", formatDate(readSavedDate(selected?.licenseExpiry))],
              ])}

              <DocumentPhoto label={selected?.clearanceType || "NBI or Police Clearance"} url={selected?.clearancePhotoUrl} height={photoHeight} theme={theme} onOpen={setFullPhoto} />
              <DocumentPhoto label="Medical Certificate" url={selected?.medicalCertificateUrl} height={photoHeight} theme={theme} onOpen={setFullPhoto} />
              <DocumentPhoto label="Drug Test Clearance" url={selected?.drugTestUrl} optional height={photoHeight} theme={theme} onOpen={setFullPhoto} />

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
                    Approve {selected?.fullName || "this driver"}? They will be able to punch in and receive rides.
                  </Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionButton, styles.cancelButton, { borderColor: theme.mutedText }]} onPress={() => setMode("review")} disabled={saving} accessibilityRole="button">
                      <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => submitDecision(ACCOUNT_STATUSES.APPROVED)} disabled={saving} accessibilityRole="button">
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
                    placeholder="e.g. The license photo is blurry. Please upload a clearer photo."
                    placeholderTextColor={theme.mutedText}
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    maxLength={300}
                    editable={!saving}
                  />
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

// UI refresh (DESIGN.md "Style"): 16-corner cards, pill buttons, Style weights. List rows: DESIGN.md "Admin website exception" (Task 3.19).
const styles = StyleSheet.create({
  doneText: { marginTop: 12, fontSize: 15, fontFamily: FONT.semiBold, color: GREEN[700] },
  errorText: { marginTop: 12, fontSize: 15, lineHeight: 22, fontFamily: FONT.semiBold, color: RED[600] },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 18, borderRadius: CORNER.card, borderWidth: 1 },
  noticeCopy: { flex: 1 },
  noticeTitle: { fontSize: 17, fontFamily: FONT.bold, color: NEUTRAL[900] },
  noticeText: { marginTop: 4, fontSize: 15, lineHeight: 22, fontFamily: FONT.semiBold, color: NEUTRAL[900] },
  emptyState: { marginTop: 12, padding: 18, borderRadius: CORNER.card, borderWidth: 1, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: FONT.bold, textAlign: "center" },
  // One white list box with thin lines between people (like Users).
  list: { marginTop: 12, borderRadius: CORNER.card, borderWidth: 1, overflow: "hidden" },
  listRow: { minHeight: 56, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 14 },
  listRowDivider: { borderTopWidth: 1, borderTopColor: NEUTRAL[200] },
  listIcon: { width: 40, height: 40, borderRadius: CORNER.pill, alignItems: "center", justifyContent: "center", backgroundColor: GREEN[50] },
  listDetail: { marginTop: 2, fontSize: 15, lineHeight: 20, fontFamily: FONT.medium },
  rowCopy: { flex: 1, minWidth: 160 },
  rowName: { fontSize: 17, lineHeight: 22, fontFamily: FONT.bold },
  rowLine: { marginTop: 4, fontSize: 15, lineHeight: 21, fontFamily: FONT.semiBold },
  reviewButton: { minHeight: 40, paddingHorizontal: 18, borderRadius: CORNER.pill, backgroundColor: GREEN[600], alignItems: "center", justifyContent: "center" },
  reviewButtonText: { fontSize: 16, fontFamily: FONT.semiBold, color: "#FFFFFF" },
  profileFallback: { alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 12 },
  card: { width: "100%", maxWidth: 620, maxHeight: "94%", borderRadius: CORNER.card, borderWidth: 1, ...SHADOW.level3 },
  cardContent: { padding: 18, gap: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTitle: { fontSize: 22, fontFamily: FONT.bold },
  closeButton: { width: 48, height: 48, borderRadius: CORNER.pill, backgroundColor: NEUTRAL[100], alignItems: "center", justifyContent: "center" },
  document: { marginTop: 8, gap: 8 },
  documentLabel: { fontSize: 17, fontFamily: FONT.bold },
  photoBox: { width: "100%", borderRadius: 12 },
  photoMissing: { alignItems: "center", justifyContent: "center", padding: 16 },
  photoHintRow: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  photoHint: { fontSize: 15, fontFamily: FONT.medium },
  details: { padding: 14, borderRadius: 12, gap: 10 },
  detailRow: { gap: 2 },
  detailLabel: { fontSize: 15, fontFamily: FONT.medium },
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
  decisionBox: { marginTop: 8, gap: 12 },
  decisionText: { fontSize: 16, lineHeight: 23, fontFamily: FONT.semiBold },
  reasonInput: { fontFamily: FONT.regular, minHeight: 96, borderWidth: 1.5, borderRadius: 12, padding: 12, fontSize: 16, lineHeight: 22, textAlignVertical: "top" },
  fullPhotoPage: { flex: 1, backgroundColor: "#000000", alignItems: "center", justifyContent: "center", padding: 8, paddingTop: 32 },
  fullPhotoLabel: { marginBottom: 8, fontSize: 17, fontFamily: FONT.bold, color: "#FFFFFF" },
  fullPhoto: { width: "100%", height: "84%" },
  fullPhotoHint: { marginTop: 8, fontSize: 15, fontFamily: FONT.bold, color: "#FFFFFF" },
});
