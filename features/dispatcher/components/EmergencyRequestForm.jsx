import { MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, doc, getDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";

import { DESIGN_COLORS } from "../../../constants/design";
import { db } from "../../../firebase";
import { TOLEDO_BARANGAY_PICKER_OPTIONS } from "../../../lib/barangays";
import { formatClockTime, formatShortDay, getDateFromValue } from "../../../lib/dates";
import { formatDutyDuration } from "../../../lib/dutyTime";
import { normalizePhilippinePhone } from "../../resident/utils/requestValidation";
import { createEmergencyRide } from "../services/dispatcherAssignmentService";

// The choices the dispatcher picks from while on the call (emergency-request-form-plan.md).
export const EMERGENCY_TYPES = ["Medical", "Accident / injury", "Fire-related", "Pregnancy / labor", "Other"];
// Our existing priority names (constants/app.js), without "Planned": an emergency is never scheduled.
export const EMERGENCY_PRIORITIES = ["Emergency", "Urgent", "Non-Urgent"];
const MAX_PATIENTS = 50;
const CONDITION_CHOICES = ["Yes", "No", "Unknown"];
const INCIDENT_PLACEHOLDER = "What happened, who needs help, and their condition.";

// The straight-line ("as the crow flies") distance in km between two GPS points (the haversine formula).
// Roads are longer, so it is only a rough guide.
const distanceKm = (from, to) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeChange = toRadians(to.latitude - from.latitude);
  const longitudeChange = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(latitudeChange / 2) ** 2 + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(longitudeChange / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// "less than 1 km away" or "about 2 km away".
const getDistanceLabel = (km) => (km < 1 ? "less than 1 km away" : `about ${Math.round(km)} km away`);

// Checks the form. Returns { fieldName: "message" } for every field that needs fixing (empty = all good).
// chosenDriver / chosenVehicle = the picked driver and vehicle, or null if none (or no longer on the list).
const checkEmergencyForm = (form, chosenDriver, chosenVehicle) => {
  const errors = {};
  const name = form.callerName.trim();
  if (name.length < 2 || name.length > 80) errors.callerName = "Enter the caller's name.";
  if (!normalizePhilippinePhone(form.contactNumber)) errors.contactNumber = "Enter a mobile number like 0917 123 4567.";
  if (!form.barangay) errors.barangay = "Choose the barangay.";
  const pickup = form.pickupLocation.trim();
  if (!pickup || pickup.length > 300) errors.pickupLocation = "Enter where to pick up the patient (up to 300 letters).";
  if (form.landmark.trim().length > 300) errors.landmark = "Keep the landmark under 300 letters.";
  if (!EMERGENCY_TYPES.includes(form.emergencyType)) errors.emergencyType = "Choose the emergency type.";
  if (form.emergencyType === "Other" && !form.emergencyTypeOther.trim()) errors.emergencyTypeOther = "Describe the other emergency.";
  if (!Number.isInteger(form.patientCount) || form.patientCount < 1 || form.patientCount > MAX_PATIENTS) {
    errors.patientCount = `Choose 1 to ${MAX_PATIENTS} patients.`;
  }
  const age = form.approximateAge.trim();
  if (age) {
    const range = age.match(/^(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/);
    if (!range || (range[2] && Number(range[1]) > Number(range[2]))) errors.approximateAge = "Enter an age like 30 or a range like 30–40.";
  }
  if (!CONDITION_CHOICES.includes(form.conscious)) errors.conscious = "Choose Yes, No, or Unknown.";
  if (!CONDITION_CHOICES.includes(form.breathing)) errors.breathing = "Choose Yes, No, or Unknown.";
  const description = form.description.trim();
  if (!description || description.length > 500) errors.description = "Write the incident details (up to 500 characters).";
  const destination = form.destination.trim();
  if (!destination || destination.length > 180) errors.destination = "Enter the destination or hospital (up to 180 letters).";
  if (!chosenDriver) errors.driver = "Choose an Available driver.";
  else if (!chosenVehicle) errors.vehicle = "Choose a vehicle.";
  return errors;
};

// The Emergency request form (emergency-request-form-plan.md). Opens when the dispatcher answers an alert.
// alert = the live alert (callSessions document). It updates by itself, for example when the GPS location arrives.
// dispatcherId / dispatcherName = the logged-in dispatcher. onCancel = back to the dispatcher page, nothing saved.
// onSubmitted = the ride was saved: back to the dispatcher page (the Active emergency card says "Ride created").
// onOpenLocation = opens the resident's GPS spot in Google Maps.
// drivers = the drivers who can be given a ride now (Available, no ride in hand).
// vehicles = the vehicles for vehiclesDriverId, worked out by the dispatcher page the same way as for the Assign window.
// onChooseDriver(driver) = tells the dispatcher page which driver was picked, so it can work out that driver's vehicles.
export default function EmergencyRequestForm({
  alert,
  dispatcherId,
  dispatcherName,
  onCancel,
  onSubmitted,
  onOpenLocation,
  drivers,
  vehicles,
  vehiclesDriverId,
  onChooseDriver,
}) {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 1000;
  // The ride's id is made now, only on this computer (nothing is saved), so the reference can show at the top.
  const [requestId] = useState(() => doc(collection(db, "transportRequests")).id);
  const reference = `SKN-${requestId.slice(0, 8).toUpperCase()}`;
  const [form, setForm] = useState(() => ({
    callerName: alert.residentName || "",
    contactNumber: alert.residentPhone || "",
    barangay: "",
    pickupLocation: alert.pickupLocation || "",
    landmark: "",
    emergencyType: "",
    emergencyTypeOther: "",
    priority: "Emergency",
    patientCount: 1,
    approximateAge: "",
    conscious: "Unknown",
    breathing: "Unknown",
    description: "",
    destination: "",
    driverId: "",
    vehicleId: "",
  }));
  const [errors, setErrors] = useState({});
  // True while Submit is saving (the button can't be tapped twice). saveError = why saving failed.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  // True once the dispatcher types in Pickup location, so a late GPS address doesn't overwrite what they typed.
  const pickupEditedRef = useRef(false);

  const setValue = (field, value) => {
    const clearOther = field === "emergencyType" && value !== "Other";
    setForm((current) => ({ ...current, [field]: value, ...(clearOther ? { emergencyTypeOther: "" } : {}) }));
    setErrors((current) => ({ ...current, [field]: undefined, ...(clearOther ? { emergencyTypeOther: undefined } : {}) }));
  };

  // This counts patients at the incident, separately from the resident form's 1–6 rider limit.
  const changePatientCount = (step) => setValue("patientCount", Math.min(MAX_PATIENTS, Math.max(1, form.patientCount + step)));

  // The barangay comes from the resident's profile. (The alert's pickupLocation stops being
  // the barangay once the GPS address arrives.) Dispatchers may read profiles (firestore.rules).
  useEffect(() => {
    if (!alert.residentId) return;
    getDoc(doc(db, "users", alert.residentId))
      .then((profile) => {
        const barangay = profile.data()?.barangay || "";
        setForm((current) => (current.barangay ? current : { ...current, barangay }));
      })
      .catch((error) => console.log("Emergency form barangay warning:", error));
  }, [alert.residentId]);

  // The GPS address often arrives a few seconds after Answer. Fill it in, unless the dispatcher already typed here.
  useEffect(() => {
    if (!pickupEditedRef.current && alert.pickupLocation) {
      setForm((current) => ({ ...current, pickupLocation: alert.pickupLocation }));
    }
  }, [alert.pickupLocation]);

  const location = alert.location;
  const hasLocation = typeof location?.latitude === "number" && typeof location?.longitude === "number";
  const receivedAt = getDateFromValue(alert.createdAt);
  // The profile's barangay may be spelled differently from our list; add it so the dropdown can still show it.
  const barangayOptions =
    form.barangay && !TOLEDO_BARANGAY_PICKER_OPTIONS.some((option) => option.value === form.barangay)
      ? [{ label: form.barangay, value: form.barangay }, ...TOLEDO_BARANGAY_PICKER_OPTIONS]
      : TOLEDO_BARANGAY_PICKER_OPTIONS;

  // Each driver's rough distance from the resident's GPS spot, using the driver's last known location
  // (driver-location-plan.md). null = unknown. Nearest first; unknown at the bottom.
  const now = Date.now();
  const driverRows = drivers
    .map((driver) => ({ ...driver, km: hasLocation && driver.location ? distanceKm(location, driver.location) : null }))
    .sort((first, second) => (first.km ?? Infinity) - (second.km ?? Infinity));

  // The picked driver, only while they are still on the Available list (they may start a break while the form is open).
  const chosenDriver = drivers.find((driver) => driver.id === form.driverId) ?? null;
  // The vehicle list belongs to the picked driver only once the dispatcher page has caught up with the choice.
  const driverVehicles = chosenDriver && vehiclesDriverId === chosenDriver.id ? vehicles : [];
  const chosenVehicle = driverVehicles.find((vehicle) => vehicle.id === form.vehicleId) ?? null;

  const chooseDriver = (driver) => {
    onChooseDriver(driver);
    // A new driver means a new vehicle list, so the old vehicle choice is cleared.
    setForm((current) => ({ ...current, driverId: driver.id, vehicleId: "" }));
    setErrors((current) => ({ ...current, driver: undefined, vehicle: undefined }));
  };

  const submit = async () => {
    if (saving) return;
    const nextErrors = checkEmergencyForm(form, chosenDriver, chosenVehicle);
    setErrors(nextErrors);
    setSaveError("");
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await createEmergencyRide({
        requestId,
        alert,
        form,
        driver: chosenDriver,
        vehicle: chosenVehicle,
        dispatcher: { uid: dispatcherId, name: dispatcherName },
      });
      onSubmitted();
    } catch (error) {
      console.log("Emergency ride save failed:", error);
      // Our own messages ("…is no longer available", "A ride was already made…") have no code; Firebase errors do.
      setSaveError(
        error?.code ? "The request could not be saved. Check the internet connection and try again." : error?.message || "The request could not be saved."
      );
      setSaving(false);
    }
  };

  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.outlinePressed]}
          onPress={onCancel}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Back. Nothing is saved."
          accessibilityState={{ disabled: saving }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={DESIGN_COLORS.ink} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title} accessibilityRole="header">
            Emergency request form
          </Text>
          <Text style={styles.subtitle}>Fill this in while you are on the call.</Text>
        </View>
        <View style={styles.referenceTag}>
          <Text style={styles.referenceText}>Reference: {reference}</Text>
        </View>
      </View>

      <View style={[styles.card, desktop && styles.desktopCard]}>
        {/* ---- Caller information (filled in from the alert) ---- */}
        <SectionTitle icon="account-outline" text="Caller information" />
        <View style={[styles.row, !desktop && styles.stackedRow]}>
          <Field label="Caller name" required error={errors.callerName}>
            <TextInput
              style={[styles.input, errors.callerName && styles.inputError]}
              value={form.callerName}
              onChangeText={(text) => setValue("callerName", text)}
              maxLength={80}
              accessibilityLabel="Caller name"
            />
          </Field>
          <Field label="Contact number" required error={errors.contactNumber}>
            <TextInput
              style={[styles.input, errors.contactNumber && styles.inputError]}
              value={form.contactNumber}
              onChangeText={(text) => setValue("contactNumber", text)}
              keyboardType="phone-pad"
              placeholder="0917 123 4567"
              placeholderTextColor={DESIGN_COLORS.placeholder}
              accessibilityLabel="Contact number"
            />
          </Field>
          <Field label="Barangay" required error={errors.barangay}>
            <Dropdown
              style={[styles.input, styles.dropdown, errors.barangay && styles.inputError]}
              containerStyle={styles.dropdownList}
              selectedTextStyle={styles.inputText}
              placeholderStyle={styles.placeholderText}
              itemTextStyle={styles.inputText}
              activeColor={DESIGN_COLORS.boardTint}
              data={barangayOptions}
              labelField="label"
              valueField="value"
              value={form.barangay}
              placeholder="Choose the barangay"
              search
              searchPlaceholder="Search barangay"
              inputSearchStyle={styles.inputText}
              onChange={(item) => setValue("barangay", item.value)}
            />
          </Field>
        </View>
        <View style={[styles.row, !desktop && styles.stackedRow]}>
          <Field label="Pickup location" required error={errors.pickupLocation} wide>
            <TextInput
              style={[styles.input, errors.pickupLocation && styles.inputError]}
              value={form.pickupLocation}
              onChangeText={(text) => {
                pickupEditedRef.current = true;
                setValue("pickupLocation", text);
              }}
              maxLength={300}
              accessibilityLabel="Pickup location"
            />
          </Field>
          <Field label="Landmark (optional)" error={errors.landmark}>
            <TextInput
              style={[styles.input, errors.landmark && styles.inputError]}
              value={form.landmark}
              onChangeText={(text) => setValue("landmark", text)}
              maxLength={300}
              placeholder="e.g. near the covered court"
              placeholderTextColor={DESIGN_COLORS.placeholder}
              accessibilityLabel="Landmark, optional"
            />
          </Field>
        </View>
        {hasLocation ? (
          <View style={styles.locationLine}>
            <Text style={styles.hint}>From the resident&apos;s GPS.</Text>
            <Pressable
              style={({ pressed }) => [styles.smallOutlineButton, pressed && styles.outlinePressed]}
              onPress={() => onOpenLocation(location)}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="map-marker-outline" size={22} color={DESIGN_COLORS.hallGreen} />
              <Text style={styles.smallOutlineText}>Open location in Maps</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.hint}>Location not sent (yet). Ask the caller where they are.</Text>
        )}

        <View style={styles.divider} />

        {/* ---- Emergency details (typed during the call) ---- */}
        <SectionTitle icon="medical-bag" text="Emergency details" />
        <View style={[styles.row, !desktop && styles.stackedRow]}>
          <Field label="Emergency type" required error={errors.emergencyType}>
            <Dropdown
              style={[styles.input, styles.dropdown, errors.emergencyType && styles.inputError]}
              containerStyle={styles.dropdownList}
              selectedTextStyle={styles.inputText}
              placeholderStyle={styles.placeholderText}
              itemTextStyle={styles.inputText}
              itemContainerStyle={styles.dropdownItem}
              activeColor={DESIGN_COLORS.boardTint}
              data={EMERGENCY_TYPES.map((type) => ({ label: type, value: type }))}
              labelField="label"
              valueField="value"
              value={form.emergencyType}
              placeholder="Choose the emergency type"
              accessibilityLabel="Emergency type"
              onChange={(item) => setValue("emergencyType", item.value)}
            />
          </Field>
          <Field label="Priority" required>
            <Dropdown
              style={[styles.input, styles.dropdown]}
              containerStyle={styles.dropdownList}
              selectedTextStyle={styles.inputText}
              itemTextStyle={styles.inputText}
              itemContainerStyle={styles.dropdownItem}
              activeColor={DESIGN_COLORS.boardTint}
              data={EMERGENCY_PRIORITIES.map((priority) => ({ label: priority, value: priority }))}
              labelField="label"
              valueField="value"
              value={form.priority}
              accessibilityLabel="Priority"
              onChange={(item) => setValue("priority", item.value)}
            />
          </Field>
          <Field label="Number of patients" required error={errors.patientCount}>
            <View style={styles.stepper}>
              <StepperButton
                icon="minus"
                label="Fewer patients"
                disabled={form.patientCount <= 1}
                onPress={() => changePatientCount(-1)}
              />
              <Text style={styles.stepperValue} accessibilityLiveRegion="polite">
                {form.patientCount}
              </Text>
              <StepperButton
                icon="plus"
                label="More patients"
                disabled={form.patientCount >= MAX_PATIENTS}
                onPress={() => changePatientCount(1)}
              />
              {[5, 10].map((step) => (
                <Pressable
                  key={step}
                  style={({ pressed }) => [styles.stepperButton, form.patientCount >= MAX_PATIENTS && styles.stepperDisabled, pressed && styles.outlinePressed]}
                  onPress={() => changePatientCount(step)}
                  disabled={form.patientCount >= MAX_PATIENTS}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${step} patients, maximum ${MAX_PATIENTS}`}
                  accessibilityState={{ disabled: form.patientCount >= MAX_PATIENTS }}
                >
                  <Text style={styles.choiceText}>+{step}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>1–50 patients at the incident.</Text>
          </Field>
        </View>
        {form.emergencyType === "Other" ? (
          <Field label="Specify the emergency" required error={errors.emergencyTypeOther} wide>
            <TextInput
              style={[styles.input, errors.emergencyTypeOther && styles.inputError]}
              value={form.emergencyTypeOther}
              onChangeText={(text) => setValue("emergencyTypeOther", text)}
              maxLength={180}
              placeholder="Describe the other emergency"
              placeholderTextColor={DESIGN_COLORS.placeholder}
              accessibilityLabel="Specify the emergency"
            />
          </Field>
        ) : null}
        <View style={[styles.row, !desktop && styles.stackedRow]}>
          <Field label="Incident details" required error={errors.description} style={desktop && styles.incidentField}>
            <TextInput
              style={[styles.input, styles.textArea, errors.description && styles.inputError]}
              value={form.description}
              onChangeText={(text) => setValue("description", text)}
              multiline
              maxLength={500}
              placeholder={INCIDENT_PLACEHOLDER}
              placeholderTextColor={DESIGN_COLORS.placeholder}
              accessibilityLabel="Incident details. The driver and the resident can see this."
            />
            <Text style={styles.hint}>What happened, who needs help, and their condition (for example: male, about 30s, not breathing). Write only what the driver needs.</Text>
            <Text style={styles.hint}>The driver and the resident can see this.</Text>
          </Field>
          <View style={[styles.quickFacts, desktop && styles.desktopQuickFacts]}>
            <Field label="Approximate age (optional)" error={errors.approximateAge}>
              <TextInput
                style={[styles.input, errors.approximateAge && styles.inputError]}
                value={form.approximateAge}
                onChangeText={(text) => setValue("approximateAge", text)}
                maxLength={20}
                placeholder="e.g. 30 or 30–40"
                placeholderTextColor={DESIGN_COLORS.placeholder}
                accessibilityLabel="Approximate age, optional. Number or short range."
              />
            </Field>
            {[{ field: "conscious", label: "Conscious" }, { field: "breathing", label: "Breathing" }].map(({ field, label }) => (
              <Field key={field} label={label} error={errors[field]}>
                <View style={styles.choiceWrap}>
                  {CONDITION_CHOICES.map((answer) => (
                    <Choice key={answer} label={answer} accessibilityLabel={`${label}: ${answer}`} selected={form[field] === answer} onPress={() => setValue(field, answer)} />
                  ))}
                </View>
              </Field>
            ))}
            {form.patientCount > 1 ? <Text style={styles.hint}>If patients have different ages or conditions, explain the differences in Incident details.</Text> : null}
          </View>
        </View>
        <Field label="Destination / hospital" required error={errors.destination} wide>
          <TextInput
            style={[styles.input, errors.destination && styles.inputError]}
            value={form.destination}
            onChangeText={(text) => setValue("destination", text)}
            maxLength={180}
            placeholder="e.g. Toledo City General Hospital"
            placeholderTextColor={DESIGN_COLORS.placeholder}
            accessibilityLabel="Destination or hospital"
          />
        </Field>

        <View style={styles.divider} />

        {/* ---- Driver and vehicle (like the Assign window) ---- */}
        <SectionTitle icon="van-utility" text="Driver and vehicle" />
        <View style={[styles.row, !desktop && styles.stackedRow]}>
          <Field label="Driver" required error={errors.driver} wide>
            {/* Without the resident's GPS there is nothing to measure from. */}
            {drivers.length && !hasLocation ? <Text style={styles.hint}>Distance not shown: the resident&apos;s location was not sent.</Text> : null}
            {drivers.length ? (
              <View style={styles.optionList}>
                {driverRows.map((driver) => (
                  <OptionRow key={driver.id} selected={form.driverId === driver.id} onPress={() => chooseDriver(driver)} accessibilityLabel={`${driver.name}, Available`}>
                    <View style={styles.optionTop}>
                      <Text style={styles.optionTitle}>{driver.name}</Text>
                      <View style={styles.availableBadge}>
                        <Text style={styles.availableBadgeText}>Available</Text>
                      </View>
                    </View>
                    <Text style={styles.optionMeta}>{driver.barangay}</Text>
                    {/* The location is where the driver last tapped a step, so its age is shown too: it can be old. */}
                    {driver.km !== null ? (
                      <Text style={styles.optionDistance}>
                        {getDistanceLabel(driver.km)}
                        {driver.location.atMs != null
                          ? ` (location from ${now - driver.location.atMs < 60_000 ? "just now" : `${formatDutyDuration(now - driver.location.atMs)} ago`})`
                          : ""}
                      </Text>
                    ) : hasLocation ? (
                      <Text style={styles.optionMeta}>Distance unknown (no location shared)</Text>
                    ) : null}
                    {/* Punched in, but the app is closed: the driver may not see the ride (same warning as the Drivers column). */}
                    {driver.presence === "Offline" ? <Text style={styles.optionWarning}>App closed. Call the driver first.</Text> : null}
                  </OptionRow>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyBox}>No driver is Available right now. A driver must punch in first.</Text>
            )}
          </Field>
          {chosenDriver ? (
            <Field label="Vehicle" required error={errors.vehicle} wide>
              {driverVehicles.length ? (
                <View style={styles.optionList}>
                  {driverVehicles.map((vehicle) => (
                    <OptionRow
                      key={vehicle.id}
                      selected={form.vehicleId === vehicle.id}
                      onPress={() => setValue("vehicleId", vehicle.id)}
                      accessibilityLabel={`${vehicle.name || "Vehicle"}, plate ${vehicle.plateNumber || "none"}`}
                    >
                      <Text style={styles.optionTitle}>{vehicle.name || "Registered vehicle"}</Text>
                      <Text style={styles.optionMeta}>
                        {vehicle.type || "Vehicle"} · {vehicle.plateNumber || "No plate"}
                      </Text>
                    </OptionRow>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyBox}>No vehicle is free for {chosenDriver.name} right now. Choose another driver.</Text>
              )}
            </Field>
          ) : null}
        </View>

        <View style={styles.divider} />

        {/* ---- Call information (filled in by itself, can't be changed) ---- */}
        <SectionTitle icon="phone-outline" text="Call information" />
        <View style={[styles.row, !desktop && styles.stackedRow]}>
          <ReadOnly label="Date received" value={receivedAt ? formatShortDay(receivedAt) : "Not known"} />
          <ReadOnly label="Time received" value={receivedAt ? formatClockTime(receivedAt) : "Not known"} />
          <ReadOnly label="Dispatcher" value={dispatcherName || "Dispatcher"} />
        </View>

        <View style={styles.divider} />

        {hasErrors ? (
          <Text style={styles.errorBox} accessibilityRole="alert">
            Some fields need your attention. See the red messages above.
          </Text>
        ) : null}
        {saveError ? (
          <Text style={styles.errorBox} accessibilityRole="alert">
            {saveError} Nothing was saved.
          </Text>
        ) : null}

        {/* DESIGN.md: the main action on top, Cancel underneath. */}
        <Pressable
          style={({ pressed }) => [styles.submitButton, pressed && styles.submitPressed, saving && styles.submitSaving]}
          onPress={submit}
          disabled={saving}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving, busy: saving }}
        >
          <MaterialCommunityIcons name="send-outline" size={24} color={DESIGN_COLORS.paperWhite} />
          <Text style={styles.submitText}>{saving ? "Saving…" : "Submit request"}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.cancelButton, pressed && styles.outlinePressed]}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel. Nothing is saved."
          // Not while saving: the save would still finish, so "Cancel" would not be true.
          disabled={saving}
          accessibilityState={{ disabled: saving }}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <View style={styles.infoLine}>
          <MaterialCommunityIcons name="information-outline" size={22} color={DESIGN_COLORS.inkMuted} />
          <Text style={styles.hint}>After Submit, the driver gets the ride and the resident sees it in their &quot;Your ride&quot; card.</Text>
        </View>
      </View>
    </View>
  );
}

function SectionTitle({ icon, text }) {
  return (
    <View style={styles.sectionTitleRow}>
      <MaterialCommunityIcons name={icon} size={26} color={DESIGN_COLORS.hallGreen} />
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {text}
      </Text>
    </View>
  );
}

// A label, the input under it, and its red message. wide = takes a whole row on its own when there is room.
function Field({ label, required, error, wide, style, children }) {
  return (
    <View style={[styles.field, wide && styles.fieldWide, style]}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {children}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// One choice in a group (like a radio button): a round mark and a word.
function Choice({ label, accessibilityLabel, selected, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.outlinePressed]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected }}
    >
      <MaterialCommunityIcons name={selected ? "radiobox-marked" : "radiobox-blank"} size={24} color={selected ? DESIGN_COLORS.hallGreen : DESIGN_COLORS.controlOutline} />
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
  );
}

// One driver or vehicle to pick: an outlined row with a round mark (selected = green edge), not a card inside the card.
function OptionRow({ selected, onPress, accessibilityLabel, children }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.optionRow, selected && styles.choiceSelected, pressed && styles.outlinePressed]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
    >
      <MaterialCommunityIcons name={selected ? "radiobox-marked" : "radiobox-blank"} size={24} color={selected ? DESIGN_COLORS.hallGreen : DESIGN_COLORS.controlOutline} />
      <View style={styles.optionCopy}>{children}</View>
    </Pressable>
  );
}

function StepperButton({ icon, label, disabled, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.stepperButton, disabled && styles.stepperDisabled, pressed && !disabled && styles.outlinePressed]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <MaterialCommunityIcons name={icon} size={24} color={disabled ? DESIGN_COLORS.controlOutline : DESIGN_COLORS.ink} />
    </Pressable>
  );
}

function ReadOnly({ label, value }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.readOnlyValue}>{value}</Text>
    </View>
  );
}

// DESIGN.md look: flat, corners 16 (controls) and 24 (the card), Hall Green titles, red only for errors.
const styles = StyleSheet.create({
  page: { width: "100%", maxWidth: 1280, alignSelf: "center", gap: 12 },
  header: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 16 },
  backButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  backText: { fontSize: 17, fontWeight: "700", color: DESIGN_COLORS.ink },
  headerCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 280 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: DESIGN_COLORS.ink },
  subtitle: { marginTop: 2, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted },
  referenceTag: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: DESIGN_COLORS.boardTint },
  referenceText: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },
  card: { padding: 24, gap: 16, borderRadius: 24, borderWidth: 1, borderColor: DESIGN_COLORS.rule, backgroundColor: DESIGN_COLORS.paperWhite },
  desktopCard: { padding: 16, gap: 12 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.hallGreen },
  divider: { height: 1, backgroundColor: DESIGN_COLORS.rule },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-start" },
  stackedRow: { flexDirection: "column", alignItems: "stretch" },
  field: { flexGrow: 1, flexShrink: 1, flexBasis: "auto", minWidth: 0, gap: 4 },
  fieldWide: { flexGrow: 2 },
  incidentField: { flexGrow: 2, flexBasis: 0 },
  quickFacts: { flexGrow: 1, flexShrink: 1, flexBasis: "auto", minWidth: 0, gap: 8 },
  desktopQuickFacts: { flexBasis: 300 },
  label: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  required: { color: DESIGN_COLORS.emergencyRed },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
    fontSize: 17,
    color: DESIGN_COLORS.ink,
  },
  inputError: { borderColor: DESIGN_COLORS.emergencyRed, borderWidth: 2 },
  inputText: { fontSize: 17, color: DESIGN_COLORS.ink },
  placeholderText: { fontSize: 17, color: DESIGN_COLORS.placeholder },
  dropdown: { paddingVertical: 0 },
  dropdownList: { borderRadius: 16, borderColor: DESIGN_COLORS.controlOutline },
  dropdownItem: { minHeight: 48 },
  textArea: { minHeight: 144, textAlignVertical: "top" },
  hint: { fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.inkMuted },
  errorText: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.emergencyRed },
  locationLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  smallOutlineButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  smallOutlineText: { fontSize: 17, fontWeight: "700", color: DESIGN_COLORS.hallGreen },
  outlinePressed: { backgroundColor: DESIGN_COLORS.boardTint },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  choiceSelected: { borderWidth: 2, borderColor: DESIGN_COLORS.hallGreen, backgroundColor: DESIGN_COLORS.boardTint },
  choiceText: { fontSize: 17, fontWeight: "600", color: DESIGN_COLORS.ink },
  optionList: { gap: 8 },
  optionRow: {
    minHeight: 56,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  optionCopy: { flex: 1, gap: 2 },
  optionTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  optionTitle: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  optionMeta: { fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.inkMuted },
  optionDistance: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.ink },
  optionWarning: { marginTop: 4, fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.orangeDeep },
  // Same green badge as the Drivers column ("Available" = Hall Green with white words).
  availableBadge: { paddingVertical: 2, paddingHorizontal: 10, borderRadius: 999, backgroundColor: DESIGN_COLORS.hallGreen },
  availableBadgeText: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.paperWhite },
  emptyBox: { padding: 12, borderRadius: 16, overflow: "hidden", fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.ink, backgroundColor: DESIGN_COLORS.boardTint },
  stepper: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  stepperButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  stepperDisabled: { borderColor: DESIGN_COLORS.rule, backgroundColor: DESIGN_COLORS.boardTint },
  stepperValue: { minWidth: 32, textAlign: "center", fontSize: 22, fontWeight: "800", color: DESIGN_COLORS.ink },
  readOnlyValue: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: DESIGN_COLORS.boardTint,
    fontSize: 17,
    color: DESIGN_COLORS.ink,
    overflow: "hidden",
  },
  errorBox: { padding: 12, borderRadius: 16, overflow: "hidden", fontSize: 17, lineHeight: 24, fontWeight: "700", color: DESIGN_COLORS.emergencyRed, backgroundColor: DESIGN_COLORS.redTint },
  submitButton: {
    width: "100%",
    maxWidth: 480,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 16,
    backgroundColor: DESIGN_COLORS.hallGreen,
  },
  submitPressed: { backgroundColor: DESIGN_COLORS.hallGreenDeep },
  submitSaving: { opacity: 0.7 },
  submitText: { fontSize: 17, fontWeight: "800", color: DESIGN_COLORS.paperWhite },
  cancelButton: {
    width: "100%",
    maxWidth: 480,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  cancelText: { fontSize: 17, fontWeight: "700", color: DESIGN_COLORS.ink },
  infoLine: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
});
