"use client";
// components/feed/FeedTabs.tsx
// ─────────────────────────────────────────────────────────────
// Tabbed wrapper for the feed: All Incidents | 🏖️ Holiday
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from "react";
import { Palmtree, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyUpdateLog, UserRole } from "@/types";
import { DailyLogsFeed } from "@/components/dashboard/DailyLogsFeed";
import { HolidayIncidentPanel } from "@/components/feed/HolidayIncidentPanel";
import { getActiveHolidayDateSet } from "@/lib/holiday-policy";

interface Props {
  logs: DailyUpdateLog[];
  userRole: UserRole;
}

export function FeedTabs({ logs, userRole }: Props) {
  const [activeTab, setActiveTab] = useState<"all" | "holiday">("all");
  const [holidayCount, setHolidayCount] = useState(0);

  // Count holiday incidents (client-side, re-checks when localStorage changes)
  useEffect(() => {
    const count = () => {
      const set = getActiveHolidayDateSet();
      return logs.filter((l) => set.has(new Date(l.occurredAt).toISOString().slice(0, 10))).length;
    };
    setHolidayCount(count());

    const onStorage = () => setHolidayCount(count());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [logs]);

  const tabs = [
    { id: "all" as const,     label: "All Incidents", icon: List,     badge: logs.length },
    { id: "holiday" as const, label: "Holiday",       icon: Palmtree, badge: holidayCount, highlight: holidayCount > 0 },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-gray-200 bg-white px-4 pt-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors",
                isActive
                  ? "border-indigo-500 text-indigo-700 bg-indigo-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", tab.highlight && !isActive ? "text-orange-500" : "")} />
              {tab.label}
              {tab.badge > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  isActive
                    ? "bg-indigo-100 text-indigo-700"
                    : tab.highlight
                    ? "bg-orange-100 text-orange-700"
                    : "bg-gray-100 text-gray-500"
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "all" ? (
          <DailyLogsFeed logs={logs} userRole={userRole} />
        ) : (
          <div className="h-full overflow-y-auto">
            <HolidayIncidentPanel logs={logs} userRole={userRole} />
          </div>
        )}
      </div>
    </div>
  );
}
