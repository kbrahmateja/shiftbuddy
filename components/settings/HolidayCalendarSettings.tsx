"use client";
// components/settings/HolidayCalendarSettings.tsx
// ─────────────────────────────────────────────────────────────
// Interactive holiday calendar settings panel.
//   • Toggle IN / US built-in calendars on/off
//   • Expand full holiday list per region
//   • MANAGER: add / remove custom holidays (localStorage)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import {
  BUILTIN_HOLIDAYS_2026,
  CUSTOM_HOLIDAYS_KEY,
  CALENDAR_TOGGLES_KEY,
  DEFAULT_TOGGLES,
  type Holiday,
  type CalendarToggles,
} from "@/lib/holidays";
import type { UserRole } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────

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

// ── Sub-components ────────────────────────────────────────────────────────

function HolidayRow({ h, onRemove }: { h: Holiday; onRemove?: () => void }) {
  const flagMap: Record<string, string> = { IN: "🇮🇳", US: "🇺🇸", BOTH: "🌐", CUSTOM: "⭐" };
  const colorMap: Record<string, string> = {
    IN:     "text-orange-600",
    US:     "text-blue-600",
    BOTH:   "text-purple-600",
    CUSTOM: "text-indigo-600",
  };
  const dateObj = new Date(h.date + "T00:00:00");
  const formatted = dateObj.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", weekday: "short",
  });

  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0 border-gray-100 group">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base shrink-0">{flagMap[h.type] ?? "📅"}</span>
        <span className={`text-xs font-medium truncate ${colorMap[h.type] ?? "text-gray-600"}`}>
          {h.name}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span className="text-[11px] text-gray-400">{formatted}</span>
        {onRemove && (
          <button
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
            title="Remove"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

interface RegionCardProps {
  flag: string;
  label: string;
  type: "IN" | "US";
  enabled: boolean;
  onToggle: () => void;
  holidays: Holiday[];
}

function RegionCard({ flag, label, type, enabled, onToggle, holidays }: RegionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const colorScheme = type === "IN"
    ? { border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700", badge: "bg-orange-100" }
    : { border: "border-blue-200",   bg: "bg-blue-50",   text: "text-blue-700",   badge: "bg-blue-100"   };

  return (
    <div className={`rounded-lg border ${colorScheme.border} ${enabled ? colorScheme.bg : "bg-gray-50 border-gray-200"} transition-all`}>
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{flag}</span>
          <div>
            <p className={`text-xs font-semibold ${enabled ? colorScheme.text : "text-gray-400"}`}>
              {label}
            </p>
            <p className={`text-[11px] ${enabled ? "opacity-70 " + colorScheme.text : "text-gray-400"}`}>
              {holidays.length} holidays for 2026
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${enabled ? colorScheme.badge + " " + colorScheme.text : "bg-gray-100 text-gray-400"}`}>
            {holidays.length}
          </span>
          {/* Toggle switch */}
          <button
            onClick={onToggle}
            className={`relative h-5 w-9 rounded-full transition-colors focus:outline-none ${enabled ? "bg-indigo-500" : "bg-gray-200"}`}
            title={enabled ? "Disable calendar" : "Enable calendar"}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
          {/* Expand button */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded hover:bg-black/5 text-gray-400 hover:text-gray-600 transition-colors"
            title={expanded ? "Collapse" : "Show holidays"}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded list */}
      {expanded && (
        <div className="px-4 pb-3 max-h-56 overflow-y-auto">
          {holidays.map((h) => (
            <HolidayRow key={h.date + h.name} h={h} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

interface Props {
  userRole: UserRole;
}

export function HolidayCalendarSettings({ userRole }: Props) {
  const isManager = userRole === "MANAGER";

  const [toggles, setToggles]           = useState<CalendarToggles>(DEFAULT_TOGGLES);
  const [customHolidays, setCustom]     = useState<Holiday[]>([]);
  const [showAddForm, setShowAddForm]   = useState(false);
  const [newName, setNewName]           = useState("");
  const [newDate, setNewDate]           = useState("");
  const [newType, setNewType]           = useState<"IN" | "US" | "BOTH">("IN");
  const [error, setError]               = useState("");

  // Load from localStorage on mount
  useEffect(() => {
    setToggles(loadToggles());
    setCustom(loadCustomHolidays());
  }, []);

  const saveToggles = useCallback((next: CalendarToggles) => {
    setToggles(next);
    localStorage.setItem(CALENDAR_TOGGLES_KEY, JSON.stringify(next));
  }, []);

  const saveCustom = useCallback((next: Holiday[]) => {
    setCustom(next);
    localStorage.setItem(CUSTOM_HOLIDAYS_KEY, JSON.stringify(next));
  }, []);

  const handleAddHoliday = () => {
    setError("");
    if (!newName.trim()) { setError("Holiday name is required."); return; }
    if (!newDate)        { setError("Date is required."); return; }

    const dup = customHolidays.find((h) => h.date === newDate && h.name === newName.trim());
    if (dup) { setError("This holiday already exists."); return; }

    saveCustom([...customHolidays, { date: newDate, name: newName.trim(), type: "CUSTOM" }]);
    setNewName("");
    setNewDate("");
    setNewType("IN");
    setShowAddForm(false);
  };

  const handleRemoveCustom = (idx: number) => {
    saveCustom(customHolidays.filter((_, i) => i !== idx));
  };

  const inHolidays  = BUILTIN_HOLIDAYS_2026.filter((h) => h.type === "IN" || h.type === "BOTH");
  const usHolidays  = BUILTIN_HOLIDAYS_2026.filter((h) => h.type === "US" || h.type === "BOTH");

  return (
    <section className="rounded-lg border bg-white p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-gray-400" />
            Holiday Calendar
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Holidays shown in the Roster Planner calendar. Toggle calendars to show/hide.
          </p>
        </div>
        {isManager && (
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
            Manager
          </span>
        )}
      </div>

      {/* Region cards */}
      <div className="space-y-2">
        <RegionCard
          flag="🇮🇳" label="Indian Holidays" type="IN"
          enabled={toggles.IN} onToggle={() => saveToggles({ ...toggles, IN: !toggles.IN })}
          holidays={inHolidays}
        />
        <RegionCard
          flag="🇺🇸" label="US Holidays" type="US"
          enabled={toggles.US} onToggle={() => saveToggles({ ...toggles, US: !toggles.US })}
          holidays={usHolidays}
        />
      </div>

      {/* Custom holidays */}
      {customHolidays.length > 0 && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
          <p className="text-xs font-semibold text-indigo-700 mb-2">
            ⭐ Custom Holidays ({customHolidays.length})
          </p>
          {customHolidays.map((h, i) => (
            <HolidayRow
              key={i}
              h={h}
              onRemove={isManager ? () => handleRemoveCustom(i) : undefined}
            />
          ))}
        </div>
      )}

      {/* Add custom holiday — manager only */}
      {isManager && (
        <div>
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full rounded-md border border-dashed border-gray-300 px-4 py-2.5 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add custom holiday
            </button>
          ) : (
            <div className="rounded-md border border-indigo-200 bg-indigo-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-indigo-700">Add Custom Holiday</p>
              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">
                    Holiday Name
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Company Foundation Day"
                    className="w-full rounded border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full rounded border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Region</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as "IN" | "US" | "BOTH")}
                    className="w-full rounded border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  >
                    <option value="IN">🇮🇳 India</option>
                    <option value="US">🇺🇸 USA</option>
                    <option value="BOTH">🌐 Both</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowAddForm(false); setError(""); setNewName(""); setNewDate(""); }}
                  className="rounded px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddHoliday}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  Add Holiday
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Non-manager hint */}
      {!isManager && (
        <p className="text-[11px] text-gray-400 text-center">
          Only Managers can add custom holidays
        </p>
      )}
    </section>
  );
}
