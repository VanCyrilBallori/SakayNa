import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import AppButton from "./AppButton";
import { COLORS, RADIUS } from "../../constants/design";

// Loading screens (loading = true): only the spinner and words, straight on the light gray page (Task 3.8).
// Error screens (no loading): inside the white card with their buttons, as before.
export default function ScreenState({ title, message, loading = false, actionLabel, onAction, secondaryActionLabel, onSecondaryAction }) {
  return (
    <View style={styles.page}>
      <View style={loading ? styles.plain : styles.card}>
        {loading ? <ActivityIndicator size="large" color={COLORS.primary} /> : null}
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <Text style={[styles.message, loading && styles.loadingMessage]}>{message}</Text>
        {actionLabel ? <AppButton label={actionLabel} onPress={onAction} style={styles.action} /> : null}
        {secondaryActionLabel ? <AppButton label={secondaryActionLabel} variant="secondary" onPress={onSecondaryAction} style={styles.secondaryAction} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: COLORS.page },
  card: { width: "100%", maxWidth: 440, alignItems: "center", padding: 24, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  plain: { width: "100%", maxWidth: 440, alignItems: "center", padding: 24 },
  title: { marginTop: 14, fontSize: 22, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  message: { marginTop: 12, fontSize: 16, lineHeight: 24, color: COLORS.mutedText, textAlign: "center" },
  // On the gray page the words are dark and Body size (DESIGN.md 17/24), so they stay easy to read.
  loadingMessage: { fontSize: 17, color: COLORS.text },
  action: { width: "100%", marginTop: 20 },
  secondaryAction: { width: "100%", marginTop: 12 },
});