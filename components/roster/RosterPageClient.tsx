"use client";
// components/roster/RosterPageClient.tsx
// ─────────────────────────────────────────────────────────────
// Top-level client wrapper for the Roster page.
// Renders three tabs:
//   Calendar  — existing ShiftRosterGrid (read-only weekly view)
//   Manage    — ShiftCalendarManager (add/edit/remove, LEAD/MANAGER)
//   Live      — LiveShiftMonitor (real-time cards, LEAD/MANAGER)
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  CalendarDays, LayoutGrid, Activity, Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Shift, User, SessionUser } from "@/types";
import { MOCK_SHIFTS } from "@/lib/mock-data";
import { ProjectRosterTabs }   from "@/components/roster/ProjectRosterTabs";
import { ShiftCalendarManager } from "@/components/roster/ShiftCalendarManager";
import { LiveShiftMonitor }    from "@/components/roster/LiveShiftMonitor";
import { PageShell } from "@/components/layout/PageShell";

// ── Types ─────────────────────────────────────────────────────────────────

type Tab = "calendar" | "manage" | "live";

interface RosterPageClientProps {
  shifts:      (Shift & { assignedTo: User })[];
  currentUser: SessionUser;
  canEdit:     boolean;
}

// ── Tabs config ───────────────────────────────────────────────────────────

const ALL_TABS: {
  id:      Tab;
  label:   string;
  Icon:    React.ComponentType<{ className?: string }>;
  managerOnly: boolean;
  description: string;
}[] = [
  {
    id:          "calendar",
    label:       "Calendar",
    Icon:        CalendarDays,
    managerOnly: false,
    description: "Weekly roster view across all projects",
  },
  {
    id:          "manage",
    label:       "Manage Shifts",
    Icon:        LayoutGrid,
    managerOnly: true,
    description: "Add, edit, or remove team members from shifts — single or bulk",
  },
  {
    id:          "live",
    label:       "Live Shifts",
    Icon:        Wifi,
    managerOnly: true,
    description: "Real-time view of who's on shift and their latest activity",
  },
];

// ── Component ─────────────────────────────────────────────────────────────

export function RosterPageClient({ shifts, currentUser, canEdit }: RosterPageClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("calendar");

  const visibleTabs = ALL_TABS.filter(
    (t) => !t.managerOnly || canEdit
  );

  const activeTabMeta = visibleTabs.find((t) => t.id === activeTab) ?? visibleTabs[0];

  // Count active shifts for live tab badge
  const activeShiftCount = MOCK_SHIFTS.filter((s) => s.status === "ACTIVE").length;

  const liveIndicator = activeShiftCount > 0 ? (
    <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {activeShiftCount} shift{activeShiftCount !== 1 ? "s" : ""} active now
    </div>
  ) : undefined;

  const tabBar = (
    <div className="flex gap-0 border-b border-gray-200 -mb-4">
      {visibleTabs.map((tab) => {
        const Icon    = tab.Icon;
        const isLive  = tab.id === "live";
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              isActive
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            <Icon className={cn("h-4 w-4", isActive ? "text-indigo-600" : "text-gray-400")} />
            {tab.label}
            {isLive && activeShiftCount > 0 && (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                isActive
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-emerald-100 text-emerald-700"
              )}>
                {activeShiftCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <PageShell
      title="Roster Planner"
      subtitle={activeTabMeta.description}
      actions={liveIndicator}
      headerExtra={tabBar}
      maxWidth="max-w-full"
    >
      {/* ── Tab content ── */}
      <div className={cn(
        "flex-1 overflow-auto",
        activeTab === "manage" ? "overflow-hidden flex flex-col" : ""
      )}>

        {/* Calendar tab */}
        {activeTab === "calendar" && (
          <div className="pt-4">
            <ProjectRosterTabs shifts={shifts} canEdit={false} />
          </div>
        )}

        {/* Manage tab — full-height calendar manager */}
        {activeTab === "manage" && canEdit && (
          <div className="flex-1 overflow-hidden flex flex-col pt-4">
            <ShiftCalendarManager shifts={shifts} currentUser={currentUser} />
          </div>
        )}

        {/* Live tab */}
        {activeTab === "live" && canEdit && (
          <div className="pt-4">
            <LiveShiftMonitor currentUser={currentUser} />
          </div>
        )}

        {/* Fallback: non-managers who somehow land on manage/live */}
        {(activeTab === "manage" || activeTab === "live") && !canEdit && (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Activity className="h-10 w-10 opacity-20 mb-2" />
            <p className="text-sm font-medium">Access restricted</p>
            <p className="text-xs mt-1">Only leads and managers can access this view.</p>
          </div>
        )}
      </div>
    </PageShell>
  );
}
