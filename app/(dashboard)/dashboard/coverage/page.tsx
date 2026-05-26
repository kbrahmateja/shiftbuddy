export const runtime = 'edge';

import { getSessionUser } from "@/lib/auth";
import { MOCK_PROJECTS, MOCK_SHIFTS, MOCK_USERS } from "@/lib/mock-data";
import { CoverageMatrix, type ProjectCoverage, type SpocInfo, type TeamMember } from "@/components/coverage/CoverageMatrix";

/** Pick best SPOC for a project+pattern combo: prefer LEAD, then first EMPLOYEE, then first */
function pickSpoc(projectId: string, pattern: string): SpocInfo | null {
  const candidates = MOCK_SHIFTS.filter(
    (s) => s.projectId === projectId && s.pattern === pattern,
  );
  if (!candidates.length) return null;

  const withUser = candidates
    .map((s) => {
      const u = MOCK_USERS.find((u) => u.id === s.assignedToId);
      return u ? { userId: u.id, name: u.name, email: u.email, role: u.role } : null;
    })
    .filter(Boolean) as { userId: string; name: string; email: string; role: string }[];

  const lead = withUser.find((x) => x.role === "LEAD");
  const pick = lead ?? withUser[0];
  if (!pick) return null;

  return { userId: pick.userId, name: pick.name, email: pick.email };
}

export default async function CoveragePage() {
  const user = await getSessionUser();

  const projects: ProjectCoverage[] = MOCK_PROJECTS.map((proj) => ({
    projectId: proj.id,
    projectName: proj.name,
    shift1: pickSpoc(proj.id, "MORNING"),
    shift2: pickSpoc(proj.id, "AFTERNOON"),
    shift3: pickSpoc(proj.id, "NIGHT"),
  }));

  // All team members eligible to be SPOC (CONTRACTOR / EMPLOYEE / LEAD)
  const teamMembers: TeamMember[] = MOCK_USERS
    .filter((u) => u.role === "CONTRACTOR" || u.role === "EMPLOYEE" || u.role === "LEAD")
    .map((u) => ({ userId: u.id, name: u.name, email: u.email }));

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">PT Coverage Directory</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Per-shift HCL SPOC and GAP SME support contacts for each project team.
            {user?.role === "MANAGER" && (
              <span className="ml-1 text-indigo-600 font-medium">Click ✏️ to update SPOC or GAP SME.</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Shift 1 · Morning
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
            <span className="h-2 w-2 rounded-full bg-sky-400" /> Shift 2 · Afternoon
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
            <span className="h-2 w-2 rounded-full bg-indigo-400" /> Shift 3 · Night
          </span>
        </div>
      </div>

      <CoverageMatrix projects={projects} viewerRole={user!.role} teamMembers={teamMembers} />
    </div>
  );
}
