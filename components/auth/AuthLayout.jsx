import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import BrandLogo from "../BrandLogo";
import IconButton from "../ui/IconButton";
import { COLORS, RADIUS } from "../../constants/design";

export default function AuthLayout({ title, children, footer, onBack, maxWidth = 470 }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.page}>
      {onBack ? <IconButton icon="arrow-left" label="Back to home" onPress={onBack} style={styles.backButton} /> : null}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { maxWidth }]}>
          <BrandLogo variant="main" height={40} style={styles.logo} />
          <Text style={styles.title}>{title}</Text>
          {children}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthLink({ children, onPress, disabled = false }) {
  return <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress}><Text style={[styles.link, disabled && styles.disabledLink]}>{children}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F3F0EB" },
  backButton: { position: "absolute", top: 20, right: 16, zIndex: 2, backgroundColor: "rgba(255,255,255,0.94)", borderWidth: 1, borderColor: COLORS.border },
  content: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingVertical: 24 },
  card: { width: "100%", padding: 24, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  logo: { marginBottom: 18 },
  title: { marginBottom: 18, fontSize: 30, fontWeight: "700", color: "#111111" },
  footer: { marginTop: 16, alignItems: "center" },
  link: { color: COLORS.primary, fontWeight: "600", textAlign: "center" },
  disabledLink: { opacity: 0.55 },
});