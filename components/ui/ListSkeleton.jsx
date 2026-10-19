import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Platform, StyleSheet, View } from "react-native";

import { DESIGN_COLORS } from "../../constants/design";

// Grey placeholder cards shown while a list or a card is still loading, on the website and the phone (Task 3.16).
// rows = how many cards: 3 for a list, 1 for a single card (the resident's "Your ride", the driver's ride and duty card).
// Show it only while loading: after loading ends (or fails), the screen shows its own list, empty or error message.
// The cards fade softly so the page doesn't look frozen. They stay still if the phone or computer asks for reduced motion.
// label = what a screen reader says, for example "Loading registered users".
export default function ListSkeleton({ rows = 3, label = "Loading" }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let pulse = null;
    let stopped = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (stopped || reduceMotion) return;
        pulse = Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: Platform.OS !== "web" }),
            Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== "web" }),
          ])
        );
        pulse.start();
      })
      .catch(() => {});

    return () => {
      stopped = true;
      pulse?.stop();
    };
  }, [opacity]);

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.list}>
      {Array.from({ length: rows }, (_, index) => (
        <Animated.View key={index} style={[styles.card, { opacity }]}>
          <View style={[styles.bar, styles.barLong]} />
          <View style={[styles.bar, styles.barShort]} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { width: "100%", gap: 10 },
  card: { padding: 16, gap: 10, borderRadius: 16, backgroundColor: DESIGN_COLORS.boardTint },
  bar: { height: 14, borderRadius: 999, backgroundColor: DESIGN_COLORS.rule },
  barLong: { width: "60%" },
  barShort: { width: "35%" },
});
