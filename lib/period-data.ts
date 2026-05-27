// period-data.ts — Demo-ready data for each time period (Analytics + SLA)

export type PeriodKey =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "half-yearly"
  | "yearly";

// ── Analytics types ────────────────────────────────────────────────────────

export interface SourceStat   { source: string; count: number }
export interface SeverityStat { severity: string; label: string; count: number; color: string }
export interface ProjectStat  { project: string; code: string; count: number; resolved: number; slaRate: number }

export interface AnalyticsPeriodData {
  key: PeriodKey;
  label: string;
  shortLabel: string;
  dateRange: string;
  // KPIs
  totalLogs: number;
  resolved: number;
  resolutionRate: number;
  p1Count: number;
  p2Count: number;
  p3Count: number;
  p4Count: number;
  avgResolutionH: number;
  slaCompliance: number;
  handoversTotal: number;
  handoverAckRate: number;
  shiftsCompleted: number;
  shiftsOnTime: number;
  // Breakdowns
  bySource: SourceStat[];
  bySeverity: SeverityStat[];
  byProject: ProjectStat[];
}

// ── SLA types ────────────────────────────────────────────────────────────────

export interface SlaPriorityTier {
  priority: "P1" | "P2" | "P3" | "P4";
  label: string;
  color: string;
  headerClass: string;
  ackTarget: string;
  resolveTarget: string;
  ackRate: number;
  resolveRate: number;
  avgAckMin: number;
  avgResolveH: number;
  openCount: number;
  totalCount: number;
  trend: string;
  trendUp: boolean;
}

export interface SlaOverall {
  overallSla: number;
  handoverAck: number;
  avgResolutionH: number;
  shiftsOnTime: number;
}

export interface SlaPeriodData {
  key: PeriodKey;
  label: string;
  shortLabel: string;
  dateRange: string;
  overall: SlaOverall;
  tiers: SlaPriorityTier[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROJECTS: { project: string; code: string }[] = [
  { project: "Checkout + Bag + Composite",           code: "CHECKOUT" },
  { project: "OnlinePayment + Core + CustomerProfile", code: "PAYMENT"  },
  { project: "Browse + Profile",                     code: "BROWSE"   },
  { project: "Buy UI + Ecom FUI",                    code: "BUYUI"    },
  { project: "PT-WebApp",                            code: "WEBAPP"   },
  { project: "DAM",                                  code: "DAM"      },
  { project: "PT-Marketing",                         code: "MKTG"     },
];

// Source weights (PagerDuty, ServiceNow, Slack, Teams, Verbal, Other)
const SRC_W = [28, 22, 20, 15, 10, 5];
// Project distribution weights (7 projects)
const PROJ_W = [22, 18, 17, 15, 12, 10, 6];
// Per-project SLA rates
const PROJ_SLA = [96, 94, 98, 95, 97, 99, 93];

function analyticsData(
  key: PeriodKey,
  label: string,
  shortLabel: string,
  dateRange: string,
  total: number,
  resPct: number,
  p1: number, p2: number, p3: number, p4: number,
  avgResH: number,
  slaPct: number,
  handovers: number,
  handoverAckPct: number,
  shifts: number,
  shiftsOnTimePct: number,
): AnalyticsPeriodData {
  const bySource: SourceStat[] = [
    { source: "PagerDuty",  count: Math.round(total * SRC_W[0] / 100) },
    { source: "ServiceNow", count: Math.round(total * SRC_W[1] / 100) },
    { source: "Slack",      count: Math.round(total * SRC_W[2] / 100) },
    { source: "MS Teams",   count: Math.round(total * SRC_W[3] / 100) },
    { source: "Verbal",     count: Math.round(total * SRC_W[4] / 100) },
    { source: "Other",      count: Math.round(total * SRC_W[5] / 100) },
  ].filter((s) => s.count > 0);

  const infoCount = Math.max(0, total - p1 - p2 - p3 - p4);
  const bySeverity: SeverityStat[] = [
    { severity: "P1_CRITICAL",  label: "P1 Critical", count: p1,        color: "bg-red-500"    },
    { severity: "P2_HIGH",      label: "P2 High",     count: p2,        color: "bg-orange-400" },
    { severity: "P3_MEDIUM",    label: "P3 Medium",   count: p3,        color: "bg-yellow-400" },
    { severity: "P4_LOW",       label: "P4 Low",      count: p4,        color: "bg-blue-400"   },
    { severity: "INFORMATIONAL",label: "Info",        count: infoCount, color: "bg-gray-300"   },
  ].filter((s) => s.count > 0);

  const byProject: ProjectStat[] = PROJECTS.map((proj, i) => {
    const cnt = Math.max(1, Math.round(total * PROJ_W[i] / 100));
    const res = Math.round(cnt * PROJ_SLA[i] / 100);
    return { ...proj, count: cnt, resolved: res, slaRate: PROJ_SLA[i] };
  });

  return {
    key, label, shortLabel, dateRange,
    totalLogs: total,
    resolved: Math.round(total * resPct / 100),
    resolutionRate: resPct,
    p1Count: p1, p2Count: p2, p3Count: p3, p4Count: p4,
    avgResolutionH: avgResH,
    slaCompliance: slaPct,
    handoversTotal: handovers,
    handoverAckRate: handoverAckPct,
    shiftsCompleted: shifts,
    shiftsOnTime: shiftsOnTimePct,
    bySource, bySeverity, byProject,
  };
}

// ── Analytics period datasets ─────────────────────────────────────────────────

export const ANALYTICS_PERIODS: Record<PeriodKey, AnalyticsPeriodData> = {
  daily: analyticsData(
    "daily", "Today", "Daily", "May 20, 2026",
    9, 89, 1, 2, 4, 2, 2.8, 97, 3, 100, 12, 100,
  ),
  weekly: analyticsData(
    "weekly", "This Week", "Weekly", "May 13 – May 19, 2026",
    52, 91, 3, 8, 24, 12, 3.1, 96, 18, 95, 84, 98,
  ),
  monthly: analyticsData(
    "monthly", "This Month", "Monthly", "May 2026",
    198, 93, 12, 31, 91, 48, 3.4, 97, 68, 95, 325, 98,
  ),
  quarterly: analyticsData(
    "quarterly", "Q2 2026", "Quarterly", "Apr – Jun 2026",
    561, 94, 34, 89, 258, 142, 3.6, 96, 196, 95, 975, 98,
  ),
  "half-yearly": analyticsData(
    "half-yearly", "H1 2026", "Half-Yearly", "Jan – Jun 2026",
    1138, 93, 68, 181, 524, 289, 3.8, 95, 398, 94, 1950, 97,
  ),
  yearly: analyticsData(
    "yearly", "FY 2026", "Yearly", "Jan – Dec 2026",
    2276, 92, 136, 362, 1048, 578, 4.0, 95, 796, 94, 3900, 97,
  ),
};

// ── Historical data (for past-period navigation) ─────────────────────────────

/**
 * Daily history — last 7 days (May 19–25, 2026). oldest first.
 * shortLabel stores ISO date "YYYY-MM-DD" (used by calendar picker).
 */
export const DAILY_HISTORY: AnalyticsPeriodData[] = [
  analyticsData("daily", "19 May 2026", "2026-05-19", "May 19, 2026",  7, 86, 0,1,3,2, 2.6, 96, 2,100, 12,100),
  analyticsData("daily", "20 May 2026", "2026-05-20", "May 20, 2026",  9, 89, 1,2,4,2, 2.8, 97, 3,100, 12,100),
  analyticsData("daily", "21 May 2026", "2026-05-21", "May 21, 2026",  8, 88, 0,2,4,2, 2.7, 96, 3,100, 12,100),
  analyticsData("daily", "22 May 2026", "2026-05-22", "May 22, 2026", 11, 91, 1,2,5,3, 2.9, 97, 3,100, 12,100),
  analyticsData("daily", "23 May 2026", "2026-05-23", "May 23, 2026",  6, 83, 0,1,3,2, 3.0, 95, 2,100, 12,100),
  analyticsData("daily", "24 May 2026", "2026-05-24", "May 24, 2026",  5, 80, 0,1,2,2, 2.5, 95, 2,100, 12,100),
  analyticsData("daily", "25 May 2026", "2026-05-25", "May 25, 2026",  9, 89, 1,2,4,2, 2.8, 97, 3,100, 12,100),
];

/**
 * Weekly history — last 6 weeks (oldest first).
 * shortLabel stores ISO Monday date "YYYY-MM-DD" (used by calendar picker).
 */
export const WEEKLY_HISTORY: AnalyticsPeriodData[] = [
  analyticsData("weekly", "14–20 Apr 2026", "2026-04-14", "Apr 14 – Apr 20, 2026", 48,90, 3,7,22,11, 3.2,95, 17,94, 84,97),
  analyticsData("weekly", "21–27 Apr 2026", "2026-04-21", "Apr 21 – Apr 27, 2026", 50,90, 3,8,23,11, 3.1,96, 17,95, 84,98),
  analyticsData("weekly", "28 Apr–4 May 2026","2026-04-28","Apr 28 – May 4, 2026", 51,91, 3,8,23,12, 3.1,96, 18,95, 84,98),
  analyticsData("weekly", "5–11 May 2026",  "2026-05-05", "May 5 – May 11, 2026",  49,90, 3,7,22,12, 3.2,95, 17,94, 84,97),
  analyticsData("weekly", "12–18 May 2026", "2026-05-12", "May 12 – May 18, 2026", 51,91, 3,8,23,12, 3.1,96, 18,95, 84,98),
  analyticsData("weekly", "19–25 May 2026", "2026-05-19", "May 19 – May 25, 2026", 52,91, 3,8,24,12, 3.1,96, 18,95, 84,98),
];

/** Yearly history — oldest first, current last */
export const YEARLY_HISTORY: AnalyticsPeriodData[] = [
  analyticsData("yearly", "FY 2023", "Yearly", "Jan – Dec 2023",
    1420, 89, 88, 228, 652, 360, 4.8, 91, 496, 90, 2430, 94),
  analyticsData("yearly", "FY 2024", "Yearly", "Jan – Dec 2024",
    1682, 91, 104, 268, 774, 428, 4.5, 92, 588, 92, 2880, 95),
  analyticsData("yearly", "FY 2025", "Yearly", "Jan – Dec 2025",
    1980, 92, 120, 316, 912, 504, 4.2, 94, 698, 93, 3412, 96),
  analyticsData("yearly", "FY 2026", "Yearly", "Jan – Dec 2026",
    2276, 92, 136, 362, 1048, 578, 4.0, 95, 796, 94, 3900, 97),
];

/** Quarterly history — oldest first, current last */
export const QUARTERLY_HISTORY: AnalyticsPeriodData[] = [
  analyticsData("quarterly", "Q3 2025", "Quarterly", "Jul – Sep 2025",
    474, 92, 28, 76, 218, 120, 3.9, 94, 166, 93, 860, 96),
  analyticsData("quarterly", "Q4 2025", "Quarterly", "Oct – Dec 2025",
    512, 93, 31, 82, 236, 130, 3.8, 95, 178, 94, 924, 97),
  analyticsData("quarterly", "Q1 2026", "Quarterly", "Jan – Mar 2026",
    539, 93, 32, 86, 248, 136, 3.7, 95, 188, 94, 948, 97),
  analyticsData("quarterly", "Q2 2026", "Quarterly", "Apr – Jun 2026",
    561, 94, 34, 89, 258, 142, 3.6, 96, 196, 95, 975, 98),
];

/** Monthly history — oldest first, current last */
export const MONTHLY_HISTORY: AnalyticsPeriodData[] = [
  analyticsData("monthly", "Dec 2025", "Monthly", "Dec 2025",
    162, 91, 10, 26, 74, 40, 3.7, 95, 56, 94, 296, 97),
  analyticsData("monthly", "Jan 2026", "Monthly", "Jan 2026",
    168, 92, 10, 27, 77, 42, 3.6, 96, 58, 94, 306, 97),
  analyticsData("monthly", "Feb 2026", "Monthly", "Feb 2026",
    174, 92, 11, 28, 80, 43, 3.5, 96, 60, 95, 312, 98),
  analyticsData("monthly", "Mar 2026", "Monthly", "Mar 2026",
    183, 93, 11, 29, 84, 46, 3.5, 97, 63, 95, 318, 98),
  analyticsData("monthly", "Apr 2026", "Monthly", "Apr 2026",
    191, 93, 12, 30, 88, 47, 3.4, 97, 66, 95, 322, 98),
  analyticsData("monthly", "May 2026", "Monthly", "May 2026",
    198, 93, 12, 31, 91, 48, 3.4, 97, 68, 95, 325, 98),
];

// ── SLA period datasets ───────────────────────────────────────────────────────

function slaTier(
  priority: "P1" | "P2" | "P3" | "P4",
  label: string,
  color: string,
  headerClass: string,
  ackTarget: string,
  resolveTarget: string,
  ackRate: number,
  resolveRate: number,
  avgAckMin: number,
  avgResolveH: number,
  openCount: number,
  totalCount: number,
  trend: string,
  trendUp: boolean,
): SlaPriorityTier {
  return { priority, label, color, headerClass, ackTarget, resolveTarget, ackRate, resolveRate, avgAckMin, avgResolveH, openCount, totalCount, trend, trendUp };
}

function makeSlaData(
  key: PeriodKey,
  label: string,
  shortLabel: string,
  dateRange: string,
  overall: SlaOverall,
  p1: [number, number, number, number, number, number],
  p2: [number, number, number, number, number, number],
  p3: [number, number, number, number, number, number],
  p4: [number, number, number, number, number, number],
  trends: [string, boolean, string, boolean, string, boolean, string, boolean],
): SlaPeriodData {
  return {
    key, label, shortLabel, dateRange, overall,
    tiers: [
      slaTier("P1", "Critical", "red",    "bg-red-600",    "≤ 15 min", "≤ 4 h",  p1[0], p1[1], p1[2], p1[3], p1[4], p1[5], trends[0], trends[1]),
      slaTier("P2", "High",     "orange", "bg-orange-500", "≤ 1 h",    "≤ 8 h",  p2[0], p2[1], p2[2], p2[3], p2[4], p2[5], trends[2], trends[3]),
      slaTier("P3", "Medium",   "yellow", "bg-yellow-500", "≤ 4 h",    "≤ 24 h", p3[0], p3[1], p3[2], p3[3], p3[4], p3[5], trends[4], trends[5]),
      slaTier("P4", "Low / SR", "blue",   "bg-blue-500",   "≤ 24 h",   "≤ 72 h", p4[0], p4[1], p4[2], p4[3], p4[4], p4[5], trends[6], trends[7]),
    ],
  };
}

// Args per P* tier: [ackRate, resolveRate, avgAckMin, avgResolveH, openCount, totalCount]
export const SLA_PERIODS: Record<PeriodKey, SlaPeriodData> = {
  daily: makeSlaData(
    "daily", "Today", "Daily", "May 20, 2026",
    { overallSla: 98, handoverAck: 100, avgResolutionH: 2.6, shiftsOnTime: 100 },
    [97, 95, 8,   2.4, 1, 3 ],
    [99, 97, 14,  2.9, 1, 5 ],
    [100,99, 38,  6.8, 1, 9 ],
    [100,100,82, 15.1, 0, 7 ],
    ["+5% vs yesterday", true, "+2% vs yesterday", true, "Stable", true, "Stable", true],
  ),
  weekly: makeSlaData(
    "weekly", "This Week", "Weekly", "May 13 – May 19, 2026",
    { overallSla: 97, handoverAck: 95, avgResolutionH: 4.1, shiftsOnTime: 98 },
    [94, 91,  9,  2.8, 2, 34],
    [97, 95,  18, 3.4, 3, 61],
    [99, 98,  42, 8.1, 4, 88],
    [100,99,  95,18.3, 2, 45],
    ["+3% vs last week", true, "+1% vs last week", true, "Stable", true, "Stable", true],
  ),
  monthly: makeSlaData(
    "monthly", "This Month", "Monthly", "May 2026",
    { overallSla: 96, handoverAck: 95, avgResolutionH: 4.4, shiftsOnTime: 98 },
    [93, 90, 11, 3.1, 4,  142],
    [96, 94, 22, 3.7, 6,  253],
    [98, 97, 48, 8.9, 8,  362],
    [99, 98,102,19.4, 3,  187],
    ["+1% vs last month", true, "Stable", true, "Stable", true, "+1% vs last month", true],
  ),
  quarterly: makeSlaData(
    "quarterly", "Q2 2026", "Quarterly", "Apr – Jun 2026",
    { overallSla: 95, handoverAck: 94, avgResolutionH: 4.7, shiftsOnTime: 97 },
    [92, 89, 12, 3.3, 8,  412],
    [95, 92, 24, 3.9, 11, 734],
    [97, 96, 52, 9.2,14, 1048],
    [98, 97,108,20.1, 6,  542],
    ["Q1→Q2 +2%", true, "Stable", true, "Stable", true, "Stable", true],
  ),
  "half-yearly": makeSlaData(
    "half-yearly", "H1 2026", "Half-Yearly", "Jan – Jun 2026",
    { overallSla: 95, handoverAck: 94, avgResolutionH: 4.9, shiftsOnTime: 97 },
    [91, 88, 13, 3.5, 12,  824],
    [94, 91, 25, 4.1, 18, 1468],
    [97, 95, 55, 9.6,22, 2096],
    [98, 97,112,21.0, 9, 1084],
    ["Improving trend", true, "Stable", true, "Stable", true, "+1% vs H2 2025", true],
  ),
  yearly: makeSlaData(
    "yearly", "FY 2026", "Yearly", "Jan – Dec 2026",
    { overallSla: 94, handoverAck: 93, avgResolutionH: 5.1, shiftsOnTime: 96 },
    [90, 87, 14, 3.6, 22, 1648],
    [93, 90, 26, 4.3, 32, 2936],
    [96, 94, 57, 9.9,40, 4192],
    [97, 96,115,21.8,16, 2168],
    ["+2% vs FY2025", true, "+1% vs FY2025", true, "Stable", true, "Stable", true],
  ),
};

export const PERIOD_ORDER: PeriodKey[] = [
  "daily", "weekly", "monthly", "quarterly", "half-yearly", "yearly",
];

// ── CSV export utility ────────────────────────────────────────────────────────

export function exportAnalyticsCSV(data: AnalyticsPeriodData): void {
  const rows: string[] = [
    `ShiftBuddy — Analytics Report`,
    `Period,${data.label}`,
    `Date Range,${data.dateRange}`,
    `Exported,"${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST"`,
    ``,
    `KPI Metrics`,
    `Metric,Value`,
    `Total Logs,${data.totalLogs}`,
    `Resolved,${data.resolved}`,
    `Resolution Rate,${data.resolutionRate}%`,
    `P1 Critical,${data.p1Count}`,
    `P2 High,${data.p2Count}`,
    `P3 Medium,${data.p3Count}`,
    `P4 Low,${data.p4Count}`,
    `Avg Resolution Time,${data.avgResolutionH}h`,
    `SLA Compliance,${data.slaCompliance}%`,
    `Handovers Total,${data.handoversTotal}`,
    `Handover Ack Rate,${data.handoverAckRate}%`,
    `Shifts Completed,${data.shiftsCompleted}`,
    `Shifts On-Time,${data.shiftsOnTime}%`,
    ``,
    `Logs by Source`,
    `Source,Count`,
    ...data.bySource.map((s) => `${s.source},${s.count}`),
    ``,
    `Logs by Severity`,
    `Severity,Count`,
    ...data.bySeverity.map((s) => `${s.label},${s.count}`),
    ``,
    `By Project`,
    `Project,Code,Total,Resolved,SLA Rate`,
    ...data.byProject.map((p) => `"${p.project}",${p.code},${p.count},${p.resolved},${p.slaRate}%`),
  ];

  triggerDownload(
    rows.join("\n"),
    `shiftbuddy-analytics-${data.key}-${today()}.csv`,
  );
}

export function exportSlaCSV(data: SlaPeriodData): void {
  const rows: string[] = [
    `ShiftBuddy — SLA Compliance Report`,
    `Period,${data.label}`,
    `Date Range,${data.dateRange}`,
    `Exported,"${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST"`,
    ``,
    `Overall SLA Metrics`,
    `Metric,Value`,
    `Overall SLA Compliance,${data.overall.overallSla}%`,
    `Handover Ack SLA,${data.overall.handoverAck}%`,
    `Avg Resolution Time,${data.overall.avgResolutionH}h`,
    `Shifts On-Time,${data.overall.shiftsOnTime}%`,
    ``,
    `Priority Tier Breakdown`,
    `Priority,Label,Ack SLA,Resolve SLA,Avg Ack (min),Avg Resolve (h),Open,Total,Trend`,
    ...data.tiers.map((t) =>
      `${t.priority},${t.label},${t.ackRate}%,${t.resolveRate}%,${t.avgAckMin},${t.avgResolveH},${t.openCount},${t.totalCount},"${t.trend}"`,
    ),
  ];

  triggerDownload(
    rows.join("\n"),
    `shiftbuddy-sla-${data.key}-${today()}.csv`,
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function triggerDownload(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
