import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, LIGHT_COLORS } from "../constants/design";

const colors = LIGHT_COLORS;

// A box in a form that opens a list sliding up from the bottom of the screen (like the Get Started sheet).
// Used instead of a dropdown, because a dropdown opens downward and can go under Android's navigation bar.
//
// options     = [{ label, value }]. "value" is what gets saved; "label" is what the person sees.
// value       = the value chosen now ("" or null = nothing chosen yet).
// onChange    = called with the new value when a row is tapped.
// title       = the heading at the top of the sheet, e.g. "Choose your barangay".
// searchable  = true shows a search box at the top of the sheet (for long lists like the barangays).
// style       = the look of the box in the form (each form passes its own input style).
// The other props (placeholder, searchPlaceholder, disabled, accessibilityLabel) work like on a TextInput.
export default function BottomSheetPicker({
  options,
  value,
  onChange,
  title,
  placeholder = "Choose one",
  searchable = false,
  searchPlaceholder = "Search",
  disabled = false,
  style,
  accessibilityLabel,
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = options.find((option) => option.value === value);
  const query = search.trim().toLowerCase();
  const shownOptions = query ? options.filter((option) => option.label.toLowerCase().includes(query)) : options;
  // The sheet is never taller than three quarters of the screen.
  // With a search box it always uses that height, so it doesn't jump around while the list gets shorter.
  const sheetHeight = height * 0.75;

  const openSheet = () => {
    setSearch("");
    setOpen(true);
  };

  const choose = (option) => {
    setOpen(false);
    onChange(option.value);
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.box, style, pressed && styles.boxPressed]}
        onPress={openSheet}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel || title}, ${selected ? selected.label : placeholder}`}
        accessibilityHint="Opens a list to choose from"
        accessibilityState={{ disabled }}
      >
        <Text style={[styles.boxText, { color: selected ? colors.heading : colors.muted }]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={26} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setOpen(false)}>
        {/* "padding" makes room for the keyboard when the search box is used, so the list stays above it. */}
        <KeyboardAvoidingView behavior="padding" style={[styles.backdrop, { paddingTop: insets.top + 24 }]}>
          <Pressable style={styles.dismissArea} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />

          <View style={[styles.sheet, searchable ? { height: sheetHeight } : { maxHeight: sheetHeight }]} accessibilityViewIsModal>
            <View style={styles.header}>
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.closeButton, pressed && { backgroundColor: colors.card }]}
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <MaterialCommunityIcons name="close" size={26} color={colors.heading} />
              </Pressable>
            </View>

            {searchable ? (
              <View style={styles.searchBox}>
                <MaterialCommunityIcons name="magnify" size={24} color={colors.muted} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={colors.muted}
                  autoCorrect={false}
                  returnKeyType="search"
                  accessibilityLabel={searchPlaceholder}
                />
                {search ? (
                  <Pressable style={styles.clearButton} onPress={() => setSearch("")} accessibilityRole="button" accessibilityLabel="Clear search">
                    <MaterialCommunityIcons name="close-circle" size={22} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* keyboardShouldPersistTaps: one tap on a row picks it, even while the keyboard is open. */}
            {/* The bottom padding keeps the last row above Android's navigation bar. */}
            <FlatList
              style={styles.list}
              data={shownOptions}
              keyExtractor={(option) => `${option.value}`}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={<Text style={styles.emptyText}>No match for &quot;{search.trim()}&quot;. Check the spelling.</Text>}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    style={({ pressed }) => [styles.row, isSelected && styles.rowSelected, pressed && styles.rowPressed]}
                    onPress={() => choose(item)}
                    android_ripple={{ color: colors.ripple }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>{item.label}</Text>
                    {isSelected ? <MaterialCommunityIcons name="check" size={26} color={COLORS.primary} /> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "center", gap: 10 },
  boxPressed: { backgroundColor: colors.card },
  boxText: { flex: 1, fontSize: 17 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.backdrop },
  dismissArea: { flex: 1 },
  // flexShrink lets the sheet get shorter (instead of going off the top) when the keyboard is open.
  sheet: { flexShrink: 1, width: "100%", backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 24, paddingRight: 12, paddingTop: 16, paddingBottom: 12 },
  title: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: "800", color: colors.heading },
  closeButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 56,
    marginHorizontal: 24,
    marginBottom: 12,
    paddingLeft: 14,
    borderWidth: 1.5,
    borderColor: colors.outline,
    borderRadius: 12,
  },
  searchInput: { flex: 1, minHeight: 54, fontSize: 17, color: colors.heading },
  clearButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  list: { flexGrow: 0, borderTopWidth: 1, borderTopColor: colors.line },
  separator: { height: 1, marginHorizontal: 24, backgroundColor: colors.line },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 24, paddingVertical: 10 },
  rowSelected: { backgroundColor: colors.card },
  rowPressed: { backgroundColor: colors.card },
  rowText: { flex: 1, fontSize: 18, lineHeight: 24, fontWeight: "600", color: colors.heading },
  rowTextSelected: { fontWeight: "800", color: COLORS.primary },
  emptyText: { paddingHorizontal: 24, paddingVertical: 20, fontSize: 17, lineHeight: 24, color: colors.muted },
});
