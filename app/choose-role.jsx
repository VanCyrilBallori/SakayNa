import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, LIGHT_COLORS } from "../constants/design";
import { auth } from "../firebase";

// The two account types a person can create by themselves.
// Dispatcher and Admin accounts are made by an Admin, so they are not here.
const ROLE_CHOICES = [
  {
    key: "resident",
    title: "Resident",
    icon: "home-account",
    description: "You live in Toledo City and need a ride or emergency help.",
  },
  {
    key: "driver",
    title: "Driver",
    icon: "steering",
    description: "You want to drive a barangay vehicle for SakayNa.",
  },
];

// The only place where a new user chooses Resident or Driver. They are always signed in here:
// Google users come straight after Google sign-in, email users come after Verify Your Email.
// Always light, like the landing page.
export default function ChooseRole() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = LIGHT_COLORS;
  const [resident, driver] = ROLE_CHOICES;

  const chooseRole = (choice) => {
    if (!auth.currentUser) {
      // Not signed in (should not happen): an account must be made first.
      router.replace("/signup");
    } else if (choice.key === "resident") {
      router.push("/register-resident");
    } else {
      // The new driver form comes in login-overhaul-plan.md Step 9.
      Alert.alert("Coming soon", "Driver sign-up in the app is coming soon.");
    }
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.page }]}>
      {/* Dark clock/battery icons so they stay visible on the white page. */}
      <StatusBar style="dark" />

      {/* Scrolls when the phone's text size is very large, so nothing gets cut off. */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Pressable
          style={styles.backButton}
          onPress={goBack}
          android_ripple={{ color: colors.ripple, borderless: true }}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <MaterialCommunityIcons name="arrow-left" size={28} color={colors.heading} />
        </Pressable>

        <Text style={[styles.title, { color: colors.heading }]} accessibilityRole="header">
          Are you a Resident or a Driver?
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Choose one to create your account.</Text>

        {/* What each choice means. Screen readers skip this part because each button below already says it. */}
        <View style={styles.explanations} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {ROLE_CHOICES.map((choice) => (
            <View key={choice.key} style={styles.explanationRow}>
              <View style={[styles.iconDisc, { backgroundColor: colors.ripple }]}>
                <MaterialCommunityIcons name={choice.icon} size={28} color={colors.link} />
              </View>
              <View style={styles.explanationText}>
                <Text style={[styles.explanationTitle, { color: colors.heading }]}>{choice.title}</Text>
                <Text style={[styles.explanationCopy, { color: colors.muted }]}>{choice.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Resident is the filled green button because most people who sign up are residents. */}
        <View style={styles.buttons}>
          <RoleButton choice={resident} filled colors={colors} onPress={() => chooseRole(resident)} />
          <RoleButton choice={driver} colors={colors} onPress={() => chooseRole(driver)} />
        </View>
      </ScrollView>
    </View>
  );
}

// One big button. "filled" = SakayNa green. Otherwise a light panel with a green-grey outline so its edges are easy to see.
function RoleButton({ choice, filled = false, colors, onPress }) {
  const textColor = filled ? "#FFFFFF" : colors.heading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        filled ? styles.buttonFilled : { backgroundColor: colors.card, borderColor: colors.outline },
        pressed && styles.buttonPressed,
      ]}
      onPress={onPress}
      android_ripple={{ color: filled ? "rgba(255, 255, 255, 0.24)" : colors.ripple }}
      accessibilityRole="button"
      accessibilityLabel={`${choice.title}. ${choice.description}`}
    >
      <MaterialCommunityIcons name={choice.icon} size={26} color={textColor} />
      <Text style={[styles.buttonText, { color: textColor }]}>{choice.title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20 },
  backButton: { width: 48, height: 48, marginLeft: -8, alignItems: "center", justifyContent: "center", borderRadius: 24 },
  title: { marginTop: 24, fontSize: 28, lineHeight: 36, fontWeight: "800", textAlign: "center" },
  subtitle: { marginTop: 10, fontSize: 16, lineHeight: 23, textAlign: "center" },
  // Takes the free space in the middle of the screen and centers the two explanations in it.
  explanations: { flex: 1, justifyContent: "center", gap: 28, paddingVertical: 40, width: "100%", maxWidth: 440, alignSelf: "center" },
  explanationRow: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  iconDisc: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  explanationText: { flex: 1, paddingTop: 2 },
  explanationTitle: { fontSize: 18, lineHeight: 24, fontWeight: "800" },
  explanationCopy: { marginTop: 4, fontSize: 16, lineHeight: 23 },
  buttons: { gap: 12, width: "100%", maxWidth: 480, alignSelf: "center" },
  button: {
    minHeight: 60,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  buttonFilled: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  buttonPressed: { opacity: 0.88 },
  buttonText: { fontSize: 18, fontWeight: "800" },
});
