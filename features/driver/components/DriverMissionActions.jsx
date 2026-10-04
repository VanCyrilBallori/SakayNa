import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppButton from "../../../components/ui/AppButton";
import FeedbackMessage from "../../../components/ui/FeedbackMessage";
import { COLORS, DESIGN_COLORS, RADIUS, SPACING } from "../../../constants/design";
import { MISSION_STATUSES } from "../../../constants/app";
import { startPhoneCall } from "../../../lib/phoneCall";
import { acceptAssignment, advanceMission, reportUnable } from "../services/driverMissionService";
import DriverRideSteps from "./DriverRideSteps";
import { getMissionStatus } from "../utils/driverMissionMapper";
import { COMPLETION_OUTCOMES, UNABLE_REASONS, validateCompletion, validateUnable } from "../utils/driverMissionValidation";

// "I can't do this ride" may be sent until the driver is at the pickup (driver-pages-plan.md, answer 1).
// After "Picked up" the rider is in the vehicle, so the driver calls dispatch instead.
const UNABLE_STEPS = [MISSION_STATUSES.ASSIGNED, MISSION_STATUSES.ACCEPTED, MISSION_STATUSES.EN_ROUTE, MISSION_STATUSES.ARRIVED];

// The buttons under the ride card: Accept, the green step button, the Ride steps list,
// "I can't do this ride" (or "Call dispatch" once the rider is on board), and their pop-ups.
// officePhone = the office number the admin saved ("" if none). onUnableSent(reason) = tells driver-home.jsx to show its note.
export default function DriverMissionActions({ assignment, driverId, officePhone, onFeedback, onUnableSent }) {
  const insets = useSafeAreaInsets();
  const [unableOpen, setUnableOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [completionIssues, setCompletionIssues] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const status = getMissionStatus(assignment);

  // Runs one save. savingRef stops a double tap from saving twice.
  const run = async (action, success) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await action();
      onFeedback?.(success, "success");
    } catch (e) {
      setError(e?.message || "The mission update could not be saved. Try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // One tap accepts (driver-home-restyle-plan.md Piece 1). The vehicle checklist is no longer asked; old checklists stay saved.
  const accept = () => run(() => acceptAssignment({ assignmentId: assignment.id, driverId }), "Assignment accepted. Mark En Route when you are ready to depart.");

  const openUnable = () => {
    setReason("");
    setDetails("");
    setError("");
    setUnableOpen(true);
  };

  // "I can't do this ride": a reason is required. The ride goes back to the dispatcher (reportUnable).
  const sendUnable = () => {
    if (!validateUnable(reason, details)) {
      setError(reason ? "Write what the problem is (at least 3 letters)." : "Choose a reason.");
      return;
    }
    run(async () => {
      await reportUnable({ assignmentId: assignment.id, reason, details });
      setUnableOpen(false);
      onUnableSent?.(reason);
    }, "");
  };

  const complete = () => {
    if (!validateCompletion(outcome, notes)) {
      setError("Choose an outcome and enter completion notes (1-500 characters).");
      return;
    }
    run(async () => {
      await advanceMission({ assignmentId: assignment.id, driverId, nextStatus: MISSION_STATUSES.COMPLETED, completion: { outcome, notes: notes.trim(), issues: completionIssues.trim() } });
      setCompleteOpen(false);
    }, "Mission completed successfully.");
  };

  const move = (next, message) => run(() => advanceMission({ assignmentId: assignment.id, driverId, nextStatus: next, completion: {} }), message);

  return (
    <>
      {/* The "Navigate to pickup / destination" button is on the Map page now (DriverNavigateButton.jsx, driver-pages-plan.md Step 1). */}
      <View style={styles.actions}>
        {status === MISSION_STATUSES.ASSIGNED ? <AppButton label="Accept ride" loading={saving} onPress={accept} style={styles.mainButton} textStyle={styles.buttonText} /> : null}
        {status === MISSION_STATUSES.ACCEPTED ? <AppButton label="Mark en route" onPress={() => move(MISSION_STATUSES.EN_ROUTE, "Mission marked en route.")} loading={saving} style={styles.mainButton} textStyle={styles.buttonText} /> : null}
        {status === MISSION_STATUSES.EN_ROUTE ? <AppButton label="Confirm arrival" onPress={() => move(MISSION_STATUSES.ARRIVED, "Arrival recorded.")} loading={saving} style={styles.mainButton} textStyle={styles.buttonText} /> : null}
        {status === MISSION_STATUSES.ARRIVED ? <AppButton label="Confirm pickup" onPress={() => move(MISSION_STATUSES.PICKED_UP, "Passenger pickup recorded.")} loading={saving} style={styles.mainButton} textStyle={styles.buttonText} /> : null}
        {status === MISSION_STATUSES.PICKED_UP ? (
          <AppButton
            label="Complete mission"
            onPress={() => {
              setOutcome("");
              setNotes("");
              setCompletionIssues("");
              setError("");
              setCompleteOpen(true);
            }}
            style={styles.mainButton}
            textStyle={styles.buttonText}
          />
        ) : null}
        {/* Errors from Accept and the step buttons (e.g. "Tap Resume duty, then accept this ride."). The pop-ups show their own. */}
        {error && !unableOpen && !completeOpen ? <FeedbackMessage message={error} tone="error" /> : null}
      </View>

      {/* The "Ride steps" list, under the step button so the button stays on screen (driver-home-restyle-plan.md Piece 4b). Only after Accept. */}
      {status !== MISSION_STATUSES.ASSIGNED ? <DriverRideSteps assignment={assignment} status={status} /> : null}

      {/* "I can't do this ride": plain words, no fill, so it never looks like Accept (driver-pages-plan.md Step 2a). */}
      {UNABLE_STEPS.includes(status) ? (
        <Pressable style={({ pressed }) => [styles.quietButton, pressed && styles.quietButtonPressed]} onPress={openUnable} disabled={saving} accessibilityRole="button">
          <MaterialCommunityIcons name="alert-circle-outline" size={22} color={DESIGN_COLORS.ink} />
          <Text style={styles.quietButtonText}>I can&apos;t do this ride</Text>
        </Pressable>
      ) : null}

      {/* The rider is on board: problems during the trip go by phone to the office (driver-pages-plan.md, answer 1). */}
      {status === MISSION_STATUSES.PICKED_UP ? (
        officePhone ? (
          <Pressable
            style={({ pressed }) => [styles.callButton, pressed && styles.quietButtonPressed]}
            onPress={() => startPhoneCall(officePhone)}
            accessibilityRole="button"
            accessibilityLabel={`Call dispatch at ${officePhone}`}
          >
            <MaterialCommunityIcons name="phone-outline" size={24} color={DESIGN_COLORS.hallGreen} />
            <Text style={styles.callButtonText}>Call dispatch</Text>
          </Pressable>
        ) : (
          <Text style={styles.noPhoneText}>Problem during the trip? Call the barangay office. (The office number is not saved in the app yet.)</Text>
        )
      ) : null}

      {/* The "I can't do this ride" pop-up. Full screen (translucent) so the keyboard space is measured correctly; it scrolls with large text. */}
      <Modal visible={unableOpen} transparent animationType="fade" onRequestClose={() => !saving && setUnableOpen(false)} statusBarTranslucent navigationBarTranslucent>
        <KeyboardAvoidingView behavior="padding" style={[styles.overlay, { paddingTop: insets.top + SPACING.lg, paddingBottom: insets.bottom + SPACING.lg }]}>
          <View style={[styles.modal, styles.unableModal]}>
            <ScrollView style={styles.unableScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.unableTitle} accessibilityRole="header">I can&apos;t do this ride</Text>
              <Text style={styles.unableText}>Dispatch will be told right away and will give this ride to another driver.</Text>

              <Text style={styles.unableLabel}>Why?</Text>
              {/* Four big choices, one tap each (easier than a drop-down list). */}
              <View accessibilityRole="radiogroup">
                {UNABLE_REASONS.map((item) => {
                  const chosen = reason === item;
                  return (
                    <Pressable
                      key={item}
                      style={({ pressed }) => [styles.reasonRow, chosen && styles.reasonRowChosen, pressed && styles.quietButtonPressed]}
                      onPress={() => setReason(item)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: chosen }}
                    >
                      <View style={[styles.radio, chosen && styles.radioChosen]}>{chosen ? <View style={styles.radioDot} /> : null}</View>
                      <Text style={styles.reasonText}>{item}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                style={styles.unableInput}
                value={details}
                onChangeText={setDetails}
                placeholder={reason === "Other" ? "What is the problem? (needed)" : "More details (optional)"}
                placeholderTextColor={DESIGN_COLORS.placeholder}
                multiline
                maxLength={300}
                textAlignVertical="top"
                accessibilityLabel="More details"
              />
              {error ? <FeedbackMessage message={error} tone="error" /> : null}

              {/* Main action on top, full width; Keep underneath (DESIGN.md). Red: once sent, the ride is gone from you. */}
              <AppButton label="Send to dispatch" loading={saving} onPress={sendUnable} style={[styles.mainButton, styles.sendButton]} textStyle={styles.buttonText} />
              <AppButton label="Keep this ride" variant="secondary" disabled={saving} onPress={() => setUnableOpen(false)} style={styles.keepButton} textStyle={[styles.buttonText, styles.keepText]} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={completeOpen} transparent animationType="slide" onRequestClose={() => !saving && setCompleteOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.title}>Complete mission</Text>
            <Dropdown style={styles.dropdown} data={COMPLETION_OUTCOMES.map((value) => ({ label: value, value }))} labelField="label" valueField="value" value={outcome} onChange={(item) => setOutcome(item.value)} placeholder="Choose outcome" />
            <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="Completion notes" multiline maxLength={500} textAlignVertical="top" />
            <TextInput style={styles.input} value={completionIssues} onChangeText={setCompletionIssues} placeholder="Issues encountered (optional)" multiline maxLength={300} textAlignVertical="top" />
            {error ? <FeedbackMessage message={error} tone="error" /> : null}
            <View style={styles.row}>
              <AppButton label="Back" variant="secondary" onPress={() => setCompleteOpen(false)} style={styles.action} />
              <AppButton label="Confirm completion" loading={saving} onPress={complete} style={styles.action} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const RADIO_SIZE = 24;

const styles = StyleSheet.create({
  actions: {},
  // Accept and the step buttons (Mark en route...): full width, 56 tall, Hall Green.
  mainButton: { width: "100%", minHeight: 56, borderRadius: 16, backgroundColor: DESIGN_COLORS.hallGreen },
  buttonText: { fontSize: 17, lineHeight: 22, fontWeight: "700" },
  // "I can't do this ride": no fill and no edge, Ink words, 48 tall (easy to tap, but quieter than Accept).
  quietButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, paddingHorizontal: 16, borderRadius: 16 },
  quietButtonPressed: { backgroundColor: DESIGN_COLORS.boardTint },
  quietButtonText: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink, textDecorationLine: "underline" },
  // "Call dispatch": white with an edge, like "Call passenger" on the ride card.
  callButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 56, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1.5, borderColor: DESIGN_COLORS.controlOutline, backgroundColor: DESIGN_COLORS.paperWhite },
  callButtonText: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.hallGreen },
  noPhoneText: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted, textAlign: "center" },

  row: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg },
  action: { flex: 1 },
  overlay: { flex: 1, justifyContent: "center", padding: SPACING.lg, backgroundColor: "rgba(13,31,24,.62)" },
  modal: { width: "100%", maxWidth: 560, maxHeight: "90%", alignSelf: "center", padding: SPACING.lg, borderRadius: RADIUS.md, backgroundColor: COLORS.surface },
  title: { color: COLORS.text, fontSize: 21, fontWeight: "800" },
  input: { minHeight: 76, marginTop: SPACING.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, color: COLORS.text },
  dropdown: { minHeight: 50, marginTop: SPACING.md, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm },

  // The "I can't do this ride" pop-up (DESIGN.md sizes and colors). flexShrink lets it get shorter when the keyboard opens.
  unableModal: { maxHeight: "100%", flexShrink: 1, borderRadius: 24, backgroundColor: DESIGN_COLORS.paperWhite },
  unableScroll: { flexGrow: 0 },
  unableTitle: { fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.ink },
  unableText: { marginTop: 8, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted },
  unableLabel: { marginTop: 16, marginBottom: 4, fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, marginTop: 4, paddingHorizontal: 12, borderRadius: 16 },
  // The chosen reason: a filled circle AND a Board Tint row (not color alone).
  reasonRowChosen: { backgroundColor: DESIGN_COLORS.boardTint },
  radio: { width: RADIO_SIZE, height: RADIO_SIZE, borderRadius: RADIO_SIZE / 2, borderWidth: 2, borderColor: DESIGN_COLORS.controlOutline, alignItems: "center", justifyContent: "center", backgroundColor: DESIGN_COLORS.paperWhite },
  radioChosen: { borderColor: DESIGN_COLORS.hallGreen },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: DESIGN_COLORS.hallGreen },
  reasonText: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: "500", color: DESIGN_COLORS.ink },
  unableInput: { minHeight: 76, marginTop: 12, padding: 12, borderWidth: 1.5, borderColor: DESIGN_COLORS.controlOutline, borderRadius: 16, fontSize: 17, lineHeight: 22, color: DESIGN_COLORS.ink },
  sendButton: { marginTop: 16, backgroundColor: DESIGN_COLORS.emergencyRed },
  keepButton: { width: "100%", minHeight: 56, marginTop: 8, borderRadius: 16, borderWidth: 1.5, borderColor: DESIGN_COLORS.controlOutline, backgroundColor: DESIGN_COLORS.paperWhite },
  keepText: { color: DESIGN_COLORS.ink },
});
