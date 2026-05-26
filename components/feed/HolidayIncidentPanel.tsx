"use client";
// components/feed/HolidayIncidentPanel.tsx
// ─────────────────────────────────────────────────────────────
// Separate holiday incident view in the feed.
// Splits incidents occurring on holiday dates into:
//   🔴 Response Required  (P1/P2 by default, configurable per project)
//   🟡 Ack Only           (P3/P4/INFO — just acknowledge, no active work)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from "react";
import {
  AlertOctagon, AlertTriangle, AlertCircle, Info, FileText,
  CheckCircle2, Clock, Palmtree, Zap, Bell, BellOff,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import type { DailyUpdateLog, Severity, UserRole } from "@/types";
import { MOCK_PROJECTS } from "@/lib/mock-data";
import {
  loadHolidayPolicy, getProjectPolicy, classifyHolidayIncident,
  getHolidaysOnDate, SEVERITY_LABELS, type HolidayPolicyStore,
  type ProjectHolidayPolicy,
} from "@/lib/holiday-policy";
import { getActiveHolidayDateSet } from "@/lib/holiday-policy";

// ── Severity icons ────────────────────────────────────────────────────────

const SEVERITY_ICONS: Record<Severity, React.ComponentType<{ className?: string }>> = {
  P1_CRITICAL:   AlertOctagon,
  P2_HIGH:       AlertTriangle,
  P3_MEDIUM:     AlertCircle,
  P4_LOW:        Info,
  INFORMATIONAL: FileText,
};

const SEVERITY_COLORS: Record<Severity, string> = {
  P1_CRITICAL:   "text-red-600",
  P2_HIGH:       "text-orange-500",
  P3_MEDIUM:     "text-yellow-600",
  P4_LOW:        "text-blue-500",
  INFORMATIONAL: "text-gray-400",
};

// ── Holiday Incident Card ─────────────────────────────────────────────────

function HolidayIncidentCard({
  log,
  classification,
}: {
  log: DailyUpdateLog;
  classification: "RESPONSE_REQUIRED" | "ACK_ONLY";
}) {
  const SevIcon = SEVERITY_ICONS[log.severity];
  const sevColor = SEVERITY_COLORS[log.severity];
  const dateStr = new Date(log.occurredAt).toISOString().slice(0, 10);
  const holidays = getHolidaysOnDate(dateStr);
  const holidayName = holidays.map((h) => h.name).join(", ");

  const isResponseRequired = classification === "RESPONSE_REQUIRED";

  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-2 transition-all",
      isResponseRequired
        ? "border-red-200 bg-red-50"
        : "border-yellow-100 bg-yellow-50/60"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <SevIcon className={cn("h-4 w-4 mt-0.5 shrink-0", sevColor)} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{log.title}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {SEVERITY_LABELS[log.severity]} · {MOCK_PROJECTS.find(p => p.id === log.projectId)?.name ?? log.projectId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isResponseRequired ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
              <Zap className="h-2.5 w-2.5" /> RESPOND
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 border border-yellow-200 px-2 py-0.5 text-[10px] font-bold text-yellow-700">
              <Bell className="h-2.5 w-2.5" /> ACK ONLY
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 line-clamp-2">{log.description}</p>

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {relativeTime(new Date(log.occurredAt))}
        </span>
        <span className="flex items-center gap-1">
          🏖️ {holidayName}
        </span>
        {log.acknowledgedAt ? (
          <span className="flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> Acknowledged
          </span>
        ) : (
          <span className="flex items-center gap-1 text-amber-500">
            <Clock className="h-3 w-3" /> Pending ack
          </span>
        )}
      </div>
    </div>
  );
}

// ── Section with collapse ─────────────────────────────────────────────────

function IncidentSection({
  title,
  subtitle,
  icon: Icon,
  headerColor,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  headerColor: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn("w-full flex items-center justify-between px-4 py-3", headerColor)}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="text-sm font-semibold">{title}</span>
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold">{count}</span>
        </div>
        <div className="flex items-center gap-2 text-xs opacity-70">
          <span>{subtitle}</span>
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>
      {open && (
        <div className="p-3 space-y-2 bg-white">
          {count === 0 ? (
            <p className="text-center text-xs text-gray-400 py-4">No incidents in this category</p>
          ) : children}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────

interface Props {
  logs: DailyUpdateLog[];
  userRole: UserRole;
}

export function HolidayIncidentPanel({ logs, userRole }: Props) {
  const [policyStore, setPolicyStore] = useState<HolidayPolicyStore>({});

  useEffect(() => {
    setPolicyStore(loadHolidayPolicy());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "shiftbuddy_holiday_policy") setPolicyStore(loadHolidayPolicy());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Find all holiday incidents
  const { responseRequired, ackOnly, holidayDates } = useMemo(() => {
    const holidayDateSet = getActiveHolidayDateSet();

    const holidayLogs = logs.filter((log) => {
      const dateStr = new Date(log.occurredAt).toISOString().slice(0, 10);
      return holidayDateSet.has(dateStr);
    });

    const responseRequired: DailyUpdateLog[] = [];
    const ackOnly: DailyUpdateLog[] = [];

    for (const log of holidayLogs) {
      const policy = getProjectPolicy(policyStore, log.projectId);
      const cls = classifyHolidayIncident(new Date(log.occurredAt), log.severity, policy);
      if (cls === "RESPONSE_REQUIRED") responseRequired.push(log);
      else ackOnly.push(log);
    }

    // Get unique holiday dates present
    const dates = [...new Set(holidayLogs.map((l) =>
      new Date(l.occurredAt).toISOString().slice(0, 10)
    ))];

    return { responseRequired, ackOnly, holidayDates: dates };
  }, [logs, policyStore]);

  const total = responseRequired.length + ackOnly.length;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Palmtree className="h-10 w-10 text-green-300 mb-3" />
        <p className="text-sm font-medium text-gray-500">No holiday incidents</p>
        <p className="text-xs text-gray-400 mt-1">No incidents were logged on holiday dates</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header summary */}
      <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Palmtree className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold text-orange-800">Holiday Mode Active</span>
          <span className="ml-auto text-[11px] text-orange-500">{total} incident{total !== 1 ? "s" : ""} on holidays</span>
        </div>
        <p className="text-xs text-orange-700">
          <span className="font-medium">{responseRequired.length} require full response</span>
          {" · "}
          <span className="font-medium">{ackOnly.length} ack only</span>
          {" · "}
          <span className="opacity-70">
            {holidayDates.map((d) => {
              const h = getHolidaysOnDate(d);
              return h.map((hh) => hh.name).join(", ");
            }).join(" · ")}
          </span>
        </p>
      </div>

      {/* Response Required */}
      <IncidentSection
        title="Response Required"
        subtitle="Active work needed — do not defer"
        icon={Zap}
        headerColor="bg-red-50 text-red-800 border-b border-red-200"
        count={responseRequired.length}
        defaultOpen={true}
      >
        {responseRequired.map((log) => (
          <HolidayIncidentCard key={log.id} log={log} classification="RESPONSE_REQUIRED" />
        ))}
      </IncidentSection>

      {/* Ack Only */}
      <IncidentSection
        title="Acknowledge Only"
        subtitle="Holiday mode — ack and monitor, no active work required"
        icon={BellOff}
        headerColor="bg-yellow-50 text-yellow-800 border-b border-yellow-200"
        count={ackOnly.length}
        defaultOpen={true}
      >
        {ackOnly.map((log) => (
          <HolidayIncidentCard key={log.id} log={log} classification="ACK_ONLY" />
        ))}
      </IncidentSection>
    </div>
  );
}
