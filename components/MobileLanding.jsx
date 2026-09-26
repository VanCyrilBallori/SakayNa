import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BrandLogo from "./BrandLogo";
import { TERMS_URL } from "../constants/app";
import { COLORS } from "../constants/design";

// Follows the phone's own light/dark setting, because nobody is logged in yet on this screen.
const PALETTES = {
  light: {
    page: "#EEF5F1",
    arc: "rgba(6, 119, 75, 0.10)",
    card: "#FFFFFF",
    heading: COLORS.text,
    muted: COLORS.mutedText,
    link: COLORS.primary,
    building: "rgba(6, 119, 75, 0.12)",
    groundShadow: "rgba(23, 56, 46, 0.10)",
    phoneFrame: "#17382E",
    phoneScreen: "#F7FBF9",
    map: "#DDEEE5",
    road: "#FFFFFF",
    van: COLORS.primary,
  },
  dark: {
    page: "#111815",
    arc: "rgba(92, 201, 154, 0.08)",
    card: "#1A2420",
    heading: "#F1F5F2",
    muted: "#B1C1BA",
    link: "#5CC99A",
    building: "rgba(92, 201, 154, 0.12)",
    groundShadow: "rgba(0, 0, 0, 0.35)",
    phoneFrame: "#050807",
    phoneScreen: "#22302A",
    map: "#1E3A30",
    road: "#2E4A3F",
    van: "#5CC99A",
  },
};

// Faint city skyline behind the phone and van: [left, width, height] in the 320-wide drawing.
const BUILDINGS = [
  [0, 34, 70],
  [30, 28, 112],
  [62, 40, 84],
  [104, 30, 142],
  [138, 46, 96],
  [188, 26, 126],
  [218, 42, 78],
  [262, 30, 132],
  [292, 28, 88],
];
const GROUND_Y = 200;

export default function MobileLanding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const colors = useColorScheme() === "dark" ? PALETTES.dark : PALETTES.light;

  // The illustration is drawn on a 320 x 230 grid and scaled to fit small and large phones.
  const scale = Math.min((width - 48) / 320, (height * 0.36) / 230, 1.2);
  const u = (value) => value * scale;
  const logoSize = Math.min(96, height * 0.12);

  const openTerms = () => {
    WebBrowser.openBrowserAsync(TERMS_URL).catch((error) => console.log("Terms page warning:", error));
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.page }]}>
      <View style={[styles.arcTop, { backgroundColor: colors.arc }]} />
      <View style={[styles.arcBottom, { backgroundColor: colors.arc }]} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View
          style={[styles.logoDisc, { width: logoSize, height: logoSize, borderRadius: logoSize / 2 }]}
          accessible
          accessibilityRole="image"
          accessibilityLabel="SakayNa"
        >
          <BrandLogo variant="secondary" height={logoSize * 0.56} style={styles.logoMark} />
        </View>

        <View style={styles.artArea}>
          <View
            style={{ width: u(320), height: u(230) }}
            accessible
            accessibilityRole="image"
            accessibilityLabel="A phone requesting a SakayNa van in Toledo City"
          >
            {BUILDINGS.map(([left, buildingWidth, buildingHeight]) => (
              <View
                key={left}
                style={{
                  position: "absolute",
                  left: u(left),
                  top: u(GROUND_Y - buildingHeight),
                  width: u(buildingWidth),
                  height: u(buildingHeight),
                  borderTopLeftRadius: u(3),
                  borderTopRightRadius: u(3),
                  backgroundColor: colors.building,
                }}
              />
            ))}

            <View
              style={{
                position: "absolute",
                left: u(20),
                top: u(GROUND_Y - 6),
                width: u(290),
                height: u(14),
                borderRadius: u(7),
                backgroundColor: colors.groundShadow,
              }}
            />

            {/* Phone showing a mini map and a pickup pin */}
            <View
              style={{
                position: "absolute",
                left: u(28),
                top: u(20),
                width: u(100),
                height: u(184),
                padding: u(5),
                borderRadius: u(18),
                backgroundColor: colors.phoneFrame,
              }}
            >
              <View style={{ flex: 1, borderRadius: u(14), overflow: "hidden", backgroundColor: colors.phoneScreen }}>
                <View style={{ height: u(18), justifyContent: "center", paddingHorizontal: u(7) }}>
                  <BrandLogo variant="secondary" height={u(10)} style={{ tintColor: colors.link }} />
                </View>

                <View style={{ height: u(88), marginHorizontal: u(5), borderRadius: u(8), overflow: "hidden", backgroundColor: colors.map }}>
                  <View style={[styles.road, { top: u(30), height: u(3), backgroundColor: colors.road, transform: [{ rotate: "-24deg" }] }]} />
                  <View style={[styles.road, { top: u(58), height: u(3), backgroundColor: colors.road, transform: [{ rotate: "18deg" }] }]} />
                  <View style={styles.mapCenter}>
                    <MaterialCommunityIcons name="map-marker" size={u(26)} color={colors.link} />
                    <Text allowFontScaling={false} style={{ fontSize: u(7), fontWeight: "700", color: colors.heading }}>
                      Toledo City
                    </Text>
                  </View>
                </View>

                <View style={{ marginHorizontal: u(7), marginTop: u(7) }}>
                  <Text allowFontScaling={false} style={{ fontSize: u(6), color: colors.muted }}>
                    Pickup
                  </Text>
                  <Text allowFontScaling={false} style={{ fontSize: u(7.5), fontWeight: "700", color: colors.heading }}>
                    Poblacion
                  </Text>
                </View>

                <View
                  style={{
                    height: u(16),
                    marginHorizontal: u(5),
                    marginTop: u(8),
                    borderRadius: u(8),
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: COLORS.primary,
                  }}
                >
                  <Text allowFontScaling={false} style={{ fontSize: u(6.5), fontWeight: "800", color: "#FFFFFF" }}>
                    Request a Ride
                  </Text>
                </View>
              </View>
            </View>

            {/* SakayNa van, wheels resting on the ground line */}
            <View style={{ position: "absolute", left: u(150), top: u(GROUND_Y - 119) }}>
              <MaterialCommunityIcons name="van-passenger" size={u(150)} color={colors.van} />
              <View
                style={{
                  position: "absolute",
                  left: u(62),
                  top: u(71),
                  width: u(26),
                  height: u(26),
                  borderRadius: u(13),
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <BrandLogo variant="secondary" height={u(15)} style={{ tintColor: COLORS.primary }} />
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.heading, { color: colors.heading }]}>Request a Ride now</Text>

          <Pressable
            style={styles.primaryButton}
            android_ripple={{ color: "rgba(255, 255, 255, 0.24)" }}
            onPress={() => router.push("/signup")}
            accessibilityRole="button"
            accessibilityLabel="Get Started. Create a SakayNa account."
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
            <MaterialCommunityIcons name="arrow-right" size={22} color="#FFFFFF" />
          </Pressable>

          <Pressable style={styles.textLink} onPress={() => router.push("/login")} accessibilityRole="link">
            <Text style={[styles.textLinkText, { color: colors.muted }]}>
              Already have an account? <Text style={[styles.linkStrong, { color: colors.link }]}>Log In</Text>
            </Text>
          </Pressable>

          <Pressable style={styles.termsLink} onPress={openTerms} accessibilityRole="link">
            <Text style={[styles.termsText, { color: colors.muted }]}>
              By continuing, you agree to SakayNa&apos;s{" "}
              <Text style={[styles.termsStrong, { color: colors.link }]}>Terms of Service</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  arcTop: { position: "absolute", top: -190, left: -150, width: 300, height: 300, borderRadius: 150 },
  arcBottom: { position: "absolute", bottom: -130, right: -150, width: 280, height: 280, borderRadius: 140 },
  content: { flexGrow: 1, alignItems: "center", paddingHorizontal: 16 },
  logoDisc: { alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary },
  logoMark: { tintColor: "#FFFFFF" },
  artArea: { flex: 1, width: "100%", minHeight: 160, alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  road: { position: "absolute", left: -20, right: -20 },
  mapCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    width: "100%",
    maxWidth: 480,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    borderRadius: 24,
    elevation: 2,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  heading: { fontSize: 26, lineHeight: 32, fontWeight: "800", textAlign: "center" },
  primaryButton: {
    minHeight: 56,
    marginTop: 20,
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.primary,
  },
  primaryButtonText: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
  textLink: { minHeight: 48, marginTop: 8, alignItems: "center", justifyContent: "center" },
  textLinkText: { fontSize: 15, textAlign: "center" },
  linkStrong: { fontWeight: "800" },
  termsLink: { minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  termsText: { fontSize: 12.5, lineHeight: 18, textAlign: "center" },
  termsStrong: { fontWeight: "700", textDecorationLine: "underline" },
});
