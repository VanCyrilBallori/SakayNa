import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, LIGHT_COLORS } from "../../../constants/design";
import { TOLEDO_BARANGAY_OPTIONS } from "../../../lib/barangays";
import useCurrentLocation from "../hooks/useCurrentLocation";
import { createResidentRequest } from "../services/residentRequestService";
import { ASSISTANCE_OPTIONS, MAX_PASSENGERS, PURPOSE_OPTIONS } from "../utils/requestOptions";
import { sanitizeRequestForm, validateResidentRequest } from "../utils/requestValidation";
import MapLocationModal from "./MapLocationModal";

// Resident transport request: one scrolling page → Review → Sent. It fills the whole screen.
// Pending and Rejected residents never get here: the resident home stops them before it opens this.
// Always light, like the resident registration form.

const colors = LIGHT_COLORS;

const newForm = (barangay) => ({
  purpose: "",
  purposeOther: "",
  ridingFor: "self", // "self" or "other"
  passengerName: "",
  passengerPhone: "",
  passengerCount: 1,
  barangay: barangay || "",
  pickup: { latitude: null, longitude: null, address: "", source: "manual" },
  pickupDetails: "",
  destination: "",
  assistance: [],
  assistanceOther: "",
  additionalNotes: "",
});

const peopleText = (count) => `${count} ${count === 1 ? "person" : "people"}`;

export default function ResidentRequestForm({ visible, onClose, uid, residentName, profile, onCreated }) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const profileBarangay = profile?.barangay || "";
  const residentPhone = profile?.phoneNumber || profile?.phone || "";
  const [form, setForm] = useState(() => newForm(profileBarangay));
  const [errors, setErrors] = useState({});
  const [page, setPage] = useState("fill"); // "fill" → "review" → "sent"
  const [saving, setSaving] = useState(false);
  const [sendError, setSendError] = useState("");
  const [reference, setReference] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const { locating, detectLocation } = useCurrentLocation();

  // A fresh, empty form every time it opens.
  useEffect(() => {
    if (visible) {
      setForm(newForm(profileBarangay));
      setErrors({});
      setPage("fill");
      setSendError("");
      setReference("");
      setLocationMessage("");
    }
  }, [visible, profileBarangay]);

  // Changing a field also removes its red error message.
  const setValue = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const toggleAssistance = (option) => {
    const next = form.assistance.includes(option) ? form.assistance.filter((item) => item !== option) : [...form.assistance, option];
    setValue("assistance", next);
    if (option === "Other") setErrors((current) => ({ ...current, assistanceOther: "" }));
  };

  const changeCount = (step) => {
    setValue("passengerCount", Math.min(MAX_PASSENGERS, Math.max(1, form.passengerCount + step)));
  };

  const addCurrentLocation = async () => {
    setLocationMessage("");
    const result = await detectLocation();
    if (result.location) {
      // Only the exact spot is used. The barangay stays as chosen, because the phone's
      // barangay names often don't match our list (old issue #20).
      const { latitude, longitude, address, source } = result.location;
      setValue("pickup", { latitude, longitude, address, source });
      setLocationMessage(result.warning || "");
    } else {
      setLocationMessage(result.error);
    }
  };

  const scrollToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: false });

  const openReview = () => {
    const clean = sanitizeRequestForm(form);
    const nextErrors = validateResidentRequest(clean, residentPhone);
    setForm(clean);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setPage("review");
    scrollToTop();
  };

  const submit = async () => {
    if (saving || !uid) return;
    setSaving(true);
    setSendError("");
    try {
      const created = await createResidentRequest({ uid, residentName, residentPhone, form });
      setReference(created.reference);
      setPage("sent");
      scrollToTop();
      onCreated?.(created);
    } catch {
      setSendError("Your request could not be sent. Check your internet and try again.");
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (!saving) onClose();
  };

  // Android Back button: from Review, go back to the form. Otherwise close.
  const handleBack = () => {
    if (saving) return;
    if (page === "review") {
      setPage("fill");
      return;
    }
    onClose();
  };

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={handleBack} statusBarTranslucent navigationBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.page}>
          {/* Dark clock/battery icons so they stay visible on the white page. */}
          <StatusBar style="dark" />
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {page === "sent" ? (
              <SentPage reference={reference} onDone={close} />
            ) : (
              <>
                <View style={styles.titleRow}>
                  <Text style={styles.title} accessibilityRole="header">
                    {page === "review" ? "Review your request" : "Request a Ride"}
                  </Text>
                  <Pressable style={styles.closeButton} onPress={close} android_ripple={{ color: colors.ripple, borderless: true }} accessibilityRole="button" accessibilityLabel="Close request form">
                    <MaterialCommunityIcons name="close" size={28} color={colors.heading} />
                  </Pressable>
                </View>

                {page === "review" ? (
                  <ReviewPage form={form} residentName={residentName} residentPhone={residentPhone} />
                ) : (
                  <FillPage
                    form={form}
                    errors={errors}
                    residentName={residentName}
                    residentPhone={residentPhone}
                    setValue={setValue}
                    toggleAssistance={toggleAssistance}
                    changeCount={changeCount}
                    locating={locating}
                    locationMessage={locationMessage}
                    onUseGps={addCurrentLocation}
                    onOpenMap={() => setMapOpen(true)}
                  />
                )}

                {/* Pushes the buttons to the bottom when the page is short. */}
                <View style={styles.spacer} />

                {page === "fill" && errorCount ? (
                  <Text style={styles.errorSummary} accessibilityRole="alert" accessibilityLiveRegion="polite">
                    Please fix the {errorCount === 1 ? "item" : `${errorCount} items`} marked in red above.
                  </Text>
                ) : null}
                {page === "review" && sendError ? (
                  <Text style={styles.errorSummary} accessibilityRole="alert" accessibilityLiveRegion="polite">
                    {sendError}
                  </Text>
                ) : null}

                <View style={styles.buttonRow}>
                  <Pressable
                    style={({ pressed }) => [styles.button, styles.outlineButton, pressed && styles.pressed]}
                    onPress={page === "review" ? () => setPage("fill") : close}
                    disabled={saving}
                    android_ripple={{ color: colors.ripple }}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.buttonText, { color: COLORS.primary }]}>{page === "review" ? "Back" : "Cancel"}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.button, styles.filledButton, pressed && styles.pressed]}
                    onPress={page === "review" ? submit : openReview}
                    disabled={saving}
                    android_ripple={{ color: "rgba(255, 255, 255, 0.24)" }}
                    accessibilityRole="button"
                    accessibilityState={{ busy: saving }}
                  >
                    <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>{page === "review" ? (saving ? "Sending..." : "Send request") : "Review"}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <MapLocationModal
        visible={mapOpen}
        initialLocation={form.pickup.latitude !== null ? form.pickup : null}
        onClose={() => setMapOpen(false)}
        onConfirm={(location) => {
          const { latitude, longitude, address, source } = location;
          setValue("pickup", { latitude, longitude, address, source });
          setLocationMessage("");
          setMapOpen(false);
        }}
      />
    </>
  );
}

function FillPage({ form, errors, residentName, residentPhone, setValue, toggleAssistance, changeCount, locating, locationMessage, onUseGps, onOpenMap }) {
  const hasExactSpot = form.pickup.latitude !== null;

  return (
    <>
      <View style={styles.emergencyNote}>
        <MaterialCommunityIcons name="alert-outline" size={26} color={COLORS.emergency} />
        <Text style={styles.emergencyNoteText}>Emergency? Close this and tap the red Emergency button.</Text>
      </View>

      <Field icon="clipboard-text-outline" label="What is the ride for?" error={errors.purpose}>
        <View style={styles.choiceList} accessibilityRole="radiogroup">
          {PURPOSE_OPTIONS.map((option) => (
            <ChoiceRow key={option} type="radio" label={option} selected={form.purpose === option} onPress={() => setValue("purpose", option)} />
          ))}
        </View>
        {form.purpose === "Other" ? (
          <>
            <TextInput
              style={[styles.input, styles.inputBelow, errors.purposeOther && styles.inputError]}
              value={form.purposeOther}
              onChangeText={(value) => setValue("purposeOther", value)}
              placeholder="Tell us briefly, e.g. buying medicine"
              placeholderTextColor={colors.muted}
              maxLength={100}
              accessibilityLabel="What the ride is for"
            />
            <ErrorText message={errors.purposeOther} />
          </>
        ) : null}
      </Field>

      <Field icon="account-outline" label="Who is riding?" error={errors.ridingFor}>
        <View style={styles.choiceList} accessibilityRole="radiogroup">
          <ChoiceRow type="radio" label="Me" detail={[residentName, residentPhone].filter(Boolean).join(" · ")} selected={form.ridingFor === "self"} onPress={() => setValue("ridingFor", "self")} />
          <ChoiceRow type="radio" label="Someone else" selected={form.ridingFor === "other"} onPress={() => setValue("ridingFor", "other")} />
        </View>
      </Field>

      {form.ridingFor === "other" ? (
        <>
          <Field icon="account-edit-outline" label="Passenger's name" error={errors.passengerName}>
            <TextInput
              style={[styles.input, errors.passengerName && styles.inputError]}
              value={form.passengerName}
              onChangeText={(value) => setValue("passengerName", value)}
              placeholder="Juan Dela Cruz"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
              maxLength={80}
              accessibilityLabel="Passenger's name"
            />
          </Field>
          <Field icon="phone-outline" label="Passenger's phone (optional)" error={errors.passengerPhone}>
            <TextInput
              style={[styles.input, errors.passengerPhone && styles.inputError]}
              value={form.passengerPhone}
              onChangeText={(value) => setValue("passengerPhone", value)}
              placeholder="09XX XXX XXXX"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              maxLength={16}
              accessibilityLabel="Passenger's phone, optional"
            />
            <Hint icon="information-outline" text="If they have no phone, the driver will call you." />
          </Field>
        </>
      ) : null}

      <Field icon="account-multiple-outline" label="How many people are riding?" error={errors.passengerCount}>
        <View style={styles.stepper}>
          <StepperButton icon="minus" label="Fewer people" disabled={form.passengerCount <= 1} onPress={() => changeCount(-1)} />
          <Text style={styles.stepperValue} accessibilityLiveRegion="polite" accessibilityLabel={peopleText(form.passengerCount)}>
            {form.passengerCount}
          </Text>
          <StepperButton icon="plus" label="More people" disabled={form.passengerCount >= MAX_PASSENGERS} onPress={() => changeCount(1)} />
        </View>
        <Hint text={`Count everyone, including the passenger. Up to ${MAX_PASSENGERS}.`} />
      </Field>

      <Field icon="home-outline" label="Pickup barangay" error={errors.barangay}>
        <Dropdown
          style={[styles.input, errors.barangay && styles.inputError]}
          containerStyle={styles.dropdownList}
          placeholderStyle={[styles.dropdownText, { color: colors.muted }]}
          selectedTextStyle={[styles.dropdownText, { color: colors.heading }]}
          itemTextStyle={[styles.dropdownText, { color: colors.heading }]}
          inputSearchStyle={styles.dropdownText}
          maxHeight={320}
          search
          searchPlaceholder="Search barangay..."
          data={TOLEDO_BARANGAY_OPTIONS}
          labelField="label"
          valueField="value"
          placeholder="Select the barangay"
          value={form.barangay}
          onChange={(item) => setValue("barangay", item.value)}
          accessibilityLabel="Pickup barangay"
        />
      </Field>

      <Field icon="crosshairs-gps" label="Exact pickup spot (optional)">
        <View style={styles.choiceList}>
          <ActionButton icon="crosshairs-gps" label={locating ? "Finding your location..." : "Use Current Location"} disabled={locating} onPress={onUseGps} />
          <ActionButton icon="map-marker-plus-outline" label="Place Map Pin" disabled={locating} onPress={onOpenMap} />
        </View>
        {hasExactSpot ? (
          <Hint icon="check-circle" iconColor={COLORS.primary} text={`Location added: ${form.pickup.address}`} strong />
        ) : (
          <Hint icon="information-outline" text="Helps the driver find the exact spot." />
        )}
        {locationMessage ? <Hint icon="alert-circle-outline" iconColor={COLORS.warning} text={locationMessage} /> : null}
      </Field>

      <Field icon="map-marker-outline" label="Landmark / pickup details" error={errors.pickupDetails}>
        <TextInput
          style={[styles.input, styles.multiline, errors.pickupDetails && styles.inputError]}
          value={form.pickupDetails}
          onChangeText={(value) => setValue("pickupDetails", value)}
          placeholder="e.g. blue gate beside the chapel"
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
          maxLength={300}
          accessibilityLabel="Landmark or pickup details"
        />
      </Field>

      <Field icon="flag-outline" label="Where are you going?" error={errors.destination}>
        <TextInput
          style={[styles.input, errors.destination && styles.inputError]}
          value={form.destination}
          onChangeText={(value) => setValue("destination", value)}
          placeholder="e.g. Toledo City Hospital"
          placeholderTextColor={colors.muted}
          maxLength={180}
          accessibilityLabel="Where are you going"
        />
      </Field>

      <Field icon="wheelchair-accessibility" label="Does anyone need help? (optional)">
        <Hint text="Tick all that apply." />
        <View style={[styles.choiceList, styles.choiceListBelow]}>
          {ASSISTANCE_OPTIONS.map((option) => (
            <ChoiceRow key={option} type="checkbox" label={option} selected={form.assistance.includes(option)} onPress={() => toggleAssistance(option)} />
          ))}
        </View>
        {form.assistance.includes("Other") ? (
          <>
            <TextInput
              style={[styles.input, styles.inputBelow, errors.assistanceOther && styles.inputError]}
              value={form.assistanceOther}
              onChangeText={(value) => setValue("assistanceOther", value)}
              placeholder="What help is needed?"
              placeholderTextColor={colors.muted}
              maxLength={100}
              accessibilityLabel="Other help needed"
            />
            <ErrorText message={errors.assistanceOther} />
          </>
        ) : null}
      </Field>

      <Field icon="note-text-outline" label="Notes for the driver (optional)" error={errors.additionalNotes}>
        <TextInput
          style={[styles.input, styles.multiline, errors.additionalNotes && styles.inputError]}
          value={form.additionalNotes}
          onChangeText={(value) => setValue("additionalNotes", value)}
          placeholder="Anything else the driver should know"
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
          maxLength={500}
          accessibilityLabel="Notes for the driver, optional"
        />
      </Field>
    </>
  );
}

function ReviewPage({ form, residentName, residentPhone }) {
  const riderIsMe = form.ridingFor === "self";
  const assistance = form.assistance.map((item) => (item === "Other" ? `Other: ${form.assistanceOther}` : item)).join(", ");
  const rows = [
    ["clipboard-text-outline", "Ride for", form.purpose === "Other" ? `Other: ${form.purposeOther}` : form.purpose],
    ["account-outline", "Who is riding", riderIsMe ? `Me (${residentName})` : form.passengerName],
    ["phone-outline", "Contact number", riderIsMe || !form.passengerPhone ? `${residentPhone}${riderIsMe ? "" : " (yours)"}` : form.passengerPhone],
    ["account-multiple-outline", "People riding", peopleText(form.passengerCount)],
    ["home-outline", "Pickup barangay", form.barangay],
    ["crosshairs-gps", "Exact pickup spot", form.pickup.latitude !== null ? form.pickup.address : "Not added"],
    ["map-marker-outline", "Landmark / pickup details", form.pickupDetails],
    ["flag-outline", "Going to", form.destination],
    ["wheelchair-accessibility", "Help needed", assistance || "None"],
  ];
  if (form.additionalNotes) rows.push(["note-text-outline", "Notes for the driver", form.additionalNotes]);

  return (
    <>
      <Text style={styles.reviewIntro}>Check your details. Tap Back to change something.</Text>
      <View style={styles.summary}>
        {rows.map(([icon, label, value]) => (
          <View key={label} style={styles.summaryRow} accessible accessibilityLabel={`${label}: ${value}`}>
            <MaterialCommunityIcons name={icon} size={22} color={COLORS.primary} style={styles.summaryIcon} />
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text style={styles.summaryValue}>{value}</Text>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

function SentPage({ reference, onDone }) {
  return (
    <View style={styles.sent}>
      <View style={styles.sentDisc}>
        <MaterialCommunityIcons name="check" size={56} color={COLORS.primary} />
      </View>
      <Text style={styles.sentTitle} accessibilityRole="header">
        Request sent
      </Text>
      <Text style={styles.sentText}>Your reference is {reference}</Text>
      <Text style={[styles.sentText, { color: colors.muted }]}>
        A dispatcher will look at your request and send a vehicle. You can follow it in Request History.
      </Text>

      <View style={styles.spacer} />

      <Pressable
        style={({ pressed }) => [styles.button, styles.filledButton, styles.doneButton, pressed && styles.pressed]}
        onPress={onDone}
        android_ripple={{ color: "rgba(255, 255, 255, 0.24)" }}
        accessibilityRole="button"
      >
        <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>Done</Text>
      </Pressable>
    </View>
  );
}

// A label with an icon, the input(s) under it, and a red message if something is wrong.
function Field({ icon, label, error, children }) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <MaterialCommunityIcons name={icon} size={22} color={COLORS.primary} />
        <Text style={styles.label}>{label}</Text>
      </View>
      {children}
      <ErrorText message={error} />
    </View>
  );
}

function ErrorText({ message }) {
  if (!message) return null;
  return <Text style={styles.errorText}>{message}</Text>;
}

function Hint({ icon, iconColor, text, strong }) {
  return (
    <View style={styles.hintRow}>
      {icon ? <MaterialCommunityIcons name={icon} size={22} color={iconColor || colors.muted} /> : null}
      <Text style={[styles.hintText, strong && styles.hintStrong]}>{text}</Text>
    </View>
  );
}

// A big row you tap to choose: a round radio (pick one) or a square checkbox (pick any).
function ChoiceRow({ type, label, detail, selected, onPress }) {
  const icon = type === "radio" ? (selected ? "radiobox-marked" : "radiobox-blank") : selected ? "checkbox-marked" : "checkbox-blank-outline";
  return (
    <Pressable
      style={[styles.choice, selected ? styles.choiceSelected : null]}
      onPress={onPress}
      android_ripple={{ color: colors.ripple }}
      accessibilityRole={type}
      accessibilityState={{ checked: selected }}
    >
      <MaterialCommunityIcons name={icon} size={26} color={selected ? COLORS.primary : colors.outline} />
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceText}>{label}</Text>
        {detail ? <Text style={styles.choiceDetail}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

function StepperButton({ icon, label, disabled, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.stepperButton, disabled && styles.stepperButtonDisabled, pressed && styles.pressed]}
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: colors.ripple, borderless: true }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <MaterialCommunityIcons name={icon} size={30} color={disabled ? COLORS.disabled : COLORS.primary} />
    </Pressable>
  );
}

function ActionButton({ icon, label, disabled, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: colors.ripple }}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: disabled }}
    >
      <MaterialCommunityIcons name={icon} size={24} color={COLORS.primary} />
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { flexGrow: 1, width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 20 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, fontSize: 28, lineHeight: 36, fontWeight: "800", color: colors.heading },
  closeButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24 },
  emergencyNote: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.emergencySurface,
  },
  emergencyNoteText: { flex: 1, fontSize: 16, lineHeight: 23, fontWeight: "700", color: colors.heading },
  field: { marginTop: 24 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  label: { flexShrink: 1, fontSize: 16, fontWeight: "700", color: colors.heading },
  input: {
    minHeight: 56,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: colors.outline,
    borderRadius: 12,
    fontSize: 17,
    color: colors.heading,
    backgroundColor: "#FFFFFF",
  },
  inputBelow: { marginTop: 10 },
  inputError: { borderColor: COLORS.emergency, borderWidth: 2 },
  multiline: { minHeight: 96, paddingTop: 14, paddingBottom: 14 },
  dropdownText: { fontSize: 17 },
  dropdownList: { borderRadius: 12, borderWidth: 1.5, borderColor: colors.outline, overflow: "hidden" },
  choiceList: { gap: 10 },
  choiceListBelow: { marginTop: 10 },
  choice: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.outline,
    borderRadius: 12,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  choiceSelected: { borderWidth: 2, borderColor: COLORS.primary, backgroundColor: colors.card },
  choiceCopy: { flex: 1 },
  choiceText: { fontSize: 17, lineHeight: 23, color: colors.heading },
  choiceDetail: { marginTop: 2, fontSize: 15, lineHeight: 21, color: colors.muted },
  stepper: { flexDirection: "row", alignItems: "center", gap: 16 },
  stepperButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  stepperButtonDisabled: { borderColor: COLORS.disabled },
  stepperValue: { minWidth: 56, fontSize: 34, lineHeight: 42, fontWeight: "800", textAlign: "center", color: colors.heading, fontVariant: ["tabular-nums"] },
  actionButton: {
    minHeight: 56,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 12,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  actionButtonText: { flex: 1, fontSize: 17, fontWeight: "700", color: COLORS.primary },
  hintRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  hintText: { flex: 1, fontSize: 16, lineHeight: 23, color: colors.muted },
  hintStrong: { fontWeight: "700", color: colors.heading },
  errorText: { marginTop: 8, fontSize: 16, lineHeight: 23, fontWeight: "600", color: COLORS.emergency },
  errorSummary: { marginBottom: 12, fontSize: 16, lineHeight: 23, fontWeight: "600", color: COLORS.emergency },
  reviewIntro: { marginTop: 8, marginBottom: 16, fontSize: 16, lineHeight: 23, color: colors.muted },
  summary: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: colors.card },
  summaryRow: { flexDirection: "row", gap: 12, paddingVertical: 10 },
  summaryIcon: { marginTop: 2 },
  summaryText: { flex: 1 },
  summaryLabel: { fontSize: 14, fontWeight: "600", color: colors.muted },
  summaryValue: { marginTop: 2, fontSize: 17, lineHeight: 23, color: colors.heading },
  spacer: { flexGrow: 1, minHeight: 32 },
  buttonRow: { flexDirection: "row", gap: 12 },
  button: { flex: 1, minHeight: 56, paddingHorizontal: 12, borderRadius: 14, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  outlineButton: { borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: "#FFFFFF" },
  filledButton: { backgroundColor: COLORS.primary },
  doneButton: { flex: 0, alignSelf: "stretch" },
  pressed: { opacity: 0.88 },
  buttonText: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  sent: { flexGrow: 1, alignItems: "center", paddingTop: 48 },
  sentDisc: { width: 104, height: 104, borderRadius: 52, alignItems: "center", justifyContent: "center", backgroundColor: colors.ripple },
  sentTitle: { marginTop: 20, fontSize: 28, lineHeight: 36, fontWeight: "800", textAlign: "center", color: colors.heading },
  sentText: { marginTop: 12, maxWidth: 420, fontSize: 17, lineHeight: 25, textAlign: "center", color: colors.heading },
});
