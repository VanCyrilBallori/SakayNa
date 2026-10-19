import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import AuthRouteGate from "../components/AuthRouteGate";
import { ThemeProvider } from "../lib/theme";

// Keep the splash screen up until the app's font (Plus Jakarta Sans, DESIGN.md "Style") is ready,
// so text never jumps from one font to another. Only the 5 weights the app uses are loaded.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // The names here are the font names in constants/design.js (FONT).
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // If the font can't load, the app still opens (with the phone's own font) instead of staying on the splash.
  const ready = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <AuthRouteGate>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthRouteGate>
    </ThemeProvider>
  );
}
