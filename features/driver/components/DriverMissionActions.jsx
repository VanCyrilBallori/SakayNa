import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Animated, Easing, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppButton from "../../../components/ui/AppButton";
import FeedbackMessage from "../../../components/ui/FeedbackMessage";
import { CORNER, FONT, GREEN, NEUTRAL, SHADOW, SPACING } from "../../../constants/design";
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
  const { height } = useWindowDimensions();
  const [unableOpen, setUnableOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  // Same approach as MobileLanding: only the card moves; the full-screen dark layer fades.
  const [completeY] = useState(() => new Animated.Value(0));
  const completionClosingRef = useRef(false);
  const completeBackdropOpacity = completeY.interpolate({ inputRange: [0, height], outputRange: [1, 0], extrapolate: "clamp" });
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [outcome, setOutcome] = useState("");
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

  const slideCompleteIn = () => {
    Animated.timing(completeY, { toValue: 0, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  const slideCompleteOut = () => new Promise((resolve) => {
    Animated.timing(completeY, { toValue: height, duration: 200, useNativeDriver: true }).start(({ finished }) => resolve(finished));
  });

  // Back closes only after the slide/fade finishes. Ignore extra taps during closing or saving.
  const closeComplete = async () => {
    if (savingRef.current || completionClosingRef.current) return;
    completionClosingRef.current = true;
    if (await slideCompleteOut()) setCompleteOpen(false);
    completionClosingRef.current = false;
  };

  const complete = () => {
    if (savingRef.current || completionClosingRef.current) return;
    if (!validateCompletion(outcome)) {
      setError("Choose an outcome.");
      return;
    }
    run(async () => {
      // The saved ride removes this component. Finish the fade first so it cannot be cut off.
      if (!(await slideCompleteOut())) {
        slideCompleteIn();
        throw new Error("Completion was interrupted. Try again.");
      }
      try {
        await advanceMission({ assignmentId: assignment.id, driverId, nextStatus: MISSION_STATUSES.COMPLETED, completion: { outcome, notes: "", issues: completionIssues.trim() } });
        setCompleteOpen(false);
      } catch (e) {
        // A failed save brings the form back with the same entries and the error.
        slideCompleteIn();
        throw e;
      }
    }, "Mission completed successfully.");
  };

  const move = (next, message) => run(() => advanceMission({ assignmentId: assignment.id, driverId, nextStatus: next, completion: {} }), message);

  return (
    <>
      {/* The "Navigate to pickup / destination" button is on the Map page now (DriverNavigateButton.jsx, driver-pages-plan.md Step 1). */}
      <View style={styles.actions}>
        {status === MISSION_STATUSES.ASSIGNED ? <AppButton label="Accept ride" loading={saving} onPress={accept} style={styles.mainButton} /> : null}
        {status === MISSION_STATUSES.ACCEPTED ? <AppButton label="Mark en route" onPress={() => move(MISSION_STATUSES.EN_ROUTE, "Mission marked en route.")} loading={saving} style={styles.mainButton} /> : null}
        {status === MISSION_STATUSES.EN_ROUTE ? <AppButton label="Confirm arrival" onPress={() => move(MISSION_STATUSES.ARRIVED, "Arrival recorded.")} loading={saving} style={styles.mainButton} /> : null}
        {status === MISSION_STATUSES.ARRIVED ? <AppButton label="Confirm pickup" onPress={() => move(MISSION_STATUSES.PICKED_UP, "Passenger pickup recorded.")} loading={saving} style={styles.mainButton} /> : null}
        {status === MISSION_STATUSES.PICKED_UP ? (
          <AppButton
            label="Complete mission"
            loading={saving}
            onPress={() => {
              if (savingRef.current || completionClosingRef.current) return;
              completeY.setValue(height);
              setOutcome("");
              setCompletionIssues("");
              setError("");
              setCompleteOpen(true);
            }}
            style={styles.mainButton}
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
          <MaterialCommunityIcons name="alert-circle-outline" size={24} color={NEUTRAL[900]} />
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
            <MaterialCommunityIcons name="phone-outline" size={24} color={GREEN[700]} />
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
                placeholderTextColor={NEUTRAL[600]}
                multiline
                maxLength={300}
                textAlignVertical="top"
                accessibilityLabel="More details"
              />
              {error ? <FeedbackMessage message={error} tone="error" /> : null}

              {/* Main action on top, full width; Keep underneath (DESIGN.md). Red: once sent, the ride is gone from you. */}
              <AppButton label="Send to dispatch" variant="danger" loading={saving} onPress={sendUnable} style={[styles.mainButton, styles.sendButton]} />
              <AppButton label="Keep this ride" variant="secondary" disabled={saving} onPress={() => setUnableOpen(false)} style={styles.keepButton} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={completeOpen} transparent animationType="none" onShow={slideCompleteIn} onRequestClose={closeComplete} statusBarTranslucent navigationBarTranslucent>
        <View style={styles.completionContainer}>
          <Animated.View style={[styles.completionBackdrop, { opacity: completeBackdropOpacity }]} pointerEvents="none" />
          <KeyboardAvoidingView behavior="padding" style={[styles.overlay, styles.completionOverlay, { paddingTop: insets.top + SPACING.lg, paddingBottom: insets.bottom + SPACING.lg }]}>
            <Animated.View style={[styles.modal, styles.completionModal, { transform: [{ translateY: completeY }] }]}>
              <ScrollView style={styles.completionScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.title} accessibilityRole="header">Complete mission</Text>
                <Dropdown
                  fontFamily={FONT.regular}
                  style={styles.dropdown}
                  placeholderStyle={styles.dropdownPlaceholder}
                  selectedTextStyle={styles.dropdownText}
                  itemTextStyle={styles.dropdownText}
                  containerStyle={styles.dropdownList}
                  data={COMPLETION_OUTCOMES.map((value) => ({ label: value, value }))}
                  labelField="label"
                  valueField="value"
                  value={outcome}
                  onChange={(item) => setOutcome(item.value)}
                  placeholder="Choose outcome"
                />
                <TextInput style={styles.input} value={completionIssues} onChangeText={setCompletionIssues} placeholder="Issues encountered (optional)" placeholderTextColor={NEUTRAL[600]} multiline maxLength={300} textAlignVertical="top" />
                {error ? <FeedbackMessage message={error} tone="error" /> : null}
                <View style={styles.row}>
                  <AppButton label="Confirm completion" loading={saving} onPress={complete} style={styles.action} />
                  <AppButton label="Back" variant="secondary" disabled={saving} onPress={closeComplete} style={styles.action} />
                </View>
              </ScrollView>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const RADIO_SIZE = 24;

const styles = StyleSheet.create({
  actions: {},
  // Accept and the step buttons (Mark en route...): full width, 56 tall, a green pill (AppButton primary).
  mainButton: { width: "100%", minHeight: 56 },
  // "I can't do this ride": no fill and no edge, Ink words, 48 tall (easy to tap, but quieter than Accept).
  quietButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, paddingHorizontal: 20, borderRadius: CORNER.pill },
  quietButtonPressed: { backgroundColor: NEUTRAL[100] },
  quietButtonText: { fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: NEUTRAL[900], textDecorationLine: "underline" },
  // "Call dispatch": a secondary pill (white, grey edge, green words), like "Call passenger" on the ride card.
  callButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 56, paddingHorizontal: 20, borderRadius: CORNER.pill, borderWidth: 1.5, borderColor: NEUTRAL[500], backgroundColor: NEUTRAL[0] },
  callButtonText: { fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: GREEN[700] },
  noPhoneText: { fontFamily: FONT.regular, fontSize: 17, lineHeight: 24, color: NEUTRAL[700], textAlign: "center" },

  row: { gap: SPACING.md, marginTop: SPACING.lg },
  action: { width: "100%", minHeight: 56 },
  completionContainer: { flex: 1 },
  completionBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20, 33, 28, 0.55)" },
  completionOverlay: { backgroundColor: "transparent" },
  completionModal: { maxHeight: "100%", flexShrink: 1 },
  completionScroll: { flexGrow: 0 },
  // ---- Pop-ups (DESIGN.md Style): a dark see-through backdrop, white dialogs with 16 corners and a Level 3 shadow. ----
  overlay: { flex: 1, justifyContent: "center", padding: SPACING.lg, backgroundColor: "rgba(20, 33, 28, 0.55)" },
  modal: { width: "100%", maxWidth: 560, maxHeight: "90%", alignSelf: "center", padding: 24, borderRadius: CORNER.card, backgroundColor: NEUTRAL[0], ...SHADOW.level3 },
  title: { fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: NEUTRAL[900] },
  // Inputs and the drop-down (DESIGN.md Style): white, 12 corners, a 1.5 grey edge, 17 words.
  input: { minHeight: 96, marginTop: SPACING.md, padding: 14, borderWidth: 1.5, borderColor: NEUTRAL[500], borderRadius: CORNER.input, backgroundColor: NEUTRAL[0], fontSize: 17, lineHeight: 22, fontFamily: FONT.regular, color: NEUTRAL[900] },
  dropdown: { minHeight: 52, marginTop: SPACING.lg, paddingHorizontal: 14, borderWidth: 1.5, borderColor: NEUTRAL[500], borderRadius: CORNER.input, backgroundColor: NEUTRAL[0] },
  dropdownPlaceholder: { fontSize: 17, fontFamily: FONT.regular, color: NEUTRAL[600] },
  dropdownText: { fontSize: 17, fontFamily: FONT.regular, color: NEUTRAL[900] },
  dropdownList: { borderRadius: CORNER.input, overflow: "hidden" },

  // The "I can't do this ride" pop-up. flexShrink lets it get shorter when the keyboard opens.
  unableModal: { maxHeight: "100%", flexShrink: 1 },
  unableScroll: { flexGrow: 0 },
  unableTitle: { fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: NEUTRAL[900] },
  unableText: { fontFamily: FONT.regular, marginTop: 8, fontSize: 17, lineHeight: 24, color: NEUTRAL[700] },
  unableLabel: { marginTop: 16, marginBottom: 4, fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: NEUTRAL[900] },
  // Selected list rows have 12 corners (DESIGN.md Style).
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, marginTop: 4, paddingHorizontal: 12, borderRadius: CORNER.input },
  // The chosen reason: a filled circle AND a light green row (not color alone).
  reasonRowChosen: { backgroundColor: GREEN[50] },
  radio: { width: RADIO_SIZE, height: RADIO_SIZE, borderRadius: RADIO_SIZE / 2, borderWidth: 2, borderColor: NEUTRAL[500], alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL[0] },
  radioChosen: { borderColor: GREEN[600] },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: GREEN[600] },
  reasonText: { flex: 1, fontSize: 17, lineHeight: 22, fontFamily: FONT.medium, color: NEUTRAL[900] },
  unableInput: { fontFamily: FONT.regular, minHeight: 96, marginTop: 12, padding: 14, borderWidth: 1.5, borderColor: NEUTRAL[500], borderRadius: CORNER.input, backgroundColor: NEUTRAL[0], fontSize: 17, lineHeight: 22, color: NEUTRAL[900] },
  sendButton: { marginTop: 16 },
  keepButton: { width: "100%", minHeight: 56, marginTop: 12 },
});
