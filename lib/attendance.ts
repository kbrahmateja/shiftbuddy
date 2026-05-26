// Client-side attendance utilities — localStorage-backed POC
// (Production: replace with Prisma UserSession model)

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  clockIn: string;       // ISO string
  clockOut: string | null;
}

export interface AttendanceNotification {
  id: string;
  userId: string;
  userName: string;
  projectName: string;
  event: "CLOCK_IN" | "CLOCK_OUT";
  time: string;          // ISO string
  duration?: string;     // e.g. "8h 23m" — only on CLOCK_OUT
}

const ATTENDANCE_KEY = "sb_attendance";
const ATT_NOTIF_KEY  = "sb_att_notifications";

// ── Records ──────────────────────────────────────────────────────────────────

export function getAttendanceRecords(): AttendanceRecord[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(ATTENDANCE_KEY) ?? "[]"); }
  catch { return []; }
}

export function saveAttendanceRecords(records: AttendanceRecord[]): void {
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
}

export function getOpenRecord(userId: string): AttendanceRecord | undefined {
  return getAttendanceRecords().find((r) => r.userId === userId && !r.clockOut);
}

// ── Notifications ─────────────────────────────────────────────────────────────

export function getAttendanceNotifications(): AttendanceNotification[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(ATT_NOTIF_KEY) ?? "[]"); }
  catch { return []; }
}

export function appendAttendanceNotification(n: AttendanceNotification): void {
  const existing = getAttendanceNotifications();
  localStorage.setItem(ATT_NOTIF_KEY, JSON.stringify([n, ...existing].slice(0, 50)));
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
