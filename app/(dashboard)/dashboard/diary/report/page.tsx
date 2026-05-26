export const runtime = 'edge';

// app/(dashboard)/dashboard/diary/report/page.tsx
// ─────────────────────────────────────────────────────────────
// Diary Report page — accessible by LEAD, MANAGER, GAP_STAKEHOLDER.
// CONTRACTOR and EMPLOYEE are redirected back to /dashboard/diary.
// ─────────────────────────────────────────────────────────────

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth";
import { DiaryReportPanel } from "@/components/diary/DiaryReportPanel";

// ── Skeleton ───────────────────────────────────────────────────────────────

function ReportPageSkeleton() {
  return (
    <div className="space-y-6 p-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-8 w-56 rounded-lg bg-gray-200" />
          <div className="h-4 w-96 rounded bg-gray-100" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-gray-200" />
      </div>
      <div className="flex gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-32 rounded-lg bg-gray-200" />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-200" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-gray-200" />
        ))}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function DiaryReportPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/auth/signin?callbackUrl=/dashboard/diary/report");
  }

  // Hard gate: contractors and employees go back to their diary form
  if (user.role === "CONTRACTOR" || user.role === "EMPLOYEE") {
    redirect("/dashboard/diary?error=unauthorized");
  }

  return (
    <div className="px-4 py-6">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span>📈</span>
              Diary Reports
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Aggregate daily, weekly, and monthly summaries of team diary submissions —
              incidents, KT progress, KTLO resolution, and task throughput.
            </p>
          </div>

          {/* Back link */}
          <a
            href="/dashboard/diary"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Feed
          </a>
        </div>

        {user.role === "GAP_STAKEHOLDER" && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              <strong>Read-only stakeholder view.</strong> Export is available — reports
              download as Markdown files suitable for sharing with the client.
            </span>
          </div>
        )}
      </div>

      {/* Report panel — all interaction is client-side */}
      <Suspense fallback={<ReportPageSkeleton />}>
        <DiaryReportPanel defaultPeriod="WEEKLY" />
      </Suspense>
    </div>
  );
}
