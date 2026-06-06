"use client";

import { useState, useRef, useEffect } from "react";
import { Download, ChevronLeft, ChevronRight, CalendarDays, ChevronDown } from "lucide-react";
import {
  ANALYTICS_PERIODS,
  DAILY_HISTORY,
  WEEKLY_HISTORY,
  YEARLY_HISTORY,
  QUARTERLY_HISTORY,
  MONTHLY_HISTORY,
  PERIOD_ORDER,
  exportAnalyticsCSV,
  type PeriodKey,
  type AnalyticsPeriodData,
} from "@/lib/period-data";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/layout/PageShell";

// ── Calendar helpers ──────────────────────────────────────────────────────────

const MONTH_SHORT_A  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NAMES_A  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAY_LBL_A  = ["Mo","Tu","We","Th","Fr","Sa","Su"];

function buildDayGridA(y: number, m: number): (number | null)[][] {
  const firstDow  = new Date(y, m, 1).getDay();
  const daysInMon = new Date(y, m + 1, 0).getDate();
  const offset    = firstDow === 0 ? 6 : firstDow - 1;
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Monday of ISO week containing (y, m, d) */
function weekMonA(y: number, m: number, d: number): Date {
  const dt  = new Date(y, m, d);
  const dow = dt.getDay();
  const off = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(dt);
  mon.setDate(dt.getDate() + off);
  return mon;
}

/** ISO string → Date */
function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ── Label helpers ──────────────────────────────────────────────────────────────

/** "Dec 2025" → { year:2025, monthIdx:11 } */
function parseMonthlyLabel(label: string) {
  const [mon, yr] = label.split(" ");
  return { year: parseInt(yr, 10), monthIdx: MONTH_SHORT_A.indexOf(mon) };
}

/** "Q3 2025" → { year:2025, q:3 } (1-indexed) */
function parseQuarterlyLabel(label: string) {
  const [q, yr] = label.split(" ");
  return { year: parseInt(yr, 10), q: parseInt(q[1], 10) };
}

/** "FY 2026" → 2026 */
function parseYearlyLabel(label: string) {
  return parseInt(label.split(" ")[1], 10);
}

function extractYear(label: string, period: PeriodKey): number {
  if (period === "monthly")   return parseMonthlyLabel(label).year;
  if (period === "quarterly") return parseQuarterlyLabel(label).year;
  if (period === "daily" || period === "weekly") {
    // last word is the year  e.g. "25 May 2026" or "14–20 Apr 2026"
    const parts = label.split(" ");
    return parseInt(parts[parts.length - 1], 10);
  }
  return parseYearlyLabel(label);
}

// ── Analytics Calendar Picker ──────────────────────────────────────────────────

function AnalyticsCalendarPicker({
  period,
  history,
  currentIdx,
  onSelect,
}: {
  period: PeriodKey;
  history: AnalyticsPeriodData[];
  currentIdx: number;
  onSelect: (idx: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const curEntry  = history[currentIdx];
  const minYear   = Math.min(...history.map(e => extractYear(e.label, period)));
  const maxYear   = Math.max(...history.map(e => extractYear(e.label, period)));
  const initYear  = extractYear(curEntry.label, period);

  const [pickerYear,  setPickerYear]  = useState(initYear);
  const [pickerMonth, setPickerMonth] = useState(() => {
    if (period === "daily") {
      const d = isoToDate(curEntry.shortLabel);
      return d.getMonth();
    }
    if (period === "weekly") {
      const d = isoToDate(curEntry.shortLabel);
      return d.getMonth();
    }
    return 0;
  });

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  useEffect(() => {
    const y = extractYear(history[currentIdx].label, period);
    setPickerYear(y);
    if (period === "daily" || period === "weekly") {
      setPickerMonth(isoToDate(history[currentIdx].shortLabel).getMonth());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function pickEntry(entry: AnalyticsPeriodData) {
    const idx = history.indexOf(entry);
    if (idx !== -1) { onSelect(idx); setOpen(false); }
  }

  // Month nav helpers (for day/week grid)
  function prevMonthA() {
    if (pickerMonth === 0) { setPickerYear(y => y - 1); setPickerMonth(11); }
    else setPickerMonth(m => m - 1);
  }
  function nextMonthA() {
    const atMax = pickerYear > todayY || (pickerYear === todayY && pickerMonth >= todayM);
    if (atMax) return;
    if (pickerMonth === 11) { setPickerYear(y => y + 1); setPickerMonth(0); }
    else setPickerMonth(m => m + 1);
  }
  const nextMonthDisabled = pickerYear > todayY || (pickerYear === todayY && pickerMonth >= todayM);

  const isDayGrid  = period === "daily";
  const isWeekGrid = period === "weekly";

  // Build set of available ISO dates (shortLabels) for quick lookup
  const availableISO = new Set(history.map(e => e.shortLabel));

  // Find entry whose shortLabel == Monday ISO of (pickerYear, pickerMonth, d)
  function entryForDay(d: number): AnalyticsPeriodData | undefined {
    if (isDayGrid) {
      const iso = `${pickerYear}-${String(pickerMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      return history.find(e => e.shortLabel === iso);
    }
    if (isWeekGrid) {
      const mon = weekMonA(pickerYear, pickerMonth, d);
      const iso = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
      return history.find(e => e.shortLabel === iso);
    }
  }

  // Currently selected day / week-monday ISO
  const selISO = curEntry.shortLabel;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all shadow-sm"
      >
        <CalendarDays className="h-4 w-4 text-indigo-500" />
        {curEntry.label}
        <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-30 rounded-2xl border bg-white shadow-xl p-4 min-w-[260px]">

          {/* ── Day grid (daily) ── */}
          {isDayGrid && (() => {
            const weeks = buildDayGridA(pickerYear, pickerMonth);
            return (
              <>
                <div className="flex items-center justify-between mb-2">
                  <button onClick={prevMonthA} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
                    <ChevronLeft className="h-4 w-4 text-gray-600" />
                  </button>
                  <span className="text-sm font-bold text-gray-800">
                    {MONTH_NAMES_A[pickerMonth]} {pickerYear}
                  </span>
                  <button onClick={nextMonthA} disabled={nextMonthDisabled}
                    className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors disabled:opacity-30">
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {WEEKDAY_LBL_A.map(w => (
                    <div key={w} className="text-center text-[10px] font-semibold text-gray-400 py-1">{w}</div>
                  ))}
                </div>
                <div className="space-y-0.5">
                  {weeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7">
                      {week.map((d, di) => {
                        if (d === null) return <div key={di} />;
                        const entry   = entryForDay(d);
                        const iso     = `${pickerYear}-${String(pickerMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                        const active  = iso === selISO;
                        const isToday = pickerYear === todayY && pickerMonth === todayM && d === todayD;
                        return (
                          <button key={di} onClick={() => entry && pickEntry(entry)} disabled={!entry}
                            className={cn(
                              "relative flex items-center justify-center h-8 w-full rounded-lg text-xs transition-colors disabled:opacity-25 disabled:cursor-not-allowed",
                              active ? "bg-indigo-600 text-white font-bold shadow-sm" : entry ? "text-gray-700 hover:bg-indigo-50" : "text-gray-300"
                            )}>
                            {d}
                            {isToday && !active && (
                              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-indigo-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-center text-[10px] text-gray-400">Bold days have data · greyed = no data</p>
              </>
            );
          })()}

          {/* ── Week grid (weekly) ── */}
          {isWeekGrid && (() => {
            const weeks = buildDayGridA(pickerYear, pickerMonth);
            // Selected week's monday ISO
            const selMon = isoToDate(selISO);
            return (
              <>
                <div className="flex items-center justify-between mb-2">
                  <button onClick={prevMonthA} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
                    <ChevronLeft className="h-4 w-4 text-gray-600" />
                  </button>
                  <span className="text-sm font-bold text-gray-800">
                    {MONTH_NAMES_A[pickerMonth]} {pickerYear}
                  </span>
                  <button onClick={nextMonthA} disabled={nextMonthDisabled}
                    className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors disabled:opacity-30">
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {WEEKDAY_LBL_A.map(w => (
                    <div key={w} className="text-center text-[10px] font-semibold text-gray-400 py-1">{w}</div>
                  ))}
                </div>
                <div className="space-y-0.5">
                  {weeks.map((week, wi) => {
                    // Find first valid day in this row to identify the week's monday
                    const firstD  = week.find(d => d !== null);
                    const rowEntry = firstD != null ? entryForDay(firstD) : undefined;
                    const rowMon  = firstD != null ? weekMonA(pickerYear, pickerMonth, firstD) : null;
                    const rowSel  = rowMon && rowMon.getTime() === selMon.getTime();
                    return (
                      <div key={wi}
                        onClick={() => rowEntry && pickEntry(rowEntry)}
                        className={cn(
                          "grid grid-cols-7 rounded-lg transition-colors",
                          rowEntry ? "cursor-pointer" : "cursor-default",
                          rowSel ? "bg-indigo-100" : rowEntry ? "hover:bg-indigo-50" : ""
                        )}>
                        {week.map((d, di) => {
                          if (d === null) return <div key={di} className="h-8" />;
                          const isToday = pickerYear === todayY && pickerMonth === todayM && d === todayD;
                          return (
                            <div key={di}
                              className={cn(
                                "relative flex items-center justify-center h-8 text-xs rounded-lg",
                                rowSel ? "text-indigo-700 font-semibold" : rowEntry ? "text-gray-700" : "text-gray-300"
                              )}>
                              {d}
                              {isToday && (
                                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-indigo-400" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-center text-[10px] text-gray-400">Click a week row to select it</p>
              </>
            );
          })()}

          {/* ── Year nav (non-day/week periods) ── */}
          {!isDayGrid && !isWeekGrid && (
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setPickerYear(y => Math.max(y - 1, minYear))} disabled={pickerYear <= minYear}
                className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors disabled:opacity-30">
                <ChevronLeft className="h-4 w-4 text-gray-600" />
              </button>
              <span className="text-sm font-bold text-gray-800">
                {period === "yearly" ? `FY ${pickerYear}` : pickerYear}
              </span>
              <button onClick={() => setPickerYear(y => Math.min(y + 1, maxYear))} disabled={pickerYear >= maxYear}
                className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors disabled:opacity-30">
                <ChevronRight className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          )}

          {/* Monthly grid */}
          {period === "monthly" && (
            <div className="grid grid-cols-3 gap-1.5">
              {MONTH_SHORT_A.map((mn, i) => {
                const entry  = history.find(e => { const p = parseMonthlyLabel(e.label); return p.year === pickerYear && p.monthIdx === i; });
                const active = entry && history.indexOf(entry) === currentIdx;
                return (
                  <button key={mn} onClick={() => entry && pickEntry(entry)} disabled={!entry}
                    className={cn("rounded-lg py-2 text-xs font-medium transition-colors disabled:opacity-25 disabled:cursor-not-allowed",
                      active ? "bg-indigo-600 text-white shadow-sm" : entry ? "hover:bg-indigo-50 text-gray-700" : "text-gray-300")}>
                    {mn}
                  </button>
                );
              })}
            </div>
          )}

          {/* Quarterly grid */}
          {period === "quarterly" && (
            <div className="grid grid-cols-2 gap-2">
              {[{ label:"Q1",sub:"Jan – Mar",q:1 },{ label:"Q2",sub:"Apr – Jun",q:2 },
                { label:"Q3",sub:"Jul – Sep",q:3 },{ label:"Q4",sub:"Oct – Dec",q:4 }].map(qd => {
                const entry  = history.find(e => { const p = parseQuarterlyLabel(e.label); return p.year === pickerYear && p.q === qd.q; });
                const active = entry && history.indexOf(entry) === currentIdx;
                return (
                  <button key={qd.label} onClick={() => entry && pickEntry(entry)} disabled={!entry}
                    className={cn("rounded-xl py-3 text-center transition-colors disabled:opacity-25 disabled:cursor-not-allowed",
                      active ? "bg-indigo-600 text-white shadow-sm" : entry ? "bg-gray-50 hover:bg-indigo-50 text-gray-700" : "bg-gray-50 text-gray-300")}>
                    <div className="text-sm font-bold">{qd.label}</div>
                    <div className="text-[10px] opacity-75 mt-0.5">{qd.sub}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Half-yearly */}
          {period === "half-yearly" && (
            <div className="grid grid-cols-2 gap-2">
              {[{ label:"H1",sub:"Jan – Jun",q:1 },{ label:"H2",sub:"Jul – Dec",q:2 }].map((hd, i) => {
                // half-yearly has no history, just show current highlighted
                const active = i === 0; // always H1/H2 based on current
                return (
                  <button key={hd.label} disabled
                    className={cn("rounded-xl py-4 text-center disabled:opacity-40 cursor-default",
                      "bg-gray-50 text-gray-500")}>
                    <div className="text-sm font-bold">{hd.label}</div>
                    <div className="text-[10px] opacity-75 mt-0.5">{hd.sub}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Yearly */}
          {period === "yearly" && (() => {
            const entry  = history.find(e => parseYearlyLabel(e.label) === pickerYear);
            const active = entry && history.indexOf(entry) === currentIdx;
            return (
              <button onClick={() => entry && pickEntry(entry)} disabled={!entry}
                className={cn("w-full rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-25 disabled:cursor-not-allowed",
                  active ? "bg-indigo-600 text-white" : entry ? "bg-gray-100 text-gray-700 hover:bg-indigo-50" : "bg-gray-100 text-gray-300")}>
                {entry ? `Select FY ${pickerYear}` : `No data for ${pickerYear}`}
              </button>
            );
          })()}

          {!isDayGrid && !isWeekGrid && (
            <p className="mt-3 text-center text-[10px] text-gray-400">
              {period === "monthly" ? "Greyed = no data" : "Navigate with year arrows"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Period labels ──────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<PeriodKey, string> = {
  daily:         "Daily",
  weekly:        "Weekly",
  monthly:       "Monthly",
  quarterly:     "Quarterly",
  "half-yearly": "Half-Yearly",
  yearly:        "Yearly",
};

/** Returns the history array for every navigable period */
function getHistory(period: PeriodKey): AnalyticsPeriodData[] | null {
  if (period === "daily")     return DAILY_HISTORY;
  if (period === "weekly")    return WEEKLY_HISTORY;
  if (period === "monthly")   return MONTHLY_HISTORY;
  if (period === "quarterly") return QUARTERLY_HISTORY;
  if (period === "yearly")    return YEARLY_HISTORY;
  return null; // half-yearly has no history
}

export function AnalyticsDashboard() {
  const [period, setPeriod] = useState<PeriodKey>("weekly");

  // Per-period: track which history index is selected (default = latest)
  const [dailyIdx,   setDailyIdx]   = useState(DAILY_HISTORY.length - 1);
  const [weeklyIdx,  setWeeklyIdx]  = useState(WEEKLY_HISTORY.length - 1);
  const [monthIdx,   setMonthIdx]   = useState(MONTHLY_HISTORY.length - 1);
  const [quarterIdx, setQuarterIdx] = useState(QUARTERLY_HISTORY.length - 1);
  const [yearIdx,    setYearIdx]    = useState(YEARLY_HISTORY.length - 1);

  function getIdx() {
    if (period === "daily")     return dailyIdx;
    if (period === "weekly")    return weeklyIdx;
    if (period === "monthly")   return monthIdx;
    if (period === "quarterly") return quarterIdx;
    return yearIdx;
  }
  function setIdx(i: number) {
    if (period === "daily")          setDailyIdx(i);
    else if (period === "weekly")    setWeeklyIdx(i);
    else if (period === "monthly")   setMonthIdx(i);
    else if (period === "quarterly") setQuarterIdx(i);
    else                             setYearIdx(i);
  }

  const history = getHistory(period);
  const data: AnalyticsPeriodData = history
    ? history[getIdx()]
    : ANALYTICS_PERIODS[period];

  const canPrev = history ? getIdx() > 0 : false;
  const canNext = history ? getIdx() < history.length - 1 : false;

  const kpis = [
    { label: "Total Logs",      value: data.totalLogs.toLocaleString(),  color: "text-indigo-600" },
    { label: "Resolved",        value: data.resolved.toLocaleString(),    color: "text-emerald-600" },
    { label: "Resolution Rate", value: `${data.resolutionRate}%`,         color: data.resolutionRate >= 90 ? "text-emerald-600" : "text-orange-500" },
    { label: "SLA Compliance",  value: `${data.slaCompliance}%`,          color: data.slaCompliance  >= 90 ? "text-emerald-600" : "text-orange-500" },
    { label: "P1 Critical",     value: data.p1Count.toString(),           color: data.p1Count > 0 ? "text-red-600" : "text-gray-500" },
    { label: "P2 High",         value: data.p2Count.toString(),           color: "text-orange-500" },
    { label: "Avg Resolution",  value: `${data.avgResolutionH}h`,         color: "text-indigo-600" },
    { label: "Handover Ack",    value: `${data.handoverAckRate}%`,        color: data.handoverAckRate >= 90 ? "text-emerald-600" : "text-orange-500" },
  ];

  const sourceMax = Math.max(...data.bySource.map((s) => s.count), 1);
  const sevMax    = Math.max(...data.bySeverity.map((s) => s.count), 1);

  const exportButton = (
    <button
      onClick={() => exportAnalyticsCSV(data)}
      className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
    >
      <Download className="h-3.5 w-3.5" />
      Export CSV
    </button>
  );

  const periodSelectorRow = (
    <div className="flex flex-wrap items-center gap-3">
      {/* Period tabs */}
      <div className="flex rounded-lg border bg-white overflow-hidden text-xs font-medium">
        {PERIOD_ORDER.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 transition-colors border-r last:border-r-0 ${
              period === p ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Calendar picker */}
      {history ? (
        <AnalyticsCalendarPicker
          period={period}
          history={history}
          currentIdx={getIdx()}
          onSelect={setIdx}
        />
      ) : (
        <div className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-medium text-gray-500 shadow-sm">
          <CalendarDays className="h-4 w-4 text-indigo-400" />
          {data.label}
        </div>
      )}

      {/* Prev / Next arrows */}
      {history && (
        <div className="flex items-center gap-1 rounded-xl border bg-white px-2 py-1.5 shadow-sm">
          <button
            onClick={() => setIdx(getIdx() - 1)}
            disabled={!canPrev}
            title={canPrev ? history[getIdx() - 1].label : ""}
            className="flex items-center gap-0.5 px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-gray-50"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {canPrev ? history[getIdx() - 1].label : "Earlier"}
          </button>
          <span className="text-gray-200">|</span>
          <button
            onClick={() => setIdx(getIdx() + 1)}
            disabled={!canNext}
            title={canNext ? history[getIdx() + 1].label : ""}
            className="flex items-center gap-0.5 px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-gray-50"
          >
            {canNext ? history[getIdx() + 1].label : "Latest"}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <PageShell
      title="Analytics"
      subtitle={`${data.label} · ${data.dateRange}`}
      actions={exportButton}
      headerExtra={periodSelectorRow}
      maxWidth="max-w-6xl"
    >
      <div className="space-y-6">

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border bg-white p-4">
            <p className="text-xs font-medium text-gray-500">{kpi.label}</p>
            <p className={`mt-1.5 text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Shifts + Handovers strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Shifts Completed",  value: data.shiftsCompleted.toLocaleString() },
          { label: "Shifts On-Time",    value: `${data.shiftsOnTime}%` },
          { label: "Handovers",         value: data.handoversTotal.toLocaleString() },
          { label: "Handover Ack Rate", value: `${data.handoverAckRate}%` },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border bg-emerald-50 border-emerald-100 p-3 text-center">
            <p className="text-xl font-bold text-emerald-700">{item.value}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* By Source */}
        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Logs by Source</h2>
          <div className="space-y-3">
            {data.bySource.map(({ source, count }) => (
              <div key={source}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{source}</span>
                  <span className="font-medium">
                    {count.toLocaleString()} ({Math.round((count / data.totalLogs) * 100)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${Math.round((count / sourceMax) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By Severity */}
        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Logs by Severity</h2>
          <div className="space-y-3">
            {data.bySeverity.map(({ label, count, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{label}</span>
                  <span className="font-medium">
                    {count.toLocaleString()} ({Math.round((count / data.totalLogs) * 100)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: `${Math.round((count / sevMax) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Project breakdown table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b">
          <h2 className="text-sm font-semibold text-gray-700">Project Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Project</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Total</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Resolved</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">SLA Rate</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.byProject.map((proj) => (
                <tr key={proj.code} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <span className="text-[10px] font-bold text-gray-400 mr-2">{proj.code}</span>
                    <span className="text-gray-700">{proj.project}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-700">{proj.count.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">{proj.resolved.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold ${proj.slaRate >= 95 ? "text-emerald-600" : proj.slaRate >= 90 ? "text-orange-500" : "text-red-500"}`}>
                      {proj.slaRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 w-32">
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${proj.slaRate}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        {data.dateRange} · SLA target 90% · Connect PostgreSQL for live data
      </p>
    </div>
    </PageShell>
  );
}
