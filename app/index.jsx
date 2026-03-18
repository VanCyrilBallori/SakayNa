import { useRouter } from "expo-router";
<<<<<<< HEAD
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5, Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
=======
import { Button, View } from "react-native";
>>>>>>> 716f669d67c2b764885255bc6e08f9fc01e9d199

export default function Index() {
  const router = useRouter();

<<<<<<< HEAD
  const features = [
    {
      icon: <Ionicons name="globe-outline" size={26} color="#FFFFFF" />,
      title: "Web and Mobile Access",
      text: "Users can access the system using a web browser or mobile device.",
    },
    {
      icon: <MaterialIcons name="crisis-alert" size={26} color="#FFFFFF" />,
      title: "Emergency Request & SOS Button",
      text: "Residents can send emergency requests quickly with basic details.",
    },
    {
      icon: <FontAwesome5 name="ambulance" size={22} color="#FFFFFF" />,
      title: "Vehicle Assignment",
      text: "Available vehicles are assigned to requests by barangay dispatchers or the system.",
    },
    {
      icon: <Ionicons name="warning-outline" size={26} color="#FFFFFF" />,
      title: "Disaster Response Mode",
      text: "Supports evacuation and emergency transport during disasters.",
    },
    {
      icon: <MaterialCommunityIcons name="chart-donut" size={24} color="#FFFFFF" />,
      title: "Reports and Analytics",
      text: "View transport activity and response patterns in a clean reporting area.",
    },
    {
      icon: <MaterialCommunityIcons name="view-dashboard-outline" size={24} color="#FFFFFF" />,
      title: "Multi-User Dashboard",
      text: "Separate dashboards for residents, drivers, dispatchers, and city administrators.",
    },
    {
      icon: <MaterialCommunityIcons name="alarm-light-outline" size={24} color="#FFFFFF" />,
      title: "Emergency Priority System",
      text: "Requests are classified as critical, urgent, or non-urgent for proper handling.",
    },
  ];

  const steps = [
    { number: "1", label: "Tap SOS" },
    { number: "2", label: "Select Priority" },
    { number: "3", label: "Share Location" },
    { number: "4", label: "Get Help" },
  ];

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.topButton} onPress={() => router.push("/signup")}>
            <Text style={styles.topButtonText}>Register</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.topButton} onPress={() => router.push("/login")}>
            <Text style={styles.topButtonText}>Log In</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.navBar}>
        <View style={styles.brandWrap}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>S</Text>
          </View>
          <Text style={styles.brandText}>SakayNa</Text>
        </View>

        <View style={styles.navLinks}>
          <TouchableOpacity onPress={() => {}}>
            <Text style={styles.navLink}>About Us</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {}}>
            <Text style={styles.navLink}>Contact</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {}}>
            <Text style={styles.navLink}>Support</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.heroSection}>
        <View style={styles.heroPatternLeft}>
          <View style={[styles.patternBar, { height: 272 }]} />
          <View style={[styles.patternBar, { height: 204 }]} />
          <View style={[styles.patternBar, { height: 273 }]} />
          <View style={[styles.patternBar, { height: 182 }]} />
        </View>

        <View style={styles.heroPatternRight}>
          <View style={[styles.patternBar, { height: 160 }]} />
          <View style={[styles.patternBar, { height: 208 }]} />
          <View style={[styles.patternBar, { height: 104 }]} />
        </View>

        <View style={styles.heroTextBlock}>
          <Text style={styles.heroTitle}>SAFE. FAST.</Text>
          <Text style={styles.heroTitle}>CONNECTED.</Text>
          <Text style={styles.heroSubtitle}>
            An integrated emergency transport and response management system for Toledo City. Connecting residents,
            drivers, and city officials to save lives and improve mobility.
          </Text>

          <View style={styles.heroButtons}>
            <TouchableOpacity style={styles.downloadButton} onPress={() => {}}>
              <Text style={styles.downloadButtonText}>Download</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.getStartedButton} onPress={() => router.push("/signup")}>
              <Text style={styles.getStartedButtonText}>Get started</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLogoMark}>
            <Text style={styles.heroLogoMarkText}>S</Text>
          </View>
          <Text style={styles.heroCardBrand}>SakayNa</Text>
        </View>
      </View>

      <View style={styles.featuresSection}>
        <Text style={styles.featuresHeading}>POWERFUL FEATURES</Text>
        <Text style={styles.featuresSubheading}>Everything you need for coordinated emergency response</Text>

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

      <View style={styles.howSection}>
        <Text style={styles.howTitle}>HOW IT WORKS</Text>
        <Text style={styles.howSubtitle}>Simple steps to get emergency help</Text>

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
        <Text style={styles.footerCopy}>@ 2026 SakayNa. All rights reserved.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    paddingBottom: 0,
  },
  topBar: {
    backgroundColor: "#61756C",
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: "flex-end",
  },
  topActions: {
    flexDirection: "row",
    gap: 8,
  },
  topButton: {
    minWidth: 110,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 4,
    backgroundColor: "#F2F0EE",
    alignItems: "center",
  },
  topButtonText: {
    color: "#3B5F52",
    fontSize: 15,
    fontWeight: "700",
  },
  navBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#446A5F",
    alignItems: "center",
    justifyContent: "center",
  },
  logoMarkText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    fontStyle: "italic",
  },
  brandText: {
    fontSize: 24,
    fontWeight: "900",
    color: "#202020",
    fontStyle: "italic",
  },
  navLinks: {
    flexDirection: "row",
    gap: 32,
  },
  navLink: {
    color: "#406455",
    fontSize: 15,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  heroSection: {
    minHeight: 430,
    paddingHorizontal: 54,
    paddingVertical: 48,
    backgroundColor: "#0B9860",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  heroPatternLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    flexDirection: "row",
    gap: 28,
  },
  heroPatternRight: {
    position: "absolute",
    right: 86,
    bottom: 0,
    flexDirection: "row",
    gap: 26,
  },
  patternBar: {
    width: 54,
    backgroundColor: "rgba(47,95,79,0.92)",
  },
  heroTextBlock: {
    width: "52%",
    zIndex: 1,
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: "900",
    color: "#FFFFFF",
    fontStyle: "italic",
    lineHeight: 50,
  },
  heroSubtitle: {
    marginTop: 26,
    maxWidth: 520,
    fontSize: 16,
    lineHeight: 22,
    color: "#F7FFFB",
    fontStyle: "italic",
  },
  heroButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 26,
  },
  downloadButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 4,
    backgroundColor: "#F4F2EF",
  },
  downloadButtonText: {
    color: "#3B5F52",
    fontSize: 15,
    fontWeight: "700",
  },
  getStartedButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  getStartedButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  heroCard: {
    width: 280,
    height: 274,
    borderRadius: 22,
    backgroundColor: "#F7F6F4",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    zIndex: 1,
  },
  heroLogoMark: {
    width: 124,
    height: 124,
    borderRadius: 62,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#45695C",
  },
  heroLogoMarkText: {
    fontSize: 82,
    fontWeight: "900",
    color: "#FFFFFF",
    fontStyle: "italic",
  },
  heroCardBrand: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: "900",
    color: "#304D42",
    fontStyle: "italic",
  },
  featuresSection: {
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 44,
    backgroundColor: "#E5E1DB",
  },
  featuresHeading: {
    fontSize: 58,
    fontWeight: "900",
    color: "#06774B",
    textAlign: "center",
  },
  featuresSubheading: {
    marginTop: 2,
    fontSize: 18,
    color: "#06774B",
    textAlign: "center",
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 22,
    marginTop: 22,
  },
  featureCard: {
    width: 294,
    minHeight: 190,
    padding: 18,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  featureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#06774B",
  },
  featureTitle: {
    marginTop: 22,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: "#06774B",
  },
  featureText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 18,
    color: "#0D6A4A",
  },
  howSection: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 42,
    backgroundColor: "#FFFFFF",
  },
  howTitle: {
    fontSize: 58,
    fontWeight: "900",
    color: "#050505",
    textAlign: "center",
  },
  howSubtitle: {
    marginTop: -2,
    fontSize: 16,
    textAlign: "center",
    color: "#252525",
  },
  stepsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-evenly",
    marginTop: 34,
    gap: 18,
  },
  stepItem: {
    alignItems: "center",
    width: 170,
  },
  stepCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#06774B",
  },
  stepNumber: {
    fontSize: 46,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  stepLabel: {
    marginTop: 12,
    fontSize: 18,
    color: "#111111",
  },
  footer: {
    paddingHorizontal: 48,
    paddingTop: 34,
    paddingBottom: 22,
    backgroundColor: "#0F1C2C",
  },
  footerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 42,
  },
  footerColumnWide: {
    width: 210,
  },
  footerColumn: {
    width: 120,
  },
  footerBrand: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  footerHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  footerText: {
    marginTop: 18,
    fontSize: 14,
    lineHeight: 20,
    color: "#B9C1CC",
  },
  footerLink: {
    marginTop: 10,
    fontSize: 14,
    color: "#B9C1CC",
  },
  footerDivider: {
    marginTop: 42,
    height: 1,
    backgroundColor: "#B9C1CC",
  },
  footerCopy: {
    marginTop: 18,
    color: "#C1C8D1",
    textAlign: "center",
    fontSize: 14,
  },
});
=======
  return (
    <View style={{ flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#008F5B", }}>
      <Button title="Login" onPress={() => router.push("/login")} />
      <Button title="Sign Up" onPress={() => router.push("/signup")} />
    </View>
  );
}
>>>>>>> 716f669d67c2b764885255bc6e08f9fc01e9d199
