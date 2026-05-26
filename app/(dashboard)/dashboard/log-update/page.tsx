export const runtime = 'edge';

import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MOCK_PROJECTS } from "@/lib/mock-data";

export default async function LogUpdatePage() {
  const user = await getSessionUser();

  if (user?.role === "GAP_STAKEHOLDER") {
    redirect("/dashboard?error=unauthorized");
  }

  // Default incident time to now (formatted for datetime-local input)
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Log Update</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Record a shift incident, alert, or activity update.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-5">

        {/* Source + Severity */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Source <span className="text-red-500">*</span>
            </label>
            <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Select source…</option>
              <option value="PAGERDUTY">PagerDuty</option>
              <option value="SERVICENOW">ServiceNow</option>
              <option value="SLACK">Slack</option>
              <option value="TEAMS">MS Teams</option>
              <option value="VERBAL">Verbal</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Severity <span className="text-red-500">*</span>
            </label>
            <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Select severity…</option>
              <option value="P1_CRITICAL">P1 — Critical</option>
              <option value="P2_HIGH">P2 — High</option>
              <option value="P3_MEDIUM">P3 — Medium</option>
              <option value="P4_LOW">P4 — Low</option>
              <option value="INFORMATIONAL">Informational</option>
            </select>
          </div>
        </div>

        {/* Project */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Project <span className="text-red-500">*</span>
          </label>
          <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Select project…</option>
            {MOCK_PROJECTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.description}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Brief description of the incident or update…"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
            placeholder="Detailed description — what happened, what was done, current status…"
          />
        </div>

        {/* ── Incident Timeline ── */}
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-4">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Incident Timeline
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Incident Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                defaultValue={nowLocal}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-[11px] text-gray-400">When the incident occurred</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Ack Time
              </label>
              <input
                type="datetime-local"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-[11px] text-gray-400">When it was acknowledged</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Resolved Time
              </label>
              <input
                type="datetime-local"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-[11px] text-gray-400">When it was fully resolved</p>
            </div>
          </div>
        </div>

        {/* External References */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              ServiceNow Ticket ID
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="INC0000000 / CHG0000000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              PagerDuty Reference
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="PD-XXXXXXX"
            />
          </div>
        </div>

        {/* Blocking */}
        <div className="flex items-start gap-3 rounded-md bg-red-50 border border-red-200 p-3">
          <input type="checkbox" id="blocking" className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-red-600" />
          <label htmlFor="blocking" className="text-sm text-gray-700">
            <span className="font-medium text-red-700">Blocking dependency</span>
            <span className="block text-gray-500 text-xs mt-0.5">
              Check if this item is actively blocking other teams or delivery milestones.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            disabled
            className="flex-1 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white opacity-60 cursor-not-allowed"
          >
            Submit Log
          </button>
          <Link
            href="/dashboard"
            className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 text-center"
          >
            Cancel
          </Link>
        </div>
        <p className="text-xs text-gray-400 text-center">
          Form submission wired to Server Action — database connection required.
        </p>
      </div>
    </div>
  );
}
