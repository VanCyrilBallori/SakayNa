import { useRouter } from "expo-router";
<<<<<<< HEAD
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { auth, db } from "../firebase";
import { getRoleRoute } from "../lib/roles";
import { getLocalUserProfile, saveLocalUserProfile } from "../lib/session";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    setErrorMessage("");

    if (!email || !password) {
      setErrorMessage("Please enter your email and password.");
      return;
    }

    try {
      setIsSubmitting(true);
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const cachedProfile = getLocalUserProfile({
        uid: userCredential.user.uid,
        email,
      });

      try {
        const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          saveLocalUserProfile({
            uid: userCredential.user.uid,
            email: userCredential.user.email ?? email,
            fullName: userData.fullName ?? "",
            barangay: userData.barangay ?? "",
            phoneNumber: userData.phoneNumber ?? "",
            role: userData.role ?? "Resident",
          });
          router.replace(getRoleRoute(userData.role));
          return;
        }
      } catch (firestoreError) {
        console.log("Role lookup warning:", firestoreError);
      }

      if (cachedProfile?.role) {
        router.replace(getRoleRoute(cachedProfile.role));
        return;
      }

      setErrorMessage("Your account role was not found yet. Please sign up again or save your profile to Firestore.");
    } catch (error) {
      console.log("Login failed:", error);
      const cachedProfile = getLocalUserProfile({
        uid: auth.currentUser?.uid,
        email,
      });

      if (cachedProfile?.role && error.message?.includes("Missing or insufficient permissions")) {
        router.replace(getRoleRoute(cachedProfile.role));
        return;
      }

      setErrorMessage(error.message || "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.brand}>SakayNa</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>Sign in to your SakayNa account</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#8B8B8B"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#8B8B8B"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isSubmitting}>
            <Text style={styles.buttonText}>{isSubmitting ? "Signing In..." : "Login"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/signup")}>
            <Text style={styles.linkText}>No account yet? Sign Up</Text>
          </TouchableOpacity>
        </View>
=======
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
>>>>>>> 716f669d67c2b764885255bc6e08f9fc01e9d199
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
  page: {
    flex: 1,
    backgroundColor: "#F3F0EB",
  },
  header: {
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
  },
  brand: {
    fontSize: 30,
    fontWeight: "700",
    color: "#008F5B",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  card: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#111111",
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 20,
    fontSize: 15,
    color: "#555555",
  },
  input: {
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#D7D7D7",
    borderRadius: 10,
    marginBottom: 14,
    fontSize: 15,
    color: "#111111",
    backgroundColor: "#FCFCFC",
  },
  errorText: {
    marginBottom: 12,
    color: "#C62828",
    fontSize: 14,
  },
  button: {
    width: "100%",
    backgroundColor: "#008F5B",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  linkText: {
    color: "#008F5B",
    marginTop: 16,
    fontWeight: "600",
    textDecorationLine: "underline",
    alignSelf: "center",
  },
=======
  outerContainer: { flex: 1, backgroundColor: "#008F5B", justifyContent: "center", alignItems: "center" },
  innerContainer: { width: "90%", backgroundColor: "white", borderRadius: 20, padding: 20, alignItems: "center" },
  title: { fontSize: 24, marginBottom: 20, color: "#008F5B" },
  input: { width: "100%", padding: 15, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, marginBottom: 15 },
  button: { width: "100%", backgroundColor: "#008F5B", padding: 15, borderRadius: 8, alignItems: "center" },
  buttonText: { color: "white", fontSize: 16 },
  linkText: { color: "#008F5B", marginTop: 15, textDecorationLine: "underline" },
>>>>>>> 716f669d67c2b764885255bc6e08f9fc01e9d199
});
