// lib/holiday-policy.ts
// ─────────────────────────────────────────────────────────────
// Holiday On-Call policy: per-project severity cutoffs.
// On a holiday, incidents are split into:
//   • "Response Required"  — must actively work (default: P1_CRITICAL, P2_HIGH)
//   • "Ack Only"           — just acknowledge (P3_MEDIUM, P4_LOW, INFORMATIONAL)
// Managers can override the cutoff per project.
// Config stored in localStorage under HOLIDAY_POLICY_KEY.
// ─────────────────────────────────────────────────────────────

import type { Severity } from "@/types";
import { BUILTIN_HOLIDAYS_2026, type Holiday, type CalendarToggles, DEFAULT_TOGGLES, CALENDAR_TOGGLES_KEY, CUSTOM_HOLIDAYS_KEY } from "@/lib/holidays";

export const HOLIDAY_POLICY_KEY = "shiftbuddy_holiday_policy";

/** All severity levels in descending priority order */
export const ALL_SEVERITIES: Severity[] = [
  "P1_CRITICAL",
  "P2_HIGH",
  "P3_MEDIUM",
  "P4_LOW",
  "INFORMATIONAL",
];

/** Severity display labels */
export const SEVERITY_LABELS: Record<Severity, string> = {
  P1_CRITICAL:   "P1 — Critical",
  P2_HIGH:       "P2 — High",
  P3_MEDIUM:     "P3 — Medium",
  P4_LOW:        "P4 — Low",
  INFORMATIONAL: "Informational",
};

/** Default severities that require full response on holidays */
export const DEFAULT_RESPONSE_SEVERITIES: Severity[] = ["P1_CRITICAL", "P2_HIGH"];

export interface ProjectHolidayPolicy {
  projectId: string;
  /** Severities that require FULL response (not just ack) on holidays */
  responseSeverities: Severity[];
}

export interface HolidayPolicyStore {
  /** projectId → policy. Falls back to DEFAULT_RESPONSE_SEVERITIES if missing. */
  [projectId: string]: ProjectHolidayPolicy;
}

// ── Storage helpers ────────────────────────────────────────────────────────

export function loadHolidayPolicy(): HolidayPolicyStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(HOLIDAY_POLICY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveHolidayPolicy(store: HolidayPolicyStore): void {
  localStorage.setItem(HOLIDAY_POLICY_KEY, JSON.stringify(store));
}

export function getProjectPolicy(store: HolidayPolicyStore, projectId: string): ProjectHolidayPolicy {
  return store[projectId] ?? {
    projectId,
    responseSeverities: DEFAULT_RESPONSE_SEVERITIES,
  };
}

// ── Holiday detection ──────────────────────────────────────────────────────

function loadToggles(): CalendarToggles {
  if (typeof window === "undefined") return DEFAULT_TOGGLES;
  try {
    const raw = localStorage.getItem(CALENDAR_TOGGLES_KEY);
    return raw ? { ...DEFAULT_TOGGLES, ...JSON.parse(raw) } : DEFAULT_TOGGLES;
  } catch { return DEFAULT_TOGGLES; }
}

function loadCustomHolidays(): Holiday[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_HOLIDAYS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Returns all active holidays for a given date string (YYYY-MM-DD) */
export function getHolidaysOnDate(dateStr: string): Holiday[] {
  const toggles = loadToggles();
  const custom = loadCustomHolidays();
  const all = [
    ...BUILTIN_HOLIDAYS_2026.filter((h) => {
      if (h.type === "BOTH")   return toggles.IN || toggles.US;
      if (h.type === "IN")     return toggles.IN;
      if (h.type === "US")     return toggles.US;
      return true; // CUSTOM always shown
    }),
    ...custom,
  ];
  return all.filter((h) => h.date === dateStr);
}

/** Returns true if the given Date falls on an active holiday */
export function isHolidayDate(date: Date): boolean {
  const dateStr = date.toISOString().slice(0, 10);
  return getHolidaysOnDate(dateStr).length > 0;
}

/** Get all active holiday date strings for quick lookup */
export function getActiveHolidayDateSet(): Set<string> {
  const toggles = loadToggles();
  const custom = loadCustomHolidays();
  const all = [
    ...BUILTIN_HOLIDAYS_2026.filter((h) => {
      if (h.type === "BOTH") return toggles.IN || toggles.US;
      if (h.type === "IN")   return toggles.IN;
      if (h.type === "US")   return toggles.US;
      return false;
    }),
    ...custom,
  ];
  return new Set(all.map((h) => h.date));
}

// ── Incident classification ────────────────────────────────────────────────

export type HolidayIncidentClass = "RESPONSE_REQUIRED" | "ACK_ONLY" | "NOT_HOLIDAY";

export function classifyHolidayIncident(
  occurredAt: Date,
  severity: Severity,
  policy: ProjectHolidayPolicy
): HolidayIncidentClass {
  const dateStr = occurredAt.toISOString().slice(0, 10);
  const holidays = getHolidaysOnDate(dateStr);
  if (holidays.length === 0) return "NOT_HOLIDAY";
  return policy.responseSeverities.includes(severity)
    ? "RESPONSE_REQUIRED"
    : "ACK_ONLY";
}
