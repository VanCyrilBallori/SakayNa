import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";

import AppButton from "../../../components/ui/AppButton";
import FeedbackMessage from "../../../components/ui/FeedbackMessage";
import { TOLEDO_BARANGAY_OPTIONS } from "../../../lib/barangays";
import { COLORS, RADIUS, SPACING } from "../../../constants/design";
import useCurrentLocation from "../hooks/useCurrentLocation";
import { createResidentRequest } from "../services/residentRequestService";
import { PASSENGER_CAPACITY_OPTIONS, SERVICE_TYPE_OPTIONS, VULNERABLE_GROUP_OPTIONS } from "../utils/requestOptions";
import { sanitizeRequestForm, validateResidentRequest } from "../utils/requestValidation";
import MapLocationModal from "./MapLocationModal";

const categoryOptions = [{ label: "Community transport", value: "Community Transport Request" }, { label: "Emergency transport", value: "Emergency Request" }];
const destinationOptions = [{ label: "Enter destination", value: "manual" }, { label: "Nearest appropriate facility", value: "nearest-facility" }, { label: "No destination (emergency only)", value: "no-destination" }];

const newForm = (profile, displayName) => ({ category: "Community Transport Request", serviceType: "", passengerCapacity: "", passengerName: displayName || "", contactNumber: profile?.phoneNumber || profile?.phone || "", barangay: profile?.barangay || "", pickup: { latitude: null, longitude: null, address: profile?.barangay || "", barangay: profile?.barangay || null, source: "manual" }, pickupDetails: "", destinationMode: "manual", destinationAddress: "", description: "", vulnerableGroups: { seniorCitizen: false, pwd: false, pregnantPassenger: false, child: false, otherAssistance: false }, accessibilityNotes: "", additionalNotes: "" });

const FieldLabel = ({ children }) => <Text style={styles.label}>{children}</Text>;

export default function ResidentRequestForm({ visible, onClose, uid, residentName, profile, onCreated }) {
  const initial = useMemo(() => newForm(profile, residentName), [profile, residentName]);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState({ message: "", tone: "info" });
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successReference, setSuccessReference] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const submittingRef = useRef(false);
  const { locating, detectLocation } = useCurrentLocation();

  useEffect(() => { if (visible) { setForm(newForm(profile, residentName)); setErrors({}); setFeedback({ message: "", tone: "info" }); setReviewing(false); setSuccessReference(""); } }, [profile, residentName, visible]);
  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setPickup = (patch) => setForm((current) => ({ ...current, pickup: { ...current.pickup, ...patch } }));

  const useGps = async () => {
    setFeedback({ message: "We use your location only to fill this pickup field. SakayNa does not track you in the background.", tone: "info" });
    const result = await detectLocation();
    if (result.location) { setPickup(result.location); if (result.location.barangay) setValue("barangay", result.location.barangay); setFeedback({ message: result.warning || "Current location added. Add a landmark to make pickup easier.", tone: result.warning ? "warning" : "success" }); }
    else setFeedback({ message: result.error, tone: "warning" });
  };

  const openReview = () => {
    const clean = sanitizeRequestForm(form);
    const nextErrors = validateResidentRequest(clean);
    setForm(clean); setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setFeedback({ message: "Review the highlighted request details before continuing.", tone: "error" }); return; }
    setFeedback({ message: "", tone: "info" }); setReviewing(true);
  };

  const submit = async () => {
    if (saving || !uid) return;
    setSaving(true); setFeedback({ message: "", tone: "info" });
    try { const created = await createResidentRequest({ uid, residentName, form }); setSuccessReference(created.reference); onCreated?.(created); }
    catch { setFeedback({ message: "Your request could not be sent. Please check your connection and try again.", tone: "error" }); }
    finally { submittingRef.current = false; setSaving(false); }
  };

  const close = () => { if (!saving) onClose(); };
  return <><Modal visible={visible} transparent animationType="slide" onRequestClose={close}><View style={styles.overlay}><View style={styles.card}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close transport request" style={styles.close} onPress={close}><Text style={styles.closeText}>X</Text></TouchableOpacity>{successReference ? <View style={styles.success}><Text style={styles.title}>Request sent</Text><Text style={styles.successTitle}>Your reference is {successReference}</Text><Text style={styles.subtitle}>Dispatch has received the request. Follow its status from Request History. SakayNa is not a replacement for official emergency hotlines.</Text><AppButton label="Done" onPress={close} style={styles.submit} /></View> : reviewing ? <><Text style={styles.title}>Review request</Text><Text style={styles.subtitle}>Confirm these details before SakayNa sends them to dispatch.</Text><View style={styles.review}><Text style={styles.reviewLabel}>Category</Text><Text style={styles.reviewValue}>{form.category}</Text><Text style={styles.reviewLabel}>Service and passenger</Text><Text style={styles.reviewValue}>{form.serviceType} | {form.passengerCapacity}</Text><Text style={styles.reviewLabel}>Pickup</Text><Text style={styles.reviewValue}>{form.pickup.address}, {form.pickupDetails}</Text><Text style={styles.reviewLabel}>Destination</Text><Text style={styles.reviewValue}>{form.destinationMode === "nearest-facility" ? "Nearest appropriate facility" : form.destinationMode === "no-destination" ? "No destination provided" : form.destinationAddress}</Text><Text style={styles.reviewLabel}>Contact</Text><Text style={styles.reviewValue}>{form.passengerName} | {form.contactNumber}</Text><Text style={styles.reviewLabel}>Transport need</Text><Text style={styles.reviewValue}>{form.description}</Text></View><FeedbackMessage message="The priority shown to dispatch is based on your selected request type. Dispatch confirms operational priority." tone="info" /><View style={styles.actions}><AppButton label="Back" variant="secondary" onPress={() => setReviewing(false)} style={styles.button} /><AppButton label="Submit request" loading={saving} onPress={submit} style={styles.button} /></View></> : <><Text style={styles.title}>Transport request</Text><Text style={styles.subtitle}>Provide accurate details so dispatch can coordinate a safe ride. For immediate danger, contact official emergency services.</Text><FeedbackMessage message={feedback.message} tone={feedback.tone} />
<FieldLabel>Request category</FieldLabel><Dropdown style={styles.dropdown} data={categoryOptions} labelField="label" valueField="value" value={form.category} onChange={(item) => setValue("category", item.value)} placeholder="Choose category" />{errors.category ? <Text style={styles.error}>{errors.category}</Text> : null}
<FieldLabel>Service type</FieldLabel><Dropdown style={styles.dropdown} data={SERVICE_TYPE_OPTIONS} labelField="label" valueField="value" value={form.serviceType} onChange={(item) => setValue("serviceType", item.value)} placeholder="Choose service type" />{errors.serviceType ? <Text style={styles.error}>{errors.serviceType}</Text> : null}
<FieldLabel>Passenger count</FieldLabel><Dropdown style={styles.dropdown} data={PASSENGER_CAPACITY_OPTIONS} labelField="label" valueField="value" value={form.passengerCapacity} onChange={(item) => setValue("passengerCapacity", item.value)} placeholder="Choose passenger count" />{errors.passengerCapacity ? <Text style={styles.error}>{errors.passengerCapacity}</Text> : null}
<FieldLabel>Passenger name</FieldLabel><TextInput style={styles.input} value={form.passengerName} onChangeText={(value) => setValue("passengerName", value)} placeholder="Passenger's full name" maxLength={80} />{errors.passengerName ? <Text style={styles.error}>{errors.passengerName}</Text> : null}
<FieldLabel>Contact number</FieldLabel><TextInput style={styles.input} value={form.contactNumber} onChangeText={(value) => setValue("contactNumber", value)} placeholder="09XXXXXXXXX" keyboardType="phone-pad" maxLength={16} />{errors.contactNumber ? <Text style={styles.error}>{errors.contactNumber}</Text> : null}
<FieldLabel>Pickup barangay</FieldLabel><Dropdown style={styles.dropdown} data={TOLEDO_BARANGAY_OPTIONS} labelField="label" valueField="value" value={form.barangay} search searchPlaceholder="Search barangay" onChange={(item) => { setValue("barangay", item.value); setPickup({ barangay: item.value, address: form.pickup.address || item.value, source: "manual" }); }} placeholder="Choose barangay" />{errors.barangay ? <Text style={styles.error}>{errors.barangay}</Text> : null}
<FieldLabel>Pickup location</FieldLabel><TextInput style={styles.input} value={form.pickup.address} onChangeText={(value) => setPickup({ address: value, source: "manual" })} placeholder="Street, purok, landmark, or exact address" maxLength={180} /><View style={styles.locationActions}><AppButton label={locating ? "Detecting location" : "Use current location"} loading={locating} onPress={useGps} variant="secondary" style={styles.locationButton} /><AppButton label="Place map pin" onPress={() => setMapOpen(true)} variant="secondary" style={styles.locationButton} /></View>{errors.pickup ? <Text style={styles.error}>{errors.pickup}</Text> : null}
<FieldLabel>Exact pickup details</FieldLabel><TextInput style={[styles.input, styles.area]} value={form.pickupDetails} onChangeText={(value) => setValue("pickupDetails", value)} placeholder="Example: blue gate beside the chapel" multiline textAlignVertical="top" maxLength={300} />{errors.pickupDetails ? <Text style={styles.error}>{errors.pickupDetails}</Text> : null}
<FieldLabel>Destination</FieldLabel><Dropdown style={styles.dropdown} data={form.category === "Emergency Request" ? destinationOptions : destinationOptions.slice(0, 2)} labelField="label" valueField="value" value={form.destinationMode} onChange={(item) => setValue("destinationMode", item.value)} placeholder="Choose destination option" />{form.destinationMode === "manual" ? <TextInput style={styles.input} value={form.destinationAddress} onChangeText={(value) => setValue("destinationAddress", value)} placeholder="Destination address or location description" maxLength={180} /> : null}{errors.destination ? <Text style={styles.error}>{errors.destination}</Text> : null}
<FieldLabel>Reason for transport</FieldLabel><TextInput style={[styles.input, styles.area]} value={form.description} onChangeText={(value) => setValue("description", value)} placeholder="Briefly describe the transport need" multiline textAlignVertical="top" maxLength={500} />{errors.description ? <Text style={styles.error}>{errors.description}</Text> : null}
<FieldLabel>Assistance needs</FieldLabel>{VULNERABLE_GROUP_OPTIONS.map((option) => <View key={option.key} style={styles.toggleRow}><Text style={styles.toggleText}>{option.label}</Text><Switch value={form.vulnerableGroups[option.key]} onValueChange={(value) => setValue("vulnerableGroups", { ...form.vulnerableGroups, [option.key]: value })} trackColor={{ false: COLORS.disabled, true: COLORS.primary }} /></View>)}<TextInput style={[styles.input, styles.area]} value={form.accessibilityNotes} onChangeText={(value) => setValue("accessibilityNotes", value)} placeholder="Accessibility or medical notes (optional)" multiline textAlignVertical="top" maxLength={500} /><TextInput style={[styles.input, styles.area]} value={form.additionalNotes} onChangeText={(value) => setValue("additionalNotes", value)} placeholder="Additional notes (optional)" multiline textAlignVertical="top" maxLength={500} />
<View style={styles.actions}><AppButton label="Cancel" variant="secondary" onPress={close} style={styles.button} /><AppButton label="Review request" onPress={openReview} style={styles.button} /></View></>}</ScrollView></View></View></Modal><MapLocationModal visible={mapOpen} initialLocation={form.pickup.latitude !== null ? form.pickup : null} onClose={() => setMapOpen(false)} onConfirm={(location) => { setPickup(location); setMapOpen(false); }} /></>;
}

const styles = StyleSheet.create({ overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(13,31,24,.62)" }, card: { maxHeight: "94%", backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg }, content: { padding: SPACING.lg, paddingBottom: 32 }, close: { alignSelf: "flex-end", width: 36, height: 36, alignItems: "center", justifyContent: "center" }, closeText: { fontSize: 17, fontWeight: "800", color: COLORS.text }, title: { color: COLORS.text, fontSize: 23, fontWeight: "800" }, subtitle: { marginTop: 6, color: COLORS.mutedText, lineHeight: 20 }, label: { marginTop: SPACING.lg, color: COLORS.text, fontSize: 14, fontWeight: "700" }, dropdown: { minHeight: 50, marginTop: 7, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm }, input: { minHeight: 50, marginTop: 7, paddingHorizontal: SPACING.md, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, color: COLORS.text }, area: { minHeight: 88 }, error: { marginTop: 5, color: COLORS.emergency, fontSize: 12, lineHeight: 17 }, locationActions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm }, locationButton: { flex: 1, minHeight: 44, paddingHorizontal: 8 }, toggleRow: { minHeight: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: COLORS.border }, toggleText: { color: COLORS.text, fontSize: 14 }, actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.xl }, button: { flex: 1 }, review: { marginTop: SPACING.lg, padding: SPACING.md, backgroundColor: COLORS.surfaceMuted, borderRadius: RADIUS.sm }, reviewLabel: { marginTop: SPACING.sm, color: COLORS.subtleText, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }, reviewValue: { marginTop: 2, color: COLORS.text, lineHeight: 20 }, success: { minHeight: 360, justifyContent: "center" }, successTitle: { marginTop: SPACING.lg, color: COLORS.success, fontSize: 18, fontWeight: "800" }, submit: { marginTop: SPACING.xl } });
