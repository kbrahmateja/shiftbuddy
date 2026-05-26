export const runtime = 'edge';

import { getSessionUser } from "@/lib/auth";
import { RoleSwitcher } from "@/components/settings/RoleSwitcher";
import { HolidayCalendarSettings } from "@/components/settings/HolidayCalendarSettings";
import { HolidayPolicySettings } from "@/components/settings/HolidayPolicySettings";
import { NotificationChannels } from "@/components/settings/NotificationChannels";
import { TimezoneSettings } from "@/components/settings/TimezoneSettings";

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
            {/* Timezone — auto-detected from browser, overridable */}
            <TimezoneSettings sessionTimezone={user?.timezone ?? "UTC"} />
          </div>
        </div>
      </section>

      <NotificationChannels />

      <HolidayCalendarSettings userRole={user?.role ?? "CONTRACTOR"} />

      <HolidayPolicySettings userRole={user?.role ?? "CONTRACTOR"} />

      <RoleSwitcher currentRole={user?.role ?? "LEAD"} />
    </div>
  );
}
