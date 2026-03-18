<<<<<<< HEAD
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { auth, db } from "../firebase";
import { getRoleRoute, ROLE_OPTIONS } from "../lib/roles";
import { saveLocalUserProfile } from "../lib/session";

export default function Signup() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [barangay, setBarangay] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [role, setRole] = useState("Resident");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignup = async () => {
    setErrorMessage("");

    if (!fullName || !email || !password || !confirmPassword || !barangay || !phoneNumber || !role) {
      setErrorMessage("Please complete all signup fields.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Your passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);

      saveLocalUserProfile({
        uid: userCredential.user.uid,
        email,
        fullName: fullName.trim(),
        barangay: barangay.trim(),
        phoneNumber: phoneNumber.trim(),
        role,
      });

      try {
        await setDoc(doc(db, "users", userCredential.user.uid), {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          barangay: barangay.trim(),
          phoneNumber: phoneNumber.trim(),
          role,
          createdAt: serverTimestamp(),
        });
      } catch (firestoreError) {
        console.log("Profile save warning:", firestoreError);
      }

      router.replace(getRoleRoute(role));
    } catch (error) {
      console.log("Signup failed:", error);
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.brand}>SakayNa</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        <View style={styles.card}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up and choose the role that matches your account.</Text>

          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#8B8B8B"
            value={fullName}
            onChangeText={setFullName}
          />
          <TextInput
            style={styles.input}
            placeholder="Email Address"
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
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#8B8B8B"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Barangay"
            placeholderTextColor="#8B8B8B"
            value={barangay}
            onChangeText={setBarangay}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            placeholderTextColor="#8B8B8B"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />

          <Text style={styles.roleLabel}>Select Role</Text>
          <View style={styles.roleGrid}>
            {ROLE_OPTIONS.map((option) => {
              const active = role === option;

              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.roleChip, active && styles.roleChipActive]}
                  onPress={() => setRole(option)}
                >
                  <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={isSubmitting}>
            <Text style={styles.buttonText}>{isSubmitting ? "Creating Account..." : "Create Account"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/login")}>
            <Text style={styles.linkText}>Already have an account? Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F3F0EB",
  },
  header: {
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 12,
  },
  brand: {
    fontSize: 30,
    fontWeight: "700",
    color: "#008F5B",
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  card: {
    width: "100%",
    maxWidth: 460,
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
    marginBottom: 12,
    fontSize: 15,
    color: "#111111",
    backgroundColor: "#FCFCFC",
  },
  roleLabel: {
    marginBottom: 10,
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  roleChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#D7D7D7",
    borderRadius: 20,
    backgroundColor: "#F7F7F7",
  },
  roleChipActive: {
    backgroundColor: "#008F5B",
    borderColor: "#008F5B",
  },
  roleChipText: {
    color: "#333333",
    fontWeight: "600",
  },
  roleChipTextActive: {
    color: "#FFFFFF",
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
});
=======
import { Text, View } from "react-native";

export default function Signup() {
  return (
    <View style={{flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#E2DFDA",}}>
      <Text>Sign Up Screen</Text>
    </View>
  );
}
>>>>>>> 716f669d67c2b764885255bc6e08f9fc01e9d199
