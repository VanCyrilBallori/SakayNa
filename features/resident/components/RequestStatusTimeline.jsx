import { FontAwesome } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { COLORS, RADIUS, SPACING } from "../../../constants/design";
import { formatRequestDate, getRequestTimeline } from "../utils/requestMapper";

export default function RequestStatusTimeline({ request }) {
  const timeline = getRequestTimeline(request);
  return <View style={styles.container}>{timeline.map((event, index) => <View key={event.key} style={styles.row}>
    <View style={styles.rail}>{index ? <View style={[styles.line, event.complete && styles.lineDone]} /> : null}<View style={[styles.dot, event.complete && styles.dotDone]}><FontAwesome name={event.complete ? "check" : "circle-o"} size={event.complete ? 10 : 12} color={event.complete ? "#FFFFFF" : COLORS.mutedText} /></View></View>
    <View style={styles.copy}><Text style={[styles.label, event.complete && styles.labelDone]}>{event.label}</Text><Text style={styles.time}>{event.timestamp ? formatRequestDate(event.timestamp) : event.complete ? "Timestamp not recorded" : "Not yet updated"}</Text></View>
  </View>)}</View>;
}

const styles = StyleSheet.create({
  container: { marginTop: SPACING.sm }, row: { flexDirection: "row", minHeight: 51 }, rail: { width: 30, alignItems: "center" }, line: { position: "absolute", top: -25, width: 2, height: 28, backgroundColor: COLORS.border }, lineDone: { backgroundColor: COLORS.success }, dot: { width: 20, height: 20, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface }, dotDone: { backgroundColor: COLORS.success, borderColor: COLORS.success }, copy: { flex: 1, paddingBottom: SPACING.sm }, label: { color: COLORS.mutedText, fontSize: 14, fontWeight: "600" }, labelDone: { color: COLORS.text }, time: { marginTop: 2, color: COLORS.subtleText, fontSize: 12 },
});
