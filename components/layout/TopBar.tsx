"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Clock, Globe } from "lucide-react";
import { cn, ROLE_CONFIG, TIMEZONE_LABELS, formatInTimezone } from "@/lib/utils";
import { useUserTimezone } from "@/lib/user-timezone";

const PROJECT_SHORT: Record<string, string> = {
  proj_checkout:     "Checkout",
  proj_payment_core: "Payment Core",
  proj_browse:       "Browse + Profile",
  proj_buyui:        "Buy UI",
  proj_webapp:       "PT-WebApp",
  proj_dam:          "DAM",
  proj_marketing:    "PT-Marketing",
};
import type { SessionUser } from "@/types";
import { Badge } from "@/components/ui/badge";
import { ClockButton } from "@/components/layout/ClockButton";

interface TopBarProps {
  user: SessionUser;
}

/** Builds a breadcrumb array from the current pathname */
function buildBreadcrumb(pathname: string): { label: string; href: string }[] {
  const SEGMENT_LABELS: Record<string, string> = {
    dashboard: "Dashboard",
    "log-update": "Log Update",
    feed: "Daily Feed",
    shifts: "My Shifts",
    handovers: "Handovers",
    swaps: "Shift Swaps",
    roster: "Roster Planner",
    analytics: "Analytics",
    sla: "SLA Tracker",
    projects: "Projects",
    team: "Team Management",
    settings: "Settings",
    notifications: "Notifications",
    coverage: "PT Coverage",
    new: "New",
  };

  const parts = pathname.replace(/^\//, "").split("/");
  return parts.reduce(
    (acc, segment, idx) => {
      const href = "/" + parts.slice(0, idx + 1).join("/");
      const label = SEGMENT_LABELS[segment] ?? segment;
      return [...acc, { label, href }];
    },
    [] as { label: string; href: string }[]
  );
}

export function TopBar({ user }: TopBarProps) {
  const pathname = usePathname();
  const breadcrumb = buildBreadcrumb(pathname);

  // Auto-detect browser timezone; respect any saved override from Settings
  const { timezone: effectiveTz, isManualOverride } = useUserTimezone(user.timezone);

  // Live clock — null until mounted to avoid hydration mismatch
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /** Returns which shift is active right now based on the user's effective timezone */
  function getCurrentShift(date: Date): { label: string; num: string; bg: string; text: string } {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: effectiveTz,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(date);
    const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
    const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
    const t = h * 60 + m;
    if (t >= 330 && t < 810)  return { num: "S1", label: "Morning",   bg: "bg-amber-50",  text: "text-amber-700"  }; // 05:30–13:30
    if (t >= 810 && t < 1290) return { num: "S2", label: "Afternoon", bg: "bg-sky-50",    text: "text-sky-700"    }; // 13:30–21:30
    return                           { num: "S3", label: "Night",     bg: "bg-indigo-50", text: "text-indigo-700" }; // 21:30–05:30
  }

  const currentShift = now ? getCurrentShift(now) : null;

  // Short label for the clock pill — prefer known label, else trim IANA to city name
  const tzLabel =
    TIMEZONE_LABELS[effectiveTz] ??
    effectiveTz.split("/").pop()?.replace(/_/g, " ") ??
    effectiveTz;

  const localTime = now
    ? formatInTimezone(now, effectiveTz, {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
      })
    : "--:--:-- --";

  const pstTime = now
    ? formatInTimezone(now, "America/Los_Angeles", {
        hour: "2-digit", minute: "2-digit", hour12: true,
      })
    : "--:-- --";

  const showPst = effectiveTz !== "America/Los_Angeles";

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm">
        {breadcrumb.map((crumb, idx) => (
          <span key={crumb.href} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
            {idx === breadcrumb.length - 1 ? (
              <span className="font-medium text-gray-900">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-gray-500 transition-colors hover:text-gray-900"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Right side: clock-in button + clocks + role badge */}
      <div className="flex items-center gap-4">
        {/* Clock In/Out — only for CONTRACTOR and EMPLOYEE */}
        {(user.role === "CONTRACTOR" || user.role === "EMPLOYEE") && (
          <ClockButton user={user} />
        )}

        {/* Live clock — auto-detected or saved timezone */}
        <div className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
          <Clock className="h-3.5 w-3.5 text-gray-400" />
          <span className="font-mono font-medium text-gray-700">{localTime}</span>
          <span className="text-gray-400">{tzLabel}</span>
          {isManualOverride && (
            <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600">
              custom
            </span>
          )}
        </div>

        {/* Current shift indicator */}
        {currentShift && (
          <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${currentShift.bg} ${currentShift.text}`}>
            <span className="font-bold">{currentShift.num}</span>
            <span>{currentShift.label}</span>
          </div>
        )}

        {/* PST reference — GAP client timezone anchor */}
        {showPst && (
          <div className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs">
            <Globe className="h-3.5 w-3.5 text-indigo-400" />
            <span className="font-mono font-medium text-indigo-700">{pstTime}</span>
            <span className="text-indigo-400">PST</span>
          </div>
        )}

        {/* Role badge */}
        <Badge
          variant="secondary"
          className={cn("text-xs", ROLE_CONFIG[user.role].badgeClass)}
        >
          {ROLE_CONFIG[user.role].label}
          {user.activeProjectId && (
            <span className="opacity-70 font-normal ml-1">
              ({PROJECT_SHORT[user.activeProjectId] ?? user.activeProjectId})
            </span>
          )}
        </Badge>
      </div>
    </header>
  );
}
