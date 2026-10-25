import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { DESIGN_COLORS, FONT } from "../../../constants/design";
import { getTimestampMillis } from "../../../lib/dates";
import { formatPlace, getLocationAgeLabel, removePlusCode } from "../../../lib/placeText";

// The red emergency strip at the very top of the dispatcher page (Task 3.13). It replaces the full-screen
// "Incoming Emergency Call" pop-up and stays until each alert is answered, declined or ends.
// - The first 2 ringing alerts (oldest first) each get a row. In a row the name, barangay, ringing time and the
//   Decline / Answer buttons never move; only the extra details (phone number, GPS location) can slide like a news ticker.
// - A 3rd or later alert goes into one "N more waiting" row whose ticker lists them. When a row above is
//   answered or declined, the next one moves up and gets its own buttons.
// - The ticker only moves when its text doesn't fit, pauses while the mouse is over it, and never moves when the
//   computer is set to "reduce motion" (then the text ends with "…" and the full text shows on hover).
const ROWS_WITH_BUTTONS = 2;

// "0:42", "12:05": how long the alert has been ringing.
const formatRinging = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${`${totalSeconds % 60}`.padStart(2, "0")}`;
};

// calls = the live ringing alerts, oldest first. onAnswer(call) / onDecline(call) = the dispatcher page's own Answer and Decline.
// formatPhone = the page's phone formatter ("0917 123 4567").
// soundMuted / soundBlocked / onEnableSound / onUnmute = the alert sound (Task 3.13b, useAlertSound). While muted,
// the first row ends with a muted-bell button (hover: what it means; click: onUnmute turns the sound back on).
// When the browser refused to play, a last line offers "Sound blocked: click to turn sound on".
export default function EmergencyAlertStrip({ calls, onAnswer, onDecline, formatPhone, soundMuted = false, soundBlocked = false, onEnableSound, onUnmute }) {
  // A 1-second clock for the ringing times, only while something rings.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!calls.length) return undefined;
    const intervalId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, [calls.length]);

  // The barangay shown in the fixed part. The alert's pickupLocation starts as the resident's barangay and is
  // replaced by the GPS address a few seconds later, so the first one seen is kept: the fixed part never jumps.
  const firstPlaceRef = useRef({});
  const getBarangay = (call) => {
    if (!(call.id in firstPlaceRef.current)) {
      firstPlaceRef.current[call.id] = call.location ? call.location.barangay || call.pickupLocation : call.pickupLocation;
    }
    return formatPlace(firstPlaceRef.current[call.id] || "Barangay not given").replace(/,\s*Toledo City$/i, "");
  };

  if (!calls.length) return null;

  const rows = calls.slice(0, ROWS_WITH_BUTTONS);
  const waiting = calls.slice(ROWS_WITH_BUTTONS);
  const ringingFor = (call) => formatRinging(now - (getTimestampMillis(call.createdAt) ?? now));

  return (
    // No "alert" role: the ringing time changes every second, and a screen reader would read the strip again each time.
    // The browser tab title ("EMERGENCY – SakayNa") and the buttons' labels say what is happening.
    <View style={styles.strip} accessibilityLabel="Emergency alerts">
      {Platform.OS === "web" ? <style>{TICKER_CSS}</style> : null}
      {rows.map((call, index) => {
        const name = call.residentName || "Resident";
        const phone = call.residentPhone ? formatPhone(call.residentPhone) : "No phone number on file";
        // A Plus Code ("9JQX+XH7, Toledo, …") means nothing to a person, so it is left out. The brackets say whether
        // it is a fresh position or the one the phone remembered: "GPS location (last known · 5 min ago): Toledo, …".
        const place = call.location?.address
          ? `GPS location (${getLocationAgeLabel(call.location, now).toLowerCase()}): ${removePlusCode(call.location.address) || "sent"}`
          : "Location not sent yet";
        return (
          <View key={call.id} style={styles.row}>
            <View style={styles.fixedPart}>
              <MaterialCommunityIcons name="alert" size={24} color={DESIGN_COLORS.paperWhite} />
              <Text style={styles.fixedText}>
                <Text style={styles.emergencyWord}>EMERGENCY </Text>
                {name} · {getBarangay(call)} · ringing {ringingFor(call)}
              </Text>
            </View>
            <Ticker text={`${phone} · ${place}`} />
            {/* Sound off: only a muted bell at the end of the first row's line. It never shrinks, so a long
                line can't push it out of sight (the ticker gets narrower instead). */}
            {soundMuted && index === 0 ? <MutedBellButton onPress={onUnmute} /> : null}
            <View style={styles.buttons}>
              <Pressable
                style={({ pressed }) => [styles.button, styles.declineButton, pressed && styles.declinePressed]}
                onPress={() => onDecline(call)}
                accessibilityRole="button"
                accessibilityLabel={`Decline emergency from ${name}`}
              >
                <Text style={styles.declineText}>Decline</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.button, styles.answerButton, pressed && styles.answerPressed]}
                onPress={() => onAnswer(call)}
                accessibilityRole="button"
                accessibilityLabel={`Answer emergency from ${name}`}
              >
                <Text style={styles.answerText}>Answer</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      {waiting.length ? (
        <View style={styles.row}>
          <View style={styles.fixedPart}>
            <MaterialCommunityIcons name="alert" size={24} color={DESIGN_COLORS.paperWhite} />
            <Text style={styles.fixedText}>{waiting.length} more waiting</Text>
          </View>
          <Ticker text={waiting.map((call) => `${call.residentName || "Resident"} (${getBarangay(call)}, ${ringingFor(call)})`).join(" · ")} />
        </View>
      ) : null}
      {/* "Sound blocked", as the last line so the alert rows above never move when it appears or goes. */}
      {!soundMuted && soundBlocked ? (
        <View style={styles.soundRow}>
          <Pressable
            style={({ pressed }) => [styles.soundButton, pressed && styles.declinePressed]}
            onPress={onEnableSound}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="volume-off" size={22} color={DESIGN_COLORS.paperWhite} />
            <Text style={styles.soundText}>Sound blocked: click to turn sound on</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// The muted-bell button (DESIGN.md Icons exception): 48 to tap, no word next to it. Hovering shows the
// browser's tooltip ("title", set on the page element like OneLine in dispatcher-home.jsx); screen readers
// read the same sentence. Clicking turns the alert sound back on.
const MUTED_BELL_TEXT = "Sound is off. Turn it on in your profile menu.";
function MutedBellButton({ onPress }) {
  const setTooltip = (node) => {
    if (Platform.OS === "web" && node?.setAttribute) node.setAttribute("title", MUTED_BELL_TEXT);
  };
  return (
    <Pressable
      ref={setTooltip}
      style={({ pressed }) => [styles.mutedBell, pressed && styles.declinePressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${MUTED_BELL_TEXT} Click to turn the sound on.`}
    >
      <MaterialCommunityIcons name="bell-off-outline" size={24} color={DESIGN_COLORS.paperWhite} />
    </Pressable>
  );
}

// The moving part. It's a website-only page, so the browser moves the text (CSS animation, TICKER_CSS below);
// on a phone app it is plain text cut with "…".
function Ticker({ text }) {
  const boxRef = useRef(null);
  const textRef = useRef(null);
  const [moves, setMoves] = useState(false);

  // Move only if the text is wider than its box (checked again when the box changes size) and the computer
  // isn't set to "reduce motion".
  useEffect(() => {
    if (Platform.OS !== "web") return undefined;
    const check = () => {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const box = boxRef.current;
      const firstCopy = textRef.current;
      setMoves(Boolean(box && firstCopy && !reduceMotion && firstCopy.offsetWidth > box.clientWidth));
    };
    check();
    if (typeof ResizeObserver === "undefined" || !boxRef.current) return undefined;
    const observer = new ResizeObserver(check);
    observer.observe(boxRef.current);
    return () => observer.disconnect();
  }, [text]);

  if (Platform.OS !== "web") {
    return (
      <Text style={styles.tickerNative} numberOfLines={1}>
        {text}
      </Text>
    );
  }

  return (
    <div ref={boxRef} className="sakayna-ticker" title={text} aria-label={text} style={tickerBoxStyle}>
      {moves ? (
        // Two copies side by side; the animation slides exactly one copy's width, then starts again: no jump.
        <span className="sakayna-ticker-track">
          <span ref={textRef} style={tickerCopyStyle}>
            {text}
          </span>
          <span aria-hidden="true" style={tickerCopyStyle}>
            {text}
          </span>
        </span>
      ) : (
        <span ref={textRef}>{text}</span>
      )}
    </div>
  );
}

// One copy slides fully past in 20 seconds, then it starts again; hovering pauses it.
const TICKER_CSS = `
.sakayna-ticker-track { display: inline-block; white-space: nowrap; animation: sakayna-ticker 20s linear infinite; }
.sakayna-ticker:hover .sakayna-ticker-track { animation-play-state: paused; }
@keyframes sakayna-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .sakayna-ticker-track { animation: none; } }
`;

const tickerBoxStyle = {
  flex: "1 1 220px",
  minWidth: 160,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  color: DESIGN_COLORS.paperWhite,
  fontSize: 17,
  lineHeight: "24px",
  fontFamily: FONT.medium,
};
// The space after each copy, so the end of one copy and the start of the next don't touch.
const tickerCopyStyle = { paddingRight: 64 };

const styles = StyleSheet.create({
  // Emergency Red, white words (the same red as the resident's Emergency button).
  strip: { backgroundColor: DESIGN_COLORS.emergencyRed, paddingHorizontal: 16, paddingVertical: 4 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 16,
    rowGap: 6,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.25)",
  },
  fixedPart: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  fixedText: { flexShrink: 1, fontSize: 17, lineHeight: 24, fontFamily: FONT.bold, color: DESIGN_COLORS.paperWhite, fontVariant: ["tabular-nums"] },
  emergencyWord: { fontFamily: FONT.extraBold },
  tickerNative: { fontFamily: FONT.regular, flex: 1, minWidth: 160, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.paperWhite },
  buttons: { flexDirection: "row", gap: 8, marginLeft: "auto" },
  button: { minHeight: 48, minWidth: 104, paddingHorizontal: 16, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  declineButton: { borderWidth: 2, borderColor: DESIGN_COLORS.paperWhite },
  declinePressed: { backgroundColor: "rgba(255, 255, 255, 0.16)" },
  declineText: { fontSize: 17, fontFamily: FONT.bold, color: DESIGN_COLORS.paperWhite },
  answerButton: { backgroundColor: DESIGN_COLORS.paperWhite },
  answerPressed: { backgroundColor: DESIGN_COLORS.redTint },
  answerText: { fontSize: 17, fontFamily: FONT.extraBold, color: DESIGN_COLORS.emergencyRed },
  // The muted bell: a 48 white-edged circle that never shrinks (flexShrink 0).
  mutedBell: { width: 48, height: 48, flexShrink: 0, borderRadius: 24, borderWidth: 2, borderColor: DESIGN_COLORS.paperWhite, alignItems: "center", justifyContent: "center" },
  // The last line about the alert sound (Task 3.13b).
  soundRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  soundButton: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, borderRadius: 16, borderWidth: 2, borderColor: DESIGN_COLORS.paperWhite },
  soundText: { flexShrink: 1, fontSize: 17, lineHeight: 24, fontFamily: FONT.bold, color: DESIGN_COLORS.paperWhite },
});
