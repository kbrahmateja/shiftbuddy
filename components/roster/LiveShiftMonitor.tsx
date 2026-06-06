"use client";
// components/roster/LiveShiftMonitor.tsx
// ─────────────────────────────────────────────────────────────
// Real-time shift monitoring panel for LEAD and MANAGER.
//
// LEAD:    sees live cards for their project's CONTRACTOR/EMPLOYEE
// MANAGER: sees all active shifts including LEAD cards with
//          their own activity summary
//
// Each card shows:
//   • Name, role badge, shift pattern + time
//   • Status: ACTIVE / IDLE (no log >30 min) / OFFLINE
//   • Last log entry (title + source + timestamp)
//   • Mini metrics: logs today, open incidents, KT progress
//   • Clock-in time and projected end time
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, WifiOff, Clock,
  Coffee, Moon, Sunset, Sun, PhoneCall,
  Calendar, Bell, Ticket, Hash, Video, MessageCircle,
  MoreHorizontal, Activity, Search,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { cn, SOURCE_CONFIG, SEVERITY_CONFIG, getInitials, getAvatarColor, formatInTimezone } from "@/lib/utils";
import { MOCK_USERS, MOCK_SHIFTS, MOCK_LOGS, MOCK_DIARY_ENTRIES, MOCK_PROJECTS } from "@/lib/mock-data";
import type { Shift, ShiftPattern, ShiftStatus, User, SessionUser, Source, Severity } from "@/types";
import { Badge }     from "@/components/ui/badge";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ── Config ────────────────────────────────────────────────────────────────

const PATTERN_META: Record<ShiftPattern, {
  label: string; color: string; bg: string; border: string;
  Icon: React.ComponentType<{ className?: string }>; hours: string;
}> = {
  MORNING:   { label: "Morning",   color: "text-sky-700",    bg: "bg-sky-50",    border: "border-sky-200",    Icon: Coffee,    hours: "05:30–14:30" },
  AFTERNOON: { label: "Afternoon", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", Icon: Sunset,    hours: "13:30–22:30" },
  NIGHT:     { label: "Night",     color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200", Icon: Moon,      hours: "21:30–06:30" },
  GENERAL:   { label: "General",   color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200",  Icon: Sun,       hours: "09:00–17:00" },
  WEEKEND:   { label: "Weekend",   color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200", Icon: Calendar,  hours: "09:00–17:00" },
  ON_CALL:   { label: "On-Call",   color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200",    Icon: PhoneCall, hours: "00:00–23:59" },
};

const SOURCE_ICONS: Record<Source, React.ComponentType<{ className?: string }>> = {
  PAGERDUTY: Bell, SERVICENOW: Ticket, SLACK: Hash,
  TEAMS: Video, VERBAL: MessageCircle, OTHER: MoreHorizontal,
};

const IDLE_THRESHOLD_MS  = 30 * 60 * 1000; // 30 min
const REFRESH_INTERVAL   = 30_000;          // 30 s simulated refresh

// ── Types ─────────────────────────────────────────────────────────────────

type OnlineStatus = "ACTIVE" | "IDLE" | "OFFLINE" | "UPCOMING" | "ENDED" | "DAY_OFF";

interface LiveMember {
  user:          User;
  shift:         Shift & { assignedTo: User };
  onlineStatus:  OnlineStatus;
  lastLogAt:     Date | null;
  lastLogTitle:  string | null;
  lastLogSource: Source | null;
  lastLogSeverity: Severity | null;
  logsToday:     number;
  openIncidents: number;
  ktProgress:    number | null;   // 0-100 from today's diary, null if no diary
  clockedIn:     boolean;
  shiftEndsIn:   string;          // "2h 14m"
}

interface LiveShiftMonitorProps {
  currentUser: SessionUser;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function timeUntil(d: Date): string {
  const diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) return "ended";
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function relTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000)    return "just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// Compute live status dynamically at render time (not from stored s.status)
function computeLiveStatus(s: { startTime: Date; endTime: Date }): "ACTIVE" | "UPCOMING" | "ENDED" | "NONE" {
  const now = new Date();
  if (now >= s.startTime && now <= s.endTime) return "ACTIVE";
  const msToStart = s.startTime.getTime() - now.getTime();
  const msSinceEnd = now.getTime() - s.endTime.getTime();
  if (msToStart > 0 && msToStart <= 2 * 3_600_000) return "UPCOMING"; // starts within 2h
  if (msSinceEnd > 0 && msSinceEnd <= 2 * 3_600_000) return "ENDED";   // ended within 2h
  return "NONE";
}

function buildLiveMembers(currentUser: SessionUser): LiveMember[] {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const since24h = new Date(now.getTime() - 24 * 3_600_000);

  const targetRoles = currentUser.role === "MANAGER"
    ? ["CONTRACTOR", "EMPLOYEE", "LEAD"]
    : ["CONTRACTOR", "EMPLOYEE"];

  // Include today's shifts that are: active now, starting within 2h, or ended within 2h
  const relevantShifts = MOCK_SHIFTS.filter((s) => {
    if (s.startTime.toISOString().slice(0, 10) !== todayStr) return false;
    if (computeLiveStatus(s) === "NONE") return false;
    const user = MOCK_USERS.find((u) => u.id === s.assignedToId);
    if (!user || !targetRoles.includes(user.role)) return false;
    if (currentUser.role === "LEAD" && currentUser.activeProjectId && s.projectId !== currentUser.activeProjectId) return false;
    return true;
  });

  // One card per user — prefer ACTIVE > UPCOMING > ENDED
  const RANK = { ACTIVE: 0, UPCOMING: 1, ENDED: 2, NONE: 3 };
  const byUser = new Map<string, typeof relevantShifts[number]>();
  for (const s of relevantShifts) {
    const prev = byUser.get(s.assignedToId);
    if (!prev || RANK[computeLiveStatus(s)] < RANK[computeLiveStatus(prev)]) byUser.set(s.assignedToId, s);
  }

  return Array.from(byUser.values()).map((shift) => {
    const user = MOCK_USERS.find((u) => u.id === shift.assignedToId)!;
    const shiftLiveStatus = computeLiveStatus(shift);

    const userLogs = MOCK_LOGS
      .filter((l) => l.authorId === user.id)
      .sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime());

    const logsToday  = userLogs.filter((l) => l.loggedAt >= since24h).length;
    const openLogs   = userLogs.filter((l) => l.status === "OPEN" || l.status === "IN_PROGRESS").length;
    const latestLog  = userLogs[0] ?? null;
    const lastLogAt  = latestLog?.loggedAt ?? null;

    const idleMs = lastLogAt ? now.getTime() - lastLogAt.getTime() : Infinity;
    const onlineStatus: OnlineStatus =
      shiftLiveStatus === "UPCOMING"                              ? "UPCOMING"
      : shiftLiveStatus === "ENDED"                               ? "ENDED"
      : shiftLiveStatus === "ACTIVE" && idleMs < IDLE_THRESHOLD_MS ? "ACTIVE"
      : shiftLiveStatus === "ACTIVE"                              ? "IDLE"
      : "OFFLINE";

    const todayDiary = MOCK_DIARY_ENTRIES.find(
      (d) => d.authorId === user.id && d.diaryDate.toISOString().slice(0, 10) === todayStr
    );
    const ktProgress = todayDiary?.ktProgressPercent ?? null;

    return {
      user,
      shift: shift as Shift & { assignedTo: User },
      onlineStatus,
      lastLogAt,
      lastLogTitle:    latestLog?.title ?? null,
      lastLogSource:   latestLog?.source ?? null,
      lastLogSeverity: latestLog?.severity ?? null,
      logsToday,
      openIncidents:   openLogs,
      ktProgress,
      clockedIn:       shiftLiveStatus === "ACTIVE" || shiftLiveStatus === "ENDED",
      shiftEndsIn:     shiftLiveStatus === "UPCOMING"
        ? `starts in ${timeUntil(shift.startTime)}`
        : shiftLiveStatus === "ENDED"
          ? "ended"
          : timeUntil(shift.endTime),
    };
  });
}

// ── Status indicator ──────────────────────────────────────────────────────

const STATUS_CFG = {
  ACTIVE:   { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500 animate-pulse", label: "Active" },
  IDLE:     { bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-400",                  label: "Idle >30m" },
  UPCOMING: { bg: "bg-blue-100",    text: "text-blue-700",    dot: "bg-blue-400",                   label: "Starting Soon" },
  ENDED:    { bg: "bg-gray-100",    text: "text-gray-500",    dot: "bg-gray-300",                   label: "Ended" },
  OFFLINE:  { bg: "bg-gray-100",    text: "text-gray-500",    dot: "bg-gray-400",                   label: "Offline" },
  DAY_OFF:  { bg: "bg-violet-100",  text: "text-violet-600",  dot: "bg-violet-300",                 label: "Day Off" },
} as const;

function StatusPill({ status }: { status: OnlineStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.OFFLINE;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", cfg.bg, cfg.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ── KT progress mini-bar ──────────────────────────────────────────────────

function KtBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-emerald-500" : value >= 50 ? "bg-indigo-500" : value >= 25 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] font-medium text-gray-500 w-7 text-right">{value}%</span>
    </div>
  );
}

// ── Single member card ────────────────────────────────────────────────────

function MemberCard({ member, expanded, onToggleExpand }: {
  member: LiveMember;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const { user, shift, onlineStatus, lastLogAt, lastLogTitle, lastLogSource, lastLogSeverity } = member;
  const patternMeta  = PATTERN_META[shift.pattern];
  const PatternIcon  = patternMeta.Icon;
  const srcCfg       = lastLogSource ? SOURCE_CONFIG[lastLogSource] : null;
  const sevCfg       = lastLogSeverity ? SEVERITY_CONFIG[lastLogSeverity] : null;
  const SrcIcon      = lastLogSource ? SOURCE_ICONS[lastLogSource] : null;
  const projectName  = MOCK_PROJECTS.find((p) => p.id === shift.projectId)?.name ?? shift.projectId;

  const isLead = user.role === "LEAD";

  return (
    <div className={cn(
      "rounded-xl border bg-white shadow-sm transition-all overflow-hidden",
      onlineStatus === "ACTIVE" ? "border-emerald-200" :
      onlineStatus === "IDLE"   ? "border-amber-200" :
                                  "border-gray-200",
      isLead && "ring-1 ring-amber-300/50"
    )}>
      {/* Card header */}
      <div className="px-4 pt-3.5 pb-3">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: getAvatarColor(user.id) }}>
              {getInitials(user.name)}
            </div>
            {onlineStatus === "ACTIVE" && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            )}
            {onlineStatus === "IDLE" && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-amber-400" />
            )}
          </div>

          {/* Name + role */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900 truncate">{user.name}</span>
              {isLead && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 uppercase tracking-wide">
                  Lead
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 flex-wrap">
              <StatusPill status={onlineStatus} />
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                patternMeta.border, patternMeta.color, patternMeta.bg
              )}>
                <PatternIcon className="h-2.5 w-2.5" />
                {patternMeta.label}
              </span>
            </div>
            {/* Project badge */}
            <div className="mt-1.5 flex items-center gap-1">
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 max-w-full truncate">
                <Hash className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{projectName}</span>
              </span>
            </div>
          </div>

          {/* Shift timer */}
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <Clock className="h-3 w-3" />
              <span>{member.shiftEndsIn} left</span>
            </div>
            <div className="mt-0.5 text-[10px] text-gray-400">{patternMeta.hours} IST</div>
          </div>
        </div>

        {/* Metrics row */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-0.5 rounded-lg bg-gray-50 px-2.5 py-2 text-center">
            <span className="text-base font-bold text-gray-800">{member.logsToday}</span>
            <span className="text-[9px] text-gray-500 uppercase tracking-wide">Logs Today</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-lg px-2.5 py-2 text-center"
            style={{ backgroundColor: member.openIncidents > 0 ? "#FFF7ED" : "#F9FAFB" }}
          >
            <span className={cn("text-base font-bold", member.openIncidents > 0 ? "text-orange-600" : "text-gray-800")}>
              {member.openIncidents}
            </span>
            <span className="text-[9px] text-gray-500 uppercase tracking-wide">Open</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-lg bg-gray-50 px-2.5 py-2 text-center">
            {member.ktProgress !== null
              ? <span className="text-base font-bold text-indigo-600">{member.ktProgress}%</span>
              : <span className="text-base font-bold text-gray-300">—</span>}
            <span className="text-[9px] text-gray-500 uppercase tracking-wide">KT</span>
          </div>
        </div>

        {/* KT progress bar */}
        {member.ktProgress !== null && (
          <div className="mt-2">
            <KtBar value={member.ktProgress} />
          </div>
        )}
      </div>

      {/* Last activity */}
      {lastLogTitle && (
        <div className={cn(
          "border-t px-4 py-2.5 flex items-start gap-2",
          srcCfg ? `border-l-4 ${srcCfg.borderClass}` : ""
        )}>
          {SrcIcon && srcCfg && (
            <SrcIcon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", srcCfg.badgeClass.split(" ")[1])} />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-700 font-medium truncate">{lastLogTitle}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {sevCfg && (
                <span className={cn("rounded-full border px-1.5 py-0 text-[9px] font-semibold", sevCfg.badgeClass)}>
                  {sevCfg.label}
                </span>
              )}
              <span className="text-[10px] text-gray-400">
                {lastLogAt ? relTime(lastLogAt) : ""}
              </span>
            </div>
          </div>
        </div>
      )}

      {!lastLogTitle && (
        <div className="border-t px-4 py-2.5 flex items-center gap-2 text-xs text-gray-400">
          <Activity className="h-3.5 w-3.5 opacity-50" />
          <span>No logs yet in this shift</span>
        </div>
      )}

      {/* Expand toggle for lead cards (manager view) */}
      {isLead && (
        <button
          onClick={onToggleExpand}
          className="flex w-full items-center justify-center gap-1 border-t bg-amber-50/50 py-1.5 text-[10px] text-amber-700 hover:bg-amber-50 transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Hide team activity" : "View team activity"}
        </button>
      )}

      {/* Expanded lead team view */}
      {isLead && expanded && <LeadTeamExpanded leadId={user.id} projectId={shift.projectId} />}
    </div>
  );
}

// ── Lead expanded team view (manager only) ────────────────────────────────

function LeadTeamExpanded({ leadId, projectId }: { leadId: string; projectId: string }) {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 3_600_000);

  const teamMembers = MOCK_SHIFTS.filter(
    (s) => s.projectId === projectId && s.status === "ACTIVE" &&
    MOCK_USERS.find((u) => u.id === s.assignedToId && (u.role === "CONTRACTOR" || u.role === "EMPLOYEE"))
  );

  return (
    <div className="border-t bg-amber-50/30 px-4 py-3 space-y-2">
      <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">
        Team on shift ({teamMembers.length})
      </p>
      {teamMembers.length === 0 && (
        <p className="text-xs text-gray-400">No team members on active shift.</p>
      )}
      {teamMembers.map((s) => {
        const u = MOCK_USERS.find((u) => u.id === s.assignedToId)!;
        if (!u) return null;
        const logs = MOCK_LOGS.filter((l) => l.authorId === u.id && l.loggedAt >= since24h);
        const lastLog = logs.sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime())[0];
        const idleMs  = lastLog ? now.getTime() - lastLog.loggedAt.getTime() : Infinity;
        const status: OnlineStatus = idleMs < IDLE_THRESHOLD_MS ? "ACTIVE" : "IDLE";
        return (
          <div key={s.id} className="flex items-center gap-2.5 rounded-lg border border-amber-100 bg-white px-3 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: getAvatarColor(u.id) }}>
              {getInitials(u.name).slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-800 truncate">{u.name}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusPill status={status} />
                <span className="text-[10px] text-gray-400">{logs.length} logs</span>
              </div>
            </div>
            {lastLog && (
              <div className="text-right shrink-0">
                <div className="text-[10px] text-gray-500 truncate max-w-[120px]">{lastLog.title.slice(0, 30)}…</div>
                <div className="text-[9px] text-gray-400 mt-0.5">{relTime(lastLog.loggedAt)}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Summary strip ─────────────────────────────────────────────────────────

function SummaryStrip({ members }: { members: LiveMember[] }) {
  const active   = members.filter((m) => m.onlineStatus === "ACTIVE").length;
  const idle     = members.filter((m) => m.onlineStatus === "IDLE").length;
  const upcoming = members.filter((m) => m.onlineStatus === "UPCOMING").length;
  const onShift  = members.filter((m) => m.onlineStatus === "ACTIVE" || m.onlineStatus === "IDLE").length;
  const openInc  = members.reduce((acc, m) => acc + m.openIncidents, 0);
  const logsSum  = members.reduce((acc, m) => acc + m.logsToday, 0);
  const avgKt    = members.filter((m) => m.ktProgress !== null).length > 0
    ? Math.round(members.filter((m) => m.ktProgress !== null).reduce((a, m) => a + (m.ktProgress ?? 0), 0) /
        members.filter((m) => m.ktProgress !== null).length)
    : null;

  const stats = [
    { label: "On Shift Now",   value: onShift,  color: "text-gray-800" },
    { label: "Active",         value: active,   color: "text-emerald-600" },
    { label: "Idle >30m",      value: idle,     color: idle > 0 ? "text-amber-600" : "text-gray-400" },
    { label: "Starting Soon",  value: upcoming, color: upcoming > 0 ? "text-blue-600" : "text-gray-400" },
    { label: "Open Incidents", value: openInc,  color: openInc > 0 ? "text-orange-600" : "text-gray-400" },
    { label: "Avg KT",         value: avgKt !== null ? `${avgKt}%` : "—", color: "text-indigo-600" },
  ];

  return (
    <div className="grid grid-cols-6 divide-x divide-gray-100 rounded-xl border bg-white shadow-sm">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col items-center px-4 py-3 gap-0.5">
          <span className={cn("text-xl font-bold tabular-nums", s.color)}>{s.value}</span>
          <span className="text-[10px] text-gray-500 text-center leading-tight">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function LiveShiftMonitor({ currentUser }: LiveShiftMonitorProps) {
  const [members,       setMembers]       = useState<LiveMember[]>(() => buildLiveMembers(currentUser));
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [refreshing,    setRefreshing]    = useState(false);
  const [search,         setSearch]         = useState("");
  const [statusFilter,   setStatusFilter]   = useState<"all" | OnlineStatus>("all");
  const [projectFilter,  setProjectFilter]  = useState<"all" | string>(
    currentUser.role === "LEAD" && currentUser.activeProjectId
      ? currentUser.activeProjectId
      : "all"
  );
  const [expandedLeads, setExpandedLeads] = useState<Set<string>>(new Set());

  // Projects that actually have live members (for dropdown options)
  const activeProjects = MOCK_PROJECTS.filter((p) =>
    members.some((m) => m.shift.projectId === p.id)
  );

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setMembers(buildLiveMembers(currentUser));
      setLastRefreshed(new Date());
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setMembers(buildLiveMembers(currentUser));
      setLastRefreshed(new Date());
      setRefreshing(false);
    }, 600);
  }, [currentUser]);

  const toggleLeadExpand = (userId: string) => {
    setExpandedLeads((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  // Filter
  const filtered = members.filter((m) => {
    if (projectFilter !== "all" && m.shift.projectId !== projectFilter) return false;
    if (statusFilter  !== "all" && m.onlineStatus    !== statusFilter)  return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const projectName = MOCK_PROJECTS.find((p) => p.id === m.shift.projectId)?.name ?? "";
      if (
        !m.user.name.toLowerCase().includes(q) &&
        !projectName.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // Per-project active count (for badge in dropdown)
  const projectActiveCounts = MOCK_PROJECTS.reduce<Record<string, number>>((acc, p) => {
    acc[p.id] = members.filter((m) => m.shift.projectId === p.id && m.onlineStatus === "ACTIVE").length;
    return acc;
  }, {});

  const activeCount  = members.filter((m) => m.onlineStatus === "ACTIVE").length;
  const upcomingCount = members.filter((m) => m.onlineStatus === "UPCOMING").length;

  return (
    <div className="flex flex-col gap-5 px-4 py-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
            Live Shifts
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              {activeCount} active
            </span>
            {upcomingCount > 0 && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                {upcomingCount} starting soon
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Refreshes every 30 s · Last updated {lastRefreshed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            {currentUser.role === "MANAGER" && " · Showing all teams including leads"}
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-8 gap-1.5 text-xs"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Summary strip */}
      {members.length > 0 && <SummaryStrip members={members} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Project dropdown — MANAGER sees all; LEAD locked to their project */}
        {currentUser.role === "MANAGER" ? (
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Projects
              </SelectItem>
              {activeProjects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  <span className="flex items-center gap-2">
                    {p.name}
                    {projectActiveCounts[p.id] > 0 && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0 text-[9px] font-bold text-emerald-700">
                        {projectActiveCounts[p.id]}
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          /* LEAD: show their project as a non-interactive pill */
          <div className="flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-700">
            <Hash className="h-3 w-3" />
            {MOCK_PROJECTS.find((p) => p.id === currentUser.activeProjectId)?.name ?? "My Project"}
          </div>
        )}

        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member…"
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all"     className="text-xs">All Status</SelectItem>
            <SelectItem value="ACTIVE"  className="text-xs">Active</SelectItem>
            <SelectItem value="IDLE"    className="text-xs">Idle &gt;30m</SelectItem>
            <SelectItem value="OFFLINE" className="text-xs">Offline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-16 text-gray-400">
          <WifiOff className="h-10 w-10 opacity-20 mb-2" />
          {members.length === 0
            ? <><p className="text-sm font-medium">No active shifts right now</p><p className="text-xs mt-1">Members will appear here when their shift becomes active.</p></>
            : <><p className="text-sm font-medium">No matches</p><p className="text-xs mt-1">Try adjusting the filters.</p></>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((m) => (
            <MemberCard
              key={m.user.id}
              member={m}
              expanded={expandedLeads.has(m.user.id)}
              onToggleExpand={() => toggleLeadExpand(m.user.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
