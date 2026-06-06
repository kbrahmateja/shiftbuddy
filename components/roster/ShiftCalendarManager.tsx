"use client";
// components/roster/ShiftCalendarManager.tsx
// ─────────────────────────────────────────────────────────────
// Shift calendar manager for LEAD and MANAGER.
//
// UX model:
//  • Click any empty cell  → inline pattern picker appears (no dialog)
//    pick a pattern → instantly assigned. 2 clicks total.
//  • "Assign Week" button on each member row → pick pattern once →
//    assigns all working days (Mon–Fri) of the visible week
//  • "Day Off" option in picker → marks cell with a W/O badge
//  • Existing shift: hover → pencil / trash icons (unchanged)
//  • Bulk mode: checkbox members → date-range dialog for bulk assign
// ─────────────────────────────────────────────────────────────

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Plus, Trash2, Pencil, ChevronLeft, ChevronRight, ChevronDown, X,
  CheckSquare, Square, Users, AlertTriangle, CheckCircle2,
  Coffee, Sun, Sunset, Moon, PhoneCall, Calendar,
  Search, RefreshCw, Zap, BanIcon,
} from "lucide-react";
import { cn, getInitials, getAvatarColor } from "@/lib/utils";
import { MOCK_USERS, MOCK_PROJECTS } from "@/lib/mock-data";
import {
  BUILTIN_HOLIDAYS_2026, DEFAULT_TOGGLES,
  CUSTOM_HOLIDAYS_KEY, CALENDAR_TOGGLES_KEY,
  type Holiday, type CalendarToggles,
} from "@/lib/holidays";
import type { Shift, ShiftPattern, ShiftStatus, User, UserRole, SessionUser } from "@/types";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  addMemberToShift, bulkAssignShifts, editShift,
  removeFromShift, bulkRemoveShifts,
} from "@/app/actions/shift";

// ── Config ────────────────────────────────────────────────────────────────

const PATTERN_META: Record<ShiftPattern, {
  label: string; shortLabel: string; color: string;
  border: string; bg: string; btnBg: string;
  Icon: React.ComponentType<{ className?: string }>; hours: string;
}> = {
  MORNING:   { label: "Morning",   shortLabel: "S1", color: "text-sky-700",    border: "border-sky-300",    bg: "bg-sky-50",    btnBg: "hover:bg-sky-100 active:bg-sky-200",    Icon: Coffee,    hours: "05:30–14:30" },
  AFTERNOON: { label: "Afternoon", shortLabel: "S2", color: "text-orange-700", border: "border-orange-300", bg: "bg-orange-50", btnBg: "hover:bg-orange-100 active:bg-orange-200", Icon: Sunset,    hours: "13:30–22:30" },
  NIGHT:     { label: "Night",     shortLabel: "S3", color: "text-indigo-700", border: "border-indigo-300", bg: "bg-indigo-50", btnBg: "hover:bg-indigo-100 active:bg-indigo-200", Icon: Moon,      hours: "21:30–06:30" },
  GENERAL:   { label: "General",   shortLabel: "GN", color: "text-amber-700",  border: "border-amber-300",  bg: "bg-amber-50",  btnBg: "hover:bg-amber-100 active:bg-amber-200",  Icon: Sun,       hours: "09:00–17:00" },
  WEEKEND:   { label: "Weekend",   shortLabel: "WE", color: "text-violet-700", border: "border-violet-300", bg: "bg-violet-50", btnBg: "hover:bg-violet-100 active:bg-violet-200", Icon: Calendar,  hours: "09:00–17:00" },
  ON_CALL:   { label: "On-Call",   shortLabel: "OC", color: "text-red-700",    border: "border-red-300",    bg: "bg-red-50",    btnBg: "hover:bg-red-100 active:bg-red-200",    Icon: PhoneCall, hours: "00:00–23:59" },
};

const STATUS_STYLE: Record<ShiftStatus, string> = {
  SCHEDULED:   "bg-gray-100 text-gray-600 border-gray-200",
  ACTIVE:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  HANDED_OVER: "bg-amber-100 text-amber-700 border-amber-200",
  COMPLETED:   "bg-blue-100 text-blue-700 border-blue-200",
  CANCELLED:   "bg-red-100 text-red-500 border-red-200 line-through opacity-60",
};

const DAY_LABELS    = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WORK_DAY_IDX  = [0, 1, 2, 3, 4]; // Mon–Fri indices in weekDates
const MANAGE_ROLES: UserRole[] = ["CONTRACTOR", "EMPLOYEE", "LEAD"];

// ── Weekoff rules ──────────────────────────────────────────────────────────
// Three allowed weekoff patterns; days are 0=Mon … 6=Sun in our weekDates array.
// A shift on an off-day is a violation even if it's the only shift that day.
const WEEKOFF_PATTERNS = {
  "Sat-Sun": { offIdx: [5, 6], label: "Sat & Sun off" },   // Mon–Fri workers
  "Sun-Mon": { offIdx: [6, 0], label: "Sun & Mon off" },   // Tue–Sat workers
  "Fri-Sat": { offIdx: [4, 5], label: "Fri & Sat off" },   // Sun–Thu workers
} as const;

// ── Over-assignment detection ─────────────────────────────────────────────

interface OverloadInfo {
  totalWorkDays:  number;          // distinct days with ≥1 non-cancelled shift
  overDays:       string[];        // dateStr for days with >1 shift (double-booked)
  offDayViolations: { dayStr: string; dayLabel: string }[]; // shifts on weekoff days
  isOverWeek:     boolean;         // totalWorkDays > 5
  isOverDay:      boolean;         // any day has >1 shift
  hasOffViolation: boolean;        // shift assigned on a weekoff day
  maxShiftsOnDay:  number;
  weekoffPattern: string;          // e.g. "Sat & Sun off"
}

function getOverloadInfo(
  userId: string,
  weekDates: Date[],
  shiftMap: Map<string, Map<string, (Shift & { assignedTo: User })[]>>,
  weekoffKey?: keyof typeof WEEKOFF_PATTERNS,
): OverloadInfo {
  const userMap = shiftMap.get(userId);
  const offIdxSet = weekoffKey
    ? new Set(WEEKOFF_PATTERNS[weekoffKey].offIdx)
    : new Set<number>();

  let totalWorkDays = 0;
  const overDays:           string[] = [];
  const offDayViolations:   { dayStr: string; dayLabel: string }[] = [];
  let maxShiftsOnDay = 0;

  weekDates.forEach((d, idx) => {
    const ds     = dateStr(d);
    const active = (userMap?.get(ds) ?? []).filter((s) => s.status !== "CANCELLED");
    if (active.length === 0) return;

    totalWorkDays++;
    if (active.length > maxShiftsOnDay) maxShiftsOnDay = active.length;
    if (active.length > 1) overDays.push(ds);
    if (offIdxSet.has(idx)) {
      offDayViolations.push({ dayStr: ds, dayLabel: DAY_LABELS[idx] });
    }
  });

  return {
    totalWorkDays,
    overDays,
    offDayViolations,
    isOverWeek:      totalWorkDays > 5,
    isOverDay:       overDays.length > 0,
    hasOffViolation: offDayViolations.length > 0,
    maxShiftsOnDay,
    weekoffPattern:  weekoffKey ? WEEKOFF_PATTERNS[weekoffKey].label : "Unknown",
  };
}

// ── Overload badge (inline, on member rows) ────────────────────────────────

function OverloadBadge({ info, compact = false }: { info: OverloadInfo; compact?: boolean }) {
  const issues: string[] = [];
  if (info.isOverDay)       issues.push(`${info.maxShiftsOnDay}× same day`);
  if (info.isOverWeek)      issues.push(`${info.totalWorkDays}d/week`);
  if (info.hasOffViolation) issues.push(`shift on off-day`);
  if (issues.length === 0)  return null;

  return (
    <span
      title={issues.join(" · ")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full font-semibold leading-none",
        "bg-orange-100 text-orange-700 border border-orange-200",
        compact ? "px-1 py-0.5 text-[8px]" : "px-1.5 py-0.5 text-[9px]"
      )}
    >
      <AlertTriangle className={compact ? "h-2 w-2" : "h-2.5 w-2.5"} />
      {!compact && issues[0]}
    </span>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────

interface ShiftCalendarManagerProps {
  shifts:      (Shift & { assignedTo: User })[];
  currentUser: SessionUser;
}

/** Inline pattern picker state */
interface PickerState {
  open:     boolean;
  userId:   string;
  /** "week" = assign whole week; otherwise specific YYYY-MM-DD */
  mode:     "day" | "week";
  dayStr:   string;
  anchorId: string; // element id to position near
}

/** Bulk assign dialog (multiple members, date range) */
interface BulkDialogState {
  open:      boolean;
  userIds:   string[];
}

interface EditDialogState {
  open:  boolean;
  shift: (Shift & { assignedTo: User }) | null;
}

interface RemoveDialogState {
  open:     boolean;
  shiftIds: string[];
  names:    string[];
}

interface Toast { id: number; type: "success" | "error"; msg: string; }

// Day-off marker — stored locally, not persisted (POC)
type DayOffKey = string; // `${userId}__${dayStr}`

// ── Overload summary strip ─────────────────────────────────────────────────

function OverloadSummaryStrip({
  members, overloadMap,
}: {
  members:    User[];
  overloadMap: Map<string, OverloadInfo>;
}) {
  const [open, setOpen] = useState(false);
  const overloaded = members.filter((u) => {
    const o = overloadMap.get(u.id);
    return o && (o.isOverWeek || o.isOverDay || o.hasOffViolation);
  });
  if (overloaded.length === 0) return null;

  // Count distinct issue types for the headline
  const doubleDay  = overloaded.filter((u) => overloadMap.get(u.id)!.isOverDay).length;
  const overWeek   = overloaded.filter((u) => overloadMap.get(u.id)!.isOverWeek).length;
  const offViol    = overloaded.filter((u) => overloadMap.get(u.id)!.hasOffViolation).length;

  const parts: string[] = [];
  if (doubleDay > 0) parts.push(`${doubleDay} double-booked`);
  if (overWeek  > 0) parts.push(`${overWeek} over 5 days`);
  if (offViol   > 0) parts.push(`${offViol} on weekoff`);

  return (
    <div className="border-b border-orange-200 bg-orange-50">
      {/* Headline row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-orange-100/50 transition-colors"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-200">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-700" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-orange-800">
            {overloaded.length} member{overloaded.length > 1 ? "s" : ""} over-assigned this week
          </span>
          <span className="ml-2 text-[10px] text-orange-600">{parts.join(" · ")}</span>
        </div>
        <span className="text-[10px] text-orange-500 flex items-center gap-0.5">
          {open ? "Hide" : "Show details"}
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {/* Expanded detail list */}
      {open && (
        <div className="grid gap-1.5 px-4 pb-3 sm:grid-cols-2 lg:grid-cols-3">
          {overloaded.map((u) => {
            const o = overloadMap.get(u.id)!;
            const tags: { label: string; cls: string }[] = [];
            if (o.isOverDay) {
              const dayNames = o.overDays.map((ds) => {
                const d = new Date(ds + "T12:00:00");
                return d.toLocaleDateString("en-GB", { weekday: "short" });
              });
              tags.push({ label: `${o.maxShiftsOnDay}× shifts on ${dayNames.join(", ")}`, cls: "bg-red-100 text-red-700 border-red-200" });
            }
            if (o.isOverWeek)
              tags.push({ label: `${o.totalWorkDays} working days this week (max 5)`, cls: "bg-orange-100 text-orange-700 border-orange-200" });
            if (o.hasOffViolation)
              tags.push({ label: `Shift on weekoff: ${o.offDayViolations.map((v) => v.dayLabel).join(", ")}`, cls: "bg-yellow-100 text-yellow-700 border-yellow-200" });

            return (
              <div key={u.id} className="flex items-start gap-2 rounded-lg border border-orange-200 bg-white px-3 py-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white mt-0.5" style={{ backgroundColor: getAvatarColor(u.id) }}>
                  {getInitials(u.name).slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-semibold text-gray-800 truncate">{u.name}</span>
                    <span className="shrink-0 rounded-full bg-gray-100 border border-gray-200 px-1.5 py-0 text-[9px] text-gray-500 font-medium">
                      {o.weekoffPattern}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {tags.map((t, i) => (
                      <span key={i} className={cn("rounded-full border px-1.5 py-0 text-[9px] font-medium", t.cls)}>{t.label}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Holiday helpers ────────────────────────────────────────────────────────

function useHolidayMap(): Map<string, Holiday[]> {
  const [toggles, setToggles] = useState<CalendarToggles>(DEFAULT_TOGGLES);
  const [custom, setCustom]   = useState<Holiday[]>([]);

  useEffect(() => {
    const getToggles = () => {
      try { const r = localStorage.getItem(CALENDAR_TOGGLES_KEY); return r ? { ...DEFAULT_TOGGLES, ...JSON.parse(r) } : DEFAULT_TOGGLES; }
      catch { return DEFAULT_TOGGLES; }
    };
    const getCustom = () => {
      try { const r = localStorage.getItem(CUSTOM_HOLIDAYS_KEY); return r ? JSON.parse(r) : []; }
      catch { return []; }
    };
    setToggles(getToggles());
    setCustom(getCustom());
    const handler = (e: StorageEvent) => {
      if (e.key === CALENDAR_TOGGLES_KEY) setToggles(getToggles());
      if (e.key === CUSTOM_HOLIDAYS_KEY)  setCustom(getCustom());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return useMemo(() => {
    const all = [
      ...BUILTIN_HOLIDAYS_2026.filter((h) => {
        if (h.type === "BOTH") return toggles.IN || toggles.US;
        if (h.type === "IN")   return toggles.IN;
        if (h.type === "US")   return toggles.US;
        return false;
      }),
      ...custom,
    ];
    const map = new Map<string, Holiday[]>();
    for (const h of all) {
      const arr = map.get(h.date) ?? [];
      arr.push(h);
      map.set(h.date, arr);
    }
    return map;
  }, [toggles, custom]);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getWeekDates(offset: number): Date[] {
  const today    = new Date();
  const dow      = today.getDay();
  const monday   = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function dateStr(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function isToday(d: Date) {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

function patternStartISO(ds: string, p: ShiftPattern): string {
  const h: Record<ShiftPattern, [number, number]> = {
    MORNING: [5, 30], AFTERNOON: [13, 30], NIGHT: [21, 30],
    GENERAL: [9, 0],  WEEKEND: [9, 0],    ON_CALL: [0, 0],
  };
  const [hh, mm] = h[p];
  return `${ds}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00.000Z`;
}

function patternEndISO(ds: string, p: ShiftPattern): string {
  const e: Record<ShiftPattern, [number, number, number]> = {
    MORNING: [14,30,0], AFTERNOON: [22,30,0], NIGHT: [6,30,1],
    GENERAL: [17,0,0],  WEEKEND: [17,0,0],    ON_CALL: [23,59,0],
  };
  const [hh, mm, extra] = e[p];
  const d = new Date(ds + "T00:00:00");
  d.setDate(d.getDate() + extra);
  return `${d.toISOString().slice(0,10)}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00.000Z`;
}

// ── Toast ──────────────────────────────────────────────────────────────────

function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={cn(
          "flex items-start gap-2.5 rounded-lg border px-4 py-3 shadow-lg text-sm pointer-events-auto max-w-sm",
          t.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
        )}>
          {t.type === "success"
            ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{t.msg}</span>
          <button onClick={() => onDismiss(t.id)}><X className="h-3.5 w-3.5 opacity-50 hover:opacity-100" /></button>
        </div>
      ))}
    </div>
  );
}

// ── Inline pattern picker ──────────────────────────────────────────────────
// Appears as a small floating panel right in the grid — no modal overlay.

function InlinePatternPicker({
  state, onPick, onDayOff, onClose, saving,
}: {
  state:    PickerState;
  onPick:   (pattern: ShiftPattern) => void;
  onDayOff: () => void;
  onClose:  () => void;
  saving:   boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (!state.open) return null;

  const anchor   = document.getElementById(state.anchorId);
  const rect     = anchor?.getBoundingClientRect();
  const POPUP_W  = 212;  // w-52 = 208px + buffer
  const POPUP_H  = 230;  // approx popup height
  const style: React.CSSProperties = rect
    ? {
        position: "fixed",
        // Flip above if not enough space below
        top: (window.innerHeight - rect.bottom) >= POPUP_H + 8
          ? rect.bottom + 4
          : Math.max(8, rect.top - POPUP_H - 4),
        // Clamp so popup never overflows right edge
        left: Math.min(rect.left, window.innerWidth - POPUP_W - 8),
      }
    : { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)" };

  return (
    <div
      ref={ref}
      style={{ ...style, zIndex: 60 }}
      className="w-52 rounded-xl border border-gray-200 bg-white shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
          {state.mode === "week" ? "Assign whole week" : `Assign ${state.dayStr}`}
        </span>
        <button onClick={onClose} className="rounded p-0.5 hover:bg-gray-100">
          <X className="h-3 w-3 text-gray-400" />
        </button>
      </div>

      {/* Pattern buttons */}
      <div className="grid grid-cols-2 gap-1 p-2">
        {(Object.keys(PATTERN_META) as ShiftPattern[]).map((p) => {
          const m = PATTERN_META[p];
          const I = m.Icon;
          return (
            <button
              key={p}
              disabled={saving}
              onClick={() => onPick(p)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2 py-2 text-left text-[11px] font-medium transition-colors",
                m.border, m.color, m.bg, m.btnBg,
                saving && "opacity-50 cursor-not-allowed"
              )}
            >
              <I className={cn("h-3.5 w-3.5 shrink-0", m.color)} />
              <div>
                <div className="font-semibold">{m.shortLabel}</div>
                <div className="text-[9px] opacity-70">{m.hours}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Day off option */}
      <div className="border-t px-2 pb-2">
        <button
          disabled={saving}
          onClick={onDayOff}
          className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-[11px] font-medium text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <BanIcon className="h-3.5 w-3.5 text-gray-400" />
          Mark Day Off (W/O)
        </button>
      </div>

      {saving && (
        <div className="flex items-center justify-center gap-1.5 border-t py-2 text-[11px] text-gray-500">
          <RefreshCw className="h-3 w-3 animate-spin" /> Saving…
        </div>
      )}
    </div>
  );
}

// ── Shift cell (existing shift) ────────────────────────────────────────────

function ShiftCell({
  shift, isSelected, onSelect, onEdit, onRemove, bulkMode,
}: {
  shift:    Shift & { assignedTo: User };
  isSelected: boolean;
  onSelect: () => void;
  onEdit:   () => void;
  onRemove: () => void;
  bulkMode: boolean;
}) {
  const meta = PATTERN_META[shift.pattern];
  const Icon = meta.Icon;
  return (
    <div
      className={cn(
        "group relative flex items-start gap-1.5 rounded-md border p-1.5 text-xs transition-all cursor-pointer select-none",
        STATUS_STYLE[shift.status],
        isSelected && "ring-2 ring-indigo-400 ring-offset-1",
        shift.status === "CANCELLED" && "pointer-events-none"
      )}
      onClick={bulkMode ? onSelect : undefined}
    >
      {bulkMode && shift.status !== "CANCELLED" && (
        <div className="mt-0.5 shrink-0" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          {isSelected
            ? <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
            : <Square className="h-3.5 w-3.5 text-gray-400" />}
        </div>
      )}
      <Icon className={cn("h-3 w-3 mt-0.5 shrink-0", meta.color)} />
      <span className="font-medium truncate flex-1">{meta.shortLabel}</span>
      {shift.status === "ACTIVE" && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mt-1" />
      )}
      {!bulkMode && shift.status !== "ACTIVE" && shift.status !== "CANCELLED" && (
        <div className="absolute right-1 top-1 hidden group-hover:flex gap-0.5">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="rounded p-0.5 hover:bg-white/80" title="Edit">
            <Pencil className="h-3 w-3 text-gray-500" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="rounded p-0.5 hover:bg-white/80" title="Remove">
            <Trash2 className="h-3 w-3 text-red-400" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Day-off cell ───────────────────────────────────────────────────────────

function DayOffCell({ onClear }: { onClear: () => void }) {
  return (
    <div className="group relative flex items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 py-1.5 text-[10px] text-gray-400 select-none">
      <BanIcon className="h-3 w-3 mr-1 text-gray-300" />
      W/O
      <button
        onClick={onClear}
        className="absolute right-1 top-1 hidden group-hover:block rounded p-0.5 hover:bg-gray-200"
        title="Clear day off"
      >
        <X className="h-2.5 w-2.5 text-gray-400" />
      </button>
    </div>
  );
}

// ── Bulk assign dialog (multi-member + date range) ────────────────────────

function BulkAssignDialog({
  state, onClose, onSubmit, submitting,
}: {
  state:      BulkDialogState;
  onClose:    () => void;
  onSubmit:   (data: { pattern: ShiftPattern; startDate: string; endDate: string; notes: string }) => void;
  submitting: boolean;
}) {
  const today = dateStr(new Date());
  const [pattern,   setPattern]   = useState<ShiftPattern>("MORNING");
  const [startDate, setStartDate] = useState(today);
  const [endDate,   setEndDate]   = useState(today);
  const [notes,     setNotes]     = useState("");

  if (!state.open) return null;
  const meta = PATTERN_META[pattern];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="font-semibold text-gray-900">Bulk Assign — {state.userIds.length} Members</h3>
            <p className="mt-0.5 text-xs text-gray-500">Creates one shift per member per day in the selected range.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {/* Pattern picker */}
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700">Shift Pattern</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PATTERN_META) as ShiftPattern[]).map((p) => {
                const m = PATTERN_META[p]; const I = m.Icon;
                return (
                  <button key={p} onClick={() => setPattern(p)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 text-xs font-medium transition-all",
                      pattern === p ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 hover:border-gray-300 text-gray-600"
                    )}>
                    <I className={cn("h-4 w-4", pattern === p ? "text-indigo-600" : m.color)} />
                    <span>{m.label}</span>
                    <span className="text-[9px] opacity-60">{m.hours}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">End Date</label>
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* Preview pill */}
          <div className={cn("flex items-center gap-2 rounded-lg border p-3 text-xs", meta.border, meta.bg)}>
            <meta.Icon className={cn("h-4 w-4", meta.color)} />
            <span className={meta.color}>
              <strong>{meta.label}</strong> · {meta.hours} · {startDate} → {endDate}
            </span>
          </div>
        </div>

        <div className="flex gap-3 border-t px-5 py-4">
          <Button onClick={() => onSubmit({ pattern, startDate, endDate, notes })} disabled={submitting}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
            {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : `Assign ${state.userIds.length} Members`}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ── Edit dialog ────────────────────────────────────────────────────────────

function EditDialog({ state, onClose, onSubmit, submitting }: {
  state: EditDialogState; onClose: () => void;
  onSubmit: (d: { pattern?: ShiftPattern; notes?: string; status?: string }) => void;
  submitting: boolean;
}) {
  const [pattern, setPattern] = useState<ShiftPattern>(state.shift?.pattern ?? "MORNING");
  const [notes,   setNotes]   = useState(state.shift?.notes ?? "");
  const [status,  setStatus]  = useState<ShiftStatus>(state.shift?.status ?? "SCHEDULED");
  if (!state.open || !state.shift) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="font-semibold text-gray-900">Edit Shift</h3>
            <p className="mt-0.5 text-xs text-gray-500">{state.shift.assignedTo.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100"><X className="h-4 w-4 text-gray-500" /></button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">Pattern</label>
            <Select value={pattern} onValueChange={(v) => setPattern(v as ShiftPattern)}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PATTERN_META) as ShiftPattern[]).map((p) => (
                  <SelectItem key={p} value={p} className="text-sm">
                    {PATTERN_META[p].label} ({PATTERN_META[p].hours})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as ShiftStatus)}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["SCHEDULED","ACTIVE","HANDED_OVER","COMPLETED","CANCELLED"] as ShiftStatus[]).map((s) => (
                  <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        <div className="flex gap-3 border-t px-5 py-4">
          <Button onClick={() => onSubmit({ pattern, notes, status })} disabled={submitting}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
            {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ── Remove dialog ──────────────────────────────────────────────────────────

function RemoveDialog({ state, onClose, onConfirm, submitting }: {
  state: RemoveDialogState; onClose: () => void;
  onConfirm: (reason: string) => void; submitting: boolean;
}) {
  const [reason, setReason] = useState("");
  if (!state.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
            <Trash2 className="h-4 w-4 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              Remove {state.shiftIds.length > 1 ? `${state.shiftIds.length} Shifts` : "Shift"}
            </h3>
            <p className="text-xs text-gray-500">This will cancel the selected shift(s).</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          {state.names.length > 0 && (
            <div className="rounded-lg bg-gray-50 border px-3 py-2 text-xs text-gray-600 max-h-28 overflow-y-auto space-y-1">
              {state.names.map((n, i) => <div key={i} className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-gray-400" />{n}</div>)}
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Reason (optional)</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Member on leave"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
          </div>
        </div>
        <div className="flex gap-3 border-t px-5 py-4">
          <Button onClick={() => onConfirm(reason)} disabled={submitting}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white">
            {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Cancel Shift(s)"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Back</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function ShiftCalendarManager({ shifts: initialShifts, currentUser }: ShiftCalendarManagerProps) {
  const [weekOffset,   setWeekOffset]   = useState(0);
  const [projectId,    setProjectId]    = useState(currentUser.activeProjectId ?? MOCK_PROJECTS[0].id);
  const [roleFilter,   setRoleFilter]   = useState<"all" | "CONTRACTOR" | "EMPLOYEE" | "LEAD">("all");
  const [memberSearch, setMemberSearch] = useState("");
  const [bulkMode,     setBulkMode]     = useState(false);
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set());

  // Day-off local overrides: key = `${userId}__${dayStr}`
  const [dayOffs, setDayOffs] = useState<Set<DayOffKey>>(new Set());

  // Per-member weekoff pattern override (manager can change via pill in grid)
  const [weekoffOverrides, setWeekoffOverrides] = useState<Map<string, keyof typeof WEEKOFF_PATTERNS>>(new Map());
  const [weekoffPopover, setWeekoffPopover] = useState<{ userId: string; anchorId: string } | null>(null);

  const [picker,      setPicker]      = useState<PickerState>({ open: false, userId: "", mode: "day", dayStr: "", anchorId: "" });
  const [pickerSaving, setPickerSaving] = useState(false);
  const [bulkDialog,  setBulkDialog]  = useState<BulkDialogState>({ open: false, userIds: [] });
  const [editDialog,  setEditDialog]  = useState<EditDialogState>({ open: false, shift: null });
  const [removeDialog, setRemoveDialog] = useState<RemoveDialogState>({ open: false, shiftIds: [], names: [] });

  const [submitting, setSubmitting] = useState(false);
  const [toasts,     setToasts]     = useState<Toast[]>([]);
  const [localShifts, setLocalShifts] = useState(initialShifts);

  // ── Derived ────────────────────────────────────────────────────────────────

  const weekDates    = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const holidayMap   = useHolidayMap();

  const projectMembers = useMemo(() => {
    // Only show users who have at least one non-cancelled shift in the selected project.
    // This keeps the list project-scoped and prevents duplicates from cross-project users.
    const projectUserIds = new Set(
      localShifts
        .filter((s) => s.projectId === projectId && s.status !== "CANCELLED")
        .map((s) => s.assignedToId)
    );

    let m = MOCK_USERS.filter(
      (u) => MANAGE_ROLES.includes(u.role) && projectUserIds.has(u.id)
    );

    // For LEAD: always include themselves in their own active project so they
    // can assign themselves even before any shift exists.
    if (currentUser.role === "LEAD" && currentUser.activeProjectId === projectId) {
      if (!m.find((u) => u.id === currentUser.id)) {
        const self = MOCK_USERS.find((u) => u.id === currentUser.id);
        if (self) m = [self, ...m];
      }
    }

    if (roleFilter !== "all") m = m.filter((u) => u.role === roleFilter);
    if (memberSearch.trim()) {
      const q = memberSearch.toLowerCase();
      m = m.filter((u) => u.name.toLowerCase().includes(q));
    }
    return m;
  }, [currentUser, localShifts, projectId, roleFilter, memberSearch]);

  const shiftMap = useMemo(() => {
    const map = new Map<string, Map<string, (Shift & { assignedTo: User })[]>>();
    for (const s of localShifts.filter((x) => x.projectId === projectId)) {
      if (!map.has(s.assignedToId)) map.set(s.assignedToId, new Map());
      const ds = dateStr(s.startTime);
      const dm = map.get(s.assignedToId)!;
      if (!dm.has(ds)) dm.set(ds, []);
      dm.get(ds)!.push(s);
    }
    return map;
  }, [localShifts, projectId]);

  // ── Over-assignment analysis ──────────────────────────────────────────────
  // Resolve each member's weekoff pattern:
  //   1. Manager override (weekoffOverrides map) takes priority
  //   2. Fall back to auto-infer from shift data
  const overloadMap = useMemo(() => {
    const map = new Map<string, OverloadInfo>();
    for (const u of projectMembers) {
      const userShifts = localShifts.filter(
        (s) => s.assignedToId === u.id && s.status !== "CANCELLED"
      );
      // Auto-infer weekoff from which days have shifts (JS getDay: 0=Sun,1=Mon...6=Sat):
      //   "Sat-Sun" off → works Mon–Fri  → hasMon=T, hasSat=F, hasSun=F
      //   "Sun-Mon" off → works Tue–Sat  → hasMon=F, hasSat=T, hasSun=F
      //   "Fri-Sat" off → works Sun–Thu  → hasSun=T, hasSat=F
      const hasSunShift = userShifts.some((s) => s.startTime.getDay() === 0);
      const hasMonShift = userShifts.some((s) => s.startTime.getDay() === 1);
      const hasSatShift = userShifts.some((s) => s.startTime.getDay() === 6);
      const inferred: keyof typeof WEEKOFF_PATTERNS =
        hasSatShift && !hasMonShift ? "Sun-Mon"
        : hasSunShift && !hasSatShift ? "Fri-Sat"
        : "Sat-Sun";
      // Manager override wins over inferred
      const weekoffKey = weekoffOverrides.get(u.id) ?? inferred;

      map.set(u.id, getOverloadInfo(u.id, weekDates, shiftMap, weekoffKey));
    }
    return map;
  }, [projectMembers, weekDates, shiftMap, localShifts, weekoffOverrides]);

  // ── Close weekoff popover on outside click ────────────────────────────────
  useEffect(() => {
    if (!weekoffPopover) return;
    const handler = (e: MouseEvent) => {
      const anchor = document.getElementById(weekoffPopover.anchorId);
      if (anchor && anchor.contains(e.target as Node)) return; // pill click handled by button
      setWeekoffPopover(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [weekoffPopover]);

  // ── Toast ──────────────────────────────────────────────────────────────────

  const toast = useCallback((type: "success" | "error", msg: string) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, type, msg }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4500);
  }, []);

  // ── Picker helpers ─────────────────────────────────────────────────────────

  const openPicker = (userId: string, mode: "day" | "week", dayStr: string, anchorId: string) => {
    setPicker({ open: true, userId, mode, dayStr, anchorId });
  };

  const closePicker = useCallback(() => {
    if (!pickerSaving) setPicker((p) => ({ ...p, open: false }));
  }, [pickerSaving]);

  /** Quick-assign: called when user picks a pattern in the inline picker */
  const handlePickerAssign = async (pattern: ShiftPattern) => {
    setPickerSaving(true);
    const { userId, mode, dayStr } = picker;

    const daysToAssign: string[] = mode === "week"
      ? WORK_DAY_IDX.map((i) => dateStr(weekDates[i]))
      : [dayStr];

    let created = 0;
    let skipped = 0;

    for (const ds of daysToAssign) {
      const conflict = localShifts.find(
        (s) => s.assignedToId === userId && s.status !== "CANCELLED" &&
          new Date(patternStartISO(ds, pattern)) < s.endTime &&
          new Date(patternEndISO(ds, pattern))   > s.startTime
      );
      if (conflict) { skipped++; continue; }

      const result = await addMemberToShift({
        userId, projectId, pattern,
        startTime: patternStartISO(ds, pattern),
        endTime:   patternEndISO(ds, pattern),
        timezone:  "Asia/Kolkata",
      });

      if (result.success) {
        created++;
        const user = MOCK_USERS.find((u) => u.id === userId)!;
        const now  = new Date();
        const st   = new Date(patternStartISO(ds, pattern));
        const et   = new Date(patternEndISO(ds, pattern));
        const status: ShiftStatus = now >= st && now <= et ? "ACTIVE" : et < now ? "COMPLETED" : "SCHEDULED";
        const optimistic: Shift & { assignedTo: User } = {
          id: result.data.shiftId, pattern, status,
          startTime: st, endTime: et, timezone: "Asia/Kolkata",
          notes: null, projectId, partnerTeamId: null,
          assignedToId: userId, approvedById: currentUser.id,
          assignedTo: user, createdAt: now, updatedAt: now,
        };
        setLocalShifts((prev) => [...prev, optimistic]);
        // Clear any day-off override for this cell
        setDayOffs((prev) => { const n = new Set(prev); n.delete(`${userId}__${ds}`); return n; });
      } else {
        skipped++;
      }
    }

    setPickerSaving(false);
    setPicker((p) => ({ ...p, open: false }));

    if (created > 0) {
      toast("success", mode === "week"
        ? `${created} day${created > 1 ? "s" : ""} assigned${skipped ? `, ${skipped} skipped (conflict)` : ""}.`
        : "Shift assigned.");
    } else {
      toast("error", skipped > 0 ? "Conflict — shift overlaps an existing one." : "Failed to assign.");
    }
  };

  const handlePickerDayOff = () => {
    const { userId, mode, dayStr } = picker;
    const daysToMark = mode === "week" ? WORK_DAY_IDX.map((i) => dateStr(weekDates[i])) : [dayStr];
    setDayOffs((prev) => {
      const next = new Set(prev);
      daysToMark.forEach((ds) => next.add(`${userId}__${ds}`));
      return next;
    });
    setPicker((p) => ({ ...p, open: false }));
    toast("success", mode === "week" ? `${daysToMark.length} days marked as day off.` : "Day marked as off.");
  };

  // ── Bulk actions ───────────────────────────────────────────────────────────

  const handleBulkAssignSubmit = async (data: {
    pattern: ShiftPattern; startDate: string; endDate: string; notes: string;
  }) => {
    setSubmitting(true);
    const result = await bulkAssignShifts({
      userIds: Array.from(selectedIds), projectId,
      pattern: data.pattern, startDate: data.startDate, endDate: data.endDate,
      timezone: "Asia/Kolkata", notes: data.notes || undefined,
    });
    setSubmitting(false);
    setBulkDialog({ open: false, userIds: [] });
    if (result.success) {
      toast("success", `${result.data.created} shift(s) assigned${result.data.skipped ? `, ${result.data.skipped} conflict(s) skipped` : ""}.`);
      setSelectedIds(new Set());
    } else {
      toast("error", result.error);
    }
  };

  const handleEditSubmit = async (data: { pattern?: ShiftPattern; notes?: string; status?: string }) => {
    if (!editDialog.shift) return;
    setSubmitting(true);
    const result = await editShift({ shiftId: editDialog.shift.id, ...data });
    setSubmitting(false);
    if (result.success) {
      toast("success", "Shift updated.");
      setLocalShifts((prev) => prev.map((s) =>
        s.id === editDialog.shift!.id
          ? { ...s, ...(data.pattern ? { pattern: data.pattern } : {}), notes: data.notes ?? s.notes, status: (data.status as ShiftStatus) ?? s.status }
          : s
      ));
    } else {
      toast("error", result.error);
    }
    setEditDialog({ open: false, shift: null });
  };

  const handleRemoveConfirm = async (reason: string) => {
    setSubmitting(true);
    const result = removeDialog.shiftIds.length === 1
      ? await removeFromShift({ shiftId: removeDialog.shiftIds[0], reason })
      : await bulkRemoveShifts({ shiftIds: removeDialog.shiftIds, reason });
    setSubmitting(false);
    if (result.success) {
      toast("success", "cancelled" in result.data ? `${result.data.cancelled} shift(s) cancelled.` : "Shift cancelled.");
      const ids = new Set(removeDialog.shiftIds);
      setLocalShifts((prev) => prev.map((s) => ids.has(s.id) ? { ...s, status: "CANCELLED" as ShiftStatus } : s));
      setSelectedShiftIds(new Set());
    } else {
      toast("error", result.error);
    }
    setRemoveDialog({ open: false, shiftIds: [], names: [] });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const allSelected = selectedIds.size === projectMembers.length && projectMembers.length > 0;

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3 border-b bg-white px-4 py-3">
        {currentUser.role === "MANAGER" && (
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-8 w-52 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MOCK_PROJECTS.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Week nav */}
        <div className="flex items-center gap-1 rounded-lg border bg-gray-50 px-1.5 py-1">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="rounded p-0.5 hover:bg-gray-200">
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <span className="min-w-[130px] text-center text-xs font-medium text-gray-700">
            {weekOffset === 0 ? "This Week" : weekOffset === 1 ? "Next Week" : weekOffset === -1 ? "Last Week"
              : `${weekDates[0].toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${weekDates[6].toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`}
          </span>
          <button onClick={() => setWeekOffset((w) => w + 1)} className="rounded p-0.5 hover:bg-gray-200">
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {weekOffset !== 0 && (
          <button onClick={() => setWeekOffset(0)} className="text-xs text-indigo-600 hover:underline">Today</button>
        )}

        {/* Search + filter (moved from sidebar) */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
          <Input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Search member…" className="h-8 pl-7 text-xs w-40" />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all"        className="text-xs">All Roles</SelectItem>
            <SelectItem value="CONTRACTOR" className="text-xs">Contractor</SelectItem>
            <SelectItem value="EMPLOYEE"   className="text-xs">Employee</SelectItem>
            <SelectItem value="LEAD"       className="text-xs">Lead</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-3 text-[10px] text-gray-400 border-r pr-3">
          <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-indigo-400" /> Click cell or ⚡ to assign</span>
          <span className="flex items-center gap-1"><BanIcon className="h-3 w-3 text-gray-400" /> Mark day off</span>
        </div>

        {/* Bulk mode */}
        <button
          onClick={() => { setBulkMode((b) => !b); setSelectedIds(new Set()); setSelectedShiftIds(new Set()); }}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            bulkMode ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
          )}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          {bulkMode ? "Exit Bulk" : "Bulk"}
        </button>

        {bulkMode && (
          <button onClick={() => setSelectedIds(allSelected ? new Set() : new Set(projectMembers.map((u) => u.id)))}
            className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline">
            {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        )}
        {bulkMode && selectedIds.size > 0 && (
          <Button size="sm" onClick={() => setBulkDialog({ open: true, userIds: Array.from(selectedIds) })}
            className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1">
            <Plus className="h-3.5 w-3.5" /> Assign {selectedIds.size}
          </Button>
        )}
        {bulkMode && selectedShiftIds.size > 0 && (
          <Button size="sm" variant="outline" onClick={() => {
            const ids = Array.from(selectedShiftIds);
            const names = ids.map((id) => {
              const s = localShifts.find((sh) => sh.id === id);
              return s ? `${s.assignedTo.name} — ${PATTERN_META[s.pattern].label} on ${dateStr(s.startTime)}` : id;
            });
            setRemoveDialog({ open: true, shiftIds: ids, names });
          }} className="h-8 border-red-200 text-red-600 hover:bg-red-50 text-xs gap-1">
            <Trash2 className="h-3.5 w-3.5" /> Remove {selectedShiftIds.size}
          </Button>
        )}
      </div>

      {/* ── Overload summary strip ── */}
      <OverloadSummaryStrip members={projectMembers} overloadMap={overloadMap} />

      {/* ── Weekoff pattern popover ── */}
      {weekoffPopover && (() => {
        const anchor = document.getElementById(weekoffPopover.anchorId);
        const rect   = anchor?.getBoundingClientRect();
        const POPUP_W = 160; const POPUP_H = 110;
        const style: React.CSSProperties = rect
          ? {
              position: "fixed",
              top: (window.innerHeight - rect.bottom) >= POPUP_H + 8 ? rect.bottom + 4 : Math.max(8, rect.top - POPUP_H - 4),
              left: Math.min(rect.left, window.innerWidth - POPUP_W - 8),
              zIndex: 70,
            }
          : { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 70 };

        const current = weekoffOverrides.get(weekoffPopover.userId) ?? (() => {
          const us = localShifts.filter((s) => s.assignedToId === weekoffPopover.userId && s.status !== "CANCELLED");
          const hasSun = us.some((s) => s.startTime.getDay() === 0);
          const hasMon = us.some((s) => s.startTime.getDay() === 1);
          const hasSat = us.some((s) => s.startTime.getDay() === 6);
          return (hasSat && !hasMon ? "Sun-Mon" : hasSun && !hasSat ? "Fri-Sat" : "Sat-Sun") as keyof typeof WEEKOFF_PATTERNS;
        })();

        return (
          <div style={style} className="w-40 rounded-lg border border-gray-200 bg-white shadow-xl">
            <div className="border-b px-3 py-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Weekoff Pattern</span>
              <button onClick={() => setWeekoffPopover(null)} className="rounded p-0.5 hover:bg-gray-100">
                <X className="h-3 w-3 text-gray-400" />
              </button>
            </div>
            <div className="p-1.5 space-y-0.5">
              {(Object.entries(WEEKOFF_PATTERNS) as [keyof typeof WEEKOFF_PATTERNS, { label: string }][]).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => {
                    setWeekoffOverrides((prev) => { const m = new Map(prev); m.set(weekoffPopover.userId, key); return m; });
                    setWeekoffPopover(null);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-left transition-colors",
                    current === key
                      ? "bg-violet-50 text-violet-700 border border-violet-200"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {current === key && <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />}
                  {current !== key && <span className="h-1.5 w-1.5 rounded-full bg-gray-200 shrink-0" />}
                  {label}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Grid ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Calendar table — full width, no left member sidebar */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs min-w-[700px]">
            <thead className="sticky top-0 z-10 bg-white shadow-sm">
              <tr>
                {/* Member column header */}
                <th className="w-48 border-b border-r border-gray-100 px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                  Member
                </th>
                {weekDates.map((d, i) => {
                  const todayCol = isToday(d);
                  const ds       = dateStr(d);
                  const hols     = holidayMap.get(ds) ?? [];
                  const isHol    = hols.length > 0;
                  return (
                    <th key={i} className={cn(
                      "border-b border-r border-gray-100 px-2 py-2.5 text-center font-medium min-w-[90px]",
                      isHol ? "bg-orange-50 text-orange-700" : todayCol ? "bg-indigo-50 text-indigo-700" : "bg-gray-50 text-gray-600"
                    )}>
                      <div className="text-[11px]">{DAY_LABELS[i]}</div>
                      <div className={cn("text-base font-bold leading-none mt-0.5", isHol ? "text-orange-700" : todayCol ? "text-indigo-600" : "text-gray-800")}>
                        {d.getDate()}
                      </div>
                      <div className="text-[9px] opacity-60 mt-0.5">{d.toLocaleDateString("en-GB", { month: "short" })}</div>
                      {isHol && (
                        <div className="mt-1 space-y-0.5">
                          {hols.map((h) => (
                            <div key={h.name} className="truncate rounded bg-orange-100 px-1 py-0.5 text-[9px] font-semibold text-orange-700 leading-tight">
                              {h.type === "IN" ? "🇮🇳" : h.type === "US" ? "🇺🇸" : h.type === "BOTH" ? "🌐" : "⭐"} {h.name}
                            </div>
                          ))}
                          <div className="rounded bg-orange-200/60 px-1 py-0.5 text-[9px] font-bold text-orange-800 leading-tight">
                            🏖️ On-Call
                          </div>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {projectMembers.map((u) => {
                const overload    = overloadMap.get(u.id);
                const hasOverload = overload && (overload.isOverDay || overload.isOverWeek || overload.hasOffViolation);
                return (
                <tr key={u.id} className={cn("transition-colors", hasOverload ? "hover:bg-orange-50/30 bg-orange-50/10" : "hover:bg-gray-50/50")}>
                  {/* Sticky member cell — avatar + name + role + overload + ⚡ */}
                  <td className={cn(
                    "w-48 border-r border-gray-100 px-2 py-2 sticky left-0 z-[5]",
                    hasOverload ? "bg-orange-50/80" : "bg-white/90"
                  )}>
                    <div className="flex items-center gap-1.5">
                      {/* Bulk checkbox */}
                      {bulkMode && (
                        <button
                          onClick={() => setSelectedIds((prev) => { const n = new Set(prev); n.has(u.id) ? n.delete(u.id) : n.add(u.id); return n; })}
                          className="shrink-0"
                        >
                          {selectedIds.has(u.id)
                            ? <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
                            : <Square className="h-3.5 w-3.5 text-gray-300" />}
                        </button>
                      )}
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: getAvatarColor(u.id) }}>
                        {getInitials(u.name).slice(0, 2)}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-medium text-gray-700 text-[11px] truncate">
                            {u.name.split(" ")[0]} {u.name.split(" ").slice(-1)[0]}
                          </span>
                          {overload && <OverloadBadge info={overload} compact />}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={cn("rounded-full px-1.5 py-0 text-[9px] font-semibold",
                            u.role === "CONTRACTOR" ? "bg-purple-100 text-purple-700"
                              : u.role === "EMPLOYEE" ? "bg-sky-100 text-sky-700"
                              : "bg-amber-100 text-amber-700")}>
                            {u.role === "CONTRACTOR" ? "C" : u.role === "EMPLOYEE" ? "E" : "L"}
                          </span>
                          {weekDates.some((d) => shiftMap.get(u.id)?.get(dateStr(d))?.some((s) => s.status === "ACTIVE")) && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          )}
                        </div>
                        {/* Weekoff pill — click to change pattern */}
                        <div className="relative mt-0.5">
                          <button
                            id={`wo-btn-${u.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setWeekoffPopover((prev) =>
                                prev?.userId === u.id ? null : { userId: u.id, anchorId: `wo-btn-${u.id}` }
                              );
                            }}
                            title="Click to change weekoff pattern"
                            className={cn(
                              "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-[9px] font-medium transition-colors cursor-pointer",
                              weekoffOverrides.has(u.id)
                                ? "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"
                                : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                            )}
                          >
                            <Calendar className="h-2 w-2 shrink-0" />
                            {WEEKOFF_PATTERNS[weekoffOverrides.get(u.id) ?? (
                              (() => {
                                const us = localShifts.filter((s) => s.assignedToId === u.id && s.status !== "CANCELLED");
                                const hasSun = us.some((s) => s.startTime.getDay() === 0);
                                const hasMon = us.some((s) => s.startTime.getDay() === 1);
                                const hasSat = us.some((s) => s.startTime.getDay() === 6);
                                return hasSat && !hasMon ? "Sun-Mon" : hasSun && !hasSat ? "Fri-Sat" : "Sat-Sun";
                              })()
                            )].label}
                          </button>
                        </div>
                      </div>
                      {/* ⚡ Assign whole week */}
                      {!bulkMode && (
                        <button
                          id={`week-btn-${u.id}`}
                          onClick={() => openPicker(u.id, "week", "", `week-btn-${u.id}`)}
                          title="Assign whole week"
                          className="ml-auto rounded p-0.5 text-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors shrink-0"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Day cells */}
                  {weekDates.map((d, di) => {
                    const ds             = dateStr(d);
                    const dayShifts      = shiftMap.get(u.id)?.get(ds) ?? [];
                    const isDayOff       = dayOffs.has(`${u.id}__${ds}`);
                    const today          = isToday(d);
                    const cellId         = `cell-${u.id}-${ds}`;
                    const activeShifts   = dayShifts.filter((s) => s.status !== "CANCELLED");
                    const hasActive      = activeShifts.length > 0;
                    const isDoubleBooked = activeShifts.length > 1;
                    const isOffDayViol   = overload?.offDayViolations.some((v) => v.dayStr === ds) ?? false;
                    const isHoliday      = (holidayMap.get(ds) ?? []).length > 0;

                    return (
                      <td key={di} className={cn(
                        "border-r border-gray-100 px-1.5 py-1.5 align-top min-w-[90px] relative",
                        isDoubleBooked ? "bg-red-50/60" :
                        isOffDayViol   ? "bg-orange-50/60" :
                        isHoliday      ? "bg-orange-50/40" :
                        today          ? "bg-indigo-50/30" : "",
                      )}>
                        {/* Overload indicator corner flag */}
                        {(isDoubleBooked || isOffDayViol) && (
                          <span className={cn(
                            "absolute right-1 top-1 rounded-full px-1 py-0 text-[8px] font-bold leading-tight",
                            isDoubleBooked ? "bg-red-200 text-red-700" : "bg-orange-200 text-orange-700"
                          )}>
                            {isDoubleBooked ? `×${activeShifts.length}` : "off"}
                          </span>
                        )}

                        <div className="space-y-1">
                          {/* Day-off badge */}
                          {isDayOff && (
                            <DayOffCell onClear={() => setDayOffs((prev) => { const n = new Set(prev); n.delete(`${u.id}__${ds}`); return n; })} />
                          )}

                          {/* Existing shifts */}
                          {!isDayOff && dayShifts.map((s) => (
                            <ShiftCell key={s.id} shift={s}
                              isSelected={selectedShiftIds.has(s.id)}
                              onSelect={() => setSelectedShiftIds((prev) => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                              onEdit={() => setEditDialog({ open: true, shift: s })}
                              onRemove={() => setRemoveDialog({ open: true, shiftIds: [s.id], names: [`${s.assignedTo.name} — ${PATTERN_META[s.pattern].label}`] })}
                              bulkMode={bulkMode}
                            />
                          ))}

                          {/* Add button — shows inline picker on click */}
                          {!bulkMode && !isDayOff && (
                            <button
                              id={cellId}
                              onClick={() => openPicker(u.id, "day", ds, cellId)}
                              className={cn(
                                "flex w-full items-center justify-center gap-1 rounded-md border py-1.5 text-[10px] transition-colors",
                                isDoubleBooked
                                  ? "border-dashed border-red-300 text-red-400 hover:bg-red-50"
                                  : hasActive
                                    ? "border-transparent text-gray-300 hover:border-dashed hover:border-gray-300 hover:text-indigo-400"
                                    : "border-dashed border-gray-300 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50"
                              )}
                            >
                              <Plus className="h-3 w-3" />
                              {!hasActive && "Add"}
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
              })}
            </tbody>
          </table>

          {projectMembers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Users className="h-10 w-10 opacity-20 mb-2" />
              <p className="text-sm font-medium">No members to display</p>
              <p className="text-xs mt-1">Adjust project or role filter.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Popups & dialogs ── */}
      <InlinePatternPicker
        state={picker}
        onPick={handlePickerAssign}
        onDayOff={handlePickerDayOff}
        onClose={closePicker}
        saving={pickerSaving}
      />
      <BulkAssignDialog
        state={bulkDialog}
        onClose={() => setBulkDialog({ open: false, userIds: [] })}
        onSubmit={handleBulkAssignSubmit}
        submitting={submitting}
      />
      <EditDialog state={editDialog} onClose={() => setEditDialog({ open: false, shift: null })} onSubmit={handleEditSubmit} submitting={submitting} />
      <RemoveDialog state={removeDialog} onClose={() => setRemoveDialog({ open: false, shiftIds: [], names: [] })} onConfirm={handleRemoveConfirm} submitting={submitting} />
      <Toaster toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}
