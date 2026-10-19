import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import ListSkeleton from "../../../components/ui/ListSkeleton";
import { CORNER, DESIGN_COLORS, FONT } from "../../../constants/design";
import { formatShortDay, getDurationLabel } from "../../../lib/dates";

// Light grey for "Cancelled" in the ride bar: it means "nothing happened", so it stays quiet.
const CANCELLED_GREY = "#B9C6C0";
const PLOT_HEIGHT = 200;
const Y_AXIS_WIDTH = 36;
// The one-screen dashboard (wide windows): from this window width. Its chart is never shorter than MIN and never
// taller than MAX (tall screens give the chart the extra height, up to MAX).
const WIDE_WINDOW = 1280;
const MIN_FILL_PLOT_HEIGHT = 80;
// The dashboard cards' padding (12 above and below), and the smallest row the chart card fits in:
// padding 24 + title row with the choices 48 + summary 34 + space above the plot 20 + plot 80 + day names 20 + gaps 24 = 250.
const DASH_CARD_PADDING = 12;
const TOP_ROW_MIN_HEIGHT = 250;
const MAX_FILL_PLOT_HEIGHT = 360;

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
// compact = the one-screen dashboard (wide windows): a smaller badge and a 17 title, so two rows of cards fit.
// right = something on the right of the title (the chart's 7 days / 4 weeks / 12 months choices).
// onContentHeight(height) = tells how tall the card's content naturally is (its words may wrap), so the dashboard
// never makes a row shorter than that.
function Section({ icon, title, color = "green", children, style, compact = false, right = null, onContentHeight }) {
  const orange = color === "peach";
  const titleRow = (
    <View style={styles.sectionTitleRow}>
      <View style={[styles.sectionBadge, compact && styles.sectionBadgeCompact, { backgroundColor: orange ? DESIGN_COLORS.sakayOrange : DESIGN_COLORS.hallGreen }]}>
        <MaterialCommunityIcons name={icon} size={compact ? 18 : 20} color={orange ? DESIGN_COLORS.ink : DESIGN_COLORS.paperWhite} />
      </View>
      <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>{title}</Text>
      {right ? <View style={styles.sectionTitleRight}>{right}</View> : null}
    </View>
  );
  return (
    <View style={[styles.section, compact && styles.sectionCompact, orange ? styles.peachSection : styles.greenSection, style]}>
      {onContentHeight ? (
        // One wrapper (with the same gap), only as tall as its content, so its height can be measured.
        <View style={compact ? styles.sectionInnerCompact : styles.sectionInner} onLayout={(event) => onContentHeight(Math.ceil(event.nativeEvent.layout.height))}>
          {titleRow}
          {children}
        </View>
      ) : (
        <>
          {titleRow}
          {children}
        </>
      )}
    </View>
  );
}

// One label, its number, and a green bar under it.
function BarLine({ label, valueText, ratio }) {
  return (
    <View>
      {/* A long label wraps onto a second line (narrow dashboard cards) instead of pushing the number out. */}
      <View style={styles.barLineTop}>
        <Text style={[styles.label, styles.barLineLabel]}>{label}</Text>
        <Text style={styles.barLineValue}>{valueText}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(100, Math.max(0, ratio * 100))}%` }]} />
      </View>
    </View>
  );
}

// fill = the one-screen dashboard: the plot takes all the height left in its card (measured with onLayout),
// between MIN_FILL_PLOT_HEIGHT and MAX_FILL_PLOT_HEIGHT. Otherwise the plot is PLOT_HEIGHT tall, as before.
function ActivityChart({ rangeLabel, activityBuckets, fill = false }) {
  const [measuredHeight, setMeasuredHeight] = useState(MIN_FILL_PLOT_HEIGHT);
  const plotHeight = fill ? Math.min(MAX_FILL_PLOT_HEIGHT, Math.max(MIN_FILL_PLOT_HEIGHT, measuredHeight)) : PLOT_HEIGHT;
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
        style={[styles.plotRow, fill && styles.plotRowFill]}
        onLayout={fill ? (event) => setMeasuredHeight(Math.round(event.nativeEvent.layout.height)) : undefined}
        accessible
        accessibilityLabel={`Ride requests per ${range.unit}: ${activityBuckets.map((bucket) => `${bucket.label} ${bucket.value}`).join(", ")}`}
      >
        <View style={[styles.yAxis, { height: plotHeight }]}>
          {ticks.map((tick) => (
            <Text key={tick} style={[styles.yLabel, { bottom: (tick / top) * plotHeight - 10 }]}>
              {tick}
            </Text>
          ))}
        </View>
        <View style={[styles.plot, { height: plotHeight }]}>
          {ticks.map((tick) => (
            <View key={tick} style={[styles.gridLine, { bottom: (tick / top) * plotHeight }]} />
          ))}
          <View style={styles.columns}>
            {activityBuckets.map((bucket) => (
              <View key={bucket.key} style={styles.column}>
                {bucket.value ? <Text style={styles.columnValue}>{bucket.value}</Text> : null}
                <View style={[styles.columnBar, { height: bucket.value ? Math.max(6, (bucket.value / top) * plotHeight) : 0 }]} />
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

// loading = the users, requests, vehicles or applications have not answered yet: grey placeholders instead of 0s.
export default function AdminOverviewSection({
  loading = false,
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
  // Wide window (1280 px and up, e.g. 1366 x 768): the one-screen dashboard, two rows of three cards, no scrolling.
  // Narrower: the cards wrap and the panel scrolls, as before.
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_WINDOW;
  // How tall each bottom card's content is (measured; it grows when words wrap). Both dashboard rows are at least
  // the tallest one plus the card's padding, and never less than the chart card needs (TOP_ROW_MIN_HEIGHT).
  const [bottomContentHeights, setBottomContentHeights] = useState({});
  const measureBottomCard = (key) => (height) =>
    setBottomContentHeights((current) => (current[key] === height ? current : { ...current, [key]: height }));
  const rowMinHeight = Math.max(TOP_ROW_MIN_HEIGHT, Math.max(0, ...Object.values(bottomContentHeights)) + 2 * DASH_CARD_PADDING);

  const totalRequests = numbers.active + numbers.completed + numbers.cancelled;
  const purposeTotal = numbers.medical + numbers.community + numbers.other;
  const purposeMax = Math.max(numbers.medical, numbers.community, numbers.other, 1);
  const purposes = [
    { label: "Medical / Health", value: numbers.medical },
    { label: "Community Activity", value: numbers.community },
    { label: "Other", value: numbers.other },
  ];
  // Both waiting bars use the same scale, so the longer wait has the longer bar.
  const waitScale = Math.max(averageDispatchTime || 0, averageResponseTime || 0, 1) * 1.15;
  const activeSplit = requestStatusStats.map((stat) => `${stat.value} ${stat.label}`).join(" · ");

  const rangeChoices = (
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
  );

  // The six cards. The same cards in both layouts; only where they sit (and how big the titles are) changes.
  const needsAttention = (
    <Section icon="bell-outline" title="Needs attention" color="peach" compact={wide} style={wide ? styles.dashCard : null}>
      <View style={[styles.attentionRow, wide && styles.attentionRowStacked]}>
        <View style={[styles.attentionItem, wide && styles.attentionItemStacked]}>
          <Text style={styles.bigNumber}>{pendingApplicationsCount}</Text>
          <View style={styles.attentionCopy}>
            <Text style={styles.label}>Driver {pendingApplicationsCount === 1 ? "application" : "applications"} waiting</Text>
            <Text style={styles.small}>Review them in Driver Applications.</Text>
          </View>
        </View>
        <View style={[styles.attentionItem, wide && styles.attentionItemStacked]}>
          <Text style={styles.bigNumber}>{numbers.active}</Text>
          <View style={styles.attentionCopy}>
            <Text style={styles.label}>Ride {numbers.active === 1 ? "request" : "requests"} still active</Text>
            <Text style={styles.small}>Not completed or cancelled yet.</Text>
          </View>
        </View>
      </View>
    </Section>
  );

  const rideRequests = (
    <Section icon="van-passenger" title="Ride requests" compact={wide} onContentHeight={wide ? measureBottomCard("rides") : undefined} style={wide ? styles.dashCard : styles.ridesSection}>
      <Text style={styles.body}>
        <Text style={styles.bigNumber}>{totalRequests}</Text>
        <Text style={styles.label}> ride requests in total</Text>
      </Text>

      {/* One bar: orange Active, green Completed, grey Cancelled. Every color also has its word and number below. */}
      <View
        style={[styles.stackBar, wide && styles.stackBarCompact]}
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

      <View style={[styles.legend, wide && styles.legendCompact]}>
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
  );

  const requestsOverTime = (
    <Section
      icon="chart-bar"
      title="Requests over time"
      compact={wide}
      right={wide ? rangeChoices : null}
      style={wide ? [styles.dashCard, styles.dashChartCard] : styles.chartSection}
    >
      {wide ? null : rangeChoices}
      <ActivityChart rangeLabel={rangeLabel} activityBuckets={activityBuckets} fill={wide} />
    </Section>
  );

  const ridePurposes = (
    <Section icon="clipboard-text-outline" title="What rides were for" compact={wide} onContentHeight={wide ? measureBottomCard("purposes") : undefined} style={wide ? styles.dashCard : styles.smallSection}>
      {purposes.map((purpose) => (
        <BarLine
          key={purpose.label}
          label={purpose.label}
          valueText={`${purpose.value} (${getPercent(purpose.value, purposeTotal)}%)`}
          ratio={purpose.value / purposeMax}
        />
      ))}
    </Section>
  );

  const waitingTime = (
    <Section icon="clock-outline" title="Waiting time" compact={wide} onContentHeight={wide ? measureBottomCard("waiting") : undefined} style={wide ? styles.dashCard : styles.smallSection}>
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
  );

  const driversAndVehicles = (
    <Section icon="account-group-outline" title="Drivers and vehicles" compact={wide} onContentHeight={wide ? measureBottomCard("drivers") : undefined} style={wide ? styles.dashCard : styles.smallSection}>
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
  );

  const limitNote = atLimit ? (
    <Text style={styles.small}>
      The totals count every request. The waiting times, the chart, and the Pending / Assigned / In Progress split use only the
      latest {collectionLimit} requests.
    </Text>
  ) : null;

  return (
    <View style={[styles.page, wide && styles.pageWide]}>
      <View style={[styles.header, wide && styles.headerWide]}>
        <View style={[styles.headerBadge, wide && styles.headerBadgeWide]}>
          <MaterialCommunityIcons name="chart-bar" size={wide ? 22 : 24} color={DESIGN_COLORS.paperWhite} />
        </View>
        <View style={[styles.headerCopy, wide && styles.headerCopyWide]}>
          <Text style={styles.title}>Overview</Text>
          <Text style={styles.subtitle}>Ride requests, drivers and vehicles for all of Toledo City.</Text>
        </View>
      </View>

      {loading ? (
        <ListSkeleton rows={3} label="Loading the overview" />
      ) : wide ? (
        // The one-screen dashboard (owner's layout, Oct 19). Top row: Needs attention (1/3) + the chart (2/3).
        // Bottom row: four equal cards. The two rows split the height evenly; the chart fits inside its half.
        // Neither row is ever shorter than rowMinHeight; if the window is too short for that, the panel scrolls instead.
        <>
          <View style={[styles.dashRow, styles.dashRowEqual, { minHeight: rowMinHeight }]}>
            {needsAttention}
            {requestsOverTime}
          </View>
          <View style={[styles.dashRow, styles.dashRowEqual, { minHeight: rowMinHeight }]}>
            {rideRequests}
            {driversAndVehicles}
            {ridePurposes}
            {waitingTime}
          </View>
          {limitNote}
        </>
      ) : (
        <>
          {needsAttention}
          <View style={styles.sectionRow}>
            {rideRequests}
            {requestsOverTime}
          </View>
          <View style={styles.sectionRow}>
            {ridePurposes}
            {waitingTime}
            {driversAndVehicles}
          </View>
          {limitNote}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: "100%", gap: 16, padding: 10 },
  // ---- The one-screen dashboard (wide windows, owner's layout Oct 19): top row Needs attention (1/3) + chart (2/3),
  // growing into the rest of the panel so the chart gets the most space; bottom row four equal cards at their natural
  // height. All text stays 15 or more; long labels wrap instead of shrinking. ----
  pageWide: { flexGrow: 1, gap: 12, padding: 0 },
  headerWide: { gap: 12 },
  headerBadgeWide: { width: 40, height: 40 },
  // Title and subtitle on one line when there is room.
  headerCopyWide: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 12 },
  dashRow: { flexDirection: "row", gap: 12, alignItems: "stretch" },
  // Both rows get an equal share of the height (flexBasis 0); minHeight (in the code) keeps them from getting too short.
  dashRowEqual: { flexGrow: 1, flexBasis: 0 },
  // Equal shares of the row (the chart card gets a bigger share). minWidth 0 lets long words wrap instead of pushing.
  dashCard: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  // The chart card: twice the share of Needs attention (about 2/3 of the row).
  dashChartCard: { flexGrow: 2 },
  sectionCompact: { padding: DASH_CARD_PADDING, gap: 8 },
  // The measured wrapper inside a card (onContentHeight): the same gaps as the card itself.
  sectionInner: { gap: 12 },
  sectionInnerCompact: { gap: 8 },
  sectionBadgeCompact: { width: 28, height: 28 },
  sectionTitleCompact: { fontSize: 17, lineHeight: 22 },
  // The chart choices at the right end of the title line.
  sectionTitleRight: { marginLeft: "auto" },
  // In the tall top row, the two numbers sit in the middle of their card.
  attentionRowStacked: { flexGrow: 1, flexDirection: "column", justifyContent: "center", gap: 16 },
  // A thinner ride bar and closer legend lines in the narrow bottom cards.
  stackBarCompact: { height: 16 },
  legendCompact: { gap: 6 },
  attentionItemStacked: { flexBasis: "auto", flexGrow: 0 },
  // The plot takes the height left in the chart card; the bars sit at its bottom.
  plotRowFill: { flexGrow: 1, minHeight: MIN_FILL_PLOT_HEIGHT, marginTop: 20, alignItems: "flex-end" },
  header: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerBadge: { width: 48, height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: DESIGN_COLORS.hallGreen },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 28, lineHeight: 34, fontFamily: FONT.bold, color: DESIGN_COLORS.ink },
  subtitle: { fontFamily: FONT.regular, marginTop: 2, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted },
  body: { fontFamily: FONT.regular, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.ink },
  label: { fontSize: 17, lineHeight: 22, fontFamily: FONT.semiBold, color: DESIGN_COLORS.ink },
  small: { fontSize: 15, lineHeight: 20, fontFamily: FONT.regular, color: DESIGN_COLORS.inkMuted },
  smallStrong: { fontFamily: FONT.bold, color: DESIGN_COLORS.ink },
  bigNumber: { fontSize: 28, lineHeight: 34, fontFamily: FONT.extraBold, color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },

  // Sections: soft color inside the white panel, 16 corners (DESIGN.md Style: info boxes).
  sectionRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "stretch" },
  section: { padding: 16, gap: 12, borderRadius: CORNER.card, minWidth: 0 },
  greenSection: { backgroundColor: DESIGN_COLORS.boardTint },
  peachSection: { backgroundColor: DESIGN_COLORS.peachTint },
  ridesSection: { flexGrow: 5, flexShrink: 1, flexBasis: 300 },
  chartSection: { flexGrow: 7, flexShrink: 1, flexBasis: 420 },
  smallSection: { flexGrow: 1, flexShrink: 1, flexBasis: 260 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionBadge: { width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  sectionTitle: { flexShrink: 1, fontSize: 22, lineHeight: 28, fontFamily: FONT.bold, color: DESIGN_COLORS.ink },

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
  barLineLabel: { flexShrink: 1 },
  barLineValue: { fontSize: 17, lineHeight: 22, fontFamily: FONT.bold, color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },
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
  rangeChoiceText: { fontSize: 17, fontFamily: FONT.semiBold, color: DESIGN_COLORS.ink },
  rangeChoiceTextSelected: { color: DESIGN_COLORS.paperWhite },

  chartSummary: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", columnGap: 16, rowGap: 4 },
  // The space above the plot leaves room for the number on the tallest column.
  plotRow: { flexDirection: "row", marginTop: 24 },
  yAxis: { width: Y_AXIS_WIDTH, height: PLOT_HEIGHT },
  yLabel: { fontFamily: FONT.regular, position: "absolute", right: 8, fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.inkMuted, fontVariant: ["tabular-nums"] },
  plot: { flex: 1, height: PLOT_HEIGHT },
  gridLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: DESIGN_COLORS.rule },
  columns: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, flexDirection: "row", alignItems: "flex-end" },
  column: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  columnValue: { marginBottom: 4, fontSize: 15, lineHeight: 20, fontFamily: FONT.bold, color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },
  columnBar: { width: 26, borderTopLeftRadius: 999, borderTopRightRadius: 999, backgroundColor: DESIGN_COLORS.hallGreen },
  xLabels: { flexDirection: "row", marginLeft: Y_AXIS_WIDTH, marginTop: 8 },
  xLabel: { fontFamily: FONT.regular, flex: 1, textAlign: "center", fontSize: 15, lineHeight: 20, color: DESIGN_COLORS.inkMuted },
  xLabelLast: { fontFamily: FONT.bold, color: DESIGN_COLORS.ink },
});
