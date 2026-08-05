import { Stack } from "expo-router";

import AuthRouteGate from "../components/AuthRouteGate";
import { ThemeProvider } from "../lib/theme";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthRouteGate>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthRouteGate>
    </ThemeProvider>
  );
}