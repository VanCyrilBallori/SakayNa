import { StyleSheet, Text, View } from "react-native";

export default function AuthShell({ eyebrow, title, subtitle, children, asideTitle, asideText, stats }) {
  return (
    <View style={styles.page}>
      <View style={styles.backdropTop} />
      <View style={styles.backdropBottom} />

      <View style={styles.container}>
        <View style={styles.leftPanel}>
          <Text style={styles.brand}>SakayNa</Text>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{asideTitle}</Text>
            <Text style={styles.infoText}>{asideText}</Text>

            <View style={styles.statsRow}>
              {stats.map((stat) => (
                <View key={stat.label} style={styles.statCard}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.formPanel}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F4F7F1",
  },
  backdropTop: {
    position: "absolute",
    top: -120,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#CDEEDD",
  },
  backdropBottom: {
    position: "absolute",
    right: -90,
    bottom: -120,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#D7E8FF",
  },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 24,
  },
  leftPanel: {
    flex: 1,
    justifyContent: "center",
    minHeight: 280,
  },
  brand: {
    fontSize: 34,
    fontWeight: "800",
    color: "#0F6B4F",
  },
  eyebrow: {
    marginTop: 36,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#3A7A65",
    textTransform: "uppercase",
  },
  title: {
    marginTop: 12,
    maxWidth: 520,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "800",
    color: "#102A22",
  },
  subtitle: {
    marginTop: 14,
    maxWidth: 560,
    fontSize: 17,
    lineHeight: 27,
    color: "#4B635A",
  },
  infoCard: {
    marginTop: 28,
    maxWidth: 580,
    padding: 22,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "#D9E9E0",
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
    padding: 26,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1ECE5",
    shadowColor: "#14372C",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
});
