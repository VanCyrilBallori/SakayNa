import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DESIGN_COLORS } from "../../../constants/design";
import { formatShortDay, getDurationLabel } from "../../../lib/dates";

// Light grey for "Cancelled" in the ride bar: it means "nothing happened", so it stays quiet.
const CANCELLED_GREY = "#B9C6C0";
const PLOT_HEIGHT = 200;
const Y_AXIS_WIDTH = 36;

// The three time choices for the chart. The value is what admin-home keeps in rangeLabel.
const RANGE_OPTIONS = [
  { value: "Week", label: "7 days", period: "in the last 7 days", unit: "day", lastLabel: "Today" },
  { value: "Month", label: "4 weeks", period: "in the last 4 weeks", unit: "week", lastLabel: "This week" },
  { value: "Year", label: "12 months", period: "in the last 12 months", unit: "month", lastLabel: "" },
];

// Round chart lines: 0, 2, 4, 6 or 0, 10, 20, 30, never strange numbers like 7.
const getNiceStep = (max) => [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000].find((step) => max / step <= 4) || 2000;

const getPercent = (value, total) => (total ? Math.round((value / total) * 100) : 0);

// A section on its own soft color with a round icon badge, like the dispatcher's Emergency request form.
function Section({ icon, title, color = "green", children, style }) {
  const orange = color === "peach";
  return (
    <View style={[styles.section, orange ? styles.peachSection : styles.greenSection, style]}>
      <View style={styles.sectionTitleRow}>
        <View style={[styles.sectionBadge, { backgroundColor: orange ? DESIGN_COLORS.sakayOrange : DESIGN_COLORS.hallGreen }]}>
          <MaterialCommunityIcons name={icon} size={20} color={orange ? DESIGN_COLORS.ink : DESIGN_COLORS.paperWhite} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// One label, its number, and a green bar under it.
function BarLine({ label, valueText, ratio }) {
  return (
    <View>
      <View style={styles.barLineTop}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.barLineValue}>{valueText}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(100, Math.max(0, ratio * 100))}%` }]} />
      </View>
    </View>
  );
}

function ActivityChart({ rangeLabel, activityBuckets }) {
  const range = RANGE_OPTIONS.find((option) => option.value === rangeLabel) || RANGE_OPTIONS[0];
  const total = activityBuckets.reduce((sum, bucket) => sum + bucket.value, 0);
  const max = Math.max(...activityBuckets.map((bucket) => bucket.value), 1);
  const step = getNiceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let tick = 0; tick <= top; tick += step) {
    ticks.push(tick);
  }

  const busiest = activityBuckets.reduce((best, bucket) => (bucket.value > best.value ? bucket : best), activityBuckets[0]);
  const busiestName =
    range.unit === "day" ? formatShortDay(busiest.start) : range.unit === "week" ? `week of ${busiest.label}` : busiest.label;
  const lastIndex = activityBuckets.length - 1;

  return (
    <>
      <View style={styles.chartSummary}>
        <Text style={styles.body}>
          <Text style={styles.bigNumber}>{total}</Text>
          <Text style={styles.label}> {total === 1 ? "request" : "requests"}</Text>
          <Text style={styles.small}> {range.period}</Text>
        </Text>
        {total ? (
          <Text style={styles.small}>
            Busiest {range.unit}: <Text style={styles.smallStrong}>{busiestName}</Text> ({busiest.value})
          </Text>
        ) : null}
      </View>

      <View
        style={styles.plotRow}
        accessible
        accessibilityLabel={`Ride requests per ${range.unit}: ${activityBuckets.map((bucket) => `${bucket.label} ${bucket.value}`).join(", ")}`}
      >
        <View style={styles.yAxis}>
          {ticks.map((tick) => (
            <Text key={tick} style={[styles.yLabel, { bottom: (tick / top) * PLOT_HEIGHT - 10 }]}>
              {tick}
            </Text>
          ))}
        </View>
        <View style={styles.plot}>
          {ticks.map((tick) => (
            <View key={tick} style={[styles.gridLine, { bottom: (tick / top) * PLOT_HEIGHT }]} />
          ))}
          <View style={styles.columns}>
            {activityBuckets.map((bucket) => (
              <View key={bucket.key} style={styles.column}>
                {bucket.value ? <Text style={styles.columnValue}>{bucket.value}</Text> : null}
                <View style={[styles.columnBar, { height: bucket.value ? Math.max(6, (bucket.value / top) * PLOT_HEIGHT) : 0 }]} />
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.xLabels}>
        {activityBuckets.map((bucket, index) => {
          const isLast = index === lastIndex;
          return (
            <Text key={bucket.key} style={[styles.xLabel, isLast && styles.xLabelLast]} numberOfLines={1}>
              {isLast && range.lastLabel ? range.lastLabel : bucket.label}
            </Text>
          );
        })}
      </View>
    </>
  );
}

export default function AdminOverviewSection({
  numbers,
  pendingApplicationsCount,
  dispatcherCount,
  averageDispatchTime,
  averageResponseTime,
  rangeLabel,
  setRangeLabel,
  activityBuckets,
  requestStatusStats,
  atLimit,
  collectionLimit,
}) {
  const totalRequests = numbers.active + numbers.completed + numbers.cancelled;
  const purposeTotal = numbers.medical + numbers.community + numbers.other;
  const purposeMax = Math.max(numbers.medical, numbers.community, numbers.other, 1);
  const purposes = [
    { label: "Medical / Health", value: numbers.medical },
    { label: "Community / Personal Trip", value: numbers.community },
    { label: "Other", value: numbers.other },
  ];
  // Both waiting bars use the same scale, so the longer wait has the longer bar.
  const waitScale = Math.max(averageDispatchTime || 0, averageResponseTime || 0, 1) * 1.15;
  const activeSplit = requestStatusStats.map((stat) => `${stat.value} ${stat.label}`).join(" · ");

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <MaterialCommunityIcons name="chart-bar" size={24} color={DESIGN_COLORS.paperWhite} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Overview</Text>
          <Text style={styles.subtitle}>Ride requests, drivers and vehicles for all of Toledo City.</Text>
        </View>
      </View>

      <Section icon="bell-outline" title="Needs attention" color="peach">
        <View style={styles.attentionRow}>
          <View style={styles.attentionItem}>
            <Text style={styles.bigNumber}>{pendingApplicationsCount}</Text>
            <View style={styles.attentionCopy}>
              <Text style={styles.label}>Driver {pendingApplicationsCount === 1 ? "application" : "applications"} waiting</Text>
              <Text style={styles.small}>Review them in Driver Applications.</Text>
            </View>
          </View>
          <View style={styles.attentionItem}>
            <Text style={styles.bigNumber}>{numbers.active}</Text>
            <View style={styles.attentionCopy}>
              <Text style={styles.label}>Ride {numbers.active === 1 ? "request" : "requests"} still active</Text>
              <Text style={styles.small}>Not completed or cancelled yet.</Text>
            </View>
          </View>
        </View>
      </Section>

      <View style={styles.sectionRow}>
        <Section icon="van-passenger" title="Ride requests" style={styles.ridesSection}>
          <Text style={styles.body}>
            <Text style={styles.bigNumber}>{totalRequests}</Text>
            <Text style={styles.label}> ride requests in total</Text>
          </Text>

          {/* One bar: orange Active, green Completed, grey Cancelled. Every color also has its word and number below. */}
          <View
            style={styles.stackBar}
            accessible
            accessibilityLabel={`${numbers.active} active, ${numbers.completed} completed, ${numbers.cancelled} cancelled`}
          >
            {totalRequests ? (
              <>
                {numbers.active ? <View style={[styles.stackPart, { flex: numbers.active, backgroundColor: DESIGN_COLORS.sakayOrange }]} /> : null}
                {numbers.completed ? <View style={[styles.stackPart, { flex: numbers.completed, backgroundColor: DESIGN_COLORS.hallGreen }]} /> : null}
                {numbers.cancelled ? <View style={[styles.stackPart, { flex: numbers.cancelled, backgroundColor: CANCELLED_GREY }]} /> : null}
              </>
            ) : (
              <View style={[styles.stackPart, { flex: 1, backgroundColor: DESIGN_COLORS.paperWhite }]} />
            )}
          </View>

          <View style={styles.legend}>
            <View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: DESIGN_COLORS.sakayOrange }]} />
                <Text style={[styles.label, styles.legendLabel]}>Active</Text>
                <Text style={styles.barLineValue}>{numbers.active}</Text>
              </View>
              <Text style={[styles.small, styles.legendSub]}>{activeSplit}</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: DESIGN_COLORS.hallGreen }]} />
              <Text style={[styles.label, styles.legendLabel]}>Completed</Text>
              <Text style={styles.barLineValue}>
                {numbers.completed} <Text style={styles.small}>({getPercent(numbers.completed, totalRequests)}%)</Text>
              </Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: CANCELLED_GREY }]} />
              <Text style={[styles.label, styles.legendLabel]}>Cancelled</Text>
              <Text style={styles.barLineValue}>
                {numbers.cancelled} <Text style={styles.small}>({getPercent(numbers.cancelled, totalRequests)}%)</Text>
              </Text>
            </View>
          </View>
        </Section>

        <Section icon="chart-bar" title="Requests over time" style={styles.chartSection}>
          <View style={styles.rangeRow}>
            {RANGE_OPTIONS.map((option) => {
              const selected = option.value === rangeLabel;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setRangeLabel(option.value)}
                  style={[styles.rangeChoice, selected && styles.rangeChoiceSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.rangeChoiceText, selected && styles.rangeChoiceTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <ActivityChart rangeLabel={rangeLabel} activityBuckets={activityBuckets} />
        </Section>
      </View>

      <View style={styles.sectionRow}>
        <Section icon="clipboard-text-outline" title="What rides were for" style={styles.smallSection}>
          {purposes.map((purpose) => (
            <BarLine
              key={purpose.label}
              label={purpose.label}
              valueText={`${purpose.value} (${getPercent(purpose.value, purposeTotal)}%)`}
              ratio={purpose.value / purposeMax}
            />
          ))}
        </Section>

        <Section icon="clock-outline" title="Waiting time" style={styles.smallSection}>
          <Text style={styles.small}>Average, counted from when the request was sent.</Text>
          <BarLine
            label="Until a driver is assigned"
            valueText={getDurationLabel(averageDispatchTime)}
            ratio={(averageDispatchTime || 0) / waitScale}
          />
          <BarLine
            label="Until the driver accepts"
            valueText={getDurationLabel(averageResponseTime)}
            ratio={(averageResponseTime || 0) / waitScale}
          />
        </Section>

        <Section icon="account-group-outline" title="Drivers and vehicles" style={styles.smallSection}>
          <View>
            <Text style={styles.body}>
              <Text style={styles.bigNumber}>{numbers.availableDrivers}</Text>
              <Text style={styles.label}> of {numbers.drivers} drivers available now</Text>
            </Text>
            <View style={[styles.barTrack, styles.meterTrack]}>
              <View style={[styles.barFill, { width: `${getPercent(numbers.availableDrivers, numbers.drivers)}%` }]} />
            </View>
          </View>
          <View style={styles.facts}>
            <View style={styles.fact}>
              <Text style={styles.bigNumber}>{numbers.vehicles}</Text>
              <Text style={styles.small}>Vehicles registered</Text>
            </View>
            <View style={styles.fact}>
              <Text style={styles.bigNumber}>{dispatcherCount}</Text>
              <Text style={styles.small}>Dispatcher {dispatcherCount === 1 ? "account" : "accounts"}</Text>
            </View>
          </View>
        </Section>
      </View>

      {atLimit ? (
        <Text style={styles.small}>
          The totals count every request. The waiting times, the chart, and the Pending / Assigned / In Progress split use only the
          latest {collectionLimit} requests.
        </Text>
      ) : null}
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
  body: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.ink },
  label: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  small: { fontSize: 15, lineHeight: 20, fontWeight: "400", color: DESIGN_COLORS.inkMuted },
  smallStrong: { fontWeight: "700", color: DESIGN_COLORS.ink },
  bigNumber: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },

  // Sections: soft color inside the white panel, 24 corners (DESIGN.md).
  sectionRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "stretch" },
  section: { padding: 16, gap: 12, borderRadius: 24, minWidth: 0 },
  greenSection: { backgroundColor: DESIGN_COLORS.boardTint },
  peachSection: { backgroundColor: DESIGN_COLORS.peachTint },
  ridesSection: { flexGrow: 5, flexShrink: 1, flexBasis: 300 },
  chartSection: { flexGrow: 7, flexShrink: 1, flexBasis: 420 },
  smallSection: { flexGrow: 1, flexShrink: 1, flexBasis: 260 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionBadge: { width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  sectionTitle: { flexShrink: 1, fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.ink },

  attentionRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  attentionItem: { flexGrow: 1, flexShrink: 1, flexBasis: 260, flexDirection: "row", alignItems: "center", gap: 16, padding: 4 },
  attentionCopy: { flex: 1, minWidth: 0 },

  stackBar: { flexDirection: "row", height: 28, gap: 2, borderRadius: 999, overflow: "hidden" },
  stackPart: { minWidth: 6 },
  legend: { gap: 10 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendDot: { width: 16, height: 16, borderRadius: 999 },
  legendLabel: { flex: 1 },
  legendSub: { marginLeft: 26 },

  barLineTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  barLineValue: { fontSize: 17, lineHeight: 22, fontWeight: "800", color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },
  barTrack: { height: 14, borderRadius: 999, overflow: "hidden", backgroundColor: DESIGN_COLORS.paperWhite },
  barFill: { height: "100%", borderRadius: 999, backgroundColor: DESIGN_COLORS.hallGreen },
  meterTrack: { height: 18, marginTop: 8 },
  facts: { flexDirection: "row", gap: 12 },
  fact: { flex: 1, minWidth: 0 },

  // Pill-shaped choices, like Priority on the Emergency request form.
  rangeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rangeChoice: {
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: DESIGN_COLORS.controlOutline,
    backgroundColor: DESIGN_COLORS.paperWhite,
  },
  rangeChoiceSelected: { borderColor: DESIGN_COLORS.hallGreen, backgroundColor: DESIGN_COLORS.hallGreen },
  rangeChoiceText: { fontSize: 17, fontWeight: "600", color: DESIGN_COLORS.ink },
  rangeChoiceTextSelected: { color: DESIGN_COLORS.paperWhite },

  chartSummary: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", columnGap: 16, rowGap: 4 },
  // The space above the plot leaves room for the number on the tallest column.
  plotRow: { flexDirection: "row", marginTop: 24 },
  yAxis: { width: Y_AXIS_WIDTH, height: PLOT_HEIGHT },
  yLabel: { position: "absolute", right: 8, fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.inkMuted, fontVariant: ["tabular-nums"] },
  plot: { flex: 1, height: PLOT_HEIGHT },
  gridLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: DESIGN_COLORS.rule },
  columns: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, flexDirection: "row", alignItems: "flex-end" },
  column: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  columnValue: { marginBottom: 4, fontSize: 15, lineHeight: 20, fontWeight: "800", color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },
  columnBar: { width: 26, borderTopLeftRadius: 999, borderTopRightRadius: 999, backgroundColor: DESIGN_COLORS.hallGreen },
  xLabels: { flexDirection: "row", marginLeft: Y_AXIS_WIDTH, marginTop: 8 },
  xLabel: { flex: 1, textAlign: "center", fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.inkMuted },
  xLabelLast: { fontWeight: "800", color: DESIGN_COLORS.ink },
});
