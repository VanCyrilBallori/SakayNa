import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { collection, doc, limit, onSnapshot, query } from "firebase/firestore";

import AppButton from "../../../components/ui/AppButton";
import FeedbackMessage from "../../../components/ui/FeedbackMessage";
import { ACCOUNT_STATUSES, FIRESTORE_COLLECTIONS, ROLE_OPTIONS, ROLES, VEHICLE_MAINTENANCE_STATUSES } from "../../../constants/app";
import { db } from "../../../firebase";
import { TOLEDO_BARANGAY_OPTIONS } from "../../../lib/barangays";
import {
  buildCsv,
  changeAccountStatus,
  changeUserRole,
  createStaffInvitation,
  getDate,
  getProfileName,
  getUserMissionConflicts,
  requestPermanentDeletion,
  reviewDriverApplication,
  saveMaintenanceRecord,
  saveSystemSettings,
  updateDispatcherScope,
} from "../services/trustedAdminOperationsService";

const DEFAULT_MAINTENANCE = { maintenanceType: "", description: "", reportedIssues: "", serviceProvider: "", cost: "", odometer: "", status: "Reported", startedAt: "", completedAt: "", nextServiceDate: "" };
const toDateLabel = (value) => {
  const date = getDate(value);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "Not available";
};
const statusOf = (user) => user.accountStatus || user.approvalStatus || ACCOUNT_STATUSES.ACTIVE;

export default function AdminOperationsPanel({ users, applications, vehicles, assignments, requests, adminId, adminName, theme }) {
  const [view, setView] = useState("Accounts");
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [reason, setReason] = useState("");
  const [nextStatus, setNextStatus] = useState(ACCOUNT_STATUSES.DEACTIVATED);
  const [nextRole, setNextRole] = useState(ROLES.RESIDENT);
  const [scopeAreas, setScopeAreas] = useState([]);
  const [scopePhone, setScopePhone] = useState("");
  const [scopeOffice, setScopeOffice] = useState("");
  const [reviewingApplication, setReviewingApplication] = useState(null);
  const [reviewDecision, setReviewDecision] = useState("Approved");
  const [reviewReason, setReviewReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [invitationOpen, setInvitationOpen] = useState(false);
  const [invitation, setInvitation] = useState({ email: "", displayName: "", barangay: "", serviceAreas: [], operationalPhone: "" });
  const [maintenanceVehicle, setMaintenanceVehicle] = useState(null);
  const [maintenance, setMaintenance] = useState(DEFAULT_MAINTENANCE);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({ supportedBarangays: [], requestCategories: [], vehicleTypes: [], publicOfficePhone: "", maintenanceReminderDays: "30" });

  useEffect(() => {
    const unsubscribeLogs = onSnapshot(query(collection(db, FIRESTORE_COLLECTIONS.ACTIVITY_LOGS), limit(50)), (snapshot) => {
      setLogs(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((first, second) => (getDate(second.createdAt)?.getTime() || 0) - (getDate(first.createdAt)?.getTime() || 0)));
    }, () => setError("Activity logs could not be loaded. Check the deployed Firestore rules."));
    const unsubscribeSettings = onSnapshot(doc(db, FIRESTORE_COLLECTIONS.SYSTEM_SETTINGS, "operational"), (snapshot) => {
      if (snapshot.exists()) setSettings((current) => ({ ...current, ...snapshot.data(), maintenanceReminderDays: String(snapshot.data().maintenanceReminderDays || 30) }));
    }, () => setError("Operational settings could not be loaded. Check the deployed Firestore rules."));
    return () => { unsubscribeLogs(); unsubscribeSettings(); };
  }, []);

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((user) => {
      const haystack = [getProfileName(user), user.id, user.email, user.phone, user.phoneNumber, user.barangay, user.office, ...(user.serviceAreas || [])].filter(Boolean).join(" ").toLowerCase();
      return (filterRole === "All" || user.role === filterRole) && (filterStatus === "All" || statusOf(user) === filterStatus) && (!needle || haystack.includes(needle));
    });
  }, [filterRole, filterStatus, search, users]);
  const pendingApplications = useMemo(() => applications.filter((application) => ["Pending", "Under Review", "Correction Requested"].includes(application.status || application.approvalStatus)), [applications]);
  const activeMissions = assignments.filter((assignment) => ["Assigned", "In Progress", "Accepted", "En Route", "Arrived", "Picked Up"].includes(assignment.status || assignment.missionStatus));
  const vehicleMaintenance = useMemo(() => vehicles.filter((vehicle) => vehicle.maintenanceStatus && vehicle.maintenanceStatus !== "Completed").length, [vehicles]);

  const openUser = (user) => {
    setSelectedUser(user);
    setReason("");
    setNextStatus(statusOf(user) === ACCOUNT_STATUSES.DEACTIVATED ? ACCOUNT_STATUSES.ACTIVE : ACCOUNT_STATUSES.DEACTIVATED);
    setNextRole(user.role || ROLES.RESIDENT);
    setScopeAreas(user.serviceAreas || []);
    setScopePhone(user.operationalPhone || "");
    setScopeOffice(user.office || "");
  };
  const run = async (work, success) => {
    setBusy(true); setError(""); setMessage("");
    try { await work(); setMessage(success); } catch (operationError) { setError(operationError?.message || "The requested change could not be completed."); } finally { setBusy(false); }
  };
  const confirm = (title, copy, action) => Alert.alert(title, copy, [{ text: "Cancel", style: "cancel" }, { text: "Confirm", style: "destructive", onPress: action }]);
  const exportRequests = () => {
    const rows = [["Request ID", "Status", "Priority", "Barangay", "Submitted", "Completed"]].concat(requests.slice(0, 200).map((request) => [request.id, request.status || "Pending", request.priorityLevel || request.level || "Not specified", request.barangay || "Not specified", toDateLabel(request.createdAt), toDateLabel(request.completedAt)]));
    const csv = buildCsv({ title: "SakayNa Request Summary", generatedBy: adminName, filters: "Latest 200 loaded request records", rows });
    if (Platform.OS !== "web" || typeof document === "undefined") { setError("CSV download is available on web. Native file sharing is deferred until an Expo-compatible sharing package is configured."); return; }
    try { const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `sakayna-request-summary-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url); setMessage("CSV report downloaded. Spreadsheet formula characters were neutralized."); } catch { setError("The browser blocked the CSV download. Please allow downloads and retry."); }
  };

  const chip = (label, active, onPress) => <TouchableOpacity key={label} style={[styles.chip, { borderColor: active ? "#06774B" : theme.border, backgroundColor: active ? "#06774B" : theme.surface }]} onPress={onPress}><Text style={[styles.chipText, { color: active ? "#FFFFFF" : theme.text }]}>{label}</Text></TouchableOpacity>;
  const card = (children, key) => <View key={key} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>;

  const renderAccounts = () => <>
    <Text style={[styles.title, { color: theme.text }]}>Account Operations</Text>
    <Text style={[styles.copy, { color: theme.mutedText }]}>The list is limited to the profiles already loaded by the Admin console. Passwords, tokens, and private documents are never displayed here.</Text>
    <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.border }]} value={search} onChangeText={setSearch} placeholder="Name, UID, phone, email, barangay..." placeholderTextColor={theme.subtleText} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{["All", ...ROLE_OPTIONS].map((item) => chip(item, filterRole === item, () => setFilterRole(item)))}</ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{["All", ...Object.values(ACCOUNT_STATUSES)].map((item) => chip(item, filterStatus === item, () => setFilterStatus(item)))}</ScrollView>
    <View style={styles.summaryRow}>{card(<><Text style={[styles.metric, { color: theme.text }]}>{filteredUsers.length}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>matching profiles</Text></>, "count")}{card(<><Text style={[styles.metric, { color: theme.text }]}>{activeMissions.length}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>active missions checked for conflicts</Text></>, "missions")}</View>
    {filteredUsers.slice(0, 100).map((user) => card(<><Text style={[styles.cardTitle, { color: theme.text }]}>{getProfileName(user)}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>{user.role || "No role"} | {statusOf(user)} | {user.barangay || user.office || "No operational area"}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>Phone: {user.operationalPhone || user.phoneNumber || user.phone || "Not provided"}</Text><AppButton label="Manage profile" variant="secondary" onPress={() => openUser(user)} style={styles.button} /></>, user.id))}
  </>;

  const renderApplications = () => <>
    <Text style={[styles.title, { color: theme.text }]}>Driver Application Review</Text>
    {pendingApplications.length ? pendingApplications.map((application) => card(<><Text style={[styles.cardTitle, { color: theme.text }]}>{application.fullName || application.email || "Driver applicant"}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>Status: {application.status || application.approvalStatus || "Pending"} | Applied: {toDateLabel(application.createdAt)}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>Phone: {application.phone || "Not provided"} | License: {application.licenseNumber || "Not provided"}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>Vehicle preference: {application.useOwnVehicle ? "Driver-owned" : "Needs city/barangay vehicle"}</Text><AppButton label="Review application" onPress={() => { setReviewingApplication(application); setReviewDecision("Approved"); setReviewReason(""); setReviewNotes(""); }} style={styles.button} /></>, application.id)) : card(<Text style={[styles.copy, { color: theme.mutedText }]}>No pending Driver applications. Final decisions remain stored for review history.</Text>, "empty")}
  </>;

  const renderStaff = () => <>
    <Text style={[styles.title, { color: theme.text }]}>Staff Invitations</Text>
    <Text style={[styles.copy, { color: theme.mutedText }]}>An invitation is a pending Phase 8 handoff record only. It does not create an Authentication account or a working login.</Text>
    <AppButton label="Create Dispatcher invitation" onPress={() => setInvitationOpen(true)} style={styles.button} />
  </>;

  const renderVehicles = () => <>
    <Text style={[styles.title, { color: theme.text }]}>Maintenance Oversight</Text>
    <Text style={[styles.copy, { color: theme.mutedText }]}>Vehicles with unresolved maintenance: {vehicleMaintenance}. A vehicle is not returned to service automatically when maintenance is completed.</Text>
    {vehicles.map((vehicle) => card(<><Text style={[styles.cardTitle, { color: theme.text }]}>{vehicle.name || vehicle.id}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>{vehicle.plateNumber || "No plate"} | Status: {vehicle.status || "Available"} | Maintenance: {vehicle.maintenanceStatus || "None recorded"}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>Next service: {toDateLabel(vehicle.nextMaintenanceDate)}</Text><AppButton label="Add maintenance record" variant="secondary" onPress={() => { setMaintenanceVehicle(vehicle); setMaintenance(DEFAULT_MAINTENANCE); }} style={styles.button} /></>, vehicle.id))}
  </>;

  const renderReports = () => <>
    <Text style={[styles.title, { color: theme.text }]}>Reports And Analytics</Text>
    <Text style={[styles.copy, { color: theme.mutedText }]}>Metrics are calculated from the latest loaded records only. Records without valid timestamps are excluded from time-based calculations.</Text>
    <View style={styles.summaryRow}>{card(<><Text style={[styles.metric, { color: theme.text }]}>{requests.filter((item) => item.status === "Completed").length}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>completed requests</Text></>, "completed")}{card(<><Text style={[styles.metric, { color: theme.text }]}>{requests.filter((item) => item.status === "Cancelled").length}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>cancelled requests</Text></>, "cancelled")}</View>
    <Text style={[styles.cardTitle, { color: theme.text }]}>Requests by priority</Text>
    {["Emergency", "Urgent", "Non-Urgent", "Planned"].map((priority) => <Text key={priority} style={[styles.copy, { color: theme.mutedText }]}>{priority}: {requests.filter((item) => (item.priorityLevel || item.level) === priority).length}</Text>)}
    <AppButton label="Download request CSV (web)" onPress={exportRequests} style={styles.button} />
  </>;

  const renderSettings = () => <>
    <Text style={[styles.title, { color: theme.text }]}>Operational Settings</Text>
    <Text style={[styles.copy, { color: theme.mutedText }]}>Only non-security display and form options are stored here. Firebase credentials, security rules, and environment variables are never editable in this screen.</Text>
    <Text style={[styles.label, { color: theme.text }]}>Public office phone</Text>
    <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.border }]} value={settings.publicOfficePhone} onChangeText={(value) => setSettings((current) => ({ ...current, publicOfficePhone: value }))} keyboardType="phone-pad" />
    <Text style={[styles.label, { color: theme.text }]}>Maintenance reminder days</Text>
    <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.border }]} value={String(settings.maintenanceReminderDays || "")} onChangeText={(value) => setSettings((current) => ({ ...current, maintenanceReminderDays: value }))} keyboardType="number-pad" />
    <Text style={[styles.copy, { color: theme.mutedText }]}>Supported barangays currently saved: {(settings.supportedBarangays || []).length}. Barangay selection remains limited to the approved Toledo options in the Admin workflow.</Text>
    <AppButton label="Save operational settings" loading={busy} onPress={() => run(() => saveSystemSettings({ adminId, settings }), "Operational settings saved.")} style={styles.button} />
  </>;

  const renderLogs = () => <>
    <Text style={[styles.title, { color: theme.text }]}>Activity Log</Text>
    <Text style={[styles.copy, { color: theme.mutedText }]}>These are client-generated, append-only operational records. They are useful for visibility but are not tamper-proof; trusted audit logging remains Phase 8.</Text>
    {logs.length ? logs.map((log) => card(<><Text style={[styles.cardTitle, { color: theme.text }]}>{log.action || "Administrative action"}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>{log.summary || "No summary"}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>{toDateLabel(log.createdAt)} | Actor: {log.actorId || "Not available"}</Text></>, log.id)) : card(<Text style={[styles.copy, { color: theme.mutedText }]}>No activity records are available yet.</Text>, "logs-empty")}
  </>;

  const viewContent = { Accounts: renderAccounts, Applications: renderApplications, Invitations: renderStaff, Maintenance: renderVehicles, Reports: renderReports, Settings: renderSettings, Logs: renderLogs }[view];
  return <>
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nav}>{["Accounts", "Applications", "Invitations", "Maintenance", "Reports", "Settings", "Logs"].map((item) => chip(item, view === item, () => setView(item)))}</ScrollView>
      <FeedbackMessage message={error} tone="error" />
      <FeedbackMessage message={message} tone="success" />
      {viewContent()}
    </View>

    <Modal visible={Boolean(selectedUser)} transparent animationType="fade" onRequestClose={() => setSelectedUser(null)}>
      <View style={styles.overlay}><ScrollView contentContainerStyle={[styles.modal, { backgroundColor: theme.surface }]}>
        <Text style={[styles.title, { color: theme.text }]}>{selectedUser ? getProfileName(selectedUser) : "Account"}</Text>
        <Text style={[styles.copy, { color: theme.mutedText }]}>Authentication is not disabled by this client. Deactivation changes only the Firestore profile access state and preserves operational history.</Text>
        <Text style={[styles.label, { color: theme.text }]}>Administrative reason</Text><TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.border }]} value={reason} onChangeText={setReason} multiline placeholder="Required for lifecycle and role changes" placeholderTextColor={theme.subtleText} />
        <Text style={[styles.label, { color: theme.text }]}>Account status</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{Object.values(ACCOUNT_STATUSES).map((item) => chip(item, nextStatus === item, () => setNextStatus(item)))}</ScrollView>
        <AppButton label={`Apply status: ${nextStatus}`} loading={busy} onPress={() => confirm("Confirm account status", `Update this profile to ${nextStatus}? Active Driver missions must be resolved first.`, () => run(() => changeAccountStatus({ adminId, targetUser: selectedUser, nextStatus, reason, activeAssignments: assignments }), "Account status updated."))} style={styles.button} />
        <Text style={[styles.label, { color: theme.text }]}>Role</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{ROLE_OPTIONS.map((item) => chip(item, nextRole === item, () => setNextRole(item)))}</ScrollView>
        <AppButton label={`Change role to ${nextRole}`} variant="secondary" loading={busy} onPress={() => confirm("Confirm role change", "This updates the Firestore profile role only. Custom claims remain Phase 8.", () => run(() => changeUserRole({ adminId, targetUser: selectedUser, nextRole, reason, activeAssignments: assignments }), "Role updated."))} style={styles.button} />
        {selectedUser?.role === ROLES.DISPATCHER ? <><Text style={[styles.label, { color: theme.text }]}>Dispatcher office</Text><TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.border }]} value={scopeOffice} onChangeText={setScopeOffice} /><Text style={[styles.label, { color: theme.text }]}>Operational phone</Text><TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.border }]} value={scopePhone} onChangeText={setScopePhone} keyboardType="phone-pad" /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{TOLEDO_BARANGAY_OPTIONS.map((item) => chip(item.label, scopeAreas.includes(item.value), () => setScopeAreas((current) => current.includes(item.value) ? current.filter((value) => value !== item.value) : [...current, item.value])))}</ScrollView><AppButton label="Save Dispatcher scope" variant="secondary" loading={busy} onPress={() => run(() => updateDispatcherScope({ adminId, targetUser: selectedUser, serviceAreas: scopeAreas, operationalPhone: scopePhone, office: scopeOffice }), "Dispatcher scope updated.")} style={styles.button} /></> : null}
        <Text style={[styles.copy, { color: theme.mutedText }]}>Active mission conflicts: {selectedUser ? getUserMissionConflicts(selectedUser.id, assignments).length : 0}</Text>
        <AppButton label="Request permanent deletion" variant="danger" loading={busy} onPress={() => confirm("Request permanent deletion", "This creates a pending Phase 8 backend request. It does not delete Authentication or Firestore data now.", () => run(() => requestPermanentDeletion({ adminId, targetUser: selectedUser, reason }), "Permanent deletion request queued for backend review."))} style={styles.button} />
        <AppButton label="Close" variant="secondary" onPress={() => setSelectedUser(null)} style={styles.button} />
      </ScrollView></View>
    </Modal>

    <Modal visible={Boolean(reviewingApplication)} transparent animationType="fade" onRequestClose={() => setReviewingApplication(null)}><View style={styles.overlay}><ScrollView contentContainerStyle={[styles.modal, { backgroundColor: theme.surface }]}><Text style={[styles.title, { color: theme.text }]}>Review Driver Application</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{["Approved", "Rejected", "Under Review", "Correction Requested"].map((item) => chip(item, reviewDecision === item, () => setReviewDecision(item)))}</ScrollView><Text style={[styles.label, { color: theme.text }]}>Rejection reason</Text><TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.border }]} value={reviewReason} onChangeText={setReviewReason} multiline placeholder="Required when rejecting" placeholderTextColor={theme.subtleText} /><Text style={[styles.label, { color: theme.text }]}>Review notes</Text><TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.border }]} value={reviewNotes} onChangeText={setReviewNotes} multiline /><AppButton label={`Save ${reviewDecision}`} loading={busy} onPress={() => confirm("Confirm application review", `Mark this application ${reviewDecision}? Final decisions cannot be reversed by this client.`, () => run(async () => { await reviewDriverApplication({ adminId, applicationId: reviewingApplication.id, decision: reviewDecision, reason: reviewReason, notes: reviewNotes }); setReviewingApplication(null); }, `Application marked ${reviewDecision}.`))} style={styles.button} /><AppButton label="Close" variant="secondary" onPress={() => setReviewingApplication(null)} style={styles.button} /></ScrollView></View></Modal>

    <Modal visible={invitationOpen} transparent animationType="fade" onRequestClose={() => setInvitationOpen(false)}><View style={styles.overlay}><ScrollView contentContainerStyle={[styles.modal, { backgroundColor: theme.surface }]}><Text style={[styles.title, { color: theme.text }]}>Pending Dispatcher Invitation</Text><Text style={[styles.copy, { color: theme.mutedText }]}>This record does not create a Firebase Authentication user. Secure delivery and account provisioning remain Phase 8.</Text>{[["Display name", "displayName"], ["Email", "email"], ["Barangay", "barangay"], ["Operational phone", "operationalPhone"]].map(([label, key]) => <View key={key}><Text style={[styles.label, { color: theme.text }]}>{label}</Text><TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.border }]} value={invitation[key]} onChangeText={(value) => setInvitation((current) => ({ ...current, [key]: value }))} keyboardType={key === "email" ? "email-address" : key === "operationalPhone" ? "phone-pad" : "default"} autoCapitalize="none" /></View>)}<AppButton label="Create pending invitation" loading={busy} onPress={() => confirm("Create invitation", "This does not create a login account.", () => run(async () => { await createStaffInvitation({ adminId, ...invitation, intendedRole: ROLES.DISPATCHER }); setInvitationOpen(false); }, "Pending Dispatcher invitation created."))} style={styles.button} /><AppButton label="Close" variant="secondary" onPress={() => setInvitationOpen(false)} style={styles.button} /></ScrollView></View></Modal>

    <Modal visible={Boolean(maintenanceVehicle)} transparent animationType="fade" onRequestClose={() => setMaintenanceVehicle(null)}>
      <View style={styles.overlay}><ScrollView contentContainerStyle={[styles.modal, { backgroundColor: theme.surface }]}>
        <Text style={[styles.title, { color: theme.text }]}>Vehicle Maintenance</Text>
        <Text style={[styles.copy, { color: theme.mutedText }]}>{maintenanceVehicle?.name || maintenanceVehicle?.id}</Text>
        <Text style={[styles.label, { color: theme.text }]}>Maintenance type</Text>
        <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.border }]} value={maintenance.maintenanceType} onChangeText={(value) => setMaintenance((current) => ({ ...current, maintenanceType: value }))} />
        <Text style={[styles.label, { color: theme.text }]}>Description</Text>
        <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.border }]} value={maintenance.description} onChangeText={(value) => setMaintenance((current) => ({ ...current, description: value }))} multiline />
        <Text style={[styles.label, { color: theme.text }]}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {Object.values(VEHICLE_MAINTENANCE_STATUSES).map((item) => chip(item, maintenance.status === item, () => setMaintenance((current) => ({ ...current, status: item }))))}
        </ScrollView>
        <Text style={[styles.label, { color: theme.text }]}>Completed date (YYYY-MM-DD)</Text>
        <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.border }]} value={maintenance.completedAt} onChangeText={(value) => setMaintenance((current) => ({ ...current, completedAt: value }))} />
        <Text style={[styles.label, { color: theme.text }]}>Next service date (YYYY-MM-DD)</Text>
        <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.border }]} value={maintenance.nextServiceDate} onChangeText={(value) => setMaintenance((current) => ({ ...current, nextServiceDate: value }))} />
        <AppButton label="Save maintenance record" loading={busy} onPress={() => confirm("Save maintenance", "This appends a maintenance record and may mark the vehicle under maintenance. It will not erase assignment history.", () => run(async () => { await saveMaintenanceRecord({ adminId, vehicle: maintenanceVehicle, form: maintenance, activeAssignments: assignments }); setMaintenanceVehicle(null); }, "Maintenance record saved."))} style={styles.button} />
        <AppButton label="Close" variant="secondary" onPress={() => setMaintenanceVehicle(null)} style={styles.button} />
      </ScrollView></View>
    </Modal>  </>;
}

const styles = StyleSheet.create({
  nav: { gap: 8, paddingBottom: 14 }, row: { gap: 8, paddingVertical: 6 }, chip: { minHeight: 38, justifyContent: "center", paddingHorizontal: 12, borderRadius: 6, borderWidth: 1 }, chipText: { fontSize: 13, fontWeight: "700" }, title: { fontSize: 21, fontWeight: "800", marginTop: 8, marginBottom: 6 }, copy: { fontSize: 13, lineHeight: 19 }, label: { fontSize: 13, fontWeight: "800", marginTop: 12, marginBottom: 4 }, input: { minHeight: 44, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 }, card: { marginTop: 10, borderWidth: 1, borderRadius: 8, padding: 14, gap: 6 }, cardTitle: { fontSize: 16, fontWeight: "800" }, button: { marginTop: 10 }, summaryRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" }, metric: { fontSize: 28, fontWeight: "800" }, overlay: { flex: 1, justifyContent: "center", padding: 18, backgroundColor: "rgba(0,0,0,0.45)" }, modal: { width: "100%", maxHeight: "92%", borderRadius: 8, padding: 18 }
});