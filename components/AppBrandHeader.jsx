import { StyleSheet, View, Text, useWindowDimensions } from "react-native";

import BrandLogo from "./BrandLogo";
import ProfileAvatar from "./profile/ProfileAvatar";
import AppButton from "./ui/AppButton";
import { COLORS } from "../constants/design";

export default function AppBrandHeader({ role = "Resident", name = "User", onLogoutPress = () => {} }) {
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const narrow = width < 480;

  return (
    <View style={[styles.header, compact && styles.headerCompact, narrow && styles.headerNarrow]}>
      <View style={styles.brandWrap}><BrandLogo variant="main" height={compact ? 28 : 34} /></View>
      <View style={[styles.rightWrap, compact && styles.rightWrapCompact, narrow && styles.rightWrapNarrow]}>
        <View style={styles.userWrap}>
          <ProfileAvatar name={name} size={compact ? 40 : 44} />
          <View>
            <Text style={[styles.userName, compact && styles.userNameCompact]} numberOfLines={1}>{name}</Text>
            <Text style={styles.userRole}>{role}</Text>
          </View>
        </View>
        <AppButton label="Log Out" onPress={onLogoutPress} style={[styles.logoutButton, compact && styles.logoutButtonCompact]} textStyle={[styles.logoutText, compact && styles.logoutTextCompact]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { width: "100%", paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: "#D7E2DC", backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18 },
  headerCompact: { paddingHorizontal: 16, paddingVertical: 14, flexWrap: "wrap" },
  headerNarrow: { gap: 14 },
  brandWrap: { flexDirection: "row", alignItems: "center" },
  rightWrap: { flexDirection: "row", alignItems: "center", gap: 16 },
  rightWrapCompact: { width: "100%", justifyContent: "space-between" },
  rightWrapNarrow: { flexDirection: "column", alignItems: "stretch" },
  userWrap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  userName: { fontSize: 24, fontWeight: "700", color: "#111111", maxWidth: 240 },
  userNameCompact: { fontSize: 18 },
  userRole: { fontSize: 14, color: "#506057" },
  logoutButton: { minWidth: 148, backgroundColor: COLORS.primary },
  logoutButtonCompact: { minWidth: 112 },
  logoutText: { fontSize: 20 },
  logoutTextCompact: { fontSize: 16 },
});