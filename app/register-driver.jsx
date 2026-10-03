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
import { DESIGN_COLORS } from "../constants/design";
import { normalizePhilippinePhone } from "../features/resident/utils/requestValidation";
import { auth, db } from "../firebase";
import { TOLEDO_BARANGAY_PICKER_OPTIONS } from "../lib/barangays";
import { getPostAuthenticationRoute } from "../lib/roles";
import { getAuthErrorMessage, useCurrentUserProfile } from "../lib/session";
import { pickPhoto, uploadPhotos } from "../lib/uploadPhoto";

// New Driver application: one topic per page, built like register-resident.jsx.
// 1 Personal → 2 License → 3 Clearances → 4 Review & Submit → 5 Submitted.
// On Submit, the photos go to Cloudinary one at a time, then two Firestore documents are saved together:
// - users/{uid}: the profile (no photo links, no license number), with accountStatus "Pending".
// - Driver_Applications/{uid}: everything, including the photo links. Only the Driver and Admins
//   can read it (dispatchers can read users/, so the photo links never go there).
// Drivers have no vehicle info here: vehicles belong to the barangay.

// DESIGN.md colors, under the short names this page already uses.
const colors = {
  page: DESIGN_COLORS.paperWhite,
  heading: DESIGN_COLORS.ink,
  muted: DESIGN_COLORS.inkMuted,
  link: DESIGN_COLORS.hallGreen,
  card: DESIGN_COLORS.boardTint,
  line: DESIGN_COLORS.rule,
  outline: DESIGN_COLORS.controlOutline,
  ripple: "rgba(11, 122, 75, 0.12)",
};

const STEP_NAMES = ["Personal", "License", "Clearances", "Review"];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_OPTIONS = MONTHS.map((name, index) => ({ label: name, value: index + 1 }));

const CLEARANCE_TYPES = ["NBI Clearance", "Police Clearance"];

// Turns the Month / Day / Year boxes into a real date. Gives back null if the date does not exist
// (for example February 30) or is not filled in completely.
const makeDate = (month, day, year) => {
  if (!month || !/^\d{1,2}$/.test(day) || !/^\d{4}$/.test(year)) return null;

  const date = new Date(Number(year), month - 1, Number(day));
  if (date.getMonth() !== month - 1 || date.getDate() !== Number(day)) return null;
  return date;
};

// Today at midnight, so a license that expires today still counts as valid today.
const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// How old someone is today. One year less if their birthday has not come yet this year.
const getAge = (birthDate) => {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayNotYet =
    today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (birthdayNotYet) age -= 1;
  return age;
};

// Saved as "1985-01-15" so it sorts and reads the same everywhere.
const toSavedDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Shown on the Review page as "January 15, 1985".
const toShownDate = (date) => (date ? `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}` : "");

const getBirthDate = (form) => makeDate(form.birthMonth, form.birthDay, form.birthYear);
const getExpiryDate = (form) => makeDate(form.expiryMonth, form.expiryDay, form.expiryYear);

// What each page must have before Next works. Returns the message to show, or "" if the page is complete.
const checkPage = (step, form, photos, confirmed) => {
  if (step === 1) {
    const birthDate = getBirthDate(form);
    if (!photos.profile) return "Add a photo of your face.";
    if (form.fullName.trim().length < 2) return "Enter your full name.";
    if (!birthDate || birthDate.getFullYear() < 1900 || birthDate > new Date()) return "Enter your date of birth: month, day and year.";
    if (getAge(birthDate) < 18) return "You must be 18 or older to apply.";
    if (!normalizePhilippinePhone(form.phone)) return "Enter a mobile number like 0917 123 4567.";
    if (!form.barangay) return "Choose your barangay.";
    if (form.address.trim().length < 3) return "Enter your house number, street, or purok.";
  }

  if (step === 2) {
    const expiryDate = getExpiryDate(form);
    if (!photos.licenseFront) return "Add a photo of the front of your license.";
    if (!photos.licenseBack) return "Add a photo of the back of your license.";
    if (form.licenseNumber.trim().length < 5) return "Enter your license number.";
    if (!expiryDate) return "Enter your license expiration date: month, day and year.";
    if (expiryDate < startOfToday()) return "Your license is expired. Please renew it first, then apply.";
  }

  if (step === 3) {
    if (!form.clearanceType) return "Choose NBI Clearance or Police Clearance.";
    if (!photos.clearance) return `Add a photo of your ${form.clearanceType}.`;
    if (!photos.medical) return "Add a photo of your Medical Certificate.";
  }

  if (step === 4 && !confirmed) return "Please tick the box to confirm.";

  return "";
};

export default function RegisterDriver() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const { authUser, authStatus, profile, profileStatus } = useCurrentUserProfile();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    // Google gives us the person's name, so it is filled in already. They can still change it.
    fullName: auth.currentUser?.displayName ?? "",
    birthMonth: null,
    birthDay: "",
    birthYear: "",
    phone: "",
    barangay: "",
    address: "",
    licenseNumber: "",
    expiryMonth: null,
    expiryDay: "",
    expiryYear: "",
    clearanceType: "",
  });
  // One photo per document. null = not added yet. drugTest is optional.
  const [photos, setPhotos] = useState({
    profile: null,
    licenseFront: null,
    licenseBack: null,
    clearance: null,
    medical: null,
    drugTest: null,
  });
  const [confirmed, setConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // "Uploading 2 of 5..." then "Saving..." on the Submit button.
  const [progressLabel, setProgressLabel] = useState("");

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  // This screen is only for someone who is signed in and has no profile yet.
  // Not signed in → start page. Already has a profile → their home. (Not while saving, or on the Submitted page.)
  useEffect(() => {
    if (authStatus !== "ready" || isSubmitting || step === 5) return;

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

  // A Pending driver's "home" is the application status screen.
  const goToHome = () => router.replace("/driver-status");

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
      if (step >= 2 && step <= 4) {
        setErrorMessage("");
        setStep(step - 1);
        return true;
      }
      if (step === 5) {
        goToHome();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  });

  const goNext = () => {
    const problem = checkPage(step, form, photos, confirmed);
    setErrorMessage(problem);
    if (!problem) setStep(step + 1);
  };

  // "key" says which document the photo is for, like "licenseFront".
  const addPhoto = async (key) => {
    setErrorMessage("");
    try {
      const picked = await pickPhoto();
      if (picked) setPhotos((current) => ({ ...current, [key]: picked }));
    } catch (error) {
      console.log("Driver photo picker warning:", error);
      setErrorMessage("The photo could not be added. Please try again.");
    }
  };

  const removePhoto = (key) => setPhotos((current) => ({ ...current, [key]: null }));

  const handleSubmit = async () => {
    const problem = checkPage(4, form, photos, confirmed);
    setErrorMessage(problem);
    if (problem || isSubmitting) return;

    const uid = authUser.uid;
    setIsSubmitting(true);
    try {
      // The drug test photo is only sent if they added one.
      const photoList = [photos.profile, photos.licenseFront, photos.licenseBack, photos.clearance, photos.medical];
      if (photos.drugTest) photoList.push(photos.drugTest);

      const links = await uploadPhotos(photoList, { folder: "driver-applications", name: uid }, (current, total) =>
        setProgressLabel(`Uploading ${current} of ${total}...`)
      );
      const [profilePhotoUrl, licenseFrontUrl, licenseBackUrl, clearancePhotoUrl, medicalCertificateUrl, drugTestUrl = ""] = links;

      setProgressLabel("Saving...");
      const phoneNumber = normalizePhilippinePhone(form.phone);
      const details = {
        uid,
        fullName: form.fullName.trim(),
        email: (authUser.email ?? "").toLowerCase(),
        phone: phoneNumber,
        phoneNumber,
        barangay: form.barangay,
        address: form.address.trim(),
      };

      // Both documents are saved together: either both are saved, or neither is.
      // The application's id is the driver's uid, so each driver has one application.
      const batch = writeBatch(db);
      batch.set(doc(db, FIRESTORE_COLLECTIONS.DRIVER_APPLICATIONS, uid), {
        ...details,
        applicationId: uid,
        driverUid: uid,
        birthDate: toSavedDate(getBirthDate(form)),
        profilePhotoUrl,
        licenseNumber: form.licenseNumber.trim().toUpperCase(),
        licenseExpiry: toSavedDate(getExpiryDate(form)),
        licenseFrontUrl,
        licenseBackUrl,
        clearanceType: form.clearanceType,
        clearancePhotoUrl,
        medicalCertificateUrl,
        drugTestUrl,
        confirmed: true,
        status: ACCOUNT_STATUSES.PENDING,
        createdAt: serverTimestamp(),
        submittedAt: serverTimestamp(),
      });
      batch.set(doc(db, FIRESTORE_COLLECTIONS.USERS, uid), {
        ...details,
        role: ROLES.DRIVER,
        accountStatus: ACCOUNT_STATUSES.PENDING,
        createdAt: serverTimestamp(),
      });
      await batch.commit();

      setStep(5);
    } catch (error) {
      console.log("Driver application failed:", error);
      setErrorMessage(
        error.message === "Cloudinary is not configured."
          ? "Photo upload is not set up yet. Please contact SakayNa support."
          : getAuthErrorMessage(error, "We could not submit your application. Check your connection and try again.")
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

        {step === 5 ? (
          <SubmittedPage onGoHome={goToHome} />
        ) : (
          <>
            <StepBar step={step} />
            <Text style={[styles.stepCount, { color: colors.muted }]}>Step {step} of 4</Text>

            {step === 1 ? <PersonalPage form={form} updateField={updateField} photos={photos} onAddPhoto={addPhoto} /> : null}
            {step === 2 ? <LicensePage form={form} updateField={updateField} photos={photos} onAddPhoto={addPhoto} /> : null}
            {step === 3 ? (
              <ClearancesPage form={form} updateField={updateField} photos={photos} onAddPhoto={addPhoto} onRemovePhoto={removePhoto} />
            ) : null}
            {step === 4 ? (
              <ReviewPage form={form} email={authUser?.email ?? ""} photos={photos} confirmed={confirmed} onToggleConfirmed={() => setConfirmed(!confirmed)} />
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
                <Text style={[styles.buttonText, { color: DESIGN_COLORS.hallGreen }]}>Back</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.button, styles.nextButton, pressed && styles.filledPressed]}
                onPress={step === 4 ? handleSubmit : goNext}
                disabled={isSubmitting}
                android_ripple={{ color: "rgba(255, 255, 255, 0.24)" }}
                accessibilityRole="button"
                accessibilityState={{ busy: isSubmitting }}
              >
                <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>{step === 4 ? progressLabel || "Submit" : "Next"}</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ① ─ ② ─ ③ ─ ④ with names under each. Done steps show a check mark.
// Hidden from screen readers: "Step 1 of 4" below says the same thing.
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
              <View style={[styles.stepLine, { backgroundColor: index === 0 ? "transparent" : number <= step ? DESIGN_COLORS.hallGreen : colors.line }]} />
              <View style={[styles.stepCircle, done || current ? styles.stepCircleActive : { borderColor: colors.outline }]}>
                {done ? (
                  <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
                ) : (
                  <Text style={[styles.stepNumber, { color: current ? "#FFFFFF" : colors.muted }]}>{number}</Text>
                )}
              </View>
              <View style={[styles.stepLine, { backgroundColor: index === STEP_NAMES.length - 1 ? "transparent" : number < step ? DESIGN_COLORS.hallGreen : colors.line }]} />
            </View>
            <Text style={[styles.stepName, { color: current ? colors.heading : colors.muted }, current && styles.stepNameCurrent]} numberOfLines={1}>
              {name}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function PersonalPage({ form, updateField, photos, onAddPhoto }) {
  return (
    <>
      <Text style={[styles.title, { color: colors.heading }]} accessibilityRole="header">
        Personal Info
      </Text>

      <Field icon="account-box-outline" label="Profile Picture">
        <PhotoSlot photo={photos.profile} onPress={() => onAddPhoto("profile")} name="your face" />
      </Field>
      <Hint text="Use a clear photo of your face, like an ID photo." />

      <Field icon="account-outline" label="Full Name">
        <TextInput
          style={styles.input}
          value={form.fullName}
          onChangeText={(value) => updateField("fullName", value)}
          placeholder="Juan Dela Cruz"
          placeholderTextColor={DESIGN_COLORS.placeholder}
          autoCapitalize="words"
          accessibilityLabel="Full Name"
        />
      </Field>

      <Field icon="cake-variant-outline" label="Date of Birth">
        <DateInput form={form} updateField={updateField} prefix="birth" label="Date of birth" />
      </Field>
      <Hint text="You must be 18 or older." />

      <Field icon="phone-outline" label="Contact Number">
        <TextInput
          style={styles.input}
          value={form.phone}
          onChangeText={(value) => updateField("phone", value)}
          placeholder="09XX XXX XXXX"
          placeholderTextColor={DESIGN_COLORS.placeholder}
          keyboardType="phone-pad"
          maxLength={16}
          accessibilityLabel="Contact Number"
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
          placeholder="e.g. 123 Rizal St., Purok 2"
          placeholderTextColor={DESIGN_COLORS.placeholder}
          accessibilityLabel="House number, street, or purok"
        />
      </Field>
    </>
  );
}

function LicensePage({ form, updateField, photos, onAddPhoto }) {
  return (
    <>
      <Text style={[styles.title, { color: colors.heading }]} accessibilityRole="header">
        Professional Driver&apos;s License
      </Text>

      <Field icon="card-account-details-outline" label="Front of license">
        <PhotoSlot photo={photos.licenseFront} onPress={() => onAddPhoto("licenseFront")} name="the front of your license" />
      </Field>

      <Field icon="card-account-details-outline" label="Back of license">
        <PhotoSlot photo={photos.licenseBack} onPress={() => onAddPhoto("licenseBack")} name="the back of your license" />
      </Field>
      <Hint text="Make sure your name, photo, and license number are clear." />

      <Field icon="numeric" label="License Number">
        <TextInput
          style={styles.input}
          value={form.licenseNumber}
          onChangeText={(value) => updateField("licenseNumber", value)}
          placeholder="e.g. N01-12-345678"
          placeholderTextColor={DESIGN_COLORS.placeholder}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={20}
          accessibilityLabel="License Number"
        />
      </Field>

      <Field icon="calendar-outline" label="Expiration Date">
        <DateInput form={form} updateField={updateField} prefix="expiry" label="Expiration date" />
      </Field>
    </>
  );
}

function ClearancesPage({ form, updateField, photos, onAddPhoto, onRemovePhoto }) {
  return (
    <>
      <Text style={[styles.title, { color: colors.heading }]} accessibilityRole="header">
        Clearances
      </Text>

      <Field icon="shield-check-outline" label="NBI or Police Clearance">
        {/* Two big buttons: pick the one you have. */}
        <View style={styles.clearanceChoices} accessibilityRole="radiogroup">
          {CLEARANCE_TYPES.map((type) => {
            const selected = form.clearanceType === type;
            return (
              <Pressable
                key={type}
                style={[styles.clearanceChoice, selected ? styles.clearanceChoiceSelected : { borderColor: colors.outline }]}
                onPress={() => updateField("clearanceType", type)}
                android_ripple={{ color: colors.ripple }}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
              >
                <MaterialCommunityIcons name={selected ? "radiobox-marked" : "radiobox-blank"} size={24} color={selected ? "#FFFFFF" : colors.outline} />
                <Text style={[styles.clearanceChoiceText, { color: selected ? "#FFFFFF" : colors.heading }]}>{type}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.slotGap}>
          <PhotoSlot photo={photos.clearance} onPress={() => onAddPhoto("clearance")} name={`your ${form.clearanceType || "clearance"}`} />
        </View>
      </Field>

      <Field icon="medical-bag" label="Medical Certificate">
        <PhotoSlot photo={photos.medical} onPress={() => onAddPhoto("medical")} name="your Medical Certificate" />
      </Field>

      <Field icon="test-tube" label="Drug Test Clearance (Optional)">
        <Text style={[styles.fieldNote, { color: colors.muted }]}>Upload this if your barangay requires it.</Text>
        <PhotoSlot
          photo={photos.drugTest}
          onPress={() => onAddPhoto("drugTest")}
          onRemove={() => onRemovePhoto("drugTest")}
          name="your Drug Test Clearance"
        />
      </Field>
    </>
  );
}

function ReviewPage({ form, email, photos, confirmed, onToggleConfirmed }) {
  const personalRows = [
    ["Full Name", form.fullName.trim()],
    ["Date of Birth", toShownDate(getBirthDate(form))],
    ["Contact Number", form.phone.trim()],
    ["Email", email],
    ["Barangay", form.barangay],
    ["Address", `${form.address.trim()}, ${form.barangay}, Cebu`],
  ];
  const licenseRows = [
    ["License Number", form.licenseNumber.trim().toUpperCase()],
    ["Expires", toShownDate(getExpiryDate(form))],
  ];
  const clearanceRows = [
    ["Clearance", form.clearanceType],
    ["Medical Certificate", "Added"],
    ["Drug Test Clearance", photos.drugTest ? "Added" : "Not added"],
  ];
  const clearanceThumbs = [
    [photos.clearance, form.clearanceType],
    [photos.medical, "Medical"],
  ];
  if (photos.drugTest) clearanceThumbs.push([photos.drugTest, "Drug Test"]);

  return (
    <>
      <Text style={[styles.title, { color: colors.heading }]} accessibilityRole="header">
        Review & Submit
      </Text>

      <ReviewSection icon="account-outline" title="Personal Info" rows={personalRows} thumbs={[[photos.profile, "Your photo"]]} />
      <ReviewSection
        icon="card-account-details-outline"
        title="Driver's License"
        rows={licenseRows}
        thumbs={[
          [photos.licenseFront, "Front"],
          [photos.licenseBack, "Back"],
        ]}
      />
      <ReviewSection icon="shield-check-outline" title="Clearances" rows={clearanceRows} thumbs={clearanceThumbs} />

      <Pressable
        style={styles.confirmRow}
        onPress={onToggleConfirmed}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
      >
        <MaterialCommunityIcons name={confirmed ? "checkbox-marked" : "checkbox-blank-outline"} size={30} color={confirmed ? DESIGN_COLORS.hallGreen : colors.outline} />
        <Text style={[styles.confirmText, { color: colors.heading }]}>
          The information I gave is true, and I allow SakayNa admins to review these documents. My name, phone number and vehicle will be
          shown to the residents I&apos;m assigned to.
        </Text>
      </Pressable>
    </>
  );
}

// One light panel on the Review page: a heading, the details, and small photos.
function ReviewSection({ icon, title, rows, thumbs }) {
  return (
    <View style={[styles.summary, { backgroundColor: colors.card }]}>
      <View style={styles.summaryHeading}>
        <MaterialCommunityIcons name={icon} size={22} color={DESIGN_COLORS.hallGreen} />
        <Text style={[styles.summaryTitle, { color: colors.heading }]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.summaryRow} accessible accessibilityLabel={`${label}: ${value}`}>
          <Text style={[styles.summaryLabel, { color: colors.muted }]}>{label}</Text>
          <Text style={[styles.summaryValue, { color: colors.heading }]}>{value}</Text>
        </View>
      ))}
      <View style={styles.thumbRow}>
        {thumbs.map(([photo, caption]) => (
          <View key={caption} style={styles.thumb}>
            <Image
              source={{ uri: photo?.uri }}
              style={styles.thumbImage}
              resizeMode="contain"
              accessibilityLabel={`Photo: ${caption}`}
            />
            <Text style={[styles.thumbCaption, { color: colors.muted }]} numberOfLines={1}>
              {caption}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SubmittedPage({ onGoHome }) {
  return (
    <View style={styles.submitted}>
      <View style={[styles.submittedDisc, { backgroundColor: colors.card }]}>
        <MaterialCommunityIcons name="check" size={56} color={DESIGN_COLORS.hallGreen} />
      </View>
      <Text style={[styles.submittedTitle, { color: colors.heading }]} accessibilityRole="header">
        Submitted
      </Text>
      <Text style={[styles.submittedText, { color: colors.heading }]}>Your application is pending review by your barangay.</Text>
      <Text style={[styles.submittedText, { color: colors.muted }]}>You can check your status in the SakayNa app.</Text>

      <View style={styles.spacer} />

      <Pressable
        style={({ pressed }) => [styles.button, styles.nextButton, styles.homeButton, pressed && styles.filledPressed]}
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
        <MaterialCommunityIcons name={icon} size={22} color={DESIGN_COLORS.hallGreen} />
        <Text style={[styles.label, { color: colors.heading }]}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

// Helper text under a field. 16 and dark enough to read easily.
function Hint({ text }) {
  return (
    <View style={styles.hintRow}>
      <MaterialCommunityIcons name="information-outline" size={22} color={colors.muted} />
      <Text style={[styles.hintText, { color: colors.muted }]}>{text}</Text>
    </View>
  );
}

// Month (a list of month names), then Day and Year boxes side by side.
// "prefix" is "birth" or "expiry": it picks which fields in the form to fill in.
function DateInput({ form, updateField, prefix, label }) {
  const onlyNumbers = (value) => value.replace(/[^0-9]/g, "");

  return (
    <View style={styles.dateBlock}>
      <BottomSheetPicker
        style={styles.input}
        title={`${label}: month`}
        options={MONTH_OPTIONS}
        placeholder="Month"
        value={form[`${prefix}Month`]}
        onChange={(value) => updateField(`${prefix}Month`, value)}
        accessibilityLabel={`${label}, month`}
      />
      <View style={styles.dateRow}>
        <TextInput
          style={[styles.input, styles.dateDay]}
          value={form[`${prefix}Day`]}
          onChangeText={(value) => updateField(`${prefix}Day`, onlyNumbers(value))}
          placeholder="Day"
          placeholderTextColor={DESIGN_COLORS.placeholder}
          keyboardType="number-pad"
          maxLength={2}
          accessibilityLabel={`${label}, day`}
        />
        <TextInput
          style={[styles.input, styles.dateYear]}
          value={form[`${prefix}Year`]}
          onChangeText={(value) => updateField(`${prefix}Year`, onlyNumbers(value))}
          placeholder="Year"
          placeholderTextColor={DESIGN_COLORS.placeholder}
          keyboardType="number-pad"
          maxLength={4}
          accessibilityLabel={`${label}, year`}
        />
      </View>
    </View>
  );
}

// Empty: a dashed green box to add a photo. Filled: the whole photo, "Change photo",
// and "Remove" (only for an optional photo, when onRemove is given).
// "name" finishes the sentence "Photo of ..." for screen readers.
function PhotoSlot({ photo, onPress, onRemove, name }) {
  if (!photo) {
    return (
      <Pressable
        style={({ pressed }) => [styles.photoBox, pressed && styles.pressed]}
        onPress={onPress}
        android_ripple={{ color: colors.ripple }}
        accessibilityRole="button"
        accessibilityLabel={`Add a photo of ${name}. Take a photo or choose from gallery`}
      >
        <MaterialCommunityIcons name="camera-outline" size={36} color={DESIGN_COLORS.hallGreen} />
        <Text style={styles.photoBoxText}>Take a photo or choose from gallery</Text>
      </Pressable>
    );
  }

  const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 4 / 3;
  return (
    <View style={styles.photoPreviewBlock}>
      <Image
        source={{ uri: photo.uri }}
        style={[styles.photoPreview, { aspectRatio, backgroundColor: colors.card }]}
        resizeMode="contain"
        accessibilityLabel={`Photo of ${name}`}
      />
      <View style={styles.photoButtons}>
        <Pressable
          style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
          onPress={onPress}
          android_ripple={{ color: colors.ripple }}
          accessibilityRole="button"
          accessibilityLabel={`Change photo of ${name}`}
        >
          <MaterialCommunityIcons name="camera-outline" size={22} color={DESIGN_COLORS.hallGreen} />
          <Text style={styles.smallButtonText}>Change photo</Text>
        </Pressable>
        {onRemove ? (
          <Pressable
            style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
            onPress={onRemove}
            android_ripple={{ color: colors.ripple }}
            accessibilityRole="button"
            accessibilityLabel={`Remove photo of ${name}`}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={22} color={DESIGN_COLORS.hallGreen} />
            <Text style={styles.smallButtonText}>Remove</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
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
  stepCircleActive: { backgroundColor: DESIGN_COLORS.hallGreen, borderColor: DESIGN_COLORS.hallGreen },
  stepNumber: { fontSize: 16, fontWeight: "800" },
  stepName: { marginTop: 6, fontSize: 14, fontWeight: "600" },
  stepNameCurrent: { fontWeight: "800" },
  stepCount: { marginTop: 12, fontSize: 16, fontWeight: "600" },
  title: { marginTop: 4, marginBottom: 12, fontSize: 28, lineHeight: 36, fontWeight: "800" },
  field: { marginTop: 16 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  label: { flexShrink: 1, fontSize: 17, lineHeight: 22, fontWeight: "700" },
  fieldNote: { marginBottom: 10, fontSize: 16, lineHeight: 23 },
  input: {
    minHeight: 56,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    borderRadius: 16,
    fontSize: 17,
    color: DESIGN_COLORS.ink,
    backgroundColor: "#FFFFFF",
  },
  dateBlock: { gap: 10 },
  dateRow: { flexDirection: "row", gap: 10 },
  dateDay: { flex: 1 },
  dateYear: { flex: 1.4 },
  clearanceChoices: { flexDirection: "row", gap: 10 },
  clearanceChoice: {
    flex: 1,
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
  },
  clearanceChoiceSelected: { borderColor: DESIGN_COLORS.hallGreen, backgroundColor: DESIGN_COLORS.hallGreen },
  clearanceChoiceText: { flexShrink: 1, fontSize: 16, lineHeight: 21, fontWeight: "700" },
  slotGap: { marginTop: 12 },
  photoBox: {
    minHeight: 128,
    padding: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: DESIGN_COLORS.hallGreen,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: DESIGN_COLORS.boardTint,
  },
  photoBoxText: { fontSize: 17, lineHeight: 23, fontWeight: "700", textAlign: "center", color: DESIGN_COLORS.hallGreen },
  photoPreviewBlock: { gap: 10 },
  photoPreview: { width: "100%", maxHeight: 240, borderRadius: 16 },
  photoButtons: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  smallButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.hallGreen,
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  smallButtonText: { fontSize: 16, fontWeight: "700", color: DESIGN_COLORS.hallGreen },
  hintRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  hintText: { flex: 1, fontSize: 16, lineHeight: 23 },
  summary: { marginBottom: 12, borderRadius: 24, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  summaryHeading: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  summaryTitle: { flexShrink: 1, fontSize: 18, fontWeight: "800" },
  summaryRow: { paddingVertical: 6 },
  summaryLabel: { fontSize: 14, fontWeight: "600" },
  summaryValue: { marginTop: 2, fontSize: 17, lineHeight: 23 },
  thumbRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  thumb: { width: 96 },
  thumbImage: { width: 96, height: 72, borderRadius: 16, backgroundColor: "#FFFFFF" },
  thumbCaption: { marginTop: 4, fontSize: 14, fontWeight: "600" },
  confirmRow: { minHeight: 56, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  confirmText: { flex: 1, fontSize: 16, lineHeight: 23 },
  spacer: { flexGrow: 1, minHeight: 24 },
  errorText: { marginBottom: 12, fontSize: 16, lineHeight: 23, fontWeight: "600", color: DESIGN_COLORS.emergencyRed },
  buttonRow: { flexDirection: "row", gap: 12 },
  button: { flex: 1, minHeight: 56, paddingHorizontal: 12, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  backButton: { borderWidth: 1.5, borderColor: DESIGN_COLORS.hallGreen, backgroundColor: "#FFFFFF" },
  nextButton: { backgroundColor: DESIGN_COLORS.hallGreen },
  homeButton: { flex: 0, alignSelf: "stretch" },
  pressed: { opacity: 0.88 },
  filledPressed: { backgroundColor: DESIGN_COLORS.hallGreenDeep },
  buttonText: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  submitted: { flexGrow: 1, alignItems: "center", paddingTop: 24 },
  submittedDisc: { width: 104, height: 104, borderRadius: 52, alignItems: "center", justifyContent: "center" },
  submittedTitle: { marginTop: 20, fontSize: 28, lineHeight: 36, fontWeight: "800", textAlign: "center" },
  submittedText: { marginTop: 12, maxWidth: 420, fontSize: 17, lineHeight: 25, textAlign: "center" },
});
