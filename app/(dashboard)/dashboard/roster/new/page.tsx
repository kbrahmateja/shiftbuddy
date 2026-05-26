export const runtime = 'edge';

import Link from "next/link";
import { MOCK_USERS } from "@/lib/mock-data";

export default function NewRosterPage() {
  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <Link href="/dashboard/roster" className="text-sm text-indigo-600 hover:underline">
          ← Back to Roster
        </Link>
        <h1 className="mt-3 text-xl font-bold text-gray-900">Add Shift</h1>
        <p className="mt-0.5 text-sm text-gray-500">Schedule a new shift for a team member.</p>
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Assign To <span className="text-red-500">*</span>
          </label>
          <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Select team member…</option>
            {MOCK_USERS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.role}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Shift Pattern <span className="text-red-500">*</span>
            </label>
            <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option>General</option>
              <option>Morning</option>
              <option>Afternoon</option>
              <option>Night</option>
              <option>Weekend</option>
              <option>On-Call</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Timezone <span className="text-red-500">*</span>
            </label>
            <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="Asia/Kolkata">IST — Asia/Kolkata</option>
              <option value="America/New_York">EST — America/New_York</option>
              <option value="America/Los_Angeles">PST — America/Los_Angeles</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Start Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              End Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
          <textarea
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
            placeholder="Optional notes for this shift…"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            disabled
            className="flex-1 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white opacity-60 cursor-not-allowed"
          >
            Schedule Shift
          </button>
          <Link
            href="/dashboard/roster"
            className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 text-center"
          >
            Cancel
          </Link>
        </div>
        <p className="text-xs text-gray-400 text-center">
          Requires database connection to persist.
        </p>
      </div>
    </div>
  );
}
