"use client";

import { useState } from "react";
import { ShiftRosterGrid } from "@/components/dashboard/ShiftRosterGrid";
import type { Shift, User } from "@/types";
import { MOCK_PROJECTS } from "@/lib/mock-data";

interface ProjectRosterTabsProps {
  shifts:       (Shift & { assignedTo: User })[];
  canEdit?:     boolean;
  /** True when the viewer is a CONTRACTOR/EMPLOYEE seeing their own schedule */
  personalView?: boolean;
}

export function ProjectRosterTabs({
  shifts,
  canEdit      = false,
  personalView = false,
}: ProjectRosterTabsProps) {
  // Only the projects this user actually has shifts in
  const projectsWithShifts = MOCK_PROJECTS.filter((p) =>
    shifts.some((s) => s.projectId === p.id)
  );

  const [activeProject, setActiveProject] = useState<string>(
    projectsWithShifts[0]?.id ?? MOCK_PROJECTS[0].id
  );

  const filteredShifts    = shifts.filter((s) => s.projectId === activeProject);
  const activeProjectMeta = MOCK_PROJECTS.find((p) => p.id === activeProject);

  // ── Empty state — no shifts at all ───────────────────────────────────────
  if (projectsWithShifts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 py-20 text-center">
        <p className="text-sm font-medium text-gray-400">No shifts assigned yet.</p>
        {personalView && (
          <p className="mt-1 text-xs text-gray-400">
            Contact your shift lead or manager to get added to a roster.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Project / team tabs ─────────────────────────────────────────── */}
      {/* Only shown if the user has shifts in more than one project */}
      {projectsWithShifts.length > 1 && (
        <div className="flex flex-wrap gap-1.5 border-b border-gray-200 pb-3">
          {projectsWithShifts.map((project) => {
            const count     = shifts.filter((s) => s.projectId === project.id).length;
            const hasActive = shifts
              .filter((s) => s.projectId === project.id)
              .some((s) => s.status === "ACTIVE");
            const isSelected = activeProject === project.id;

            return (
              <button
                key={project.id}
                onClick={() => setActiveProject(project.id)}
                className={`relative inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-all ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                }`}
              >
                {hasActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
                {project.name}
                <span
                  className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isSelected ? "bg-indigo-500 text-indigo-100" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Project context line ─────────────────────────────────────────── */}
      {activeProjectMeta && (
        <p className="text-xs text-gray-500">
          <span className="font-medium text-gray-700">{activeProjectMeta.name}</span>
          {" — "}{activeProjectMeta.description}
          {"  ·  "}{filteredShifts.length} shift{filteredShifts.length !== 1 ? "s" : ""}
          {filteredShifts.filter((s) => s.status === "ACTIVE").length > 0 && (
            <span className="ml-1.5 text-emerald-600 font-medium">
              ({filteredShifts.filter((s) => s.status === "ACTIVE").length} active now)
            </span>
          )}
          {personalView && projectsWithShifts.length > 1 && (
            <span className="ml-2 rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
              {projectsWithShifts.length} teams
            </span>
          )}
        </p>
      )}

      {/* ── Roster grid ─────────────────────────────────────────────────── */}
      {filteredShifts.length > 0 ? (
        <ShiftRosterGrid
          shifts={filteredShifts}
          projectId={activeProject}
          canEdit={canEdit}
          personalView={personalView}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 py-16 text-center">
          <p className="text-sm text-gray-400">
            No shifts scheduled for {activeProjectMeta?.name}.
          </p>
        </div>
      )}
    </div>
  );
}
