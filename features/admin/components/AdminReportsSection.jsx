import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DESIGN_COLORS } from "../../../constants/design";
import { formatDate, getAverageDuration, getDurationLabel, getTimestampMillis } from "../../../lib/dates";

// Light grey for "Cancelled", the same as the Overview ride bar.
const CANCELLED_GREY = "#B9C6C0";
const PRIORITIES = ["Emergency", "Urgent", "Non-Urgent", "Planned"];
// The columns in the CSV file (they match exportRequests in AdminOperationsPanel).
const CSV_COLUMNS = ["Request ID", "Status", "Priority", "Barangay", "Submitted", "Completed"];

const getPercent = (value, total) => (total ? Math.round((value / total) * 100) : 0);

// "Bato, Toledo City" becomes "Bato": every barangay here is in Toledo City.
const getBarangayName = (request) => (request.barangay ? request.barangay.replace(", Toledo City", "") : "");

// The first and last day of the loaded requests, like "Aug 14, 2026 – Oct 6, 2026".
const getDateRange = (requests) => {
  const times = requests.map((request) => getTimestampMillis(request.createdAt)).filter(Boolean);
  if (!times.length) {
    return "";
  }
  return `${formatDate(Math.min(...times))} – ${formatDate(Math.max(...times))}`;
};

// The 5 barangays with the most requests, biggest first.
const getTopBarangays = (requests) => {
  const counts = {};
  requests.forEach((request) => {
    const name = getBarangayName(request);
    if (name) {
      counts[name] = (counts[name] || 0) + 1;
    }
  });
  return Object.entries(counts)
    .sort((first, second) => second[1] - first[1])
    .slice(0, 5);
};

// A section on its own soft color with a round icon badge, like Overview.
function Section({ icon, title, color = "green", children, style }) {
  const orange = color === "peach";
  return (
    <View style={[styles.section, orange && styles.peachSection, style]}>
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

// One label, its number, and a bar under it.
function BarLine({ label, valueText, percentText, ratio, barColor = DESIGN_COLORS.hallGreen }) {
  return (
    <View>
      <View style={styles.barLineTop}>
        <Text style={[styles.label, styles.barLineLabel]}>{label}</Text>
        <Text style={styles.barLineValue}>
          {valueText}
          {percentText ? <Text style={styles.small}> ({percentText})</Text> : null}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(100, Math.max(0, ratio * 100))}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

function LegendRow({ color, label, value, total }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.label, styles.legendLabel]}>{label}</Text>
      <Text style={styles.barLineValue}>
        {value} <Text style={styles.small}>({getPercent(value, total)}%)</Text>
      </Text>
    </View>
  );
}

export default function AdminReportsSection({ requests, onDownload }) {
  const total = requests.length;
  const countStatus = (status) => requests.filter((request) => (request.status || "Pending") === status).length;
  const completed = countStatus("Completed");
  const cancelled = countStatus("Cancelled");
  const pending = countStatus("Pending");
  const assigned = countStatus("Assigned");
  const inProgress = countStatus("In Progress");
  const active = pending + assigned + inProgress;
  const finished = completed + cancelled;

  // Same averages as Overview, plus the time until the ride is completed.
  const waitingTimes = [
    { label: "Until a driver is assigned", value: getAverageDuration(requests, ["assignedAt"]) },
    { label: "Until the driver accepts", value: getAverageDuration(requests, ["acceptedAt", "completedAt"]) },
    { label: "Until the ride is completed", value: getAverageDuration(requests, ["completedAt"]) },
  ];
  // All three bars use the same scale, so the longest wait has the longest bar.
  const waitScale = Math.max(...waitingTimes.map((time) => time.value || 0), 1) * 1.1;

  const priorities = PRIORITIES.map((priority) => ({
    label: priority,
    value: requests.filter((request) => (request.priorityLevel || request.level) === priority).length,
  }));
  const priorityMax = Math.max(...priorities.map((priority) => priority.value), 1);

  const topBarangays = getTopBarangays(requests);
  const barangayMax = Math.max(...topBarangays.map((entry) => entry[1]), 1);
  const inTopBarangays = topBarangays.reduce((sum, entry) => sum + entry[1], 0);
  const withoutBarangay = requests.filter((request) => !getBarangayName(request)).length;
  const otherBarangays = total - inTopBarangays - withoutBarangay;

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <MaterialCommunityIcons name="file-chart-outline" size={24} color={DESIGN_COLORS.paperWhite} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Reports</Text>
          <Text style={styles.subtitle}>
            Numbers from the ride requests loaded in the Admin console. Download them as a spreadsheet file below.
          </Text>
        </View>
      </View>

      {!total ? (
        <View style={styles.emptyState}>
          <Text style={styles.label}>No ride requests are loaded yet.</Text>
          <Text style={styles.small}>Reports appear here once residents send ride requests.</Text>
        </View>
      ) : (
        <>
          {/* Where the numbers come from: the date range and how many requests. */}
          <View style={styles.period}>
            <View style={styles.periodBadge}>
              <MaterialCommunityIcons name="calendar-range" size={17} color={DESIGN_COLORS.paperWhite} />
            </View>
            <Text style={styles.periodText}>
              {getDateRange(requests)} · {total} {total === 1 ? "request" : "requests"}
            </Text>
          </View>

          <View style={styles.sectionRow}>
            <Section icon="check-circle-outline" title="How requests ended" style={styles.wideSection}>
              <View style={styles.rateBox}>
                <Text style={styles.bigNumber}>{getPercent(completed, finished)}%</Text>
                <Text style={styles.label}>of finished rides were completed</Text>
                <Text style={styles.small}>
                  ({completed} of {finished})
                </Text>
              </View>

              {/* One bar: green Completed, grey Cancelled, orange Still active. Every color also has its word below. */}
              <View
                style={styles.stackBar}
                accessible
                accessibilityLabel={`${completed} completed, ${cancelled} cancelled, ${active} still active`}
              >
                {completed ? <View style={[styles.stackPart, { flex: completed, backgroundColor: DESIGN_COLORS.hallGreen }]} /> : null}
                {cancelled ? <View style={[styles.stackPart, { flex: cancelled, backgroundColor: CANCELLED_GREY }]} /> : null}
                {active ? <View style={[styles.stackPart, { flex: active, backgroundColor: DESIGN_COLORS.sakayOrange }]} /> : null}
              </View>

              <View style={styles.legend}>
                <LegendRow color={DESIGN_COLORS.hallGreen} label="Completed" value={completed} total={total} />
                <LegendRow color={CANCELLED_GREY} label="Cancelled" value={cancelled} total={total} />
                <View>
                  <LegendRow color={DESIGN_COLORS.sakayOrange} label="Still active" value={active} total={total} />
                  <Text style={[styles.small, styles.legendSub]}>
                    {pending} Pending · {assigned} Assigned · {inProgress} In Progress
                  </Text>
                </View>
              </View>
            </Section>

            <Section icon="clock-outline" title="Waiting time" style={styles.smallSection}>
              <Text style={styles.small}>Average, counted from when the request was sent.</Text>
              {waitingTimes.map((time) => (
                <BarLine key={time.label} label={time.label} valueText={getDurationLabel(time.value)} ratio={(time.value || 0) / waitScale} />
              ))}
            </Section>
          </View>

          <View style={styles.sectionRow}>
            <Section icon="flag-outline" title="Requests by priority" style={styles.smallSection}>
              {priorities.map((priority) => (
                <BarLine
                  key={priority.label}
                  label={priority.label}
                  valueText={priority.value}
                  percentText={`${getPercent(priority.value, total)}%`}
                  ratio={priority.value / priorityMax}
                  barColor={priority.label === "Emergency" ? DESIGN_COLORS.emergencyRed : DESIGN_COLORS.hallGreen}
                />
              ))}
              <Text style={styles.small}>Emergency includes rides dispatchers made from Emergency alerts.</Text>
            </Section>

            <Section icon="map-marker-outline" title="Top 5 barangays" style={styles.smallSection}>
              {topBarangays.length ? (
                topBarangays.map(([name, value]) => (
                  <BarLine key={name} label={name} valueText={value} percentText={`${getPercent(value, total)}%`} ratio={value / barangayMax} />
                ))
              ) : (
                <Text style={styles.body}>No barangay is saved on these requests.</Text>
              )}
              {otherBarangays > 0 ? (
                <Text style={styles.small}>
                  {otherBarangays} {otherBarangays === 1 ? "request" : "requests"} came from other barangays.
                </Text>
              ) : null}
              {withoutBarangay > 0 ? (
                <Text style={styles.small}>
                  {withoutBarangay} {withoutBarangay === 1 ? "request has" : "requests have"} no barangay saved.
                </Text>
              ) : null}
            </Section>
          </View>

          <Section icon="tray-arrow-down" title="Download the request list" color="peach">
            <View style={styles.download}>
              <View style={styles.downloadCopy}>
                <Text style={styles.body}>
                  A spreadsheet file (CSV) of the {total} {total === 1 ? "request" : "requests"} above, one row per request, with these
                  columns:
                </Text>
                <View style={styles.columns}>
                  {CSV_COLUMNS.map((column) => (
                    <View key={column} style={styles.columnTag}>
                      <Text style={styles.columnTagText}>{column}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.small}>Works on the website. On the phone app, open the website to download.</Text>
              </View>
              <Pressable
                onPress={onDownload}
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                accessibilityRole="button"
                accessibilityLabel="Download CSV"
              >
                <MaterialCommunityIcons name="download" size={20} color={DESIGN_COLORS.paperWhite} />
                <Text style={styles.buttonText}>Download CSV</Text>
              </Pressable>
            </View>
          </Section>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: "100%", gap: 16, paddingVertical: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerBadge: { width: 48, height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: DESIGN_COLORS.hallGreen },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: DESIGN_COLORS.ink },
  subtitle: { marginTop: 2, fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.inkMuted },
  body: { fontSize: 17, lineHeight: 24, color: DESIGN_COLORS.ink },
  label: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: DESIGN_COLORS.ink },
  small: { fontSize: 15, lineHeight: 20, fontWeight: "400", color: DESIGN_COLORS.inkMuted },
  bigNumber: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },

  period: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingLeft: 6, paddingRight: 14, borderRadius: 999, backgroundColor: DESIGN_COLORS.boardTint },
  periodBadge: { width: 28, height: 28, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: DESIGN_COLORS.hallGreen },
  periodText: { flexShrink: 1, fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },

  // Sections: soft color inside the white panel, 24 corners (DESIGN.md).
  sectionRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "stretch" },
  section: { padding: 16, gap: 14, borderRadius: 24, minWidth: 0, backgroundColor: DESIGN_COLORS.boardTint },
  peachSection: { backgroundColor: DESIGN_COLORS.peachTint },
  wideSection: { flexGrow: 7, flexShrink: 1, flexBasis: 420 },
  smallSection: { flexGrow: 1, flexShrink: 1, flexBasis: 300 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionBadge: { width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  sectionTitle: { flexShrink: 1, fontSize: 22, lineHeight: 28, fontWeight: "800", color: DESIGN_COLORS.ink },

  rateBox: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 10, rowGap: 2, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: DESIGN_COLORS.paperWhite },
  stackBar: { flexDirection: "row", height: 28, gap: 2, borderRadius: 999, overflow: "hidden", backgroundColor: DESIGN_COLORS.paperWhite },
  stackPart: { minWidth: 6 },
  legend: { gap: 10 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendDot: { width: 16, height: 16, borderRadius: 999 },
  legendLabel: { flex: 1 },
  legendSub: { marginLeft: 26 },

  barLineTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  barLineLabel: { flexShrink: 1 },
  barLineValue: { fontSize: 17, lineHeight: 22, fontWeight: "800", color: DESIGN_COLORS.ink, fontVariant: ["tabular-nums"] },
  barTrack: { height: 14, borderRadius: 999, overflow: "hidden", backgroundColor: DESIGN_COLORS.paperWhite },
  barFill: { height: "100%", borderRadius: 999 },

  download: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 16 },
  downloadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0, gap: 8 },
  columns: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  columnTag: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, backgroundColor: DESIGN_COLORS.paperWhite },
  columnTagText: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: DESIGN_COLORS.ink },
  button: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: DESIGN_COLORS.hallGreen,
  },
  buttonPressed: { backgroundColor: DESIGN_COLORS.hallGreenDeep },
  buttonText: { fontSize: 17, fontWeight: "700", color: DESIGN_COLORS.paperWhite },

  emptyState: { padding: 20, borderRadius: 24, alignItems: "center", gap: 8, backgroundColor: DESIGN_COLORS.boardTint },
});
