"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  FilePlus, ArrowLeftRight, Users, BarChart3, ShieldCheck,
  CheckCircle2, XCircle, Clock, TrendingUp, AlertOctagon,
  Download, Activity, RefreshCw, CalendarDays, UserCheck,
  Layers, ChevronRight, Bell, Ticket, Hash, Video, MessageCircle,
  Wifi, BookOpenCheck, Zap, LogIn, LogOut, ClipboardCheck,
  UserCog, FolderOpen,
} from "lucide-react";
import { cn, SOURCE_CONFIG, SEVERITY_CONFIG, ROLE_CONFIG, pluralize } from "@/lib/utils";
import type {
  SessionUser, DailyUpdateLog, ShiftHandover, ShiftSwapRequest,
  ProjectHealthSummary, OperationalMetrics, Source, UserRole, Shift, User as UserType,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DailyLogsFeed } from "@/components/dashboard/DailyLogsFeed";
import { ShiftRosterGrid } from "@/components/dashboard/ShiftRosterGrid";

// ─────────────────────────────────────────────
// SHARED METRIC CARD
// ─────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; direction: "up" | "down" | "neutral" };
  colorClass?: string;
  href?: string;
}

function MetricCard({ label, value, icon: Icon, trend, colorClass = "text-indigo-600", href }: MetricCardProps) {
  return (
    <Card className="hover:border-gray-300 hover:shadow-sm transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className={cn("mt-1.5 text-2xl font-bold", colorClass)}>{value}</p>
            {trend && (
              <p className={cn("mt-1 flex items-center gap-1 text-[11px] font-medium",
                trend.direction === "up" ? "text-emerald-600" :
                trend.direction === "down" ? "text-red-500" : "text-gray-400"
              )}>
                <TrendingUp className={cn("h-3 w-3", trend.direction === "down" && "rotate-180")} />
                {trend.value > 0 ? "+" : ""}{trend.value}% vs yesterday
              </p>
            )}
          </div>
          <div className={cn("rounded-lg p-2.5", colorClass.replace("text-", "bg-").replace("600", "100"))}>
            <Icon className={cn("h-4 w-4", colorClass)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// SOURCE DISTRIBUTION BAR (used in GAP_STAKEHOLDER view)
// ─────────────────────────────────────────────

function SourceDistributionChart({ logs }: { logs: DailyUpdateLog[] }) {
  const ALL_SOURCES: Source[] = ["PAGERDUTY", "SERVICENOW", "SLACK", "TEAMS", "VERBAL", "OTHER"];
  const total = logs.length || 1;

  const distribution = ALL_SOURCES.map((source) => {
    const count = logs.filter((l) => l.source === source).length;
    return { source, count, pct: Math.round((count / total) * 100) };
  }).filter((d) => d.count > 0);

  const SOURCE_ICONS: Record<Source, React.ComponentType<{ className?: string }>> = {
    PAGERDUTY: Bell, SERVICENOW: Ticket, SLACK: Hash,
    TEAMS: Video, VERBAL: MessageCircle, OTHER: Activity,
  };

  return (
    <div className="space-y-3">
      {distribution.map(({ source, count, pct }) => {
        const cfg = SOURCE_CONFIG[source];
        const Icon = SOURCE_ICONS[source];
        return (
          <div key={source} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className={cn("inline-flex items-center gap-1.5 font-medium", cfg.badgeClass.split(" ")[1])}>
                <Icon className="h-3.5 w-3.5" />
                {cfg.label}
              </span>
              <span className="font-semibold text-gray-900">
                {count} <span className="font-normal text-gray-400">({pct}%)</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={cn("h-full rounded-full transition-all duration-700", cfg.dotClass)}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// QUICK ACTIONS — role-aware shortcut strip
// ─────────────────────────────────────────────

interface QA { label: string; href: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string; badge?: number; }

function QuickActionCard({ qa }: { qa: QA }) {
  const Icon = qa.icon;
  return (
    <Link href={qa.href}
      className="relative flex flex-col items-center gap-2 rounded-xl border bg-white px-4 py-4 text-center hover:border-indigo-300 hover:shadow-sm transition-all group">
      <div className={cn("rounded-lg p-2.5 transition-colors group-hover:opacity-90", qa.bg)}>
        <Icon className={cn("h-5 w-5", qa.color)} />
      </div>
      <span className="text-xs font-medium text-gray-700 leading-tight">{qa.label}</span>
      {qa.badge !== undefined && qa.badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {qa.badge}
        </span>
      )}
    </Link>
  );
}

function QuickActions({ user, pendingSwaps = 0, pendingHandovers = 0 }: {
  user: SessionUser; pendingSwaps?: number; pendingHandovers?: number;
}) {
  const actionsByRole: Record<string, QA[]> = {
    CONTRACTOR: [
      { label: "Submit Shift Update", href: "/dashboard/handovers",  icon: ClipboardCheck, color: "text-indigo-600", bg: "bg-indigo-50" },
      { label: "Log an Incident",     href: "/dashboard/log-update", icon: FilePlus,        color: "text-rose-600",   bg: "bg-rose-50"   },
      { label: "My Shifts",           href: "/dashboard/shifts",     icon: CalendarDays,    color: "text-sky-600",    bg: "bg-sky-50"    },
      { label: "Daily Diary",         href: "/dashboard/diary",      icon: BookOpenCheck,   color: "text-emerald-600",bg: "bg-emerald-50"},
    ],
    EMPLOYEE: [
      { label: "Submit Shift Update", href: "/dashboard/handovers",  icon: ClipboardCheck, color: "text-indigo-600", bg: "bg-indigo-50" },
      { label: "Log an Incident",     href: "/dashboard/log-update", icon: FilePlus,        color: "text-rose-600",   bg: "bg-rose-50"   },
      { label: "My Shifts",           href: "/dashboard/shifts",     icon: CalendarDays,    color: "text-sky-600",    bg: "bg-sky-50"    },
      { label: "Daily Diary",         href: "/dashboard/diary",      icon: BookOpenCheck,   color: "text-emerald-600",bg: "bg-emerald-50"},
    ],
    LEAD: [
      { label: "Compile Handover",  href: "/dashboard/handovers/new",  icon: ArrowLeftRight, color: "text-indigo-600", bg: "bg-indigo-50",  badge: pendingHandovers },
      { label: "Shift Hub",         href: "/dashboard/handovers",       icon: Wifi,           color: "text-emerald-600",bg: "bg-emerald-50" },
      { label: "Approve Swaps",     href: "/dashboard/swaps",           icon: RefreshCw,      color: "text-violet-600", bg: "bg-violet-50",  badge: pendingSwaps     },
      { label: "Daily Diary",       href: "/dashboard/diary",           icon: BookOpenCheck,  color: "text-amber-600",  bg: "bg-amber-50"   },
    ],
    MANAGER: [
      { label: "Live Shifts",        href: "/dashboard/handovers",         icon: Wifi,          color: "text-emerald-600",bg: "bg-emerald-50" },
      { label: "Handover Reports",   href: "/dashboard/handovers/reports", icon: BarChart3,     color: "text-indigo-600", bg: "bg-indigo-50"  },
      { label: "Roster Planner",     href: "/dashboard/roster",            icon: Users,         color: "text-blue-600",   bg: "bg-blue-50"    },
      { label: "SLA Tracker",        href: "/dashboard/sla",               icon: ShieldCheck,   color: "text-rose-600",   bg: "bg-rose-50"    },
      { label: "Team Management",    href: "/dashboard/team",              icon: UserCog,       color: "text-violet-600", bg: "bg-violet-50"  },
      { label: "Projects",           href: "/dashboard/projects",          icon: FolderOpen,    color: "text-amber-600",  bg: "bg-amber-50"   },
    ],
  };

  const actions = actionsByRole[user.role] ?? [];
  if (!actions.length) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-gray-700">Quick Actions</h2>
      </div>
      <div className={cn("grid gap-3", actions.length <= 4 ? "grid-cols-4" : "grid-cols-3 sm:grid-cols-6")}>
        {actions.map(qa => <QuickActionCard key={qa.href} qa={qa} />)}
      </div>
    </div>
  );
}

// VIEW: CONTRACTOR / EMPLOYEE
// ─────────────────────────────────────────────

interface ContractorViewProps {
  user: SessionUser;
  logs: DailyUpdateLog[];
  shifts: (Shift & { assignedTo: UserType })[];
  onLogUpdate: () => void;
}

function ContractorView({ user, logs, shifts, onLogUpdate }: ContractorViewProps) {
  const myLogs    = logs.filter((l) => l.authorId === user.id);
  const myShifts  = shifts.filter((s) => s.assignedToId === user.id);
  const openCount = myLogs.filter((l) => l.status === "OPEN" || l.status === "IN_PROGRESS").length;

  // Dynamic active shift (re-evaluated on render)
  const now = new Date();
  const activeShift = myShifts.find((s) => now >= new Date(s.startTime) && now <= new Date(s.endTime));
  const nextShift   = myShifts
    .filter((s) => new Date(s.startTime) > now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

  return (
    <div className="space-y-6">
      <QuickActions user={user} />
      {/* Active shift banner */}
      {activeShift && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5">
          <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-900">You are currently on shift</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              {activeShift.pattern} — ends at{" "}
              {new Date(activeShift.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} IST
            </p>
          </div>
          <Button onClick={onLogUpdate} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shrink-0">
            <FilePlus className="h-3.5 w-3.5" />
            Log Update
          </Button>
        </div>
      )}

      {!activeShift && nextShift && (
        <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-5 py-3.5">
          <Clock className="h-4 w-4 text-sky-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-sky-900">Next shift starting soon</p>
            <p className="text-xs text-sky-700 mt-0.5">
              {nextShift.pattern} — starts at{" "}
              {new Date(nextShift.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} IST
            </p>
          </div>
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="My Logs (Today)" value={myLogs.length} icon={FilePlus} colorClass="text-indigo-600" />
        <MetricCard label="Open Items" value={openCount} icon={AlertOctagon}
          colorClass={openCount > 0 ? "text-red-600" : "text-emerald-600"} />
        <MetricCard label="Resolved" value={myLogs.filter(l => l.status === "RESOLVED").length}
          icon={CheckCircle2} colorClass="text-emerald-600" />
        <MetricCard label="Blocking Issues" value={myLogs.filter(l => l.isBlockingDependency).length}
          icon={AlertOctagon} colorClass="text-amber-600" />
      </div>

      {/* My schedule + logs in tabs */}
      <Tabs defaultValue="schedule">
        <TabsList className="h-9">
          <TabsTrigger value="schedule" className="text-xs">My Schedule</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs">My Updates</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="mt-4">
          <ShiftRosterGrid shifts={myShifts} canEdit={false} personalView={true} />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          {/* CTA to log a new update */}
          <Card className="border-dashed border-indigo-200 bg-indigo-50/50 mb-4">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-semibold text-indigo-900">Log a New Update</p>
                <p className="mt-0.5 text-xs text-indigo-600">
                  PagerDuty alert, SNOW ticket, Slack callout, or verbal handover note.
                </p>
              </div>
              <Button onClick={onLogUpdate} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                <FilePlus className="h-4 w-4" />
                Log Update
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <div className="h-[420px]">
                <DailyLogsFeed logs={myLogs} userRole={user.role} isLoading={false} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────
// VIEW: LEAD — Handover + Approval Widgets
// ─────────────────────────────────────────────

interface LeadViewProps {
  user: SessionUser;
  logs: DailyUpdateLog[];
  shifts: (Shift & { assignedTo: UserType })[];
  pendingHandovers: ShiftHandover[];
  pendingSwaps: ShiftSwapRequest[];
  onApproveSwap: (swapId: string) => void;
  onRejectSwap: (swapId: string) => void;
  onStartHandover: () => void;
  onValidateLog: (logId: string) => void;
}

function LeadView({
  user, logs, shifts, pendingHandovers, pendingSwaps,
  onApproveSwap, onRejectSwap, onStartHandover, onValidateLog,
}: LeadViewProps) {
  const unresolvedLogs = logs.filter(l => l.status === "OPEN" || l.status === "IN_PROGRESS" || l.status === "ESCALATED");
  const resolvedPendingValidation = logs.filter(l => l.status === "RESOLVED" && !l.validatedById);

  return (
    <div className="space-y-6">
      <QuickActions user={user} pendingHandovers={pendingHandovers.length} pendingSwaps={pendingSwaps.length} />
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Total Shift Logs" value={logs.length} icon={Activity} colorClass="text-indigo-600" />
        <MetricCard label="Unresolved" value={unresolvedLogs.length} icon={AlertOctagon}
          colorClass={unresolvedLogs.length > 0 ? "text-red-600" : "text-emerald-600"} />
        <MetricCard label="Pending Validation" value={resolvedPendingValidation.length}
          icon={CheckCircle2} colorClass="text-amber-600" />
        <MetricCard label="Pending Swap Requests" value={pendingSwaps.length}
          icon={RefreshCw} colorClass="text-violet-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Handover widget */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Shift Handover Protocol</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Compile and submit the outgoing handover note.
                </CardDescription>
              </div>
              <Button size="sm" onClick={onStartHandover} className="gap-1.5 text-xs">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Start Handover
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pendingHandovers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-400" />
                <p className="text-xs text-gray-500">No pending handovers to acknowledge.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingHandovers.map((h) => (
                  <div key={h.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-amber-900">
                          Handover from {h.outgoingLead?.name ?? "Unknown"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-amber-700">
                          Due: {h.dueBy ? new Date(h.dueBy).toLocaleTimeString() : "ASAP"}
                        </p>
                      </div>
                      <Button size="sm" variant="outline"
                        className="h-7 text-[11px] border-amber-300 text-amber-800 hover:bg-amber-100">
                        Acknowledge
                      </Button>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[11px] text-amber-800">
                      {h.openItemsSummary}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Swap approval widget */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Shift Swap Requests</CardTitle>
            <CardDescription className="text-xs">Approve or reject peer swap requests.</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingSwaps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-400" />
                <p className="text-xs text-gray-500">No pending swap requests.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingSwaps.map((swap) => (
                  <div key={swap.id} className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                    <p className="text-xs font-semibold text-violet-900">
                      {swap.requester?.name} → {swap.recipient?.name}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-violet-700">
                      {swap.reason}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm"
                        className="h-7 flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px]"
                        onClick={() => onApproveSwap(swap.id)}>
                        <CheckCircle2 className="h-3 w-3" /> Approve
                      </Button>
                      <Button size="sm" variant="outline"
                        className="h-7 flex-1 gap-1 border-red-200 text-red-700 hover:bg-red-50 text-[11px]"
                        onClick={() => onRejectSwap(swap.id)}>
                        <XCircle className="h-3 w-3" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full shift log feed + roster in tabs */}
      <Tabs defaultValue="logs">
        <TabsList className="h-9">
          <TabsTrigger value="logs" className="text-xs">All Updates</TabsTrigger>
          <TabsTrigger value="roster" className="text-xs">Team Roster</TabsTrigger>
        </TabsList>
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="h-[480px]">
                <DailyLogsFeed logs={logs} userRole={user.role} onValidateLog={onValidateLog} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="roster" className="mt-4">
          <ShiftRosterGrid shifts={shifts} canEdit={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────
// VIEW: MANAGER — Roster Planner + Ops Metrics
// ─────────────────────────────────────────────

interface ManagerViewProps {
  user: SessionUser;
  logs: DailyUpdateLog[];
  shifts: (Shift & { assignedTo: UserType })[];
  metrics: OperationalMetrics;
  projectSummaries: ProjectHealthSummary[];
}

function ManagerView({ user, logs, shifts, metrics, projectSummaries }: ManagerViewProps) {
  // Recompute active shifts dynamically (not from stored .status field)
  const now = new Date();
  const liveActiveCount = shifts.filter(
    (s) => now >= new Date(s.startTime) && now <= new Date(s.endTime)
  ).length;

  return (
    <div className="space-y-6">
      <QuickActions user={user} />
      {/* High-level ops metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Active Contractors" value={metrics.totalContractors} icon={Users} colorClass="text-teal-600" />
        <MetricCard label="Active Shifts Now" value={liveActiveCount} icon={Activity} colorClass="text-indigo-600" />
        <MetricCard label="Logs (24h)" value={metrics.logsLast24h} icon={FilePlus} colorClass="text-blue-600" />
        <MetricCard label="Open Handovers" value={metrics.openHandovers} icon={ArrowLeftRight}
          colorClass={metrics.openHandovers > 0 ? "text-amber-600" : "text-emerald-600"} />
        <MetricCard label="Pending Swaps" value={metrics.pendingSwapRequests} icon={RefreshCw} colorClass="text-violet-600" />
        <MetricCard label="Unacknowledged" value={metrics.unacknowledgedHandovers} icon={AlertOctagon}
          colorClass={metrics.unacknowledgedHandovers > 0 ? "text-red-600" : "text-emerald-600"} />
      </div>

      <Tabs defaultValue="projects">
        <TabsList className="h-9">
          <TabsTrigger value="projects" className="text-xs">Project Health</TabsTrigger>
          <TabsTrigger value="feed" className="text-xs">All Updates</TabsTrigger>
          <TabsTrigger value="roster" className="text-xs">Roster Overview</TabsTrigger>
        </TabsList>

        {/* Project health table */}
        <TabsContent value="projects" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Project</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Total Logs</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Open</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">P1</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Escalated</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">SLA Breaches</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Top Source</th>
                  </tr>
                </thead>
                <tbody>
                  {projectSummaries.map((proj) => {
                    const topSource = proj.sourceDistribution.sort((a, b) => b.count - a.count)[0];
                    return (
                      <tr key={proj.projectId} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-gray-900">{proj.projectName}</p>
                            <p className="text-[10px] text-gray-400">{proj.projectCode}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-gray-700">{proj.totalLogs}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("font-semibold", proj.openLogs > 0 ? "text-red-600" : "text-emerald-600")}>
                            {proj.openLogs}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {proj.p1Count > 0 ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-700">
                              {proj.p1Count}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {proj.escalatedLogs > 0 ? (
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 font-bold text-purple-700">
                              {proj.escalatedLogs}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {proj.slaBreachCount > 0 ? (
                            <span className="rounded-full bg-orange-100 px-2 py-0.5 font-bold text-orange-700">
                              {proj.slaBreachCount}
                            </span>
                          ) : <span className="text-emerald-500 font-medium">✓ 0</span>}
                        </td>
                        <td className="px-4 py-3">
                          {topSource ? (
                            <span className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                              SOURCE_CONFIG[topSource.source].badgeClass
                            )}>
                              {SOURCE_CONFIG[topSource.source].label}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All updates feed */}
        <TabsContent value="feed" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="h-[520px]">
                <DailyLogsFeed logs={logs} userRole={user.role} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Live Roster Overview */}
        <TabsContent value="roster" className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">Viewing current week. Open the Roster page for full management tools.</p>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
              <a href="/dashboard/roster">Manage Roster <ChevronRight className="h-3.5 w-3.5" /></a>
            </Button>
          </div>
          <ShiftRosterGrid shifts={shifts} canEdit={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────
// VIEW: GAP_STAKEHOLDER — Read-Only Analytics
// ─────────────────────────────────────────────

interface StakeholderViewProps {
  logs: DailyUpdateLog[];
  projectSummaries: ProjectHealthSummary[];
  onExport: () => void;
}

function StakeholderView({ logs, projectSummaries, onExport }: StakeholderViewProps) {
  const p1Count = logs.filter(l => l.severity === "P1_CRITICAL").length;
  const escalatedCount = logs.filter(l => l.status === "ESCALATED").length;
  const resolvedCount = logs.filter(l => l.status === "RESOLVED" || l.status === "VALIDATED" || l.status === "CLOSED").length;
  const resolutionRate = logs.length > 0 ? Math.round((resolvedCount / logs.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Read-only banner */}
      <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5">
        <ShieldCheck className="h-4 w-4 flex-shrink-0 text-rose-500" />
        <p className="text-xs text-rose-700">
          <span className="font-semibold">GAPINC Visibility Tier</span> — read-only access across all HCL vendor tracks.
          No actions can be performed from this view.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          className="ml-auto h-7 gap-1.5 border-rose-200 text-xs text-rose-700 hover:bg-rose-100"
        >
          <Download className="h-3 w-3" />
          Export Summary
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Total Incidents (Today)" value={logs.length} icon={Activity} colorClass="text-indigo-600"
          trend={{ value: 12, direction: "up" }} />
        <MetricCard label="P1 Critical" value={p1Count} icon={AlertOctagon}
          colorClass={p1Count > 0 ? "text-red-600" : "text-emerald-600"} />
        <MetricCard label="Escalated to GAPINC" value={escalatedCount} icon={TrendingUp}
          colorClass={escalatedCount > 0 ? "text-amber-600" : "text-emerald-600"} />
        <MetricCard label="Resolution Rate" value={`${resolutionRate}%`} icon={CheckCircle2}
          colorClass={resolutionRate >= 80 ? "text-emerald-600" : "text-amber-600"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Source distribution */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Incidents by Source Channel</CardTitle>
            <CardDescription className="text-xs">Distribution of today's {logs.length} updates.</CardDescription>
          </CardHeader>
          <CardContent>
            <SourceDistributionChart logs={logs} />
          </CardContent>
        </Card>

        {/* Severity breakdown */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Severity Breakdown</CardTitle>
            <CardDescription className="text-xs">Today's incidents by priority tier.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(["P1_CRITICAL", "P2_HIGH", "P3_MEDIUM", "P4_LOW", "INFORMATIONAL"] as const).map((sev) => {
              const count = logs.filter(l => l.severity === sev).length;
              const pct = logs.length > 0 ? (count / logs.length) * 100 : 0;
              const cfg = SEVERITY_CONFIG[sev];
              return (
                <div key={sev} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className={cn("font-medium", cfg.badgeClass.split(" ")[1])}>{cfg.label}</span>
                    <span className="font-semibold text-gray-700">{count}</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* SLA compliance by project */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">SLA Compliance</CardTitle>
            <CardDescription className="text-xs">Per-project SLA breach tracking.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {projectSummaries.map((proj) => {
              const slaScore = proj.totalLogs > 0
                ? Math.max(0, 100 - Math.round((proj.slaBreachCount / proj.totalLogs) * 100))
                : 100;
              return (
                <div key={proj.projectId} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-gray-700">{proj.projectCode}</span>
                    <span className={cn("font-bold", slaScore >= 95 ? "text-emerald-600" :
                      slaScore >= 80 ? "text-amber-600" : "text-red-600")}>
                      {slaScore}%
                    </span>
                  </div>
                  <Progress value={slaScore} className={cn("h-2",
                    slaScore >= 95 ? "[&>div]:bg-emerald-500" :
                    slaScore >= 80 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"
                  )} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Read-only all-project feed */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm">All Active HCL Vendor Tracks — Live Feed</CardTitle>
          <CardDescription className="text-xs">Read-only view. Filter by source or severity for targeted visibility.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-3">
          <div className="h-[480px]">
            <DailyLogsFeed logs={logs} userRole="GAP_STAKEHOLDER" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// MASTER DASHBOARD WORKSPACE
// ─────────────────────────────────────────────

interface DashboardWorkspaceProps {
  user: SessionUser;
  logs: DailyUpdateLog[];
  shifts?: (Shift & { assignedTo: UserType })[];
  pendingHandovers?: ShiftHandover[];
  pendingSwaps?: ShiftSwapRequest[];
  projectSummaries?: ProjectHealthSummary[];
  metrics?: OperationalMetrics;
  // Action callbacks (wired to Server Actions in parent page)
  onLogUpdate?: () => void;
  onStartHandover?: () => void;
  onApproveSwap?: (id: string) => void;
  onRejectSwap?: (id: string) => void;
  onValidateLog?: (id: string) => void;
  onExportSummary?: () => void;
}

const DEFAULT_METRICS: OperationalMetrics = {
  totalContractors: 0,
  activeShiftsNow: 0,
  logsLast24h: 0,
  openHandovers: 0,
  pendingSwapRequests: 0,
  unacknowledgedHandovers: 0,
};

export function DashboardWorkspace({
  user,
  logs,
  shifts = [],
  pendingHandovers = [],
  pendingSwaps = [],
  projectSummaries = [],
  metrics = DEFAULT_METRICS,
  onLogUpdate = () => {},
  onStartHandover = () => {},
  onApproveSwap = () => {},
  onRejectSwap = () => {},
  onValidateLog = () => {},
  onExportSummary = () => {},
}: DashboardWorkspaceProps) {
  // Page-level header line — role-specific greeting
  const roleConfig = ROLE_CONFIG[user.role];
  const greetings: Record<UserRole, string> = {
    CONTRACTOR: "Your shift overview and update log.",
    EMPLOYEE: "Cross-functional updates and shift management.",
    LEAD: "Shift oversight — validate logs, approve swaps, execute handovers.",
    MANAGER: "Operational health across all projects and partner teams.",
    GAP_STAKEHOLDER: "Executive overview — all active HCL vendor tracks.",
  };

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">{greetings[user.role]}</p>
        </div>
        <Badge variant="secondary" className={cn("text-xs", roleConfig.badgeClass)}>
          {roleConfig.description}
        </Badge>
      </div>

      {/* Role-specific workspace */}
      {(user.role === "CONTRACTOR" || user.role === "EMPLOYEE") && (
        <ContractorView user={user} logs={logs} shifts={shifts} onLogUpdate={onLogUpdate} />
      )}

      {user.role === "LEAD" && (
        <LeadView
          user={user}
          logs={logs}
          shifts={shifts}
          pendingHandovers={pendingHandovers}
          pendingSwaps={pendingSwaps}
          onApproveSwap={onApproveSwap}
          onRejectSwap={onRejectSwap}
          onStartHandover={onStartHandover}
          onValidateLog={onValidateLog}
        />
      )}

      {user.role === "MANAGER" && (
        <ManagerView
          user={user}
          logs={logs}
          shifts={shifts}
          metrics={metrics}
          projectSummaries={projectSummaries}
        />
      )}

      {user.role === "GAP_STAKEHOLDER" && (
        <StakeholderView
          logs={logs}
          projectSummaries={projectSummaries}
          onExport={onExportSummary}
        />
      )}
    </div>
  );
}
