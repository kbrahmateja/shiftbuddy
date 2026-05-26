export const runtime = 'edge';

// app/(dashboard)/layout.tsx
// ─────────────────────────────────────────────────────────────
// Root layout for all authenticated dashboard routes.
// Reads the session, enforces auth, and renders the RBAC-aware
// sidebar + top-bar.  Server Component — no "use client".
// ─────────────────────────────────────────────────────────────

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { AttendanceAlertListener } from "@/components/layout/AttendanceAlertListener";
import { getSessionUser } from "@/lib/auth";
import type { SessionUser } from "@/types";

// ─────────────────────────────────────────────
// LOADER — pending UI while async data resolves
// ─────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="flex h-screen w-full animate-pulse">
      <div className="h-full w-64 bg-gray-100" />
      <div className="flex flex-1 flex-col">
        <div className="h-16 w-full bg-gray-50 border-b" />
        <div className="flex-1 bg-gray-50 p-6">
          <div className="mb-4 h-8 w-1/3 rounded-lg bg-gray-200" />
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ASYNC DATA FETCHES (run concurrently on server)
// ─────────────────────────────────────────────

async function getLayoutData(userId: string): Promise<{
  notificationCount: number;
  pendingHandovers: number;
  pendingSwaps: number;
}> {
  // In production, replace with actual Prisma queries:
  //   const [notifs, handovers, swaps] = await Promise.all([
  //     prisma.notification.count({ where: { userId, isRead: false } }),
  //     prisma.shiftHandover.count({ where: { incomingLeadId: userId, status: "SUBMITTED" } }),
  //     prisma.shiftSwapRequest.count({ where: { OR: [{ recipientId: userId }, { requesterId: userId }], status: "PENDING" } }),
  //   ]);
  //   return { notificationCount: notifs, pendingHandovers: handovers, pendingSwaps: swaps };

  // POC: return stubs
  return { notificationCount: 3, pendingHandovers: 1, pendingSwaps: 2 };
}

// ─────────────────────────────────────────────
// ROLE-BASED ROUTE GUARDS
// ─────────────────────────────────────────────

/**
 * Routes that are completely off-limits for a role.
 * Returns the redirect target if access should be denied.
 */
function getRedirectForRestrictedPath(
  pathname: string,
  role: SessionUser["role"]
): string | null {
  const RESTRICTED: Partial<Record<SessionUser["role"], string[]>> = {
    GAP_STAKEHOLDER: [
      "/dashboard/log-update",
      "/dashboard/handovers",
      "/dashboard/swaps",
      "/dashboard/roster",
      "/dashboard/team",
    ],
    CONTRACTOR: [
      "/dashboard/roster",
      "/dashboard/analytics",
      "/dashboard/sla",
      "/dashboard/projects",
      "/dashboard/team",
    ],
  };

  const restricted = RESTRICTED[role] ?? [];
  const isRestricted = restricted.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
  return isRestricted ? "/dashboard?error=unauthorized" : null;
}

// ─────────────────────────────────────────────
// LAYOUT
// ─────────────────────────────────────────────

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Resolve session
  const session = await getSessionUser();

  if (!session) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  // 2. Fetch sidebar badge counts concurrently
  const { notificationCount, pendingHandovers, pendingSwaps } =
    await getLayoutData(session.id);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ── Sidebar ── */}
      <Sidebar
        user={session}
        notificationCount={notificationCount}
        pendingHandovers={pendingHandovers}
        pendingSwaps={pendingSwaps}
      />

      {/* ── Main content area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar with breadcrumb, timezone clock, and user actions */}
        <TopBar user={session} />

        {/* Toast alerts for lead/manager when contractors clock in/out */}
        <AttendanceAlertListener role={session.role} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<DashboardSkeleton />}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
