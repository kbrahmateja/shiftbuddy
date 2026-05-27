export const runtime = 'edge';

import { getSessionUser } from "@/lib/auth";
import { MOCK_PROJECTS, MOCK_SHIFTS, MOCK_USERS } from "@/lib/mock-data";
import { CoverageMatrix, type ProjectCoverage, type SpocInfo, type TeamMember } from "@/components/coverage/CoverageMatrix";
import { PageShell } from "@/components/layout/PageShell";

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

  const subtitle = `Per-shift YCI SPOC and Client SME support contacts for each project team.${user?.role === "MANAGER" ? " Click ✏️ to update SPOC or Client SME." : ""}`;

  const legendActions = (
    <div className="flex flex-wrap gap-2">
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
  );

  return (
    <PageShell
      title="PT Coverage"
      subtitle={subtitle}
      actions={legendActions}
      maxWidth="max-w-6xl"
    >
      <CoverageMatrix projects={projects} viewerRole={user!.role} teamMembers={teamMembers} />
    </PageShell>
  );
}
