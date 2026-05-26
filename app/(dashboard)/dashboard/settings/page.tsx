export const runtime = 'edge';

import { getSessionUser } from "@/lib/auth";
import { RoleSwitcher } from "@/components/settings/RoleSwitcher";
import { HolidayCalendarSettings } from "@/components/settings/HolidayCalendarSettings";
import { HolidayPolicySettings } from "@/components/settings/HolidayPolicySettings";

const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "IST — Asia/Kolkata" },
  { value: "America/New_York", label: "EST — America/New_York" },
  { value: "America/Los_Angeles", label: "PST — America/Los_Angeles" },
  { value: "UTC", label: "UTC" },
];

export default async function SettingsPage() {
  const user = await getSessionUser();

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Your account preferences and notification settings.
        </p>
      </div>

      {/* Profile */}
      <section className="rounded-lg border bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Profile</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input
              type="text"
              defaultValue={user?.name}
              disabled
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input
              type="email"
              defaultValue={user?.email}
              disabled
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
            <input
              type="text"
              defaultValue={user?.role}
              disabled
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Timezone</label>
            <select
              defaultValue={user?.timezone}
              disabled
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
            >
              {TIMEZONE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Notification Channels */}
      <section className="rounded-lg border bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Notification Channels</h2>
        {[
          { label: "In-App Notifications", description: "Show badge counts and notification panel.", enabled: true },
          { label: "Email Notifications", description: "Receive handover SLA alerts via email.", enabled: false },
          { label: "Slack Notifications", description: "Push updates to your Slack DM.", enabled: false },
          { label: "MS Teams Notifications", description: "Push updates to your Teams channel.", enabled: false },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 py-2 border-b last:border-b-0">
            <div>
              <p className="text-sm font-medium text-gray-800">{item.label}</p>
              <p className="text-xs text-gray-500">{item.description}</p>
            </div>
            <div
              className={`relative h-5 w-9 rounded-full transition-colors cursor-not-allowed ${item.enabled ? "bg-indigo-500" : "bg-gray-200"}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${item.enabled ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </div>
          </div>
        ))}
      </section>

      <HolidayCalendarSettings userRole={user?.role ?? "CONTRACTOR"} />

      <HolidayPolicySettings userRole={user?.role ?? "CONTRACTOR"} />

      <RoleSwitcher currentRole={user?.role ?? "LEAD"} />
    </div>
  );
}
