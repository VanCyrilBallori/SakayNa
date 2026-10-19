import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppButton from "./ui/AppButton";
import FeedbackMessage from "./ui/FeedbackMessage";
import { CORNER, FONT, NEUTRAL, ORANGE, RED, SHADOW } from "../constants/design";
import { confirmIdentity, deleteOwnLogin, getDeleteErrorMessage, getSignInMethod, markProfileDeleted } from "../lib/deleteAccount";

// The "Delete your account?" pop-up (ROADMAP Task 3.15), opened from Settings (Resident and Driver).
// blockedReason = why the account can't be deleted right now (an open ride, an alert, still punched in), or "".
// finishOnly = the account already has its "deleted" mark but the login was not removed (the internet dropped):
//   only confirm and delete the login (AuthRouteGate opens it this way).
export default function DeleteAccountSheet({ visible, onClose, blockedReason = "", finishOnly = false }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const method = getSignInMethod();
  const googleOnWeb = method === "google" && Platform.OS === "web";
  const [password, setPassword] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busyText, setBusyText] = useState("");
  const [error, setError] = useState("");

  // Every time it opens: empty password, box unticked, no old message.
  useEffect(() => {
    if (!visible) return;
    setPassword("");
    setUnderstood(false);
    setBusyText("");
    setError("");
  }, [visible]);

  const busy = Boolean(busyText);
  const canDelete = understood && !busy && (method !== "password" || password.length > 0);

  const deleteAccount = async () => {
    if (!canDelete) return;
    setError("");
    try {
      setBusyText("Checking it is you…");
      await confirmIdentity({ method, password });
      setBusyText("Deleting…");
      if (!finishOnly) await markProfileDeleted();
      await deleteOwnLogin();
      onClose();
      // Signed out now: back to the start screen, then say what happened.
      router.replace("/");
      const message = "Your SakayNa account was deleted.";
      if (Platform.OS === "web") window.alert(message);
      else Alert.alert("Account deleted", message);
    } catch (deleteError) {
      console.log("Delete account failed:", deleteError);
      setError(getDeleteErrorMessage(deleteError));
      setBusyText("");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && onClose()} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={[styles.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="account-remove-outline" size={40} color={RED[600]} />
            </View>
            <Text style={styles.title} accessibilityRole="header">
              {finishOnly ? "Finish deleting your account" : "Delete your account?"}
            </Text>

            {blockedReason ? (
              <>
                {/* Something must be finished first: say what, and offer only Close. */}
                <View style={styles.blockedBox}>
                  <MaterialCommunityIcons name="information-outline" size={24} color={NEUTRAL[900]} />
                  <Text style={styles.blockedText}>{blockedReason}</Text>
                </View>
                <AppButton label="Close" variant="secondary" onPress={onClose} style={styles.button} />
              </>
            ) : (
              <>
                {finishOnly ? (
                  <Text style={styles.intro}>Your account was marked as deleted, but the login was not removed yet. Confirm it is you to finish.</Text>
                ) : (
                  <View style={styles.facts}>
                    <Fact icon="close-circle-outline" text="Your login is removed. This can't be undone." />
                    <Fact icon="phone-off-outline" text="Your phone number and address are cleared." />
                    <Fact icon="history" text="Your past rides and duty records are kept for 1 year for safety reports, then removed." />
                  </View>
                )}

                {googleOnWeb ? (
                  <FeedbackMessage message={getDeleteErrorMessage({ code: "google-on-web" })} tone="warning" />
                ) : (
                  <>
                    {method === "password" ? (
                      <>
                        <Text style={styles.label}>Type your password to confirm</Text>
                        <TextInput
                          style={styles.input}
                          value={password}
                          onChangeText={setPassword}
                          placeholder="Password"
                          placeholderTextColor={NEUTRAL[600]}
                          secureTextEntry
                          autoCapitalize="none"
                          editable={!busy}
                          accessibilityLabel="Your password"
                        />
                      </>
                    ) : (
                      <Text style={styles.intro}>You will be asked to choose your Google account again, to confirm it is you.</Text>
                    )}

                    {/* A tick box, so the red button is never pressed by accident. Checked = filled box and the word stays. */}
                    <Pressable
                      style={styles.checkRow}
                      onPress={() => setUnderstood((value) => !value)}
                      disabled={busy}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: understood, disabled: busy }}
                    >
                      <MaterialCommunityIcons name={understood ? "checkbox-marked" : "checkbox-blank-outline"} size={28} color={understood ? RED[600] : NEUTRAL[500]} />
                      <Text style={styles.checkText}>I understand this can&apos;t be undone</Text>
                    </Pressable>

                    {error ? <FeedbackMessage message={error} tone="error" /> : null}

                    {/* The main action on top at full width, Keep underneath (DESIGN.md Layout). */}
                    <AppButton
                      label={busyText || (method === "google" ? "Confirm with Google and delete" : "Delete my account")}
                      variant="danger"
                      disabled={!canDelete}
                      onPress={deleteAccount}
                      style={styles.button}
                    />
                  </>
                )}
                <AppButton label="Keep my account" variant="secondary" disabled={busy} onPress={onClose} style={styles.buttonSecond} />
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// One line of "what happens": an icon and the words.
function Fact({ icon, text }) {
  return (
    <View style={styles.fact}>
      <MaterialCommunityIcons name={icon} size={24} color={NEUTRAL[700]} />
      <Text style={styles.factText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, backgroundColor: "rgba(20, 33, 28, 0.55)" },
  // A dialog (DESIGN.md Style): white, 16 corners, Level 3 shadow. flexShrink: it gets shorter (and scrolls) with the keyboard.
  card: { width: "100%", maxWidth: 480, flexShrink: 1, borderRadius: CORNER.card, backgroundColor: NEUTRAL[0], ...SHADOW.level3 },
  content: { padding: 24, alignItems: "stretch" },
  iconCircle: { alignSelf: "center", width: 72, height: 72, borderRadius: CORNER.pill, alignItems: "center", justifyContent: "center", backgroundColor: RED[50] },
  title: { marginTop: 12, fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: NEUTRAL[900], textAlign: "center" },
  intro: { marginTop: 12, fontSize: 17, lineHeight: 24, fontFamily: FONT.regular, color: NEUTRAL[700] },
  facts: { marginTop: 16, gap: 12 },
  fact: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  factText: { flex: 1, fontSize: 17, lineHeight: 24, fontFamily: FONT.regular, color: NEUTRAL[900] },
  blockedBox: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginTop: 16, padding: 16, borderRadius: CORNER.input, backgroundColor: ORANGE[100] },
  blockedText: { flex: 1, fontSize: 17, lineHeight: 24, fontFamily: FONT.semiBold, color: NEUTRAL[900] },
  label: { marginTop: 20, fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: NEUTRAL[900] },
  input: { minHeight: 56, marginTop: 8, paddingHorizontal: 14, borderWidth: 1.5, borderColor: NEUTRAL[500], borderRadius: CORNER.input, backgroundColor: NEUTRAL[0], fontSize: 17, fontFamily: FONT.regular, color: NEUTRAL[900] },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, marginTop: 12 },
  checkText: { flex: 1, fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: NEUTRAL[900] },
  button: { minHeight: 56, marginTop: 16 },
  buttonSecond: { minHeight: 56, marginTop: 12 },
});
