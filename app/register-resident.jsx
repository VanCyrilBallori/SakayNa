import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { BackHandler, Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomSheetPicker from "../components/BottomSheetPicker";
import BrandLogo from "../components/BrandLogo";
import ScreenState from "../components/ui/ScreenState";
import { ACCOUNT_STATUSES, FIRESTORE_COLLECTIONS, ROLES } from "../constants/app";
import { COLORS, LIGHT_COLORS } from "../constants/design";
import { normalizePhilippinePhone } from "../features/resident/utils/requestValidation";
import { auth, db } from "../firebase";
import { TOLEDO_BARANGAY_PICKER_OPTIONS } from "../lib/barangays";
import { getPostAuthenticationRoute } from "../lib/roles";
import { getAuthErrorMessage, useCurrentUserProfile } from "../lib/session";
import { pickPhoto, uploadPhoto } from "../lib/uploadPhoto";

// New Resident registration: one topic per page.
// 1 Your Details → 2 Proof of Residency → 3 Review & Submit → 4 Submitted.
// On Submit, the photo goes to Cloudinary, then two Firestore documents are saved together:
// - users/{uid}: the profile, with accountStatus "Pending" until an Admin verifies it.
// - residentVerifications/{uid}: the same details plus the photo link. Only the Resident and
//   Admins can read it (dispatchers can read users/, so the photo link never goes there).

const colors = LIGHT_COLORS;

const STEP_NAMES = ["Details", "Proof", "Review"];

const DOCUMENT_TYPES = [
  "Barangay Certificate of Residency",
  "Barangay ID",
  "Certificate of Indigency",
  "Other government document with your address",
];

// What each page must have before Next works. Returns the message to show, or "" if the page is complete.
const checkPage = (step, form, photo, confirmed) => {
  if (step === 1) {
    if (form.fullName.trim().length < 2) return "Enter your full name.";
    if (!normalizePhilippinePhone(form.phone)) return "Enter a mobile number like 0917 123 4567.";
    if (!form.barangay) return "Choose your barangay.";
    if (form.address.trim().length < 3) return "Enter your house number, street, or purok.";
  }

  if (step === 2) {
    if (!form.documentType) return "Choose what document your photo shows.";
    if (!photo) return "Add a photo of your document.";
  }

  if (step === 3 && !confirmed) return "Please tick the box to confirm your details.";

  return "";
};

export default function RegisterResident() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const { authUser, authStatus, profile, profileStatus } = useCurrentUserProfile();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    // Google gives us the person's name, so it is filled in already. They can still change it.
    fullName: auth.currentUser?.displayName ?? "",
    phone: "",
    barangay: "",
    address: "",
    documentType: "",
  });
  const [photo, setPhoto] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // "Uploading photo..." then "Saving..." on the Submit button.
  const [progressLabel, setProgressLabel] = useState("");

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  // This screen is only for someone who is signed in and has no profile yet.
  // Not signed in → start page. Already has a profile → their home. (Not while saving, or on the Submitted page.)
  useEffect(() => {
    if (authStatus !== "ready" || isSubmitting || step === 4) return;

    if (!authUser) {
      router.replace("/");
    } else if (profileStatus === "ready") {
      router.replace(getPostAuthenticationRoute(profile) ?? "/");
    }
  }, [authStatus, authUser, isSubmitting, profile, profileStatus, router, step]);

  // Each new page starts at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const goToHome = () => router.replace("/resident-home");

  const goBack = () => {
    setErrorMessage("");
    if (step > 1) {
      setStep(step - 1);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/choose-role");
    }
  };

  // The phone's Back button goes one page back instead of leaving the form.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isSubmitting) return true;
      if (step === 2 || step === 3) {
        setErrorMessage("");
        setStep(step - 1);
        return true;
      }
      if (step === 4) {
        goToHome();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  });

  const goNext = () => {
    const problem = checkPage(step, form, photo, confirmed);
    setErrorMessage(problem);
    if (!problem) setStep(step + 1);
  };

  const addPhoto = async () => {
    setErrorMessage("");
    try {
      const picked = await pickPhoto();
      if (picked) setPhoto(picked);
    } catch (error) {
      console.log("Proof photo picker warning:", error);
      setErrorMessage("The photo could not be added. Please try again.");
    }
  };

  const handleSubmit = async () => {
    const problem = checkPage(3, form, photo, confirmed);
    setErrorMessage(problem);
    if (problem || isSubmitting) return;

    const uid = authUser.uid;
    setIsSubmitting(true);
    try {
      setProgressLabel("Uploading photo...");
      const documentPhotoUrl = await uploadPhoto(photo, { folder: "resident-verifications", name: uid });

      setProgressLabel("Saving...");
      const details = {
        uid,
        fullName: form.fullName.trim(),
        email: (authUser.email ?? "").toLowerCase(),
        phoneNumber: normalizePhilippinePhone(form.phone),
        barangay: form.barangay,
        address: form.address.trim(),
      };

      // Both documents are saved together: either both are saved, or neither is.
      const batch = writeBatch(db);
      batch.set(doc(db, FIRESTORE_COLLECTIONS.RESIDENT_VERIFICATIONS, uid), {
        ...details,
        documentType: form.documentType,
        documentPhotoUrl,
        confirmed: true,
        status: ACCOUNT_STATUSES.PENDING,
        submittedAt: serverTimestamp(),
      });
      batch.set(doc(db, FIRESTORE_COLLECTIONS.USERS, uid), {
        ...details,
        phone: details.phoneNumber,
        role: ROLES.RESIDENT,
        accountStatus: ACCOUNT_STATUSES.PENDING,
        createdAt: serverTimestamp(),
      });
      await batch.commit();

      setStep(4);
    } catch (error) {
      console.log("Resident registration failed:", error);
      setErrorMessage(
        error.message === "Cloudinary is not configured."
          ? "Photo upload is not set up yet. Please contact SakayNa support."
          : getAuthErrorMessage(error, "We could not submit your details. Check your connection and try again.")
      );
    } finally {
      setProgressLabel("");
      setIsSubmitting(false);
    }
  };

  if (authStatus !== "ready" || profileStatus === "idle" || profileStatus === "loading") {
    return <ScreenState loading message="Loading..." />;
  }

  return (
    // "padding" on Android too: the app is edge-to-edge, so Android no longer shrinks the screen for the keyboard.
    // This adds the space instead, and the page scrolls so the box being typed in stays visible.
    <KeyboardAvoidingView behavior="padding" style={[styles.page, { backgroundColor: colors.page }]}>
      {/* Dark clock/battery icons so they stay visible on the white page. */}
      <StatusBar style="dark" />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BrandLogo variant="main" height={40} style={styles.logo} accessibilityLabel="SakayNa" />

        {step === 4 ? (
          <SubmittedPage onGoHome={goToHome} />
        ) : (
          <>
            <StepBar step={step} />
            <Text style={[styles.stepCount, { color: colors.muted }]}>Step {step} of 3</Text>

            {step === 1 ? <DetailsPage form={form} updateField={updateField} /> : null}
            {step === 2 ? <ProofPage form={form} updateField={updateField} photo={photo} onAddPhoto={addPhoto} /> : null}
            {step === 3 ? (
              <ReviewPage form={form} email={authUser?.email ?? ""} photo={photo} confirmed={confirmed} onToggleConfirmed={() => setConfirmed(!confirmed)} />
            ) : null}

            {/* Pushes the buttons to the bottom when the page is short. */}
            <View style={styles.spacer} />

            {errorMessage ? (
              <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="polite">
                {errorMessage}
              </Text>
            ) : null}

            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [styles.button, styles.backButton, pressed && styles.pressed]}
                onPress={goBack}
                disabled={isSubmitting}
                android_ripple={{ color: colors.ripple }}
                accessibilityRole="button"
              >
                <Text style={[styles.buttonText, { color: COLORS.primary }]}>Back</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.button, styles.nextButton, pressed && styles.pressed]}
                onPress={step === 3 ? handleSubmit : goNext}
                disabled={isSubmitting}
                android_ripple={{ color: "rgba(255, 255, 255, 0.24)" }}
                accessibilityRole="button"
                accessibilityState={{ busy: isSubmitting }}
              >
                <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>{step === 3 ? progressLabel || "Submit" : "Next"}</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ① ─ ② ─ ③ with names under each. Done steps show a check mark.
// Hidden from screen readers: "Step 1 of 3" below says the same thing.
function StepBar({ step }) {
  return (
    <View style={styles.stepBar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {STEP_NAMES.map((name, index) => {
        const number = index + 1;
        const done = number < step;
        const current = number === step;
        return (
          <View key={name} style={styles.stepItem}>
            <View style={styles.stepCircleRow}>
              {/* The line on each side of the circle. The first and last hide their outer line. */}
              <View style={[styles.stepLine, { backgroundColor: index === 0 ? "transparent" : number <= step ? COLORS.primary : colors.line }]} />
              <View style={[styles.stepCircle, done || current ? styles.stepCircleActive : { borderColor: colors.outline }]}>
                {done ? (
                  <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
                ) : (
                  <Text style={[styles.stepNumber, { color: current ? "#FFFFFF" : colors.muted }]}>{number}</Text>
                )}
              </View>
              <View style={[styles.stepLine, { backgroundColor: index === STEP_NAMES.length - 1 ? "transparent" : number < step ? COLORS.primary : colors.line }]} />
            </View>
            <Text style={[styles.stepName, { color: current ? colors.heading : colors.muted }, current && styles.stepNameCurrent]}>{name}</Text>
          </View>
        );
      })}
    </View>
  );
}

function DetailsPage({ form, updateField }) {
  return (
    <>
      <Text style={[styles.title, { color: colors.heading }]} accessibilityRole="header">
        Your Details
      </Text>

      <Field icon="account-outline" label="Full Name">
        <TextInput
          style={styles.input}
          value={form.fullName}
          onChangeText={(value) => updateField("fullName", value)}
          placeholder="Juan Dela Cruz"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
          accessibilityLabel="Full Name"
        />
      </Field>

      <Field icon="phone-outline" label="Phone Number">
        <TextInput
          style={styles.input}
          value={form.phone}
          onChangeText={(value) => updateField("phone", value)}
          placeholder="09XX XXX XXXX"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          maxLength={16}
          accessibilityLabel="Phone Number"
        />
      </Field>

      <Field icon="home-outline" label="Barangay">
        <BottomSheetPicker
          style={styles.input}
          title="Choose your barangay"
          searchable
          searchPlaceholder="Search barangay"
          options={TOLEDO_BARANGAY_PICKER_OPTIONS}
          placeholder="Select your barangay"
          value={form.barangay}
          onChange={(value) => updateField("barangay", value)}
          accessibilityLabel="Barangay"
        />
      </Field>

      <Field icon="map-marker-outline" label="House No. / Street / Purok">
        <TextInput
          style={styles.input}
          value={form.address}
          onChangeText={(value) => updateField("address", value)}
          placeholder="e.g. 123 Mabini St., Purok 3"
          placeholderTextColor={colors.muted}
          accessibilityLabel="House number, street, or purok"
        />
      </Field>
    </>
  );
}

function ProofPage({ form, updateField, photo, onAddPhoto }) {
  return (
    <>
      <Text style={[styles.title, { color: colors.heading }]} accessibilityRole="header">
        Proof of Residency
      </Text>

      <Field icon="file-document-outline" label="What document is it?">
        {/* All four choices are shown at once (no dropdown), so nobody has to find them. */}
        <View style={styles.choiceList} accessibilityRole="radiogroup">
          {DOCUMENT_TYPES.map((type) => {
            const selected = form.documentType === type;
            return (
              <Pressable
                key={type}
                style={[styles.choice, selected ? styles.choiceSelected : { borderColor: colors.outline }]}
                onPress={() => updateField("documentType", type)}
                android_ripple={{ color: colors.ripple }}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
              >
                <MaterialCommunityIcons name={selected ? "radiobox-marked" : "radiobox-blank"} size={26} color={selected ? COLORS.primary : colors.outline} />
                <Text style={[styles.choiceText, { color: colors.heading }]}>{type}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      {photo ? (
        <View style={styles.photoPreviewBlock}>
          <PhotoPreview photo={photo} />
          <Pressable
            style={({ pressed }) => [styles.changePhotoButton, pressed && styles.pressed]}
            onPress={onAddPhoto}
            android_ripple={{ color: colors.ripple }}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="camera-outline" size={22} color={COLORS.primary} />
            <Text style={styles.changePhotoText}>Change photo</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.photoBox, pressed && styles.pressed]}
          onPress={onAddPhoto}
          android_ripple={{ color: colors.ripple }}
          accessibilityRole="button"
          accessibilityLabel="Take a photo or choose from gallery"
        >
          <MaterialCommunityIcons name="camera-outline" size={36} color={COLORS.primary} />
          <Text style={styles.photoBoxText}>Take a photo or choose from gallery</Text>
        </Pressable>
      )}

      <View style={styles.hintRow}>
        <MaterialCommunityIcons name="information-outline" size={22} color={colors.muted} />
        <Text style={[styles.hintText, { color: colors.muted }]}>Make sure your name and address are clear in the photo.</Text>
      </View>
    </>
  );
}

function ReviewPage({ form, email, photo, confirmed, onToggleConfirmed }) {
  const rows = [
    ["account-outline", "Full Name", form.fullName.trim()],
    ["phone-outline", "Phone Number", form.phone.trim()],
    ["email-outline", "Email", email],
    ["home-outline", "Barangay", form.barangay],
    ["map-marker-outline", "Address", `${form.address.trim()}, ${form.barangay}, Cebu`],
    ["file-document-outline", "Document", form.documentType],
  ];

  return (
    <>
      <Text style={[styles.title, { color: colors.heading }]} accessibilityRole="header">
        Review & Submit
      </Text>

      <View style={[styles.summary, { backgroundColor: colors.card }]}>
        {rows.map(([icon, label, value]) => (
          <View key={label} style={styles.summaryRow} accessible accessibilityLabel={`${label}: ${value}`}>
            <MaterialCommunityIcons name={icon} size={22} color={COLORS.primary} style={styles.summaryIcon} />
            <View style={styles.summaryText}>
              <Text style={[styles.summaryLabel, { color: colors.muted }]}>{label}</Text>
              <Text style={[styles.summaryValue, { color: colors.heading }]}>{value}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={[styles.label, styles.previewLabel, { color: colors.heading }]}>Document photo</Text>
      <PhotoPreview photo={photo} />

      <Pressable
        style={styles.confirmRow}
        onPress={onToggleConfirmed}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
      >
        <MaterialCommunityIcons name={confirmed ? "checkbox-marked" : "checkbox-blank-outline"} size={30} color={confirmed ? COLORS.primary : colors.outline} />
        <Text style={[styles.confirmText, { color: colors.heading }]}>I confirm the information is true and correct.</Text>
      </Pressable>
    </>
  );
}

function SubmittedPage({ onGoHome }) {
  return (
    <View style={styles.submitted}>
      <View style={[styles.submittedDisc, { backgroundColor: colors.ripple }]}>
        <MaterialCommunityIcons name="check" size={56} color={COLORS.primary} />
      </View>
      <Text style={[styles.submittedTitle, { color: colors.heading }]} accessibilityRole="header">
        Submitted
      </Text>
      <Text style={[styles.submittedText, { color: colors.heading }]}>Your account is pending verification.</Text>
      <Text style={[styles.submittedText, { color: colors.muted }]}>
        An admin from your barangay will review your document. You can check your status in the SakayNa app.
      </Text>

      <View style={styles.spacer} />

      <Pressable
        style={({ pressed }) => [styles.button, styles.nextButton, styles.homeButton, pressed && styles.pressed]}
        onPress={onGoHome}
        android_ripple={{ color: "rgba(255, 255, 255, 0.24)" }}
        accessibilityRole="button"
      >
        <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>Go to Home</Text>
      </Pressable>
    </View>
  );
}

// A label with an icon, and the input under it.
function Field({ icon, label, children }) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <MaterialCommunityIcons name={icon} size={22} color={COLORS.primary} />
        <Text style={[styles.label, { color: colors.heading }]}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

// Shows the whole photo (not cut off), up to 240 tall.
function PhotoPreview({ photo }) {
  const aspectRatio = photo?.width && photo?.height ? photo.width / photo.height : 4 / 3;
  return (
    <Image
      source={{ uri: photo?.uri }}
      style={[styles.photoPreview, { aspectRatio, backgroundColor: colors.card }]}
      resizeMode="contain"
      accessibilityLabel="Photo of your document"
    />
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flexGrow: 1, width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 20 },
  logo: { alignSelf: "center", marginBottom: 20 },
  stepBar: { flexDirection: "row", marginBottom: 8 },
  stepItem: { flex: 1, alignItems: "center" },
  stepCircleRow: { flexDirection: "row", alignItems: "center", width: "100%" },
  stepLine: { flex: 1, height: 2 },
  stepCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  stepCircleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepNumber: { fontSize: 16, fontWeight: "800" },
  stepName: { marginTop: 6, fontSize: 14, fontWeight: "600" },
  stepNameCurrent: { fontWeight: "800" },
  stepCount: { marginTop: 12, fontSize: 16, fontWeight: "600" },
  title: { marginTop: 4, marginBottom: 12, fontSize: 28, lineHeight: 36, fontWeight: "800" },
  field: { marginTop: 16 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  label: { flexShrink: 1, fontSize: 16, fontWeight: "700" },
  input: {
    minHeight: 56,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: LIGHT_COLORS.outline,
    borderRadius: 12,
    fontSize: 17,
    color: LIGHT_COLORS.heading,
    backgroundColor: "#FFFFFF",
  },
  choiceList: { gap: 10 },
  choice: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  choiceSelected: { borderWidth: 2, borderColor: COLORS.primary, backgroundColor: LIGHT_COLORS.card },
  choiceText: { flex: 1, fontSize: 17, lineHeight: 23 },
  photoBox: {
    minHeight: 128,
    marginTop: 20,
    padding: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: COLORS.primary,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: LIGHT_COLORS.card,
  },
  photoBoxText: { fontSize: 17, lineHeight: 23, fontWeight: "700", textAlign: "center", color: COLORS.primary },
  photoPreviewBlock: { marginTop: 20, gap: 10 },
  photoPreview: { width: "100%", maxHeight: 240, borderRadius: 12 },
  changePhotoButton: {
    minHeight: 48,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 12,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  changePhotoText: { fontSize: 16, fontWeight: "700", color: COLORS.primary },
  hintRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  hintText: { flex: 1, fontSize: 16, lineHeight: 23 },
  summary: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 },
  summaryRow: { flexDirection: "row", gap: 12, paddingVertical: 10 },
  summaryIcon: { marginTop: 2 },
  summaryText: { flex: 1 },
  summaryLabel: { fontSize: 14, fontWeight: "600" },
  summaryValue: { marginTop: 2, fontSize: 17, lineHeight: 23 },
  previewLabel: { marginTop: 20, marginBottom: 8 },
  confirmRow: { minHeight: 56, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  confirmText: { flex: 1, fontSize: 16, lineHeight: 23 },
  spacer: { flexGrow: 1, minHeight: 24 },
  errorText: { marginBottom: 12, fontSize: 16, lineHeight: 23, fontWeight: "600", color: COLORS.emergency },
  buttonRow: { flexDirection: "row", gap: 12 },
  button: { flex: 1, minHeight: 56, paddingHorizontal: 12, borderRadius: 14, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  backButton: { borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: "#FFFFFF" },
  nextButton: { backgroundColor: COLORS.primary },
  homeButton: { flex: 0, alignSelf: "stretch" },
  pressed: { opacity: 0.88 },
  buttonText: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  submitted: { flexGrow: 1, alignItems: "center", paddingTop: 24 },
  submittedDisc: { width: 104, height: 104, borderRadius: 52, alignItems: "center", justifyContent: "center" },
  submittedTitle: { marginTop: 20, fontSize: 28, lineHeight: 36, fontWeight: "800", textAlign: "center" },
  submittedText: { marginTop: 12, maxWidth: 420, fontSize: 17, lineHeight: 25, textAlign: "center" },
});
