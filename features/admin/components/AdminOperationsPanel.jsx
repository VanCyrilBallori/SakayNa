import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";

import AppButton from "../../../components/ui/AppButton";
import FeedbackMessage from "../../../components/ui/FeedbackMessage";
import { ACCOUNT_STATUSES, FIRESTORE_COLLECTIONS, ROLE_OPTIONS, ROLES, VEHICLE_MAINTENANCE_STATUSES } from "../../../constants/app";
import { db } from "../../../firebase";
import { TOLEDO_BARANGAY_OPTIONS } from "../../../lib/barangays";
import { formatDay, formatWhen } from "../../../lib/dates";
import {
  buildCsv,
  changeAccountStatus,
  createDispatcherAccount,
  getAllowedNextStatuses,
  getDate,
  getProfileName,
  getUserMissionConflicts,
  requestPermanentDeletion,
  saveMaintenanceRecord,
  saveSystemSettings,
  updateDispatcherScope,
} from "../services/trustedAdminOperationsService";
import AdminReportsSection from "./AdminReportsSection";
import AdminSectionHeader from "./AdminSectionHeader";
import { CORNER, FONT, GREEN, NEUTRAL, SHADOW } from "../../../constants/design";

const EMPTY_DISPATCHER = { fullName: "", email: "", phoneNumber: "", temporaryPassword: "" };
const ADMIN_CHANGE_REFUSED = "This change was not allowed. You can only manage non-Admin accounts in your own barangay. Check that this account belongs to your barangay.";
const DEFAULT_MAINTENANCE ={ maintenanceType: "", description: "", reportedIssues: "", serviceProvider: "", cost: "", odometer: "", status: "Reported", startedAt: "", completedAt: "", nextServiceDate: "" };
// Only for the CSV download, which keeps its own date format (DESIGN.md "Dates and times").
const toDateLabel = (value) => {
  const date = getDate(value);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "Not available";
};
const statusOf = (user) => user.accountStatus || user.approvalStatus || ACCOUNT_STATUSES.ACTIVE;

// The six Operations views, shown as one row of tabs.
const VIEWS = ["Accounts", "Add Dispatcher", "Maintenance", "Reports", "Settings", "Logs"];

// Splits a list into rows of `size` cards, so every card in a row is the same width (like Admin Requests).
const toRows = (items, size) => {
  const rows = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
};

export default function AdminOperationsPanel({ users, vehicles, assignments, requests, requestsLoading = false, adminId, adminName, adminBarangay, canManageUser, theme }) {
  const [view, setView] = useState("Accounts");
  // Two cards per row on a wide window (DESIGN.md "Admin website exception"), one otherwise.
  const { width } = useWindowDimensions();
  const columns = width >= 1100 ? 2 : 1;
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [reason, setReason] = useState("");
  const [nextStatus, setNextStatus] = useState(ACCOUNT_STATUSES.DEACTIVATED);
  const [scopeAreas, setScopeAreas] = useState([]);
  const [scopePhone, setScopePhone] = useState("");
  const [scopeOffice, setScopeOffice] = useState("");
  const [newDispatcher, setNewDispatcher] = useState(EMPTY_DISPATCHER);
  const [maintenanceVehicle, setMaintenanceVehicle] = useState(null);
  const [maintenance, setMaintenance] = useState(DEFAULT_MAINTENANCE);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({ supportedBarangays: [], requestCategories: [], vehicleTypes: [], publicOfficePhone: "", maintenanceReminderDays: "30" });

  useEffect(() => {
    const unsubscribeLogs = onSnapshot(query(collection(db, FIRESTORE_COLLECTIONS.ACTIVITY_LOGS), orderBy("createdAt", "desc"), limit(50)), (snapshot) => {
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
  const vehicleMaintenance = useMemo(() => vehicles.filter((vehicle) => vehicle.maintenanceStatus && vehicle.maintenanceStatus !== "Completed").length, [vehicles]);
  const canManageSelectedUser = canManageUser(users.find((user) => user.id === selectedUser?.id));
  // The live copy of the open account (users updates by itself), so after a change the buttons fit the new status.
  const liveSelectedUser = selectedUser ? users.find((user) => user.id === selectedUser.id) ?? selectedUser : null;
  // Only the status changes that make sense from the current status (getAllowedNextStatuses). Empty for Pending
  // and Rejected: those are decided in Resident Verification / Driver Applications.
  const allowedStatuses = liveSelectedUser ? getAllowedNextStatuses(liveSelectedUser) : [];
  // When the allowed choices change (for example right after a change), the chosen one moves to the first allowed.
  const allowedKey = allowedStatuses.join(",");
  useEffect(() => {
    const choices = allowedKey ? allowedKey.split(",") : [];
    setNextStatus((current) => (choices.includes(current) ? current : choices[0] ?? ""));
  }, [allowedKey]);

  const openUser = (user) => {
    setError("");
    setMessage("");
    if (!canManageUser(user)) {
      setError(ADMIN_CHANGE_REFUSED);
      return;
    }
    setSelectedUser(user);
    setReason("");
    setNextStatus(getAllowedNextStatuses(user)[0] ?? "");
    setScopeAreas(user.serviceAreas || []);
    setScopePhone(user.operationalPhone || "");
    setScopeOffice(user.office || "");
  };
  const run = async (work, success, targetUser = null) => {
    setBusy(true); setError(""); setMessage("");
    try {
      if (targetUser && !canManageUser(users.find((user) => user.id === targetUser.id))) {
        throw new Error(ADMIN_CHANGE_REFUSED);
      }
      await work();
      setMessage(success);
    } catch (operationError) {
      setError(operationError?.code === "permission-denied" ? ADMIN_CHANGE_REFUSED : operationError?.message || "The requested change could not be completed.");
    } finally {
      setBusy(false);
    }
  };
  const confirm = (title, copy, action) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`${title}\n\n${copy}`)) {
        action();
      }
      return;
    }
    Alert.alert(title, copy, [{ text: "Cancel", style: "cancel" }, { text: "Confirm", style: "destructive", onPress: action }]);
  };
  const exportRequests = () => {
    const rows = [["Request ID", "Status", "Priority", "Barangay", "Submitted", "Completed"]].concat(requests.slice(0, 200).map((request) => [request.id, request.status || "Pending", request.priorityLevel || request.level || "Not specified", request.barangay || "Not specified", toDateLabel(request.createdAt), toDateLabel(request.completedAt)]));
    const csv = buildCsv({ title: "SakayNa Request Summary", generatedBy: adminName, filters: "Latest 200 loaded request records", rows });
    if (Platform.OS !== "web" || typeof document === "undefined") { setError("CSV download is available on web. Native file sharing is deferred until an Expo-compatible sharing package is configured."); return; }
    try { const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `sakayna-request-summary-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url); setMessage("CSV report downloaded. Spreadsheet formula characters were neutralized."); } catch { setError("The browser blocked the CSV download. Please allow downloads and retry."); }
  };

  const chip = (label, active, onPress) => <TouchableOpacity key={label} style={[styles.chip, { borderColor: active ? GREEN[600] : theme.border, backgroundColor: active ? GREEN[600] : theme.surface }]} onPress={onPress}><Text style={[styles.chipText, { color: active ? NEUTRAL[0] : theme.text }]}>{label}</Text></TouchableOpacity>;
  const card = (children, key) => <View key={key} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>;
  // Cards in rows of `columns`; empty places keep the last row's cards the same width as the others.
  const grid = (cards) => <View style={styles.grid}>{toRows(cards, columns).map((row, rowIndex) => (
    <View key={`row-${rowIndex}`} style={styles.gridRow}>
      {row.map((item) => <View key={item.key} style={styles.gridCell}>{item}</View>)}
      {Array.from({ length: columns - row.length }, (_, index) => <View key={`empty-${index}`} style={styles.gridCell} />)}
    </View>
  ))}</View>;
  // One tab in the row at the top: the open view is a green pill with white words (like the side menu).
  const tab = (label) => {
    const active = view === label;
    return <TouchableOpacity key={label} style={[styles.tab, active && styles.tabActive]} onPress={() => setView(label)} accessibilityRole="tab" accessibilityState={{ selected: active }}><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></TouchableOpacity>;
  };

  const renderAccounts = () => <>
    <Text style={[styles.title, { color: theme.text }]}>Account Operations</Text>
    <Text style={[styles.copy, { color: theme.mutedText }]}>The list is limited to the profiles already loaded by the Admin console. Passwords, tokens, and private documents are never displayed here.</Text>
    {/* Search, Role, Account status and the count on one line when there is room. */}
    <View style={styles.fieldsRow}>
      <View style={[styles.field, styles.searchField]}>
        <Text style={[styles.label, { color: theme.text }]}>Search</Text>
        <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: NEUTRAL[500] }]} value={search} onChangeText={setSearch} placeholder="Name, UID, phone, email, barangay..." placeholderTextColor={theme.subtleText} />
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.text }]}>Role</Text>
        <Dropdown fontFamily={FONT.regular}
          style={[styles.dropdown, { backgroundColor: theme.inputBg, borderColor: NEUTRAL[500] }]}
          containerStyle={[styles.dropdownContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}
          selectedTextStyle={[styles.dropdownText, { color: theme.text }]}
          itemTextStyle={[styles.dropdownText, { color: theme.text }]}
          activeColor={theme.softSurface}
          data={["All", ...ROLE_OPTIONS].map((item) => ({ label: item, value: item }))}
          labelField="label"
          valueField="value"
          value={filterRole}
          onChange={(item) => setFilterRole(item.value)}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.text }]}>Account status</Text>
        <Dropdown fontFamily={FONT.regular}
          style={[styles.dropdown, { backgroundColor: theme.inputBg, borderColor: NEUTRAL[500] }]}
          containerStyle={[styles.dropdownContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}
          selectedTextStyle={[styles.dropdownText, { color: theme.text }]}
          itemTextStyle={[styles.dropdownText, { color: theme.text }]}
          activeColor={theme.softSurface}
          data={["All", ...Object.values(ACCOUNT_STATUSES)].map((item) => ({ label: item, value: item }))}
          labelField="label"
          valueField="value"
          value={filterStatus}
          onChange={(item) => setFilterStatus(item.value)}
        />
      </View>

      <View style={[styles.field, styles.accountsCountBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.accountsCountText, { color: theme.text }]}>Accounts: {filteredUsers.length}</Text>
      </View>
    </View>
    {grid(filteredUsers.slice(0, 100).map((user) => card(<><Text style={[styles.cardTitle, { color: theme.text }]}>{getProfileName(user)}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>{user.role || "No role"} · {statusOf(user)} · {user.barangay || user.office || "No operational area"}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>Phone: {user.operationalPhone || user.phoneNumber || user.phone || "Not provided"}</Text>{!canManageUser(user) ? <Text style={[styles.copy, { color: theme.mutedText }]}>Other barangay: view only</Text> : null}<AppButton label="Manage profile" variant="secondary" disabled={!canManageUser(user)} onPress={() => openUser(user)} style={[styles.button, styles.pageButton, styles.listButton]} /></>, user.id)))}
  </>;

  const setDispatcherField = (key, value) => setNewDispatcher((current) => ({ ...current, [key]: value }));
  const createDispatcher = () => run(async () => {
    if (!adminBarangay) throw new Error(ADMIN_CHANGE_REFUSED);
    await createDispatcherAccount({ adminId, ...newDispatcher, barangay: adminBarangay });
    setNewDispatcher(EMPTY_DISPATCHER);
  }, `Dispatcher account created for ${newDispatcher.fullName.trim()}. Give them the temporary password privately, and tell them to tap Forgot password? on the login screen to set their own.`);

  // Forms are not wider than 560, so the boxes do not stretch across a wide screen.
  const renderStaff = () => <View style={styles.form}>
    <Text style={[styles.title, { color: theme.text }]}>Add Dispatcher</Text>
    <Text style={[styles.copy, { color: theme.mutedText }]}>Creates the login and profile for a new Dispatcher. You stay logged in. They log in with this email and the temporary password.</Text>
    <Text style={[styles.label, { color: theme.text }]}>Full name</Text>
    <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: NEUTRAL[500] }]} value={newDispatcher.fullName} onChangeText={(value) => setDispatcherField("fullName", value)} autoCapitalize="words" />
    <Text style={[styles.label, { color: theme.text }]}>Email</Text>
    <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: NEUTRAL[500] }]} value={newDispatcher.email} onChangeText={(value) => setDispatcherField("email", value)} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
    <Text style={[styles.label, { color: theme.text }]}>Phone number</Text>
    <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: NEUTRAL[500] }]} value={newDispatcher.phoneNumber} onChangeText={(value) => setDispatcherField("phoneNumber", value)} keyboardType="phone-pad" />
    <Text style={[styles.label, { color: theme.text }]}>Barangay</Text>
    <TextInput
      style={[styles.input, { color: theme.text, backgroundColor: theme.softSurface, borderColor: theme.border }]}
      value={adminBarangay || "No barangay set"}
      editable={false}
      accessibilityLabel="Dispatcher barangay: your Admin barangay, read only"
    />
    <Text style={[styles.copy, { color: theme.mutedText }]}>New Dispatchers belong to your barangay.</Text>
    <Text style={[styles.label, { color: theme.text }]}>Temporary password (at least 8 characters)</Text>
    <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: NEUTRAL[500] }]} value={newDispatcher.temporaryPassword} onChangeText={(value) => setDispatcherField("temporaryPassword", value)} autoCapitalize="none" autoCorrect={false} />
    <AppButton label="Create Dispatcher" loading={busy} disabled={!adminBarangay} onPress={createDispatcher} style={[styles.button, styles.pageButton]} />
  </View>;

  const renderVehicles = () => <>
    <Text style={[styles.title, { color: theme.text }]}>Maintenance Oversight</Text>
    <Text style={[styles.copy, { color: theme.mutedText }]}>Vehicles with unresolved maintenance: {vehicleMaintenance}. A vehicle is not returned to service automatically when maintenance is completed.</Text>
    {grid(vehicles.map((vehicle) => card(<><Text style={[styles.cardTitle, { color: theme.text }]}>{vehicle.name || vehicle.id}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>{vehicle.plateNumber || "No plate"} · Status: {vehicle.status || "Available"} · Maintenance: {vehicle.maintenanceStatus || "None recorded"}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>Next service: {formatDay(vehicle.nextMaintenanceDate)}</Text><AppButton label="Add maintenance record" variant="secondary" onPress={() => { setMaintenanceVehicle(vehicle); setMaintenance(DEFAULT_MAINTENANCE); }} style={[styles.button, styles.pageButton, styles.listButton]} /></>, vehicle.id)))}
  </>;

  const renderReports = () => <AdminReportsSection requests={requests} loading={requestsLoading} onDownload={exportRequests} />;

  const renderSettings = () => <View style={styles.form}>
    <Text style={[styles.title, { color: theme.text }]}>Operational Settings</Text>
    <Text style={[styles.copy, { color: theme.mutedText }]}>Only non-security display and form options are stored here. Firebase credentials, security rules, and environment variables are never editable in this screen.</Text>
    <Text style={[styles.label, { color: theme.text }]}>Public office phone</Text>
    <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: NEUTRAL[500] }]} value={settings.publicOfficePhone} onChangeText={(value) => setSettings((current) => ({ ...current, publicOfficePhone: value }))} keyboardType="phone-pad" />
    <Text style={[styles.label, { color: theme.text }]}>Maintenance reminder days</Text>
    <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: NEUTRAL[500] }]} value={String(settings.maintenanceReminderDays || "")} onChangeText={(value) => setSettings((current) => ({ ...current, maintenanceReminderDays: value }))} keyboardType="number-pad" />
    <Text style={[styles.copy, { color: theme.mutedText }]}>Supported barangays currently saved: {(settings.supportedBarangays || []).length}. Barangay selection remains limited to the approved Toledo options in the Admin workflow.</Text>
    <AppButton label="Save operational settings" loading={busy} onPress={() => run(() => saveSystemSettings({ adminId, settings }), "Operational settings saved.")} style={[styles.button, styles.pageButton]} />
  </View>;

  const renderLogs = () => <>
    <Text style={[styles.title, { color: theme.text }]}>Activity Log</Text>
    <Text style={[styles.copy, { color: theme.mutedText }]}>These are client-generated, append-only operational records. They are useful for visibility but are not tamper-proof; trusted audit logging remains Phase 8.</Text>
    {/* One white list with thin lines between entries, like Users (the summaries are long, so one column). */}
    {logs.length ? <View style={[styles.list, { backgroundColor: theme.surface, borderColor: theme.border }]}>{logs.map((log, index) => <View key={log.id} style={[styles.listRow, index > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}><Text style={[styles.cardTitle, { color: theme.text }]}>{log.action || "Administrative action"}</Text><Text style={[styles.copy, { color: theme.text }]}>{log.summary || "No summary"}</Text><Text style={[styles.copy, { color: theme.mutedText }]}>{formatWhen(log.createdAt)} · Actor: {log.actorId || "Not available"}</Text></View>)}</View> : <View style={styles.grid}>{card(<Text style={[styles.copy, { color: theme.mutedText }]}>No activity records are available yet.</Text>, "logs-empty")}</View>}
  </>;

  const viewContent = { Accounts: renderAccounts, "Add Dispatcher": renderStaff, Maintenance: renderVehicles, Reports: renderReports, Settings: renderSettings, Logs: renderLogs }[view];
  return <>
    <View>
      <View style={styles.sectionHeader}>
        <AdminSectionHeader icon="cog-outline" title="Operations" subtitle="Account status, Dispatchers, vehicle maintenance, reports, settings and the activity log." />
      </View>
      {/* One row of tabs in a light grey track; it wraps onto a second line on a narrow window. */}
      <View style={styles.tabs} accessibilityRole="tablist">{VIEWS.map(tab)}</View>
      <FeedbackMessage message={error} tone="error" />
      <FeedbackMessage message={message} tone="success" />
      {viewContent()}
    </View>

    <Modal visible={Boolean(selectedUser)} transparent animationType="fade" onRequestClose={() => setSelectedUser(null)}>
      <View style={styles.overlay}><ScrollView contentContainerStyle={[styles.modal, { backgroundColor: theme.surface }]}>
        <Text style={[styles.title, { color: theme.text }]}>{selectedUser ? getProfileName(selectedUser) : "Account"}</Text>
        <FeedbackMessage message={error} tone="error" />
        <FeedbackMessage message={message} tone="success" />
        {!canManageSelectedUser ? <Text style={[styles.copy, { color: theme.mutedText }]}>Other barangay: view only</Text> : null}
        <Text style={[styles.copy, { color: theme.mutedText }]}>Authentication is not disabled by this client. Deactivation changes only the Firestore profile access state and preserves operational history.</Text>
        <Text style={[styles.label, { color: theme.text }]}>Administrative reason</Text><TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: NEUTRAL[500] }]} value={reason} onChangeText={setReason} multiline placeholder="Required for lifecycle changes" placeholderTextColor={theme.subtleText} />
        {/* A Resident sees the reason on their home screen when their account is Rejected, Suspended or Disabled. */}
        {selectedUser?.role === ROLES.RESIDENT && [ACCOUNT_STATUSES.REJECTED, ACCOUNT_STATUSES.SUSPENDED, ACCOUNT_STATUSES.DISABLED].includes(nextStatus) ? (
          <Text style={[styles.copy, { color: theme.mutedText }]}>The resident will see this reason.</Text>
        ) : null}
        <Text style={[styles.label, { color: theme.text }]}>Account status</Text>
        {liveSelectedUser ? (
          <Text style={[styles.copy, { color: theme.mutedText }]}>
            Now: {statusOf(liveSelectedUser)}{statusOf(liveSelectedUser) === ACCOUNT_STATUSES.DISABLED ? " (treated as Suspended)" : ""}
          </Text>
        ) : null}
        {allowedStatuses.length ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{allowedStatuses.map((item) => chip(item, nextStatus === item, () => setNextStatus(item)))}</ScrollView>
            <AppButton label={`Apply status: ${nextStatus}`} loading={busy} disabled={!canManageSelectedUser} onPress={() => confirm("Confirm account status", `Update this profile to ${nextStatus}? Active Driver missions must be resolved first.`, () => run(() => changeAccountStatus({ adminId, targetUser: selectedUser, nextStatus, reason, activeAssignments: assignments }), "Account status updated.", selectedUser))} style={styles.button} />
          </>
        ) : (
          // Pending and Rejected are not changed here, so verification can't be skipped.
          <Text style={[styles.copy, { color: theme.mutedText }]}>
            {selectedUser?.role === ROLES.DRIVER
              ? "A Pending or Rejected driver is decided in Driver Applications, where the application documents are."
              : "A Pending or Rejected resident is decided in Resident Verification, where the proof of residency is."}
          </Text>
        )}
        {selectedUser?.role === ROLES.DISPATCHER ? <><Text style={[styles.label, { color: theme.text }]}>Dispatcher office</Text><TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: NEUTRAL[500] }]} value={scopeOffice} onChangeText={setScopeOffice} /><Text style={[styles.label, { color: theme.text }]}>Operational phone</Text><TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: NEUTRAL[500] }]} value={scopePhone} onChangeText={setScopePhone} keyboardType="phone-pad" /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{TOLEDO_BARANGAY_OPTIONS.map((item) => chip(item.label, scopeAreas.includes(item.value), () => setScopeAreas((current) => current.includes(item.value) ? current.filter((value) => value !== item.value) : [...current, item.value])))}</ScrollView><AppButton label="Save Dispatcher scope" variant="secondary" loading={busy} disabled={!canManageSelectedUser} onPress={() => run(() => updateDispatcherScope({ adminId, targetUser: selectedUser, serviceAreas: scopeAreas, operationalPhone: scopePhone, office: scopeOffice }), "Dispatcher scope updated.", selectedUser)} style={styles.button} /></> : null}
        <Text style={[styles.copy, { color: theme.mutedText }]}>Active mission conflicts: {selectedUser ? getUserMissionConflicts(selectedUser.id, assignments).length : 0}</Text>
        <Text style={[styles.copy, { color: theme.mutedText }]}>Permanent deletion is coming soon. It requires a trusted backend to remove the Firebase Authentication account; nothing is queued or deleted from here. Use Deactivated status above to revoke access today.</Text>
        <AppButton label="Permanent deletion (coming soon)" variant="danger" disabled onPress={() => confirm("Request permanent deletion", "This creates a pending Phase 8 backend request. It does not delete Authentication or Firestore data now.", () => run(() => requestPermanentDeletion({ adminId, targetUser: selectedUser, reason }), "Permanent deletion request queued for backend review."))} style={styles.button} />
        <AppButton label="Close" variant="secondary" onPress={() => setSelectedUser(null)} style={styles.button} />
      </ScrollView></View>
    </Modal>

    <Modal visible={Boolean(maintenanceVehicle)} transparent animationType="fade" onRequestClose={() => setMaintenanceVehicle(null)}>
      <View style={styles.overlay}><ScrollView contentContainerStyle={[styles.modal, { backgroundColor: theme.surface }]}>
        <Text style={[styles.title, { color: theme.text }]}>Vehicle Maintenance</Text>
        <Text style={[styles.copy, { color: theme.mutedText }]}>{maintenanceVehicle?.name || maintenanceVehicle?.id}</Text>
        <Text style={[styles.label, { color: theme.text }]}>Maintenance type</Text>
        <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: NEUTRAL[500] }]} value={maintenance.maintenanceType} onChangeText={(value) => setMaintenance((current) => ({ ...current, maintenanceType: value }))} />
        <Text style={[styles.label, { color: theme.text }]}>Description</Text>
        <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: NEUTRAL[500] }]} value={maintenance.description} onChangeText={(value) => setMaintenance((current) => ({ ...current, description: value }))} multiline />
        <Text style={[styles.label, { color: theme.text }]}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {Object.values(VEHICLE_MAINTENANCE_STATUSES).map((item) => chip(item, maintenance.status === item, () => setMaintenance((current) => ({ ...current, status: item }))))}
        </ScrollView>
        <Text style={[styles.label, { color: theme.text }]}>Completed date (YYYY-MM-DD)</Text>
        <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: NEUTRAL[500] }]} value={maintenance.completedAt} onChangeText={(value) => setMaintenance((current) => ({ ...current, completedAt: value }))} />
        <Text style={[styles.label, { color: theme.text }]}>Next service date (YYYY-MM-DD)</Text>
        <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: NEUTRAL[500] }]} value={maintenance.nextServiceDate} onChangeText={(value) => setMaintenance((current) => ({ ...current, nextServiceDate: value }))} />
        <AppButton label="Save maintenance record" loading={busy} onPress={() => confirm("Save maintenance", "This appends a maintenance record and may mark the vehicle under maintenance. It will not erase assignment history.", () => run(async () => { await saveMaintenanceRecord({ adminId, vehicle: maintenanceVehicle, form: maintenance, activeAssignments: assignments }); setMaintenanceVehicle(null); }, "Maintenance record saved."))} style={styles.button} />
        <AppButton label="Close" variant="secondary" onPress={() => setMaintenanceVehicle(null)} style={styles.button} />
      </ScrollView></View>
    </Modal>  </>;
}

// UI refresh (DESIGN.md "Style"): pill chips, 12-corner inputs, 16-corner cards and pop-up. Text at least 15.
// Layout and spacing: DESIGN.md "Admin website exception" (Task 3.19): tabs, cards in 2 columns, 40-tall list buttons and chips.
const styles = StyleSheet.create({
  sectionHeader: { marginBottom: 12 },
  // The tabs: a light grey pill track; the open tab is a green pill with white words.
  tabs: { alignSelf: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 4, padding: 4, marginBottom: 12, borderRadius: CORNER.pill, backgroundColor: NEUTRAL[100] },
  tab: { minHeight: 40, justifyContent: "center", paddingHorizontal: 16, borderRadius: CORNER.pill },
  tabActive: { backgroundColor: GREEN[600] },
  tabText: { fontSize: 15, fontFamily: FONT.semiBold, color: NEUTRAL[900] },
  tabTextActive: { color: NEUTRAL[0] },
  row: { gap: 8, paddingVertical: 6 },
  chip: { minHeight: 40, justifyContent: "center", paddingHorizontal: 14, borderRadius: CORNER.pill, borderWidth: 1 }, chipText: { fontSize: 15, fontFamily: FONT.semiBold },
  title: { fontSize: 21, lineHeight: 28, fontFamily: FONT.bold, marginBottom: 4 }, copy: { fontFamily: FONT.regular, fontSize: 15, lineHeight: 22 },
  label: { fontSize: 15, fontFamily: FONT.semiBold, marginTop: 12, marginBottom: 4 },
  input: { fontFamily: FONT.regular, minHeight: 44, borderWidth: 1.5, borderRadius: CORNER.input, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 },
  dropdown: { minHeight: 44, borderWidth: 1.5, borderRadius: CORNER.input, paddingHorizontal: 12 }, dropdownContainer: { borderWidth: 1, borderRadius: CORNER.input, overflow: "hidden" }, dropdownText: { fontFamily: FONT.regular, fontSize: 15 },
  fieldsRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginTop: 4 }, field: { flexGrow: 1, flexBasis: 160 }, searchField: { flexGrow: 2, flexBasis: 260 },
  accountsCountBox: { minHeight: 44, borderWidth: 1, borderRadius: CORNER.input, paddingHorizontal: 14, justifyContent: "center" }, accountsCountText: { fontSize: 15, fontFamily: FONT.bold },
  // Cards in rows of equal width (2 per row on a wide window); every card in a row is as tall as the tallest.
  grid: { marginTop: 12, gap: 12 }, gridRow: { flexDirection: "row", gap: 12, alignItems: "stretch" }, gridCell: { flex: 1, minWidth: 0 },
  card: { flexGrow: 1, borderWidth: 1, borderRadius: CORNER.card, padding: 12, gap: 6 }, cardTitle: { fontSize: 17, lineHeight: 22, fontFamily: FONT.bold },
  // The activity log: one white list box with thin lines between entries.
  list: { marginTop: 12, borderWidth: 1, borderRadius: CORNER.card, overflow: "hidden" }, listRow: { paddingVertical: 10, paddingHorizontal: 14, gap: 2 },
  form: { maxWidth: 560 },
  button: { marginTop: 10 }, pageButton: { alignSelf: "flex-start" }, listButton: { minHeight: 40, paddingHorizontal: 16, marginTop: "auto" },
  overlay: { flex: 1, justifyContent: "center", padding: 18, backgroundColor: "rgba(20, 33, 28, 0.55)" },
  modal: { width: "100%", maxHeight: "92%", borderRadius: CORNER.card, padding: 18, backgroundColor: NEUTRAL[0], ...SHADOW.level3 },
});
