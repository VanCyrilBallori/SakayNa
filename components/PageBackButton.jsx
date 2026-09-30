import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, Text } from "react-native";

// "← Back" at the top of the Terms and Privacy pages, so nobody feels stuck after opening them from the menu.
// Phone app only: on the website these pages stay as they are (the browser has its own Back button).
export default function PageBackButton({ color = "#0F6B4F" }) {
  const router = useRouter();

  if (Platform.OS === "web") return null;

  // Go back to the screen before. If there is none (the page was opened directly), go to the start screen.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={goBack}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <MaterialCommunityIcons name="arrow-left" size={26} color={color} />
      <Text style={[styles.text, { color }]}>Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    marginLeft: -8,
    marginBottom: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  pressed: { backgroundColor: "rgba(6, 119, 75, 0.1)" },
  text: { fontSize: 18, fontWeight: "700" },
});
