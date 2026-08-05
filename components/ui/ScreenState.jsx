import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import AppButton from "./AppButton";
import { COLORS, RADIUS } from "../../constants/design";

export default function ScreenState({ title, message, loading = false, actionLabel, onAction, secondaryActionLabel, onSecondaryAction }) {
  return (
    <View style={styles.page}>
      <View style={styles.card}>
        {loading ? <ActivityIndicator size="large" color={COLORS.primary} /> : null}
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <Text style={styles.message}>{message}</Text>
        {actionLabel ? <AppButton label={actionLabel} onPress={onAction} style={styles.action} /> : null}
        {secondaryActionLabel ? <AppButton label={secondaryActionLabel} variant="secondary" onPress={onSecondaryAction} style={styles.secondaryAction} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: COLORS.page },
  card: { width: "100%", maxWidth: 440, alignItems: "center", padding: 24, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  title: { marginTop: 14, fontSize: 22, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  message: { marginTop: 12, fontSize: 16, lineHeight: 24, color: COLORS.mutedText, textAlign: "center" },
  action: { width: "100%", marginTop: 20 },
  secondaryAction: { width: "100%", marginTop: 12 },
});