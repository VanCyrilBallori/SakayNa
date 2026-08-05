import { StyleSheet, Text, View } from "react-native";

import { COLORS } from "../../constants/design";

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "U";

export default function ProfileAvatar({ name, size = 44, backgroundColor = COLORS.surfaceMuted, color = COLORS.primary, style }) {
  return (
    <View accessibilityLabel={`${name || "User"} profile`} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor }, style]}>
      <Text style={[styles.initials, { color, fontSize: Math.max(14, Math.round(size * 0.38))}]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center" },
  initials: { fontWeight: "800" },
});