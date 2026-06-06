"use client";

import { useState, useCallback } from "react";
import {
  BarChart3, Download, CalendarDays, Users, AlertOctagon,
  BookOpen, Wrench, ListTodo, AlertTriangle, ChevronDown,
  ChevronRight, CheckCircle2, Clock, FileText, RotateCcw,
} from "lucide-react";
import { cn, getAvatarColor, getInitials, SHIFT_PATTERN_LABELS } from "@/lib/utils";
import type { DiaryReport, DiaryProjectSummary, DiaryPersonSummary, DiaryReportPeriod } from "@/types";
import { Button }    from "@/components/ui/button";
import { Progress }  from "@/components/ui/progress";
import { Badge }     from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { getDiaryReport, exportDiaryReport } from "@/app/actions/diary";
import { MOCK_PROJECTS } from "@/lib/mock-data";

// ─────────────────────────────────────────────
// KT PROGRESS COLOR
// ─────────────────────────────────────────────

function ktColor(pct: number): string {
  if (pct >= 80) return "text-emerald-600";
  if (pct >= 50) return "text-indigo-600";
  if (pct >= 25) return "text-amber-600";
  return "text-red-500";
}

function ktBg(pct: number): string {
  if (pct >= 80) return "[&>div]:bg-emerald-500";
  if (pct >= 50) return "[&>div]:bg-indigo-500";
  if (pct >= 25) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-red-400";
}

// ─────────────────────────────────────────────
// PERSON ROW (inside project table)
// ─────────────────────────────────────────────

function PersonRow({
  member, isExpanded, onToggle,
}: {
  member: DiaryPersonSummary;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const submitRate = member.totalDiaryDays > 0
    ? Math.round((member.submittedDays / member.totalDiaryDays) * 100)
    : 0;

  return (
    <tr
      className={cn(
        "border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer transition-colors",
        isExpanded && "bg-indigo-50/30"
      )}
      onClick={onToggle}
    >
      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: getAvatarColor(member.userId) }}>
            {getInitials(member.userName)}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-900">{member.userName}</p>
            <p className="text-[10px] text-gray-400">
              {member.shiftPattern.charAt(0) + member.shiftPattern.slice(1).toLowerCase()} shift
            </p>
          </div>
        </div>
      </td>
      {/* Submit Rate */}
      <td className="px-4 py-3 text-center">
        <span className={cn("text-xs font-bold",
          submitRate >= 90 ? "text-emerald-600" :
          submitRate >= 70 ? "text-amber-600"   : "text-red-500"
        )}>
          {member.submittedDays}/{member.totalDiaryDays}
        </span>
        <p className="text-[10px] text-gray-400">{submitRate}%</p>
      </td>
      {/* Incidents */}
      <td className="px-4 py-3 text-center">
        <span className="text-xs font-semibold text-gray-700">{member.totalIncidents}</span>
        {member.resolvedIncidents < member.totalIncidents && (
          <span className="ml-1 text-[10px] text-amber-500">
            ({member.totalIncidents - member.resolvedIncidents} open)
          </span>
        )}
      </td>
      {/* KT */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Progress value={member.avgKtProgress} className={cn("h-1.5 w-16", ktBg(member.avgKtProgress))} />
          <span className={cn("text-xs font-bold", ktColor(member.avgKtProgress))}>
            {member.avgKtProgress}%
          </span>
        </div>
        <p className="text-[10px] text-gray-400">{member.totalKtSessions} sessions</p>
      </td>
      {/* KTLO */}
      <td className="px-4 py-3 text-center text-xs font-semibold text-emerald-700">
        {member.totalKtloResolved}
      </td>
      {/* New Tasks */}
      <td className="px-4 py-3 text-center text-xs font-semibold text-violet-700">
        {member.totalNewTasks}
      </td>
      {/* Blockers */}
      <td className="px-4 py-3 text-center">
        {member.daysWithBlockers > 0 ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            ⚠️ {member.daysWithBlockers}d
          </span>
        ) : (
          <span className="text-[10px] text-gray-300">—</span>
        )}
      </td>
      <td className="px-2 py-3">
        {isExpanded
          ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────
// PROJECT SECTION
// ─────────────────────────────────────────────

function ProjectSection({ proj }: { proj: DiaryProjectSummary }) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const resolutionRate = proj.totalIncidents > 0
    ? Math.round((proj.resolvedIncidents / proj.totalIncidents) * 100)
    : 100;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Project header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">{proj.projectName}</span>
            <Badge variant="secondary" className="text-[10px]">
              {proj.memberCount} member{proj.memberCount !== 1 ? "s" : ""}
            </Badge>
          </div>
          {/* Quick metrics bar */}
          <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-gray-500">
            <span>
              Submit rate:{" "}
              <strong className={cn(
                proj.diarySubmitRate >= 90 ? "text-emerald-600" :
                proj.diarySubmitRate >= 70 ? "text-amber-600"   : "text-red-500"
              )}>
                {proj.diarySubmitRate}%
              </strong>
            </span>
            <span>Incidents: <strong className="text-gray-700">{proj.totalIncidents}</strong></span>
            <span>KTLO: <strong className="text-emerald-600">{proj.totalKtloResolved}</strong></span>
            <span>KT avg: <strong className={ktColor(proj.avgKtProgress)}>{proj.avgKtProgress}%</strong></span>
            <span>New tasks: <strong className="text-violet-600">{proj.totalNewTasks}</strong></span>
          </div>
        </div>
        {collapsed
          ? <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
          : <ChevronDown  className="h-4 w-4 text-gray-400 flex-shrink-0" />}
      </button>

      {/* Team table */}
      {!collapsed && (
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Team Member</th>
                <th className="px-4 py-2.5 text-center font-semibold text-gray-500">Diary / Days</th>
                <th className="px-4 py-2.5 text-center font-semibold text-gray-500">Incidents</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-500">KT Progress</th>
                <th className="px-4 py-2.5 text-center font-semibold text-gray-500">KTLO</th>
                <th className="px-4 py-2.5 text-center font-semibold text-gray-500">New Tasks</th>
                <th className="px-4 py-2.5 text-center font-semibold text-gray-500">Blockers</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {proj.members.map((member) => (
                <PersonRow
                  key={member.userId}
                  member={member}
                  isExpanded={expandedMember === member.userId}
                  onToggle={() => setExpandedMember(
                    expandedMember === member.userId ? null : member.userId
                  )}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN REPORT PANEL
// ─────────────────────────────────────────────

interface DiaryReportPanelProps {
  initialReport?: DiaryReport;
  defaultPeriod?: DiaryReportPeriod;
  defaultProjectId?: string;
}

export function DiaryReportPanel({
  initialReport,
  defaultPeriod = "WEEKLY",
  defaultProjectId = "",
}: DiaryReportPanelProps) {
  const [period, setPeriod]       = useState<DiaryReportPeriod>(defaultPeriod);
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [dateStr, setDateStr]     = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport]       = useState<DiaryReport | null>(initialReport ?? null);
  const [loading, setLoading]     = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError]         = useState("");

  const fmt = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  async function handleGenerate() {
    setLoading(true);
    setError("");
    const result = await getDiaryReport({
      period,
      projectId: projectId || undefined,
      referenceDate: dateStr,
    });
    setLoading(false);
    if (result.success) {
      setReport(result.data);
    } else {
      setError(result.error);
    }
  }

  async function handleExport() {
    setExporting(true);
    const result = await exportDiaryReport({
      period,
      projectId: projectId || undefined,
      referenceDate: dateStr,
    });
    setExporting(false);
    if (result.success) {
      // Download the markdown file
      const blob = new Blob([result.data.markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Controls ── */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Period</label>
          <Select value={period} onValueChange={(v) => setPeriod(v as DiaryReportPeriod)}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY"   className="text-xs">Daily</SelectItem>
              <SelectItem value="WEEKLY"  className="text-xs">Weekly</SelectItem>
              <SelectItem value="MONTHLY" className="text-xs">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Reference Date</label>
          <Input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="h-8 w-[150px] text-xs"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Project</label>
          <Select value={projectId || "all"} onValueChange={(v) => setProjectId(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Projects</SelectItem>
              {MOCK_PROJECTS.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={loading}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? <RotateCcw className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
            Generate
          </Button>
          {report && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              className="gap-1.5 text-xs"
            >
              {exporting ? <Clock className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Export .md
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* ── Report Output ── */}
      {report && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <div>
              <p className="text-sm font-bold text-gray-900">
                {report.period.charAt(0) + report.period.slice(1).toLowerCase()} Diary Report
              </p>
              <p className="text-xs text-gray-500">
                {fmt(report.fromDate)} – {fmt(report.toDate)}
                {" · "}Generated {new Date(report.generatedAt).toLocaleTimeString()}
              </p>
            </div>
            {/* Top KPIs */}
            <div className="flex flex-wrap gap-4">
              {[
                { label: "Total Diaries",   value: report.totalDiaries,           color: "text-indigo-600" },
                { label: "Submit Rate",     value: `${report.submitRate}%`,        color: report.submitRate >= 80 ? "text-emerald-600" : "text-amber-600" },
                { label: "Total Incidents", value: report.projectStats.reduce((s, p) => s + p.totalIncidents, 0),   color: "text-red-600"     },
                { label: "KTLO Resolved",   value: report.projectStats.reduce((s, p) => s + p.totalKtloResolved, 0), color: "text-emerald-600" },
                { label: "Avg KT",          value: `${
                    report.projectStats.length > 0
                      ? Math.round(report.projectStats.reduce((s, p) => s + p.avgKtProgress, 0) / report.projectStats.length)
                      : 0
                  }%`,                                                             color: "text-indigo-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <p className={cn("text-xl font-bold", color)}>{value}</p>
                  <p className="text-[10px] text-gray-400">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Per-project sections */}
          {report.projectStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-gray-200 bg-white">
              <FileText className="mb-2 h-8 w-8 text-gray-200" />
              <p className="text-sm text-gray-500">No submitted diaries found for this period.</p>
              <p className="text-xs text-gray-400">Adjust the date range or project filter.</p>
            </div>
          ) : (
            report.projectStats.map((proj) => (
              <ProjectSection key={proj.projectId} proj={proj} />
            ))
          )}
        </div>
      )}

      {!report && !loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-14 text-center">
          <BarChart3 className="mb-3 h-10 w-10 text-gray-200" />
          <p className="text-sm font-medium text-gray-500">Configure your report and click Generate</p>
          <p className="text-xs text-gray-400">
            View daily, weekly, or monthly aggregates across incidents, KT, KTLO, and new tasks.
          </p>
        </div>
      )}
    </div>
  );
}
