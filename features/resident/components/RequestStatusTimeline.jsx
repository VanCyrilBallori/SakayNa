import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { CORNER, FONT, GREEN, NEUTRAL } from "../../../constants/design";
import { formatRequestDate, getRequestTimeline } from "../utils/requestMapper";

// The request's steps, top to bottom. A done step has a green dot with a check and dark words;
// a step still to come has an empty grey ring and grey words (shape and words, not color alone).
export default function RequestStatusTimeline({ request }) {
  const timeline = getRequestTimeline(request);
  return (
    <View style={styles.container}>
      {timeline.map((event, index) => (
        <View key={event.key} style={styles.row}>
          <View style={styles.rail}>
            {index ? <View style={[styles.line, event.complete && styles.lineDone]} /> : null}
            <View style={[styles.dot, event.complete && styles.dotDone]}>
              {event.complete ? <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" /> : null}
            </View>
          </View>
          <View style={styles.copy}>
            <Text style={[styles.label, event.complete && styles.labelDone]}>{event.label}</Text>
            <Text style={styles.time}>{event.timestamp ? formatRequestDate(event.timestamp) : event.complete ? "Time not recorded" : "Not yet"}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 12 },
  row: { flexDirection: "row", minHeight: 56 },
  rail: { width: 32, alignItems: "center" },
  // The line joining this dot to the one above it.
  line: { position: "absolute", top: -34, width: 2, height: 36, backgroundColor: NEUTRAL[300] },
  lineDone: { backgroundColor: GREEN[600] },
  dot: { width: 22, height: 22, borderWidth: 2, borderColor: NEUTRAL[400], borderRadius: CORNER.pill, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL[0] },
  dotDone: { backgroundColor: GREEN[600], borderColor: GREEN[600] },
  copy: { flex: 1, paddingLeft: 8, paddingBottom: 12 },
  label: { fontSize: 17, lineHeight: 22, fontFamily: FONT.medium, color: NEUTRAL[700] },
  labelDone: { fontFamily: FONT.semiBold, color: NEUTRAL[900] },
  time: { marginTop: 2, fontSize: 15, lineHeight: 20, fontFamily: FONT.regular, color: NEUTRAL[700] },
});
