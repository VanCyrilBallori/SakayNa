import { MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DESIGN_COLORS } from "../../../constants/design";
import { db } from "../../../firebase";
import { getTimestampMillis } from "../../../lib/dates";
import { formatDutyDuration, formatManilaTime, formatTimer, summarizeShift } from "../../../lib/dutyTime";
import { endBreak, punchIn, punchOut, startBreak } from "../services/driverDutyService";

// If a save takes longer than this, the internet is probably slow or off.
const SLOW_SAVE_MS = 8000;

// The three kinds of break (the same list is checked in firestore.rules).
// "Lunch" replaced "Meal" (Oct 2026). Old records keep "Meal".
const BREAK_TYPES = [
  { value: "Lunch", label: "Lunch", icon: "silverware-fork-knife" },
  { value: "Rest", label: "Rest", icon: "coffee-outline" },
  { value: "Personal", label: "Personal", icon: "account-outline" },
];
// "Meal" is still here for a driver who started a Meal break on the older app.
const BREAK_ICONS = { Lunch: "silverware-fork-knife", Meal: "silverware-fork-knife", Rest: "coffee-outline", Personal: "account-outline" };

// The driver's duty status card at the top of the driver home (driver-duty-plan.md, DESIGN.md look).
// "duty" comes from the driver's own users/{uid} profile: { dutyStatus, dutyStatusSince, shiftId, breakType, breakNote }.
// activeRideStatus = the status of the driver's current ride ("Assigned" or "In Progress"), or "" if none.
// rideTitle = what the current ride is for (shown on the "On a run" card).
export default function DriverDutyCard({ driverId, driverName, duty, activeRideStatus = "", rideTitle = "" }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const dutyStatus = duty.dutyStatus;
  const shiftId = duty.shiftId;
  const [shiftRecords, setShiftRecords] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", tone: "info" });
  const [punchOutOpen, setPunchOutOpen] = useState(false);
  const savingRef = useRef(false);
  // "Take a break" sheet.
  const [breakSheetOpen, setBreakSheetOpen] = useState(false);
  const [chosenBreakType, setChosenBreakType] = useState("");
  const [breakNoteInput, setBreakNoteInput] = useState("");
  // How far the sheet is pushed down (0 = open). The dark background fades as it moves.
  const sheetHeight = height * 0.85;
  const [sheetY] = useState(() => new Animated.Value(0));
  const backdropOpacity = sheetY.interpolate({ inputRange: [0, sheetHeight], outputRange: [1, 0], extrapolate: "clamp" });

  // This shift's duty records, live. Pending saves show at once, with Firestore's estimated time.
  useEffect(() => {
    if (!driverId || !shiftId || dutyStatus === "Off duty") {
      setShiftRecords([]);
      return undefined;
    }

    const shiftQuery = query(collection(db, "dutyRecords"), where("driverId", "==", driverId), where("shiftId", "==", shiftId));
    return onSnapshot(
      shiftQuery,
      (snapshot) => setShiftRecords(snapshot.docs.map((recordDoc) => recordDoc.data({ serverTimestamps: "estimate" }))),
      (error) => console.log("Duty records listener warning:", error)
    );
  }, [driverId, shiftId, dutyStatus]);

  // The timer ticks once a second while the driver is punched in.
  // (Only the on-screen count uses the phone clock; saved times come from Firestore.)
  useEffect(() => {
    if (dutyStatus === "Off duty") return undefined;
    setNow(Date.now());
    const intervalId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, [dutyStatus]);

  const summary = summarizeShift(shiftRecords, now);

  // Runs one save. Shows "Saving..." and, if it is slow, a hint about the internet.
  const runSave = async (save, failText) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage({ text: "", tone: "info" });
    const slowTimer = setTimeout(() => setMessage({ text: "Still saving. Check your internet.", tone: "info" }), SLOW_SAVE_MS);

    try {
      await save();
      setMessage({ text: "", tone: "info" });
    } catch (error) {
      console.log("Duty status save failed:", error);
      setMessage({ text: failText, tone: "error" });
    } finally {
      clearTimeout(slowTimer);
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handlePunchIn = () =>
    runSave(() => punchIn({ driverId, driverName }), "We couldn't punch you in. Check your internet and try again.");

  const handlePunchOut = () => {
    setPunchOutOpen(false);
    runSave(() => punchOut({ driverId, driverName, shiftId }), "We couldn't punch you out. Check your internet and try again.");
  };

  // The sheet starts hidden below the screen, then slides up once it is shown (same as BottomSheetPicker).
  const openBreakSheet = () => {
    setChosenBreakType("");
    setBreakNoteInput("");
    sheetY.setValue(sheetHeight);
    setBreakSheetOpen(true);
  };
  const slideSheetIn = () => {
    Animated.timing(sheetY, { toValue: 0, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };
  const closeBreakSheet = () => {
    Animated.timing(sheetY, { toValue: sheetHeight, duration: 200, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setBreakSheetOpen(false);
    });
  };

  const handleStartBreak = () => {
    if (!chosenBreakType) return;
    const breakType = chosenBreakType;
    const breakNote = breakNoteInput;
    closeBreakSheet();
    runSave(() => startBreak({ driverId, driverName, shiftId, breakType, breakNote }), "We couldn't start your break. Check your internet and try again.");
  };

  const handleResumeDuty = () =>
    runSave(() => endBreak({ driverId, driverName, shiftId }), "We couldn't end your break. Check your internet and try again.");

  // How long the current break has lasted (dutyStatusSince = when the break started, Firestore's time).
  const breakStartMs = getTimestampMillis(duty.dutyStatusSince);
  const breakLengthMs = breakStartMs === null ? null : Math.max(0, now - breakStartMs);

  return (
    <View>
      {dutyStatus === "On break" ? (
        <View style={[styles.card, styles.cardOnBreak]}>
          <View style={styles.statusRow}>
            <MaterialCommunityIcons name={BREAK_ICONS[duty.breakType] || "coffee-outline"} size={30} color={DESIGN_COLORS.orangeDeep} />
            <Text style={[styles.statusWord, styles.inkText]} accessibilityRole="header">
              On break
            </Text>
          </View>
          <Text style={[styles.timerText, styles.inkText]} accessibilityLabel={`${duty.breakType || "Break"} break for ${formatDutyDuration(breakLengthMs ?? 0)}`}>
            {duty.breakType || "Break"} break · {breakLengthMs === null ? "--:--:--" : formatTimer(breakLengthMs)}
          </Text>
          {duty.breakNote ? <Text style={[styles.bodyText, styles.inkText]}>Note: {duty.breakNote}</Text> : null}
          <Text style={[styles.smallText, styles.inkText]}>Dispatch can&apos;t give you rides. Your time on duty is paused.</Text>

          <Pressable
            style={({ pressed }) => [styles.mainButton, styles.punchInButton, pressed && styles.punchInPressed, saving && styles.buttonBusy]}
            onPress={handleResumeDuty}
            disabled={saving}
            android_ripple={{ color: "rgba(255, 255, 255, 0.2)" }}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving, busy: saving }}
          >
            {saving ? <ActivityIndicator color={DESIGN_COLORS.paperWhite} /> : <MaterialCommunityIcons name="play-outline" size={28} color={DESIGN_COLORS.paperWhite} />}
            <Text style={styles.punchInText}>{saving ? "Saving..." : "Resume duty"}</Text>
          </Pressable>
        </View>
      ) : dutyStatus === "On a run" ? (
        // Set by itself when the driver accepts a ride, back to Available when the ride is completed.
        // No buttons: the driver can't take a break or punch out during a run.
        <View style={[styles.card, styles.cardOnRun]}>
          <View style={styles.statusRow}>
            <MaterialCommunityIcons name="van-utility" size={30} color={DESIGN_COLORS.paperWhite} />
            <Text style={[styles.statusWord, styles.whiteText]} accessibilityRole="header">
              On a run
            </Text>
          </View>
          {rideTitle ? <Text style={[styles.timerText, styles.whiteText]}>{rideTitle}</Text> : null}
          <Text style={[styles.smallText, styles.whiteText]} accessibilityLabel={`On duty for ${formatDutyDuration(summary.onDutyMs)}`}>
            On duty for {summary.punchInMs === null ? "--:--:--" : formatTimer(summary.onDutyMs)}
          </Text>
          <Text style={[styles.rideWaitingText, styles.whiteText]}>Complete the ride below to be available again.</Text>
        </View>
      ) : dutyStatus === "Off duty" ? (
        <View style={[styles.card, styles.cardOffDuty]}>
          <View style={styles.statusRow}>
            <MaterialCommunityIcons name="clock-outline" size={30} color={DESIGN_COLORS.inkMuted} />
            <Text style={[styles.statusWord, styles.inkText]} accessibilityRole="header">
              Off duty
            </Text>
          </View>
          <Text style={[styles.bodyText, styles.inkMutedText]}>Dispatch can&apos;t give you rides until you punch in.</Text>

          <Pressable
            style={({ pressed }) => [styles.mainButton, styles.punchInButton, pressed && styles.punchInPressed, saving && styles.buttonBusy]}
            onPress={handlePunchIn}
            disabled={saving}
            android_ripple={{ color: "rgba(255, 255, 255, 0.2)" }}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving, busy: saving }}
          >
            {saving ? <ActivityIndicator color={DESIGN_COLORS.paperWhite} /> : <MaterialCommunityIcons name="login" size={26} color={DESIGN_COLORS.paperWhite} />}
            <Text style={styles.punchInText}>{saving ? "Saving..." : "Punch in"}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.card, styles.cardAvailable]}>
          <View style={styles.statusRow}>
            <View style={styles.availableDot} />
            <Text style={[styles.statusWord, styles.whiteText]} accessibilityRole="header">
              Available
            </Text>
          </View>
          <Text style={[styles.timerText, styles.whiteText]} accessibilityLabel={`On duty for ${formatDutyDuration(summary.onDutyMs)}`}>
            On duty for {summary.punchInMs === null ? "--:--:--" : formatTimer(summary.onDutyMs)}
          </Text>
          <Text style={[styles.smallText, styles.whiteText]}>
            {summary.punchInMs === null ? "Dispatch can give you rides." : `Punched in at ${formatManilaTime(summary.punchInMs)} · Dispatch can give you rides.`}
          </Text>

          {/* A ride is waiting for you: no break and no punch out until it is answered (or finished). */}
          {activeRideStatus ? (
            <Text style={[styles.rideWaitingText, styles.whiteText]}>
              {activeRideStatus === "Assigned" ? "You have a new ride. Accept it on the Ride page first." : "Finish your current ride first."}
            </Text>
          ) : (
            <>
              <Pressable
                style={({ pressed }) => [styles.mainButton, styles.whiteButton, pressed && styles.whiteButtonPressed, saving && styles.buttonBusy]}
                onPress={openBreakSheet}
                disabled={saving}
                android_ripple={{ color: "rgba(11, 122, 75, 0.12)" }}
                accessibilityRole="button"
                accessibilityState={{ disabled: saving }}
              >
                <MaterialCommunityIcons name="coffee-outline" size={24} color={DESIGN_COLORS.hallGreen} />
                <Text style={styles.whiteButtonText}>Start break</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.mainButton, styles.secondButton, styles.outlineOnGreen, pressed && styles.outlineOnGreenPressed, saving && styles.buttonBusy]}
                onPress={() => setPunchOutOpen(true)}
                disabled={saving}
                android_ripple={{ color: "rgba(255, 255, 255, 0.16)" }}
                accessibilityRole="button"
                accessibilityState={{ disabled: saving, busy: saving }}
              >
                {saving ? <ActivityIndicator color={DESIGN_COLORS.paperWhite} /> : <MaterialCommunityIcons name="logout" size={24} color={DESIGN_COLORS.paperWhite} />}
                <Text style={styles.outlineOnGreenText}>{saving ? "Saving..." : "Punch out"}</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {message.text ? (
        <View style={[styles.messageBox, message.tone === "error" && styles.messageBoxError]} accessibilityRole="alert">
          <Text style={[styles.messageText, message.tone === "error" && styles.messageTextError]}>{message.text}</Text>
        </View>
      ) : null}

      {/* "Take a break" sheet: choose the kind of break, add an optional note, then Start break. */}
      {/* animationType="none": the sheet slides and the background fades by itself (sheetY above). */}
      <Modal visible={breakSheetOpen} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onShow={slideSheetIn} onRequestClose={closeBreakSheet}>
        {/* "padding" makes room for the keyboard while the note is typed. */}
        <KeyboardAvoidingView behavior="padding" style={[styles.sheetBackdrop, { paddingTop: insets.top + 24 }]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.sheetBackdropColor, { opacity: backdropOpacity }]} pointerEvents="none" />
          <Pressable style={styles.dismissArea} onPress={closeBreakSheet} accessibilityRole="button" accessibilityLabel="Close" />

          <Animated.View style={[styles.sheet, { maxHeight: sheetHeight, transform: [{ translateY: sheetY }] }]} accessibilityViewIsModal>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} accessibilityRole="header">
                Take a break
              </Text>
              <Pressable
                style={({ pressed }) => [styles.closeButton, pressed && styles.cancelPressed]}
                onPress={closeBreakSheet}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <MaterialCommunityIcons name="close" size={26} color={DESIGN_COLORS.ink} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 16 }]}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.sheetIntro}>Dispatch can&apos;t give you rides until you tap Resume duty.</Text>

              <Text style={styles.fieldLabel}>What kind of break?</Text>
              <View accessibilityRole="radiogroup">
                {BREAK_TYPES.map((option) => {
                  const selected = chosenBreakType === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={({ pressed }) => [styles.breakOption, selected && styles.breakOptionSelected, pressed && !selected && styles.cancelPressed]}
                      onPress={() => setChosenBreakType(option.value)}
                      android_ripple={{ color: "rgba(11, 122, 75, 0.12)" }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                    >
                      <MaterialCommunityIcons name={option.icon} size={26} color={selected ? DESIGN_COLORS.hallGreen : DESIGN_COLORS.inkMuted} />
                      <Text style={[styles.breakOptionText, selected && styles.breakOptionTextSelected]}>{option.label}</Text>
                      <MaterialCommunityIcons
                        name={selected ? "radiobox-marked" : "radiobox-blank"}
                        size={26}
                        color={selected ? DESIGN_COLORS.hallGreen : DESIGN_COLORS.controlOutline}
                      />
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Note (optional)</Text>
              <TextInput
                style={styles.noteInput}
                value={breakNoteInput}
                onChangeText={setBreakNoteInput}
                placeholder="Example: Back in 15 minutes"
                placeholderTextColor={DESIGN_COLORS.placeholder}
                maxLength={100}
                accessibilityLabel="Note, optional"
              />

              {/* Two different things, not one button that changes color: on Android the button's */}
              {/* background could stay light grey while its text turned white, so the words "disappeared". */}
              {chosenBreakType ? (
                <Pressable
                  style={({ pressed }) => [styles.mainButton, styles.confirmButton, pressed && styles.punchInPressed]}
                  onPress={handleStartBreak}
                  android_ripple={{ color: "rgba(255, 255, 255, 0.2)" }}
                  accessibilityRole="button"
                >
                  <Text style={styles.confirmButtonText}>Start {chosenBreakType.toLowerCase()} break</Text>
                </Pressable>
              ) : (
                // Not a button yet: just a grey box that says what to do first.
                <View style={[styles.mainButton, styles.confirmButton, styles.buttonDisabled]} accessibilityRole="button" accessibilityState={{ disabled: true }}>
                  <Text style={[styles.confirmButtonText, styles.buttonDisabledText]}>Choose a kind of break</Text>
                </View>
              )}
              <Pressable style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelPressed]} onPress={closeBreakSheet} accessibilityRole="button">
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* "Punch out?" pop-up: a short summary of the shift, main action on top, "Keep working" underneath. */}
      <Modal visible={punchOutOpen} transparent animationType="fade" onRequestClose={() => setPunchOutOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.confirmCard}>
            <MaterialCommunityIcons name="clock-check-outline" size={48} color={DESIGN_COLORS.hallGreen} />
            <Text style={styles.confirmTitle}>Punch out?</Text>
            <Text style={styles.confirmText}>Dispatch will stop giving you rides.</Text>

            <View style={styles.summaryList}>
              <SummaryRow label="Punched in" value={formatManilaTime(summary.punchInMs)} />
              <SummaryRow label="Time on duty" value={formatDutyDuration(summary.onDutyMs)} />
              <SummaryRow label="Break time" value={formatDutyDuration(summary.breakMs)} />
              <SummaryRow label="Rides completed" value={`${summary.ridesCompleted}`} last />
            </View>

            <Pressable
              style={({ pressed }) => [styles.mainButton, styles.confirmButton, pressed && styles.punchInPressed]}
              onPress={handlePunchOut}
              android_ripple={{ color: "rgba(255, 255, 255, 0.2)" }}
              accessibilityRole="button"
            >
              <Text style={styles.confirmButtonText}>Punch out</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelPressed]}
              onPress={() => setPunchOutOpen(false)}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Keep working</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryRow({ label, value, last = false }) {
  return (
    <View style={[styles.summaryRow, !last && styles.summaryRowLine]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Card corner 24, flat (no shadow), one big word in Board size.
  card: { borderRadius: 24, paddingHorizontal: 20, paddingVertical: 20 },
  cardOffDuty: { backgroundColor: DESIGN_COLORS.boardTint, borderWidth: 1, borderColor: DESIGN_COLORS.rule },
  cardAvailable: { backgroundColor: DESIGN_COLORS.hallGreen },
  // Light peach with an orange edge and dark words, like the resident's "account pending" banner
  // (approved by the group, Oct 2026). Bright orange stays for small accents only (the edge, the icon).
  // 2 dp edge, so the padding is 2 less to keep the same inside size.
  cardOnBreak: { backgroundColor: DESIGN_COLORS.peachTint, borderWidth: 2, borderColor: DESIGN_COLORS.sakayOrange, paddingHorizontal: 18, paddingVertical: 18 },
  // Same deep green as the "Assigned" / "On the way" bands.
  cardOnRun: { backgroundColor: DESIGN_COLORS.hallGreenDeep },
  rideWaitingText: { marginTop: 16, fontSize: 17, lineHeight: 24, fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  availableDot: { width: 16, height: 16, borderRadius: 999, backgroundColor: DESIGN_COLORS.paperWhite },
  statusWord: { flexShrink: 1, fontSize: 28, lineHeight: 34, fontWeight: "800" },
  timerText: { marginTop: 8, fontSize: 17, lineHeight: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
  bodyText: { marginTop: 8, fontSize: 17, lineHeight: 24 },
  smallText: { marginTop: 4, fontSize: 15, lineHeight: 20, fontWeight: "500" },
  inkText: { color: DESIGN_COLORS.ink },
  inkMutedText: { color: DESIGN_COLORS.inkMuted },
  whiteText: { color: DESIGN_COLORS.paperWhite },

  // Buttons: corner 16, main actions at least 56 tall, full width on a phone.
  mainButton: {
    width: "100%",
    maxWidth: 480,
    minHeight: 56,
    marginTop: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  punchInButton: { minHeight: 64, backgroundColor: DESIGN_COLORS.hallGreen },
  punchInPressed: { backgroundColor: DESIGN_COLORS.hallGreenDeep },
  punchInText: { fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.paperWhite },
  secondButton: { marginTop: 12 },
  whiteButton: { backgroundColor: DESIGN_COLORS.paperWhite },
  whiteButtonPressed: { backgroundColor: DESIGN_COLORS.boardTint },
  whiteButtonText: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.hallGreen },
  buttonDisabled: { backgroundColor: DESIGN_COLORS.boardTint, borderWidth: 1.5, borderColor: DESIGN_COLORS.rule },
  buttonDisabledText: { color: DESIGN_COLORS.inkMuted },
  outlineOnGreen: { borderWidth: 2, borderColor: DESIGN_COLORS.paperWhite },
  outlineOnGreenPressed: { backgroundColor: DESIGN_COLORS.hallGreenDeep },
  outlineOnGreenText: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.paperWhite },
  buttonBusy: { opacity: 0.75 },

  messageBox: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: DESIGN_COLORS.boardTint },
  messageBoxError: { backgroundColor: DESIGN_COLORS.redTint },
  messageText: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.ink },
  messageTextError: { color: DESIGN_COLORS.emergencyRed, fontWeight: "600" },

  // Pop-up (same look as the resident's "Send emergency alert?" pop-up, in green).
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.28)" },
  confirmCard: { width: "100%", maxWidth: 440, alignItems: "center", padding: 24, borderRadius: 24, backgroundColor: DESIGN_COLORS.paperWhite },
  confirmTitle: { marginTop: 12, fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.ink, textAlign: "center" },
  confirmText: { marginTop: 8, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.ink, textAlign: "center" },
  summaryList: { alignSelf: "stretch", marginTop: 16 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 8, paddingVertical: 10 },
  summaryRowLine: { borderBottomWidth: 1, borderBottomColor: DESIGN_COLORS.rule },
  summaryLabel: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted },
  summaryValue: { fontSize: 17, lineHeight: 24, fontWeight: "700", color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },
  confirmButton: { alignSelf: "stretch", maxWidth: undefined, backgroundColor: DESIGN_COLORS.hallGreen },
  confirmButtonText: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.paperWhite },
  cancelButton: {
    alignSelf: "stretch",
    minHeight: 56,
    marginTop: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  cancelPressed: { backgroundColor: DESIGN_COLORS.boardTint },
  cancelText: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },

  // "Take a break" sheet (slides up; top corners 24).
  sheetBackdrop: { flex: 1, justifyContent: "flex-end" },
  sheetBackdropColor: { backgroundColor: "rgba(0,0,0,0.4)" },
  dismissArea: { flex: 1 },
  // flexShrink lets the sheet get shorter (instead of going off the top) when the keyboard is open.
  sheet: { flexShrink: 1, width: "100%", maxWidth: 640, alignSelf: "center", backgroundColor: DESIGN_COLORS.paperWhite, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 24, paddingRight: 12, paddingTop: 16, paddingBottom: 8 },
  sheetTitle: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.ink },
  closeButton: { width: 48, height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { paddingHorizontal: 24 },
  sheetIntro: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted },
  fieldLabel: { marginTop: 24, marginBottom: 8, fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  breakOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    marginBottom: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
    overflow: "hidden",
  },
  breakOptionSelected: { borderWidth: 2, borderColor: DESIGN_COLORS.hallGreen, backgroundColor: DESIGN_COLORS.boardTint },
  breakOptionText: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  breakOptionTextSelected: { color: DESIGN_COLORS.hallGreenDeep },
  noteInput: {
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    fontSize: 17,
    color: DESIGN_COLORS.ink,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
});
