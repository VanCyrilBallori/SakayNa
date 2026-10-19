import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { DESIGN_COLORS, FONT } from "../../../constants/design";

// The title line at the top of every Admin section (DESIGN.md "Admin website exception"), the same as Overview's:
// a 40 round badge with a white icon, the title, and one short explanation beside it (under it when there is no room).
// red = the Emergency Calls badge; every other section is Hall Green. The icons match the side menu's.
// right = something at the end of the line (Vehicles: its Add button).
export default function AdminSectionHeader({ icon, title, subtitle, red = false, right = null }) {
  return (
    <View style={styles.header}>
      <View style={[styles.badge, { backgroundColor: red ? DESIGN_COLORS.emergencyRed : DESIGN_COLORS.hallGreen }]}>
        <MaterialCommunityIcons name={icon} size={22} color={DESIGN_COLORS.paperWhite} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  // Title and explanation on one line when there is room.
  copy: { flex: 1, minWidth: 0, flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 12 },
  title: { fontSize: 28, lineHeight: 34, fontFamily: FONT.bold, color: DESIGN_COLORS.ink },
  subtitle: { fontFamily: FONT.regular, marginTop: 2, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted },
});
