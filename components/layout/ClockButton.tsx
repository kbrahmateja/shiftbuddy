"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getAttendanceRecords,
  saveAttendanceRecords,
  appendAttendanceNotification,
  formatDuration,
  getOpenRecord,
  type AttendanceRecord,
} from "@/lib/attendance";
import { MOCK_PROJECTS } from "@/lib/mock-data";
import type { SessionUser } from "@/types";

interface ClockButtonProps {
  user: SessionUser;
}

export function ClockButton({ user }: ClockButtonProps) {
  const [openRecord, setOpenRecord] = useState<AttendanceRecord | null>(null);
  const [elapsed, setElapsed] = useState("");
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setMounted(true);
    setOpenRecord(getOpenRecord(user.id) ?? null);
  }, [user.id]);

  // Update elapsed time every 15s while clocked in
  useEffect(() => {
    if (!openRecord) { setElapsed(""); return; }
    const tick = () => {
      const ms = Date.now() - new Date(openRecord.clockIn).getTime();
      setElapsed(formatDuration(ms));
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [openRecord]);

  const handleClockIn = useCallback(() => {
    const projectId = user.activeProjectId ?? "proj_browse";
    const project = MOCK_PROJECTS.find((p) => p.id === projectId);
    const projectName = project?.name ?? "Support Team";

    const record: AttendanceRecord = {
      id: `att_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      projectId,
      projectName,
      clockIn: new Date().toISOString(),
      clockOut: null,
    };

    const records = getAttendanceRecords();
    records.push(record);
    saveAttendanceRecords(records);
    setOpenRecord(record);

    appendAttendanceNotification({
      id: `an_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      projectName,
      event: "CLOCK_IN",
      time: record.clockIn,
    });

    window.dispatchEvent(
      new CustomEvent("sb:clock-in", {
        detail: { userName: user.name, projectName, time: record.clockIn },
      })
    );
  }, [user]);

  const handleClockOut = useCallback(() => {
    if (!openRecord) return;
    const now = new Date().toISOString();
    const records = getAttendanceRecords().map((r) =>
      r.id === openRecord.id ? { ...r, clockOut: now } : r
    );
    saveAttendanceRecords(records);

    const ms = Date.now() - new Date(openRecord.clockIn).getTime();
    const duration = formatDuration(ms);

    appendAttendanceNotification({
      id: `an_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      projectName: openRecord.projectName,
      event: "CLOCK_OUT",
      time: now,
      duration,
    });

    window.dispatchEvent(
      new CustomEvent("sb:clock-out", {
        detail: {
          userName: user.name,
          projectName: openRecord.projectName,
          duration,
          time: now,
        },
      })
    );

    setOpenRecord(null);
  }, [openRecord, user]);

  // Don't render on server to avoid hydration mismatch
  if (!mounted) return null;

  return openRecord ? (
    <button
      onClick={handleClockOut}
      title={`Clocked in at ${new Date(openRecord.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
      className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
    >
      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
      Clock Out
      {elapsed && <span className="text-red-400">· {elapsed}</span>}
    </button>
  ) : (
    <button
      onClick={handleClockIn}
      className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
    >
      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
      Clock In
    </button>
  );
}
