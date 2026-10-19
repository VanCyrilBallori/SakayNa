import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";

import { CORNER, FONT, GREEN, NEUTRAL, RED } from "../../constants/design";

// The shared button (DESIGN.md Style "Buttons"): a pill, at least 48 tall, 17 SemiBold words.
// primary = green fill, secondary = white with a grey edge and green words, danger = red fill ("can't be undone").
// Disabled = neutral 200 with neutral 700 words (5.5:1), never only faded.
export default function AppButton({ label, onPress, variant = "primary", loading = false, disabled = false, style, textStyle, accessibilityLabel }) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      activeOpacity={0.82}
      disabled={isDisabled}
      onPress={onPress}
      style={[styles.button, styles[variant], disabled && !loading && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? GREEN[700] : "#FFFFFF"} />
      ) : (
        <Text style={[styles.text, variant === "secondary" && styles.secondaryText, disabled && styles.disabledText, textStyle]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: 20, borderRadius: CORNER.pill, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: GREEN[600] },
  secondary: { backgroundColor: NEUTRAL[0], borderWidth: 1.5, borderColor: NEUTRAL[500] },
  danger: { backgroundColor: RED[600] },
  text: { color: "#FFFFFF", fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, textAlign: "center" },
  secondaryText: { color: GREEN[700] },
  disabled: { backgroundColor: NEUTRAL[200], borderColor: NEUTRAL[200] },
  disabledText: { color: NEUTRAL[700] },
});
