import { useWindowDimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome } from "@expo/vector-icons";

export default function AppBrandHeader({ role = "Resident", name = "James Bond", onLogoutPress = () => {} }) {
  const { width } = useWindowDimensions();
  const compact = width < 900;

  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      <View style={styles.brandWrap}>
        <View style={[styles.logoBadge, compact && styles.logoBadgeCompact]}>
          <Text style={[styles.logoText, compact && styles.logoTextCompact]}>S</Text>
        </View>
        <Text style={[styles.brandText, compact && styles.brandTextCompact]}>SakayNa</Text>
      </View>

      <View style={[styles.rightWrap, compact && styles.rightWrapCompact]}>
        <View style={styles.userWrap}>
          <FontAwesome name="user" size={compact ? 24 : 30} color="#101010" />
          <View>
            <Text style={[styles.userName, compact && styles.userNameCompact]}>{name}</Text>
            <Text style={[styles.userRole, compact && styles.userRoleCompact]}>{role}</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.logoutButton, compact && styles.logoutButtonCompact]} onPress={onLogoutPress}>
          <Text style={[styles.logoutText, compact && styles.logoutTextCompact]}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: "100%",
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#D7E2DC",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
  },
  headerCompact: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexWrap: "wrap",
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#496B5F",
  },
  logoBadgeCompact: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  logoText: {
    fontSize: 30,
    fontWeight: "900",
    color: "#FFFFFF",
    fontStyle: "italic",
  },
  logoTextCompact: {
    fontSize: 24,
  },
  brandText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111111",
    fontStyle: "italic",
  },
  brandTextCompact: {
    fontSize: 22,
  },
  rightWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  rightWrapCompact: {
    width: "100%",
    justifyContent: "space-between",
  },
  userWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111111",
  },
  userNameCompact: {
    fontSize: 18,
  },
  userRole: {
    fontSize: 14,
    color: "#506057",
  },
  userRoleCompact: {
    fontSize: 12,
  },
  logoutButton: {
    minWidth: 148,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#0B7A4A",
  },
  logoutButtonCompact: {
    minWidth: 112,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  logoutText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  logoutTextCompact: {
    fontSize: 16,
  },
});
