import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";

import BrandLogo from "../components/BrandLogo";
import { auth, db } from "../firebase";
import { getRoleRoute } from "../lib/roles";
import { getLocalUserProfile, saveLocalUserProfile } from "../lib/session";

export default function Login() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 420;
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
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.card, isCompact && styles.cardCompact]}>
          <BrandLogo variant="main" height={isCompact ? 34 : 40} style={styles.brandLogo} />
          <Text style={[styles.title, isCompact && styles.titleCompact]}>Log In</Text>

          <TextInput
            style={[styles.input, isCompact && styles.inputCompact]}
            placeholder="Email"
            placeholderTextColor="#8B8B8B"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={[styles.input, isCompact && styles.inputCompact]}
            placeholder="Password"
            placeholderTextColor="#8B8B8B"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <TouchableOpacity style={[styles.button, isCompact && styles.buttonCompact]} onPress={handleLogin} disabled={isSubmitting}>
            <Text style={styles.buttonText}>{isSubmitting ? "Signing In..." : "Log In"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/signup")}>
            <Text style={styles.linkText}>No account yet? Create Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F3F0EB",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#DDE5E0",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardCompact: {
    padding: 18,
    borderRadius: 16,
  },
  brandLogo: {
    marginBottom: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#111111",
    marginBottom: 18,
  },
  titleCompact: {
    fontSize: 25,
    marginBottom: 16,
  },
  input: {
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#D7D7D7",
    borderRadius: 12,
    marginBottom: 14,
    fontSize: 15,
    color: "#111111",
    backgroundColor: "#FCFCFC",
  },
  inputCompact: {
    paddingVertical: 12,
    fontSize: 14,
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
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  buttonCompact: {
    paddingVertical: 12,
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
    alignSelf: "center",
  },
});
