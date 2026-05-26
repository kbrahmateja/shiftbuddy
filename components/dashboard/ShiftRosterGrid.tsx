"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, Clock, Moon, Sun,
  Sunset, Coffee, PhoneCall, Calendar as CalendarIcon,
  AlertTriangle, CheckCircle2,
} from "lucide-react";
import { cn, SHIFT_PATTERN_LABELS, formatInTimezone, getInitials, getAvatarColor } from "@/lib/utils";
import type { Shift, ShiftPattern, ShiftStatus, User as UserType } from "@/types";
import { MOCK_USERS, MOCK_PROJECTS, MOCK_SHIFTS } from "@/lib/mock-data";
import {
  BUILTIN_HOLIDAYS_2026, DEFAULT_TOGGLES,
  CUSTOM_HOLIDAYS_KEY, CALENDAR_TOGGLES_KEY,
  type Holiday, type CalendarToggles,
} from "@/lib/holidays";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const PATTERN_ICONS: Record<ShiftPattern, React.ComponentType<{ className?: string }>> = {
  GENERAL: Sun, MORNING: Coffee, AFTERNOON: Sunset,
  NIGHT: Moon, WEEKEND: CalendarIcon, ON_CALL: PhoneCall,
};

const PATTERN_COLORS: Record<ShiftPattern, string> = {
  GENERAL:   "bg-amber-100 text-amber-800 border-amber-200",
  MORNING:   "bg-sky-100 text-sky-800 border-sky-200",
  AFTERNOON: "bg-orange-100 text-orange-800 border-orange-200",
  NIGHT:     "bg-indigo-100 text-indigo-800 border-indigo-200",
  WEEKEND:   "bg-violet-100 text-violet-800 border-violet-200",
  ON_CALL:   "bg-red-100 text-red-800 border-red-200",
};

const STATUS_DOT: Record<ShiftStatus, string> = {
  SCHEDULED:   "bg-gray-400",
  ACTIVE:      "bg-emerald-500 animate-pulse",
  HANDED_OVER: "bg-amber-400",
  COMPLETED:   "bg-blue-400",
  CANCELLED:   "bg-red-400",
};

const REFERENCE_TIMEZONES = [
  { iana: "America/Los_Angeles", label: "PST (Los Angeles)" },
  { iana: "Asia/Kolkata",        label: "IST (Bangalore/Hyderabad)" },
];

// IST shift hours: [startH, startM, endH, endM]
const PATTERN_HOURS: Record<ShiftPattern, [number, number, number, number]> = {
  MORNING:   [5,  30, 14, 30],
  AFTERNOON: [13, 30, 22, 30],
  NIGHT:     [21, 30, 6,  30],
  GENERAL:   [9,  0,  17, 0 ],
  WEEKEND:   [9,  0,  17, 0 ],
  ON_CALL:   [9,  0,  17, 0 ],
};

const DAY_LABELS   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─────────────────────────────────────────────
// HOLIDAYS — reads from shared lib + localStorage
// ─────────────────────────────────────────────

function useHolidays() {
  const [toggles, setToggles]       = useState<CalendarToggles>(DEFAULT_TOGGLES);
  const [custom, setCustom]         = useState<Holiday[]>([]);

  useEffect(() => {
    const loadToggles = () => {
      try {
        const raw = localStorage.getItem(CALENDAR_TOGGLES_KEY);
        return raw ? { ...DEFAULT_TOGGLES, ...JSON.parse(raw) } : DEFAULT_TOGGLES;
      } catch { return DEFAULT_TOGGLES; }
    };
    const loadCustom = () => {
      try {
        const raw = localStorage.getItem(CUSTOM_HOLIDAYS_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch { return []; }
    };
    setToggles(loadToggles());
    setCustom(loadCustom());

    // Re-read when settings page updates localStorage
    const onStorage = (e: StorageEvent) => {
      if (e.key === CALENDAR_TOGGLES_KEY) setToggles(loadToggles());
      if (e.key === CUSTOM_HOLIDAYS_KEY)  setCustom(loadCustom());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const allHolidays = [
    ...BUILTIN_HOLIDAYS_2026.filter((h) => {
      if (h.type === "BOTH") return toggles.IN || toggles.US;
      if (h.type === "IN")   return toggles.IN;
      if (h.type === "US")   return toggles.US;
      return false;
    }),
    ...custom,
  ];

  const getForDay = (day: Date): Holiday[] => {
    // Use local date (not UTC) to avoid timezone off-by-one issues
    const key = [
      day.getFullYear(),
      String(day.getMonth() + 1).padStart(2, "0"),
      String(day.getDate()).padStart(2, "0"),
    ].join("-");
    return allHolidays.filter((h) => h.date === key);
  };

  return { getForDay, toggles };
}

function HolidayPill({ h }: { h: Holiday }) {
  const styles =
    h.type === "IN"     ? "bg-orange-100 text-orange-700 border-orange-200" :
    h.type === "US"     ? "bg-blue-100 text-blue-700 border-blue-200"       :
    h.type === "CUSTOM" ? "bg-indigo-100 text-indigo-700 border-indigo-200" :
                          "bg-purple-100 text-purple-700 border-purple-200";
  const flag =
    h.type === "IN" ? "🇮🇳" : h.type === "US" ? "🇺🇸" :
    h.type === "CUSTOM" ? "⭐" : "🌐";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-tight ${styles}`}>
      {flag} {h.name}
    </span>
  );
}
const MONTH_NAMES  = ["January","February","March","April","May","June",
                      "July","August","September","October","November","December"];

// ─────────────────────────────────────────────
// COPIED ROSTER — localStorage persistence
// ─────────────────────────────────────────────

const COPY_KEY = "sb_roster_copies";

interface StoredShift {
  id: string;
  projectId: string;
  pattern: ShiftPattern;
  status: ShiftStatus;
  startTime: string;
  endTime: string;
  timezone: string;
  assignedToId: string;
  assignedToName: string;
  assignedToEmail: string;
}

function loadCopiedShifts(): StoredShift[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(COPY_KEY) ?? "[]"); }
  catch { return []; }
}
function saveCopiedShifts(s: StoredShift[]) {
  localStorage.setItem(COPY_KEY, JSON.stringify(s));
}

function weekKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const wn = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(wn).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────

function getWeekDays(ref: Date): Date[] {
  const monday = new Date(ref);
  const dow = monday.getDay();
  monday.setDate(monday.getDate() + (dow === 0 ? -6 : 1 - dow));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}

function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const first  = new Date(year, month, 1);
  const total  = new Date(year, month + 1, 0).getDate();
  const offset = first.getDay() === 0 ? 6 : first.getDay() - 1; // Mon=0
  const cells: (Date | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: total }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const grid: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) grid.push(cells.slice(i, i + 7));
  return grid;
}

function getDatesInRange(start: Date, end: Date, weekdays: number[]): Date[] {
  const dates: Date[] = [];
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  while (d <= e) {
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0..Sun=6
    if (weekdays.includes(dow)) dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function getPresetRange(preset: string, ref: Date): [Date, Date] {
  const wd = getWeekDays(ref);
  if (preset === "this_week")  return [wd[0], wd[6]];
  if (preset === "next_week")  { const nm = new Date(wd[0]); nm.setDate(nm.getDate()+7); return [nm, getWeekDays(nm)[6]]; }
  if (preset === "this_month") return [new Date(ref.getFullYear(), ref.getMonth(), 1),   new Date(ref.getFullYear(), ref.getMonth()+1, 0)];
  if (preset === "next_month") return [new Date(ref.getFullYear(), ref.getMonth()+1, 1), new Date(ref.getFullYear(), ref.getMonth()+2, 0)];
  return [wd[0], wd[6]];
}

function makeShiftDates(date: Date, pattern: ShiftPattern): [Date, Date] {
  const [sh, sm, eh, em] = PATTERN_HOURS[pattern];
  const start = new Date(date); start.setHours(sh, sm, 0, 0);
  const end   = new Date(date); if (sh > eh) end.setDate(end.getDate() + 1); end.setHours(eh, em, 0, 0);
  return [start, end];
}

function storedToDisplay(s: StoredShift): Shift & { assignedTo: UserType } {
  return {
    id: s.id, projectId: s.projectId, pattern: s.pattern,
    status: s.status, startTime: new Date(s.startTime), endTime: new Date(s.endTime),
    timezone: s.timezone, assignedToId: s.assignedToId,
    partnerTeamId: null, approvedById: null, notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    assignedTo: {
      id: s.assignedToId, name: s.assignedToName, email: s.assignedToEmail,
      displayName: null, avatarUrl: null, role: "EMPLOYEE" as const,
      timezone: "Asia/Kolkata", employeeId: null, isActive: true,
      lastLoginAt: null, createdAt: new Date(), updatedAt: new Date(),
    },
  };
}

// ─────────────────────────────────────────────
// SHIFT CELL
// ─────────────────────────────────────────────

function ShiftCell({
  shift, displayTimezone, personalView = false,
}: {
  shift: Shift & { assignedTo: UserType };
  displayTimezone: string;
  personalView?: boolean;
}) {
  const Icon       = PATTERN_ICONS[shift.pattern];
  const isActive   = shift.status === "ACTIVE";
  const projectName = personalView
    ? (MOCK_PROJECTS.find((p) => p.id === shift.projectId)?.name ?? shift.projectId)
    : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "group relative rounded-lg border p-2 text-[11px] cursor-default transition-all hover:shadow-sm",
            PATTERN_COLORS[shift.pattern],
            isActive && "ring-1 ring-emerald-400 ring-offset-1"
          )}>
            {/* Status dot */}
            <span className={cn("absolute right-1.5 top-1.5 h-2 w-2 rounded-full", STATUS_DOT[shift.status])} />

            {personalView ? (
              /* ── Personal view: project name + pattern + full time range ── */
              <>
                {projectName && (
                  <p className="mb-1 truncate text-[10px] font-bold leading-tight opacity-75 pr-3">
                    {projectName}
                  </p>
                )}
                <div className="flex items-center gap-1">
                  <Icon className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate font-semibold">{SHIFT_PATTERN_LABELS[shift.pattern]}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1 opacity-70">
                  <Clock className="h-2.5 w-2.5 flex-shrink-0" />
                  <span>
                    {formatInTimezone(new Date(shift.startTime), displayTimezone, { hour: "2-digit", minute: "2-digit", hour12: true })}
                    {" – "}
                    {formatInTimezone(new Date(shift.endTime),   displayTimezone, { hour: "2-digit", minute: "2-digit", hour12: true })}
                  </span>
                </div>
              </>
            ) : (
              /* ── Team view: assignee avatar + name + pattern + start time ── */
              <>
                <div className="flex items-center gap-1.5 mb-1.5 pr-3">
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: getAvatarColor(shift.assignedToId) }}>
                    {getInitials(shift.assignedTo.name)}
                  </div>
                  <span className="truncate font-semibold leading-tight">
                    {shift.assignedTo.name.split(" ")[0]}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Icon className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate font-medium">{shift.pattern}</span>
                </div>
                <div className="mt-1 flex items-center gap-1 opacity-70">
                  <Clock className="h-2.5 w-2.5 flex-shrink-0" />
                  <span>
                    {formatInTimezone(new Date(shift.startTime), displayTimezone, { hour: "2-digit", minute: "2-digit", hour12: true })}
                  </span>
                </div>
              </>
            )}
          </div>
        </TooltipTrigger>

        <TooltipContent className="max-w-[260px] space-y-1.5 p-3 text-xs">
          {personalView ? (
            <>
              <p className="font-semibold">{projectName}</p>
              <p className="text-gray-500">{SHIFT_PATTERN_LABELS[shift.pattern]}</p>
            </>
          ) : (
            <>
              <p className="font-semibold">{shift.assignedTo.name}</p>
              <p className="text-gray-500">{SHIFT_PATTERN_LABELS[shift.pattern]}</p>
            </>
          )}
          <div className="space-y-0.5 text-gray-400">
            <p>Start: {formatInTimezone(new Date(shift.startTime), displayTimezone)}</p>
            <p>End:   {formatInTimezone(new Date(shift.endTime),   displayTimezone)}</p>
          </div>
          <Badge variant="outline" className={cn("text-[10px]", PATTERN_COLORS[shift.pattern])}>
            {shift.status}
          </Badge>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─────────────────────────────────────────────
// BULK ASSIGN MODAL
// ─────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: "this_week",  label: "This week" },
  { value: "next_week",  label: "Next week" },
  { value: "this_month", label: "This month" },
  { value: "next_month", label: "Next month" },
];

const ALL_PATTERNS: ShiftPattern[] = ["MORNING", "AFTERNOON", "NIGHT", "GENERAL", "WEEKEND", "ON_CALL"];

const PROJECT_COLORS: string[] = [
  "bg-violet-100 text-violet-800 border-violet-300",
  "bg-sky-100 text-sky-800 border-sky-300",
  "bg-emerald-100 text-emerald-800 border-emerald-300",
  "bg-rose-100 text-rose-800 border-rose-300",
  "bg-amber-100 text-amber-800 border-amber-300",
  "bg-indigo-100 text-indigo-800 border-indigo-300",
  "bg-teal-100 text-teal-800 border-teal-300",
];

interface BulkAssignModalProps {
  referenceDate: Date;
  onAssign: (shifts: StoredShift[]) => void;
  onClose: () => void;
}

function BulkAssignModal({ referenceDate, onAssign, onClose }: BulkAssignModalProps) {
  const [projectId, setProjectId] = useState("");
  const [userIds,   setUserIds]   = useState<string[]>([]);
  const [pattern,   setPattern]   = useState<ShiftPattern>("MORNING");
  const [period,    setPeriod]    = useState("this_week");
  const [weekdays,  setWeekdays]  = useState<number[]>([0, 1, 2, 3, 4]);

  // Users assigned to selected project (from MOCK_SHIFTS)
  const projectUserIds = new Set(
    projectId ? MOCK_SHIFTS.filter((s) => s.projectId === projectId).map((s) => s.assignedToId) : []
  );
  const eligibleUsers = MOCK_USERS.filter(
    (u) => (u.role === "CONTRACTOR" || u.role === "EMPLOYEE" || u.role === "LEAD")
        && (projectId ? projectUserIds.has(u.id) : true)
  );

  // Reset selected users when project changes
  useEffect(() => { setUserIds([]); }, [projectId]);

  function toggleUser(id: string) {
    setUserIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function toggleAll() {
    setUserIds((prev) => prev.length === eligibleUsers.length ? [] : eligibleUsers.map((u) => u.id));
  }
  function toggleDay(d: number) {
    setWeekdays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());
  }

  const [start, end] = getPresetRange(period, referenceDate);
  const dates       = getDatesInRange(start, end, weekdays);
  const totalShifts = dates.length * userIds.length;
  const canSubmit   = projectId && userIds.length > 0 && dates.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const newShifts: StoredShift[] = userIds.flatMap((uid) => {
      const user = MOCK_USERS.find((u) => u.id === uid)!;
      return dates.map((date) => {
        const [s, en] = makeShiftDates(date, pattern);
        return {
          id:              `bulk_${uid}_${pattern}_${date.toISOString().slice(0, 10)}`,
          projectId,
          pattern,
          status:          "SCHEDULED" as ShiftStatus,
          startTime:       s.toISOString(),
          endTime:         en.toISOString(),
          timezone:        "Asia/Kolkata",
          assignedToId:    user.id,
          assignedToName:  user.name,
          assignedToEmail: user.email,
        };
      });
    });
    onAssign(newShifts);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h3 className="text-base font-semibold text-gray-900">Bulk Assign Shifts</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-5 flex-1">

          {/* ① PT / Project selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              Project Team <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {MOCK_PROJECTS.map((proj, idx) => (
                <button
                  key={proj.id} type="button"
                  onClick={() => setProjectId(proj.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                    projectId === proj.id
                      ? PROJECT_COLORS[idx % PROJECT_COLORS.length] + " ring-2 ring-offset-1 ring-indigo-400"
                      : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
                  )}
                >
                  {proj.name}
                </button>
              ))}
            </div>
            {projectId && (
              <p className="mt-1.5 text-[11px] text-gray-400">
                {eligibleUsers.length} team member{eligibleUsers.length !== 1 ? "s" : ""} in this project
              </p>
            )}
          </div>

          {/* ② Employee multi-select */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-600">
                Team Members <span className="text-red-500">*</span>
                {userIds.length > 0 && (
                  <span className="ml-1.5 text-indigo-600">({userIds.length} selected)</span>
                )}
              </label>
              {eligibleUsers.length > 0 && (
                <button
                  type="button" onClick={toggleAll}
                  className="text-[11px] text-indigo-600 hover:underline"
                >
                  {userIds.length === eligibleUsers.length ? "Deselect all" : "Select all"}
                </button>
              )}
            </div>

            {!projectId ? (
              <p className="text-xs text-gray-400 italic">Select a project first to see team members.</p>
            ) : eligibleUsers.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No team members found for this project.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                {eligibleUsers.map((u) => {
                  const selected = userIds.includes(u.id);
                  return (
                    <button
                      key={u.id} type="button"
                      onClick={() => toggleUser(u.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all",
                        selected
                          ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      )}
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: getAvatarColor(u.id) }}>
                        {getInitials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-tight">{u.name}</p>
                        <p className="truncate text-[10px] text-gray-400">{u.role}</p>
                      </div>
                      {selected && <span className="ml-auto text-indigo-500">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ③ Shift pattern */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Shift Pattern</label>
            <div className="flex flex-wrap gap-2">
              {ALL_PATTERNS.map((p) => {
                const Icon = PATTERN_ICONS[p];
                return (
                  <button
                    key={p} type="button"
                    onClick={() => setPattern(p)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                      pattern === p
                        ? PATTERN_COLORS[p] + " ring-2 ring-offset-1 ring-indigo-400"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    )}
                  >
                    <Icon className="h-3 w-3" />{p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ④ Period */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Period</label>
            <div className="grid grid-cols-4 gap-2">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value} type="button"
                  onClick={() => setPeriod(opt.value)}
                  className={cn(
                    "rounded-md border px-2 py-2 text-xs font-medium transition-all",
                    period === opt.value
                      ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ⑤ Working days */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Working Days</label>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((d, i) => (
                <button
                  key={d} type="button"
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "h-8 w-8 rounded-md text-xs font-semibold transition-all border",
                    weekdays.includes(i)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-gray-200 text-gray-400 hover:border-gray-300"
                  )}
                >
                  {d[0]}
                </button>
              ))}
            </div>
          </div>

          {/* ⑥ Preview */}
          <div className={cn(
            "rounded-md px-4 py-3 text-xs",
            canSubmit
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-gray-50 border border-gray-200 text-gray-400"
          )}>
            {canSubmit
              ? <>
                  <strong>{totalShifts} shifts</strong> will be created —{" "}
                  <strong>{dates.length}</strong> date{dates.length !== 1 ? "s" : ""} ×{" "}
                  <strong>{userIds.length}</strong> employee{userIds.length !== 1 ? "s" : ""} as{" "}
                  <strong>{pattern}</strong>
                  {" "}({start.toLocaleDateString([], { month: "short", day: "numeric" })} –{" "}
                  {end.toLocaleDateString([], { month: "short", day: "numeric" })})
                </>
              : "Select project, team members, pattern and period to preview."
            }
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t shrink-0">
          <button
            type="button"
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={!canSubmit}
            className="flex-1 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {canSubmit ? `Assign ${totalShifts} Shifts` : "Assign Shifts"}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ADD SINGLE SHIFT MODAL
// ─────────────────────────────────────────────

interface AddShiftModalProps {
  day: Date;
  projectId: string;
  onAdd: (shift: StoredShift) => void;
  onClose: () => void;
}

function AddShiftModal({ day, projectId, onAdd, onClose }: AddShiftModalProps) {
  const [userId,  setUserId]  = useState("");
  const [pattern, setPattern] = useState<ShiftPattern>("MORNING");

  const projectUserIds = new Set(
    MOCK_SHIFTS.filter((s) => s.projectId === projectId).map((s) => s.assignedToId)
  );
  const eligibleUsers = MOCK_USERS.filter(
    (u) => (u.role === "CONTRACTOR" || u.role === "EMPLOYEE" || u.role === "LEAD")
        && projectUserIds.has(u.id)
  );

  const dateLabel = day.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const user = MOCK_USERS.find((u) => u.id === userId)!;
    const [start, end] = makeShiftDates(day, pattern);
    onAdd({
      id:              `add_${userId}_${pattern}_${day.toISOString().slice(0, 10)}`,
      projectId,
      pattern,
      status:          "SCHEDULED",
      startTime:       start.toISOString(),
      endTime:         end.toISOString(),
      timezone:        "Asia/Kolkata",
      assignedToId:    user.id,
      assignedToName:  user.name,
      assignedToEmail: user.email,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Add Shift</h3>
            <p className="text-xs text-gray-400 mt-0.5">{dateLabel}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Employee */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Team Member <span className="text-red-500">*</span>
            </label>
            {eligibleUsers.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No team members found for this project.</p>
            ) : (
              <div className="grid grid-cols-1 gap-1 max-h-[160px] overflow-y-auto">
                {eligibleUsers.map((u) => (
                  <button
                    key={u.id} type="button"
                    onClick={() => setUserId(u.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-all",
                      userId === u.id
                        ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    )}
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: getAvatarColor(u.id) }}>
                      {getInitials(u.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.name}</p>
                      <p className="text-[10px] text-gray-400">{u.role}</p>
                    </div>
                    {userId === u.id && <span className="ml-auto text-indigo-500">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pattern */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Shift Pattern</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_PATTERNS.map((p) => {
                const Icon = PATTERN_ICONS[p];
                return (
                  <button
                    key={p} type="button"
                    onClick={() => setPattern(p)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                      pattern === p
                        ? PATTERN_COLORS[p] + " ring-2 ring-offset-1 ring-indigo-400"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    )}
                  >
                    <Icon className="h-3 w-3" />{p}
                  </button>
                );
              })}
            </div>
            {/* Time hint */}
            <p className="mt-1.5 text-[11px] text-gray-400">
              {pattern === "MORNING"   && "05:30 – 14:30 IST"}
              {pattern === "AFTERNOON" && "13:30 – 22:30 IST"}
              {pattern === "NIGHT"     && "21:30 – 06:30 IST (next day)"}
              {pattern === "GENERAL"   && "09:00 – 17:00 IST"}
              {pattern === "WEEKEND"   && "09:00 – 17:00 IST"}
              {pattern === "ON_CALL"   && "09:00 – 17:00 IST"}
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={!userId}
              className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add Shift
            </button>
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN ROSTER GRID
// ─────────────────────────────────────────────

interface ShiftRosterGridProps {
  shifts:       (Shift & { assignedTo: UserType })[];
  projectId?:   string;
  canEdit?:     boolean;
  /** True when the viewer is a CONTRACTOR/EMPLOYEE seeing only their own shifts */
  personalView?: boolean;
}

export function ShiftRosterGrid({
  shifts,
  projectId    = "",
  canEdit      = false,
  personalView = false,
}: ShiftRosterGridProps) {
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());
  const [displayTz,     setDisplayTz]     = useState<string>("America/Los_Angeles");
  const [copiedShifts,  setCopiedShifts]  = useState<StoredShift[]>([]);
  const [copyFlash,      setCopyFlash]      = useState(false);
  const [monthCopyFlash, setMonthCopyFlash] = useState(false);
  const [viewMode,       setViewMode]       = useState<"week" | "month">("week");
  const [showBulkModal,  setShowBulkModal]  = useState(false);
  const [addDay,         setAddDay]         = useState<Date | null>(null);
  const { getForDay: getHolidaysForDay, toggles: calToggles } = useHolidays();

  useEffect(() => { setCopiedShifts(loadCopiedShifts()); }, []);

  // Merge prop shifts + localStorage copies
  const allDisplayShifts: (Shift & { assignedTo: UserType })[] = [
    ...shifts,
    ...copiedShifts.map(storedToDisplay),
  ];

  const today      = new Date();
  const weekDays   = getWeekDays(referenceDate);
  const monthYear  = { y: referenceDate.getFullYear(), m: referenceDate.getMonth() };
  const monthGrid  = getMonthGrid(monthYear.y, monthYear.m);

  function getShiftsForDay(day: Date) {
    return allDisplayShifts.filter((s) => isSameDay(new Date(s.startTime), day));
  }

  // Week label
  const ws = weekDays[0], we = weekDays[6];
  const weekLabel = ws.getMonth() === we.getMonth()
    ? `${MONTH_NAMES[ws.getMonth()]} ${ws.getDate()}–${we.getDate()}, ${ws.getFullYear()}`
    : `${MONTH_NAMES[ws.getMonth()]} ${ws.getDate()} – ${MONTH_NAMES[we.getMonth()]} ${we.getDate()}, ${we.getFullYear()}`;

  function prevPeriod() {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + (viewMode === "week" ? -7 : -monthGrid.flat().filter(Boolean).length));
    if (viewMode === "month") { d.setDate(1); d.setMonth(d.getMonth() - 1); }
    setReferenceDate(d);
  }
  function nextPeriod() {
    const d = new Date(referenceDate);
    if (viewMode === "week") { d.setDate(d.getDate() + 7); }
    else { d.setDate(1); d.setMonth(d.getMonth() + 1); }
    setReferenceDate(d);
  }
  function goToToday() { setReferenceDate(new Date()); }

  // Copy previous week
  function copyFromPreviousWeek() {
    const prevDays    = getWeekDays(new Date(referenceDate.getTime() - 7 * 86400000));
    const thisWK      = weekKey(referenceDate);
    const projectId   = shifts[0]?.projectId ?? copiedShifts[0]?.projectId ?? "";
    const prevShifts  = allDisplayShifts.filter((s) => prevDays.some((d) => isSameDay(new Date(s.startTime), d)));
    if (!prevShifts.length) return;
    const existing  = loadCopiedShifts().filter(
      (s) => !(weekKey(new Date(s.startTime)) === thisWK && s.projectId === projectId)
    );
    const newCopies: StoredShift[] = prevShifts.map((s) => ({
      id:              `copy_${s.id}_${thisWK}`,
      projectId:       s.projectId,
      pattern:         s.pattern,
      status:          "SCHEDULED" as ShiftStatus,
      startTime:       new Date(new Date(s.startTime).getTime() + 7*86400000).toISOString(),
      endTime:         new Date(new Date(s.endTime  ).getTime() + 7*86400000).toISOString(),
      timezone:        s.timezone,
      assignedToId:    s.assignedToId,
      assignedToName:  s.assignedTo.name,
      assignedToEmail: s.assignedTo.email,
    }));
    const updated = [...existing, ...newCopies];
    saveCopiedShifts(updated);
    setCopiedShifts(updated);
    setCopyFlash(true);
    setTimeout(() => setCopyFlash(false), 2000);
  }

  // Copy previous month
  function copyFromPreviousMonth() {
    const y = referenceDate.getFullYear();
    const m = referenceDate.getMonth();
    const prevY = m === 0 ? y - 1 : y;
    const prevM = m === 0 ? 11 : m - 1;
    const daysInCurMonth = new Date(y, m + 1, 0).getDate();
    const projectId = shifts[0]?.projectId ?? copiedShifts[0]?.projectId ?? "";

    // Shifts from previous month
    const prevShifts = allDisplayShifts.filter((s) => {
      const d = new Date(s.startTime);
      return d.getFullYear() === prevY && d.getMonth() === prevM;
    });
    if (!prevShifts.length) return;

    // Remove existing copies for current month+project
    const existing = loadCopiedShifts().filter((s) => {
      const d = new Date(s.startTime);
      return !(d.getFullYear() === y && d.getMonth() === m && s.projectId === projectId);
    });

    const newCopies: StoredShift[] = prevShifts.flatMap((s) => {
      const dayOfMonth = new Date(s.startTime).getDate();
      if (dayOfMonth > daysInCurMonth) return []; // skip e.g. Jan 31 → Feb
      const newDate = new Date(y, m, dayOfMonth);
      const [newStart, newEnd] = makeShiftDates(newDate, s.pattern);
      return [{
        id:              `mcopy_${s.id}_${y}-${m}`,
        projectId:       s.projectId,
        pattern:         s.pattern,
        status:          "SCHEDULED" as ShiftStatus,
        startTime:       newStart.toISOString(),
        endTime:         newEnd.toISOString(),
        timezone:        s.timezone,
        assignedToId:    s.assignedToId,
        assignedToName:  s.assignedTo.name,
        assignedToEmail: s.assignedTo.email,
      }];
    });

    const updated = [...existing, ...newCopies];
    saveCopiedShifts(updated);
    setCopiedShifts(updated);
    setMonthCopyFlash(true);
    setTimeout(() => setMonthCopyFlash(false), 2000);
  }

  // Bulk assign handler
  function handleBulkAssign(newShifts: StoredShift[]) {
    const existing = loadCopiedShifts().filter(
      (s) => !newShifts.some((n) => n.id === s.id)
    );
    const updated = [...existing, ...newShifts];
    saveCopiedShifts(updated);
    setCopiedShifts(updated);
  }

  const prevWeekDays      = getWeekDays(new Date(referenceDate.getTime() - 7*86400000));
  const prevWeekHasShifts = prevWeekDays.some((d) => allDisplayShifts.some((s) => isSameDay(new Date(s.startTime), d)));
  const curWeekHasShifts  = weekDays.some((d) => getShiftsForDay(d).length > 0);

  const prevMonthY        = monthYear.m === 0 ? monthYear.y - 1 : monthYear.y;
  const prevMonthM        = monthYear.m === 0 ? 11 : monthYear.m - 1;
  const prevMonthHasShifts = allDisplayShifts.some((s) => {
    const d = new Date(s.startTime);
    return d.getFullYear() === prevMonthY && d.getMonth() === prevMonthM;
  });
  const curMonthHasShifts = allDisplayShifts.some((s) => {
    const d = new Date(s.startTime);
    return d.getFullYear() === monthYear.y && d.getMonth() === monthYear.m;
  });
  const activeCount       = allDisplayShifts.filter((s) => s.status === "ACTIVE").length;

  // Coverage check for week view
  const coverage = weekDays.map((d) => ({ day: d, count: getShiftsForDay(d).length }));
  const gapDays  = coverage.filter((c) => c.count === 0).length;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: view toggle + navigation */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Week / Month toggle */}
          <div className="flex rounded-md border overflow-hidden text-xs font-medium">
            {(["week","month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={cn("px-3 py-1.5 transition-colors border-r last:border-r-0 capitalize",
                  viewMode === v ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                )}
              >{v}</button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={prevPeriod} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[220px] text-center text-sm font-semibold text-gray-800">
            {viewMode === "week"
              ? weekLabel
              : `${MONTH_NAMES[monthYear.m]} ${monthYear.y}`}
          </span>
          <Button variant="outline" size="sm" onClick={nextPeriod} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday} className="h-8 text-xs">Today</Button>

          {/* Copy prev week (week view only) */}
          {viewMode === "week" && canEdit && prevWeekHasShifts && (
            <button
              onClick={copyFromPreviousWeek}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all",
                copyFlash
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : curWeekHasShifts
                  ? "border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600"
                  : "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              )}
            >
              {copyFlash ? "✓ Copied!" : "⟳ Copy previous week"}
            </button>
          )}

          {/* Copy prev month (month view only) */}
          {viewMode === "month" && canEdit && prevMonthHasShifts && (
            <button
              onClick={copyFromPreviousMonth}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all",
                monthCopyFlash
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : curMonthHasShifts
                  ? "border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600"
                  : "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              )}
            >
              {monthCopyFlash
                ? "✓ Copied!"
                : `⟳ Copy ${MONTH_NAMES[prevMonthM]}`}
            </button>
          )}
        </div>

        {/* Right: active badge + tz selector + bulk assign */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              {activeCount} active
            </div>
          )}
          <Select value={displayTz} onValueChange={setDisplayTz}>
            <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {REFERENCE_TIMEZONES.map((tz) => (
                <SelectItem key={tz.iana} value={tz.iana} className="text-xs">{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canEdit && (
            <button
              onClick={() => setShowBulkModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              + Bulk Assign
            </button>
          )}
        </div>
      </div>

      {/* ── Pattern legend + holiday legend (week view only) ── */}
      {viewMode === "week" && (
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(PATTERN_ICONS) as ShiftPattern[]).map((p) => {
            const Icon = PATTERN_ICONS[p];
            return (
              <span key={p} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium", PATTERN_COLORS[p])}>
                <Icon className="h-3 w-3" />{p}
              </span>
            );
          })}
          <span className="h-4 w-px bg-gray-200 mx-1" />
          {calToggles.IN && <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-100 px-2.5 py-0.5 text-[11px] font-medium text-orange-700">🇮🇳 India Holiday</span>}
          {calToggles.US && <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-100 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">🇺🇸 US Holiday</span>}
        </div>
      )}

      {/* ── Coverage check bar (week view only) ── */}
      {viewMode === "week" && (
        <div className={cn(
          "flex items-center gap-3 rounded-lg border px-4 py-2.5 text-xs",
          gapDays > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
        )}>
          {gapDays > 0
            ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          }
          <span className={gapDays > 0 ? "text-amber-700 font-medium" : "text-emerald-700 font-medium"}>
            {gapDays > 0
              ? personalView
                ? `${gapDays} day${gapDays > 1 ? "s" : ""} with no shifts scheduled`
                : `${gapDays} day${gapDays > 1 ? "s" : ""} with no shifts assigned`
              : personalView
                ? "You're fully scheduled this week"
                : "Full coverage this week"}
          </span>
          <div className="flex gap-1.5 ml-1">
            {coverage.map(({ day, count }) => (
              <span key={day.toISOString()} className="flex items-center gap-0.5">
                <span className="text-gray-400">{DAY_LABELS[day.getDay() === 0 ? 6 : day.getDay()-1]}</span>
                <span className={cn("ml-0.5 h-2 w-2 rounded-full", count > 0 ? "bg-emerald-400" : "bg-amber-400")} />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── WEEK VIEW ── */}
      {viewMode === "week" && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <div className="min-w-[700px]">
            {/* Header */}
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/50">
              {weekDays.map((day, idx) => {
                const isToday    = isSameDay(day, today);
                const dayShifts  = getShiftsForDay(day);
                const hasGap     = dayShifts.length === 0;
                const dayHols    = getHolidaysForDay(day);
                const isHoliday  = dayHols.length > 0;
                return (
                  <div key={day.toISOString()} className={cn(
                    "border-r border-gray-200 p-2.5 text-center last:border-r-0",
                    isHoliday ? "bg-orange-50" : isToday ? "bg-indigo-50" : hasGap ? "bg-amber-50/60" : ""
                  )}>
                    <p className={cn("text-xs font-semibold", isHoliday ? "text-orange-600" : isToday ? "text-indigo-700" : hasGap ? "text-amber-600" : "text-gray-500")}>{DAY_LABELS[idx]}</p>
                    <p className={cn("mt-0.5 text-base font-bold", isHoliday ? "text-orange-700" : isToday ? "text-indigo-700" : hasGap ? "text-amber-600" : "text-gray-800")}>{day.getDate()}</p>
                    {isHoliday
                      ? <span className="mt-0.5 inline-block rounded-full bg-orange-100 border border-orange-200 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">🏖️ On-Call</span>
                      : dayShifts.length > 0
                      ? <span className="mt-0.5 inline-block rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">{dayShifts.length}</span>
                      : <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">Gap</span>
                    }
                  </div>
                );
              })}
            </div>
            {/* Cells */}
            <div className="grid grid-cols-7">
              {weekDays.map((day) => {
                const dayShifts = getShiftsForDay(day);
                const isToday   = isSameDay(day, today);
                const hasGap    = dayShifts.length === 0;
                const dayHols   = getHolidaysForDay(day);
                const isHoliday = dayHols.length > 0;
                return (
                  <div key={day.toISOString()} className={cn(
                    "min-h-[140px] border-r border-gray-200 p-2 last:border-r-0",
                    isHoliday ? "bg-orange-50/40" : isToday ? "bg-indigo-50/30" : hasGap && !isToday ? "bg-amber-50/30" : ""
                  )}>
                    <div className="space-y-1.5">
                      {/* Holiday pills + On-Call policy note */}
                      {dayHols.map((h) => (
                        <HolidayPill key={h.date + h.name} h={h} />
                      ))}
                      {isHoliday && dayShifts.length > 0 && (
                        <div className="rounded border border-orange-200 bg-orange-100/60 px-1.5 py-1 text-[10px] text-orange-700 font-medium leading-tight">
                          🏖️ Holiday On-Call — P1/P2 respond, others ack only
                        </div>
                      )}
                      {dayShifts.map((s) => (
                        <ShiftCell key={s.id} shift={s} displayTimezone={displayTz} personalView={personalView} />
                      ))}
                      {canEdit && (
                        <button
                          onClick={() => setAddDay(day)}
                          className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-[11px] text-gray-400 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-500"
                        >
                          + Add shift
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── MONTH VIEW ── */}
      {viewMode === "month" && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b bg-gray-50">
            {DAY_LABELS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 border-r last:border-r-0">{d}</div>
            ))}
          </div>
          {/* Weeks */}
          {monthGrid.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
              {week.map((day, di) => {
                if (!day) return <div key={di} className="min-h-[90px] border-r last:border-r-0 bg-gray-50/50" />;
                const dayShifts = getShiftsForDay(day);
                const isToday   = isSameDay(day, today);
                const hasGap    = dayShifts.length === 0;
                const patterns  = Array.from(new Set(dayShifts.map((s) => s.pattern))) as ShiftPattern[];
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-[90px] border-r last:border-r-0 p-2 cursor-pointer transition-colors hover:bg-gray-50",
                      isToday && "bg-indigo-50/40",
                      hasGap && !isToday && "bg-amber-50/30"
                    )}
                    onClick={() => { setViewMode("week"); setReferenceDate(day); }}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className={cn("text-xs font-bold", isToday ? "text-indigo-700" : hasGap ? "text-amber-500" : "text-gray-700")}>
                        {day.getDate()}
                      </p>
                    </div>
                    {/* Holidays in month view */}
                    {getHolidaysForDay(day).map((h) => (
                      <div key={h.date + h.name} className={cn(
                        "mb-0.5 truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight",
                        h.type === "IN"   ? "bg-orange-100 text-orange-700" :
                        h.type === "US"   ? "bg-blue-100 text-blue-700"   :
                                            "bg-purple-100 text-purple-700"
                      )}>
                        {h.type === "IN" ? "🇮🇳" : h.type === "US" ? "🇺🇸" : "🌐"} {h.name}
                      </div>
                    ))}
                    {hasGap ? (
                      <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">No shifts</span>
                    ) : (
                      <div className="space-y-1">
                        {patterns.map((p) => {
                          const Icon = PATTERN_ICONS[p];
                          const count = dayShifts.filter((s) => s.pattern === p).length;
                          return (
                            <div key={p} className={cn("flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium", PATTERN_COLORS[p])}>
                              <Icon className="h-2.5 w-2.5" />
                              <span>{p}</span>
                              <span className="ml-auto font-bold">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        {viewMode === "week"
          ? <>All times in <span className="font-medium text-gray-600">{displayTz}</span>. Click any day in month view to zoom into that week.</>
          : "Click any day to switch to week view for that week."
        }
      </p>

      {/* Bulk Assign Modal */}
      {showBulkModal && (
        <BulkAssignModal
          referenceDate={referenceDate}
          onAssign={handleBulkAssign}
          onClose={() => setShowBulkModal(false)}
        />
      )}

      {addDay && (
        <AddShiftModal
          day={addDay}
          projectId={projectId}
          onAdd={(shift) => {
            const existing = loadCopiedShifts().filter((s) => s.id !== shift.id);
            const updated  = [...existing, shift];
            saveCopiedShifts(updated);
            setCopiedShifts(updated);
          }}
          onClose={() => setAddDay(null)}
        />
      )}
    </div>
  );
}
