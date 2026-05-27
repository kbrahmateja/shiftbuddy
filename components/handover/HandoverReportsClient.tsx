"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Users, TrendingUp, AlertTriangle, BarChart2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type Period = "today" | "week" | "month" | "quarter" | "halfyear" | "year";

interface HandoverRow {
  id: string;
  date: string;           // YYYY-MM-DD
  shiftFrom: string;
  shiftTo: string;
  leadName: string;
  project: string;
  status: "SUBMITTED" | "ACKNOWLEDGED" | "DISPUTED";
  presentCount: number;
  totalCount: number;
  slaMinutes: number | null;   // null = not yet acknowledged
  openItemsCount: number;
  hasActingLead: boolean;
}

// ── Seed data generation ───────────────────────────────────────────────────────

const LEADS = ["Ankit Singh", "Prateek Agarwal", "MadhaviLatha K"];
const PROJECTS = ["Payment Core", "Browse + Profile", "Checkout + Bag", "Buy UI", "PT-WebApp"];
const TRANSITIONS = [
  { from: "S1 · Morning", to: "S2 · Afternoon" },
  { from: "S2 · Afternoon", to: "S3 · Night" },
  { from: "S3 · Night", to: "S1 · Morning" },
];

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function seededRand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// offsetDays: how many period-units back (0 = current, 1 = last, 2 = two ago…)
function generateRows(days: number, offsetDays = 0): HandoverRow[] {
  const rows: HandoverRow[] = [];
  const startDaysAgo = offsetDays * days;

  for (let d = 0; d < days; d++) {
    const totalDaysAgo = startDaysAgo + d;
    const ds = dateStr(totalDaysAgo);
    TRANSITIONS.forEach((tr, ti) => {
      const seed = (totalDaysAgo + 1) * 10 + ti;
      const r = seededRand(seed);
      const leadIdx = Math.floor(seededRand(seed + 1) * LEADS.length);
      const projIdx = Math.floor(seededRand(seed + 2) * PROJECTS.length);
      const total = 5 + Math.floor(seededRand(seed + 3) * 3);
      const present = total - Math.floor(seededRand(seed + 4) * 2);
      const slaOk = r > 0.15;
      // Today's last 2 handovers are still SUBMITTED (not yet acknowledged)
      const isFuture = totalDaysAgo === 0 && ti > 0;
      const status: HandoverRow["status"] = isFuture
        ? "SUBMITTED"
        : r > 0.05 ? "ACKNOWLEDGED" : "DISPUTED";

      rows.push({
        id: `h_${totalDaysAgo}_${ti}`,
        date: ds,
        shiftFrom: tr.from,
        shiftTo: tr.to,
        leadName: LEADS[leadIdx],
        project: PROJECTS[projIdx],
        status,
        presentCount: present,
        totalCount: total,
        slaMinutes: status === "ACKNOWLEDGED"
          ? (slaOk ? Math.floor(seededRand(seed + 5) * 25 + 5) : Math.floor(seededRand(seed + 5) * 30 + 31))
          : null,
        openItemsCount: Math.floor(seededRand(seed + 6) * 4),
        hasActingLead: seededRand(seed + 7) > 0.85,
      });
    });
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.shiftFrom.localeCompare(b.shiftFrom));
}

// ── Navigation label helpers ───────────────────────────────────────────────────

function getPeriodLabel(period: Period, offset: number): string {
  const now = new Date();
  if (period === "today") {
    const d = new Date(now); d.setDate(d.getDate() - offset);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  if (period === "week") {
    const start = new Date(now); start.setDate(start.getDate() - offset * 7 - 6);
    const end   = new Date(now); end.setDate(end.getDate() - offset * 7);
    return `${start.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
  }
  if (period === "month") {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }
  if (period === "quarter") {
    const qMonth = now.getMonth() - offset * 3;
    const d = new Date(now.getFullYear(), qMonth, 1);
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `Q${q} ${d.getFullYear()}`;
  }
  if (period === "halfyear") {
    const hMonth = now.getMonth() - offset * 6;
    const d = new Date(now.getFullYear(), hMonth, 1);
    const h = d.getMonth() < 6 ? "H1" : "H2";
    return `${h} ${d.getFullYear()}`;
  }
  // year
  return String(now.getFullYear() - offset);
}

// ── Period config ──────────────────────────────────────────────────────────────

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: "today",    label: "Today",       days: 1   },
  { key: "week",     label: "This Week",   days: 7   },
  { key: "month",    label: "This Month",  days: 30  },
  { key: "quarter",  label: "Quarterly",   days: 90  },
  { key: "halfyear", label: "Half-Yearly", days: 180 },
  { key: "year",     label: "Yearly",      days: 365 },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED:    "bg-amber-100 text-amber-800",
  ACKNOWLEDGED: "bg-emerald-100 text-emerald-700",
  DISPUTED:     "bg-red-100 text-red-700",
};

function StatCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 flex items-start gap-4">
      <div className={cn("rounded-lg p-2.5", color)}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Mini bar chart ─────────────────────────────────────────────────────────────

function TrendBars({ rows, period }: { rows: HandoverRow[]; period: Period }) {
  // Group by date, count handovers per date
  const byDate = new Map<string, number>();
  rows.forEach(r => byDate.set(r.date, (byDate.get(r.date) ?? 0) + 1));
  const entries = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  // Limit to last N bars based on period
  const maxBars = period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 12;
  const sliced = period === "quarter" || period === "halfyear" || period === "year"
    ? (() => {
        // Group into weeks for longer periods
        const weekly = new Map<string, number>();
        entries.forEach(([date, cnt]) => {
          const d = new Date(date);
          const weekNum = Math.floor((entries.findIndex(e => e[0] === date)) / 7);
          const key = `W${weekNum}`;
          weekly.set(key, (weekly.get(key) ?? 0) + cnt);
        });
        return Array.from(weekly.entries()).slice(-maxBars);
      })()
    : entries.slice(-maxBars);

  const maxVal = Math.max(...sliced.map(e => e[1]), 1);

  return (
    <div className="rounded-xl border bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-indigo-500" />
        Handovers Over Time
      </h3>
      <div className="flex items-end gap-1 h-24">
        {sliced.map(([label, count]) => (
          <div key={label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-[9px] text-gray-400">{count}</span>
            <div
              className="w-full rounded-sm bg-indigo-400"
              style={{ height: `${(count / maxVal) * 72}px` }}
            />
            <span className="text-[8px] text-gray-300 truncate w-full text-center">
              {label.length > 5 ? label.slice(5) : label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Project breakdown ──────────────────────────────────────────────────────────

function ProjectBreakdown({ rows }: { rows: HandoverRow[] }) {
  const byProject = new Map<string, { total: number; ack: number; disputed: number }>();
  rows.forEach(r => {
    const cur = byProject.get(r.project) ?? { total: 0, ack: 0, disputed: 0 };
    byProject.set(r.project, {
      total: cur.total + 1,
      ack: cur.ack + (r.status === "ACKNOWLEDGED" ? 1 : 0),
      disputed: cur.disputed + (r.status === "DISPUTED" ? 1 : 0),
    });
  });

  return (
    <div className="rounded-xl border bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">By Project</h3>
      <div className="space-y-2">
        {Array.from(byProject.entries()).map(([proj, stats]) => {
          const pct = Math.round((stats.ack / stats.total) * 100);
          return (
            <div key={proj}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-700 font-medium truncate">{proj}</span>
                <span className="text-gray-400 ml-2 shrink-0">{stats.total} handovers · {pct}% ack</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-400" : pct >= 80 ? "bg-indigo-400" : "bg-amber-400")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function HandoverReportsClient() {
  const [period, setPeriod] = useState<Period>("today");
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const config = PERIODS.find(p => p.key === period)!;
  const allRows = useMemo(() => generateRows(config.days, offset), [config.days, offset]);

  function handlePeriodChange(p: Period) { setPeriod(p); setOffset(0); }

  const filteredRows = statusFilter === "ALL"
    ? allRows
    : allRows.filter(r => r.status === statusFilter);

  // ── Aggregate stats ──
  const total = allRows.length;
  const acknowledged = allRows.filter(r => r.status === "ACKNOWLEDGED").length;
  const disputed = allRows.filter(r => r.status === "DISPUTED").length;
  const ackPct = total ? Math.round((acknowledged / total) * 100) : 0;
  const slaRows = allRows.filter(r => r.slaMinutes !== null);
  const slaMet = slaRows.filter(r => r.slaMinutes! <= 30).length;
  const slaPct = slaRows.length ? Math.round((slaMet / slaRows.length) * 100) : 0;
  const avgAttendance = total
    ? Math.round(allRows.reduce((s, r) => s + (r.presentCount / r.totalCount) * 100, 0) / total)
    : 0;
  const openCarryOvers = allRows.reduce((s, r) => s + r.openItemsCount, 0);

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard/handovers" className="text-sm text-indigo-600 hover:underline">
              ← Handovers
            </Link>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Handover Reports</h1>
          <p className="mt-0.5 text-sm text-gray-500">Aggregated shift handover analytics across periods.</p>
        </div>
        <Link href="/dashboard/handovers/report"
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Print Report
        </Link>
      </div>

      {/* Period tabs + date navigation */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 flex-wrap">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => handlePeriodChange(p.key)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
                period === p.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Prev / label / Next */}
        <div className="flex items-center gap-1 rounded-xl border bg-white px-2 py-1">
          <button
            onClick={() => setOffset(o => o + 1)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
            title="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium text-gray-700">
            {getPeriodLabel(period, offset)}
          </span>
          <button
            onClick={() => setOffset(o => Math.max(0, o - 1))}
            disabled={offset === 0}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-4 w-4 text-indigo-600" />}
          label="Total Handovers"
          value={String(total)}
          sub={`${acknowledged} acknowledged`}
          color="bg-indigo-50"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          label="Acknowledged %"
          value={`${ackPct}%`}
          sub={disputed > 0 ? `${disputed} disputed` : "No disputes"}
          color="bg-emerald-50"
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-amber-600" />}
          label="SLA Met (≤30 min)"
          value={`${slaPct}%`}
          sub={`${slaMet}/${slaRows.length} acknowledged`}
          color="bg-amber-50"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
          label="Avg Attendance"
          value={`${avgAttendance}%`}
          sub={`${openCarryOvers} open item carry-overs`}
          color="bg-blue-50"
        />
      </div>

      {/* Chart + breakdown row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TrendBars rows={allRows} period={period} />
        </div>
        <ProjectBreakdown rows={allRows} />
      </div>

      {/* Handover table */}
      <div className="rounded-xl border bg-white">
        <div className="flex items-center justify-between px-5 py-3.5 border-b flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-700">
            Handover Records{" "}
            <span className="font-normal text-gray-400">({filteredRows.length})</span>
          </h2>
          {/* Status filter */}
          <div className="flex gap-1.5 text-xs">
            {["ALL", "SUBMITTED", "ACKNOWLEDGED", "DISPUTED"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-full px-3 py-0.5 font-medium border transition-colors",
                  statusFilter === s
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "text-gray-500 border-gray-200 hover:border-gray-300"
                )}
              >
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">No handovers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500 text-left">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Shift</th>
                  <th className="px-4 py-2.5 font-semibold">Lead</th>
                  <th className="px-4 py-2.5 font-semibold">Project</th>
                  <th className="px-4 py-2.5 font-semibold text-center">Attendance</th>
                  <th className="px-4 py-2.5 font-semibold text-center">SLA</th>
                  <th className="px-4 py-2.5 font-semibold text-center">Open Items</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRows.map(row => {
                  const attPct = Math.round((row.presentCount / row.totalCount) * 100);
                  const slaOk = row.slaMinutes !== null && row.slaMinutes <= 30;
                  return (
                    <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                        {new Date(row.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                        <span className="text-gray-400">{row.shiftFrom.split(" ")[0]}</span>
                        {" → "}
                        <span className="text-gray-400">{row.shiftTo.split(" ")[0]}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-800 font-medium whitespace-nowrap">
                        {row.leadName}
                        {row.hasActingLead && (
                          <span className="ml-1.5 rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">Acting Lead</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">{row.project}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={cn(
                          "font-semibold",
                          attPct === 100 ? "text-emerald-600" : attPct >= 80 ? "text-indigo-600" : "text-amber-600"
                        )}>
                          {row.presentCount}/{row.totalCount}
                        </span>
                        <span className="text-gray-300 ml-1">({attPct}%)</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.slaMinutes === null ? (
                          <span className="text-gray-300">—</span>
                        ) : slaOk ? (
                          <span className="flex items-center justify-center gap-0.5 text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> {row.slaMinutes}m
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-0.5 text-red-500">
                            <AlertTriangle className="h-3 w-3" /> {row.slaMinutes}m
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.openItemsCount > 0 ? (
                          <span className="rounded-full bg-red-50 text-red-600 px-2 py-0.5 font-semibold">{row.openItemsCount}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn("rounded-full px-2.5 py-0.5 font-semibold text-[10px]", STATUS_STYLES[row.status])}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
