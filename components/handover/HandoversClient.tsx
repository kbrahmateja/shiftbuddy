"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MOCK_HANDOVERS, MOCK_USERS } from "@/lib/mock-data";
import type { SessionUser, MemberSubmission } from "@/types";

const STORAGE_KEY = "sb_member_submissions";

const SEED_SUBMISSIONS: MemberSubmission[] = [
  {
    id: "seed_sub_01",
    userId: "u_bp_01",
    userName: "Kiran Reddy",
    projectId: "proj_browse",
    projectName: "Browse + Profile",
    shift: "Morning",
    openItems: "INC0034512 — Product search returning stale cache results on /search?q=shoes. Intermittent, ~20% of requests. Raised with infra team, no fix yet.",
    resolvedItems: "INC0034489 — Customer profile page 500 error resolved by reverting bad CDN config deployed yesterday. Validated by QA.",
    notes: "Keep an eye on the Redis eviction alerts — they spiked twice between 09:00–10:30 IST. Threshold may need tuning.",
    submittedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 min ago
  },
  {
    id: "seed_sub_02",
    userId: "u_ck_02",
    userName: "Priya Nair",
    projectId: "proj_checkout",
    projectName: "Checkout + Bag",
    shift: "Morning",
    openItems: "INC0034521 — Bag count badge not updating on iOS Safari v17. Reproducible. PagerDuty alert P3_MEDIUM still open.",
    resolvedItems: "INC0034490 — Promo code SUMMER20 causing cart total miscalculation fixed. Hotfix deployed at 08:45 IST. SN ticket CHG0034101 closed.",
    notes: "Deployment freeze lifted at 10:00. Safe to push the cart v2 diff if QA signs off.",
    submittedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(), // 18 min ago
  },
  {
    id: "seed_sub_03",
    userId: "u_bp_03",
    userName: "Arjun Menon",
    projectId: "proj_payment_core",
    projectName: "OnlinePayment + Core",
    shift: "Morning",
    openItems: "No open P1/P2 items. One P4 — duplicate email notifications for order confirmation (INC0034515, low traffic impact).",
    resolvedItems: "Stripe webhook retry storm from 06:15–07:00 IST handled. Rate limit adjusted. 312 duplicate charge events discarded safely.",
    notes: "",
    submittedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
  },
];

interface LeadHandoverRecord {
  id: string;
  leadName: string;
  project: string;
  shiftFrom: string;
  shiftTo: string;
  status: "SUBMITTED" | "ACKNOWLEDGED" | "DISPUTED";
  submittedAt: string; // ISO
  openItemsSummary: string;
  resolvedSummary: string;
  leadNotes: string;
  memberCount: number;
}

const SEED_LEAD_HANDOVERS: LeadHandoverRecord[] = [
  {
    id: "lh_01",
    leadName: "MadhaviLatha K",
    project: "Checkout + Bag",
    shiftFrom: "Morning (05:30–14:30)",
    shiftTo: "Afternoon (13:30–22:30)",
    status: "ACKNOWLEDGED",
    submittedAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(), // 55 min ago
    openItemsSummary:
      "• INC0034521 — Bag count badge broken on iOS Safari v17 (P3). Owned by Priya Nair, no ETA.\n• INC0034518 — Intermittent 504s on /checkout/confirm during peak (P2). Load balancer team engaged.",
    resolvedSummary:
      "• INC0034490 — Promo code SUMMER20 cart miscalculation hotfix deployed & validated. CHG0034101 closed.\n• INC0034503 — Payment timeout spike (07:00–08:15 IST) root-caused to upstream Stripe latency; auto-resolved.",
    leadNotes:
      "Incoming lead: watch INC0034518 closely — if 504s breach 2% error rate again, escalate to infra immediately. Deploy window open 14:00–15:00 IST for cart v2.",
    memberCount: 4,
  },
  {
    id: "lh_02",
    leadName: "Prateek Agarwal",
    project: "Browse + Profile",
    shiftFrom: "Night (21:30–06:30)",
    shiftTo: "Morning (05:30–14:30)",
    status: "SUBMITTED",
    submittedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
    openItemsSummary:
      "• INC0034512 — Stale search cache on /search (P3), ~20% requests affected. Redis flush scheduled 06:00 IST — not yet executed, carry over.\n• INC0034527 — Profile image upload failing for files >5 MB (P4). Ticket open with storage team.",
    resolvedSummary:
      "• INC0034489 — CDN config rollback completed 23:45 IST; profile page 500s cleared. Validated by 3 QA runs.\n• Routine DB vacuum completed 02:30 IST — query performance back to baseline.",
    leadNotes:
      "Redis flush must happen before 08:00 IST or search SLA will breach. Confirm with Kiran Reddy on morning shift.",
    memberCount: 3,
  },
  {
    id: "lh_03",
    leadName: "MadhaviLatha K",
    project: "OnlinePayment + Core",
    shiftFrom: "Morning (05:30–14:30)",
    shiftTo: "Afternoon (13:30–22:30)",
    status: "SUBMITTED",
    submittedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(), // 12 min ago
    openItemsSummary:
      "• INC0034515 — Duplicate order-confirmation emails (P4). Rate ~0.3%, cosmetic. Eng ticket open.\n• Monitoring: Stripe webhook DLQ has 8 unprocessed events — being replayed manually.",
    resolvedSummary:
      "• Webhook retry storm (06:15–07:00 IST) contained. 312 duplicate charge events safely discarded after dedup check.\n• PagerDuty alert PD-A8X3K closed after payment latency normalised at 07:45 IST.",
    leadNotes: "No P1/P2 carry-over. DLQ replay is low-risk but check completion by 15:00.",
    memberCount: 3,
  },
];

const STATUS_STYLES: Record<string, string> = {
  DRAFT:        "bg-gray-100 text-gray-700",
  SUBMITTED:    "bg-yellow-100 text-yellow-800",
  ACKNOWLEDGED: "bg-green-100 text-green-800",
  DISPUTED:     "bg-red-100 text-red-800",
};

function getLocalSubmissions(): MemberSubmission[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}

/** Merge seed data with real localStorage submissions (localStorage overrides seed for same userId) */
function getAllSubmissions(): MemberSubmission[] {
  const local = getLocalSubmissions();
  const localUserIds = new Set(local.map((s) => s.userId));
  const seeds = SEED_SUBMISSIONS.filter((s) => !localUserIds.has(s.userId));
  return [...seeds, ...local].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

function saveSubmission(sub: MemberSubmission) {
  const existing = getLocalSubmissions().filter((s) => s.userId !== sub.userId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, sub]));
}

interface Props { user: SessionUser; }

export function HandoversClient({ user }: Props) {
  const [submissions, setSubmissions] = useState<MemberSubmission[]>([]);
  const [showModal, setShowModal]     = useState(false);
  const [form, setForm] = useState({ openItems: "", resolvedItems: "", notes: "" });

  const isContributor  = user.role === "CONTRACTOR" || user.role === "EMPLOYEE";
  const isLeadOrAbove  = user.role === "LEAD" || user.role === "MANAGER";

  useEffect(() => {
    const subs = getAllSubmissions();
    setSubmissions(subs);
    // Pre-fill form from prior submission if editing
    const mine = subs.find((s) => s.userId === user.id);
    if (mine) setForm({ openItems: mine.openItems, resolvedItems: mine.resolvedItems, notes: mine.notes });
  }, [user.id]);

  const mySubmission = submissions.find((s) => s.userId === user.id);

  function openModal() {
    const mine = getAllSubmissions().find((s) => s.userId === user.id);
    if (mine) setForm({ openItems: mine.openItems, resolvedItems: mine.resolvedItems, notes: mine.notes });
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sub: MemberSubmission = {
      id:           mySubmission?.id ?? `sub_${Date.now()}`,
      userId:       user.id,
      userName:     user.name,
      projectId:    user.activeProjectId ?? "unknown",
      projectName:  "My Project",
      shift:        "Current Shift",
      openItems:    form.openItems,
      resolvedItems: form.resolvedItems,
      notes:        form.notes,
      submittedAt:  new Date().toISOString(),
    };
    saveSubmission(sub);
    setSubmissions(getAllSubmissions());
    setShowModal(false);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Shift Handovers</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {isContributor
              ? "Submit your shift update so your lead can compile the handover."
              : "Review team submissions and compile the final shift handover."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user.role === "MANAGER" && (
            <Link
              href="/dashboard/handovers/report"
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download Report
            </Link>
          )}
          {isContributor && (
            <button
              onClick={openModal}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors ${
                mySubmission ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {mySubmission ? "✓ Edit My Update" : "+ Submit My Update"}
            </button>
          )}
          {user.role === "LEAD" && (
            <Link
              href="/dashboard/handovers/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Compile Handover
            </Link>
          )}
        </div>
      </div>

      {/* My submission banner — contractors / employees */}
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

      {/* Team submissions — LEAD / MANAGER */}
      {isLeadOrAbove && (
        <div className="rounded-lg border bg-white">
          <div className="flex items-center justify-between px-5 py-3.5 border-b">
            <h2 className="text-sm font-semibold text-gray-700">
              Team Submissions <span className="ml-1 text-gray-400 font-normal">({submissions.length})</span>
            </h2>
            {submissions.length > 0 && user.role === "LEAD" && (
              <Link href="/dashboard/handovers/new" className="text-xs text-indigo-600 hover:underline">
                Compile handover →
              </Link>
            )}
          </div>

          {submissions.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              No member submissions yet. Team members submit their shift updates here before handover.
            </div>
          ) : (
            <div className="divide-y">
              {submissions.map((sub) => (
                <div key={sub.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">{sub.userName}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(sub.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {sub.openItems && (
                      <div>
                        <p className="font-medium text-red-600 mb-0.5">Open Items</p>
                        <p className="text-gray-600">{sub.openItems}</p>
                      </div>
                    )}
                    {sub.resolvedItems && (
                      <div>
                        <p className="font-medium text-emerald-600 mb-0.5">Resolved</p>
                        <p className="text-gray-600">{sub.resolvedItems}</p>
                      </div>
                    )}
                    {sub.notes && (
                      <div>
                        <p className="font-medium text-gray-500 mb-0.5">Notes to Lead</p>
                        <p className="text-gray-600">{sub.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lead compiled handovers — MANAGER view */}
      {user.role === "MANAGER" && (
        <div className="rounded-lg border bg-white">
          <div className="flex items-center justify-between px-5 py-3.5 border-b">
            <h2 className="text-sm font-semibold text-gray-700">
              Shift Lead Submissions{" "}
              <span className="ml-1 text-gray-400 font-normal">({SEED_LEAD_HANDOVERS.length})</span>
            </h2>
            <span className="text-xs text-gray-400">Current shift cycle</span>
          </div>
          <div className="divide-y">
            {SEED_LEAD_HANDOVERS.map((lh) => {
              const statusStyle =
                lh.status === "ACKNOWLEDGED"
                  ? "bg-emerald-100 text-emerald-700"
                  : lh.status === "DISPUTED"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700";
              return (
                <div key={lh.id} className="px-5 py-4 space-y-3">
                  {/* Row header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{lh.leadName}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                        {lh.project}
                      </span>
                      <span className="text-xs text-gray-400">
                        {lh.shiftFrom} → {lh.shiftTo}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle}`}>
                        {lh.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(lh.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-xs text-gray-400">· {lh.memberCount} member updates</span>
                    </div>
                  </div>
                  {/* Content grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
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
            })}
          </div>
        </div>
      )}

      {/* Past handover records */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Handover Records</h2>
        {MOCK_HANDOVERS.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-12 text-center">
            <p className="text-sm text-gray-500">No handover records yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {MOCK_HANDOVERS.map((h) => {
              const outgoing = MOCK_USERS.find((u) => u.id === h.outgoingLeadId);
              const incoming = MOCK_USERS.find((u) => u.id === h.incomingLeadId);
              const isOverdue = !h.acknowledgedAt && !!h.dueBy && h.dueBy < new Date();
              return (
                <Link
                  key={h.id}
                  href={`/dashboard/handovers/${h.id}`}
                  className="block rounded-lg border bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[h.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {h.status}
                        </span>
                        {isOverdue && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                            OVERDUE
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {outgoing?.name ?? "Unknown"} → {incoming?.name ?? "Unknown"}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-gray-700 line-clamp-2">{h.openItemsSummary}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {h.dueBy && (
                        <p className="text-xs text-gray-400">
                          Due {h.dueBy.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                      {h.submittedAt && (
                        <p className="text-xs text-gray-400">
                          Submitted {h.submittedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Open Items <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={form.openItems}
                  onChange={(e) => setForm((f) => ({ ...f, openItems: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                  placeholder="Describe any unresolved items, active incidents, or blockers…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Resolved This Shift <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={form.resolvedItems}
                  onChange={(e) => setForm((f) => ({ ...f, resolvedItems: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                  placeholder="What was resolved or completed during your shift…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes for Lead</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[60px]"
                  placeholder="Anything specific the lead should know or watch out for…"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  className="flex-1 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {mySubmission ? "Update Submission" : "Submit Update"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
