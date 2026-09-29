import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";

import BrandLogo from "../components/BrandLogo";
import { ACCOUNT_STATUSES, FIRESTORE_COLLECTIONS, ROLES } from "../constants/app";
import { auth, db } from "../firebase";
import { TOLEDO_BARANGAY_OPTIONS } from "../lib/barangays";
import { getAuthErrorMessage, logoutCurrentUser, saveLocalUserProfile } from "../lib/session";
import { pickPhoto, uploadPhotos } from "../lib/uploadPhoto";

const minimumPasswordLength = 8;
const minimumVehiclePhotos = 3;

const emptyForm = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  phone: "",
  barangay: "",
  licenseNumber: "",
  useOwnVehicle: "yes",
  plateNumber: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleYear: "",
  bodyType: "Sedan",
  color: "",
  mvFileNumber: "",
};

const bodyTypeOptions = ["Sedan", "SUV", "MPV", "Pickup"];

export default function ApplyToDrive() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const [form, setForm] = useState(emptyForm);
  const [orCrAsset, setOrCrAsset] = useState(null);
  const [vehiclePhotoAssets, setVehiclePhotoAssets] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // "Uploading photo 2 of 4..." while photos are being sent; empty the rest of the time.
  const [uploadProgress, setUploadProgress] = useState("");
  const requiresVehicleDetails = form.useOwnVehicle === "yes";

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  // Take or choose ONE photo. It comes back already shrunk (see lib/uploadPhoto.js).
  const addPhoto = async (onAdded) => {
    setErrorMessage("");

    try {
      const photo = await pickPhoto();
      if (photo) {
        onAdded(photo);
      }
    } catch (error) {
      console.log("Photo picker warning:", error);
      setErrorMessage("The photo could not be added. Please try again.");
    }
  };

  const addOrCrPhoto = () => addPhoto(setOrCrAsset);
  const addVehiclePhoto = () => addPhoto((photo) => setVehiclePhotoAssets((current) => [...current, photo]));

  const validateForm = () => {
    if (
      !form.fullName.trim() ||
      !form.email.trim() ||
      !form.password ||
      !form.confirmPassword ||
      !form.phone.trim() ||
      !form.barangay.trim() ||
      !form.licenseNumber.trim()
    ) {
      return "Please complete the required driver application fields.";
    }

    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      return "Please enter a valid email address.";
    }

    if (form.password.length < minimumPasswordLength) {
      return `Password must be at least ${minimumPasswordLength} characters.`;
    }

    if (form.password !== form.confirmPassword) {
      return "Passwords do not match.";
    }

    if (requiresVehicleDetails && !/^\d{4}$/.test(form.vehicleYear.trim())) {
      return "Please enter a valid 4-digit vehicle year.";
    }

    if (requiresVehicleDetails) {
      if (
        !form.plateNumber.trim() ||
        !form.vehicleMake.trim() ||
        !form.vehicleModel.trim() ||
        !form.vehicleYear.trim() ||
        !form.color.trim() ||
        !form.mvFileNumber.trim()
      ) {
        return "Please complete all required vehicle details.";
      }

      if (!/^\d{15}$/.test(form.mvFileNumber.trim())) {
        return "MV File Number must be exactly 15 digits.";
      }

      if (!orCrAsset) {
        return "Please add a photo of your OR/CR.";
      }

      if (vehiclePhotoAssets.length < minimumVehiclePhotos) {
        return "Please add at least 3 vehicle photos: front, back, and interior.";
      }
    }

    return "";
  };

  const handleSubmit = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    const validationMessage = validateForm();
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    let createdUser = null;
    try {
      setIsSubmitting(true);

      const applicationRef = doc(collection(db, FIRESTORE_COLLECTIONS.DRIVER_APPLICATIONS));
      // OR/CR first, then the vehicle photos, sent one at a time. photoLinks keeps the same order.
      const photosToUpload = requiresVehicleDetails ? [orCrAsset, ...vehiclePhotoAssets] : [];
      const photoLinks = await uploadPhotos(photosToUpload, { folder: "driver-applications", name: applicationRef.id }, (current, total) =>
        setUploadProgress(`Uploading photo ${current} of ${total}...`)
      );
      setUploadProgress("");
      const orCrDocumentUrl = requiresVehicleDetails ? photoLinks[0] : "";
      const vehiclePhotoUrls = photoLinks.slice(1);
      const userCredential = await createUserWithEmailAndPassword(auth, form.email.trim().toLowerCase(), form.password);
      createdUser = userCredential.user;
      const driverUid = userCredential.user.uid;

      await setDoc(doc(db, FIRESTORE_COLLECTIONS.USERS, driverUid), {
        uid: driverUid,
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        barangay: form.barangay.trim(),
        role: ROLES.DRIVER,
        accountStatus: ACCOUNT_STATUSES.PENDING,
        useOwnVehicle: requiresVehicleDetails,
        createdAt: serverTimestamp(),
      });

      await setDoc(applicationRef, {
        applicationId: applicationRef.id,
        driverUid,
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        barangay: form.barangay.trim(),
        licenseNumber: form.licenseNumber.trim(),
        useOwnVehicle: requiresVehicleDetails,
        vehicleOwnershipPreference: requiresVehicleDetails ? "Driver-Owned Vehicle" : "City/Barangay Vehicle",
        plateNumber: requiresVehicleDetails ? form.plateNumber.trim().toUpperCase() : "",
        vehicleMake: requiresVehicleDetails ? form.vehicleMake.trim() : "",
        vehicleModel: requiresVehicleDetails ? form.vehicleModel.trim() : "",
        vehicleYear: requiresVehicleDetails ? form.vehicleYear.trim() : "",
        bodyType: requiresVehicleDetails ? form.bodyType : "",
        color: requiresVehicleDetails ? form.color.trim() : "",
        mvFileNumber: requiresVehicleDetails ? form.mvFileNumber.trim() : "",
        uploaded_document: orCrDocumentUrl,
        orCrDocumentUrl,
        vehiclePhotoUrls,
        status: ACCOUNT_STATUSES.PENDING,
        createdAt: serverTimestamp(),
      });

      saveLocalUserProfile({ uid: driverUid, email: form.email.trim().toLowerCase(), fullName: form.fullName.trim() });
      sendEmailVerification(userCredential.user).catch((verificationError) => {
        console.log("Email verification send failed:", verificationError);
      });
      setForm(emptyForm);
      setOrCrAsset(null);
      setVehiclePhotoAssets([]);
      router.replace("/verify-email");
    } catch (error) {
      console.log("Driver application failed:", error);
      if (createdUser?.uid === auth.currentUser?.uid) {
        try {
          await logoutCurrentUser();
        } catch (logoutError) {
          console.log("Driver application cleanup failed:", logoutError);
        }
      }
      setErrorMessage(error.message === "Cloudinary is not configured." ? "Cloudinary upload is not configured yet." : getAuthErrorMessage(error, "Application submission failed. Check your connection and try again."));
    } finally {
      setUploadProgress("");
      setIsSubmitting(false);
    }
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <BrandLogo variant="main" height={compact ? 38 : 44} />
          <TouchableOpacity style={styles.backButton} onPress={() => router.push("/")}>
            <Text style={styles.backButtonText}>Back Home</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.hero, compact && styles.heroCompact]}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Driver Recruitment</Text>
            <Text style={[styles.title, compact && styles.titleCompact]}>Apply to Drive</Text>
            <Text style={styles.subtitle}>Submit your driver and vehicle details for admin review.</Text>
          </View>
        </View>

        <View style={[styles.formCard, compact && styles.formCardCompact]}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.formGrid}>
            <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#7B8782" value={form.fullName} onChangeText={(value) => updateField("fullName", value)} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#7B8782"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={form.email}
              onChangeText={(value) => updateField("email", value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#7B8782"
              secureTextEntry
              value={form.password}
              onChangeText={(value) => updateField("password", value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#7B8782"
              secureTextEntry
              value={form.confirmPassword}
              onChangeText={(value) => updateField("confirmPassword", value)}
            />
            <TextInput style={styles.input} placeholder="Phone Number" placeholderTextColor="#7B8782" keyboardType="phone-pad" value={form.phone} onChangeText={(value) => updateField("phone", value)} />
            <Dropdown
              style={styles.dropdown}
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
              value={form.barangay}
              onChange={(item) => updateField("barangay", item.value)}
            />
          </View>

          <Text style={styles.sectionTitle}>Driver Information</Text>
          <View style={styles.formGrid}>
            <TextInput style={styles.input} placeholder="Driver's License Number" placeholderTextColor="#7B8782" value={form.licenseNumber} onChangeText={(value) => updateField("licenseNumber", value)} />
          </View>

          <Text style={styles.sectionTitle}>Vehicle Option</Text>
          <View style={styles.choiceRow}>
            <TouchableOpacity
              style={[styles.choiceCard, form.useOwnVehicle === "yes" && styles.choiceCardActive]}
              onPress={() => updateField("useOwnVehicle", "yes")}
            >
              <Text style={[styles.choiceTitle, form.useOwnVehicle === "yes" && styles.choiceTitleActive]}>I have my own vehicle</Text>
              <Text style={styles.choiceCopy}>Admins will review your car documents and use your approved vehicle for dispatching.</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.choiceCard, form.useOwnVehicle === "no" && styles.choiceCardActive]}
              onPress={() => updateField("useOwnVehicle", "no")}
            >
              <Text style={[styles.choiceTitle, form.useOwnVehicle === "no" && styles.choiceTitleActive]}>I need an assigned vehicle</Text>
              <Text style={styles.choiceCopy}>You may apply without a car so admins can assign a city or barangay vehicle later.</Text>
            </TouchableOpacity>
          </View>

          {requiresVehicleDetails ? (
            <>
              <Text style={styles.sectionTitle}>Vehicle Details</Text>
              <View style={styles.formGrid}>
                <TextInput style={styles.input} placeholder="Vehicle Make (e.g., Toyota)" placeholderTextColor="#7B8782" value={form.vehicleMake} onChangeText={(value) => updateField("vehicleMake", value)} />
                <TextInput style={styles.input} placeholder="Model (e.g., Vios)" placeholderTextColor="#7B8782" value={form.vehicleModel} onChangeText={(value) => updateField("vehicleModel", value)} />
                <TextInput
                  style={styles.input}
                  placeholder="Year Model"
                  placeholderTextColor="#7B8782"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={form.vehicleYear}
                  onChangeText={(value) => updateField("vehicleYear", value)}
                />
                <View style={styles.inlineOptions}>
                  {bodyTypeOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.inlineOption, form.bodyType === option && styles.inlineOptionActive]}
                      onPress={() => updateField("bodyType", option)}
                    >
                      <Text style={[styles.inlineOptionText, form.bodyType === option && styles.inlineOptionTextActive]}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={styles.input} placeholder="Color" placeholderTextColor="#7B8782" value={form.color} onChangeText={(value) => updateField("color", value)} />
                <TextInput style={styles.input} placeholder="Plate Number" placeholderTextColor="#7B8782" value={form.plateNumber} onChangeText={(value) => updateField("plateNumber", value)} autoCapitalize="characters" />
                <TextInput
                  style={styles.input}
                  placeholder="MV File Number (15 digits)"
                  placeholderTextColor="#7B8782"
                  keyboardType="number-pad"
                  maxLength={15}
                  value={form.mvFileNumber}
                  onChangeText={(value) => updateField("mvFileNumber", value.replace(/[^0-9]/g, ""))}
                />
              </View>

              <Text style={styles.sectionTitle}>Vehicle Documents</Text>
              <TouchableOpacity style={styles.uploadBox} onPress={addOrCrPhoto} accessibilityRole="button">
                <Text style={styles.uploadTitle}>{orCrAsset ? "OR/CR photo added" : "Add OR/CR Photo"}</Text>
                <Text style={styles.uploadText}>
                  {orCrAsset ? "Tap to replace it with a different photo." : "Take a photo, or choose one from your gallery."}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.uploadBox, styles.uploadBoxSpaced]} onPress={addVehiclePhoto} accessibilityRole="button">
                <Text style={styles.uploadTitle}>
                  {vehiclePhotoAssets.length < minimumVehiclePhotos
                    ? `${vehiclePhotoAssets.length} of ${minimumVehiclePhotos} vehicle photos added`
                    : `${vehiclePhotoAssets.length} vehicle photos added`}
                </Text>
                <Text style={styles.uploadText}>Tap to add one photo at a time: front, back, and interior.</Text>
              </TouchableOpacity>

              {vehiclePhotoAssets.length ? (
                <TouchableOpacity style={styles.clearPhotosButton} onPress={() => setVehiclePhotoAssets([])} accessibilityRole="button">
                  <Text style={styles.clearPhotosText}>Clear vehicle photos</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>No personal vehicle required</Text>
              <Text style={styles.noticeCopy}>Your application will stay valid without car documents, and admins can assign an approved city or barangay vehicle after approval.</Text>
            </View>
          )}

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

          <TouchableOpacity style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={isSubmitting}>
            <Text style={styles.submitButtonText}>{isSubmitting ? uploadProgress || "Submitting..." : "Submit Application"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7F6" },
  content: { flexGrow: 1, paddingBottom: 32 },
  topBar: {
    width: "100%",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#DDE8E2",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  backButton: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#EAF2EE" },
  backButtonText: { fontSize: 14, fontWeight: "800", color: "#0F6B4F" },
  hero: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 34,
    paddingBottom: 18,
  },
  heroCompact: { paddingTop: 24 },
  heroCopy: { maxWidth: 720 },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", color: "#557166" },
  title: { marginTop: 8, fontSize: 42, lineHeight: 48, fontWeight: "900", color: "#12372A" },
  titleCompact: { fontSize: 32, lineHeight: 38 },
  subtitle: { marginTop: 10, fontSize: 17, lineHeight: 25, color: "#52685F" },
  formCard: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    padding: 24,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE8E2",
  },
  formCardCompact: { marginHorizontal: 16, padding: 18, borderRadius: 20 },
  sectionTitle: { marginTop: 4, marginBottom: 12, fontSize: 20, fontWeight: "800", color: "#17382E" },
  formGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 18 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 18 },
  choiceCard: {
    flex: 1,
    minWidth: 250,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D3DED8",
    backgroundColor: "#FAFCFB",
  },
  choiceCardActive: { borderColor: "#06774B", backgroundColor: "#EDF7F2" },
  choiceTitle: { fontSize: 15, fontWeight: "800", color: "#17382E" },
  choiceTitleActive: { color: "#06774B" },
  choiceCopy: { marginTop: 6, fontSize: 13, lineHeight: 19, color: "#5C7269" },
  inlineOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8, flexBasis: "100%", marginBottom: 4 },
  inlineOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D3DED8",
    backgroundColor: "#FAFCFB",
  },
  inlineOptionActive: { borderColor: "#06774B", backgroundColor: "#EDF7F2" },
  inlineOptionText: { fontSize: 14, fontWeight: "700", color: "#456459" },
  inlineOptionTextActive: { color: "#06774B" },
  input: {
    flexGrow: 1,
    flexBasis: 250,
    minHeight: 54,
    borderWidth: 1,
    borderColor: "#D3DED8",
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#111111",
    backgroundColor: "#FAFCFB",
  },
  dropdown: {
    flexGrow: 1,
    flexBasis: 250,
    minHeight: 54,
    borderWidth: 1,
    borderColor: "#D3DED8",
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "#FAFCFB",
  },
  dropdownContainer: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D3DED8",
    overflow: "hidden",
  },
  dropdownPlaceholder: { color: "#7B8782", fontSize: 15 },
  dropdownSelectedText: { color: "#111111", fontSize: 15 },
  dropdownItemText: { color: "#17382E", fontSize: 15 },
  uploadBox: {
    minHeight: 92,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#7AA08F",
    borderRadius: 16,
    backgroundColor: "#F0F6F3",
    padding: 16,
    justifyContent: "center",
  },
  uploadTitle: { fontSize: 16, fontWeight: "800", color: "#17382E" },
  uploadText: { marginTop: 6, fontSize: 13, lineHeight: 19, color: "#5C7269" },
  uploadBoxSpaced: { marginTop: 12 },
  clearPhotosButton: { minHeight: 48, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 4 },
  clearPhotosText: { fontSize: 14, fontWeight: "700", color: "#0F6B4F", textDecorationLine: "underline" },
  noticeCard: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#F0F6F3",
    borderWidth: 1,
    borderColor: "#D6E5DE",
  },
  noticeTitle: { fontSize: 15, fontWeight: "800", color: "#17382E" },
  noticeCopy: { marginTop: 6, fontSize: 13, lineHeight: 19, color: "#5C7269" },
  errorText: { marginTop: 14, color: "#C62828", fontSize: 14, lineHeight: 20 },
  successText: { marginTop: 14, color: "#06774B", fontSize: 14, lineHeight: 20, fontWeight: "700" },
  submitButton: {
    marginTop: 18,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: "#06774B",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: { backgroundColor: "#78968A" },
  submitButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
});
