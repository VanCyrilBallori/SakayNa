import { useWindowDimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import BrandLogo from "./BrandLogo";

export default function AppBrandHeader({ role = "Resident", name = "James Bond", onLogoutPress = () => {} }) {
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const narrow = width < 480;

  return (
    <View style={[styles.header, compact && styles.headerCompact, narrow && styles.headerNarrow]}>
      <View style={styles.brandWrap}>
        <BrandLogo variant="main" height={compact ? 28 : 34} />
      </View>

      <View style={[styles.rightWrap, compact && styles.rightWrapCompact, narrow && styles.rightWrapNarrow]}>
        <View style={[styles.userWrap, narrow && styles.userWrapNarrow]}>
          <View style={styles.userIconWrap}>
            <FontAwesome name="user" size={compact ? 20 : 24} color="#0F6B4F" />
          </View>
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
  headerNarrow: {
    gap: 14,
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
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
  rightWrapNarrow: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  userWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  userWrapNarrow: {
    width: "100%",
  },
  userIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EAF4EF",
    alignItems: "center",
    justifyContent: "center",
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
