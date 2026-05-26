export const runtime = 'edge';

import { getSessionUser } from "@/lib/auth";
import { MOCK_USERS, MOCK_SHIFTS, MOCK_PROJECTS } from "@/lib/mock-data";
import { TeamAttendanceLive } from "@/components/attendance/TeamAttendanceLive";

const ROLE_LABEL: Record<string, string> = {
  CONTRACTOR:     "Contractor",
  EMPLOYEE:       "Employee",
  LEAD:           "Shift Lead",
  MANAGER:        "Manager",
  GAP_STAKEHOLDER:"GAPINC Stakeholder",
};

const ROLE_COLOR: Record<string, string> = {
  CONTRACTOR:     "bg-blue-100 text-blue-700",
  EMPLOYEE:       "bg-indigo-100 text-indigo-700",
  LEAD:           "bg-violet-100 text-violet-700",
  MANAGER:        "bg-amber-100 text-amber-700",
  GAP_STAKEHOLDER:"bg-gray-100 text-gray-700",
};

const SHIFT_LABEL: Record<string, string> = {
  MORNING:   "Shift 1 · Morning",
  AFTERNOON: "Shift 2 · Afternoon",
  NIGHT:     "Shift 3 · Night",
  GENERAL:   "General",
  WEEKEND:   "Weekend",
  ON_CALL:   "On-Call",
};

const SHIFT_COLOR: Record<string, string> = {
  MORNING:   "bg-amber-50   text-amber-700  border-amber-200",
  AFTERNOON: "bg-sky-50     text-sky-700    border-sky-200",
  NIGHT:     "bg-indigo-50  text-indigo-700 border-indigo-200",
  GENERAL:   "bg-gray-50    text-gray-600   border-gray-200",
  WEEKEND:   "bg-purple-50  text-purple-700 border-purple-200",
  ON_CALL:   "bg-rose-50    text-rose-700   border-rose-200",
};

// Short project name for display
const PROJECT_SHORT: Record<string, string> = {
  proj_checkout:     "Checkout",
  proj_payment_core: "Payment Core",
  proj_browse:       "Browse + Profile",
  proj_buyui:        "Buy UI",
  proj_webapp:       "PT-WebApp",
  proj_dam:          "DAM",
  proj_marketing:    "PT-Marketing",
};

const PROJECT_COLOR: Record<string, string> = {
  proj_checkout:     "bg-orange-50 text-orange-700",
  proj_payment_core: "bg-emerald-50 text-emerald-700",
  proj_browse:       "bg-blue-50 text-blue-700",
  proj_buyui:        "bg-violet-50 text-violet-700",
  proj_webapp:       "bg-teal-50 text-teal-700",
  proj_dam:          "bg-rose-50 text-rose-700",
  proj_marketing:    "bg-yellow-50 text-yellow-700",
};

function getInitials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

export default async function TeamPage() {
  const user = await getSessionUser();
  const canViewAttendance = user?.role === "LEAD" || user?.role === "MANAGER";
  const canViewRoles = user?.role === "LEAD" || user?.role === "MANAGER" || user?.role === "GAP_STAKEHOLDER";

  // Build user → first shift info map
  const userShiftMap = new Map<string, { projectId: string; pattern: string }>();
  MOCK_SHIFTS.forEach((s) => {
    if (!userShiftMap.has(s.assignedToId)) {
      userShiftMap.set(s.assignedToId, { projectId: s.projectId, pattern: s.pattern });
    }
  });

  // Group members by project for count display
  const projectCounts: Record<string, number> = {};
  MOCK_USERS.forEach((m) => {
    const info = userShiftMap.get(m.id);
    if (info) projectCounts[info.projectId] = (projectCounts[info.projectId] ?? 0) + 1;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Team</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {MOCK_USERS.length} active team members across {MOCK_PROJECTS.length} projects.
          </p>
        </div>
      </div>

      {/* Project summary pills */}
      <div className="flex flex-wrap gap-2">
        {MOCK_PROJECTS.map((proj) => (
          <div
            key={proj.id}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${PROJECT_COLOR[proj.id] ?? "bg-gray-50 text-gray-600"}`}
          >
            <span>{PROJECT_SHORT[proj.id] ?? proj.name}</span>
            <span className="opacity-60">·</span>
            <span>{projectCounts[proj.id] ?? 0} members</span>
          </div>
        ))}
      </div>

      {/* Today's Attendance — live view for leads/managers */}
      {canViewAttendance && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Today&apos;s Attendance</h2>
          <TeamAttendanceLive />
        </div>
      )}

      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Member</th>
              <th className="px-4 py-3 text-left">Project</th>
              <th className="px-4 py-3 text-left">Shift</th>
              {canViewRoles && <th className="px-4 py-3 text-left">Role</th>}
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {MOCK_USERS.map((member) => {
              const shiftInfo = userShiftMap.get(member.id);
              const projectId = shiftInfo?.projectId;
              const pattern   = shiftInfo?.pattern;

              return (
                <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                  {/* Member */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                        {getInitials(member.name)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {member.name}
                          {member.id === user?.id && (
                            <span className="ml-1.5 text-xs text-gray-400">(you)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Project */}
                  <td className="px-4 py-3">
                    {projectId ? (
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${PROJECT_COLOR[projectId] ?? "bg-gray-50 text-gray-600"}`}>
                        {PROJECT_SHORT[projectId] ?? projectId}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>

                  {/* Shift */}
                  <td className="px-4 py-3">
                    {pattern ? (
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${SHIFT_COLOR[pattern] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                        {SHIFT_LABEL[pattern] ?? pattern}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>

                  {/* Role (lead/manager only) */}
                  {canViewRoles && (
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_COLOR[member.role]}`}>
                        {ROLE_LABEL[member.role]}
                        {projectId && (
                          <span className="font-normal opacity-70 ml-1">
                            ({PROJECT_SHORT[projectId] ?? projectId})
                          </span>
                        )}
                      </span>
                    </td>
                  )}

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${member.isActive ? "text-emerald-600" : "text-gray-400"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${member.isActive ? "bg-emerald-500" : "bg-gray-300"}`} />
                      {member.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
