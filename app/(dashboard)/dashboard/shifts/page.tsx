// app/(dashboard)/dashboard/shifts/page.tsx
import { getSessionUser } from "@/lib/auth";
import { MOCK_SHIFTS } from "@/lib/mock-data";
import { ProjectRosterTabs } from "@/components/roster/ProjectRosterTabs";

export default async function ShiftsPage() {
  const user    = await getSessionUser();
  const canEdit = user?.role === "LEAD" || user?.role === "MANAGER";

  // ── Scope shifts to what this user should see ──────────────────────────
  // CONTRACTOR / EMPLOYEE → only their own assigned shifts
  //   (if they're in multiple projects / teams those tabs will still appear)
  // LEAD         → everyone in their active project
  // MANAGER      → all shifts across all projects
  // ──────────────────────────────────────────────────────────────────────
  const myShifts = !user
    ? []
    : user.role === "CONTRACTOR" || user.role === "EMPLOYEE"
      ? MOCK_SHIFTS.filter((s) => s.assignedToId === user.id)
      : user.role === "LEAD" && user.activeProjectId
        ? MOCK_SHIFTS.filter((s) => s.projectId === user.activeProjectId)
        : MOCK_SHIFTS; // MANAGER / GAP_STAKEHOLDER see everything

  const isPersonal = user?.role === "CONTRACTOR" || user?.role === "EMPLOYEE";

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b bg-white">
        <h1 className="text-xl font-bold text-gray-900">My Shifts</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {isPersonal
            ? "Your personal shift schedule — all assigned projects shown as tabs."
            : "Weekly roster by project — timezone-aware."}
        </p>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <ProjectRosterTabs
          shifts={myShifts}
          canEdit={canEdit}
          personalView={isPersonal}
        />
      </div>
    </div>
  );
}
