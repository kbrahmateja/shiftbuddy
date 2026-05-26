// lib/holidays.ts
// ─────────────────────────────────────────────────────────────
// Shared holiday data for 2026 — Indian & US public holidays.
// Used by both the Roster calendar and the Settings panel.
// Custom holidays are stored in localStorage under CUSTOM_HOLIDAYS_KEY.
// ─────────────────────────────────────────────────────────────

export type HolidayType = "IN" | "US" | "BOTH" | "CUSTOM";

export interface Holiday {
  date: string;   // YYYY-MM-DD
  name: string;
  type: HolidayType;
}

export const CUSTOM_HOLIDAYS_KEY  = "shiftbuddy_custom_holidays";
export const CALENDAR_TOGGLES_KEY = "shiftbuddy_calendar_toggles";

export interface CalendarToggles {
  IN: boolean;
  US: boolean;
}

export const DEFAULT_TOGGLES: CalendarToggles = { IN: true, US: true };

// ── 2026 Built-in Holidays ─────────────────────────────────────────────────

export const BUILTIN_HOLIDAYS_2026: Holiday[] = [
  // ── BOTH ─────────────────────────────────────────────────────────────────
  { date: "2026-01-01", name: "New Year's Day",           type: "BOTH" },
  { date: "2026-12-25", name: "Christmas Day",            type: "BOTH" },

  // ── INDIA ─────────────────────────────────────────────────────────────────
  { date: "2026-01-14", name: "Makar Sankranti",          type: "IN" },
  { date: "2026-01-26", name: "Republic Day",             type: "IN" },
  { date: "2026-02-26", name: "Maha Shivaratri",          type: "IN" },
  { date: "2026-03-25", name: "Holi",                     type: "IN" },
  { date: "2026-04-02", name: "Ram Navami",               type: "IN" },
  { date: "2026-04-10", name: "Good Friday",              type: "IN" },
  { date: "2026-04-14", name: "Ambedkar Jayanti",         type: "IN" },
  { date: "2026-04-14", name: "Baisakhi / Vishu",         type: "IN" },
  { date: "2026-05-01", name: "Labour Day",               type: "IN" },
  { date: "2026-06-07", name: "Eid ul-Adha",              type: "IN" },
  { date: "2026-08-15", name: "Independence Day",         type: "IN" },
  { date: "2026-08-27", name: "Janmashtami",              type: "IN" },
  { date: "2026-10-02", name: "Gandhi Jayanti",           type: "IN" },
  { date: "2026-10-21", name: "Dussehra",                 type: "IN" },
  { date: "2026-11-08", name: "Diwali",                   type: "IN" },
  { date: "2026-11-09", name: "Diwali (2nd day)",         type: "IN" },
  { date: "2026-11-14", name: "Children's Day",           type: "IN" },
  { date: "2026-11-15", name: "Guru Nanak Jayanti",       type: "IN" },

  // ── USA ───────────────────────────────────────────────────────────────────
  { date: "2026-01-19", name: "MLK Day",                  type: "US" },
  { date: "2026-02-16", name: "Presidents' Day",          type: "US" },
  { date: "2026-05-25", name: "Memorial Day",             type: "US" },
  { date: "2026-06-19", name: "Juneteenth",               type: "US" },
  { date: "2026-07-03", name: "Independence Day (obs.)",  type: "US" },
  { date: "2026-07-04", name: "Independence Day",         type: "US" },
  { date: "2026-09-07", name: "Labor Day",                type: "US" },
  { date: "2026-10-12", name: "Columbus Day",             type: "US" },
  { date: "2026-11-11", name: "Veterans Day",             type: "US" },
  { date: "2026-11-26", name: "Thanksgiving",             type: "US" },
];

/** Count of built-in holidays per region (for display) */
export const HOLIDAY_COUNTS = {
  IN: BUILTIN_HOLIDAYS_2026.filter((h) => h.type === "IN" || h.type === "BOTH").length, // 21
  US: BUILTIN_HOLIDAYS_2026.filter((h) => h.type === "US" || h.type === "BOTH").length, // 12
};

/** Merge built-in + custom holidays, filtered by active toggles */
export function getActiveHolidays(
  toggles: CalendarToggles,
  customHolidays: Holiday[]
): Holiday[] {
  const builtIn = BUILTIN_HOLIDAYS_2026.filter((h) => {
    if (h.type === "BOTH") return toggles.IN || toggles.US;
    if (h.type === "IN")   return toggles.IN;
    if (h.type === "US")   return toggles.US;
    return false;
  });
  return [...builtIn, ...customHolidays].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

/** Get all holidays for a specific date string (YYYY-MM-DD) */
export function getHolidaysForDate(
  dateStr: string,
  toggles: CalendarToggles,
  customHolidays: Holiday[]
): Holiday[] {
  return getActiveHolidays(toggles, customHolidays).filter(
    (h) => h.date === dateStr
  );
}
