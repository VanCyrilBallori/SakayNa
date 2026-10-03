import { StyleSheet, Text, View } from "react-native";

import { DESIGN_COLORS } from "../constants/design";

// The green left half of the website Log In and Create Account pages (wide screens only).
// Flat Hall Green with white text, as DESIGN.md asks: no gradient, no circles, no ALL-CAPS labels.
export default function WebAuthPanel() {
  return (
    <View style={styles.panel}>
      <Text style={styles.name}>SakayNa</Text>
      <Text style={styles.message}>Rides and emergency help for Toledo City barangays.</Text>
      <Text style={styles.note}>SakayNa does not replace police, fire, ambulance, or emergency hotlines.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Name at the top, message in the middle, note at the bottom.
  panel: { flex: 1, justifyContent: "space-between", padding: 32, backgroundColor: DESIGN_COLORS.hallGreen },
  name: { fontSize: 22, lineHeight: 28, fontWeight: "800", color: "#FFFFFF" },
  message: { maxWidth: 440, fontSize: 28, lineHeight: 34, fontWeight: "800", color: "#FFFFFF" },
  note: { maxWidth: 440, fontSize: 17, lineHeight: 24, color: "#FFFFFF" },
});
