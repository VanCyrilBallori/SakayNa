import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";

import { DESIGN_COLORS } from "../../constants/design";

// The one close (X) button for every pop-up window (DESIGN.md look, like the resident's ☰ menu):
// a plain 48 dp circle with a dark X, light grey while pressed. Never red: red means emergency.
// label = what screen readers say, for example "Close history".
// style = extra placement from the window (for example alignSelf: "flex-end").
export default function CloseButton({ onPress, label = "Close", style }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialCommunityIcons name="close" size={26} color={DESIGN_COLORS.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 48, height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  pressed: { backgroundColor: DESIGN_COLORS.boardTint },
});
