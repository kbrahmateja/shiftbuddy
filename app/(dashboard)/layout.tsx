export const runtime = 'edge';

// app/(dashboard)/layout.tsx
// Server Component — fetches session + badge counts, then delegates
// all interactive shell rendering to DashboardShell (Client Component).

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/DashboardShell";
import type { SessionUser } from "@/types";

// ─────────────────────────────────────────────
// ASYNC DATA FETCHES (run concurrently on server)
// ─────────────────────────────────────────────

async function getLayoutData(userId: string): Promise<{
  notificationCount: number;
  pendingHandovers: number;
  pendingSwaps: number;
}> {
  // POC stubs — replace with Prisma queries in production
  return { notificationCount: 3, pendingHandovers: 1, pendingSwaps: 2 };
}

// ─────────────────────────────────────────────
// ROLE-BASED ROUTE GUARDS
// ─────────────────────────────────────────────

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
  const session = await getSessionUser();

  if (!session) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  const { notificationCount, pendingHandovers, pendingSwaps } =
    await getLayoutData(session.id);

  return (
    <DashboardShell
      user={session}
      notificationCount={notificationCount}
      pendingHandovers={pendingHandovers}
      pendingSwaps={pendingSwaps}
    >
      {children}
    </DashboardShell>
  );
}
