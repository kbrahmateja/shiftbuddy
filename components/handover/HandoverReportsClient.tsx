"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2, Clock, Users, TrendingUp, AlertTriangle,
  BarChart2, ChevronLeft, ChevronRight, CalendarDays, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/layout/PageShell";

// ── Types ──────────────────────────────────────────────────────────────────────

type Period = "today" | "week" | "month" | "quarter" | "halfyear" | "year";

interface HandoverRow {
  id: string;
  date: string;
  shiftFrom: string;
  shiftTo: string;
  leadName: string;
  project: string;
  status: "SUBMITTED" | "ACKNOWLEDGED" | "DISPUTED";
  presentCount: number;
  totalCount: number;
  slaMinutes: number | null;
  openItemsCount: number;
  hasActingLead: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const LEADS     = ["Arjun Sharma", "Vikram Nair", "Kavitha Reddy"];
const PROJECTS  = ["Payment Core", "Discovery & Profiles", "Commerce & Cart", "Storefront UI", "RT-WebApp"];
const TRANSITIONS = [
  { from: "S1 · Morning",   to: "S2 · Afternoon" },
  { from: "S2 · Afternoon", to: "S3 · Night"     },
  { from: "S3 · Night",     to: "S1 · Morning"   },
];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Seed helpers ───────────────────────────────────────────────────────────────

function seededRand(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function daysSinceEpoch(d: Date) {
  return Math.floor(d.getTime() / 86_400_000);
}

// ── Date range from period + selection ────────────────────────────────────────

function getDateRange(period: Period, year: number, month: number, day = 1): { start: Date; end: Date } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  switch (period) {
    case "today": {
      const d = new Date(year, month, day); d.setHours(0, 0, 0, 0);
      const clamped = d > today ? today : d;
      return { start: clamped, end: clamped };
    }
    case "week": {
      const d = new Date(year, month, day); d.setHours(0, 0, 0, 0);
      const dow = d.getDay();
      const daysToMon = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(d); mon.setDate(d.getDate() + daysToMon);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { start: mon, end: sun > today ? today : sun };
    }
    case "month":
      return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0) };
    case "quarter": {
      const q = Math.floor(month / 3);
      return { start: new Date(year, q * 3, 1), end: new Date(year, q * 3 + 3, 0) };
    }
    case "halfyear": {
      const h = month < 6 ? 0 : 6;
      return { start: new Date(year, h, 1), end: new Date(year, h + 6, 0) };
    }
    case "year":
      return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
  }
}

// ── Row generation ─────────────────────────────────────────────────────────────

function generateRowsForRange(start: Date, end: Date): HandoverRow[] {
  const rows: HandoverRow[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(start); d.setHours(0, 0, 0, 0);

  while (d <= end && d <= today) {
    const dse  = daysSinceEpoch(d);
    const ds   = d.toISOString().slice(0, 10);
    const isToday = d.getTime() === today.getTime();

    TRANSITIONS.forEach((tr, ti) => {
      const seed = dse * 10 + ti;
      const r    = seededRand(seed);
      const leadIdx = Math.floor(seededRand(seed + 1) * LEADS.length);
      const projIdx = Math.floor(seededRand(seed + 2) * PROJECTS.length);
      const total   = 5 + Math.floor(seededRand(seed + 3) * 3);
      const present = total - Math.floor(seededRand(seed + 4) * 2);
      const slaOk   = r > 0.15;
      const status: HandoverRow["status"] =
        isToday && ti > 0 ? "SUBMITTED" :
        r > 0.05 ? "ACKNOWLEDGED" : "DISPUTED";

      rows.push({
        id: `h_${dse}_${ti}`, date: ds,
        shiftFrom: tr.from, shiftTo: tr.to,
        leadName: LEADS[leadIdx], project: PROJECTS[projIdx],
        status, presentCount: present, totalCount: total,
        slaMinutes: status === "ACKNOWLEDGED"
          ? (slaOk ? Math.floor(seededRand(seed + 5) * 25 + 5) : Math.floor(seededRand(seed + 5) * 30 + 31))
          : null,
        openItemsCount: Math.floor(seededRand(seed + 6) * 4),
        hasActingLead:  seededRand(seed + 7) > 0.85,
      });
    });

    d.setDate(d.getDate() + 1);
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.shiftFrom.localeCompare(b.shiftFrom));
}

// ── Selection label ────────────────────────────────────────────────────────────

function getSelectionLabel(period: Period, year: number, month: number, day = 1): string {
  switch (period) {
    case "today": {
      const d = new Date(year, month, day);
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }
    case "week": {
      const d = new Date(year, month, day);
      const dow = d.getDay();
      const daysToMon = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(d); mon.setDate(d.getDate() + daysToMon);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const fmt = (dt: Date) => dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      return `${fmt(mon)} – ${fmt(sun)}`;
    }
    case "month":    return `${MONTH_NAMES[month]} ${year}`;
    case "quarter":  return `Q${Math.floor(month / 3) + 1} ${year}`;
    case "halfyear": return `${month < 6 ? "H1" : "H2"} ${year}`;
    case "year":     return String(year);
  }
}

// ── Period config ──────────────────────────────────────────────────────────────

const PERIODS: { key: Period; label: string }[] = [
  { key: "today",    label: "Today"       },
  { key: "week",     label: "Weekly"      },
  { key: "month",    label: "Monthly"     },
  { key: "quarter",  label: "Quarterly"   },
  { key: "halfyear", label: "Half-Yearly" },
  { key: "year",     label: "Yearly"      },
];

// ── Calendar Picker ────────────────────────────────────────────────────────────

// ── Day-grid helpers ───────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function buildDayGrid(y: number, m: number): (number | null)[][] {
  const firstDow  = new Date(y, m, 1).getDay(); // 0 = Sun
  const daysInMon = new Date(y, m + 1, 0).getDate();
  const offset    = firstDow === 0 ? 6 : firstDow - 1; // ISO week: Mon = col 0
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Monday of the ISO week containing date (y, m, d) */
function weekMonday(y: number, m: number, d: number): Date {
  const dt  = new Date(y, m, d);
  const dow = dt.getDay();
  const off = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(dt);
  mon.setDate(dt.getDate() + off);
  return mon;
}

// ── Period Picker ──────────────────────────────────────────────────────────────

function PeriodPicker({
  period, year, month, day, onSelect,
}: {
  period: Period;
  year: number;
  month: number;
  day: number;
  onSelect: (y: number, m: number, d?: number) => void;
}) {
  const [open,        setOpen]        = useState(false);
  const [pickerYear,  setPickerYear]  = useState(year);
  const [pickerMonth, setPickerMonth] = useState(month);
  const ref      = useRef<HTMLDivElement>(null);
  const now      = new Date();
  const curYear  = now.getFullYear();
  const curMonth = now.getMonth();
  const curDay   = now.getDate();

  // Sync picker state when selection changes externally (e.g. period reset)
  useEffect(() => { setPickerYear(year);  }, [year]);
  useEffect(() => { setPickerMonth(month); }, [month]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function pickMonth(m: number) { onSelect(pickerYear, m); setOpen(false); }

  function pickDay(d: number) { onSelect(pickerYear, pickerMonth, d); setOpen(false); }

  function prevMonth() {
    if (pickerMonth === 0) { setPickerYear(y => y - 1); setPickerMonth(11); }
    else setPickerMonth(m => m - 1);
  }
  function nextMonth() {
    if (pickerYear > curYear || (pickerYear === curYear && pickerMonth >= curMonth)) return;
    if (pickerMonth === 11) { setPickerYear(y => y + 1); setPickerMonth(0); }
    else setPickerMonth(m => m + 1);
  }
  const nextMonthDisabled = pickerYear > curYear || (pickerYear === curYear && pickerMonth >= curMonth);

  function isDayFuture(d: number) {
    if (pickerYear < curYear) return false;
    if (pickerYear > curYear) return true;
    if (pickerMonth < curMonth) return false;
    if (pickerMonth > curMonth) return true;
    return d > curDay;
  }

  // Which week row is selected? (for week period)
  const selMon = weekMonday(year, month, day);

  function isDayInSelectedWeek(d: number | null): boolean {
    if (d === null) return false;
    const dt  = new Date(pickerYear, pickerMonth, d);
    const mon = weekMonday(pickerYear, pickerMonth, d);
    return mon.getTime() === selMon.getTime();
  }

  const isShowingDayGrid = period === "today" || period === "week";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all shadow-sm"
      >
        <CalendarDays className="h-4 w-4 text-indigo-500" />
        {getSelectionLabel(period, year, month, day)}
        <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-30 rounded-2xl border bg-white shadow-xl p-4 w-72">

          {/* ── Day grid (Today / Week) ── */}
          {isShowingDayGrid && (() => {
            const weeks = buildDayGrid(pickerYear, pickerMonth);
            return (
              <>
                {/* Month + Year nav */}
                <div className="flex items-center justify-between mb-3">
                  <button onClick={prevMonth} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
                    <ChevronLeft className="h-4 w-4 text-gray-600" />
                  </button>
                  <span className="text-sm font-bold text-gray-800">
                    {MONTH_NAMES[pickerMonth]} {pickerYear}
                  </span>
                  <button onClick={nextMonth} disabled={nextMonthDisabled}
                    className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors disabled:opacity-30">
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                  </button>
                </div>

                {/* Year quick-nav */}
                <div className="flex items-center justify-center gap-2 mb-3">
                  <button onClick={() => setPickerYear(y => y - 1)}
                    className="text-[10px] text-gray-400 hover:text-indigo-500 transition-colors">‹ {pickerYear - 1}</button>
                  <span className="text-[10px] text-gray-300">|</span>
                  <button onClick={() => { if (pickerYear < curYear) setPickerYear(y => y + 1); }}
                    disabled={pickerYear >= curYear}
                    className="text-[10px] text-gray-400 hover:text-indigo-500 transition-colors disabled:opacity-30">{pickerYear + 1} ›</button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 mb-1">
                  {WEEKDAY_LABELS.map(wd => (
                    <div key={wd} className="text-center text-[10px] font-semibold text-gray-400 py-1">{wd}</div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="space-y-0.5">
                  {weeks.map((week, wi) => {
                    const weekSelected = period === "week" && week.some(d => isDayInSelectedWeek(d));
                    return (
                      <div key={wi} className={cn(
                        "grid grid-cols-7 rounded-lg",
                        period === "week" && weekSelected && "bg-indigo-50"
                      )}>
                        {week.map((d, di) => {
                          if (d === null) return <div key={di} />;
                          const future  = isDayFuture(d);
                          const isSel   = period === "today" && pickerYear === year && pickerMonth === month && d === day;
                          const inWeek  = period === "week" && isDayInSelectedWeek(d);
                          const isToday = pickerYear === curYear && pickerMonth === curMonth && d === curDay;
                          return (
                            <button
                              key={di}
                              onClick={() => !future && pickDay(d)}
                              disabled={future}
                              className={cn(
                                "relative flex items-center justify-center h-8 w-full rounded-lg text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                                isSel   ? "bg-indigo-600 text-white font-bold shadow-sm" :
                                inWeek  ? "text-indigo-700 font-semibold" :
                                          "text-gray-700 hover:bg-indigo-50",
                              )}
                            >
                              {d}
                              {isToday && !isSel && (
                                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-indigo-400" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                <p className="mt-3 text-center text-[10px] text-gray-400">
                  {period === "today" ? "Tap a day to view that date's handovers"
                    : "Tap any day to select its full week"}
                </p>
              </>
            );
          })()}

          {/* ── Month-only periods (Month) ── */}
          {period === "month" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setPickerYear(y => y - 1)} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                <span className="text-sm font-bold text-gray-800">{pickerYear}</span>
                <button onClick={() => setPickerYear(y => Math.min(y + 1, curYear))} disabled={pickerYear >= curYear}
                  className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors disabled:opacity-30">
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTH_SHORT.map((mn, i) => (
                  <button key={mn} onClick={() => pickMonth(i)}
                    disabled={pickerYear === curYear && i > curMonth}
                    className={cn(
                      "rounded-lg py-2 text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                      pickerYear === year && i === month ? "bg-indigo-600 text-white shadow-sm" : "hover:bg-indigo-50 text-gray-700"
                    )}>
                    {mn}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-center text-[10px] text-gray-400">Select year · then pick month</p>
            </>
          )}

          {/* ── Quarter ── */}
          {period === "quarter" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setPickerYear(y => y - 1)} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                <span className="text-sm font-bold text-gray-800">{pickerYear}</span>
                <button onClick={() => setPickerYear(y => Math.min(y + 1, curYear))} disabled={pickerYear >= curYear}
                  className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors disabled:opacity-30">
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Q1", sub: "Jan – Mar", startMonth: 0 },
                  { label: "Q2", sub: "Apr – Jun", startMonth: 3 },
                  { label: "Q3", sub: "Jul – Sep", startMonth: 6 },
                  { label: "Q4", sub: "Oct – Dec", startMonth: 9 },
                ].map((q, i) => {
                  const disabled = pickerYear === curYear && q.startMonth > curMonth;
                  const active   = pickerYear === year && Math.floor(month / 3) === i;
                  return (
                    <button key={q.label} onClick={() => !disabled && pickMonth(q.startMonth)} disabled={disabled}
                      className={cn("rounded-xl py-3 text-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                        active ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-50 hover:bg-indigo-50 text-gray-700")}>
                      <div className="text-sm font-bold">{q.label}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">{q.sub}</div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-center text-[10px] text-gray-400">Select year · then pick quarter</p>
            </>
          )}

          {/* ── Half-year ── */}
          {period === "halfyear" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setPickerYear(y => y - 1)} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                <span className="text-sm font-bold text-gray-800">{pickerYear}</span>
                <button onClick={() => setPickerYear(y => Math.min(y + 1, curYear))} disabled={pickerYear >= curYear}
                  className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors disabled:opacity-30">
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "H1", sub: "Jan – Jun", startMonth: 0 },
                  { label: "H2", sub: "Jul – Dec", startMonth: 6 },
                ].map((h, i) => {
                  const disabled = pickerYear === curYear && h.startMonth > curMonth;
                  const active   = pickerYear === year && (month < 6 ? 0 : 1) === i;
                  return (
                    <button key={h.label} onClick={() => !disabled && pickMonth(h.startMonth)} disabled={disabled}
                      className={cn("rounded-xl py-4 text-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                        active ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-50 hover:bg-indigo-50 text-gray-700")}>
                      <div className="text-sm font-bold">{h.label}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">{h.sub}</div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-center text-[10px] text-gray-400">Select year · then pick half</p>
            </>
          )}

          {/* ── Year ── */}
          {period === "year" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setPickerYear(y => y - 1)} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                <span className="text-sm font-bold text-gray-800">{pickerYear}</span>
                <button onClick={() => setPickerYear(y => Math.min(y + 1, curYear))} disabled={pickerYear >= curYear}
                  className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors disabled:opacity-30">
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <button onClick={() => { onSelect(pickerYear, 0); setOpen(false); }}
                className={cn("w-full rounded-xl py-3 text-sm font-semibold transition-colors",
                  pickerYear === year ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-indigo-50")}>
                Select {pickerYear}
              </button>
              <p className="mt-3 text-center text-[10px] text-gray-400">Select year above</p>
            </>
          )}

        </div>
      )}
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string;
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
  const byDate = new Map<string, number>();
  rows.forEach(r => byDate.set(r.date, (byDate.get(r.date) ?? 0) + 1));
  const entries = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  const sliced = (period === "quarter" || period === "halfyear" || period === "year")
    ? (() => {
        const weekly = new Map<string, number>();
        entries.forEach(([, cnt], idx) => {
          const key = `W${Math.floor(idx / 7) + 1}`;
          weekly.set(key, (weekly.get(key) ?? 0) + cnt);
        });
        return Array.from(weekly.entries()).slice(-16);
      })()
    : entries;

  const maxVal = Math.max(...sliced.map(e => e[1]), 1);

  return (
    <div className="rounded-xl border bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-indigo-500" />
        Handovers Over Time
      </h3>
      {sliced.length === 0
        ? <div className="h-24 flex items-center justify-center text-xs text-gray-400">No data</div>
        : <div className="flex items-end gap-0.5 h-24">
            {sliced.map(([label, count]) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                {sliced.length < 15 && <span className="text-[9px] text-gray-400">{count}</span>}
                <div className="w-full rounded-sm bg-indigo-400 hover:bg-indigo-500 transition-colors"
                  style={{ height: `${(count / maxVal) * 72}px` }} />
                {sliced.length < 20 && (
                  <span className="text-[8px] text-gray-300 truncate w-full text-center">
                    {label.length > 5 ? label.slice(5) : label}
                  </span>
                )}
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── Project breakdown ──────────────────────────────────────────────────────────

function ProjectBreakdown({ rows }: { rows: HandoverRow[] }) {
  const byProject = new Map<string, { total: number; ack: number }>();
  rows.forEach(r => {
    const cur = byProject.get(r.project) ?? { total: 0, ack: 0 };
    byProject.set(r.project, { total: cur.total + 1, ack: cur.ack + (r.status === "ACKNOWLEDGED" ? 1 : 0) });
  });

  return (
    <div className="rounded-xl border bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">By Project</h3>
      {byProject.size === 0
        ? <p className="text-xs text-gray-400">No data</p>
        : <div className="space-y-2.5">
            {Array.from(byProject.entries()).map(([proj, stats]) => {
              const pct = Math.round((stats.ack / stats.total) * 100);
              return (
                <div key={proj}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-700 font-medium truncate">{proj}</span>
                    <span className="text-gray-400 ml-2 shrink-0">{stats.total} · {pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all",
                      pct === 100 ? "bg-emerald-400" : pct >= 80 ? "bg-indigo-400" : "bg-amber-400")}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

// ── Status styles ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED:    "bg-amber-100 text-amber-800",
  ACKNOWLEDGED: "bg-emerald-100 text-emerald-700",
  DISPUTED:     "bg-red-100 text-red-700",
};

// ── Main component ─────────────────────────────────────────────────────────────

export function HandoverReportsClient() {
  const now = new Date();
  const [period,       setPeriod]       = useState<Period>("month");
  const [selYear,      setSelYear]      = useState(now.getFullYear());
  const [selMonth,     setSelMonth]     = useState(now.getMonth());
  const [selDay,       setSelDay]       = useState(now.getDate());
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { start, end } = useMemo(
    () => getDateRange(period, selYear, selMonth, selDay),
    [period, selYear, selMonth, selDay]
  );
  const allRows = useMemo(() => generateRowsForRange(start, end), [start, end]);

  function handlePeriodChange(p: Period) {
    setPeriod(p);
    setSelYear(now.getFullYear());
    setSelMonth(now.getMonth());
    setSelDay(now.getDate());
  }

  function handleSelect(y: number, m: number, d?: number) {
    setSelYear(y);
    setSelMonth(m);
    if (d !== undefined) setSelDay(d);
  }

  const filteredRows = statusFilter === "ALL" ? allRows : allRows.filter(r => r.status === statusFilter);

  // Stats
  const total       = allRows.length;
  const acknowledged = allRows.filter(r => r.status === "ACKNOWLEDGED").length;
  const disputed    = allRows.filter(r => r.status === "DISPUTED").length;
  const ackPct      = total ? Math.round((acknowledged / total) * 100) : 0;
  const slaRows     = allRows.filter(r => r.slaMinutes !== null);
  const slaMet      = slaRows.filter(r => r.slaMinutes! <= 30).length;
  const slaPct      = slaRows.length ? Math.round((slaMet / slaRows.length) * 100) : 0;
  const avgAtt      = total ? Math.round(allRows.reduce((s, r) => s + (r.presentCount / r.totalCount) * 100, 0) / total) : 0;
  const openCarry   = allRows.reduce((s, r) => s + r.openItemsCount, 0);

  const printReportLink = (
    <Link href="/dashboard/handovers/report"
      className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
      Print Report
    </Link>
  );

  const periodRow = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 flex-wrap">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => handlePeriodChange(p.key)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
              period === p.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <PeriodPicker
        period={period}
        year={selYear}
        month={selMonth}
        day={selDay}
        onSelect={handleSelect}
      />
    </div>
  );

  return (
    <PageShell
      title="Handover Reports"
      subtitle="Shift handover analytics — select any period or date."
      back={{ href: "/dashboard/handovers", label: "Shift Hub" }}
      actions={printReportLink}
      headerExtra={periodRow}
      maxWidth="max-w-6xl"
    >
      <div className="space-y-6">

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="h-4 w-4 text-indigo-600" />}
          label="Total Handovers" value={String(total)}
          sub={`${acknowledged} acknowledged`} color="bg-indigo-50" />
        <StatCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          label="Acknowledged %" value={`${ackPct}%`}
          sub={disputed > 0 ? `${disputed} disputed` : "No disputes"} color="bg-emerald-50" />
        <StatCard icon={<Clock className="h-4 w-4 text-amber-600" />}
          label="SLA Met (≤30 min)" value={`${slaPct}%`}
          sub={`${slaMet}/${slaRows.length} acknowledged`} color="bg-amber-50" />
        <StatCard icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
          label="Avg Attendance" value={`${avgAtt}%`}
          sub={`${openCarry} open item carry-overs`} color="bg-blue-50" />
      </div>

      {/* Chart + breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TrendBars rows={allRows} period={period} />
        </div>
        <ProjectBreakdown rows={allRows} />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white">
        <div className="flex items-center justify-between px-5 py-3.5 border-b flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-700">
            Records <span className="font-normal text-gray-400">({filteredRows.length})</span>
          </h2>
          <div className="flex gap-1.5 text-xs">
            {["ALL", "SUBMITTED", "ACKNOWLEDGED", "DISPUTED"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn("rounded-full px-3 py-0.5 font-medium border transition-colors",
                  statusFilter === s ? "bg-indigo-600 text-white border-indigo-600" : "text-gray-500 border-gray-200 hover:border-gray-300"
                )}>
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {filteredRows.length === 0
          ? <div className="p-10 text-center text-sm text-gray-400">No handovers in this period.</div>
          : <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500 text-left">
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                    <th className="px-4 py-2.5 font-semibold">Shift</th>
                    <th className="px-4 py-2.5 font-semibold">Lead</th>
                    <th className="px-4 py-2.5 font-semibold">Project</th>
                    <th className="px-4 py-2.5 font-semibold text-center">Attendance</th>
                    <th className="px-4 py-2.5 font-semibold text-center">SLA</th>
                    <th className="px-4 py-2.5 font-semibold text-center">Open</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredRows.map(row => {
                    const attPct = Math.round((row.presentCount / row.totalCount) * 100);
                    const slaOk  = row.slaMinutes !== null && row.slaMinutes <= 30;
                    return (
                      <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                          {new Date(row.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                          {row.shiftFrom.split(" ")[0]} → {row.shiftTo.split(" ")[0]}
                        </td>
                        <td className="px-4 py-2.5 text-gray-800 font-medium whitespace-nowrap">
                          {row.leadName}
                          {row.hasActingLead && (
                            <span className="ml-1.5 rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">Acting</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">{row.project}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={cn("font-semibold",
                            attPct === 100 ? "text-emerald-600" : attPct >= 80 ? "text-indigo-600" : "text-amber-600")}>
                            {row.presentCount}/{row.totalCount}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {row.slaMinutes === null
                            ? <span className="text-gray-300">—</span>
                            : slaOk
                            ? <span className="flex items-center justify-center gap-0.5 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> {row.slaMinutes}m</span>
                            : <span className="flex items-center justify-center gap-0.5 text-red-500"><AlertTriangle className="h-3 w-3" /> {row.slaMinutes}m</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {row.openItemsCount > 0
                            ? <span className="rounded-full bg-red-50 text-red-600 px-2 py-0.5 font-semibold">{row.openItemsCount}</span>
                            : <span className="text-gray-300">—</span>
                          }
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
        }
      </div>
      </div>
    </PageShell>
  );
}
