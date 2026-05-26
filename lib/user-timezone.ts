"use client";
// lib/user-timezone.ts
// ─────────────────────────────────────────────────────────────
// Browser timezone detection + localStorage preference storage.
// Priority:  localStorage override  →  Intl auto-detect  →  session default
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

export const TIMEZONE_PREF_KEY = "shiftbuddy_timezone_pref";

/** All supported IANA timezone options for the picker */
export const TIMEZONE_OPTIONS: { value: string; label: string; region: string }[] = [
  { value: "Asia/Kolkata",        label: "IST — Asia/Kolkata",          region: "India"   },
  { value: "Asia/Dubai",          label: "GST — Asia/Dubai",            region: "Gulf"    },
  { value: "Asia/Singapore",      label: "SGT — Asia/Singapore",        region: "Asia"    },
  { value: "Asia/Tokyo",          label: "JST — Asia/Tokyo",            region: "Asia"    },
  { value: "Europe/London",       label: "GMT — Europe/London",         region: "Europe"  },
  { value: "Europe/Paris",        label: "CET — Europe/Paris",          region: "Europe"  },
  { value: "America/New_York",    label: "EST — America/New_York",      region: "US"      },
  { value: "America/Chicago",     label: "CST — America/Chicago",       region: "US"      },
  { value: "America/Denver",      label: "MST — America/Denver",        region: "US"      },
  { value: "America/Los_Angeles", label: "PST — America/Los_Angeles",   region: "US"      },
  { value: "UTC",                 label: "UTC",                         region: "UTC"     },
];

/** Read the browser's IANA timezone — always available, never throws */
export function getDetectedTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/** Read saved preference from localStorage (null if never set) */
export function getSavedTimezone(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TIMEZONE_PREF_KEY);
  } catch {
    return null;
  }
}

/** Persist the user's chosen timezone override */
export function saveTimezonePreference(tz: string): void {
  try {
    localStorage.setItem(TIMEZONE_PREF_KEY, tz);
    window.dispatchEvent(new StorageEvent("storage", { key: TIMEZONE_PREF_KEY, newValue: tz }));
  } catch {
    // ignore
  }
}

/** Clear saved preference — revert to auto-detect */
export function clearTimezonePreference(): void {
  try {
    localStorage.removeItem(TIMEZONE_PREF_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: TIMEZONE_PREF_KEY, newValue: null }));
  } catch {
    // ignore
  }
}

/**
 * React hook — returns the effective timezone to use in UI.
 * Also returns whether it came from a saved pref or auto-detect.
 *
 * Priority:  saved pref (localStorage)  →  browser Intl  →  sessionFallback
 */
export function useUserTimezone(sessionFallback = "UTC"): {
  timezone: string;
  detectedTimezone: string;
  isManualOverride: boolean;
} {
  const detected = typeof window !== "undefined" ? getDetectedTimezone() : sessionFallback;
  const [saved, setSaved] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSaved(getSavedTimezone());

    const handler = (e: StorageEvent) => {
      if (e.key === TIMEZONE_PREF_KEY) {
        setSaved(e.newValue);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  if (!mounted) {
    // SSR / hydration: use session value to avoid mismatch
    return { timezone: sessionFallback, detectedTimezone: sessionFallback, isManualOverride: false };
  }

  const timezone = saved ?? detected;
  return {
    timezone,
    detectedTimezone: detected,
    isManualOverride: !!saved,
  };
}
