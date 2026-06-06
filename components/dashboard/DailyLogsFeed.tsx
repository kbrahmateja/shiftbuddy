"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Bell, Ticket, Hash, Video, MessageCircle, MoreHorizontal,
  AlertOctagon, AlertTriangle, AlertCircle, Info, FileText,
  Search, SlidersHorizontal, X, ChevronDown, ExternalLink,
  RefreshCw, Filter, Clock, User, Tag,
} from "lucide-react";
import { cn, SOURCE_CONFIG, SEVERITY_CONFIG, LOG_STATUS_CONFIG, relativeTime, truncate } from "@/lib/utils";
import type { DailyUpdateLog, Source, Severity, LogStatus, UserRole } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// ─────────────────────────────────────────────
// ICON MAP
// ─────────────────────────────────────────────

const SOURCE_ICONS: Record<Source, React.ComponentType<{ className?: string }>> = {
  PAGERDUTY: Bell,
  SERVICENOW: Ticket,
  SLACK: Hash,
  TEAMS: Video,
  VERBAL: MessageCircle,
  OTHER: MoreHorizontal,
};

const SEVERITY_ICONS: Record<Severity, React.ComponentType<{ className?: string }>> = {
  P1_CRITICAL: AlertOctagon,
  P2_HIGH: AlertTriangle,
  P3_MEDIUM: AlertCircle,
  P4_LOW: Info,
  INFORMATIONAL: FileText,
};

// ─────────────────────────────────────────────
// FILTER STATE
// ─────────────────────────────────────────────

interface FeedFilters {
  sources: Set<Source>;
  severities: Set<Severity>;
  statuses: Set<LogStatus>;
  searchQuery: string;
  showBlockingOnly: boolean;
  sortBy: "loggedAt_desc" | "loggedAt_asc" | "severity_asc" | "occurredAt_desc";
}

const DEFAULT_FILTERS: FeedFilters = {
  sources: new Set(),
  severities: new Set(),
  statuses: new Set(),
  searchQuery: "",
  showBlockingOnly: false,
  sortBy: "loggedAt_desc",
};

// ─────────────────────────────────────────────
// FILTER PANEL (sidebar)
// ─────────────────────────────────────────────

interface FilterPanelProps {
  filters: FeedFilters;
  onChange: (filters: FeedFilters) => void;
  sourceCounts: Partial<Record<Source, number>>;
  severityCounts: Partial<Record<Severity, number>>;
  totalCount: number;
  filteredCount: number;
}

const ALL_SOURCES: Source[] = ["PAGERDUTY", "SERVICENOW", "SLACK", "TEAMS", "VERBAL", "OTHER"];
const ALL_SEVERITIES: Severity[] = ["P1_CRITICAL", "P2_HIGH", "P3_MEDIUM", "P4_LOW", "INFORMATIONAL"];
const ALL_STATUSES: LogStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "VALIDATED", "CLOSED", "ESCALATED"];

function FilterPanel({
  filters,
  onChange,
  sourceCounts,
  severityCounts,
  totalCount,
  filteredCount,
}: FilterPanelProps) {
  function toggleSet<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  const hasActiveFilters =
    filters.sources.size > 0 ||
    filters.severities.size > 0 ||
    filters.statuses.size > 0 ||
    filters.showBlockingOnly;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900">Filters</span>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-gray-500 hover:text-red-600"
            onClick={() => onChange({ ...DEFAULT_FILTERS })}
          >
            <X className="mr-1 h-3 w-3" />
            Clear all
          </Button>
        )}
      </div>

      {/* Result count */}
      <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
        Showing <span className="font-semibold text-gray-900">{filteredCount}</span> of{" "}
        <span className="font-semibold">{totalCount}</span> entries
      </div>

      {/* ── Source Filter ── */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900">
          <span>Source Channel</span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-1">
            {ALL_SOURCES.map((source) => {
              const cfg = SOURCE_CONFIG[source];
              const Icon = SOURCE_ICONS[source];
              const count = sourceCounts[source] ?? 0;
              const isActive = filters.sources.has(source);
              return (
                <button
                  key={source}
                  onClick={() =>
                    onChange({ ...filters, sources: toggleSet(filters.sources, source) })
                  }
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-all",
                    isActive
                      ? cn(cfg.badgeClass, "border font-medium")
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", cfg.dotClass)} />
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="flex-1">{cfg.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      count > 0 ? "bg-gray-200 text-gray-700" : "text-gray-300"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* ── Severity Filter ── */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900">
          <span>Severity</span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-1">
            {ALL_SEVERITIES.map((sev) => {
              const cfg = SEVERITY_CONFIG[sev];
              const Icon = SEVERITY_ICONS[sev];
              const count = severityCounts[sev] ?? 0;
              const isActive = filters.severities.has(sev);
              return (
                <button
                  key={sev}
                  onClick={() =>
                    onChange({ ...filters, severities: toggleSet(filters.severities, sev) })
                  }
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-all",
                    isActive
                      ? cn(cfg.badgeClass, "border font-medium")
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="flex-1">{cfg.label}</span>
                  <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* ── Status Filter ── */}
      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900">
          <span>Status</span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-1">
            {ALL_STATUSES.map((status) => {
              const cfg = LOG_STATUS_CONFIG[status];
              const isActive = filters.statuses.has(status);
              return (
                <button
                  key={status}
                  onClick={() =>
                    onChange({ ...filters, statuses: toggleSet(filters.statuses, status) })
                  }
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-all",
                    isActive
                      ? cn(cfg.badgeClass, "border font-medium")
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <span className="flex-1">{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Blocking dependency toggle */}
      <button
        onClick={() =>
          onChange({ ...filters, showBlockingOnly: !filters.showBlockingOnly })
        }
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
          filters.showBlockingOnly
            ? "bg-red-50 text-red-700 border border-red-200"
            : "text-gray-600 hover:bg-gray-50"
        )}
      >
        <AlertOctagon className="h-3.5 w-3.5 flex-shrink-0" />
        <span>Blocking Dependencies Only</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// SINGLE LOG CARD
// ─────────────────────────────────────────────

interface LogCardProps {
  log: DailyUpdateLog;
  userRole: UserRole;
  onValidate?: (logId: string) => void;
}

function LogCard({ log, userRole, onValidate }: LogCardProps) {
  const [expanded, setExpanded] = useState(false);
  const sourceCfg = SOURCE_CONFIG[log.source];
  const severityCfg = SEVERITY_CONFIG[log.severity];
  const statusCfg = LOG_STATUS_CONFIG[log.status];
  const SourceIcon = SOURCE_ICONS[log.source];
  const SeverityIcon = SEVERITY_ICONS[log.severity];

  return (
    <div
      className={cn(
        "group rounded-xl border border-gray-200 bg-white transition-all duration-150 hover:border-gray-300 hover:shadow-sm",
        "border-l-4",
        sourceCfg.borderClass,
        log.isBlockingDependency && "ring-1 ring-red-300"
      )}
    >
      <div className="p-4">
        {/* ── Header row ── */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {/* Source badge */}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                sourceCfg.badgeClass
              )}
            >
              <SourceIcon className="h-3 w-3" />
              {sourceCfg.label}
            </span>

            {/* Severity badge */}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                severityCfg.badgeClass
              )}
            >
              <SeverityIcon className="h-3 w-3" />
              {severityCfg.label}
            </span>

            {/* Status badge */}
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                statusCfg.badgeClass
              )}
            >
              {statusCfg.label}
            </span>

            {/* Blocking indicator */}
            {log.isBlockingDependency && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
                <AlertOctagon className="h-3 w-3" />
                BLOCKING
              </span>
            )}
          </div>

          {/* Timestamp */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Clock className="h-3 w-3" />
                  <span>{relativeTime(new Date(log.loggedAt))}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                Logged: {new Date(log.loggedAt).toLocaleString()}
                <br />
                Occurred: {new Date(log.occurredAt).toLocaleString()}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* ── Title ── */}
        <h3 className="mt-2.5 text-sm font-semibold text-gray-900 leading-snug">
          {log.title}
        </h3>

        {/* ── Description (collapsible) ── */}
        <p className={cn("mt-1.5 text-xs text-gray-600 leading-relaxed", !expanded && "line-clamp-2")}>
          {log.description}
        </p>
        {log.description.length > 140 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}

        {/* ── External reference links ── */}
        {(log.snowTicketId || log.pagerDutyRef || log.slackMessageUrl || log.teamsMessageUrl) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {log.snowTicketId && (
              <a
                href={`https://gapinc.service-now.com/nav_to.do?uri=incident.do?sysparm_query=number=${log.snowTicketId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
              >
                <Ticket className="h-3 w-3" />
                {log.snowTicketId}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {log.pagerDutyRef && (
              <a
                href={
                  log.pagerDutyRef.startsWith("http")
                    ? log.pagerDutyRef
                    : `https://app.pagerduty.com/incidents/${log.pagerDutyRef}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-100"
              >
                <Bell className="h-3 w-3" />
                {truncate(log.pagerDutyRef, 20)}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {log.slackMessageUrl && (
              <a
                href={log.slackMessageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100"
              >
                <Hash className="h-3 w-3" />
                Slack Thread
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {log.teamsMessageUrl && (
              <a
                href={log.teamsMessageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
              >
                <Video className="h-3 w-3" />
                Teams Message
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        )}

        {/* ── Tags ── */}
        {log.tags && log.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {log.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: tag.color + "20", color: tag.color }}
              >
                <Tag className="h-2.5 w-2.5" />
                {tag.label}
              </span>
            ))}
          </div>
        )}

        {/* ── Footer row ── */}
        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <User className="h-3 w-3" />
            <span>{log.author?.name ?? "Unknown"}</span>
            {log.validatedBy && (
              <>
                <span>·</span>
                <span className="text-emerald-600">
                  Validated by {log.validatedBy.name}
                </span>
              </>
            )}
          </div>

          {/* Lead validate action */}
          {(userRole === "LEAD" || userRole === "MANAGER") &&
            log.status === "RESOLVED" &&
            !log.validatedById && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                onClick={() => onValidate?.(log.id)}
              >
                Validate
              </Button>
            )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN FEED COMPONENT
// ─────────────────────────────────────────────

interface DailyLogsFeedProps {
  logs: DailyUpdateLog[];
  userRole: UserRole;
  isLoading?: boolean;
  onRefresh?: () => void;
  onValidateLog?: (logId: string) => void;
}

export function DailyLogsFeed({
  logs,
  userRole,
  isLoading = false,
  onRefresh,
  onValidateLog,
}: DailyLogsFeedProps) {
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // ── Derived counts for the filter panel ──
  const sourceCounts = useMemo(
    () =>
      logs.reduce(
        (acc, log) => ({ ...acc, [log.source]: (acc[log.source] ?? 0) + 1 }),
        {} as Partial<Record<Source, number>>
      ),
    [logs]
  );

  const severityCounts = useMemo(
    () =>
      logs.reduce(
        (acc, log) => ({ ...acc, [log.severity]: (acc[log.severity] ?? 0) + 1 }),
        {} as Partial<Record<Severity, number>>
      ),
    [logs]
  );

  // ── Filtered + sorted logs ──
  const filteredLogs = useMemo(() => {
    let result = logs;

    if (filters.sources.size > 0) {
      result = result.filter((l) => filters.sources.has(l.source));
    }
    if (filters.severities.size > 0) {
      result = result.filter((l) => filters.severities.has(l.severity));
    }
    if (filters.statuses.size > 0) {
      result = result.filter((l) => filters.statuses.has(l.status));
    }
    if (filters.showBlockingOnly) {
      result = result.filter((l) => l.isBlockingDependency);
    }
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.snowTicketId?.toLowerCase().includes(q) ||
          l.pagerDutyRef?.toLowerCase().includes(q) ||
          l.author?.name.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (filters.sortBy) {
      case "loggedAt_asc":
        return [...result].sort(
          (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime()
        );
      case "severity_asc":
        return [...result].sort(
          (a, b) =>
            SEVERITY_CONFIG[a.severity].sortOrder -
            SEVERITY_CONFIG[b.severity].sortOrder
        );
      case "occurredAt_desc":
        return [...result].sort(
          (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        );
      default: // loggedAt_desc
        return [...result].sort(
          (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
        );
    }
  }, [logs, filters]);

  // ── Active filter chips ──
  const activeFilterCount =
    filters.sources.size +
    filters.severities.size +
    filters.statuses.size +
    (filters.showBlockingOnly ? 1 : 0);

  return (
    <div className="flex h-full gap-0">
      {/* ── Desktop Filter Sidebar ── */}
      <aside className="hidden w-60 flex-shrink-0 border-r border-gray-200 bg-white lg:flex lg:flex-col">
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          sourceCounts={sourceCounts}
          severityCounts={severityCounts}
          totalCount={logs.length}
          filteredCount={filteredLogs.length}
        />
      </aside>

      {/* ── Feed Area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search title, ticket ID, author…"
              value={filters.searchQuery}
              onChange={(e) =>
                setFilters((f) => ({ ...f, searchQuery: e.target.value }))
              }
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Sort */}
          <Select
            value={filters.sortBy}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, sortBy: v as FeedFilters["sortBy"] }))
            }
          >
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="loggedAt_desc" className="text-xs">Newest first</SelectItem>
              <SelectItem value="loggedAt_asc" className="text-xs">Oldest first</SelectItem>
              <SelectItem value="severity_asc" className="text-xs">By severity (P1 first)</SelectItem>
              <SelectItem value="occurredAt_desc" className="text-xs">By occurred time</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh */}
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
              Refresh
            </Button>
          )}

          {/* Mobile filter sheet trigger */}
          <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs lg:hidden">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="px-4 py-3 border-b">
                <SheetTitle className="text-sm">Filter Logs</SheetTitle>
              </SheetHeader>
              <FilterPanel
                filters={filters}
                onChange={setFilters}
                sourceCounts={sourceCounts}
                severityCounts={severityCounts}
                totalCount={logs.length}
                filteredCount={filteredLogs.length}
              />
            </SheetContent>
          </Sheet>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from(filters.sources).map((src) => (
                <span
                  key={src}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    SOURCE_CONFIG[src].badgeClass
                  )}
                >
                  {SOURCE_CONFIG[src].label}
                  <button
                    onClick={() => {
                      const next = new Set(filters.sources);
                      next.delete(src);
                      setFilters((f) => ({ ...f, sources: next }));
                    }}
                    className="ml-0.5 hover:opacity-70"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              {Array.from(filters.severities).map((sev) => (
                <span
                  key={sev}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    SEVERITY_CONFIG[sev].badgeClass
                  )}
                >
                  {SEVERITY_CONFIG[sev].label}
                  <button
                    onClick={() => {
                      const next = new Set(filters.severities);
                      next.delete(sev);
                      setFilters((f) => ({ ...f, severities: next }));
                    }}
                    className="ml-0.5 hover:opacity-70"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              {filters.showBlockingOnly && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                  Blocking Only
                  <button
                    onClick={() => setFilters((f) => ({ ...f, showBlockingOnly: false }))}
                    className="ml-0.5 hover:opacity-70"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Log Cards */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-xl bg-gray-100 border-l-4 border-l-gray-200" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">No updates match your filters</p>
              <p className="mt-1 text-xs text-gray-400">
                Try adjusting or clearing your filter selections.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 text-xs"
                onClick={() => setFilters({ ...DEFAULT_FILTERS })}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <LogCard
                  key={log.id}
                  log={log}
                  userRole={userRole}
                  onValidate={onValidateLog}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
