import { useRouter } from "expo-router";
import { Button, View } from "react-native";

export default function Index() {
  const router = useRouter();

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
