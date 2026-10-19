import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import { FONT } from "../constants/design";

// "← Back" at the top of the Terms and Privacy pages, so nobody feels stuck after opening them from the menu.
// Website: always go Home, because a new tab may have no previous page.
// onPress (optional): what Back does instead, e.g. close the pop-up window the ☰ menu opened the page in.
export default function PageBackButton({ color = "#0F6B4F", onPress }) {
  const router = useRouter();

  const isWeb = Platform.OS === "web";

  // On Android, keep going back to the previous screen, or the start screen if there is none.
  const goBack = () => {
    if (onPress) {
      onPress();
      return;
    }
    if (isWeb) {
      router.replace("/");
      return;
    }
    return router.canGoBack() ? router.back() : router.replace("/");
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={goBack}
      accessibilityRole="button"
      accessibilityLabel={isWeb && !onPress ? "Back to home" : "Go back"}
    >
      <MaterialCommunityIcons name="arrow-left" size={26} color={color} />
      <Text style={[styles.text, { color }]}>{isWeb && !onPress ? "Back to home" : "Back"}</Text>
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
  text: { fontSize: 18, fontFamily: FONT.bold },
});
