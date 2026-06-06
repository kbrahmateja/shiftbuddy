"use client";
// components/settings/HolidayPolicySettings.tsx
// ─────────────────────────────────────────────────────────────
// Per-project holiday response policy configuration.
// Managers can set which severity levels require full response
// vs ack-only on holiday dates.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { Settings2, ChevronDown, ChevronUp, Zap, BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  loadHolidayPolicy, saveHolidayPolicy, getProjectPolicy,
  ALL_SEVERITIES, SEVERITY_LABELS, DEFAULT_RESPONSE_SEVERITIES,
  type HolidayPolicyStore, type ProjectHolidayPolicy,
} from "@/lib/holiday-policy";
import { MOCK_PROJECTS } from "@/lib/mock-data";
import type { Severity, UserRole } from "@/types";
import { cn } from "@/lib/utils";

const SEVERITY_COLORS: Record<Severity, { chip: string; dot: string }> = {
  P1_CRITICAL:   { chip: "bg-red-100 text-red-700 border-red-200",    dot: "bg-red-500"    },
  P2_HIGH:       { chip: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  P3_MEDIUM:     { chip: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-500" },
  P4_LOW:        { chip: "bg-blue-100 text-blue-700 border-blue-200",  dot: "bg-blue-400"   },
  INFORMATIONAL: { chip: "bg-gray-100 text-gray-500 border-gray-200",  dot: "bg-gray-300"   },
};

interface ProjectPolicyRowProps {
  projectId: string;
  projectName: string;
  policy: ProjectHolidayPolicy;
  isManager: boolean;
  onChange: (projectId: string, severities: Severity[]) => void;
}

function ProjectPolicyRow({ projectId, projectName, policy, isManager, onChange }: ProjectPolicyRowProps) {
  const [expanded, setExpanded] = useState(false);

  const toggleSeverity = (sev: Severity) => {
    const current = policy.responseSeverities;
    const next = current.includes(sev)
      ? current.filter((s) => s !== sev)
      : [...current, sev];
    onChange(projectId, next);
  };

  const isModified =
    JSON.stringify([...policy.responseSeverities].sort()) !==
    JSON.stringify([...DEFAULT_RESPONSE_SEVERITIES].sort());

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-800 truncate">{projectName}</span>
          {isModified && (
            <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">Custom</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-[11px] text-gray-400">
            {policy.responseSeverities.length} require response
          </span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-3 space-y-3 bg-white">
          <p className="text-xs text-gray-500">
            On holiday dates, which severity levels require <strong>full active response</strong>?
            Others will be <strong>ack-only</strong> mode.
          </p>

          <div className="space-y-1.5">
            {ALL_SEVERITIES.map((sev) => {
              const isResponse = policy.responseSeverities.includes(sev);
              const colors = SEVERITY_COLORS[sev];
              return (
                <div
                  key={sev}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 transition-all",
                    isResponse ? "border-red-200 bg-red-50" : "border-gray-100 bg-gray-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", colors.dot)} />
                    <span className="text-xs font-medium text-gray-700">{SEVERITY_LABELS[sev]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      isResponse
                        ? "bg-red-100 border-red-200 text-red-700"
                        : "bg-yellow-50 border-yellow-200 text-yellow-700"
                    )}>
                      {isResponse
                        ? <><Zap className="h-2.5 w-2.5" /> Respond</>
                        : <><BellOff className="h-2.5 w-2.5" /> Ack only</>
                      }
                    </span>
                    {isManager && (
                      <Switch
                        checked={isResponse}
                        onCheckedChange={() => toggleSeverity(sev)}
                        className={isResponse ? "bg-red-500" : undefined}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {isManager && isModified && (
            <button
              onClick={() => onChange(projectId, DEFAULT_RESPONSE_SEVERITIES)}
              className="text-[11px] text-indigo-600 hover:underline"
            >
              Reset to default (P1/P2 respond)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

interface Props {
  userRole: UserRole;
}

export function HolidayPolicySettings({ userRole }: Props) {
  const isManager = userRole === "MANAGER";
  const [policyStore, setPolicyStore] = useState<HolidayPolicyStore>({});

  useEffect(() => {
    setPolicyStore(loadHolidayPolicy());
  }, []);

  const handleChange = (projectId: string, severities: Severity[]) => {
    const next = {
      ...policyStore,
      [projectId]: { projectId, responseSeverities: severities },
    };
    setPolicyStore(next);
    saveHolidayPolicy(next);
  };

  return (
    <section className="rounded-lg border bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Settings2 className="h-4 w-4 text-gray-400" />
            Holiday Response Policy
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Configure which P-levels require full response vs ack-only on holiday dates — per project.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2 py-0.5 font-semibold text-red-700">
            <Zap className="h-2.5 w-2.5" /> Respond
          </span>
          <span className="flex items-center gap-1 rounded-full bg-yellow-50 border border-yellow-200 px-2 py-0.5 font-semibold text-yellow-700">
            <BellOff className="h-2.5 w-2.5" /> Ack only
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {MOCK_PROJECTS.map((project) => (
          <ProjectPolicyRow
            key={project.id}
            projectId={project.id}
            projectName={project.name}
            policy={getProjectPolicy(policyStore, project.id)}
            isManager={isManager}
            onChange={handleChange}
          />
        ))}
      </div>

      {!isManager && (
        <p className="text-[11px] text-gray-400 text-center">
          Only Managers can modify the holiday response policy
        </p>
      )}
    </section>
  );
}
