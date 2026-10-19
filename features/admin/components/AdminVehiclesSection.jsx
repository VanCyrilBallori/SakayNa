import { Text, TouchableOpacity, useWindowDimensions, View } from "react-native";

import ListSkeleton from "../../../components/ui/ListSkeleton";
import { formatDate } from "../../../lib/dates";
import AdminSectionHeader from "./AdminSectionHeader";

// Cards per row (DESIGN.md "Admin website exception"): 3 on a wide window, 2 on a medium one, 1 on a narrow one.
const getColumnCount = (width) => (width >= 1280 ? 3 : width >= 900 ? 2 : 1);

// Splits the list into rows of `size` cards, so every card in a row is the same width and height (like Admin Requests).
const toRows = (items, size) => {
  const rows = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
};

export default function AdminVehiclesSection({
  theme,
  styles,
  cityVehicleOwnerLabel,
  isLoadingVehicles,
  filteredVehicles,
  vehiclesError,
  vehicleMessage,
  openVehicleEditor,
  setConfirmingVehicleDelete,
  atLimit,
  collectionLimit,
}) {
  const { width } = useWindowDimensions();
  const columns = getColumnCount(width);

  return (
    <>
      <AdminSectionHeader
        icon="van-passenger"
        title="Vehicles"
        subtitle="The barangay vehicles that dispatch can assign. Archived ones keep their history."
        right={
          <TouchableOpacity style={styles.primaryActionButton} onPress={() => openVehicleEditor()}>
            <Text style={styles.primaryActionButtonText}>Add City/Barangay Vehicle</Text>
          </TouchableOpacity>
        }
      />

      {atLimit ? (
        <Text style={[styles.limitNotice, { color: theme.mutedText }]}>
          Showing the latest {collectionLimit} vehicles. Older ones are not loaded.
        </Text>
      ) : null}

      {isLoadingVehicles ? (
        <ListSkeleton label="Loading vehicle records" />
      ) : filteredVehicles.length ? (
        <View style={styles.vehicleRow}>
          {toRows(filteredVehicles, columns).map((row) => (
            <View key={row[0].id} style={styles.vehicleGridRow}>
              {row.map((vehicle) => (
                <View key={vehicle.id} style={[styles.vehicleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.vehicleTitle, { color: theme.text }]}>{vehicle.name || "Unnamed vehicle"}</Text>
                  <Text style={[styles.vehicleMeta, { color: theme.mutedText }]}>
                    {vehicle.type || "Vehicle"} · {vehicle.plateNumber || "No plate number"}
                  </Text>
                  <Text style={[styles.userLine, { color: theme.text }]}>Owner Type: {vehicle.ownerType || cityVehicleOwnerLabel}</Text>
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
              {/* Empty places keep the last row's cards the same width as the others. */}
              {Array.from({ length: columns - row.length }, (_, index) => (
                <View key={`empty-${index}`} style={styles.vehicleGridEmpty} />
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No vehicle records found.</Text>
          <Text style={[styles.emptyText, { color: theme.mutedText }]}>
            {vehiclesError || "Add a city/barangay vehicle to populate this section."}
          </Text>
        </View>
      )}

      {vehiclesError ? <Text style={styles.errorText}>{vehiclesError}</Text> : null}
      {vehicleMessage ? <Text style={styles.feedbackText}>{vehicleMessage}</Text> : null}
    </>
  );
}
