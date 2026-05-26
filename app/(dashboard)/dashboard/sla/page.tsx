"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import {
  SLA_PERIODS,
  PERIOD_ORDER,
  exportSlaCSV,
  type PeriodKey,
  type SlaPriorityTier,
} from "@/lib/period-data";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  daily:         "Daily",
  weekly:        "Weekly",
  monthly:       "Monthly",
  quarterly:     "Quarterly",
  "half-yearly": "Half-Yearly",
  yearly:        "Yearly",
};

function SlaBar({ value, target = 90 }: { value: number; target?: number }) {
  const passing = value >= target;
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>0%</span>
        <span className="text-gray-500">target {target}%</span>
        <span>100%</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="absolute top-0 h-full w-0.5 bg-gray-400 z-10"
          style={{ left: `${target}%` }}
        />
        <div
          className={`h-full rounded-full transition-all ${passing ? "bg-emerald-500" : "bg-red-400"}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function StatPill({ label, value, passing = true }: { label: string; value: string; passing?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 text-center ${passing ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}>
      <p className={`text-lg font-bold ${passing ? "text-emerald-700" : "text-red-600"}`}>{value}</p>
      <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

function TierCard({ tier }: { tier: SlaPriorityTier }) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
      <div className={`${tier.headerClass} px-4 py-2.5 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">{tier.priority}</span>
          <span className="text-sm text-white/80">— {tier.label}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/90">
          <span>{tier.openCount} open</span>
          <span>·</span>
          <span>{tier.totalCount.toLocaleString()} total</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-4 gap-2">
          <StatPill label="Ack SLA"     value={`${tier.ackRate}%`}     />
          <StatPill label="Resolve SLA" value={`${tier.resolveRate}%`} />
          <StatPill label="Avg Ack"     value={`${tier.avgAckMin}m`}   />
          <StatPill label="Avg Resolve" value={`${tier.avgResolveH}h`} />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="font-medium text-gray-600">Acknowledgement SLA</span>
            <span className="text-gray-400">target {tier.ackTarget}</span>
          </div>
          <SlaBar value={tier.ackRate} target={90} />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="font-medium text-gray-600">Resolution SLA</span>
            <span className="text-gray-400">target {tier.resolveTarget}</span>
          </div>
          <SlaBar value={tier.resolveRate} target={85} />
        </div>

        <div className="flex items-center justify-end gap-1.5 text-xs">
          <span className={tier.trendUp ? "text-emerald-600" : "text-red-500"}>
            {tier.trendUp ? "↑" : "↓"}
          </span>
          <span className="text-gray-400">{tier.trend}</span>
        </div>
      </div>
    </div>
  );
}

export default function SlaPage() {
  const [period, setPeriod] = useState<PeriodKey>("weekly");
  const data = SLA_PERIODS[period];
  const { overall, tiers } = data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">SLA Compliance</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {data.label} · {data.dateRange} · Gap Digital Experience and Commerce — All Projects
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
                  period === p
                    ? "bg-indigo-600 text-white"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Export */}
          <button
            onClick={() => exportSlaCSV(data)}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>

          {/* Overall SLA badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Overall SLA — {overall.overallSla}% Compliant
          </span>
        </div>
      </div>

      {/* Overall KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Overall SLA"     value={`${overall.overallSla}%`}      sub="target 90%"             green />
        <KpiCard label="Handover Ack SLA" value={`${overall.handoverAck}%`}    sub="target 95%"             green />
        <KpiCard label="Avg Resolution"  value={`${overall.avgResolutionH}h`}  sub="across all priorities"  green />
        <KpiCard label="Shifts On-Time"  value={`${overall.shiftsOnTime}%`}    sub={data.label.toLowerCase()} green />
      </div>

      {/* Priority tier cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {tiers.map((tier) => <TierCard key={tier.priority} tier={tier} />)}
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DetailCard
          title="Handover Acknowledgement"
          value={`${overall.handoverAck}%`}
          sub={`${Math.round(overall.handoverAck / 100 * (period === "daily" ? 3 : period === "weekly" ? 20 : period === "monthly" ? 68 : period === "quarterly" ? 196 : period === "half-yearly" ? 398 : 796))} / ${period === "daily" ? 3 : period === "weekly" ? 20 : period === "monthly" ? 68 : period === "quarterly" ? 196 : period === "half-yearly" ? 398 : 796} handovers acked within SLA window`}
          note="SLA window: 30 min from submission"
          green
        />
        <DetailCard
          title="P1 Mean Time to Ack"
          value={`${tiers[0].avgAckMin} min`}
          sub={`Well within 15-min SLA target`}
          note={`Ack SLA: ${tiers[0].ackRate}% · Resolve SLA: ${tiers[0].resolveRate}%`}
          green
        />
        <DetailCard
          title="P2 Mean Time to Resolve"
          value={`${tiers[1].avgResolveH} h`}
          sub={`Target ≤ 8h — ${Math.round((1 - tiers[1].avgResolveH / 8) * 100)}% faster than target`}
          note={`Ack SLA: ${tiers[1].ackRate}% · Resolve SLA: ${tiers[1].resolveRate}%`}
          green
        />
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, green }: { label: string; value: string; sub: string; green?: boolean }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${green ? "text-emerald-600" : "text-red-600"}`}>{value}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function DetailCard({ title, value, sub, note, green }: {
  title: string; value: string; sub: string; note: string; green?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${green ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
      <p className="text-xs font-semibold text-gray-600">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${green ? "text-emerald-700" : "text-red-600"}`}>{value}</p>
      <p className="text-xs text-gray-600 mt-1">{sub}</p>
      <p className="text-[10px] text-gray-400 mt-2 border-t border-gray-200 pt-2">{note}</p>
    </div>
  );
}
