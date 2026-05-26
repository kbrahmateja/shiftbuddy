"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FilePlus, Activity, Calendar, ArrowLeftRight,
  RefreshCw, Users, BarChart3, ShieldCheck, FolderOpen, UserCog,
  Bell, LogOut, ChevronRight, Settings, ContactRound,
} from "lucide-react";
import { cn, getNavItemsForRole, getInitials, getAvatarColor, ROLE_CONFIG } from "@/lib/utils";
import { MOCK_PROJECTS } from "@/lib/mock-data";
import type { SessionUser } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─────────────────────────────────────────────
// Icon map (avoids dynamic import overhead)
// ─────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, FilePlus, Activity, Calendar, ArrowLeftRight,
  RefreshCw, Users, BarChart3, ShieldCheck, FolderOpen, UserCog, ContactRound,
};

// ─────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────

interface SidebarProps {
  user: SessionUser;
  notificationCount?: number;
  pendingHandovers?: number;
  pendingSwaps?: number;
}

// ─────────────────────────────────────────────
// SIDEBAR COMPONENT
// ─────────────────────────────────────────────

export function Sidebar({
  user,
  notificationCount = 0,
  pendingHandovers = 0,
  pendingSwaps = 0,
}: SidebarProps) {
  const pathname = usePathname();
  const navItems = getNavItemsForRole(user.role);
  const roleConfig = ROLE_CONFIG[user.role];

  // Attach live badge counts to specific nav items
  const badgeCounts: Record<string, number> = {
    "/dashboard/handovers": pendingHandovers,
    "/dashboard/swaps": pendingSwaps,
  };

  return (
    <TooltipProvider delayDuration={300}>
      <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
        {/* ── Logo & Brand ── */}
        <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
            <span className="text-xs font-bold text-white">SB</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">ShiftBuddy</p>
            <p className="truncate text-[11px] text-gray-500">GAPINC · HCL Ops</p>
          </div>
        </div>

        {/* ── Active Project Context ── */}
        {user.activeProjectId && (() => {
          const proj = MOCK_PROJECTS.find((p) => p.id === user.activeProjectId);
          return (
            <div className="px-3 pt-3">
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-indigo-400 mb-1">
                  Active Project
                </p>
                <p className="truncate text-xs font-bold text-indigo-800 leading-snug">
                  {proj?.name ?? user.activeProjectId}
                </p>
                {proj?.description && (
                  <p className="mt-0.5 truncate text-[10px] text-indigo-400 leading-snug">
                    {proj.description}
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = ICON_MAP[item.iconName] ?? LayoutDashboard;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const badgeCount = badgeCounts[item.href] ?? 0;

              return (
                <li key={item.href}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                          isActive
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 flex-shrink-0 transition-colors",
                            isActive ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-600"
                          )}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {badgeCount > 0 && (
                          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </span>
                        )}
                        {isActive && (
                          <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />
                        )}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>

          {/* ── Role-Specific Quick Actions ── */}
          {(user.role === "LEAD" || user.role === "MANAGER") && (
            <>
              <Separator className="my-3" />
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Quick Actions
              </p>
              {user.role === "LEAD" && (
                <Link
                  href="/dashboard/handovers/new"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 transition-all hover:bg-emerald-50"
                >
                  <ArrowLeftRight className="h-4 w-4 text-emerald-500" />
                  <span>Start Handover</span>
                </Link>
              )}
              {user.role === "MANAGER" && (
                <Link
                  href="/dashboard/roster"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-teal-700 transition-all hover:bg-teal-50"
                >
                  <Users className="h-4 w-4 text-teal-500" />
                  <span>Build Roster</span>
                </Link>
              )}
            </>
          )}
        </nav>

        {/* ── Bottom: User Profile ── */}
        <div className="border-t border-gray-200 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2">
            {/* Avatar */}
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: getAvatarColor(user.id) }}
            >
              {getInitials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-gray-900">{user.name}</p>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="secondary"
                  className={cn("h-4 px-1.5 text-[10px]", ROLE_CONFIG[user.role].badgeClass)}
                >
                  {roleConfig.label}
                </Badge>
                <span className="text-[10px] text-gray-400">{user.timezone}</span>
              </div>
            </div>
            {/* Notification bell */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/dashboard/notifications" className="relative">
                  <Bell className="h-4 w-4 text-gray-400 transition-colors hover:text-gray-700" />
                  {notificationCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {notificationCount > 0 ? `${notificationCount} unread` : "No new notifications"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Settings & Sign Out */}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start gap-2 text-xs text-gray-500 hover:text-gray-900"
              asChild
            >
              <Link href="/dashboard/settings">
                <Settings className="h-3.5 w-3.5" />
                Settings
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-xs text-gray-500 hover:text-red-600"
              asChild
            >
              <Link href="/auth/signout">
                <LogOut className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
