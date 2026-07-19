import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";

import BrandLogo from "../components/BrandLogo";
import { auth, db } from "../firebase";
import { TOLEDO_BARANGAY_OPTIONS } from "../lib/barangays";
import { saveLocalUserProfile } from "../lib/session";

const RESIDENT_ROLE = "Resident";

export default function Signup() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 420;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [barangay, setBarangay] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignup = async () => {
    setErrorMessage("");

    if (!fullName || !email || !password || !confirmPassword || !barangay || !phoneNumber) {
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
        phone: phoneNumber.trim(),
        role: RESIDENT_ROLE,
        accountStatus: "Active",
      });

      try {
        await setDoc(doc(db, "users", userCredential.user.uid), {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          barangay: barangay.trim(),
          phoneNumber: phoneNumber.trim(),
          phone: phoneNumber.trim(),
          role: RESIDENT_ROLE,
          accountStatus: "Active",
          createdAt: serverTimestamp(),
        });
      } catch (firestoreError) {
        console.log("Profile save warning:", firestoreError);
      }

      router.replace("/resident-home");
    } catch (error) {
      console.log("Signup failed:", error);
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.page}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Back to home"
        style={[styles.backButton, isCompact && styles.backButtonCompact]}
        onPress={() => router.replace("/")}
      >
        <Feather name="arrow-left" size={20} color="#0F6B4F" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.card, isCompact && styles.cardCompact]}>
          <BrandLogo variant="main" height={isCompact ? 34 : 40} style={styles.brandLogo} />
          <Text style={[styles.title, isCompact && styles.titleCompact]}>Create Account</Text>

          <TextInput
            style={[styles.input, isCompact && styles.inputCompact]}
            placeholder="Full Name"
            placeholderTextColor="#8B8B8B"
            value={fullName}
            onChangeText={setFullName}
          />
          <TextInput
            style={[styles.input, isCompact && styles.inputCompact]}
            placeholder="Email Address"
            placeholderTextColor="#8B8B8B"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
          <View style={styles.passwordWrap}>
            <TextInput
              style={[styles.passwordInput, isCompact && styles.inputCompact]}
              placeholder="Password"
              placeholderTextColor="#8B8B8B"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              style={styles.eyeButton}
              onPress={() => setShowPassword((current) => !current)}
            >
              <Feather name={showPassword ? "eye-off" : "eye"} size={20} color="#6F6F6F" />
            </TouchableOpacity>
          </View>
          <View style={styles.passwordWrap}>
            <TextInput
              style={[styles.passwordInput, isCompact && styles.inputCompact]}
              placeholder="Confirm Password"
              placeholderTextColor="#8B8B8B"
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              style={styles.eyeButton}
              onPress={() => setShowConfirmPassword((current) => !current)}
            >
              <Feather name={showConfirmPassword ? "eye-off" : "eye"} size={20} color="#6F6F6F" />
            </TouchableOpacity>
          </View>
          <Dropdown
            style={[styles.dropdown, isCompact && styles.inputCompact]}
            containerStyle={styles.dropdownContainer}
            maxHeight={220}
            search
            searchPlaceholder="Search barangay..."
            placeholderStyle={styles.dropdownPlaceholder}
            selectedTextStyle={styles.dropdownSelectedText}
            itemTextStyle={styles.dropdownItemText}
            data={TOLEDO_BARANGAY_OPTIONS}
            labelField="label"
            valueField="value"
            placeholder="Select barangay"
            value={barangay}
            onChange={(item) => setBarangay(item.value)}
          />
          <TextInput
            style={[styles.input, isCompact && styles.inputCompact]}
            placeholder="Phone Number"
            placeholderTextColor="#8B8B8B"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <TouchableOpacity style={[styles.button, isCompact && styles.buttonCompact]} onPress={handleSignup} disabled={isSubmitting}>
            <Text style={styles.buttonText}>{isSubmitting ? "Creating Account..." : "Create Account"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/login")}>
            <Text style={styles.linkText}>Already have an account? Log In</Text>
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
  backButton: {
    position: "absolute",
    top: 24,
    right: 20,
    zIndex: 2,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "#DDE5E0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  backButtonCompact: {
    top: 18,
    right: 16,
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
    maxWidth: 470,
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
    marginBottom: 12,
    fontSize: 15,
    color: "#111111",
    backgroundColor: "#FCFCFC",
  },
  inputCompact: {
    paddingVertical: 12,
    fontSize: 14,
  },
  passwordWrap: {
    width: "100%",
    minHeight: 50,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D7D7D7",
    borderRadius: 12,
    backgroundColor: "#FCFCFC",
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 8,
    fontSize: 15,
    color: "#111111",
  },
  eyeButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdown: {
    width: "100%",
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#D7D7D7",
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#FCFCFC",
  },
  dropdownContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D7D7D7",
    backgroundColor: "#FFFFFF",
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: "#8B8B8B",
  },
  dropdownSelectedText: {
    fontSize: 15,
    color: "#111111",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#111111",
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
