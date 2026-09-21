import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";

import { formatDateTime } from "../../../lib/dates";

export default function AdminRequestsSection({
  theme,
  styles,
  requestTypeFilters,
  requestTypeFilter,
  setRequestTypeFilter,
  requestStatusFilters,
  requestStatusFilter,
  setRequestStatusFilter,
  isLoadingRequests,
  filteredRequests,
  requestsError,
  setSelectedRequestRecord,
}) {
  return (
    <>
      <View style={styles.filterRow}>
        <View style={styles.filterField}>
          <Text style={[styles.filterFieldLabel, { color: theme.text }]}>Request type</Text>
          <Dropdown
            style={[styles.dropdown, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
            containerStyle={[styles.dropdownContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}
            selectedTextStyle={[styles.dropdownText, { color: theme.text }]}
            itemTextStyle={[styles.dropdownText, { color: theme.text }]}
            activeColor={theme.softSurface}
            data={requestTypeFilters.map((type) => ({ label: type, value: type }))}
            labelField="label"
            valueField="value"
            value={requestTypeFilter}
            onChange={(item) => setRequestTypeFilter(item.value)}
          />
        </View>

        <View style={styles.filterField}>
          <Text style={[styles.filterFieldLabel, { color: theme.text }]}>Request status</Text>
          <Dropdown
            style={[styles.dropdown, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
            containerStyle={[styles.dropdownContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}
            selectedTextStyle={[styles.dropdownText, { color: theme.text }]}
            itemTextStyle={[styles.dropdownText, { color: theme.text }]}
            activeColor={theme.softSurface}
            data={requestStatusFilters.map((status) => ({ label: status, value: status }))}
            labelField="label"
            valueField="value"
            value={requestStatusFilter}
            onChange={(item) => setRequestStatusFilter(item.value)}
          />
        </View>
      </View>

      {isLoadingRequests ? (
        <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ActivityIndicator color="#06774B" />
          <Text style={[styles.emptyText, { color: theme.mutedText }]}>Loading request history...</Text>
        </View>
      ) : filteredRequests.length ? (
        <View style={styles.requestGrid}>
          {filteredRequests.map((request) => (
            <TouchableOpacity
              key={request.id}
              style={[styles.requestCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => setSelectedRequestRecord(request)}
            >
              <View style={styles.requestCardTop}>
                <View style={[styles.requestLevelPill, { backgroundColor: request.requestTypeLabel === "Emergency Request" ? "#FAD9D9" : "#DDF2E6" }]}>
                  <Text style={styles.requestLevelText}>{request.requestTypeLabel}</Text>
                </View>
                <Text style={[styles.requestStatusText, { color: theme.mutedText }]}>{request.status || "Pending"}</Text>
              </View>

              <Text style={[styles.requestTitle, { color: theme.text }]}>{request.residentName || "Resident"}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Reference: {request.id}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Emergency Type: {request.emergencyType || "Not specified"}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Pickup: {request.pickupLocation || request.barangay || "Not available"}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Destination: {request.destination || "Not available"}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Assigned Driver: {request.assignedDriverName || "Unassigned"}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Vehicle: {request.vehicleLabel}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Priority: {request.priorityLabel}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Submitted: {formatDateTime(request.createdAt)}</Text>
              <Text style={[styles.requestMeta, { color: theme.mutedText }]}>Completed: {formatDateTime(request.completedAt)}</Text>

              <TouchableOpacity style={styles.requestViewButton} onPress={() => setSelectedRequestRecord(request)}>
                <Text style={styles.requestViewButtonText}>View Details</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No request records match the active filters.</Text>
          <Text style={[styles.emptyText, { color: theme.mutedText }]}>{requestsError || "Transport requests will appear here once residents submit them."}</Text>
        </View>
      )}
    </>
  );
}
