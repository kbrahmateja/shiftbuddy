"use client";
// components/settings/TimezoneSettings.tsx

import { useState, useEffect } from "react";
import { Globe, Pencil, RotateCcw, Check } from "lucide-react";
import {
  TIMEZONE_OPTIONS,
  getDetectedTimezone,
  getSavedTimezone,
  saveTimezonePreference,
  clearTimezonePreference,
} from "@/lib/user-timezone";

interface Props {
  sessionTimezone: string;
}

export function TimezoneSettings({ sessionTimezone }: Props) {
  const [detected, setDetected] = useState(sessionTimezone);
  const [saved, setSaved] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(sessionTimezone);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const det = getDetectedTimezone();
    setDetected(det);
    const pref = getSavedTimezone();
    setSaved(pref);
    setSelected(pref ?? det);
  }, []);

  const effectiveTz = saved ?? detected;
  const isOverridden = !!saved;
  const effectiveLabel =
    TIMEZONE_OPTIONS.find((o) => o.value === effectiveTz)?.label ?? effectiveTz;
  const detectedLabel =
    TIMEZONE_OPTIONS.find((o) => o.value === detected)?.label ?? detected;

  function handleSave() {
    saveTimezonePreference(selected);
    setSaved(selected);
    setEditing(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  function handleReset() {
    clearTimezonePreference();
    setSaved(null);
    setSelected(detected);
    setEditing(false);
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Timezone</label>

      {!editing ? (
        <>
          {/* Matches exact height/style of the other disabled inputs */}
          <div className="flex w-full items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            <Globe className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span className="flex-1 truncate">{effectiveLabel}</span>

            {savedFlash ? (
              <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-green-600">
                <Check className="h-3 w-3" /> Saved
              </span>
            ) : isOverridden ? (
              <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                Custom
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                Auto-detected
              </span>
            )}

            <button
              onClick={() => setEditing(true)}
              className="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
              title="Change timezone"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            autoFocus
            className="w-full rounded-md border border-indigo-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {TIMEZONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => { setEditing(false); setSelected(effectiveTz); }}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            {isOverridden && (
              <button
                onClick={handleReset}
                className="ml-auto flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                <RotateCcw className="h-3 w-3" /> Reset to auto-detect
              </button>
            )}
          </div>

          {!isOverridden && (
            <p className="text-[11px] text-gray-400">
              Detected: <strong>{detectedLabel}</strong> — change only if incorrect.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
