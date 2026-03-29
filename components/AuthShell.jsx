import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import BrandLogo from "./BrandLogo";

export default function AuthShell({ eyebrow, title, subtitle, children, asideTitle, asideText, stats }) {
  const { width } = useWindowDimensions();
  const compact = width < 880;
  const narrow = width < 420;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.page}>
      <View style={styles.backdropTop} />
      <View style={styles.backdropBottom} />

      <ScrollView contentContainerStyle={[styles.container, compact && styles.containerCompact]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.layout, compact && styles.layoutCompact]}>
          <View style={[styles.leftPanel, compact && styles.leftPanelCompact]}>
            <BrandLogo variant="main" height={narrow ? 34 : 42} />
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={[styles.title, compact && styles.titleCompact, narrow && styles.titleNarrow]}>{title}</Text>
            <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>{subtitle}</Text>

            <View style={[styles.infoCard, compact && styles.infoCardCompact]}>
              <Text style={styles.infoTitle}>{asideTitle}</Text>
              <Text style={styles.infoText}>{asideText}</Text>

              <View style={styles.statsRow}>
                {stats.map((stat) => (
                  <View key={stat.label} style={[styles.statCard, narrow && styles.statCardNarrow]}>
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.formPanel, compact && styles.formPanelCompact, narrow && styles.formPanelNarrow]}>{children}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F3F0EB",
  },
  backdropTop: {
    position: "absolute",
    top: -100,
    right: -120,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(0,143,91,0.06)",
  },
  backdropBottom: {
    position: "absolute",
    left: -120,
    bottom: -120,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(0,143,91,0.05)",
  },
  container: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
    flexGrow: 1,
  },
  containerCompact: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  layout: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
  },
  layoutCompact: {
    flexDirection: "column",
    justifyContent: "flex-start",
  },
  leftPanel: {
    flex: 1,
    justifyContent: "center",
    minHeight: 280,
  },
  leftPanelCompact: {
    width: "100%",
    minHeight: 0,
  },
  eyebrow: {
    marginTop: 28,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#3A7A65",
    textTransform: "uppercase",
  },
  title: {
    marginTop: 14,
    maxWidth: 500,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "800",
    color: "#102A22",
  },
  titleCompact: {
    fontSize: 32,
    lineHeight: 38,
  },
  titleNarrow: {
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 14,
    maxWidth: 560,
    fontSize: 16,
    lineHeight: 25,
    color: "#4B635A",
  },
  subtitleCompact: {
    fontSize: 15,
    lineHeight: 23,
  },
  infoCard: {
    marginTop: 24,
    maxWidth: 560,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "#D9E9E0",
  },
  infoCardCompact: {
    marginTop: 20,
    padding: 18,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#17382E",
  },
  infoText: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 24,
    color: "#537166",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 18,
  },
  statCard: {
    minWidth: 120,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  statCardNarrow: {
    flexGrow: 1,
    minWidth: 110,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F6B4F",
  },
  statLabel: {
    marginTop: 4,
    fontSize: 13,
    color: "#5E746B",
  },
  formPanel: {
    width: "100%",
    maxWidth: 470,
    alignSelf: "center",
    padding: 24,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1ECE5",
    shadowColor: "#14372C",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  formPanelCompact: {
    maxWidth: 720,
    alignSelf: "stretch",
  },
  formPanelNarrow: {
    padding: 18,
    borderRadius: 22,
  },
});
