import { useRouter } from "expo-router";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function Login() {
  const router = useRouter();

  return (
    <View style={styles.outerContainer}>
      <View style={styles.innerContainer}>
        <Text style={styles.title}>Welcome Back</Text>

        <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#ccc" />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#ccc" secureTextEntry />

        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/signup")}>
          <Text style={styles.linkText}>No Account? Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: "#008F5B", justifyContent: "center", alignItems: "center" },
  innerContainer: { width: "90%", backgroundColor: "white", borderRadius: 20, padding: 20, alignItems: "center" },
  title: { fontSize: 24, marginBottom: 20, color: "#008F5B" },
  input: { width: "100%", padding: 15, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, marginBottom: 15 },
  button: { width: "100%", backgroundColor: "#008F5B", padding: 15, borderRadius: 8, alignItems: "center" },
  buttonText: { color: "white", fontSize: 16 },
  linkText: { color: "#008F5B", marginTop: 15, textDecorationLine: "underline" },
});
