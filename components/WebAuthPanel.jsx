import { StyleSheet, Text, View } from "react-native";

import BrandLogo from "./BrandLogo";

// The green left half of the website Log In and Create Account pages (wide screens only).
// Same green and soft circles as the website landing page (app/index.jsx). DESIGN.md allows this on the website only.
export default function WebAuthPanel() {
  return (
    <View style={styles.panel}>
      <View style={styles.glowLeft} />
      <View style={styles.glowRight} />
      {/* The logo file has a see-through background, but its dark green and black would be hard to see here.
          tintColor paints the logo white; the background stays see-through so the green shows. */}
      <BrandLogo variant="main" height={40} style={styles.logo} accessibilityLabel="SakayNa" />
      <Text style={styles.message}>Rides and emergency help for Toledo City barangays.</Text>
      <Text style={styles.note}>SakayNa does not replace police, fire, ambulance, or emergency hotlines.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Logo at the top, message in the middle, note at the bottom. overflow hidden cuts off the circles at the edges.
  panel: { flex: 1, justifyContent: "space-between", padding: 32, overflow: "hidden", backgroundColor: "#0F6B4F" },
  // The two circles, copied from the landing page's heroGlowLeft and heroGlowRight.
  glowLeft: { position: "absolute", top: -80, left: -40, width: 240, height: 240, borderRadius: 120, backgroundColor: "rgba(120, 220, 180, 0.18)" },
  glowRight: { position: "absolute", right: -90, bottom: -70, width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(255, 255, 255, 0.08)" },
  logo: { tintColor: "#FFFFFF" },
  message: { maxWidth: 440, fontSize: 28, lineHeight: 34, fontWeight: "800", color: "#FFFFFF" },
  note: { maxWidth: 440, fontSize: 17, lineHeight: 24, color: "#FFFFFF" },
});
