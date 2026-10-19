import { StyleSheet, Text, View } from "react-native";

import { CORNER, FONT, GREEN, NEUTRAL, ORANGE, RED } from "../../constants/design";

// A short message in a tinted box (DESIGN.md Style). Text 15, never smaller.
const tones = {
  error: { backgroundColor: RED[50], color: RED[600] },
  success: { backgroundColor: GREEN[50], color: GREEN[800] },
  warning: { backgroundColor: ORANGE[100], color: NEUTRAL[900] },
  info: { backgroundColor: NEUTRAL[100], color: NEUTRAL[700] },
};

export default function FeedbackMessage({ message, tone = "info", style }) {
  if (!message) {
    return null;
  }

  const colors = tones[tone] || tones.info;
  return <View accessibilityRole="alert" style={[styles.container, { backgroundColor: colors.backgroundColor }, style]}><Text style={[styles.text, { color: colors.color }]}>{message}</Text></View>;
}

const styles = StyleSheet.create({
  container: { width: "100%", marginTop: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: CORNER.input },
  text: { fontSize: 15, lineHeight: 20, fontFamily: FONT.semiBold },
});
