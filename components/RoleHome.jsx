import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function RoleHome({ role, heading, summary, primaryCard, secondaryCard, highlights }) {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.brand}>SakayNa</Text>
            <Text style={styles.roleBadge}>{role} Portal</Text>
          </View>

          <TouchableOpacity style={styles.exitButton} onPress={() => router.replace("/")}>
            <Text style={styles.exitButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.heading}>{heading}</Text>
        <Text style={styles.summary}>{summary}</Text>
      </View>

      <View style={styles.cardRow}>
        <View style={[styles.mainCard, styles.mainCardAccent]}>
          <Text style={styles.cardLabel}>{primaryCard.label}</Text>
          <Text style={styles.cardTitle}>{primaryCard.title}</Text>
          <Text style={styles.cardText}>{primaryCard.text}</Text>
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.cardLabel}>{secondaryCard.label}</Text>
          <Text style={styles.cardTitle}>{secondaryCard.title}</Text>
          <Text style={styles.cardText}>{secondaryCard.text}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {highlights.map((item) => (
          <View key={item.title} style={styles.gridCard}>
            <Text style={styles.gridTitle}>{item.title}</Text>
            <Text style={styles.gridText}>{item.text}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
    backgroundColor: "#F4F7F1",
  },
  hero: {
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
    padding: 28,
    borderRadius: 30,
    backgroundColor: "#11392E",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  brand: {
    fontSize: 30,
    fontWeight: "800",
    color: "#F4FFF8",
  },
  roleBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#1D5B49",
    color: "#D6F5E5",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  exitButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#F1F8F4",
  },
  exitButtonText: {
    color: "#154535",
    fontWeight: "700",
  },
  heading: {
    marginTop: 28,
    maxWidth: 700,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  summary: {
    marginTop: 14,
    maxWidth: 700,
    fontSize: 16,
    lineHeight: 25,
    color: "#CBE6DA",
  },
  cardRow: {
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
    marginTop: 22,
  },
  mainCard: {
    flex: 1,
    minWidth: 260,
    padding: 22,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DEEBE3",
  },
  mainCardAccent: {
    backgroundColor: "#DDF4E8",
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#517468",
  },
  cardTitle: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: "800",
    color: "#17382E",
  },
  cardText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23,
    color: "#567267",
  },
  grid: {
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
    marginTop: 22,
  },
  gridCard: {
    flexGrow: 1,
    flexBasis: 240,
    padding: 20,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DEEBE3",
  },
  gridTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#17382E",
  },
  gridText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23,
    color: "#5B756B",
  },
});
