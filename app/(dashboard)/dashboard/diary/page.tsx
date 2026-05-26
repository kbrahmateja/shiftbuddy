// app/(dashboard)/dashboard/diary/page.tsx
// ─────────────────────────────────────────────────────────────
// Daily Diary page — role-gated:
//   CONTRACTOR / EMPLOYEE  → own diary entry form (today's entry)
//   LEAD                   → own entry form (top) + full team feed (bottom)
//   MANAGER                → full team feed only
//   GAP_STAKEHOLDER        → read-only team feed (no review actions)
// ─────────────────────────────────────────────────────────────

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth";
import {
  MOCK_DIARY_ENTRIES,
  MOCK_USERS,
  MOCK_PROJECTS,
  getTodayDiary,
} from "@/lib/mock-data";
// MOCK_USERS is kept for the ALL_USERS_SLIM mapping below
import { DiaryEntryForm } from "@/components/diary/DiaryEntryForm";
import { DiaryFeed }      from "@/components/diary/DiaryFeed";
import type { SessionUser } from "@/types";

// ── Helpers ────────────────────────────────────────────────────────────────

function DiaryPageSkeleton() {
  return (
    <div className="space-y-4 p-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-gray-200" />
      <div className="h-4 w-72 rounded bg-gray-100" />
      <div className="grid grid-cols-3 gap-4 pt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-200" />
        ))}
      </div>
    </div>
  );
}

/** Determine the "active project" for a CONTRACTOR / EMPLOYEE from their session. */
function resolveActiveProject(user: SessionUser): string {
  return user.activeProjectId ?? MOCK_PROJECTS[0]?.id ?? "proj_browse";
}

/** Derive current IST shift pattern for pre-filling the form. */
function currentShiftPattern(): "MORNING" | "AFTERNOON" | "NIGHT" | "GENERAL" {
  const istHour = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  ).getHours();
  if (istHour >= 5  && istHour < 13) return "MORNING";
  if (istHour >= 13 && istHour < 21) return "AFTERNOON";
  if (istHour >= 21 || istHour <  5) return "NIGHT";
  return "GENERAL";
}

// Slim user list shape required by DiaryFeed
const ALL_USERS_SLIM = MOCK_USERS.map((u) => ({
  id:   u.id,
  name: u.name,
  role: u.role,
}));

// ── Role-specific view components ──────────────────────────────────────────

/** CONTRACTOR / EMPLOYEE — own entry form only. */
function MemberDiaryView({ user }: { user: SessionUser }) {
  const todayDiary = getTodayDiary(user.id);
  const projectId  = resolveActiveProject(user);
  const shift      = todayDiary?.shiftPattern ?? currentShiftPattern();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>📔</span>
          Daily Diary
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {todayDiary
            ? `Your diary for today is saved as ${todayDiary.status.toLowerCase()}. You can continue editing until submitted.`
            : "Write your end-of-shift update. Be specific — incidents, KT progress, KTLO, new tasks, and blockers."}
        </p>
      </div>

      <DiaryEntryForm
        user={user}
        projectId={projectId}
        shiftPattern={shift}
        diaryDate={new Date()}
        existingDiary={todayDiary}
      />
    </div>
  );
}

/** LEAD — own form at top, team feed below. */
function LeadDiaryView({ user }: { user: SessionUser }) {
  const todayDiary = getTodayDiary(user.id);
  const projectId  = resolveActiveProject(user);
  const shift      = todayDiary?.shiftPattern ?? currentShiftPattern();

  // Team diaries = all except the lead's own entries
  const teamDiaries    = MOCK_DIARY_ENTRIES.filter((d) => d.authorId !== user.id);
  const unreviewedCount = teamDiaries.filter((d) => d.status === "SUBMITTED").length;

  return (
    <div className="px-4 py-6 space-y-8">
      {/* ── Own diary ── */}
      <section className="mx-auto max-w-3xl">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>📔</span>
            My Shift Diary
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {todayDiary
              ? `Status: ${todayDiary.status}`
              : "Your diary for today — fill this out before the shift ends."}
          </p>
        </div>

        <DiaryEntryForm
          user={user}
          projectId={projectId}
          shiftPattern={shift}
          diaryDate={new Date()}
          existingDiary={todayDiary}
        />
      </section>

      {/* ── Team feed ── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span>👥</span>
              Team Diaries
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              View, filter, and review your team members&apos; daily updates.
            </p>
          </div>
          {unreviewedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              {unreviewedCount} awaiting review
            </span>
          )}
        </div>

        <DiaryFeed
          diaries={teamDiaries}
          viewerRole={user.role}
          allUsers={ALL_USERS_SLIM}
        />
      </section>
    </div>
  );
}

/** MANAGER — full team feed, no own-entry form. */
function ManagerDiaryView({ user }: { user: SessionUser }) {
  const unreviewedCount = MOCK_DIARY_ENTRIES.filter(
    (d) => d.status === "SUBMITTED"
  ).length;

  return (
    <div className="px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>📋</span>
            Team Daily Diaries
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor all team members&apos; shift diaries. Review submitted entries and
            track daily progress across projects.
          </p>
        </div>
        {unreviewedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            {unreviewedCount} unreviewed
          </span>
        )}
      </div>

      <DiaryFeed
        diaries={MOCK_DIARY_ENTRIES}
        viewerRole={user.role}
        allUsers={ALL_USERS_SLIM}
      />
    </div>
  );
}

/** GAP_STAKEHOLDER — read-only feed of submitted/reviewed entries only. */
function StakeholderDiaryView({ user }: { user: SessionUser }) {
  const visibleDiaries = MOCK_DIARY_ENTRIES.filter(
    (d) => d.status === "SUBMITTED" || d.status === "REVIEWED"
  );

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>📊</span>
          Team Diary Feed
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Read-only view of submitted team diaries. Draft entries are hidden.
        </p>
      </div>

      {/* Read-only notice */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          <strong>Stakeholder view — read only.</strong> You can view all submitted
          and reviewed diaries but cannot create, edit, or review entries.
        </span>
      </div>

      {/* Pass GAP_STAKEHOLDER role so DiaryFeed hides review controls */}
      <DiaryFeed
        diaries={visibleDiaries}
        viewerRole={user.role}
        allUsers={ALL_USERS_SLIM}
      />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function DiaryPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/auth/signin?callbackUrl=/dashboard/diary");
  }

  return (
    <Suspense fallback={<DiaryPageSkeleton />}>
      {(user.role === "CONTRACTOR" || user.role === "EMPLOYEE") ? (
        <MemberDiaryView user={user} />
      ) : user.role === "LEAD" ? (
        <LeadDiaryView user={user} />
      ) : user.role === "MANAGER" ? (
        <ManagerDiaryView user={user} />
      ) : (
        <StakeholderDiaryView user={user} />
      )}
    </Suspense>
  );
}
