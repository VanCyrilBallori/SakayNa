import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BrandLogo from "../components/BrandLogo";
import { ACCOUNT_STATUSES, FIRESTORE_COLLECTIONS } from "../constants/app";
import { COLORS, LIGHT_COLORS } from "../constants/design";
import { db } from "../firebase";
import { formatDateTime, getDateFromValue } from "../lib/dates";
import { getAccountStatusLabel } from "../lib/roles";
import { getAuthErrorMessage, logoutCurrentUser, useCurrentUserProfile } from "../lib/session";

// Where a new Driver waits until an Admin of their barangay approves or rejects their application.
// It watches two documents live:
// - users/{uid}: the status. Approved → straight to driver home.
// - Driver_Applications/{uid}: the date it was sent, and the reason if it was rejected.
// Always light, like the driver application form.

const colors = LIGHT_COLORS;

export default function DriverStatus() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authUser } = useCurrentUserProfile();
  const [driverProfile, setDriverProfile] = useState(null);
  const [application, setApplication] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authUser?.uid) {
      router.replace("/login");
      return undefined;
    }

    const unsubscribe = onSnapshot(
      doc(db, "users", authUser.uid),
      (snapshot) => {
        const data = snapshot.data();

        if (data?.role !== "Driver") {
          router.replace("/login");
          return;
        }

        if (data.accountStatus === "Approved") {
          router.replace("/driver-home");
          return;
        }

        setDriverProfile(data);
        setIsLoading(false);
      },
      (error) => {
        console.log("Driver status listener warning:", error);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [authUser?.uid, router]);

  // The driver's own application. Old test drivers saved theirs under a different id, so it
  // cannot be found: the screen then shows "Submitted" without a date, and no reason.
  useEffect(() => {
    if (!authUser?.uid) return undefined;

    return onSnapshot(
      doc(db, FIRESTORE_COLLECTIONS.DRIVER_APPLICATIONS, authUser.uid),
      (snapshot) => setApplication(snapshot.data() ?? null),
      (error) => {
        console.log("Driver application listener warning:", error);
        setApplication(null);
      }
    );
  }, [authUser?.uid]);

  const handleLogout = async () => {
    try {
      // Go to Log In first, then sign out. Signing out first makes AuthRouteGate take the screens
      // away, and then the move to Log In has nothing to run in ("REPLACE ... not handled").
      router.replace("/login");
      await logoutCurrentUser();
    } catch (error) {
      Alert.alert("Logout failed", getAuthErrorMessage(error, "We could not log you out. Please try again."));
    }
  };

  const isRejected = driverProfile?.accountStatus === ACCOUNT_STATUSES.REJECTED;
  const submittedValue = application?.submittedAt ?? application?.createdAt;
  const submittedText = getDateFromValue(submittedValue) ? formatDateTime(submittedValue) : "";

  // The three points of the timeline. state: "done", "current", "upcoming" or "rejected".
  const points = isRejected
    ? [
        { title: "Submitted", detail: submittedText, state: "done" },
        { title: "Reviewed by your barangay", detail: "", state: "done" },
        { title: getAccountStatusLabel(driverProfile), detail: application?.rejectionReason || "No reason was given.", state: "rejected" },
      ]
    : [
        { title: "Submitted", detail: submittedText, state: "done" },
        {
          title: getAccountStatusLabel(driverProfile),
          detail: "Your application is being reviewed by your barangay.",
          state: "current",
        },
        { title: "Approved or Rejected", detail: "", state: "upcoming" },
      ];

  return (
    <View style={[styles.page, { backgroundColor: colors.page }]}>
      {/* Dark clock/battery icons so they stay visible on the white page. */}
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <BrandLogo variant="main" height={40} style={styles.logo} accessibilityLabel="SakayNa" />

        <Text style={[styles.title, { color: colors.heading }]} accessibilityRole="header">
          Application Status
        </Text>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[styles.loadingText, { color: colors.muted }]}>Checking application status...</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {points.map((point, index) => (
              <TimelinePoint
                key={point.title}
                point={point}
                isLast={index === points.length - 1}
                nextIsReached={index < points.length - 1 && points[index + 1].state !== "upcoming"}
              />
            ))}
          </View>
        )}

        {/* Pushes Logout to the bottom when the page is short. */}
        <View style={styles.spacer} />

        <Pressable
          style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
          onPress={handleLogout}
          android_ripple={{ color: colors.ripple }}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="logout" size={22} color={COLORS.primary} />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// One point: a circle on the left (with a line down to the next point), and the words on the right.
// The line is green once the next point is reached. A screen reader reads each point as one sentence.
function TimelinePoint({ point, isLast, nextIsReached }) {
  const { title, detail, state } = point;
  const isRejected = state === "rejected";
  const stateWords = { done: "done", current: "current step", upcoming: "not yet", rejected: "" }[state];
  const spokenParts = [title, stateWords, detail, isRejected ? "If you have questions, please contact your barangay office." : ""];

  return (
    <View style={styles.point} accessible accessibilityLabel={spokenParts.filter(Boolean).join(". ")}>
      <View style={styles.markerColumn}>
        <PointCircle state={state} />
        {isLast ? null : <View style={[styles.connector, { backgroundColor: nextIsReached ? COLORS.primary : colors.line }]} />}
      </View>

      <View style={[styles.pointText, !isLast && styles.pointTextSpaced, isRejected && styles.rejectedPanel]}>
        <Text style={[styles.pointTitle, { color: isRejected ? COLORS.emergency : state === "upcoming" ? colors.muted : colors.heading }]}>
          {title}
        </Text>
        {detail ? <Text style={[styles.pointDetail, { color: isRejected ? colors.heading : colors.muted }]}>{detail}</Text> : null}
        {isRejected ? (
          <Text style={[styles.pointDetail, styles.contactText, { color: colors.heading }]}>
            If you have questions, please contact your barangay office.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// done = green check, current = green ring with a dot, upcoming = empty grey circle, rejected = red ✗.
function PointCircle({ state }) {
  if (state === "done") {
    return (
      <View style={[styles.circle, styles.circleFilled]}>
        <MaterialCommunityIcons name="check" size={24} color="#FFFFFF" />
      </View>
    );
  }
  if (state === "rejected") {
    return (
      <View style={[styles.circle, styles.circleRejected]}>
        <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
      </View>
    );
  }
  if (state === "current") {
    return (
      <View style={[styles.circle, styles.circleCurrent]}>
        <View style={styles.currentDot} />
      </View>
    );
  }
  return <View style={[styles.circle, { borderColor: colors.outline }]} />;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flexGrow: 1, width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 20 },
  logo: { alignSelf: "center", marginBottom: 20 },
  title: { marginTop: 4, marginBottom: 24, fontSize: 28, lineHeight: 36, fontWeight: "800" },
  loading: { alignItems: "center", gap: 12, paddingVertical: 32 },
  loadingText: { fontSize: 16, lineHeight: 23 },
  timeline: { width: "100%" },
  point: { flexDirection: "row", gap: 16 },
  markerColumn: { width: 40, alignItems: "center" },
  connector: { flex: 1, width: 3, minHeight: 24, marginVertical: 4, borderRadius: 2 },
  circle: { width: 40, height: 40, borderRadius: 20, borderWidth: 2.5, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  circleFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  circleRejected: { borderColor: COLORS.emergency, backgroundColor: COLORS.emergency },
  circleCurrent: { borderWidth: 3, borderColor: COLORS.primary },
  currentDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.primary },
  pointText: { flex: 1, paddingTop: 7 },
  pointTextSpaced: { paddingBottom: 28 },
  pointTitle: { fontSize: 19, lineHeight: 26, fontWeight: "800" },
  pointDetail: { marginTop: 4, fontSize: 17, lineHeight: 25 },
  rejectedPanel: { padding: 16, paddingTop: 8, borderRadius: 14, backgroundColor: COLORS.emergencySurface },
  contactText: { marginTop: 12 },
  spacer: { flexGrow: 1, minHeight: 32 },
  logoutButton: {
    minHeight: 56,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 14,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
  },
  pressed: { opacity: 0.88 },
  logoutButtonText: { fontSize: 17, fontWeight: "800", color: COLORS.primary },
});
