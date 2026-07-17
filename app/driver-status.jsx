import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import BrandLogo from "../components/BrandLogo";
import { auth, db } from "../firebase";
import { useCurrentUserProfile } from "../lib/session";

export default function DriverStatus() {
  const router = useRouter();
  const { authUser, displayName } = useCurrentUserProfile();
  const [driverProfile, setDriverProfile] = useState(null);
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

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const accountStatus = driverProfile?.accountStatus ?? "Pending";
  const isRejected = accountStatus === "Rejected";

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <BrandLogo variant="main" height={40} style={styles.logo} />

        {isLoading ? (
          <>
            <ActivityIndicator color="#06774B" />
            <Text style={styles.message}>Checking application status...</Text>
          </>
        ) : isRejected ? (
          <>
            <Text style={styles.title}>Application Rejected</Text>
            <Text style={styles.message}>Your application was not approved.</Text>
            <Text style={styles.message}>Please contact the administrator for more information.</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Application Under Review</Text>
            <Text style={styles.message}>Thank you for applying.</Text>
            <Text style={styles.message}>Your application is currently being reviewed by our Admin team.</Text>
            <Text style={styles.message}>You will gain access once your application has been approved.</Text>
            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>Driver Name</Text>
              <Text style={styles.statusValue}>{driverProfile?.fullName || displayName}</Text>
              <Text style={styles.statusLabel}>Application Status</Text>
              <Text style={styles.statusValue}>{accountStatus}</Text>
            </View>
          </>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7F6" },
  content: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  card: {
    width: "100%",
    maxWidth: 520,
    padding: 24,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE8E2",
    alignItems: "center",
  },
  logo: { marginBottom: 18 },
  title: { fontSize: 30, fontWeight: "900", color: "#17382E", textAlign: "center" },
  message: { marginTop: 10, fontSize: 16, lineHeight: 24, color: "#5C7269", textAlign: "center" },
  statusBox: { width: "100%", marginTop: 22, padding: 16, borderRadius: 14, backgroundColor: "#F0F6F3", gap: 6 },
  statusLabel: { marginTop: 6, fontSize: 12, fontWeight: "900", color: "#557166", textTransform: "uppercase" },
  statusValue: { fontSize: 17, fontWeight: "800", color: "#17382E" },
  logoutButton: {
    width: "100%",
    minHeight: 52,
    marginTop: 24,
    borderRadius: 14,
    backgroundColor: "#06774B",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonText: { fontSize: 16, fontWeight: "900", color: "#FFFFFF" },
});
