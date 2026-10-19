import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomSheetPicker from "../../../components/BottomSheetPicker";
import CloseButton from "../../../components/ui/CloseButton";
import { CORNER, FONT, GREEN, NEUTRAL, ORANGE, RED } from "../../../constants/design";
import { TOLEDO_BARANGAY_PICKER_OPTIONS } from "../../../lib/barangays";
import useCurrentLocation from "../hooks/useCurrentLocation";
import { createResidentRequest } from "../services/residentRequestService";
import { formatClockTime, formatShortDay } from "../../../lib/dates";
import {
  ASSISTANCE_OPTIONS,
  BIG_GROUP_NOTE,
  MAX_PASSENGERS,
  PURPOSE_OPTIONS,
  SCHEDULE_MAX_DAYS_AHEAD,
  SCHEDULE_MIN_MINUTES_AHEAD,
  buildScheduledDate,
  isAllowedScheduleTime,
  isBigGroup,
  toDayValue,
} from "../utils/requestOptions";
import { SCHEDULE_TIME_MESSAGE, sanitizeRequestForm, validateResidentRequest } from "../utils/requestValidation";
import MapLocationModal from "./MapLocationModal";

// Resident transport request: one scrolling page → Review → Sent. It fills the whole screen.
// Pending and Rejected residents never get here: the resident home stops them before it opens this.
// Always light, like the resident registration form.

// The light green of a pressed row or button (Android ripple).
const RIPPLE = "rgba(11, 122, 75, 0.12)";

const newForm = (barangay) => ({
  purpose: "",
  purposeOther: "",
  timing: "asap", // "asap" or "scheduled"
  scheduleDay: "", // "2026-10-02"
  scheduleMinutes: null, // minutes after midnight, e.g. 540 = 9:00 AM
  ridingFor: "self", // "self" or "other"
  passengerName: "",
  passengerPhone: "",
  passengerCount: "1", // text while typing (Task 3.10); sent as a number
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

  // "Me" hides the passenger boxes, so their old red messages are cleared too
  // (otherwise "Please fix the item marked in red" would stay with nothing red on screen).
  const setRidingFor = (value) => {
    setValue("ridingFor", value);
    if (value === "self") setErrors((current) => ({ ...current, passengerName: "", passengerPhone: "" }));
  };

  const toggleAssistance = (option) => {
    const next = form.assistance.includes(option) ? form.assistance.filter((item) => item !== option) : [...form.assistance, option];
    setValue("assistance", next);
    if (option === "Other") setErrors((current) => ({ ...current, assistanceOther: "" }));
  };

  // Changing the day clears the time if that time can't be booked on the new day.
  // Right after picking (Task 3.11): if the day and time are both chosen but may not be booked
  // (less than 1 hour from now, or more than 1 year ahead), the red message shows at once. Otherwise it goes away.
  const checkSchedule = (dayValue, minutes) => {
    const notAllowed = Boolean(dayValue) && minutes !== null && !isAllowedScheduleTime(buildScheduledDate(dayValue, minutes));
    setErrors((current) => ({ ...current, schedule: notAllowed ? SCHEDULE_TIME_MESSAGE : "" }));
  };

  // A new day keeps the chosen time; checkSchedule says if the two together are not allowed.
  const setScheduleDay = (dayValue) => {
    setForm((current) => ({ ...current, scheduleDay: dayValue }));
    checkSchedule(dayValue, form.scheduleMinutes);
  };

  const setScheduleMinutes = (minutes) => {
    setForm((current) => ({ ...current, scheduleMinutes: minutes }));
    checkSchedule(form.scheduleDay, minutes);
  };

  // - and + work from whatever is in the box: empty or 0 counts as 0, so + makes it 1; 75 with - becomes 50.
  const changeCount = (step) => {
    setValue("passengerCount", String(Math.min(MAX_PASSENGERS, Math.max(1, Number(form.passengerCount) + step))));
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
    // Check again: the chosen time may have become too soon while the form was open.
    const nextErrors = validateResidentRequest(form, residentPhone);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setPage("fill");
      return;
    }
    setSaving(true);
    setSendError("");
    try {
      // The box holds text ("12"); Firestore gets the number (12), as before.
      const created = await createResidentRequest({ uid, residentName, residentPhone, form: { ...form, passengerCount: Number(form.passengerCount) } });
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
        {/* "padding" on Android too: the app is edge-to-edge, so Android no longer shrinks the screen for the keyboard.
            This adds the space instead, and the page scrolls so the box being typed in stays visible. */}
        <KeyboardAvoidingView behavior="padding" style={styles.page}>
          {/* Green strip behind the clock and battery (Task 3.17), the same green as the home screen's header.
              The form scrolls under it instead of under the clock. The clock icons stay white here
              (a "dark icons" setting doesn't reach this pop-up window), so they need the green to be seen. */}
          <View style={[styles.clockStrip, { height: insets.top }]} />
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[styles.content, { paddingTop: 12, paddingBottom: insets.bottom + 16 }]}
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
                  <CloseButton onPress={close} label="Close request form" />
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
                    setRidingFor={setRidingFor}
                    setScheduleDay={setScheduleDay}
                    setScheduleMinutes={setScheduleMinutes}
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
                    android_ripple={{ color: RIPPLE }}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.buttonText, styles.outlineButtonText]}>{page === "review" ? "Back" : "Cancel"}</Text>
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

function FillPage({ form, errors, residentName, residentPhone, setValue, setRidingFor, setScheduleDay, setScheduleMinutes, toggleAssistance, changeCount, locating, locationMessage, onUseGps, onOpenMap }) {
  const hasExactSpot = form.pickup.latitude !== null;
  const peopleCount = Number(form.passengerCount);

  return (
    <>
      <View style={styles.emergencyNote}>
        <MaterialCommunityIcons name="alert-outline" size={22} color={RED[600]} />
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
              placeholder="Tell us briefly"
              placeholderTextColor={NEUTRAL[600]}
              maxLength={100}
              accessibilityLabel="What the ride is for"
            />
            <ErrorText message={errors.purposeOther} />
          </>
        ) : null}
      </Field>

      <Field icon="clock-outline" label="When do you need the ride?" error={errors.schedule}>
        <View style={styles.choiceList} accessibilityRole="radiogroup">
          <ChoiceRow type="radio" label="As soon as possible" selected={form.timing === "asap"} onPress={() => setValue("timing", "asap")} />
          <ChoiceRow type="radio" label="Schedule for later" selected={form.timing === "scheduled"} onPress={() => setValue("timing", "scheduled")} />
        </View>
        {form.timing === "scheduled" ? <SchedulePicker form={form} hasError={Boolean(errors.schedule)} setScheduleDay={setScheduleDay} setScheduleMinutes={setScheduleMinutes} /> : null}
      </Field>

      <Field icon="account-outline" label="Who is riding?" error={errors.ridingFor}>
        <View style={styles.choiceList} accessibilityRole="radiogroup">
          <ChoiceRow type="radio" label="Me" detail={[residentName, residentPhone].filter(Boolean).join(" · ")} selected={form.ridingFor === "self"} onPress={() => setRidingFor("self")} />
          <ChoiceRow type="radio" label="Someone else" selected={form.ridingFor === "other"} onPress={() => setRidingFor("other")} />
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
              placeholderTextColor={NEUTRAL[600]}
              autoCapitalize="words"
              maxLength={80}
              accessibilityLabel="Passenger's name"
            />
          </Field>
          <Field icon="phone-outline" label="Passenger's phone" error={errors.passengerPhone}>
            <TextInput
              style={[styles.input, errors.passengerPhone && styles.inputError]}
              value={form.passengerPhone}
              onChangeText={(value) => setValue("passengerPhone", value)}
              placeholder="09XX XXX XXXX"
              placeholderTextColor={NEUTRAL[600]}
              keyboardType="phone-pad"
              maxLength={16}
              accessibilityLabel="Passenger's phone"
            />
          </Field>
        </>
      ) : null}

      <Field icon="account-multiple-outline" label="How many people are riding?" error={errors.passengerCount}>
        <View style={styles.stepper}>
          <StepperButton icon="minus" label="Fewer people" disabled={peopleCount <= 1} onPress={() => changeCount(-1)} />
          {/* A box the resident can type in (Task 3.10), like the dispatcher's "Number of patients". */}
          <TextInput
            style={[styles.input, styles.countInput, errors.passengerCount && styles.inputError]}
            value={form.passengerCount}
            // Digits only: if the new text has a letter or any other sign, it is not added.
            onChangeText={(text) => {
              if (/^[0-9]*$/.test(text)) setValue("passengerCount", text);
            }}
            keyboardType="number-pad"
            // 3 digits, so "100" can be typed and gets the red message (with 2 it would quietly become "10").
            maxLength={3}
            accessibilityLabel={`Number of people riding, 1 to ${MAX_PASSENGERS}`}
          />
          <StepperButton icon="plus" label="More people" disabled={peopleCount >= MAX_PASSENGERS} onPress={() => changeCount(1)} />
        </View>
        <Hint text={`Count everyone, including the passenger. Up to ${MAX_PASSENGERS}.`} />
        {isBigGroup(peopleCount) ? <Hint icon="alert-outline" iconColor={ORANGE[700]} text={BIG_GROUP_NOTE} strong /> : null}
      </Field>

      <Field icon="home-outline" label="Pickup barangay" error={errors.barangay}>
        <BottomSheetPicker
          style={[styles.input, errors.barangay && styles.inputError]}
          title="Pickup barangay"
          searchable
          searchPlaceholder="Search barangay"
          options={TOLEDO_BARANGAY_PICKER_OPTIONS}
          placeholder="Select the barangay"
          value={form.barangay}
          onChange={(value) => setValue("barangay", value)}
          accessibilityLabel="Pickup barangay"
        />
      </Field>

      <Field icon="crosshairs-gps" label="Exact pickup spot (optional)">
        <View style={styles.buttonList}>
          <ActionButton icon="crosshairs-gps" label={locating ? "Finding your location..." : "Use Current Location"} disabled={locating} onPress={onUseGps} />
          <ActionButton icon="map-marker-plus-outline" label="Place Map Pin" disabled={locating} onPress={onOpenMap} />
        </View>
        {hasExactSpot ? (
          <Hint icon="check-circle" iconColor={GREEN[600]} text={`Location added: ${form.pickup.address}`} strong />
        ) : (
          <Hint icon="information-outline" text="Helps the driver find the exact spot." />
        )}
        {locationMessage ? <Hint icon="alert-circle-outline" iconColor={ORANGE[700]} text={locationMessage} /> : null}
      </Field>

      <Field icon="map-marker-outline" label="Landmark / pickup details" error={errors.pickupDetails}>
        <TextInput
          style={[styles.input, styles.multiline, errors.pickupDetails && styles.inputError]}
          value={form.pickupDetails}
          onChangeText={(value) => setValue("pickupDetails", value)}
          placeholder="e.g. blue gate beside the chapel"
          placeholderTextColor={NEUTRAL[600]}
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
          placeholderTextColor={NEUTRAL[600]}
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
              placeholderTextColor={NEUTRAL[600]}
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
          placeholderTextColor={NEUTRAL[600]}
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
    ["clock-outline", "When", form.timing === "scheduled" ? scheduleText(form) : "As soon as possible"],
    ["account-outline", "Who is riding", riderIsMe ? `Me (${residentName})` : form.passengerName],
    ["phone-outline", "Contact number", riderIsMe || !form.passengerPhone ? `${residentPhone}${riderIsMe ? "" : " (yours)"}` : form.passengerPhone],
    ["account-multiple-outline", "People riding", peopleText(Number(form.passengerCount))],
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
            <MaterialCommunityIcons name={icon} size={22} color={GREEN[600]} style={styles.summaryIcon} />
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

// "Fri, Oct 2, 9:00 AM" for the day and time chosen in the form.
const scheduleText = (form) => {
  const date = buildScheduledDate(form.scheduleDay, form.scheduleMinutes);
  return `${formatShortDay(date)}, ${formatClockTime(date)}`;
};

// The Day and Time pickers under "Schedule for later" (Task 3.11).
// Phone: two buttons. Day opens Android's own calendar (days before today and after 1 year are greyed out),
//   Time opens Android's own scroll-wheel clock (hour | minute | AM/PM).
// Website: the browser's own date and time boxes (DateTimePickerAndroid only works on Android).
function SchedulePicker({ form, hasError, setScheduleDay, setScheduleMinutes }) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + SCHEDULE_MAX_DAYS_AHEAD);
  const chosenDay = form.scheduleDay ? buildScheduledDate(form.scheduleDay, 0) : null;
  const chosenTime = form.scheduleDay && form.scheduleMinutes !== null ? buildScheduledDate(form.scheduleDay, form.scheduleMinutes) : null;

  const openCalendar = () =>
    DateTimePickerAndroid.open({
      mode: "date",
      value: chosenDay || firstDay,
      minimumDate: firstDay,
      maximumDate: lastDay,
      // "set" = the resident pressed OK. Cancel ("dismissed") changes nothing.
      onChange: (event, date) => {
        if (event.type === "set" && date) setScheduleDay(toDayValue(date));
      },
    });

  const openClock = () =>
    DateTimePickerAndroid.open({
      mode: "time",
      display: "spinner",
      is24Hour: false,
      // Starts at the chosen time, or 1 hour from now.
      value: chosenTime || new Date(now.getTime() + SCHEDULE_MIN_MINUTES_AHEAD * 60_000),
      onChange: (event, date) => {
        if (event.type === "set" && date) setScheduleMinutes(date.getHours() * 60 + date.getMinutes());
      },
    });

  return (
    <View style={styles.schedulePicker}>
      <Text style={styles.subLabel}>Day</Text>
      {Platform.OS === "web" ? (
        <input
          type="date"
          aria-label="Day of the ride"
          value={form.scheduleDay}
          min={toDayValue(firstDay)}
          max={toDayValue(lastDay)}
          onChange={(event) => setScheduleDay(event.target.value)}
          style={{ ...webBoxStyle, ...(hasError && !form.scheduleDay ? webBoxErrorStyle : null) }}
        />
      ) : (
        <PickerButton
          icon="calendar-month-outline"
          text={chosenDay ? `${formatShortDay(chosenDay)}, ${chosenDay.getFullYear()}` : "Choose the day"}
          chosen={Boolean(chosenDay)}
          hasError={hasError && !form.scheduleDay}
          onPress={openCalendar}
          accessibilityLabel="Day of the ride"
        />
      )}

      <Text style={[styles.subLabel, styles.subLabelSpaced]}>Time</Text>
      {Platform.OS === "web" ? (
        <input
          type="time"
          aria-label="Time of the ride"
          value={toTimeValue(form.scheduleMinutes)}
          onChange={(event) => setScheduleMinutes(fromTimeValue(event.target.value))}
          disabled={!form.scheduleDay}
          style={{ ...webBoxStyle, ...(hasError ? webBoxErrorStyle : null), ...(!form.scheduleDay ? webBoxDisabledStyle : null) }}
        />
      ) : (
        <PickerButton
          icon="clock-outline"
          text={chosenTime ? formatClockTime(chosenTime) : form.scheduleDay ? "Choose the time" : "Choose the day first"}
          chosen={Boolean(chosenTime)}
          hasError={hasError}
          disabled={!form.scheduleDay}
          onPress={openClock}
          accessibilityLabel="Time of the ride"
        />
      )}

      <Hint icon="information-outline" text="Book at least 1 hour ahead, up to 1 year." />
    </View>
  );
}

// The phone's Day / Time button: looks like the other boxes on the form, opens Android's calendar or clock.
function PickerButton({ icon, text, chosen, hasError, disabled, onPress, accessibilityLabel }) {
  return (
    <Pressable
      style={[styles.input, styles.pickerButton, hasError && styles.inputError, disabled && styles.inputDisabled]}
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: RIPPLE }}
      accessibilityRole="button"
      accessibilityLabel={`${accessibilityLabel}: ${text}`}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <MaterialCommunityIcons name={icon} size={24} color={disabled ? NEUTRAL[400] : GREEN[600]} />
      <Text style={[styles.pickerButtonText, !chosen && styles.pickerButtonPlaceholder]}>{text}</Text>
    </Pressable>
  );
}

// The website's time box uses "09:30"; the form keeps minutes after midnight (570).
const toTimeValue = (minutes) => (minutes === null ? "" : `${`${Math.floor(minutes / 60)}`.padStart(2, "0")}:${`${minutes % 60}`.padStart(2, "0")}`);
const fromTimeValue = (text) => {
  if (!text) return null;
  const [hours, minutes] = text.split(":").map(Number);
  return hours * 60 + minutes;
};

// The website's date and time boxes, styled like the form's other boxes (56 tall, 17 text, 12 corners).
const webBoxStyle = {
  width: "100%",
  minHeight: 56,
  boxSizing: "border-box",
  padding: "0 14px",
  borderRadius: CORNER.input,
  border: `1.5px solid ${NEUTRAL[500]}`,
  backgroundColor: NEUTRAL[0],
  color: NEUTRAL[900],
  fontSize: 17,
  fontFamily: FONT.regular,
};
const webBoxErrorStyle = { border: `2px solid ${RED[600]}` };
const webBoxDisabledStyle = { backgroundColor: NEUTRAL[100] };

function SentPage({ reference, onDone }) {
  return (
    <View style={styles.sent}>
      <View style={styles.sentDisc}>
        <MaterialCommunityIcons name="check" size={56} color={GREEN[600]} />
      </View>
      <Text style={styles.sentTitle} accessibilityRole="header">
        Request sent
      </Text>
      <Text style={styles.sentText}>Your reference is {reference}</Text>
      <Text style={[styles.sentText, styles.sentTextMuted]}>
        A dispatcher will look at your request and send a vehicle. You can follow it on your home screen and in History.
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
        <MaterialCommunityIcons name={icon} size={22} color={GREEN[600]} />
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
      {icon ? <MaterialCommunityIcons name={icon} size={22} color={iconColor || NEUTRAL[700]} /> : null}
      <Text style={[styles.hintText, strong && styles.hintStrong]}>{text}</Text>
    </View>
  );
}

// A plain row you tap to choose: a round radio (pick one) or a square checkbox (pick any), then the words.
// No box around it (Task 3.9). The chosen one has a filled green mark and bold words, so it is not shown by color only.
function ChoiceRow({ type, label, detail, selected, onPress }) {
  const icon = type === "radio" ? (selected ? "radiobox-marked" : "radiobox-blank") : selected ? "checkbox-marked" : "checkbox-blank-outline";
  return (
    <Pressable
      style={styles.choice}
      onPress={onPress}
      android_ripple={{ color: RIPPLE }}
      accessibilityRole={type}
      accessibilityState={{ checked: selected }}
    >
      <MaterialCommunityIcons name={icon} size={26} color={selected ? GREEN[600] : NEUTRAL[500]} />
      <View style={styles.choiceCopy}>
        <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
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
      android_ripple={{ color: RIPPLE, borderless: true }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <MaterialCommunityIcons name={icon} size={30} color={disabled ? NEUTRAL[400] : GREEN[600]} />
    </Pressable>
  );
}

function ActionButton({ icon, label, disabled, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: RIPPLE }}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: disabled }}
    >
      <MaterialCommunityIcons name={icon} size={24} color={GREEN[600]} />
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

// DESIGN.md Style: off-white page, white inputs with 12 corners and a neutral-500 edge, labels 17 SemiBold,
// pill buttons, nothing smaller than 15.
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: NEUTRAL[50] },
  clockStrip: { backgroundColor: GREEN[600] },
  content: { flexGrow: 1, width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: NEUTRAL[900] },
  emergencyNote: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: CORNER.input,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: RED[50],
  },
  emergencyNoteText: { flex: 1, fontSize: 15, lineHeight: 20, fontFamily: FONT.semiBold, color: NEUTRAL[900] },
  // Task 3.9: sections 16 apart (was 24) so the form is shorter.
  field: { marginTop: 16 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  label: { flexShrink: 1, fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: NEUTRAL[900] },
  input: {
    fontFamily: FONT.regular,
    minHeight: 56,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: NEUTRAL[500],
    borderRadius: CORNER.input,
    fontSize: 17,
    color: NEUTRAL[900],
    backgroundColor: NEUTRAL[0],
  },
  inputBelow: { marginTop: 10 },
  inputError: { borderColor: RED[600], borderWidth: 2 },
  inputDisabled: { backgroundColor: NEUTRAL[100] },
  schedulePicker: { marginTop: 12 },
  pickerButton: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, overflow: "hidden" },
  pickerButtonText: { fontFamily: FONT.regular, flex: 1, fontSize: 17, lineHeight: 22, color: NEUTRAL[900] },
  pickerButtonPlaceholder: { color: NEUTRAL[600] },
  subLabel: { marginBottom: 8, fontSize: 15, lineHeight: 20, fontFamily: FONT.semiBold, color: NEUTRAL[900] },
  subLabelSpaced: { marginTop: 12 },
  multiline: { minHeight: 96, paddingTop: 14, paddingBottom: 14 },
  choiceList: { gap: 4 },
  // The two boxed buttons under "Exact pickup spot" keep their old gap.
  buttonList: { gap: 10 },
  choiceListBelow: { marginTop: 10 },
  // At least 48 tall so it is easy to tap (DESIGN.md). It grows when the words wrap with large text.
  choice: {
    minHeight: 48,
    paddingVertical: 8,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: CORNER.input,
  },
  choiceCopy: { flex: 1 },
  choiceText: { fontFamily: FONT.regular, fontSize: 17, lineHeight: 22, color: NEUTRAL[900] },
  choiceTextSelected: { fontFamily: FONT.semiBold },
  choiceDetail: { fontFamily: FONT.regular, marginTop: 2, fontSize: 15, lineHeight: 20, color: NEUTRAL[700] },
  stepper: { flexDirection: "row", alignItems: "center", gap: 16 },
  // + and − are round (DESIGN.md Style: pills), 64 across.
  stepperButton: {
    width: 64,
    height: 64,
    borderRadius: CORNER.pill,
    borderWidth: 2,
    borderColor: GREEN[600],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: NEUTRAL[0],
  },
  stepperButtonDisabled: { borderColor: NEUTRAL[300] },
  countInput: { width: 88, paddingHorizontal: 6, textAlign: "center", fontSize: 22, fontFamily: FONT.bold, fontVariant: ["tabular-nums"] },
  // "Use Current Location" / "Place Map Pin": secondary pills (white, grey edge, green words).
  actionButton: {
    minHeight: 56,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: NEUTRAL[500],
    borderRadius: CORNER.pill,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: NEUTRAL[0],
  },
  actionButtonText: { flex: 1, fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: GREEN[700] },
  hintRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  hintText: { fontFamily: FONT.regular, flex: 1, fontSize: 15, lineHeight: 20, color: NEUTRAL[700] },
  hintStrong: { fontFamily: FONT.semiBold, color: NEUTRAL[900] },
  errorText: { marginTop: 8, fontSize: 15, lineHeight: 20, fontFamily: FONT.semiBold, color: RED[600] },
  errorSummary: { marginBottom: 12, fontSize: 15, lineHeight: 20, fontFamily: FONT.semiBold, color: RED[600] },
  reviewIntro: { fontFamily: FONT.regular, marginTop: 8, marginBottom: 16, fontSize: 17, lineHeight: 24, color: NEUTRAL[700] },
  // The review list: one white card (16 corners, thin edge, Level 1 shadow), a thin line between rows.
  summary: {
    borderRadius: CORNER.card,
    borderWidth: 1,
    borderColor: NEUTRAL[200],
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: NEUTRAL[0],
    boxShadow: "0 1px 3px rgba(20, 33, 28, 0.08), 0 1px 2px rgba(20, 33, 28, 0.04)",
  },
  summaryRow: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: NEUTRAL[100] },
  summaryIcon: { marginTop: 2 },
  summaryText: { flex: 1 },
  summaryLabel: { fontSize: 15, lineHeight: 20, fontFamily: FONT.medium, color: NEUTRAL[700] },
  summaryValue: { fontFamily: FONT.regular, marginTop: 2, fontSize: 17, lineHeight: 22, color: NEUTRAL[900] },
  spacer: { flexGrow: 1, minHeight: 32 },
  buttonRow: { flexDirection: "row", gap: 12 },
  // Pills, 56 tall (DESIGN.md main action).
  button: { flex: 1, minHeight: 56, paddingHorizontal: 16, borderRadius: CORNER.pill, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  outlineButton: { borderWidth: 1.5, borderColor: NEUTRAL[500], backgroundColor: NEUTRAL[0] },
  outlineButtonText: { color: GREEN[700] },
  filledButton: { backgroundColor: GREEN[600] },
  doneButton: { flex: 0, alignSelf: "stretch" },
  pressed: { opacity: 0.88 },
  buttonText: { fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, textAlign: "center" },
  sent: { flexGrow: 1, alignItems: "center", paddingTop: 48 },
  // "Request sent": a check in a light green circle (DESIGN.md Style empty-state look).
  sentDisc: { width: 96, height: 96, borderRadius: CORNER.pill, alignItems: "center", justifyContent: "center", backgroundColor: GREEN[50] },
  sentTitle: { marginTop: 20, fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, textAlign: "center", color: NEUTRAL[900] },
  sentText: { fontFamily: FONT.regular, marginTop: 12, maxWidth: 420, fontSize: 17, lineHeight: 24, textAlign: "center", color: NEUTRAL[900] },
  sentTextMuted: { color: NEUTRAL[700] },
});
