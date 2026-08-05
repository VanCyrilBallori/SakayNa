import { StyleSheet, Text, View } from "react-native";

import { COLORS, RADIUS } from "../../constants/design";

const tones = {
  error: { backgroundColor: COLORS.emergencySurface, color: COLORS.emergency },
  success: { backgroundColor: "#E7F5ED", color: COLORS.success },
  warning: { backgroundColor: COLORS.warningSurface, color: COLORS.warning },
  info: { backgroundColor: COLORS.surfaceMuted, color: COLORS.mutedText },
};

export default function FeedbackMessage({ message, tone = "info", style }) {
  if (!message) {
    return null;
  }

  const colors = tones[tone] || tones.info;
  return <View accessibilityRole="alert" style={[styles.container, { backgroundColor: colors.backgroundColor }, style]}><Text style={[styles.text, { color: colors.color }]}>{message}</Text></View>;
}

const styles = StyleSheet.create({
  container: { width: "100%", marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS.sm },
  text: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
});