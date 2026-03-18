import { Stack } from "expo-router";

export default function RootLayout() {
  return (
<<<<<<< HEAD
    <Stack screenOptions={{ headerShown: false }} />
  );
}
=======
    <Stack>
      <Stack.Screen 
        name="index"
        options={{ title: "SakayNa" }} 
      />
      <Stack.Screen name="login" options={{ title: "Login" }} />
  <Stack.Screen name="signup" options={{ title: "Sign Up" }} />
    </Stack>
  );
}
>>>>>>> 716f669d67c2b764885255bc6e08f9fc01e9d199
