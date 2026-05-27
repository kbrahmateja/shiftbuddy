"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Clock, Globe, Menu } from "lucide-react";
import { cn, ROLE_CONFIG, TIMEZONE_LABELS, formatInTimezone } from "@/lib/utils";
import { useUserTimezone } from "@/lib/user-timezone";
import type { SessionUser } from "@/types";
import { Badge } from "@/components/ui/badge";
import { ClockButton } from "@/components/layout/ClockButton";

const PROJECT_SHORT: Record<string, string> = {
  proj_checkout:     "Checkout",
  proj_payment_core: "Payment Core",
  proj_browse:       "Browse + Profile",
  proj_buyui:        "Buy UI",
  proj_webapp:       "PT-WebApp",
  proj_dam:          "DAM",
  proj_marketing:    "PT-Marketing",
};

interface TopBarProps {
  user: SessionUser;
  onMenuClick?: () => void;
}

function buildBreadcrumb(pathname: string): { label: string; href: string }[] {
  const SEGMENT_LABELS: Record<string, string> = {
    dashboard:      "Dashboard",
    "log-update":   "Log Update",
    feed:           "Daily Feed",
    shifts:         "My Shifts",
    handovers:      "Handovers",
    swaps:          "Shift Swaps",
    roster:         "Roster Planner",
    analytics:      "Analytics",
    sla:            "SLA Tracker",
    projects:       "Projects",
    team:           "Team Management",
    settings:       "Settings",
    notifications:  "Notifications",
    coverage:       "PT Coverage",
    new:            "New",
    reports:        "Reports",
    report:         "Report",
    diary:          "Diary",
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

export function TopBar({ user, onMenuClick }: TopBarProps) {
  const pathname  = usePathname();
  const crumbs    = buildBreadcrumb(pathname);
  const lastCrumb = crumbs[crumbs.length - 1];

  const { timezone: effectiveTz, isManualOverride } = useUserTimezone(user.timezone);

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  function getCurrentShift(date: Date) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: effectiveTz,
      hour: "numeric", minute: "numeric", hour12: false,
    }).formatToParts(date);
    const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
    const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
    const t = h * 60 + m;
    if (t >= 330 && t < 810)  return { num: "S1", label: "Morning",   bg: "bg-amber-50",  text: "text-amber-700"  };
    if (t >= 810 && t < 1290) return { num: "S2", label: "Afternoon", bg: "bg-sky-50",    text: "text-sky-700"    };
    return                           { num: "S3", label: "Night",     bg: "bg-indigo-50", text: "text-indigo-700" };
  }

  const currentShift = now ? getCurrentShift(now) : null;
  const tzLabel = TIMEZONE_LABELS[effectiveTz] ?? effectiveTz.split("/").pop()?.replace(/_/g, " ") ?? effectiveTz;
  const localTime = now ? formatInTimezone(now, effectiveTz, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) : "--:--:-- --";
  const pstTime   = now ? formatInTimezone(now, "America/Los_Angeles", { hour: "2-digit", minute: "2-digit", hour12: true }) : "--:-- --";
  const showPst   = effectiveTz !== "America/Los_Angeles";

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3 sm:px-6 gap-2">

      {/* Left: hamburger (mobile) + breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden flex-shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb — full on md+, only last segment on mobile */}
        <nav className="flex items-center gap-1 text-sm min-w-0">
          {/* Mobile: only show current page name */}
          <span className="font-medium text-gray-900 truncate sm:hidden">
            {lastCrumb?.label ?? "Dashboard"}
          </span>

          {/* sm+: full breadcrumb */}
          <div className="hidden sm:flex items-center gap-1">
            {crumbs.map((crumb, idx) => (
              <span key={crumb.href} className="flex items-center gap-1">
                {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />}
                {idx === crumbs.length - 1 ? (
                  <span className="font-medium text-gray-900 truncate max-w-[160px]">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="text-gray-500 transition-colors hover:text-gray-900 truncate max-w-[120px]">
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </div>
        </nav>
      </div>

      {/* Right: clock-in + clocks + shift + role */}
      <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">

        {/* Clock In/Out — CONTRACTOR / EMPLOYEE only */}
        {(user.role === "CONTRACTOR" || user.role === "EMPLOYEE") && (
          <ClockButton user={user} />
        )}

        {/* Live clock — hidden on very small screens */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs">
          <Clock className="h-3.5 w-3.5 text-gray-400" />
          <span className="font-mono font-medium text-gray-700">{localTime}</span>
          <span className="hidden md:inline text-gray-400">{tzLabel}</span>
          {isManualOverride && (
            <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600">custom</span>
          )}
        </div>

        {/* Shift indicator — md+ */}
        {currentShift && (
          <div className={cn(
            "hidden md:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium",
            currentShift.bg, currentShift.text
          )}>
            <span className="font-bold">{currentShift.num}</span>
            <span className="hidden lg:inline">{currentShift.label}</span>
          </div>
        )}

        {/* PST reference — lg+ */}
        {showPst && (
          <div className="hidden lg:flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs">
            <Globe className="h-3.5 w-3.5 text-indigo-400" />
            <span className="font-mono font-medium text-indigo-700">{pstTime}</span>
            <span className="text-indigo-400">PST</span>
          </div>
        )}

        {/* Role badge — always visible */}
        <Badge
          variant="secondary"
          className={cn("text-xs flex-shrink-0", ROLE_CONFIG[user.role].badgeClass)}
        >
          <span className="hidden sm:inline">{ROLE_CONFIG[user.role].label}</span>
          <span className="sm:hidden">{ROLE_CONFIG[user.role].label.slice(0, 3)}</span>
          {user.activeProjectId && (
            <span className="hidden lg:inline opacity-70 font-normal ml-1">
              ({PROJECT_SHORT[user.activeProjectId] ?? user.activeProjectId})
            </span>
          )}
        </Badge>
      </div>
    </header>
  );
}
