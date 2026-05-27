"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2, XCircle, ChevronDown, ChevronUp,
  LogIn, LogOut, Clock, Users, AlertTriangle, UserCheck,
  BarChart2, Wifi, ArrowLeftRight, Timer,
} from "lucide-react";
import type { SessionUser, MemberSubmission } from "@/types";
import { cn } from "@/lib/utils";
import { LiveShiftMonitor } from "@/components/roster/LiveShiftMonitor";
import { PageShell } from "@/components/layout/PageShell";

const STORAGE_KEY = "sb_member_submissions";

// ── Member submission seeds ───────────────────────────────────

const SEED_SUBMISSIONS: MemberSubmission[] = [
  {
    id: "seed_sub_01", userId: "u_bp_01", userName: "Kiran Reddy",
    projectId: "proj_browse", projectName: "Browse + Profile", shift: "Morning",
    openItems: "INC0034512 — Product search returning stale cache results on /search?q=shoes. Intermittent, ~20% of requests.",
    resolvedItems: "INC0034489 — Customer profile page 500 error resolved by reverting bad CDN config. Validated by QA.",
    notes: "Keep an eye on Redis eviction alerts — spiked twice between 09:00–10:30 IST.",
    submittedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: "seed_sub_02", userId: "u_ck_02", userName: "Priya Nair",
    projectId: "proj_checkout", projectName: "Checkout + Bag", shift: "Morning",
    openItems: "INC0034521 — Bag count badge not updating on iOS Safari v17. PagerDuty P3 still open.",
    resolvedItems: "INC0034490 — Promo code SUMMER20 cart miscalculation fixed. Hotfix deployed 08:45 IST.",
    notes: "Deployment freeze lifted at 10:00. Safe to push cart v2 if QA signs off.",
    submittedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
  },
  {
    id: "seed_sub_03", userId: "u_bp_03", userName: "Arjun Menon",
    projectId: "proj_payment_core", projectName: "OnlinePayment + Core", shift: "Morning",
    openItems: "No open P1/P2. One P4 — duplicate order-confirmation emails (INC0034515).",
    resolvedItems: "Stripe webhook retry storm handled. 312 duplicate charge events discarded.",
    notes: "",
    submittedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
];

// ── Attendance types ──────────────────────────────────────────

interface AttendeeEntry {
  name: string;
  role: "LEAD" | "EMPLOYEE" | "CONTRACTOR";
  isActingLead?: boolean;
  present: boolean;
  absentReason?: string;
  clockIn?: string;
  clockOut?: string;
}

interface ShiftAttendance {
  shiftLabel: string;
  attendees: AttendeeEntry[];
  quorumMet: boolean;
}

interface LeadHandoverRecord {
  id: string;
  leadName: string;
  project: string;
  shiftFrom: string;
  shiftTo: string;
  status: "SUBMITTED" | "ACKNOWLEDGED" | "DISPUTED";
  submittedAt: string;
  openItemsSummary: string;
  resolvedSummary: string;
  leadNotes: string;
  closing: ShiftAttendance;
  opening: ShiftAttendance;
}

function t(h: number, m: number) {
  const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString();
}

// ── Seed handover records with full attendance ────────────────

const SEED_LEAD_HANDOVERS: LeadHandoverRecord[] = [
  {
    // S1 → S2 handover compiled by Ankit Singh (Shift1 lead, temp)
    id: "lh_01",
    leadName: "Ankit Singh",
    project: "Payment Core",
    shiftFrom: "S1 · Morning",
    shiftTo: "S2 · Afternoon",
    status: "ACKNOWLEDGED",
    submittedAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    openItemsSummary: "• INC0034515 — Duplicate order-confirmation emails (P4). Rate ~0.3%.\n• INC0034518 — Intermittent 504s on /checkout/confirm (P2). Load balancer team engaged.",
    resolvedSummary: "• Stripe webhook retry storm (06:15–07:00 IST) contained. 312 duplicate events discarded.\n• PagerDuty alert PD-A8X3K closed after payment latency normalised.",
    leadNotes: "Watch INC0034518 closely — if 504s breach 2% error rate, escalate to infra. Deploy window 14:00–15:00 IST.",
    closing: {
      // S1 members — Ankit Singh is lead (temp)
      shiftLabel: "S1 · Morning (05:30–13:30)", quorumMet: true,
      attendees: [
        { name: "Ankit Singh",    role: "LEAD",     present: true,  clockIn: t(5,33),  clockOut: t(13,28) },
        { name: "Rajbir Syal",    role: "EMPLOYEE", present: true,  clockIn: t(5,27),  clockOut: t(13,29) },
        { name: "Sonam Bhardwaj", role: "EMPLOYEE", present: true,  clockIn: t(5,29),  clockOut: t(13,31) },
        { name: "Meenu Singh",    role: "EMPLOYEE", present: true,  clockIn: t(5,35),  clockOut: t(13,30) },
        { name: "Manish Kumar",   role: "EMPLOYEE", present: false, absentReason: "On Leave" },
        { name: "Karthik Sharma", role: "EMPLOYEE", present: true,  clockIn: t(5,40),  clockOut: t(13,32) },
      ],
    },
    opening: {
      // S2 members — Prateek Agarwal is lead
      shiftLabel: "S2 · Afternoon (13:30–21:30)", quorumMet: true,
      attendees: [
        { name: "Prateek Agarwal",  role: "LEAD",     present: true,  clockIn: t(13,27) },
        { name: "Rajeev Kumar",     role: "EMPLOYEE", present: true,  clockIn: t(13,32) },
        { name: "Abhinandan Patil", role: "EMPLOYEE", present: true,  clockIn: t(13,28) },
        { name: "Samadhan Jadhav",  role: "EMPLOYEE", present: false, absentReason: "WFH – Connectivity Issue" },
        { name: "Amit Sharma",      role: "EMPLOYEE", present: true,  clockIn: t(13,29) },
        { name: "Ankit Bisht",      role: "EMPLOYEE", present: true,  clockIn: t(13,31) },
      ],
    },
  },
  {
    // S2 → S3 handover compiled by Prateek Agarwal (Shift2 lead)
    id: "lh_02",
    leadName: "Prateek Agarwal",
    project: "Browse + Profile",
    shiftFrom: "S2 · Afternoon",
    shiftTo: "S3 · Night",
    status: "SUBMITTED",
    submittedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    openItemsSummary: "• INC0034512 — Stale search cache on /search (P3), ~20% requests. Redis flush carry-over.\n• INC0034527 — Profile image upload failing >5 MB (P4). Storage team ticket open.",
    resolvedSummary: "• INC0034489 — CDN config rollback completed. Profile page 500s cleared.\n• Routine DB vacuum completed — performance back to baseline.",
    leadNotes: "Redis flush must happen before 08:00 IST or search SLA will breach. MadhaviLatha to confirm.",
    closing: {
      // S2 members — Prateek Agarwal is lead
      shiftLabel: "S2 · Afternoon (13:30–21:30)", quorumMet: true,
      attendees: [
        { name: "Prateek Agarwal",  role: "LEAD",     present: true,  clockIn: t(13,27), clockOut: t(21,29) },
        { name: "Amit Sharma",      role: "EMPLOYEE", present: true,  clockIn: t(13,29), clockOut: t(21,31) },
        { name: "Debashish Ray",    role: "EMPLOYEE", present: false, absentReason: "No Show" },
        { name: "P C Vijay Kiran",  role: "EMPLOYEE", present: true,  clockIn: t(13,30), clockOut: t(21,30) },
        { name: "Brahmateja K",     role: "EMPLOYEE", present: true,  clockIn: t(13,32), clockOut: t(21,28) },
        { name: "Samadhan Jadhav",  role: "EMPLOYEE", present: true,  clockIn: t(13,35), clockOut: t(21,33) },
      ],
    },
    opening: {
      // S3 members — MadhaviLatha is lead (absent → Dipak acting lead)
      shiftLabel: "S3 · Night (21:30–05:30)", quorumMet: true,
      attendees: [
        { name: "MadhaviLatha K",    role: "LEAD",       present: false, absentReason: "Medical Emergency" },
        { name: "Dipak Rahangadale", role: "EMPLOYEE",   present: true,  isActingLead: true, clockIn: t(21,29) },
        { name: "Brahmateja K",      role: "EMPLOYEE",   present: true,  clockIn: t(21,32) },
        { name: "Chaitanya A",       role: "CONTRACTOR", present: true,  clockIn: t(21,35) },
        { name: "Shivam Rathor",     role: "EMPLOYEE",   present: true,  clockIn: t(21,31) },
        { name: "Naveen Kodiaganti", role: "EMPLOYEE",   present: true,  clockIn: t(21,38) },
      ],
    },
  },
  {
    // S3 → S1 handover compiled by MadhaviLatha (Shift3 lead, Checkout+Bag)
    id: "lh_03",
    leadName: "MadhaviLatha K",
    project: "Checkout + Bag",
    shiftFrom: "S3 · Night",
    shiftTo: "S1 · Morning",
    status: "SUBMITTED",
    submittedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    openItemsSummary: "• INC0034521 — Bag count badge broken on iOS Safari v17 (P3). Carry-over from previous shift.\n• INC0034533 — Intermittent 503 on /bag/add for international users (P2). DNS propagation suspected.",
    resolvedSummary: "• INC0034490 — Promo code SUMMER20 cart miscalculation fully validated in prod.\n• Night batch job for cart session cleanup completed at 03:00 IST — 12k stale sessions purged.",
    leadNotes: "INC0034533 needs urgent attention at 05:30 handover — escalate to infra if still open. Ankit to coordinate.",
    closing: {
      // S3 members — MadhaviLatha is lead
      shiftLabel: "S3 · Night (21:30–05:30)", quorumMet: true,
      attendees: [
        { name: "MadhaviLatha K",    role: "LEAD",       present: true,  clockIn: t(21,28), clockOut: t(5,31) },
        { name: "Shivam Rathor",     role: "EMPLOYEE",   present: true,  clockIn: t(21,31), clockOut: t(5,30) },
        { name: "Dipak Rahangadale", role: "EMPLOYEE",   present: true,  clockIn: t(21,29), clockOut: t(5,28) },
        { name: "Chaitanya A",       role: "CONTRACTOR", present: false, absentReason: "Sick Leave" },
        { name: "Karthikay Gupta",   role: "EMPLOYEE",   present: true,  clockIn: t(21,33), clockOut: t(5,34) },
        { name: "Vinodh Darangula",  role: "EMPLOYEE",   present: true,  clockIn: t(21,35), clockOut: t(5,29) },
      ],
    },
    opening: {
      // S1 members — Ankit Singh is lead (temp)
      shiftLabel: "S1 · Morning (05:30–13:30)", quorumMet: true,
      attendees: [
        { name: "Ankit Singh",    role: "LEAD",     present: true,  clockIn: t(5,33) },
        { name: "Rajbir Syal",    role: "EMPLOYEE", present: true,  clockIn: t(5,27) },
        { name: "Sonam Bhardwaj", role: "EMPLOYEE", present: true,  clockIn: t(5,29) },
        { name: "Meenu Singh",    role: "EMPLOYEE", present: true,  clockIn: t(5,35) },
        { name: "Karthik Sharma", role: "EMPLOYEE", present: false, absentReason: "On Leave" },
        { name: "Manish Kumar",   role: "EMPLOYEE", present: true,  clockIn: t(5,40) },
      ],
    },
  },
];

// ── Status styles ─────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  DRAFT:        "bg-gray-100 text-gray-700",
  SUBMITTED:    "bg-amber-100 text-amber-800",
  ACKNOWLEDGED: "bg-emerald-100 text-emerald-700",
  DISPUTED:     "bg-red-100 text-red-700",
};

// ── Helpers ───────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}
function durStr(cin: string, cout: string) {
  const ms = new Date(cout).getTime() - new Date(cin).getTime();
  const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Attendance column ─────────────────────────────────────────

function AttendanceColumn({ data, side }: { data: ShiftAttendance; side: "closing" | "opening" }) {
  const presentCount = data.attendees.filter(a => a.present).length;
  return (
    <div className={cn(
      "flex-1 rounded-xl border-2 p-3 space-y-2",
      side === "closing" ? "border-amber-200 bg-amber-50/40" : "border-emerald-200 bg-emerald-50/40"
    )}>
      {/* Column header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold",
            side === "closing" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")}>
            {side === "closing" ? "Closing Shift" : "Opening Shift"}
          </span>
          <p className="text-[10px] text-gray-500 mt-0.5">{data.shiftLabel}</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <Users className="h-3 w-3 text-gray-400" />
          <span className="text-gray-500">{presentCount}/{data.attendees.length}</span>
          {data.quorumMet
            ? <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700"><CheckCircle2 className="h-2.5 w-2.5" /> Quorum</span>
            : <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[8px] font-bold text-red-700"><AlertTriangle className="h-2.5 w-2.5" /> No quorum</span>
          }
        </div>
      </div>

      {/* Attendee rows */}
      <div className="space-y-1">
        {data.attendees.map((a) => (
          <div key={a.name} className={cn(
            "rounded-lg border px-2.5 py-1.5",
            !a.present ? "border-red-100 bg-red-50/60" :
            a.isActingLead ? "border-amber-200 bg-amber-50" :
            "border-gray-100 bg-white"
          )}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={cn(
                  "h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold",
                  a.role === "LEAD" ? "bg-indigo-100 text-indigo-700" :
                  a.role === "CONTRACTOR" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"
                )}>
                  {a.name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase()}
                </span>
                <span className="text-[11px] font-medium text-gray-800 truncate">{a.name}</span>
                {a.role === "LEAD" && !a.isActingLead && (
                  <span className="shrink-0 rounded-full bg-indigo-100 px-1 py-0.5 text-[8px] font-bold text-indigo-700">LEAD</span>
                )}
                {a.isActingLead && (
                  <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-amber-100 border border-amber-300 px-1.5 py-0.5 text-[8px] font-bold text-amber-700">
                    <UserCheck className="h-2.5 w-2.5" /> Acting Lead
                  </span>
                )}
                {a.role === "CONTRACTOR" && !a.isActingLead && (
                  <span className="shrink-0 rounded-full bg-purple-100 px-1 py-0.5 text-[8px] font-bold text-purple-700">C</span>
                )}
              </div>
              {a.present
                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
              }
            </div>

            {/* Clock times */}
            {a.present && a.clockIn && (
              <div className="mt-0.5 ml-7 flex items-center gap-2 flex-wrap text-[10px]">
                <span className="flex items-center gap-0.5 text-emerald-700"><LogIn className="h-2.5 w-2.5" />{fmtTime(a.clockIn)}</span>
                {a.clockOut
                  ? <>
                      <span className="flex items-center gap-0.5 text-red-600"><LogOut className="h-2.5 w-2.5" />{fmtTime(a.clockOut)}</span>
                      <span className="flex items-center gap-0.5 text-gray-400"><Clock className="h-2.5 w-2.5" />{durStr(a.clockIn, a.clockOut)}</span>
                    </>
                  : <span className="flex items-center gap-0.5 text-indigo-500"><span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />Active</span>
                }
              </div>
            )}

            {/* Absent reason */}
            {!a.present && a.absentReason && (
              <p className="mt-0.5 ml-7 text-[10px] text-red-500 italic">{a.absentReason}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Manager handover card ─────────────────────────────────────

function ManagerHandoverCard({
  lh,
  onAcknowledge,
}: {
  lh: LeadHandoverRecord;
  onAcknowledge: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const closingPresent = lh.closing.attendees.filter(a => a.present).length;
  const openingPresent = lh.opening.attendees.filter(a => a.present).length;
  const actingLead = lh.opening.attendees.find(a => a.isActingLead);
  const absentLead = lh.opening.attendees.find(a => a.role === "LEAD" && !a.present);

  return (
    <div className="border-b last:border-b-0">
      <div className="px-5 py-4 space-y-3">
        {/* Row 1: header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{lh.leadName}</span>
            <span className="text-xs text-gray-300">·</span>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{lh.project}</span>
            <span className="text-xs text-gray-400">{lh.shiftFrom} → {lh.shiftTo}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLES[lh.status] ?? "bg-gray-100 text-gray-700")}>
              {lh.status}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(lh.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {lh.status === "SUBMITTED" && (
              <button
                onClick={() => onAcknowledge(lh.id)}
                className="rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                Acknowledge
              </button>
            )}
            {lh.status === "ACKNOWLEDGED" && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> Acknowledged
              </span>
            )}
          </div>
        </div>

        {/* Row 2: attendance summary chips */}
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 text-gray-500">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Closing</span>
            <span>{closingPresent}/{lh.closing.attendees.length} present</span>
            {lh.closing.quorumMet
              ? <span className="text-emerald-600 font-semibold">✓ Quorum</span>
              : <span className="text-red-500 font-semibold">✗ No quorum</span>}
          </div>
          <span className="text-gray-200">|</span>
          <div className="flex items-center gap-1.5 text-gray-500">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Opening</span>
            <span>{openingPresent}/{lh.opening.attendees.length} present</span>
            {lh.opening.quorumMet
              ? <span className="text-emerald-600 font-semibold">✓ Quorum</span>
              : <span className="text-red-500 font-semibold">✗ No quorum</span>}
          </div>
          {actingLead && absentLead && (
            <>
              <span className="text-gray-200">|</span>
              <span className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-700">
                <UserCheck className="h-3 w-3" />
                {absentLead.name} absent → <strong>{actingLead.name}</strong> acting lead
              </span>
            </>
          )}
        </div>

        {/* Expand toggle */}
        <button onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? "Hide attendance details" : "View attendance details"}
        </button>
      </div>

      {/* Expanded attendance */}
      {expanded && (
        <div className="px-5 pb-4 flex gap-3">
          <AttendanceColumn data={lh.closing} side="closing" />
          <AttendanceColumn data={lh.opening} side="opening" />
        </div>
      )}

      {/* Handover content */}
      <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <p className="font-semibold text-red-500 uppercase tracking-wide mb-1">Open Items</p>
          <p className="text-gray-600 whitespace-pre-line">{lh.openItemsSummary}</p>
        </div>
        <div>
          <p className="font-semibold text-emerald-600 uppercase tracking-wide mb-1">Resolved</p>
          <p className="text-gray-600 whitespace-pre-line">{lh.resolvedSummary}</p>
        </div>
        <div>
          <p className="font-semibold text-gray-400 uppercase tracking-wide mb-1">Lead Notes</p>
          <p className="text-gray-600">{lh.leadNotes}</p>
        </div>
      </div>
    </div>
  );
}

// ── Shift Cycle Timeline ──────────────────────────────────────

interface SlotStatus { label: string; done: boolean; active: boolean; upcoming: boolean; countdownMs: number; handoverAt: string; }

function getShiftSlots(): SlotStatus[] {
  const now = new Date();
  const istStr = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "numeric", hour12: false }).format(now);
  const [h, m] = istStr.split(":").map(Number);
  const todayMin = h * 60 + m;

  // Handover times in IST minutes from midnight
  const slots = [
    { label: "S3 → S1", handoverAt: "05:30", atMin: 5 * 60 + 30 },
    { label: "S1 → S2", handoverAt: "13:30", atMin: 13 * 60 + 30 },
    { label: "S2 → S3", handoverAt: "21:30", atMin: 21 * 60 + 30 },
  ];

  return slots.map(slot => {
    const diffMin = slot.atMin - todayMin;
    const done = diffMin < -30;
    const active = diffMin >= -30 && diffMin <= 30;
    const upcoming = diffMin > 30;
    const countdownMs = diffMin > 0 ? diffMin * 60 * 1000 : 0;
    return { ...slot, done, active, upcoming, countdownMs };
  });
}

function Countdown({ ms }: { ms: number }) {
  const [remaining, setRemaining] = useState(ms);
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining(r => Math.max(0, r - 1000)), 1000);
    return () => clearInterval(id);
  }, [remaining]);
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  if (h > 0) return <span>{h}h {m}m</span>;
  if (m > 0) return <span className={m < 10 ? "text-amber-600 font-bold" : ""}>{m}m {s}s</span>;
  return <span className="text-red-600 font-bold animate-pulse">{s}s</span>;
}

function ShiftCycleTimeline() {
  const [slots, setSlots] = useState<SlotStatus[]>(() => getShiftSlots());
  useEffect(() => {
    const id = setInterval(() => setSlots(getShiftSlots()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-xl border bg-white px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <Timer className="h-4 w-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-gray-700">Today&apos;s Shift Cycle</h2>
        <span className="text-xs text-gray-400 ml-auto">All times IST</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {slots.map(slot => (
          <div key={slot.label} className={cn(
            "relative rounded-lg border-2 px-4 py-3 text-center transition-all",
            slot.done    && "border-gray-100 bg-gray-50 opacity-60",
            slot.active  && "border-indigo-300 bg-indigo-50 shadow-sm",
            slot.upcoming && "border-dashed border-gray-200 bg-white",
          )}>
            {slot.active && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-bold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> LIVE
              </span>
            )}
            <p className="text-xs font-bold text-gray-700">{slot.label}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">at {slot.handoverAt}</p>
            <div className="mt-2 text-sm font-semibold">
              {slot.done && <span className="flex items-center justify-center gap-1 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Done</span>}
              {slot.active && <span className="text-indigo-600 flex items-center justify-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" /> Now</span>}
              {slot.upcoming && <span className="text-gray-500 flex items-center justify-center gap-1 text-xs"><Clock className="h-3 w-3" /> in <Countdown ms={slot.countdownMs} /></span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Local storage helpers ─────────────────────────────────────

function getLocalSubmissions(): MemberSubmission[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}
function getAllSubmissions(): MemberSubmission[] {
  const local = getLocalSubmissions();
  const localUserIds = new Set(local.map(s => s.userId));
  const seeds = SEED_SUBMISSIONS.filter(s => !localUserIds.has(s.userId));
  return [...seeds, ...local].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}
function saveSubmission(sub: MemberSubmission) {
  const existing = getLocalSubmissions().filter(s => s.userId !== sub.userId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, sub]));
}

// ── Main component ────────────────────────────────────────────

interface Props { user: SessionUser; }

type HubTab = "overview" | "live";

export function HandoversClient({ user }: Props) {
  const [tab, setTab] = useState<HubTab>("overview");
  const [submissions, setSubmissions] = useState<MemberSubmission[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ openItems: "", resolvedItems: "", notes: "" });
  const [handovers, setHandovers] = useState<LeadHandoverRecord[]>(SEED_LEAD_HANDOVERS);

  const isLeadOrAbove = user.role === "LEAD" || user.role === "MANAGER";
  const showLiveTab = isLeadOrAbove;

  function handleAcknowledge(id: string) {
    setHandovers(prev =>
      prev.map(h => h.id === id ? { ...h, status: "ACKNOWLEDGED" as const } : h)
    );
  }

  const isContributor = user.role === "CONTRACTOR" || user.role === "EMPLOYEE";

  useEffect(() => {
    const subs = getAllSubmissions();
    setSubmissions(subs);
    const mine = subs.find(s => s.userId === user.id);
    if (mine) setForm({ openItems: mine.openItems, resolvedItems: mine.resolvedItems, notes: mine.notes });
  }, [user.id]);

  const mySubmission = submissions.find(s => s.userId === user.id);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sub: MemberSubmission = {
      id: `sub_${Date.now()}`, userId: user.id, userName: user.name,
      projectId: user.activeProjectId ?? "proj_browse",
      projectName: "Browse + Profile", shift: "Current",
      ...form, submittedAt: new Date().toISOString(),
    };
    saveSubmission(sub);
    setSubmissions(getAllSubmissions());
    setShowModal(false);
  }

  const headerActions = (
    <>
      {user.role === "MANAGER" && (
        <>
          <Link href="/dashboard/handovers/reports"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <BarChart2 className="h-4 w-4" />
            Reports
          </Link>
          <Link href="/dashboard/handovers/report"
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download
          </Link>
        </>
      )}
      {isContributor && (
        <button onClick={() => setShowModal(true)}
          className={cn("inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors",
            mySubmission ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700")}>
          {mySubmission ? "✓ Edit My Update" : "+ Submit My Update"}
        </button>
      )}
      {user.role === "LEAD" && (
        <Link href="/dashboard/handovers/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Compile Handover
        </Link>
      )}
    </>
  );

  const tabBar = showLiveTab ? (
    <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
      <button
        onClick={() => setTab("overview")}
        className={cn("flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
          tab === "overview" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
        )}
      >
        <ArrowLeftRight className="h-3.5 w-3.5" /> Handovers
      </button>
      <button
        onClick={() => setTab("live")}
        className={cn("flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
          tab === "live" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
        )}
      >
        <Wifi className="h-3.5 w-3.5" />
        Live Shifts
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      </button>
    </div>
  ) : undefined;

  return (
    <PageShell
      title="Shift Hub"
      subtitle={isContributor
        ? "Submit your shift update so your lead can compile the handover."
        : "Live shift monitoring, handover records, and team submissions."}
      actions={headerActions}
      headerExtra={tabBar}
      maxWidth="max-w-5xl"
    >
      <div className="space-y-5">

      {/* Shift Cycle Timeline — always visible */}
      <ShiftCycleTimeline />

      {/* Live Shifts tab */}
      {tab === "live" && showLiveTab && (
        <div className="rounded-xl border bg-white overflow-hidden">
          <LiveShiftMonitor currentUser={user} />
        </div>
      )}

      {/* Overview tab content (or default for employee/contractor) */}
      {(tab === "overview" || !showLiveTab) && <>

      {/* My submission banner */}
      {isContributor && mySubmission && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-emerald-800">Your shift update was submitted</p>
            <span className="text-xs text-emerald-500">
              {new Date(mySubmission.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="text-xs text-emerald-700 space-y-0.5">
            <p><strong>Open items:</strong> {mySubmission.openItems || "—"}</p>
            <p><strong>Resolved:</strong> {mySubmission.resolvedItems || "—"}</p>
            {mySubmission.notes && <p><strong>Notes to lead:</strong> {mySubmission.notes}</p>}
          </div>
        </div>
      )}

      {/* Team submissions — LEAD only */}
      {user.role === "LEAD" && (
        <div className="rounded-lg border bg-white">
          <div className="flex items-center justify-between px-5 py-3.5 border-b">
            <h2 className="text-sm font-semibold text-gray-700">
              Team Submissions <span className="ml-1 text-gray-400 font-normal">({submissions.length})</span>
            </h2>
            {submissions.length > 0 && user.role === "LEAD" && (
              <Link href="/dashboard/handovers/new" className="text-xs text-indigo-600 hover:underline">Compile handover →</Link>
            )}
          </div>
          {submissions.length === 0
            ? <div className="p-8 text-center text-sm text-gray-400">No member submissions yet.</div>
            : <div className="divide-y">
                {submissions.map(sub => (
                  <div key={sub.id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{sub.userName}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(sub.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {sub.openItems && <div><p className="font-medium text-red-600 mb-0.5">Open Items</p><p className="text-gray-600">{sub.openItems}</p></div>}
                      {sub.resolvedItems && <div><p className="font-medium text-emerald-600 mb-0.5">Resolved</p><p className="text-gray-600">{sub.resolvedItems}</p></div>}
                      {sub.notes && <div><p className="font-medium text-gray-500 mb-0.5">Notes to Lead</p><p className="text-gray-600">{sub.notes}</p></div>}
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {/* Manager: Shift Lead Submissions with attendance + acknowledge */}
      {user.role === "MANAGER" && (
        <div className="rounded-lg border bg-white">
          <div className="flex items-center justify-between px-5 py-3.5 border-b">
            <h2 className="text-sm font-semibold text-gray-700">
              Handover Records{" "}
              <span className="ml-1 text-gray-400 font-normal">({handovers.length})</span>
            </h2>
            <span className="text-xs text-gray-400">Today&apos;s shift cycle</span>
          </div>
          <div>
            {handovers.map(lh => (
              <ManagerHandoverCard key={lh.id} lh={lh} onAcknowledge={handleAcknowledge} />
            ))}
          </div>
        </div>
      )}

      </> /* end overview tab */}

      </div>

      {/* Submit Update Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-base font-semibold text-gray-900">Submit My Shift Update</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Open Items <span className="text-red-500">*</span></label>
                <textarea required value={form.openItems} onChange={e => setForm(f => ({ ...f, openItems: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                  placeholder="Describe any unresolved items, active incidents, or blockers…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Resolved This Shift <span className="text-red-500">*</span></label>
                <textarea required value={form.resolvedItems} onChange={e => setForm(f => ({ ...f, resolvedItems: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                  placeholder="What was resolved or completed during your shift…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes for Lead</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[60px]"
                  placeholder="Anything the lead should know or watch out for…" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" className="flex-1 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
                  {mySubmission ? "Update Submission" : "Submit Update"}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
}
