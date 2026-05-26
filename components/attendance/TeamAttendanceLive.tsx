"use client";

import { useEffect, useState } from "react";
import { getAttendanceRecords, type AttendanceRecord } from "@/lib/attendance";
import { MOCK_SHIFTS, MOCK_PROJECTS } from "@/lib/mock-data";

const SHIFT_LABEL: Record<string, string> = {
  MORNING:   "Shift 1  05:30–14:30",
  AFTERNOON: "Shift 2  13:30–22:30",
  NIGHT:     "Shift 3  21:30–06:30",
  GENERAL:   "General  09:00–17:00",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function TeamAttendanceLive() {
  const [attRecords, setAttRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    const load = () => setAttRecords(getAttendanceRecords());
    load();
    window.addEventListener("sb:clock-in", load);
    window.addEventListener("sb:clock-out", load);
    return () => {
      window.removeEventListener("sb:clock-in", load);
      window.removeEventListener("sb:clock-out", load);
    };
  }, []);

  // All shifts for today (start date matches today) + any currently ACTIVE shift
  const today = new Date().toDateString();
  const todayShifts = MOCK_SHIFTS.filter(
    (s) =>
      new Date(s.startTime).toDateString() === today ||
      s.status === "ACTIVE"
  );

  // Deduplicate by user (one row per person)
  const seen = new Set<string>();
  const uniqueShifts = todayShifts.filter((s) => {
    if (seen.has(s.assignedToId)) return false;
    seen.add(s.assignedToId);
    return true;
  });

  // Sort: ACTIVE first, then by shift pattern
  const PATTERN_ORDER: Record<string, number> = { NIGHT: 0, MORNING: 1, AFTERNOON: 2, GENERAL: 3 };
  uniqueShifts.sort((a, b) => {
    if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
    if (b.status === "ACTIVE" && a.status !== "ACTIVE") return 1;
    return (PATTERN_ORDER[a.pattern] ?? 9) - (PATTERN_ORDER[b.pattern] ?? 9);
  });

  const activeCount  = uniqueShifts.filter((s) => s.status === "ACTIVE").length;
  const clockedIn    = attRecords.filter((r) => !r.clockOut).length;
  const clockedOut   = attRecords.filter((r) =>  r.clockOut).length;

  return (
    <div className="space-y-3">
      {/* Summary pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {activeCount} shift{activeCount !== 1 ? "s" : ""} active now
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-700">
          {clockedIn} clocked in (app)
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
          {uniqueShifts.length} scheduled today
        </span>
        {clockedOut > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
            {clockedOut} clocked out
          </span>
        )}
      </div>

      <div className="rounded-lg border bg-white overflow-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-2.5 text-left">Member</th>
              <th className="px-4 py-2.5 text-left">Project</th>
              <th className="px-4 py-2.5 text-left">Shift</th>
              <th className="px-4 py-2.5 text-left">Clock In</th>
              <th className="px-4 py-2.5 text-left">Clock Out</th>
              <th className="px-4 py-2.5 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {uniqueShifts.map((shift) => {
              const proj     = MOCK_PROJECTS.find((p) => p.id === shift.projectId);
              const clockIn  = attRecords.find((r) => r.userId === shift.assignedToId && !r.clockOut);
              const clockOut = attRecords.find((r) => r.userId === shift.assignedToId &&  r.clockOut);
              const hasRecord = clockIn ?? clockOut;

              return (
                <tr key={shift.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {shift.assignedTo.name}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {proj?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                    {SHIFT_LABEL[shift.pattern] ?? shift.pattern}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                    {hasRecord ? fmt((clockIn ?? clockOut)!.clockIn) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                    {clockOut?.clockOut ? fmt(clockOut.clockOut) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {clockOut ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                        Clocked Out
                      </span>
                    ) : clockIn ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        Clocked In
                      </span>
                    ) : shift.status === "ACTIVE" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        On Shift
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-200" />
                        Scheduled
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
