"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
    submittedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
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
    submittedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
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
    submittedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
];

function getLocalSubmissions(): MemberSubmission[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}

function getAllSubmissions(): MemberSubmission[] {
  const local = getLocalSubmissions();
  const localUserIds = new Set(local.map((s) => s.userId));
  const seeds = SEED_SUBMISSIONS.filter((s) => !localUserIds.has(s.userId));
  return [...seeds, ...local].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

interface Props { user: SessionUser; }

export function CompileHandoverClient({ user }: Props) {
  const [submissions, setSubmissions] = useState<MemberSubmission[]>([]);
  const [form, setForm] = useState({ openItemsSummary: "", resolvedSummary: "", leadNotes: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => { setSubmissions(getAllSubmissions()); }, []);

  function autoFill() {
    const open     = submissions.map((s) => `• [${s.userName}] ${s.openItems}`).join("\n");
    const resolved = submissions.map((s) => `• [${s.userName}] ${s.resolvedItems}`).join("\n");
    const notes    = submissions.filter((s) => s.notes).map((s) => `[${s.userName}] ${s.notes}`).join("\n");
    setForm((f) => ({
      openItemsSummary: open     || f.openItemsSummary,
      resolvedSummary:  resolved || f.resolvedSummary,
      leadNotes:        notes    || f.leadNotes,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // In production this would call a server action / DB write.
    // For POC: clear submissions and show success.
    localStorage.removeItem(STORAGE_KEY);
    setSaved(true);
  }

  if (saved) {
    return (
      <div className="p-6 max-w-xl">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-10 text-center space-y-3">
          <p className="text-lg font-bold text-emerald-800">Handover Submitted!</p>
          <p className="text-sm text-emerald-600">The incoming shift lead will receive the handover notification.</p>
          <Link href="/dashboard/handovers" className="inline-block mt-2 text-sm text-indigo-600 hover:underline">
            ← Back to Handovers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <Link href="/dashboard/handovers" className="text-sm text-indigo-600 hover:underline">
          ← Back to Handovers
        </Link>
        <h1 className="mt-3 text-xl font-bold text-gray-900">Compile Handover</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Review team member updates and write the final shift handover summary.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Team submissions sidebar */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border bg-white sticky top-4">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-sm font-semibold text-gray-700">
                Team Updates{" "}
                <span className="text-gray-400 font-normal">({submissions.length})</span>
              </h2>
              {submissions.length > 0 && (
                <button
                  type="button"
                  onClick={autoFill}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Auto-fill →
                </button>
              )}
            </div>

            {submissions.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">
                No member submissions yet. Ask team members to submit their updates first.
              </div>
            ) : (
              <div className="divide-y max-h-[65vh] overflow-y-auto">
                {submissions.map((sub) => (
                  <div key={sub.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-800">{sub.userName}</p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(sub.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {sub.openItems && (
                      <div>
                        <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide">Open</p>
                        <p className="text-xs text-gray-600 mt-0.5">{sub.openItems}</p>
                      </div>
                    )}
                    {sub.resolvedItems && (
                      <div>
                        <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Resolved</p>
                        <p className="text-xs text-gray-600 mt-0.5">{sub.resolvedItems}</p>
                      </div>
                    )}
                    {sub.notes && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Notes</p>
                        <p className="text-xs text-gray-600 mt-0.5">{sub.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Compile form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="rounded-lg border bg-white p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Open Items Summary <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={form.openItemsSummary}
                onChange={(e) => setForm((f) => ({ ...f, openItemsSummary: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[110px]"
                placeholder="Compiled open items from team — add your lead perspective and priorities…"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Resolved This Shift <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={form.resolvedSummary}
                onChange={(e) => setForm((f) => ({ ...f, resolvedSummary: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[110px]"
                placeholder="Compiled resolved items from team…"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Lead Summary &amp; Escalation Notes
              </label>
              <textarea
                value={form.leadNotes}
                onChange={(e) => setForm((f) => ({ ...f, leadNotes: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                placeholder="Your lead-level summary, escalations, or watch-points for the incoming shift lead…"
              />
            </div>

            <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <strong>30-minute SLA:</strong> The incoming lead must acknowledge this handover within 30 minutes. Unacknowledged handovers auto-escalate.
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                className="flex-1 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Submit Handover
              </button>
              <Link
                href="/dashboard/handovers"
                className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 text-center"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
