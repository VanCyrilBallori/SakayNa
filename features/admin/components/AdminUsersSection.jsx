import { FontAwesome } from "@expo/vector-icons";
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";

import { formatDate } from "../../../lib/dates";
import { getApprovalStatus, getProfilePhoto, getUserAddress, getUserName, getUserPhone } from "../utils/userFormatters";

export default function AdminUsersSection({
  theme,
  styles,
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
  return (
    <>
      <View style={[styles.filterField, { flexGrow: 0, flexBasis: "auto", marginBottom: 0 }]}>
        <Text style={[styles.filterFieldLabel, { color: theme.text }]}>Role</Text>
        <Dropdown
          style={[styles.dropdown, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
          containerStyle={[styles.dropdownContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}
          selectedTextStyle={[styles.dropdownText, { color: theme.text }]}
          itemTextStyle={[styles.dropdownText, { color: theme.text }]}
          activeColor={theme.softSurface}
          data={userRoleViews.map((role) => ({ label: role, value: role }))}
          labelField="label"
          valueField="value"
          value={userRoleView}
          onChange={(item) => setUserRoleView(item.value)}
        />
      </View>

      {atLimit ? (
        <Text style={[styles.limitNotice, { color: theme.mutedText }]}>
          Showing the latest {collectionLimit} users. Older ones are not loaded.
        </Text>
      ) : null}

      {isLoadingUsers ? (
        <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ActivityIndicator color="#06774B" />
          <Text style={[styles.emptyText, { color: theme.mutedText }]}>Loading registered users...</Text>
        </View>
      ) : filteredUsers.length ? (
        <View style={styles.usersGrid}>
          {filteredUsers.map((user) => (
            <View key={user.id} style={[styles.userCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.userCardTop}>
                <View style={styles.userIdentity}>
                  <View style={[styles.userAvatar, { backgroundColor: theme.avatarBg }]}>
                    {getProfilePhoto(user) ? (
                      <Image source={{ uri: getProfilePhoto(user) }} style={styles.avatarImage} />
                    ) : (
                      <FontAwesome name="user" size={22} color={theme.avatarText} />
                    )}
                  </View>
                  <View style={styles.userIdentityCopy}>
                    <Text style={[styles.userName, { color: theme.text }]}>{getUserName(user)}</Text>
                    <Text style={[styles.userRole, { color: theme.mutedText }]}>{user.role || "No role"}</Text>
                  </View>
                </View>
                <View style={[styles.userStatusPill, { backgroundColor: getApprovalStatus(user) === "Deactivated" ? "#F0E8E8" : "#DDF2E6" }]}>
                  <Text style={styles.userStatusText}>{getApprovalStatus(user)}</Text>
                </View>
              </View>

              <Text style={[styles.userLine, { color: theme.text }]}>Email: {user.email || "Not provided"}</Text>
              <Text style={[styles.userLine, { color: theme.text }]}>Phone: {getUserPhone(user)}</Text>
              <Text style={[styles.userLine, { color: theme.text }]}>Barangay: {user.barangay || "Not provided"}</Text>
              <Text style={[styles.userLine, { color: theme.text }]}>Address: {getUserAddress(user)}</Text>
              <Text style={[styles.userLine, { color: theme.mutedText }]}>Created: {formatDate(user.createdAt)}</Text>

              <View style={styles.userActions}>
                <TouchableOpacity style={[styles.smallActionButton, styles.editButton]} onPress={() => openUserEditor(user)}>
                  <Text style={styles.smallActionButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallActionButton, styles.deactivateButton]}
                  onPress={() => setSelectedSection("Operations")}
                >
                  <Text style={styles.smallActionButtonText}>Manage lifecycle</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No users match the selected view.</Text>
          <Text style={[styles.emptyText, { color: theme.mutedText }]}>{usersError || "Try a different role view or search term."}</Text>
        </View>
      )}

      {usersError ? <Text style={styles.errorText}>{usersError}</Text> : null}
      {userMessage ? <Text style={styles.feedbackText}>{userMessage}</Text> : null}
    </>
  );
}
