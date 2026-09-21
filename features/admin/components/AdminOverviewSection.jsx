import { FontAwesome } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

export default function AdminOverviewSection({
  theme,
  styles,
  notifications,
  overviewCards,
  rangeLabel,
  setRangeLabel,
  activityBuckets,
  maxActivity,
  requestStatusStats,
  atLimit,
  collectionLimit,
}) {
  return (
    <>
      <View style={[styles.notificationPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.notificationHeader}>
          <FontAwesome name="bell" size={18} color="#06774B" />
          <Text style={[styles.notificationTitle, { color: theme.text }]}>Live Firestore Summary</Text>
        </View>
        {notifications.map((note) => (
          <Text key={note} style={[styles.notificationText, { color: theme.mutedText }]}>
            {note}
          </Text>
        ))}
        {atLimit ? (
          <Text style={[styles.limitNotice, { color: theme.mutedText }]}>
            Totals below count the whole collection. The averages, the activity chart, and the Request
            Status panel use only the latest {collectionLimit} requests.
          </Text>
        ) : null}
      </View>

      <View style={styles.metricsGrid}>
        {overviewCards.map((metric) => (
          <View key={metric.label} style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.metricLabel, { color: theme.secondaryText }]}>{metric.label}</Text>
            <Text style={[styles.metricValue, { color: theme.text }]}>{metric.value}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.chartCard, { backgroundColor: theme.softSurface, borderColor: theme.softSurfaceBorder }]}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={[styles.chartTitle, { color: theme.text }]}>Request Activity</Text>
            <Text style={[styles.chartSubtitle, { color: theme.mutedText }]}>Actual transport request submissions from Firestore.</Text>
          </View>
          <TouchableOpacity
            style={[styles.rangeButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() =>
              setRangeLabel((current) => (current === "Week" ? "Month" : current === "Month" ? "Year" : "Week"))
            }
          >
            <Text style={[styles.rangeButtonText, { color: theme.text }]}>{rangeLabel}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.barRow}>
          {activityBuckets.map((bucket) => {
            const ratio = maxActivity ? bucket.value / maxActivity : 0;

            return (
              <View key={bucket.key} style={styles.barItem}>
                <Text style={[styles.barValue, { color: theme.text }]}>{bucket.value}</Text>
                <View style={[styles.barTrack, { backgroundColor: theme.surface }]}>
                  <View style={[styles.bar, { height: Math.max(16, 132 * ratio), backgroundColor: "#08A967" }]} />
                </View>
                <Text style={[styles.dayText, { color: theme.text }]}>{bucket.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statsPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.statsPanelTitle, { color: theme.text }]}>Request Status</Text>
          {requestStatusStats.map((stat) => (
            <View key={stat.label} style={styles.statLine}>
              <Text style={[styles.statLineLabel, { color: theme.mutedText }]}>{stat.label}</Text>
              <Text style={[styles.statLineValue, { color: theme.text }]}>{stat.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}
