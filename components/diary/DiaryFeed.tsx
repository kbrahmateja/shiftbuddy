"use client";

import { useState } from "react";
import {
  AlertOctagon, BookOpen, Wrench, ListTodo, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronUp, Search, CalendarDays,
  Filter, User, Bell, Ticket, Hash, Video, MessageCircle,
  MoreHorizontal, MessageSquare, Eye, RotateCcw,
} from "lucide-react";
import { cn, SOURCE_CONFIG, SEVERITY_CONFIG, getInitials, getAvatarColor, relativeTime } from "@/lib/utils";
import type { DailyDiary, DiaryIncident, UserRole, ShiftPattern, Source } from "@/types";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Badge }     from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { reviewDiaryEntry } from "@/app/actions/diary";
import { MOCK_PROJECTS } from "@/lib/mock-data";

// ─────────────────────────────────────────────
// INCIDENT MICRO-CARD
// ─────────────────────────────────────────────

const SOURCE_ICONS: Record<Source, React.ComponentType<{ className?: string }>> = {
  PAGERDUTY: Bell, SERVICENOW: Ticket, SLACK: Hash,
  TEAMS: Video, VERBAL: MessageCircle, OTHER: MoreHorizontal,
};

function IncidentMiniCard({ incident }: { incident: DiaryIncident }) {
  const srcCfg = SOURCE_CONFIG[incident.source];
  const sevCfg = SEVERITY_CONFIG[incident.severity];
  const SrcIcon = SOURCE_ICONS[incident.source];
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border p-2 text-xs border-l-4", srcCfg.borderClass)}>
      <SrcIcon className={cn("mt-0.5 h-3.5 w-3.5 flex-shrink-0", srcCfg.badgeClass.split(" ")[1])} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-gray-800 truncate">{incident.title}</span>
          <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-semibold flex-shrink-0", sevCfg.badgeClass)}>
            {sevCfg.label}
          </span>
          {incident.wasResolved
            ? <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">✓ Resolved</span>
            : <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Open</span>}
        </div>
        {incident.externalRef && (
          <span className="text-[10px] text-gray-400">{incident.externalRef}</span>
        )}
        {incident.notes && <p className="mt-0.5 text-[10px] text-gray-500 line-clamp-1">{incident.notes}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SINGLE DIARY CARD
// ─────────────────────────────────────────────

interface DiaryCardProps {
  diary: DailyDiary & { author?: { id: string; name: string; role: UserRole } };
  viewerRole: UserRole;
  onReviewed?: (diaryId: string) => void;
}

function DiaryCard({ diary, viewerRole, onReviewed }: DiaryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [showReviewBox, setShowReviewBox] = useState(false);
  const [feedback, setFeedback] = useState("");

  const author = diary.author;
  const canReview = (viewerRole === "LEAD" || viewerRole === "MANAGER") && diary.status === "SUBMITTED";

  const statusConfig = {
    DRAFT:     { label: "Draft",     bg: "bg-gray-100",    text: "text-gray-600"   },
    SUBMITTED: { label: "Submitted", bg: "bg-amber-100",   text: "text-amber-700"  },
    REVIEWED:  { label: "Reviewed",  bg: "bg-emerald-100", text: "text-emerald-700" },
  }[diary.status];

  async function handleReview() {
    setReviewing(true);
    const result = await reviewDiaryEntry({ diaryId: diary.id, reviewNotes: reviewNote });
    setReviewing(false);
    if (result.success) {
      setFeedback("Marked as reviewed.");
      setShowReviewBox(false);
      onReviewed?.(diary.id);
    } else {
      setFeedback(result.error);
    }
  }

  return (
    <div className={cn(
      "rounded-xl border bg-white transition-all hover:shadow-sm",
      diary.status === "SUBMITTED" ? "border-amber-200" :
      diary.status === "REVIEWED"  ? "border-emerald-200" : "border-gray-200",
      diary.hasBlockers && "ring-1 ring-amber-300",
    )}>
      {/* Header */}
      <div
        className="flex cursor-pointer items-start justify-between gap-3 p-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          {author && (
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: getAvatarColor(diary.authorId) }}>
              {getInitials(author.name)}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {author?.name ?? diary.authorId}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-gray-400">
                {diary.shiftPattern.charAt(0) + diary.shiftPattern.slice(1).toLowerCase()} shift
              </span>
              <span className="text-[11px] text-gray-300">·</span>
              <span className="text-[11px] text-gray-400">
                {relativeTime(new Date(diary.diaryDate))}
              </span>
            </div>
          </div>
        </div>

        {/* Right side badges */}
        <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", statusConfig.bg, statusConfig.text)}>
            {statusConfig.label}
          </span>
          {diary.hasBlockers && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              ⚠️ Blocker
            </span>
          )}
          {/* Quick metrics */}
          {diary.incidentCount > 0 && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
              {diary.incidentCount} inc
            </span>
          )}
          {diary.ktloResolvedCount > 0 && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
              {diary.ktloResolvedCount} KTLO
            </span>
          )}
          {diary.ktProgressPercent > 0 && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
              KT {diary.ktProgressPercent}%
            </span>
          )}
          {diary.newTaskCount > 0 && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
              {diary.newTaskCount} task{diary.newTaskCount > 1 ? "s" : ""}
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4">
          {/* Incidents */}
          {(diary.incidents?.length ?? 0) > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-red-700">
                <AlertOctagon className="h-3.5 w-3.5" />
                Incidents ({diary.incidents!.length})
              </div>
              <div className="space-y-1.5">
                {diary.incidents!.map((inc) => (
                  <IncidentMiniCard key={inc.id} incident={inc} />
                ))}
              </div>
              {diary.incidentNotes && (
                <p className="mt-2 text-[11px] text-gray-500">{diary.incidentNotes}</p>
              )}
            </div>
          )}

          {/* KT Section */}
          {(diary.ktProgressPercent > 0 || (diary.ktItems?.length ?? 0) > 0) && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                <BookOpen className="h-3.5 w-3.5" />
                KT Progress — {diary.ktProgressPercent}%
                {(diary.ktItems?.length ?? 0) > 0 && (
                  <span className="font-normal text-indigo-400">
                    · {diary.ktSessionsCount} session{diary.ktSessionsCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn("h-full rounded-full transition-all",
                    diary.ktProgressPercent >= 80 ? "bg-emerald-500" :
                    diary.ktProgressPercent >= 50 ? "bg-indigo-500"  :
                    diary.ktProgressPercent >= 25 ? "bg-amber-500"   : "bg-red-400"
                  )}
                  style={{ width: `${diary.ktProgressPercent}%` }}
                />
              </div>
              {diary.ktItems && diary.ktItems.length > 0 && (
                <div className="mt-2 space-y-1">
                  {diary.ktItems.map((ki) => (
                    <div key={ki.id} className="flex items-center gap-2 rounded-lg bg-indigo-50/60 px-2.5 py-1.5 text-[11px]">
                      <span className="font-semibold text-indigo-700">{ki.type}</span>
                      <span className="text-gray-700">{ki.topic}</span>
                      {ki.durationMins > 0 && (
                        <span className="ml-auto text-indigo-400">{ki.durationMins}m</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {diary.ktNotes && <p className="mt-1.5 text-[11px] text-gray-500">{diary.ktNotes}</p>}
            </div>
          )}

          {/* KTLO */}
          {(diary.ktloResolvedCount > 0 || (diary.ktloItems?.length ?? 0) > 0) && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <Wrench className="h-3.5 w-3.5" />
                KTLO — {diary.ktloResolvedCount} resolved
              </div>
              {diary.ktloItems && diary.ktloItems.length > 0 && (
                <div className="space-y-1">
                  {diary.ktloItems.map((kl) => {
                    const catColors: Record<string, string> = {
                      MONITORING:  "bg-sky-100 text-sky-700",
                      DEPLOYMENT:  "bg-violet-100 text-violet-700",
                      PATCH:       "bg-orange-100 text-orange-700",
                      MAINTENANCE: "bg-gray-100 text-gray-600",
                      ALERT:       "bg-red-100 text-red-700",
                    };
                    return (
                      <div key={kl.id} className="flex items-center gap-2 rounded-lg bg-emerald-50/60 px-2.5 py-1.5 text-[11px]">
                        <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", catColors[kl.category])}>
                          {kl.category}
                        </span>
                        <span className="text-gray-700">{kl.title}</span>
                        {kl.externalRef && <span className="ml-auto text-emerald-400">{kl.externalRef}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              {diary.ktloNotes && <p className="mt-1.5 text-[11px] text-gray-500">{diary.ktloNotes}</p>}
            </div>
          )}

          {/* New Tasks */}
          {(diary.newTaskCount > 0 || (diary.tasks?.length ?? 0) > 0) && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-violet-700">
                <ListTodo className="h-3.5 w-3.5" />
                New Tasks — {diary.tasks?.length ?? diary.newTaskCount}
              </div>
              {diary.tasks && diary.tasks.length > 0 && (
                <div className="space-y-1">
                  {diary.tasks.map((t) => {
                    const priColors: Record<string, string> = {
                      HIGH:   "bg-red-100 text-red-700",
                      MEDIUM: "bg-amber-100 text-amber-700",
                      LOW:    "bg-gray-100 text-gray-600",
                    };
                    return (
                      <div key={t.id} className="flex items-center gap-2 rounded-lg bg-violet-50/60 px-2.5 py-1.5 text-[11px]">
                        <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", priColors[t.priority])}>
                          {t.priority}
                        </span>
                        <span className="text-gray-700">{t.title}</span>
                        {t.dueDate && (
                          <span className="ml-auto text-violet-400">
                            Due {new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {diary.newTaskNotes && <p className="mt-1.5 text-[11px] text-gray-500">{diary.newTaskNotes}</p>}
            </div>
          )}

          {/* Blockers */}
          {diary.hasBlockers && diary.blockerDetails && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 mb-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Blocker for Incoming Shift
              </div>
              <p className="text-xs text-amber-700">{diary.blockerDetails}</p>
            </div>
          )}

          {/* General Notes */}
          {diary.generalNotes && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                General Notes
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">{diary.generalNotes}</p>
            </div>
          )}

          {/* Lead review note */}
          {diary.reviewNotes && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
              <p className="text-[10px] font-semibold text-blue-700 mb-0.5">Lead Review Note</p>
              <p className="text-xs text-blue-700">{diary.reviewNotes}</p>
            </div>
          )}

          {/* Review action */}
          {canReview && (
            <div className="border-t border-gray-100 pt-3">
              {!showReviewBox ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => setShowReviewBox(true)}
                >
                  <Eye className="h-3.5 w-3.5" /> Mark as Reviewed
                </Button>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Add a review note for the team member (optional)…"
                    rows={2}
                    maxLength={500}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-emerald-300"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleReview}
                      disabled={reviewing}
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {reviewing ? "Saving…" : "Confirm Review"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => setShowReviewBox(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {feedback && <p className="mt-1 text-[11px] text-emerald-600">{feedback}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// FILTER BAR
// ─────────────────────────────────────────────

interface DiaryFeedFilters {
  projectId: string;
  dateStr:   string;
  status:    string;
  search:    string;
  shift:     string;
}

const ALL_PROJECTS = [{ id: "all", name: "All Projects" }];

// ─────────────────────────────────────────────
// MAIN FEED
// ─────────────────────────────────────────────

interface DiaryFeedProps {
  diaries: DailyDiary[];
  viewerRole: UserRole;
  allUsers: { id: string; name: string; role: UserRole }[];
  onRefresh?: () => void;
}

export function DiaryFeed({ diaries, viewerRole, allUsers, onRefresh }: DiaryFeedProps) {
  const today = new Date().toISOString().slice(0, 10);

  const [filters, setFilters] = useState<DiaryFeedFilters>({
    projectId: "all",
    dateStr:   today,
    status:    "all",
    search:    "",
    shift:     "all",
  });

  // Hydrate author info onto each diary
  const hydratedDiaries = diaries.map((d) => ({
    ...d,
    author: allUsers.find((u) => u.id === d.authorId),
  })) as (DailyDiary & { author?: { id: string; name: string; role: UserRole } })[];

  // Apply filters
  const filtered = hydratedDiaries.filter((d) => {
    const diaryDateStr = new Date(d.diaryDate).toISOString().slice(0, 10);
    if (filters.dateStr && diaryDateStr !== filters.dateStr) return false;
    if (filters.projectId !== "all" && d.projectId !== filters.projectId) return false;
    if (filters.status !== "all" && d.status !== filters.status) return false;
    if (filters.shift !== "all" && d.shiftPattern !== filters.shift) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const name = d.author?.name.toLowerCase() ?? "";
      const notes = (d.generalNotes ?? "").toLowerCase();
      if (!name.includes(q) && !notes.includes(q)) return false;
    }
    return true;
  });

  // Summary stats for the current filter set
  const totalIncidents    = filtered.reduce((s, d) => s + d.incidentCount, 0);
  const totalKtlo         = filtered.reduce((s, d) => s + d.ktloResolvedCount, 0);
  const totalTasks        = filtered.reduce((s, d) => s + d.newTaskCount, 0);
  const avgKt             = filtered.length > 0
    ? Math.round(filtered.reduce((s, d) => s + d.ktProgressPercent, 0) / filtered.length)
    : 0;
  const blockerCount      = filtered.filter((d) => d.hasBlockers).length;
  const unreviewedCount   = filtered.filter((d) => d.status === "SUBMITTED").length;

  const SHIFT_OPTIONS: { value: string; label: string }[] = [
    { value: "all",       label: "All shifts" },
    { value: "MORNING",   label: "Morning" },
    { value: "AFTERNOON", label: "Afternoon" },
    { value: "NIGHT",     label: "Night" },
    { value: "GENERAL",   label: "General" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* ── Filter toolbar ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Date */}
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-gray-400" />
          <Input
            type="date"
            value={filters.dateStr}
            onChange={(e) => setFilters((f) => ({ ...f, dateStr: e.target.value }))}
            className="h-8 w-[150px] text-xs"
          />
        </div>

        {/* Project */}
        <Select
          value={filters.projectId}
          onValueChange={(v) => setFilters((f) => ({ ...f, projectId: v }))}
        >
          <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Projects</SelectItem>
            {MOCK_PROJECTS.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Shift */}
        <Select
          value={filters.shift}
          onValueChange={(v) => setFilters((f) => ({ ...f, shift: v }))}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SHIFT_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select
          value={filters.status}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all"       className="text-xs">All statuses</SelectItem>
            <SelectItem value="DRAFT"     className="text-xs">Draft</SelectItem>
            <SelectItem value="SUBMITTED" className="text-xs">Submitted</SelectItem>
            <SelectItem value="REVIEWED"  className="text-xs">Reviewed</SelectItem>
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name or notes…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="h-8 pl-8 text-xs"
          />
        </div>

        {onRefresh && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onRefresh}>
            <RotateCcw className="h-3.5 w-3.5" /> Refresh
          </Button>
        )}
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[
          { label: "Diaries",     value: filtered.length,  color: "text-indigo-600",  bg: "bg-indigo-50"  },
          { label: "Incidents",   value: totalIncidents,   color: "text-red-600",     bg: "bg-red-50"     },
          { label: "KTLO",        value: totalKtlo,        color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "KT Avg",      value: `${avgKt}%`,      color: "text-indigo-600",  bg: "bg-indigo-50"  },
          { label: "New Tasks",   value: totalTasks,       color: "text-violet-600",  bg: "bg-violet-50"  },
          { label: "Blockers",    value: blockerCount,     color: blockerCount > 0 ? "text-amber-700" : "text-gray-400", bg: "bg-amber-50"   },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn("rounded-xl px-3 py-2.5 text-center", bg)}>
            <p className={cn("text-lg font-bold", color)}>{value}</p>
            <p className="text-[10px] text-gray-500 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Unreviewed alert */}
      {unreviewedCount > 0 && (viewerRole === "LEAD" || viewerRole === "MANAGER") && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            <span className="font-semibold">{unreviewedCount} diary {unreviewedCount > 1 ? "entries" : "entry"}</span>{" "}
            {unreviewedCount > 1 ? "are" : "is"} pending your review.
          </span>
        </div>
      )}

      {/* ── Diary cards ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarDays className="mb-3 h-10 w-10 text-gray-200" />
          <p className="text-sm font-medium text-gray-500">No diary entries for this selection</p>
          <p className="mt-0.5 text-xs text-gray-400">
            Try adjusting the date or project filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((diary) => (
            <DiaryCard
              key={diary.id}
              diary={diary}
              viewerRole={viewerRole}
              onReviewed={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
