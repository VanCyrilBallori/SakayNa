import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";

import BrandLogo from "../components/BrandLogo";
import { auth, db } from "../firebase";
import { TOLEDO_BARANGAY_OPTIONS } from "../lib/barangays";
import { saveLocalUserProfile } from "../lib/session";

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
const cloudinaryCloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const cloudinaryUploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const minimumPasswordLength = 8;

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

const getFileExtension = (fileName = "") => {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
};

const sanitizeFileName = (fileName = "driver-document") => fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
const bodyTypeOptions = ["Sedan", "SUV", "MPV", "Pickup"];

const isValidDocument = (asset) => {
  const extension = getFileExtension(asset?.name);
  return allowedMimeTypes.includes(asset?.mimeType) || allowedExtensions.includes(extension);
};

const appendCloudinaryFile = async (formData, asset) => {
  if (Platform.OS === "web") {
    const fileResponse = await fetch(asset.uri);
    const fileBlob = await fileResponse.blob();
    formData.append("file", fileBlob, asset.name);
    return;
  }

  formData.append("file", {
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType || "application/octet-stream",
  });
};

const uploadDocumentToCloudinary = async (asset, applicationId) => {
  if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
    throw new Error("Cloudinary is not configured.");
  }

  const formData = new FormData();
  const safeFileName = sanitizeFileName(asset.name).replace(/\.[^/.]+$/, "");

  formData.append("upload_preset", cloudinaryUploadPreset);
  formData.append("folder", "driver-applications");
  formData.append("public_id", `${applicationId}-${Date.now()}-${safeFileName}`);
  await appendCloudinaryFile(formData, asset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });
  const uploadResult = await response.json();

  if (!response.ok || !uploadResult.secure_url) {
    throw new Error(uploadResult.error?.message || "Cloudinary upload failed.");
  }

  return uploadResult.secure_url;
};

const uploadMultipleDocumentsToCloudinary = async (assets, applicationId, folderSuffix) => {
  return Promise.all(
    assets.map((asset, index) => uploadDocumentToCloudinary({ ...asset, name: `${folderSuffix}-${index + 1}-${asset.name}` }, applicationId))
  );
};

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
  const requiresVehicleDetails = form.useOwnVehicle === "yes";

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const pickSingleDocument = async (onPick) => {
    setErrorMessage("");

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: allowedMimeTypes,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];

      if (!isValidDocument(asset)) {
        onPick(null);
        setErrorMessage("Please upload a valid image file.");
        return;
      }

      onPick(asset);
    } catch (error) {
      console.log("Document picker warning:", error);
      setErrorMessage("Document selection failed. Please try again.");
    }
  };

  const pickMultipleDocuments = async () => {
    setErrorMessage("");

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: allowedMimeTypes,
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled) {
        return;
      }

      const assets = result.assets ?? [];

      if (!assets.length || assets.some((asset) => !isValidDocument(asset))) {
        setVehiclePhotoAssets([]);
        setErrorMessage("Please upload valid vehicle photo files.");
        return;
      }

      setVehiclePhotoAssets(assets);
    } catch (error) {
      console.log("Vehicle photos picker warning:", error);
      setErrorMessage("Vehicle photo selection failed. Please try again.");
    }
  };

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

      if (!isValidDocument(orCrAsset)) {
        return "Please upload a valid OR/CR image.";
      }

      if (vehiclePhotoAssets.length < 3) {
        return "Please upload at least 3 vehicle photos: front, back, and interior.";
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

    try {
      setIsSubmitting(true);

      const applicationRef = doc(collection(db, "Driver_Applications"));
      const orCrDocumentUrl = requiresVehicleDetails ? await uploadDocumentToCloudinary(orCrAsset, `${applicationRef.id}-orcr`) : "";
      const vehiclePhotoUrls = requiresVehicleDetails ? await uploadMultipleDocumentsToCloudinary(vehiclePhotoAssets, applicationRef.id, "vehicle-photo") : [];
      const userCredential = await createUserWithEmailAndPassword(auth, form.email.trim().toLowerCase(), form.password);
      const driverUid = userCredential.user.uid;

      await setDoc(doc(db, "users", driverUid), {
        uid: driverUid,
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        barangay: form.barangay.trim(),
        role: "Driver",
        accountStatus: "Pending",
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
        status: "Pending",
        createdAt: serverTimestamp(),
      });

      saveLocalUserProfile({
        uid: driverUid,
        email: form.email.trim().toLowerCase(),
        fullName: form.fullName.trim(),
        barangay: form.barangay.trim(),
        phoneNumber: form.phone.trim(),
        role: "Driver",
        accountStatus: "Pending",
        useOwnVehicle: requiresVehicleDetails,
      });
      setForm(emptyForm);
      setOrCrAsset(null);
      setVehiclePhotoAssets([]);
      setSuccessMessage("Thank you for applying! Your account is pending admin approval.");
      router.replace("/driver-status");
    } catch (error) {
      console.log("Driver application failed:", error);
      setErrorMessage(error.message === "Cloudinary is not configured." ? "Cloudinary upload is not configured yet." : error.message || "Application submission failed. Please check your connection, Cloudinary settings, or Firebase permissions.");
    } finally {
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
              <TouchableOpacity style={styles.uploadBox} onPress={() => pickSingleDocument(setOrCrAsset)}>
                <Text style={styles.uploadTitle}>{orCrAsset?.name || "Upload OR/CR Photo"}</Text>
                <Text style={styles.uploadText}>Accepted: JPG, PNG, WEBP, HEIC</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.uploadBox, styles.uploadBoxSpaced]} onPress={pickMultipleDocuments}>
                <Text style={styles.uploadTitle}>
                  {vehiclePhotoAssets.length ? `${vehiclePhotoAssets.length} vehicle photo(s) selected` : "Upload Vehicle Photos"}
                </Text>
                <Text style={styles.uploadText}>Required: front, back, and interior photos.</Text>
              </TouchableOpacity>
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
            <Text style={styles.submitButtonText}>{isSubmitting ? "Submitting..." : "Submit Application"}</Text>
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
