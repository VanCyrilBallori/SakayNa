import { FontAwesome5, Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import BrandLogo from "../components/BrandLogo";

export default function Index() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 960;
  const narrow = width < 560;

  const features = [
    {
      icon: <Ionicons name="globe-outline" size={24} color="#FFFFFF" />,
      title: "Web and Mobile Access",
      text: "Residents and responders can use the system on desktop or mobile.",
    },
    {
      icon: <MaterialIcons name="crisis-alert" size={24} color="#FFFFFF" />,
      title: "Emergency Request",
      text: "Residents can quickly send emergency requests when urgent help is needed.",
    },
    {
      icon: <FontAwesome5 name="ambulance" size={20} color="#FFFFFF" />,
      title: "Vehicle Assignment",
      text: "Available vehicles can be matched to active requests.",
    },
    {
      icon: <Ionicons name="warning-outline" size={24} color="#FFFFFF" />,
      title: "Disaster Response Mode",
      text: "Supports evacuation and emergency transport during disaster response.",
    },
    {
      icon: <MaterialCommunityIcons name="chart-donut" size={22} color="#FFFFFF" />,
      title: "Reports and Analytics",
      text: "View reports and response activity in one place.",
    },
    {
      icon: <MaterialCommunityIcons name="view-dashboard-outline" size={22} color="#FFFFFF" />,
      title: "Role-Based Dashboards",
      text: "Separate dashboards are available for each user role.",
    },
  ];

  const steps = [
    { number: "1", label: "Open SakayNa" },
    { number: "2", label: "Send Request" },
    { number: "3", label: "Dispatch Team" },
    { number: "4", label: "Track Response" },
  ];

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heroWrap}>
        <View style={styles.heroGlowLeft} />
        <View style={styles.heroGlowRight} />

        <View style={[styles.topBar, compact && styles.topBarCompact]}>
          <View style={styles.brandWrap}>
            <BrandLogo variant="main" height={narrow ? 42 : 50} />
          </View>

          <View style={[styles.topActions, narrow && styles.topActionsNarrow]}>
            <TouchableOpacity style={styles.topButtonSecondary} onPress={() => router.push("/login")}>
              <Text style={styles.topButtonSecondaryText}>Log In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.topButtonPrimary} onPress={() => router.push("/signup")}>
              <Text style={styles.topButtonPrimaryText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.heroSection, compact && styles.heroSectionCompact]}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.eyebrow}>Emergency Response System</Text>
            <Text style={[styles.heroTitle, compact && styles.heroTitleCompact, narrow && styles.heroTitleNarrow]}>
              SAFE. FAST.
              {"\n"}
              CONNECTED.
            </Text>
            <Text style={[styles.heroSubtitle, compact && styles.heroSubtitleCompact]}>
              An integrated emergency transport and response management system for Toledo City. Connecting residents,
              drivers, and city officials in one clean platform.
            </Text>

            <View style={[styles.heroButtons, narrow && styles.heroButtonsNarrow]}>
              <TouchableOpacity style={styles.getStartedButton} onPress={() => router.push("/signup")}>
                <Text style={styles.getStartedButtonText}>Get Started</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineButton} onPress={() => router.push("/login")}>
                <Text style={styles.outlineButtonText}>Open Login</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.metricsRow, narrow && styles.metricsRowNarrow]}>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>4</Text>
                <Text style={styles.metricLabel}>User roles</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>24/7</Text>
                <Text style={styles.metricLabel}>Emergency access</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>1</Text>
                <Text style={styles.metricLabel}>Shared system</Text>
              </View>
            </View>
          </View>

          <View style={[styles.heroCard, compact && styles.heroCardCompact]}>
            <View style={styles.heroLogoFrame}>
              <BrandLogo variant="secondary" width={compact ? 158 : 188} />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionShell}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>Features</Text>
          <Text style={[styles.sectionTitle, narrow && styles.sectionTitleNarrow]}>Powerful Features</Text>
        </View>

        <View style={styles.featureGrid}>
          {features.map((feature) => (
            <View key={feature.title} style={styles.featureCard}>
              <View style={styles.featureIconWrap}>{feature.icon}</View>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.sectionShell, styles.stepsShell]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>Workflow</Text>
          <Text style={[styles.sectionTitle, narrow && styles.sectionTitleNarrow]}>How It Works</Text>
        </View>

        <View style={styles.stepsRow}>
          {steps.map((step) => (
            <View key={step.number} style={styles.stepItem}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>{step.number}</Text>
              </View>
              <Text style={styles.stepLabel}>{step.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerGrid}>
          <View style={styles.footerColumnWide}>
            <Text style={styles.footerBrand}>SakayNa Toledo</Text>
            <Text style={styles.footerText}>Integrated emergency transport and response management system for Toledo City.</Text>
          </View>
          <View style={styles.footerColumn}>
            <Text style={styles.footerHeading}>Product</Text>
            <Text style={styles.footerLink}>Features</Text>
            <Text style={styles.footerLink}>Developers</Text>
            <Text style={styles.footerLink}>Teams</Text>
          </View>
          <View style={styles.footerColumn}>
            <Text style={styles.footerHeading}>Company</Text>
            <Text style={styles.footerLink}>About</Text>
            <Text style={styles.footerLink}>Blog</Text>
            <Text style={styles.footerLink}>Careers</Text>
          </View>
          <View style={styles.footerColumn}>
            <Text style={styles.footerHeading}>Emergency</Text>
            <Text style={styles.footerLink}>Emergency Hotline: 911</Text>
          </View>
        </View>
        <View style={styles.footerDivider} />
        <Text style={styles.footerCopy}>2026 SakayNa. All rights reserved.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F6F7F3",
  },
  content: {
    paddingBottom: 0,
  },
  heroWrap: {
    overflow: "hidden",
    backgroundColor: "#0F6B4F",
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 28,
  },
  heroGlowLeft: {
    position: "absolute",
    top: -80,
    left: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(120, 220, 180, 0.18)",
  },
  heroGlowRight: {
    position: "absolute",
    right: -90,
    bottom: -70,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  topBar: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#D9E7E0",
  },
  topBarCompact: {
    flexWrap: "wrap",
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 34,
  },
  topActions: {
    flexDirection: "row",
    gap: 10,
  },
  topActionsNarrow: {
    width: "100%",
    flexWrap: "wrap",
  },
  topButtonPrimary: {
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: "#F5F2F0",
  },
  topButtonPrimaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#47685D",
  },
  topButtonSecondary: {
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D6DDD9",
    backgroundColor: "#FFFFFF",
  },
  topButtonSecondaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#47685D",
  },
  heroSection: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 20,
    paddingHorizontal: 18,
    marginTop: 18,
  },
  heroSectionCompact: {
    flexWrap: "wrap",
  },
  heroTextBlock: {
    flex: 1.2,
    minWidth: 280,
    paddingVertical: 18,
  },
  eyebrow: {
    alignSelf: "flex-start",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "#E5FFF2",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroTitle: {
    marginTop: 16,
    fontSize: 54,
    lineHeight: 58,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  heroTitleCompact: {
    fontSize: 44,
    lineHeight: 48,
  },
  heroTitleNarrow: {
    fontSize: 34,
    lineHeight: 38,
  },
  heroSubtitle: {
    marginTop: 18,
    maxWidth: 640,
    fontSize: 18,
    lineHeight: 28,
    color: "#D8F5E9",
  },
  heroSubtitleCompact: {
    fontSize: 16,
    lineHeight: 25,
  },
  heroButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 26,
  },
  heroButtonsNarrow: {
    flexWrap: "wrap",
  },
  getStartedButton: {
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: 16,
    backgroundColor: "#F7FFF9",
  },
  getStartedButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F6B4F",
  },
  outlineButton: {
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  outlineButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 28,
  },
  metricsRowNarrow: {
    gap: 10,
  },
  metricCard: {
    minWidth: 120,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  metricLabel: {
    marginTop: 4,
    fontSize: 13,
    color: "#D9F3E7",
  },
  heroCard: {
    flex: 0.9,
    minWidth: 280,
    minHeight: 300,
    padding: 22,
    borderRadius: 24,
    backgroundColor: "#F7F6F4",
    borderWidth: 1,
    borderColor: "#DAECE3",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCardCompact: {
    width: "100%",
  },
  heroLogoFrame: {
    width: 182,
    height: 182,
    borderRadius: 91,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F2ED",
  },
  heroCardBrandLogo: {
    marginTop: 18,
  },
  sectionShell: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingTop: 28,
  },
  sectionHeader: {
    marginBottom: 18,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#4E6A5F",
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "800",
    color: "#142A22",
  },
  sectionTitleNarrow: {
    fontSize: 30,
    lineHeight: 34,
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  featureCard: {
    flexGrow: 1,
    flexBasis: 280,
    padding: 20,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E9E3",
  },
  featureIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F8A5B",
  },
  featureTitle: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: "800",
    color: "#16352B",
  },
  featureText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23,
    color: "#567267",
  },
  stepsShell: {
    paddingBottom: 8,
  },
  stepsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  stepItem: {
    flexGrow: 1,
    flexBasis: 220,
    padding: 20,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E9E3",
    alignItems: "center",
  },
  stepCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F6B4F",
  },
  stepNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  stepLabel: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: "700",
    color: "#1E352D",
    textAlign: "center",
  },
  footer: {
    marginTop: 28,
    width: "100%",
    backgroundColor: "#122030",
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 40,
  },
  footerGrid: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 36,
  },
  footerColumnWide: {
    width: 240,
  },
  footerColumn: {
    width: 160,
  },
  footerBrand: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  footerHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  footerText: {
    marginTop: 22,
    fontSize: 14,
    lineHeight: 22,
    color: "#B7C0CC",
  },
  footerLink: {
    marginTop: 10,
    fontSize: 14,
    color: "#B7C0CC",
  },
  footerDivider: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    marginTop: 34,
    height: 1,
    backgroundColor: "#5F6B78",
  },
  footerCopy: {
    marginTop: 18,
    fontSize: 13,
    color: "#C5CCD5",
    textAlign: "center",
  },
});
