"use client";

export const runtime = 'edge';
// app/(dashboard)/dashboard/projects/page.tsx
// ─────────────────────────────────────────────────────────────
// Full projects overview for MANAGER and GAP_STAKEHOLDER.
// Computes live stats from MOCK_* data — no DB needed.
// ─────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, Users, Activity, AlertTriangle, BookOpen,
  ArrowRight, Coffee, Sunset, Moon, Sun, PhoneCall, Calendar,
  CheckCircle2, TrendingUp, Layers, FolderOpen,
} from "lucide-react";
import { cn, getInitials, getAvatarColor } from "@/lib/utils";
import {
  MOCK_PROJECTS, MOCK_USERS, MOCK_SHIFTS, MOCK_LOGS, MOCK_DIARY_ENTRIES,
} from "@/lib/mock-data";
import type { ShiftPattern } from "@/types";
import { Input } from "@/components/ui/input";

// ── Config ────────────────────────────────────────────────────────────────

const PATTERN_META: Record<ShiftPattern, {
  shortLabel: string; color: string; bg: string; border: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  MORNING:   { shortLabel: "S1", color: "text-sky-700",    bg: "bg-sky-50",    border: "border-sky-200",    Icon: Coffee    },
  AFTERNOON: { shortLabel: "S2", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", Icon: Sunset    },
  NIGHT:     { shortLabel: "S3", color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200", Icon: Moon      },
  GENERAL:   { shortLabel: "GN", color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200",  Icon: Sun       },
  WEEKEND:   { shortLabel: "WE", color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200", Icon: Calendar  },
  ON_CALL:   { shortLabel: "OC", color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200",    Icon: PhoneCall },
};

const ALL_PATTERNS: ShiftPattern[] = ["MORNING", "AFTERNOON", "NIGHT", "GENERAL", "ON_CALL"];

// ── Per-project stats ─────────────────────────────────────────────────────

interface ProjectStats {
  id:            string;
  name:          string;
  description:   string;
  totalMembers:  number;
  contractors:   number;
  employees:     number;
  leads:         number;
  activeShifts:  number;
  scheduledToday: number;
  patternsActive: Set<ShiftPattern>;
  patternsWeek:   Set<ShiftPattern>;
  openLogs:      number;
  criticalLogs:  number;
  avgKt:         number | null;
  memberSample:  { id: string; name: string; role: string }[];
}

function buildProjectStats(): ProjectStats[] {
  const now      = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Week window (Sun → Sat)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  return MOCK_PROJECTS.map((proj) => {
    // Members assigned to this project (via any non-cancelled shift)
    const memberIds = new Set(
      MOCK_SHIFTS
        .filter((s) => s.projectId === proj.id && s.status !== "CANCELLED")
        .map((s) => s.assignedToId)
    );
    const members = MOCK_USERS.filter((u) => memberIds.has(u.id));

    const contractors = members.filter((u) => u.role === "CONTRACTOR").length;
    const employees   = members.filter((u) => u.role === "EMPLOYEE").length;
    const leads       = members.filter((u) => u.role === "LEAD").length;

    // Shift stats
    const projectShifts = MOCK_SHIFTS.filter((s) => s.projectId === proj.id && s.status !== "CANCELLED");

    const activeShifts   = projectShifts.filter((s) => s.status === "ACTIVE").length;
    const scheduledToday = projectShifts.filter((s) =>
      s.startTime.toISOString().slice(0, 10) === todayStr
    ).length;

    const patternsActive = new Set(
      projectShifts.filter((s) => s.status === "ACTIVE").map((s) => s.pattern)
    ) as Set<ShiftPattern>;

    const patternsWeek = new Set(
      projectShifts
        .filter((s) => s.startTime >= weekStart && s.startTime < weekEnd)
        .map((s) => s.pattern)
    ) as Set<ShiftPattern>;

    // Log stats
    const openLogs    = MOCK_LOGS.filter((l) => memberIds.has(l.authorId) && (l.status === "OPEN" || l.status === "IN_PROGRESS")).length;
    const criticalLogs = MOCK_LOGS.filter((l) => memberIds.has(l.authorId) && l.severity === "P1_CRITICAL" && l.status !== "RESOLVED" && l.status !== "CLOSED").length;

    // Avg KT from today's diary entries
    const ktDiaries = MOCK_DIARY_ENTRIES.filter(
      (d) => memberIds.has(d.authorId) &&
        d.diaryDate.toISOString().slice(0, 10) === todayStr &&
        d.ktProgressPercent != null
    );
    const avgKt = ktDiaries.length > 0
      ? Math.round(ktDiaries.reduce((sum, d) => sum + (d.ktProgressPercent ?? 0), 0) / ktDiaries.length)
      : null;

    // Sample of member avatars (up to 5)
    const memberSample = members.slice(0, 5).map((u) => ({
      id: u.id, name: u.name, role: u.role,
    }));

    return {
      id: proj.id, name: proj.name, description: proj.description,
      totalMembers: members.length, contractors, employees, leads,
      activeShifts, scheduledToday,
      patternsActive, patternsWeek,
      openLogs, criticalLogs, avgKt,
      memberSample,
    };
  });
}

// ── Summary strip ─────────────────────────────────────────────────────────

function SummaryStrip({ stats }: { stats: ProjectStats[] }) {
  const totalMembers = stats.reduce((a, s) => a + s.totalMembers, 0);
  const totalActive  = stats.reduce((a, s) => a + s.activeShifts, 0);
  const totalOpen    = stats.reduce((a, s) => a + s.openLogs, 0);
  const totalCrit    = stats.reduce((a, s) => a + s.criticalLogs, 0);
  const avgKtAll     = (() => {
    const items = stats.filter((s) => s.avgKt !== null);
    return items.length ? Math.round(items.reduce((a, s) => a + (s.avgKt ?? 0), 0) / items.length) : null;
  })();

  const tiles = [
    { label: "Projects",       value: stats.length,   sub: "total",          color: "text-indigo-600", bg: "bg-indigo-50"  },
    { label: "Members",        value: totalMembers,   sub: "across projects", color: "text-gray-800",   bg: "bg-gray-50"    },
    { label: "Active Now",     value: totalActive,    sub: "on shift",       color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Open Logs",      value: totalOpen,      sub: "inc. in-progress", color: totalOpen > 0 ? "text-orange-600" : "text-gray-400", bg: totalOpen > 0 ? "bg-orange-50" : "bg-gray-50" },
    { label: "Critical",       value: totalCrit,      sub: "unresolved",     color: totalCrit > 0 ? "text-red-600" : "text-gray-400", bg: totalCrit > 0 ? "bg-red-50" : "bg-gray-50" },
    { label: "Avg KT Today",   value: avgKtAll !== null ? `${avgKtAll}%` : "—", sub: "across teams", color: "text-indigo-600", bg: "bg-indigo-50" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {tiles.map((t) => (
        <div key={t.label} className={cn("rounded-xl border px-4 py-3", t.bg)}>
          <div className={cn("text-2xl font-bold tabular-nums", t.color)}>{t.value}</div>
          <div className="mt-0.5 text-[11px] font-semibold text-gray-700">{t.label}</div>
          <div className="text-[10px] text-gray-400">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────

function ProjectCard({ s }: { s: ProjectStats }) {
  const hasActive  = s.activeShifts > 0;
  const hasCrit    = s.criticalLogs > 0;

  return (
    <div className={cn(
      "flex flex-col rounded-xl border bg-white shadow-sm transition-all hover:shadow-md overflow-hidden",
      hasCrit ? "border-l-4 border-l-red-400" : hasActive ? "border-l-4 border-l-emerald-400" : "border-l-4 border-l-gray-200"
    )}>
      {/* Card header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-gray-900 truncate">{s.name}</h3>
              {hasActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {s.activeShifts} live
                </span>
              )}
              {hasCrit && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                  <AlertTriangle className="h-3 w-3" />
                  {s.criticalLogs} critical
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400 line-clamp-1">{s.description}</p>
          </div>
          {/* Member avatars */}
          <div className="flex shrink-0 -space-x-2">
            {s.memberSample.slice(0, 4).map((m) => (
              <div
                key={m.id}
                title={m.name}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white"
                style={{ backgroundColor: getAvatarColor(m.id) }}
              >
                {getInitials(m.name).slice(0, 2)}
              </div>
            ))}
            {s.totalMembers > 4 && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[9px] font-semibold text-gray-500">
                +{s.totalMembers - 4}
              </div>
            )}
          </div>
        </div>

        {/* Shift pattern coverage this week */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ALL_PATTERNS.map((p) => {
            const m       = PATTERN_META[p];
            const covered = s.patternsWeek.has(p);
            const active  = s.patternsActive.has(p);
            return (
              <span
                key={p}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-opacity",
                  covered
                    ? cn(m.bg, m.border, m.color)
                    : "bg-gray-50 border-gray-200 text-gray-300"
                )}
              >
                {active && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
                {m.shortLabel}
              </span>
            );
          })}
          <span className="ml-auto text-[10px] text-gray-400">this week</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 divide-x border-t border-gray-100 bg-gray-50/50">
        {[
          { label: "Members",     value: s.totalMembers, color: "text-gray-800"   },
          { label: "Open Logs",   value: s.openLogs,     color: s.openLogs > 0 ? "text-orange-600" : "text-gray-400" },
          { label: "Today",       value: s.scheduledToday, color: "text-gray-800" },
          { label: "Avg KT",      value: s.avgKt != null ? `${s.avgKt}%` : "—",   color: "text-indigo-600" },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col items-center py-2.5 px-1">
            <span className={cn("text-base font-bold tabular-nums leading-none", stat.color)}>{stat.value}</span>
            <span className="mt-0.5 text-[9px] text-gray-400 uppercase tracking-wide">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Team breakdown */}
      <div className="flex items-center gap-3 border-t border-gray-100 px-5 py-2.5">
        <div className="flex flex-wrap gap-2 flex-1">
          {s.contractors > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
              C: {s.contractors}
            </span>
          )}
          {s.employees > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
              E: {s.employees}
            </span>
          )}
          {s.leads > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              L: {s.leads}
            </span>
          )}
        </div>

        {/* KT bar if available */}
        {s.avgKt !== null && (
          <div className="flex items-center gap-1.5 shrink-0">
            <TrendingUp className="h-3 w-3 text-indigo-400" />
            <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                className={cn("h-full rounded-full", s.avgKt >= 80 ? "bg-emerald-500" : s.avgKt >= 50 ? "bg-indigo-500" : "bg-amber-400")}
                style={{ width: `${s.avgKt}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500">{s.avgKt}%</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-gray-100 px-4 py-3 mt-auto">
        <Link
          href="/dashboard/roster"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
        >
          <Users className="h-3.5 w-3.5" />
          Roster
        </Link>
        <Link
          href="/dashboard/feed"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
        >
          <Activity className="h-3.5 w-3.5" />
          Logs
        </Link>
        <Link
          href="/dashboard/diary"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Diary
        </Link>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const allStats = useMemo(() => buildProjectStats(), []);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "critical">("all");

  const filtered = allStats.filter((s) => {
    if (filter === "active"   && s.activeShifts === 0)  return false;
    if (filter === "critical" && s.criticalLogs === 0)  return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6 p-6 pb-10">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-indigo-500" />
            Projects
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Corp programmes and workstreams under YCI management.
          </p>
        </div>

        {/* Search + filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="h-8 w-48 pl-8 text-xs"
            />
          </div>
          {(["all", "active", "critical"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f
                  ? f === "critical" ? "bg-red-50 border-red-300 text-red-700"
                    : f === "active" ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                    : "bg-indigo-50 border-indigo-300 text-indigo-700"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              )}
            >
              {f === "all" ? "All" : f === "active" ? "Active Now" : "Has Critical"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary strip ── */}
      <SummaryStrip stats={allStats} />

      {/* ── Project cards grid ── */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => <ProjectCard key={s.id} s={s} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16 text-gray-400">
          <Layers className="h-10 w-10 opacity-20 mb-2" />
          <p className="text-sm font-medium">No projects match</p>
          <p className="text-xs mt-1">Try clearing the filter or search.</p>
        </div>
      )}
    </div>
  );
}
