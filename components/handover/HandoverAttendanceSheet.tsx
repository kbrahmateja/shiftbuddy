"use client";
// components/handover/HandoverAttendanceSheet.tsx
// ─────────────────────────────────────────────────────────────
// Two-column attendance sheet for shift handover meetings.
// Lead marks each member from closing + opening shift as
// Present / Late / Absent. Absent requires a reason.
// Submit is blocked until quorum is met (≥1 lead each side).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { CheckCircle2, Clock3, XCircle, AlertTriangle, Users } from "lucide-react";
import {
  getShiftMembers, getCurrentShiftCode, NEXT_SHIFT, SHIFT_SHORT,
  type ShiftMember, type ShiftCode,
} from "@/lib/shift-roster";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────

export type AttendanceStatus = "PENDING" | "PRESENT" | "LATE" | "ABSENT";

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
  markedAt?: string;
}

export interface AttendanceData {
  closingShift: ShiftCode;
  openingShift: ShiftCode;
  closing: AttendeeRecord[];
  opening: AttendeeRecord[];
  quorumMet: boolean;
}

// ── Helpers ──────────────────────────────────────────────────

function initRecords(members: ShiftMember[]): AttendeeRecord[] {
  return members.map((m) => ({
    userId: m.userId,
    name: m.name,
    displayName: m.displayName,
    role: m.role,
    projectName: m.projectName,
    status: "PENDING",
  }));
}

function avatarInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function quorumMet(records: AttendeeRecord[]): boolean {
  return records.some((r) => r.role === "LEAD" && r.status === "PRESENT");
}

// ── Status pill ──────────────────────────────────────────────

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; icon: React.ReactNode; row: string; btn: string }
> = {
  PENDING:  {
    label: "Pending",
    icon: <span className="h-3 w-3 rounded-full bg-gray-300 inline-block" />,
    row: "",
    btn: "bg-gray-100 text-gray-500 border-gray-200",
  },
  PRESENT:  {
    label: "Present",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    row: "bg-emerald-50/60",
    btn: "bg-emerald-100 text-emerald-700 border-emerald-300",
  },
  LATE:     {
    label: "Late",
    icon: <Clock3 className="h-3.5 w-3.5" />,
    row: "bg-amber-50/60",
    btn: "bg-amber-100 text-amber-700 border-amber-300",
  },
  ABSENT:   {
    label: "Absent",
    icon: <XCircle className="h-3.5 w-3.5" />,
    row: "bg-red-50/60",
    btn: "bg-red-100 text-red-700 border-red-300",
  },
};

// ── Single attendee row ───────────────────────────────────────

interface AttendeeRowProps {
  record: AttendeeRecord;
  onChange: (updated: Partial<AttendeeRecord>) => void;
}

function AttendeeRow({ record, onChange }: AttendeeRowProps) {
  const cfg = STATUS_CONFIG[record.status];

  return (
    <div className={cn("rounded-lg border border-gray-100 px-3 py-2.5 transition-colors", cfg.row)}>
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
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-gray-800 truncate">{record.displayName}</p>
            {record.role === "LEAD" && (
              <span className="shrink-0 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700">LEAD</span>
            )}
            {record.role === "CONTRACTOR" && (
              <span className="shrink-0 rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">C</span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 truncate">{record.projectName}</p>
        </div>

        {/* Status buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {(["PRESENT", "LATE", "ABSENT"] as AttendanceStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => onChange({ status: s, markedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), absentReason: s !== "ABSENT" ? undefined : record.absentReason })}
              className={cn(
                "flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-all",
                record.status === s
                  ? STATUS_CONFIG[s].btn
                  : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
              )}
            >
              {STATUS_CONFIG[s].icon}
              {s === "PRESENT" ? "Present" : s === "LATE" ? "Late" : "Absent"}
            </button>
          ))}
        </div>
      </div>

      {/* Absent reason */}
      {record.status === "ABSENT" && (
        <div className="mt-2 ml-11">
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
  const presentCount = records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const pendingCount = records.filter((r) => r.status === "PENDING").length;
  const hasLeadPresent = records.some((r) => r.role === "LEAD" && (r.status === "PRESENT" || r.status === "LATE"));

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
            <span>{presentCount}/{records.length} in meeting</span>
          </div>
        </div>

        {/* Quorum warning */}
        {!hasLeadPresent && (
          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-100 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Lead not yet marked present — quorum pending
          </div>
        )}

        {/* Progress bar */}
        <div className="mt-2 h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              side === "closing" ? "bg-amber-400" : "bg-emerald-400"
            )}
            style={{ width: records.length ? `${((records.length - pendingCount) / records.length) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {/* Attendee rows */}
      <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-0.5">
        {records.map((r) => (
          <AttendeeRow
            key={r.userId}
            record={r}
            onChange={(updated) => onChange(r.userId, updated)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

interface Props {
  /** Called whenever attendance changes — parent can read latest state */
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

  const closingQuorum = quorumMet(closingRecords);
  const openingQuorum = quorumMet(openingRecords);
  const allQuorum = closingQuorum && openingQuorum;

  const totalMarked =
    [...closingRecords, ...openingRecords].filter((r) => r.status !== "PENDING").length;
  const total = closingRecords.length + openingRecords.length;

  return (
    <div className="space-y-3">
      {/* Section header */}
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

        {/* Overall status badge */}
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

      {/* Two columns */}
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
