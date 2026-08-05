import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";

import { COLORS, RADIUS } from "../../constants/design";

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
      style={[styles.button, styles[variant], isDisabled && styles.disabled, style]}
    >
      {loading ? <ActivityIndicator color={variant === "secondary" ? COLORS.primary : "#FFFFFF"} /> : <Text style={[styles.text, variant === "secondary" && styles.secondaryText, textStyle]}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: 18, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: COLORS.primary },
  secondary: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primary },
  danger: { backgroundColor: COLORS.emergency },
  text: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  secondaryText: { color: COLORS.primary },
  disabled: { opacity: 0.58 },
});