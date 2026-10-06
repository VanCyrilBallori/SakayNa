import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { DESIGN_COLORS } from "../../../constants/design";
import { formatDate } from "../../../lib/dates";
import { getApprovalStatus, getProfilePhoto, getUserAddress, getUserName, getUserPhone } from "../utils/userFormatters";

// Account status pill colors (DESIGN.md: orange has dark words; red is only for emergencies, so no red here).
const STATUS_PILLS = {
  Active: { backgroundColor: DESIGN_COLORS.hallGreenDeep, color: DESIGN_COLORS.paperWhite },
  Approved: { backgroundColor: DESIGN_COLORS.hallGreenDeep, color: DESIGN_COLORS.paperWhite },
  Pending: { backgroundColor: DESIGN_COLORS.sakayOrange, color: DESIGN_COLORS.ink },
};
const OTHER_STATUS_PILL = { backgroundColor: DESIGN_COLORS.inkMuted, color: DESIGN_COLORS.paperWhite };

const ROLE_ICONS = {
  Resident: "home-outline",
  Driver: "steering",
  Dispatcher: "headset",
  Admin: "shield-account-outline",
};

// "LA" for "Lorna Abellana". Shown when the user has no profile photo.
const getInitials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

// "Bato, Toledo City" becomes "Bato": every barangay here is in Toledo City.
const getBarangayName = (user) => (user.barangay ? user.barangay.replace(", Toledo City", "") : "Not provided");

// One round choice with a count bubble in front of the word, like the Requests filters.
function RolePill({ label, count, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, selected && styles.pillSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${count}`}
    >
      <View style={[styles.countBubble, selected && styles.countBubbleSelected]}>
        <Text style={[styles.countText, selected && styles.countTextSelected]}>{count}</Text>
      </View>
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function UserRow({ user, wide, narrow, isFirst, openUserEditor, setSelectedSection }) {
  const name = getUserName(user);
  const photo = getProfilePhoto(user);
  const status = getApprovalStatus(user);
  const pill = STATUS_PILLS[status] || OTHER_STATUS_PILL;

  return (
    <View style={[styles.row, !wide && styles.rowStacked, !isFirst && styles.rowDivider]}>
      <View style={[styles.person, wide && styles.columnPerson]}>
        <View style={styles.avatar}>
          {photo ? <Image source={{ uri: photo }} style={styles.avatarImage} /> : <Text style={styles.initials}>{getInitials(name)}</Text>}
        </View>
        <View style={styles.cell}>
          <Text style={styles.name}>{name}</Text>
          <View style={styles.roleRow}>
            <MaterialCommunityIcons name={ROLE_ICONS[user.role] || "account-outline"} size={17} color={DESIGN_COLORS.hallGreen} />
            <Text style={styles.small}>{user.role || "No role"}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.cell, wide && styles.columnContact]}>
        {wide ? null : <Text style={styles.small}>Contact</Text>}
        <Text style={[styles.body, styles.phone]}>{getUserPhone(user)}</Text>
        <Text style={styles.small}>{user.email || "Not provided"}</Text>
      </View>

      <View style={[styles.cell, wide && styles.columnBarangay]}>
        {wide ? null : <Text style={styles.small}>Barangay</Text>}
        <Text style={styles.body}>{getBarangayName(user)}</Text>
        <Text style={styles.small}>{getUserAddress(user)}</Text>
      </View>

      <View style={[wide ? styles.columnStatus : styles.statusStacked]}>
        <View style={[styles.statusPill, { backgroundColor: pill.backgroundColor }]}>
          <Text style={[styles.statusPillText, { color: pill.color }]}>{status}</Text>
        </View>
        <Text style={styles.small}>Joined {formatDate(user.createdAt)}</Text>
      </View>

      <View style={[styles.actions, wide && styles.columnActions]}>
        <Pressable
          onPress={() => openUserEditor(user)}
          style={({ pressed }) => [styles.outlineButton, narrow && styles.buttonGrow, pressed && styles.outlineButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${name}`}
        >
          <MaterialCommunityIcons name="pencil-outline" size={18} color={DESIGN_COLORS.hallGreen} />
          <Text style={[styles.outlineButtonText, { color: DESIGN_COLORS.hallGreen }]}>Edit</Text>
        </Pressable>
        <Pressable
          onPress={() => setSelectedSection("Operations")}
          style={({ pressed }) => [styles.outlineButton, narrow && styles.buttonGrow, pressed && styles.outlineButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Change status of ${name} in Operations`}
        >
          <Text style={styles.outlineButtonText}>Change status</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color={DESIGN_COLORS.ink} />
        </Pressable>
      </View>
    </View>
  );
}

export default function AdminUsersSection({
  users,
  userRoleViews,
  userRoleView,
  setUserRoleView,
  isLoadingUsers,
  filteredUsers,
  usersError,
  userMessage,
  openUserEditor,
  setSelectedSection,
  atLimit,
  collectionLimit,
}) {
  const { width } = useWindowDimensions();
  // Big screen: one line per user with columns. Smaller screen: each user's details stack.
  const wide = width >= 1100;
  const narrow = width < 520;

  const countFor = (role) => (role === "All" ? users.length : users.filter((user) => user.role === role).length);

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <MaterialCommunityIcons name="account-group-outline" size={24} color={DESIGN_COLORS.paperWhite} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Users</Text>
          <Text style={styles.subtitle}>Everyone with a SakayNa account. Edit fixes contact details. Change status opens Operations.</Text>
        </View>
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.label}>Role</Text>
        <View style={styles.pills}>
          {userRoleViews.map((role) => (
            <RolePill key={role} label={role} count={countFor(role)} selected={userRoleView === role} onPress={() => setUserRoleView(role)} />
          ))}
        </View>
      </View>

      {userMessage ? <Text style={styles.successText}>{userMessage}</Text> : null}
      {usersError ? <Text style={styles.errorText}>{usersError}</Text> : null}

      {isLoadingUsers ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={DESIGN_COLORS.hallGreen} />
          <Text style={styles.body}>Loading registered users...</Text>
        </View>
      ) : filteredUsers.length ? (
        <View style={styles.list}>
          {wide ? (
            <View style={[styles.row, styles.listHeader]}>
              <Text style={[styles.columnPerson, styles.listHeaderText]}>Name and role</Text>
              <Text style={[styles.columnContact, styles.listHeaderText]}>Contact</Text>
              <Text style={[styles.columnBarangay, styles.listHeaderText]}>Barangay</Text>
              <Text style={[styles.columnStatus, styles.listHeaderText]}>Account status</Text>
              <View style={styles.columnActions} />
            </View>
          ) : null}

          {filteredUsers.map((user, index) => (
            <UserRow
              key={user.id}
              user={user}
              wide={wide}
              narrow={narrow}
              isFirst={index === 0 && !wide}
              openUserEditor={openUserEditor}
              setSelectedSection={setSelectedSection}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.label}>No users match this role.</Text>
          <Text style={styles.small}>Choose All to see everyone.</Text>
        </View>
      )}

      {atLimit ? <Text style={styles.small}>Showing the latest {collectionLimit} users. Older ones are not loaded.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: "100%", gap: 16, padding: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerBadge: { width: 48, height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: DESIGN_COLORS.hallGreen },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: DESIGN_COLORS.ink },
  subtitle: { marginTop: 2, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted },
  body: { fontSize: 17, lineHeight: 22, color: DESIGN_COLORS.ink },
  label: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  small: { fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.inkMuted },
  successText: { padding: 12, borderRadius: 16, overflow: "hidden", fontSize: 17, lineHeight: 24, fontWeight: "700", color: DESIGN_COLORS.hallGreenDeep, backgroundColor: DESIGN_COLORS.boardTint },
  errorText: { padding: 12, borderRadius: 16, overflow: "hidden", fontSize: 17, lineHeight: 24, fontWeight: "700", color: DESIGN_COLORS.emergencyRed, backgroundColor: DESIGN_COLORS.redTint },

  // Pill-shaped choices, like the Requests filters.
  filterGroup: { gap: 8 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 8,
    paddingRight: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  pillSelected: { borderColor: DESIGN_COLORS.hallGreen, backgroundColor: DESIGN_COLORS.hallGreen },
  pillText: { fontSize: 17, fontWeight: "600", color: DESIGN_COLORS.ink },
  pillTextSelected: { color: DESIGN_COLORS.paperWhite },
  countBubble: { minWidth: 32, height: 32, paddingHorizontal: 8, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: DESIGN_COLORS.boardTint },
  countBubbleSelected: { backgroundColor: DESIGN_COLORS.paperWhite },
  countText: { fontSize: 15, fontWeight: "800", color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },
  countTextSelected: { color: DESIGN_COLORS.hallGreenDeep },

  // The list: one white box with 24 corners, thin lines between users (like Emergency calls).
  list: { borderRadius: 24, borderWidth: 1, borderColor: DESIGN_COLORS.rule, overflow: "hidden", backgroundColor: DESIGN_COLORS.paperWhite },
  listHeader: { paddingVertical: 10, backgroundColor: DESIGN_COLORS.boardTint },
  listHeaderText: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.inkMuted },
  row: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 14, paddingHorizontal: 16 },
  rowStacked: { flexDirection: "column", alignItems: "stretch", gap: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: DESIGN_COLORS.rule },
  columnPerson: { flex: 1.2, minWidth: 0 },
  columnContact: { flex: 1.5, minWidth: 0 },
  columnBarangay: { flex: 1, minWidth: 0 },
  columnStatus: { width: 150, gap: 4, alignItems: "flex-start" },
  columnActions: { width: 236 },
  statusStacked: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },

  person: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: DESIGN_COLORS.boardTint },
  avatarImage: { width: 48, height: 48, borderRadius: 999 },
  initials: { fontSize: 17, fontWeight: "800", color: DESIGN_COLORS.hallGreenDeep },
  cell: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  roleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  phone: { fontWeight: "700", fontVariant: ["tabular-nums"] },
  statusPill: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999 },
  statusPillText: { fontSize: 15, lineHeight: 20, fontWeight: "700" },

  actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 },
  outlineButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  outlineButtonPressed: { backgroundColor: DESIGN_COLORS.boardTint },
  outlineButtonText: { fontSize: 15, fontWeight: "700", color: DESIGN_COLORS.ink },
  buttonGrow: { flexGrow: 1 },

  emptyState: { padding: 20, borderRadius: 24, alignItems: "center", gap: 8, backgroundColor: DESIGN_COLORS.boardTint },
});
