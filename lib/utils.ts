// ============================================================
// ShiftBuddy — Utility Library
// Timezone helpers, badge configs, formatting, RBAC helpers
// ============================================================

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  type Source,
  type Severity,
  type UserRole,
  type ShiftPattern,
  type LogStatus,
  type HandoverStatus,
  type SwapStatus,
  type SourceConfig,
  type SeverityConfig,
  type RoleConfig,
} from "@/types";

// ─────────────────────────────────────────────
// TAILWIND MERGE HELPER
// ─────────────────────────────────────────────

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ─────────────────────────────────────────────
// SOURCE CONFIGURATION MAP
// ─────────────────────────────────────────────

export const SOURCE_CONFIG: Record<Source, SourceConfig> = {
  PAGERDUTY: {
    label: "PagerDuty",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-200",
    iconName: "Bell",
    borderClass: "border-l-purple-500",
    dotClass: "bg-purple-500",
  },
  SERVICENOW: {
    label: "ServiceNow",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    iconName: "Ticket",
    borderClass: "border-l-emerald-500",
    dotClass: "bg-emerald-500",
  },
  SLACK: {
    label: "Slack",
    badgeClass: "bg-sky-100 text-sky-800 border-sky-200",
    iconName: "Hash",
    borderClass: "border-l-sky-500",
    dotClass: "bg-sky-500",
  },
  TEAMS: {
    label: "MS Teams",
    badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
    iconName: "Video",
    borderClass: "border-l-indigo-500",
    dotClass: "bg-indigo-500",
  },
  VERBAL: {
    label: "Word of Mouth",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    iconName: "MessageCircle",
    borderClass: "border-l-amber-500",
    dotClass: "bg-amber-500",
  },
  OTHER: {
    label: "Other",
    badgeClass: "bg-gray-100 text-gray-700 border-gray-200",
    iconName: "MoreHorizontal",
    borderClass: "border-l-gray-400",
    dotClass: "bg-gray-400",
  },
};

// ─────────────────────────────────────────────
// SEVERITY CONFIGURATION MAP
// ─────────────────────────────────────────────

export const SEVERITY_CONFIG: Record<Severity, SeverityConfig> = {
  P1_CRITICAL: {
    label: "P1 — Critical",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    iconName: "AlertOctagon",
    sortOrder: 1,
  },
  P2_HIGH: {
    label: "P2 — High",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-200",
    iconName: "AlertTriangle",
    sortOrder: 2,
  },
  P3_MEDIUM: {
    label: "P3 — Medium",
    badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-200",
    iconName: "AlertCircle",
    sortOrder: 3,
  },
  P4_LOW: {
    label: "P4 — Low",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
    iconName: "Info",
    sortOrder: 4,
  },
  INFORMATIONAL: {
    label: "Info",
    badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
    iconName: "FileText",
    sortOrder: 5,
  },
};

// ─────────────────────────────────────────────
// ROLE CONFIGURATION MAP
// ─────────────────────────────────────────────

export const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  CONTRACTOR: {
    label: "Contractor",
    description: "HCL Vendor Contractor",
    badgeClass: "bg-slate-100 text-slate-700",
    canLogUpdates: true,
    canApproveSwaps: false,
    canInitiateHandover: false,
    canAcknowledgeHandover: false,
    canManageRoster: false,
    canViewAnalytics: false,
    canExportReports: false,
    canManageUsers: false,
  },
  EMPLOYEE: {
    label: "FTE",
    description: "HCL Full-Time Employee",
    badgeClass: "bg-blue-100 text-blue-700",
    canLogUpdates: true,
    canApproveSwaps: false,
    canInitiateHandover: false,
    canAcknowledgeHandover: false,
    canManageRoster: false,
    canViewAnalytics: false,
    canExportReports: false,
    canManageUsers: false,
  },
  LEAD: {
    label: "Shift Lead",
    description: "HCL Shift / Technical Lead",
    badgeClass: "bg-violet-100 text-violet-700",
    canLogUpdates: true,
    canApproveSwaps: true,
    canInitiateHandover: true,
    canAcknowledgeHandover: true,
    canManageRoster: false,
    canViewAnalytics: true,
    canExportReports: true,
    canManageUsers: false,
  },
  MANAGER: {
    label: "Manager",
    description: "HCL Delivery / Ops Manager",
    badgeClass: "bg-teal-100 text-teal-700",
    canLogUpdates: true,
    canApproveSwaps: true,
    canInitiateHandover: true,
    canAcknowledgeHandover: true,
    canManageRoster: true,
    canViewAnalytics: true,
    canExportReports: true,
    canManageUsers: true,
  },
  GAP_STAKEHOLDER: {
    label: "Corp",
    description: "Corp Client Stakeholder",
    badgeClass: "bg-rose-100 text-rose-700",
    canLogUpdates: false,
    canApproveSwaps: false,
    canInitiateHandover: false,
    canAcknowledgeHandover: false,
    canManageRoster: false,
    canViewAnalytics: true,
    canExportReports: true,
    canManageUsers: false,
  },
};

// ─────────────────────────────────────────────
// LOG STATUS CONFIG
// ─────────────────────────────────────────────

export const LOG_STATUS_CONFIG: Record<
  LogStatus,
  { label: string; badgeClass: string }
> = {
  OPEN: { label: "Open", badgeClass: "bg-red-50 text-red-700 border-red-200" },
  IN_PROGRESS: { label: "In Progress", badgeClass: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  RESOLVED: { label: "Resolved", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" },
  VALIDATED: { label: "Validated", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CLOSED: { label: "Closed", badgeClass: "bg-gray-50 text-gray-600 border-gray-200" },
  ESCALATED: { label: "Escalated", badgeClass: "bg-purple-50 text-purple-700 border-purple-200" },
};

export const HANDOVER_STATUS_CONFIG: Record<
  HandoverStatus,
  { label: string; badgeClass: string }
> = {
  DRAFT: { label: "Draft", badgeClass: "bg-gray-100 text-gray-600" },
  SUBMITTED: { label: "Submitted", badgeClass: "bg-amber-100 text-amber-700" },
  ACKNOWLEDGED: { label: "Acknowledged", badgeClass: "bg-emerald-100 text-emerald-700" },
  DISPUTED: { label: "Disputed", badgeClass: "bg-red-100 text-red-700" },
};

export const SWAP_STATUS_CONFIG: Record<
  SwapStatus,
  { label: string; badgeClass: string }
> = {
  PENDING: { label: "Pending", badgeClass: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "Approved", badgeClass: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Rejected", badgeClass: "bg-red-100 text-red-700" },
  CANCELLED: { label: "Cancelled", badgeClass: "bg-gray-100 text-gray-600" },
};

export const SHIFT_PATTERN_LABELS: Record<ShiftPattern, string> = {
  GENERAL: "General (9–5)",
  MORNING: "Morning (6 AM–2 PM)",
  AFTERNOON: "Afternoon (2–10 PM)",
  NIGHT: "Night (10 PM–6 AM)",
  WEEKEND: "Weekend Coverage",
  ON_CALL: "On-Call",
};

// ─────────────────────────────────────────────
// TIMEZONE UTILITIES
// ─────────────────────────────────────────────

/** Well-known timezone short labels for display */
export const TIMEZONE_LABELS: Record<string, string> = {
  "Asia/Kolkata":        "IST",
  "America/Los_Angeles": "PST/PDT",
};

/**
 * Format a UTC Date into a timezone-aware string.
 * Returns both the local time and the UTC offset label.
 */
export function formatInTimezone(
  date: Date,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    ...options,
  }).format(date);
}

/**
 * Returns the current UTC offset string for a given IANA timezone.
 * E.g., "Asia/Kolkata" → "+05:30"
 */
export function getUtcOffsetLabel(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(now);
  const offsetPart = parts.find((p) => p.type === "timeZoneName");
  return offsetPart?.value ?? "UTC";
}

/**
 * Converts a local date string + timezone into a UTC Date.
 * Useful when accepting form input in local time and storing as UTC.
 */
export function localToUtc(localIso: string, timezone: string): Date {
  // Create a date treated as if it were in the specified timezone
  const localDate = new Date(localIso);
  const utcMs =
    localDate.getTime() -
    getTimezoneOffsetMs(localDate, timezone);
  return new Date(utcMs);
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzDate = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  return utcDate.getTime() - tzDate.getTime();
}

/**
 * Returns a human-readable relative time string (e.g., "2 hours ago").
 */
export function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Format a duration in minutes to "Xh Ym".
 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─────────────────────────────────────────────
// EXTERNAL ID VALIDATION
// ─────────────────────────────────────────────

/** ServiceNow ticket IDs: INC, CHG, RITM followed by 7 digits */
const SNOW_TICKET_REGEX = /^(INC|CHG|RITM|TASK|REQ|PRB|SCTASK)\d{7}$/;

/** PagerDuty incident IDs: uppercase letters + digits, typically 7 chars */
const PAGERDUTY_ID_REGEX = /^[A-Z0-9]{7}$/;

/** PagerDuty incident URL */
const PAGERDUTY_URL_REGEX =
  /^https:\/\/[a-z0-9-]+\.pagerduty\.com\/incidents\/[A-Z0-9]+$/;

export function validateSnowTicketId(id: string): boolean {
  return SNOW_TICKET_REGEX.test(id.trim().toUpperCase());
}

export function validatePagerDutyRef(ref: string): boolean {
  const trimmed = ref.trim();
  return PAGERDUTY_ID_REGEX.test(trimmed) || PAGERDUTY_URL_REGEX.test(trimmed);
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// RBAC PERMISSION HELPERS
// ─────────────────────────────────────────────

export function canUserPerformAction(
  role: UserRole,
  action: keyof RoleConfig
): boolean {
  const config = ROLE_CONFIG[role];
  const value = config[action];
  return typeof value === "boolean" ? value : false;
}

export function assertRole(
  userRole: UserRole,
  allowedRoles: UserRole[],
  action: string
): void {
  if (!allowedRoles.includes(userRole)) {
    throw new Error(
      `UNAUTHORIZED: Role "${userRole}" is not permitted to perform "${action}". ` +
        `Allowed roles: ${allowedRoles.join(", ")}.`
    );
  }
}

// ─────────────────────────────────────────────
// NAVIGATION MENU BUILDER
// ─────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  iconName: string;
  badge?: string;
  roles: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    iconName: "LayoutDashboard",
    roles: ["CONTRACTOR", "EMPLOYEE", "LEAD", "MANAGER", "GAP_STAKEHOLDER"],
  },
  {
    label: "Log Update",
    href: "/dashboard/log-update",
    iconName: "FilePlus",
    roles: ["CONTRACTOR", "EMPLOYEE", "LEAD", "MANAGER"],
  },
  {
    label: "Daily Feed",
    href: "/dashboard/feed",
    iconName: "Activity",
    roles: ["CONTRACTOR", "EMPLOYEE", "LEAD", "MANAGER", "GAP_STAKEHOLDER"],
  },
  {
    label: "My Shifts",
    href: "/dashboard/shifts",
    iconName: "Calendar",
    roles: ["CONTRACTOR", "EMPLOYEE", "LEAD"],
  },
  {
    label: "Shift Hub",
    href: "/dashboard/handovers",
    iconName: "ArrowLeftRight",
    roles: ["CONTRACTOR", "EMPLOYEE", "LEAD", "MANAGER"],
  },
  {
    label: "Shift Swaps",
    href: "/dashboard/swaps",
    iconName: "RefreshCw",
    roles: ["CONTRACTOR", "EMPLOYEE", "LEAD", "MANAGER"],
  },
  {
    label: "Roster Planner",
    href: "/dashboard/roster",
    iconName: "Users",
    roles: ["MANAGER"],
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    iconName: "BarChart3",
    roles: ["LEAD", "MANAGER", "GAP_STAKEHOLDER"],
  },
  {
    label: "SLA Tracker",
    href: "/dashboard/sla",
    iconName: "ShieldCheck",
    roles: ["MANAGER", "GAP_STAKEHOLDER"],
  },
  {
    label: "Projects",
    href: "/dashboard/projects",
    iconName: "FolderOpen",
    roles: ["MANAGER", "GAP_STAKEHOLDER"],
  },
  {
    label: "Team Management",
    href: "/dashboard/team",
    iconName: "UserCog",
    roles: ["MANAGER"],
  },
  {
    label: "PT Coverage",
    href: "/dashboard/coverage",
    iconName: "ContactRound",
    roles: ["CONTRACTOR", "EMPLOYEE", "LEAD", "MANAGER", "GAP_STAKEHOLDER"],
  },
  {
    label: "Daily Diary",
    href: "/dashboard/diary",
    iconName: "BookOpenCheck",
    roles: ["CONTRACTOR", "EMPLOYEE", "LEAD", "MANAGER", "GAP_STAKEHOLDER"],
  },
];

export function getNavItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

// ─────────────────────────────────────────────
// MISC FORMATTING
// ─────────────────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "…";
}

export function pluralize(count: number, singular: string, plural?: string): string {
  const pluralForm = plural ?? `${singular}s`;
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Generates a consistent avatar background color from a user ID string.
 */
// Inline hex colors — dark enough for white text (WCAG AA contrast)
// Using inline styles avoids Tailwind purge issues with dynamic class names
const AVATAR_HEX_COLORS = [
  "#dc2626", // red-600
  "#ea580c", // orange-600
  "#b45309", // amber-700
  "#a16207", // yellow-700
  "#4d7c0f", // lime-700
  "#16a34a", // green-600
  "#059669", // emerald-600
  "#0d9488", // teal-600
  "#0e7490", // cyan-700
  "#0284c7", // sky-600
  "#2563eb", // blue-600
  "#4f46e5", // indigo-600
  "#7c3aed", // violet-600
  "#9333ea", // purple-600
  "#c026d3", // fuchsia-600
  "#e11d48", // rose-600
];

export function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_HEX_COLORS[Math.abs(hash) % AVATAR_HEX_COLORS.length];
}

/**
 * Build a markdown export string for a handover note — used by Corp
 * stakeholders and leads to export compiled shift summaries.
 */
export function buildHandoverMarkdown(
  handover: import("@/types").ShiftHandover & {
    outgoingLead: import("@/types").User;
    incomingLead: import("@/types").User;
    project: import("@/types").Project;
    outgoingShift: import("@/types").Shift;
  }
): string {
  const timestamp = new Date().toISOString();
  return `# Shift Handover Note — ${handover.project.name}

**Generated:** ${timestamp}
**Project:** ${handover.project.name} (${handover.project.code})
**Outgoing Lead:** ${handover.outgoingLead.name}
**Incoming Lead:** ${handover.incomingLead.name}
**Status:** ${handover.status}

---

## Open Items at Handover

${handover.openItemsSummary}

---

## Resolved During Shift

${handover.resolvedSummary}

---

${
  handover.escalationNotes
    ? `## Escalation Notes\n\n${handover.escalationNotes}\n\n---\n\n`
    : ""
}${
  handover.incomingLeadNotes
    ? `## Incoming Lead Notes\n\n${handover.incomingLeadNotes}\n\n---\n\n`
    : ""
}*This document was auto-generated by ShiftBuddy — Corp/YCI Support Operations Platform.*
`;
}
