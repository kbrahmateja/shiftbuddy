"use client";

import { useState } from "react";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import {
  ANALYTICS_PERIODS,
  YEARLY_HISTORY,
  QUARTERLY_HISTORY,
  MONTHLY_HISTORY,
  PERIOD_ORDER,
  exportAnalyticsCSV,
  type PeriodKey,
  type AnalyticsPeriodData,
} from "@/lib/period-data";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  daily:         "Daily",
  weekly:        "Weekly",
  monthly:       "Monthly",
  quarterly:     "Quarterly",
  "half-yearly": "Half-Yearly",
  yearly:        "Yearly",
};

/** Returns the history array + initial index (latest) for navigable periods */
function getHistory(period: PeriodKey): AnalyticsPeriodData[] | null {
  if (period === "yearly")    return YEARLY_HISTORY;
  if (period === "quarterly") return QUARTERLY_HISTORY;
  if (period === "monthly")   return MONTHLY_HISTORY;
  return null;
}

export function AnalyticsDashboard() {
  const [period, setPeriod] = useState<PeriodKey>("weekly");

  // Per-history-period: track which index is selected (default = latest)
  const [yearIdx,    setYearIdx]    = useState(YEARLY_HISTORY.length - 1);
  const [quarterIdx, setQuarterIdx] = useState(QUARTERLY_HISTORY.length - 1);
  const [monthIdx,   setMonthIdx]   = useState(MONTHLY_HISTORY.length - 1);

  function getIdx()    { return period === "yearly" ? yearIdx : period === "quarterly" ? quarterIdx : monthIdx; }
  function setIdx(i: number) {
    if (period === "yearly")    setYearIdx(i);
    else if (period === "quarterly") setQuarterIdx(i);
    else setMonthIdx(i);
  }

  const history = getHistory(period);
  const data: AnalyticsPeriodData = history
    ? history[getIdx()]
    : ANALYTICS_PERIODS[period];

  const canPrev = history ? getIdx() > 0 : false;
  const canNext = history ? getIdx() < history.length - 1 : false;

  const kpis = [
    { label: "Total Logs",      value: data.totalLogs.toLocaleString(),  color: "text-indigo-600" },
    { label: "Resolved",        value: data.resolved.toLocaleString(),    color: "text-emerald-600" },
    { label: "Resolution Rate", value: `${data.resolutionRate}%`,         color: data.resolutionRate >= 90 ? "text-emerald-600" : "text-orange-500" },
    { label: "SLA Compliance",  value: `${data.slaCompliance}%`,          color: data.slaCompliance  >= 90 ? "text-emerald-600" : "text-orange-500" },
    { label: "P1 Critical",     value: data.p1Count.toString(),           color: data.p1Count > 0 ? "text-red-600" : "text-gray-500" },
    { label: "P2 High",         value: data.p2Count.toString(),           color: "text-orange-500" },
    { label: "Avg Resolution",  value: `${data.avgResolutionH}h`,         color: "text-indigo-600" },
    { label: "Handover Ack",    value: `${data.handoverAckRate}%`,        color: data.handoverAckRate >= 90 ? "text-emerald-600" : "text-orange-500" },
  ];

  const sourceMax = Math.max(...data.bySource.map((s) => s.count), 1);
  const sevMax    = Math.max(...data.bySeverity.map((s) => s.count), 1);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {data.label} · {data.dateRange}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex rounded-lg border bg-white overflow-hidden text-xs font-medium">
            {PERIOD_ORDER.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 transition-colors border-r last:border-r-0 ${
                  period === p ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Export */}
          <button
            onClick={() => exportAnalyticsCSV(data)}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Period navigation — shown for monthly / quarterly / yearly */}
      {history && (
        <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-2.5">
          <button
            onClick={() => setIdx(getIdx() - 1)}
            disabled={!canPrev}
            className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {canPrev ? history[getIdx() - 1].label : "Earlier"}
          </button>

          {/* Period dots */}
          <div className="flex items-center gap-1.5">
            {history.map((h, i) => (
              <button
                key={h.label}
                onClick={() => setIdx(i)}
                title={h.label}
                className={`h-2 rounded-full transition-all ${
                  i === getIdx()
                    ? "w-6 bg-indigo-600"
                    : "w-2 bg-gray-200 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => setIdx(getIdx() + 1)}
            disabled={!canNext}
            className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {canNext ? history[getIdx() + 1].label : "Latest"}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border bg-white p-4">
            <p className="text-xs font-medium text-gray-500">{kpi.label}</p>
            <p className={`mt-1.5 text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Shifts + Handovers strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Shifts Completed",  value: data.shiftsCompleted.toLocaleString() },
          { label: "Shifts On-Time",    value: `${data.shiftsOnTime}%` },
          { label: "Handovers",         value: data.handoversTotal.toLocaleString() },
          { label: "Handover Ack Rate", value: `${data.handoverAckRate}%` },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border bg-emerald-50 border-emerald-100 p-3 text-center">
            <p className="text-xl font-bold text-emerald-700">{item.value}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* By Source */}
        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Logs by Source</h2>
          <div className="space-y-3">
            {data.bySource.map(({ source, count }) => (
              <div key={source}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{source}</span>
                  <span className="font-medium">
                    {count.toLocaleString()} ({Math.round((count / data.totalLogs) * 100)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${Math.round((count / sourceMax) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By Severity */}
        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Logs by Severity</h2>
          <div className="space-y-3">
            {data.bySeverity.map(({ label, count, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{label}</span>
                  <span className="font-medium">
                    {count.toLocaleString()} ({Math.round((count / data.totalLogs) * 100)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: `${Math.round((count / sevMax) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Project breakdown table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b">
          <h2 className="text-sm font-semibold text-gray-700">Project Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Project</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Total</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Resolved</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">SLA Rate</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.byProject.map((proj) => (
                <tr key={proj.code} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <span className="text-[10px] font-bold text-gray-400 mr-2">{proj.code}</span>
                    <span className="text-gray-700">{proj.project}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-700">{proj.count.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">{proj.resolved.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold ${proj.slaRate >= 95 ? "text-emerald-600" : proj.slaRate >= 90 ? "text-orange-500" : "text-red-500"}`}>
                      {proj.slaRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 w-32">
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${proj.slaRate}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        {data.dateRange} · SLA target 90% · Connect PostgreSQL for live data
      </p>
    </div>
  );
}
