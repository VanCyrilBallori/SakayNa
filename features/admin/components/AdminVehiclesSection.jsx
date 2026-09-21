import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { formatDate } from "../../../lib/dates";

export default function AdminVehiclesSection({
  theme,
  styles,
  cityVehicleOwnerLabel,
  syncingVehicles,
  syncApprovedDriverVehicles,
  isLoadingVehicles,
  filteredVehicles,
  vehiclesError,
  vehicleMessage,
  openVehicleEditor,
  setConfirmingVehicleDelete,
  atLimit,
  collectionLimit,
}) {
  return (
    <>
      <View style={styles.vehicleToolbar}>
        <TouchableOpacity style={styles.primaryActionButton} onPress={() => openVehicleEditor()}>
          <Text style={styles.primaryActionButtonText}>Add City/Barangay Vehicle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryActionButton, syncingVehicles && styles.actionButtonDisabled]}
          onPress={syncApprovedDriverVehicles}
          disabled={syncingVehicles}
        >
          <Text style={styles.secondaryActionButtonText}>{syncingVehicles ? "Syncing..." : "Sync Driver-Owned Vehicles"}</Text>
        </TouchableOpacity>
      </View>

      {atLimit ? (
        <Text style={[styles.limitNotice, { color: theme.mutedText }]}>
          Showing the latest {collectionLimit} vehicles. Older ones are not loaded.
        </Text>
      ) : null}

      {isLoadingVehicles ? (
        <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ActivityIndicator color="#06774B" />
          <Text style={[styles.emptyText, { color: theme.mutedText }]}>Loading vehicle records...</Text>
        </View>
      ) : filteredVehicles.length ? (
        <View style={styles.vehicleRow}>
          {filteredVehicles.map((vehicle) => (
            <View key={vehicle.id} style={[styles.vehicleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.vehicleHeader}>
                <View style={styles.vehicleHeaderCopy}>
                  <Text style={[styles.vehicleTitle, { color: theme.text }]}>{vehicle.name || "Unnamed vehicle"}</Text>
                  <Text style={[styles.vehicleMeta, { color: theme.mutedText }]}>
                    {vehicle.type || "Vehicle"} | {vehicle.plateNumber || "No plate number"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.userStatusPill,
                    { backgroundColor: vehicle.derivedStatus === "Inactive" ? "#F0E8E8" : "#DDF2E6" },
                  ]}
                >
                  <Text style={styles.userStatusText}>{vehicle.derivedStatus}</Text>
                </View>
              </View>

              <Text style={[styles.userLine, { color: theme.text }]}>Owner Type: {vehicle.ownerType || cityVehicleOwnerLabel}</Text>
              <Text style={[styles.userLine, { color: theme.text }]}>Driver: {vehicle.driverName || "Not linked"}</Text>
              <Text style={[styles.userLine, { color: theme.text }]}>Owner UID: {vehicle.ownerUid || "Not linked"}</Text>
              <Text style={[styles.userLine, { color: theme.mutedText }]}>Created: {formatDate(vehicle.createdAt)}</Text>

              <View style={styles.userActions}>
                <TouchableOpacity style={[styles.smallActionButton, styles.editButton]} onPress={() => openVehicleEditor(vehicle)}>
                  <Text style={styles.smallActionButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.smallActionButton, styles.deleteButton]} onPress={() => setConfirmingVehicleDelete(vehicle)}>
                  <Text style={styles.smallActionButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No vehicle records found.</Text>
          <Text style={[styles.emptyText, { color: theme.mutedText }]}>
            {vehiclesError || "Add a city/barangay vehicle or sync approved driver-owned vehicles to populate this section."}
          </Text>
        </View>
      )}

      {vehiclesError ? <Text style={styles.errorText}>{vehiclesError}</Text> : null}
      {vehicleMessage ? <Text style={styles.feedbackText}>{vehicleMessage}</Text> : null}
    </>
  );
}
