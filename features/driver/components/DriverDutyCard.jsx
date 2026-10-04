import { MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { DESIGN_COLORS } from "../../../constants/design";
import { db } from "../../../firebase";
import { formatDutyDuration, formatManilaTime, formatTimer, summarizeShift } from "../../../lib/dutyTime";
import { punchIn, punchOut } from "../services/driverDutyService";

// If a save takes longer than this, the internet is probably slow or off.
const SLOW_SAVE_MS = 8000;

// The driver's duty status card at the top of the driver home (driver-duty-plan.md, DESIGN.md look).
// "duty" comes from the driver's own users/{uid} profile: { dutyStatus, shiftId }.
export default function DriverDutyCard({ driverId, driverName, duty }) {
  const dutyStatus = duty.dutyStatus;
  const shiftId = duty.shiftId;
  const [shiftRecords, setShiftRecords] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", tone: "info" });
  const [punchOutOpen, setPunchOutOpen] = useState(false);
  const savingRef = useRef(false);

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

  return (
    <View>
      {dutyStatus === "Off duty" ? (
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

          <Pressable
            style={({ pressed }) => [styles.mainButton, styles.outlineOnGreen, pressed && styles.outlineOnGreenPressed, saving && styles.buttonBusy]}
            onPress={() => setPunchOutOpen(true)}
            disabled={saving}
            android_ripple={{ color: "rgba(255, 255, 255, 0.16)" }}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving, busy: saving }}
          >
            {saving ? <ActivityIndicator color={DESIGN_COLORS.paperWhite} /> : <MaterialCommunityIcons name="logout" size={24} color={DESIGN_COLORS.paperWhite} />}
            <Text style={styles.outlineOnGreenText}>{saving ? "Saving..." : "Punch out"}</Text>
          </Pressable>
        </View>
      )}

      {message.text ? (
        <View style={[styles.messageBox, message.tone === "error" && styles.messageBoxError]} accessibilityRole="alert">
          <Text style={[styles.messageText, message.tone === "error" && styles.messageTextError]}>{message.text}</Text>
        </View>
      ) : null}

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
});
