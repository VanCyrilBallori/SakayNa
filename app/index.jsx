import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, Redirect, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import BrandLogo from "../components/BrandLogo";
import MobileLanding from "../components/MobileLanding";
import ScreenState from "../components/ui/ScreenState";
import { getPostAuthenticationRoute } from "../lib/roles";
import { useCurrentUserProfile } from "../lib/session";
import { FONT } from "../constants/design";

export default function Index() {
  // The landing page is for the website only. The phone app shows its own start flow.
  if (Platform.OS !== "web") {
    return <MobileStart />;
  }

  return <WebLandingPage />;
}

// Permission pop-ups are not asked here; see lib/permissions.js (asked after a Resident logs in).
function MobileStart() {
  const { authUser, authStatus, profile, profileStatus } = useCurrentUserProfile();

  if (authStatus !== "ready" || profileStatus === "idle" || profileStatus === "loading") {
    return <ScreenState loading message="Starting SakayNa..." />;
  }

  // Logged in with an allowed account: go to that role's home. Otherwise: the mobile landing page.
  const homeRoute = authUser && profileStatus === "ready" ? getPostAuthenticationRoute(profile) : null;
  return homeRoute ? <Redirect href={homeRoute} /> : <MobileLanding />;
}

function WebLandingPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 960;
  const narrow = width < 560;
  const scrollViewRef = useRef(null);
  const [featuresSectionY, setFeaturesSectionY] = useState(0);

  const features = [
    {
      icon: <FontAwesome name="warning" size={24} color="#FFFFFF" />,
      title: "Emergency Alerts",
      text: "Verified residents can alert a Dispatcher, who can answer and arrange an emergency ride.",
    },
    {
      icon: <FontAwesome name="globe" size={24} color="#FFFFFF" />,
      title: "Android App and Website",
      text: "Residents and Drivers can use the Android app. Dispatchers and Admins can manage requests on the website.",
    },
    {
      icon: <MaterialCommunityIcons name="van-passenger" size={20} color="#FFFFFF" />,
      title: "Driver and Vehicle Assignment",
      text: "A Dispatcher chooses an available driver and barangay vehicle for each ride.",
    },
    {
      icon: <FontAwesome name="exclamation-triangle" size={24} color="#FFFFFF" />,
      title: "Ride Requests Now or Later",
      text: "Request a ride as soon as possible, or schedule one 1 hour to 1 year ahead.",
    },
    {
      icon: <FontAwesome name="pie-chart" size={22} color="#FFFFFF" />,
      title: "Admin Reports",
      text: "Admins can review summaries, waiting times and priority breakdowns from ride requests, and download them as a spreadsheet.",
    },
    {
      icon: <FontAwesome name="dashboard" size={22} color="#FFFFFF" />,
      title: "Four Role Dashboards",
      text: "Separate tools for Residents, Drivers, Dispatchers, and Admins.",
    },
  ];

  const steps = [
    { number: "1", label: "Log in" },
    { number: "2", label: "Request a ride" },
    { number: "3", label: "Dispatcher assigns", description: "a driver and vehicle" },
    { number: "4", label: "Follow your ride's progress" },
  ];

  const scrollToFeatures = () => {
    scrollViewRef.current?.scrollTo({
      y: Math.max(featuresSectionY - 24, 0),
      animated: true,
    });
  };

  return (
    <ScrollView ref={scrollViewRef} style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* The browser knows its width even before React starts, unlike the static website build. */}
      <style>{`
        @media (max-width: 959px) {
          #landing-top-bar { flex-wrap: wrap; }
        }
        @media (max-width: 559px) {
          #landing-top-actions { width: 100%; flex-wrap: wrap; }
          #landing-top-logo { height: 42px !important; width: 127.9091px !important; }
        }
      `}</style>
      <View style={styles.heroWrap}>
        <View style={styles.heroGlowLeft} />
        <View style={styles.heroGlowRight} />

        <View nativeID="landing-top-bar" style={styles.topBar}>
          <View style={styles.brandWrap}>
            <BrandLogo nativeID="landing-top-logo" variant="main" height={50} />
          </View>

          <View nativeID="landing-top-actions" style={styles.topActions}>
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
          </View>

          <View style={[styles.heroCard, compact && styles.heroCardCompact]}>
            <View style={styles.heroLogoFrame}>
              <BrandLogo variant="secondary" width={compact ? 158 : 188} />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionShell} onLayout={(event) => setFeaturesSectionY(event.nativeEvent.layout.y)}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>Features</Text>
          <Text style={[styles.sectionTitle, narrow && styles.sectionTitleNarrow]}>What SakayNa Does</Text>
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
          <Text style={[styles.sectionTitle, narrow && styles.sectionTitleNarrow]}>How Ride Requests Work</Text>
          <Text style={styles.featureText}>
            After signing up, submitting proof of residency, and getting approved, you can request a ride.
          </Text>
        </View>

        <View style={styles.stepsRow}>
          {steps.map((step) => (
            <View key={step.number} style={styles.stepItem}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>{step.number}</Text>
              </View>
              <Text style={styles.stepLabel}>{step.label}</Text>
              {step.description ? <Text style={[styles.featureText, { textAlign: "center" }]}>{step.description}</Text> : null}
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
            <TouchableOpacity onPress={scrollToFeatures}>
              <Text style={styles.footerLink}>Features</Text>
            </TouchableOpacity>
            <Text style={styles.footerLink}>Developers</Text>
            <Text style={styles.footerLink}>Teams</Text>
          </View>
          <View style={styles.footerColumn}>
            <Text style={styles.footerHeading}>Company</Text>
            <Text style={styles.footerLink}>About</Text>
            {/* Link makes a real web link, so Google can see the homepage links to these pages. */}
            <Link href="/terms" target="_blank" rel="noopener noreferrer" style={styles.footerLink}>
              Terms of Service
            </Link>
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" style={styles.footerLink}>
              Privacy Policy
            </Link>
            <TouchableOpacity onPress={() => router.push("/apply-to-drive")}>
              <Text style={styles.footerLink}>Apply to Drive</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.footerDivider} />
        <Text style={styles.footerCopy}>© 2026 SakayNa. All rights reserved.</Text>
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
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 34,
  },
  topActions: {
    flexDirection: "row",
    gap: 10,
  },
  topButtonPrimary: {
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: "#F5F2F0",
  },
  topButtonPrimaryText: {
    fontSize: 16,
    fontFamily: FONT.bold,
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
    fontFamily: FONT.bold,
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
    fontFamily: FONT.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroTitle: {
    marginTop: 16,
    fontSize: 54,
    lineHeight: 58,
    fontFamily: FONT.extraBold,
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
    fontFamily: FONT.regular,
    marginTop: 18,
    maxWidth: 640,
    fontSize: 18,
    lineHeight: 28,
    color: "#D8F5E9",
  },
  heroSubtitleCompact: {
    fontFamily: FONT.regular,
    fontSize: 16,
    lineHeight: 25,
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
    fontFamily: FONT.extraBold,
    color: "#FFFFFF",
  },
  metricLabel: {
    fontFamily: FONT.regular,
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
    fontFamily: FONT.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#4E6A5F",
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 38,
    lineHeight: 42,
    fontFamily: FONT.extraBold,
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
    fontFamily: FONT.extraBold,
    color: "#16352B",
  },
  featureText: {
    fontFamily: FONT.regular,
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
    fontFamily: FONT.extraBold,
    color: "#FFFFFF",
  },
  stepLabel: {
    marginTop: 14,
    fontSize: 18,
    fontFamily: FONT.bold,
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
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 36,
  },
  footerColumnWide: {
    width: 240,
    alignItems: "center",
  },
  footerColumn: {
    width: 160,
    alignItems: "center",
  },
  footerBrand: {
    fontSize: 18,
    fontFamily: FONT.extraBold,
    color: "#FFFFFF",
    textAlign: "center",
  },
  footerHeading: {
    fontSize: 14,
    fontFamily: FONT.bold,
    color: "#FFFFFF",
    textAlign: "center",
  },
  footerText: {
    fontFamily: FONT.regular,
    marginTop: 22,
    fontSize: 14,
    lineHeight: 22,
    color: "#B7C0CC",
    textAlign: "center",
  },
  footerLink: {
    fontFamily: FONT.regular,
    marginTop: 10,
    fontSize: 14,
    color: "#B7C0CC",
    textAlign: "center",
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
    fontFamily: FONT.regular,
    marginTop: 18,
    fontSize: 13,
    color: "#C5CCD5",
    textAlign: "center",
  },
});
