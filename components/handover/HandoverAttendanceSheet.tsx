"use client";
// components/handover/HandoverAttendanceSheet.tsx

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Users, LogIn, LogOut, Clock } from "lucide-react";
import {
  getShiftMembers, getCurrentShiftCode, NEXT_SHIFT, SHIFT_SHORT,
  type ShiftMember, type ShiftCode,
} from "@/lib/shift-roster";
import { getAttendanceRecords, formatDuration } from "@/lib/attendance";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────

export type AttendanceStatus = "PENDING" | "PRESENT" | "ABSENT";

export const ABSENT_REASONS = [
  "On Leave",
  "No Show",
  "WFH – Connectivity Issue",
  "On Break / BRB",
  "Medical Emergency",
  "Other",
] as const;

export interface AttendeeRecord {
  userId: string;
  name: string;
  displayName: string;
  role: ShiftMember["role"];
  projectName: string;
  status: AttendanceStatus;
  absentReason?: string;
  delegateTo?: string;      // userId — set when LEAD is ABSENT
  isActingLead?: boolean;   // true when this person was delegated to
  markedAt?: string;
  clockIn?: string;
  clockOut?: string;
}

export interface AttendanceData {
  closingShift: ShiftCode;
  openingShift: ShiftCode;
  closing: AttendeeRecord[];
  opening: AttendeeRecord[];
  quorumMet: boolean;
}

// ── Mock seed clock times for demo ────────────────────────────
// In production these come from the real attendance records.
// Shift hours: S1 05:30–13:30 | S2 13:30–21:30 | S3 21:30–05:30

const MOCK_CLOCK_SEED: Record<string, { clockIn: string; clockOut?: string }> = (() => {
  const today = new Date();
  const d = (h: number, m: number) => {
    const t = new Date(today);
    t.setHours(h, m, 0, 0);
    return t.toISOString();
  };
  return {
    // Shift1 members — clocked in ~05:30, clocked out ~13:30
    "u_ck_01": { clockIn: d(5, 33), clockOut: d(13, 28) },
    "u_ck_02": { clockIn: d(5, 29), clockOut: d(13, 31) },
    "u_pc_01": { clockIn: d(5, 35), clockOut: d(13, 30) },
    "u_pc_02": { clockIn: d(5, 27), clockOut: d(13, 29) },
    "u_bp_01": { clockIn: d(5, 32), clockOut: d(13, 33) },
    "u_bp_02": { clockIn: d(5, 30), clockOut: d(13, 30) },
    "u_bp_10": { clockIn: d(5, 28), clockOut: d(13, 32) },
    "u_bu_01": { clockIn: d(5, 31), clockOut: d(13, 29) },
    "u_bu_02": { clockIn: d(5, 34), clockOut: d(13, 31) },
    "u_bu_03": { clockIn: d(5, 29), clockOut: d(13, 30) },
    "u_wa_01": { clockIn: d(5, 36), clockOut: d(13, 28) },
    // Shift2 members — clocked in ~13:30, some still in
    "u_ck_03": { clockIn: d(13, 32), clockOut: d(21, 29) },
    "u_ck_04": { clockIn: d(13, 28) },
    "u_pc_03": { clockIn: d(13, 31), clockOut: d(21, 30) },
    "u_pc_04": { clockIn: d(13, 35) },
    "u_bp_03": { clockIn: d(13, 29) },
    "u_bp_04": { clockIn: d(13, 33) },
    "u_bp_05": { clockIn: d(13, 30) },
    "u_bp_06": { clockIn: d(13, 27) },
    "u_bu_04": { clockIn: d(13, 34) },
    "u_bu_05": { clockIn: d(13, 31) },
    "u_bu_06": { clockIn: d(13, 29) },
    "u_wa_02": { clockIn: d(13, 32) },
    "u_wa_04": { clockIn: d(13, 30) },
    // Shift3 members — clocked in ~21:30
    "u_ck_05": { clockIn: d(21, 31) },
    "u_ck_06": { clockIn: d(21, 29) },
    "u_pc_05": { clockIn: d(21, 33) },
    "u_pc_06": { clockIn: d(21, 28) },
    "u_bp_07": { clockIn: d(21, 30) },
    "u_bp_08": { clockIn: d(21, 32) },
    "u_bp_09": { clockIn: d(21, 35) },
    "u_bu_07": { clockIn: d(21, 29) },
    "u_bu_08": { clockIn: d(21, 31) },
    "u_bu_09": { clockIn: d(21, 27) },
    "u_wa_05": { clockIn: d(21, 33) },
  };
})();

// ── Helpers ───────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

function getClockTimes(userId: string): { clockIn?: string; clockOut?: string } {
  // Real localStorage record takes priority
  const todayStr = new Date().toLocaleDateString("en-CA");
  const real = getAttendanceRecords()
    .filter((r) => r.userId === userId)
    .find((r) => r.clockIn.slice(0, 10) === todayStr);
  if (real) return { clockIn: real.clockIn, clockOut: real.clockOut ?? undefined };
  // Fallback to seed data for demo
  return MOCK_CLOCK_SEED[userId] ?? {};
}

function initRecords(members: ShiftMember[]): AttendeeRecord[] {
  return members.map((m) => {
    const { clockIn, clockOut } = getClockTimes(m.userId);
    return {
      userId: m.userId,
      name: m.name,
      displayName: m.displayName,
      role: m.role,
      projectName: m.projectName,
      status: "PENDING",
      clockIn,
      clockOut,
    };
  });
}

function avatarInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/**
 * Quorum rules:
 * - Shift HAS lead + lead is PRESENT            → ✅
 * - Shift HAS lead + lead ABSENT + delegate present → ✅ (delegated)
 * - Shift has NO lead + any member present       → ✅
 */
function quorumMet(records: AttendeeRecord[]): boolean {
  const hasLead = records.some((r) => r.role === "LEAD");
  if (!hasLead) return records.some((r) => r.status === "PRESENT");

  const leadPresent = records.some((r) => r.role === "LEAD" && r.status === "PRESENT");
  if (leadPresent) return true;

  // Lead absent but delegated — check if delegate is present
  const delegateId = records.find((r) => r.role === "LEAD" && r.status === "ABSENT")?.delegateTo;
  if (delegateId) {
    return records.some((r) => r.userId === delegateId && r.status === "PRESENT");
  }
  return false;
}

// ── Status config ─────────────────────────────────────────────

const STATUS_CONFIG: Record<AttendanceStatus, { icon: React.ReactNode; row: string; btn: string }> = {
  PENDING: {
    icon: <span className="h-3 w-3 rounded-full bg-gray-300 inline-block" />,
    row: "",
    btn: "bg-gray-100 text-gray-500 border-gray-200",
  },
  PRESENT: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    row: "bg-emerald-50/60",
    btn: "bg-emerald-100 text-emerald-700 border-emerald-300",
  },
  ABSENT: {
    icon: <XCircle className="h-3.5 w-3.5" />,
    row: "bg-red-50/60",
    btn: "bg-red-100 text-red-700 border-red-300",
  },
};

// ── Single attendee row ───────────────────────────────────────

interface AttendeeRowProps {
  record: AttendeeRecord;
  allRecords: AttendeeRecord[];   // for delegate picker
  onChange: (updated: Partial<AttendeeRecord>) => void;
}

function AttendeeRow({ record, allRecords, onChange }: AttendeeRowProps) {
  const cfg = STATUS_CONFIG[record.status];

  const duration =
    record.clockIn && record.clockOut
      ? formatDuration(new Date(record.clockOut).getTime() - new Date(record.clockIn).getTime())
      : record.clockIn
      ? "Active"
      : null;

  return (
    <div className={cn("rounded-lg border border-gray-100 px-3 py-2.5 transition-colors space-y-2", cfg.row)}>
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className={cn(
          "h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold",
          record.role === "LEAD"       ? "bg-indigo-100 text-indigo-700" :
          record.role === "CONTRACTOR" ? "bg-purple-100 text-purple-700" :
                                         "bg-gray-100 text-gray-600"
        )}>
          {avatarInitials(record.name)}
        </div>

        {/* Name + project */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-semibold text-gray-800 truncate">{record.displayName}</p>
            {record.role === "LEAD" && (
              <span className="shrink-0 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700">LEAD</span>
            )}
            {record.role === "CONTRACTOR" && (
              <span className="shrink-0 rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">C</span>
            )}
            {record.isActingLead && (
              <span className="shrink-0 rounded-full bg-amber-100 border border-amber-300 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                Acting Lead
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 truncate">{record.projectName}</p>
        </div>

        {/* Present / Absent buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {(["PRESENT", "ABSENT"] as AttendanceStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => onChange({
                status: s,
                markedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                absentReason: s !== "ABSENT" ? undefined : record.absentReason,
              })}
              className={cn(
                "flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-all",
                record.status === s
                  ? STATUS_CONFIG[s].btn
                  : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
              )}
            >
              {STATUS_CONFIG[s].icon}
              {s === "PRESENT" ? "Present" : "Absent"}
            </button>
          ))}
        </div>
      </div>

      {/* Clock In / Out row */}
      <div className="ml-11 flex items-center gap-3 flex-wrap">
        {record.clockIn ? (
          <>
            <span className="flex items-center gap-1 text-[10px] text-emerald-700">
              <LogIn className="h-3 w-3" />
              <span className="font-medium">{fmtTime(record.clockIn)}</span>
            </span>
            {record.clockOut ? (
              <span className="flex items-center gap-1 text-[10px] text-red-600">
                <LogOut className="h-3 w-3" />
                <span className="font-medium">{fmtTime(record.clockOut)}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-indigo-500">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Still clocked in
              </span>
            )}
            {duration && (
              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                <Clock className="h-3 w-3" />
                {duration}
              </span>
            )}
          </>
        ) : (
          <span className="text-[10px] text-gray-300 italic">No clock record today</span>
        )}
      </div>

      {/* Absent reason + delegate (for leads) */}
      {record.status === "ABSENT" && (
        <div className="ml-11 space-y-2">
          {/* Reason */}
          <select
            value={record.absentReason ?? ""}
            onChange={(e) => onChange({ absentReason: e.target.value })}
            className="w-full rounded-md border border-red-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-red-300"
          >
            <option value="">— Select reason —</option>
            {ABSENT_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Delegate picker — only for leads */}
          {record.role === "LEAD" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 space-y-1.5">
              <p className="text-[10px] font-semibold text-amber-700 flex items-center gap-1">
                <span>⚠️</span> Lead absent — delegate responsibility to:
              </p>
              <select
                value={record.delegateTo ?? ""}
                onChange={(e) => onChange({ delegateTo: e.target.value || undefined })}
                className="w-full rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                <option value="">— Select acting lead —</option>
                {allRecords
                  .filter((r) => r.userId !== record.userId && r.role !== "LEAD")
                  .map((r) => (
                    <option key={r.userId} value={r.userId}>
                      {r.displayName} · {r.projectName}
                    </option>
                  ))}
              </select>
              {record.delegateTo && (
                <p className="text-[10px] text-amber-600">
                  ✓ Delegated — they will be shown as <strong>Acting Lead</strong> for today's handover
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shift column ──────────────────────────────────────────────

interface ShiftColumnProps {
  title: string;
  shiftLabel: string;
  records: AttendeeRecord[];
  side: "closing" | "opening";
  onChange: (userId: string, updated: Partial<AttendeeRecord>) => void;
}

function ShiftColumn({ title, shiftLabel, records, side, onChange }: ShiftColumnProps) {
  const presentCount = records.filter((r) => r.status === "PRESENT").length;
  const pendingCount = records.filter((r) => r.status === "PENDING").length;
  const hasLead = records.some((r) => r.role === "LEAD");
  const hasLeadPresent = hasLead
    ? records.some((r) => r.role === "LEAD" && r.status === "PRESENT")
    : records.some((r) => r.status === "PRESENT");

  return (
    <div className={cn(
      "flex-1 rounded-xl border-2 p-4 space-y-3",
      side === "closing" ? "border-amber-200 bg-amber-50/30" : "border-emerald-200 bg-emerald-50/30"
    )}>
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold",
              side === "closing" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
            )}>
              {title}
            </span>
            <span className="text-[11px] text-gray-500">{shiftLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <Users className="h-3 w-3" />
            <span>{presentCount}/{records.length} present</span>
          </div>
        </div>

        {!hasLeadPresent && (
          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-100 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {hasLead ? "Lead not yet marked present — quorum pending" : "Mark at least one member present — quorum pending"}
          </div>
        )}

        <div className="mt-2 h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", side === "closing" ? "bg-amber-400" : "bg-emerald-400")}
            style={{ width: records.length ? `${((records.length - pendingCount) / records.length) * 100}%` : "0%" }}
          />
        </div>
      </div>

      <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-0.5">
        {records.map((r) => {
          // Apply isActingLead flag if this person was delegated to by an absent lead
          const delegatedBy = records.find(
            (lead) => lead.role === "LEAD" && lead.status === "ABSENT" && lead.delegateTo === r.userId
          );
          const enriched = { ...r, isActingLead: !!delegatedBy };
          return (
            <AttendeeRow
              key={r.userId}
              record={enriched}
              allRecords={records}
              onChange={(u) => {
                // When a delegate is set, clear isActingLead on previous delegate
                onChange(r.userId, u);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

interface Props {
  onChange: (data: AttendanceData) => void;
}

export function HandoverAttendanceSheet({ onChange }: Props) {
  const [closingShift, setClosingShift] = useState<ShiftCode>("Shift2");
  const [closingRecords, setClosingRecords] = useState<AttendeeRecord[]>([]);
  const [openingRecords, setOpeningRecords] = useState<AttendeeRecord[]>([]);

  useEffect(() => {
    const current = getCurrentShiftCode();
    const next = NEXT_SHIFT[current];
    setClosingShift(current);
    setClosingRecords(initRecords(getShiftMembers(current)));
    setOpeningRecords(initRecords(getShiftMembers(next)));
  }, []);

  const openingShift = NEXT_SHIFT[closingShift];

  function updateClosing(userId: string, updated: Partial<AttendeeRecord>) {
    setClosingRecords((prev) => {
      const next = prev.map((r) => r.userId === userId ? { ...r, ...updated } : r);
      fireChange(next, openingRecords);
      return next;
    });
  }

  function updateOpening(userId: string, updated: Partial<AttendeeRecord>) {
    setOpeningRecords((prev) => {
      const next = prev.map((r) => r.userId === userId ? { ...r, ...updated } : r);
      fireChange(closingRecords, next);
      return next;
    });
  }

  function fireChange(closing: AttendeeRecord[], opening: AttendeeRecord[]) {
    onChange({
      closingShift,
      openingShift,
      closing,
      opening,
      quorumMet: quorumMet(closing) && quorumMet(opening),
    });
  }

  const allQuorum = quorumMet(closingRecords) && quorumMet(openingRecords);
  const totalMarked = [...closingRecords, ...openingRecords].filter((r) => r.status !== "PENDING").length;
  const total = closingRecords.length + openingRecords.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            Handover Meeting Attendance
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Mark attendance for both shifts before submitting the handover.
          </p>
        </div>

        <div className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border",
          allQuorum
            ? "bg-emerald-100 text-emerald-700 border-emerald-300"
            : "bg-amber-100 text-amber-700 border-amber-200"
        )}>
          {allQuorum
            ? <><CheckCircle2 className="h-3.5 w-3.5" /> Quorum met</>
            : <><AlertTriangle className="h-3.5 w-3.5" /> {totalMarked}/{total} marked</>
          }
        </div>
      </div>

      <div className="flex gap-4">
        <ShiftColumn
          title="Closing Shift"
          shiftLabel={SHIFT_SHORT[closingShift]}
          records={closingRecords}
          side="closing"
          onChange={updateClosing}
        />
        <ShiftColumn
          title="Opening Shift"
          shiftLabel={SHIFT_SHORT[openingShift]}
          records={openingRecords}
          side="opening"
          onChange={updateOpening}
        />
      </div>
    </div>
  );
}
