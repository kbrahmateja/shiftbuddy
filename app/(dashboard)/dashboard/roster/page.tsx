export const runtime = 'edge';

// app/(dashboard)/dashboard/roster/page.tsx
// ─────────────────────────────────────────────────────────────
// Roster page — three-tab layout:
//   Calendar  — read-only weekly grid (all roles)
//   Manage    — shift calendar manager: add/edit/remove (LEAD/MANAGER)
//   Live      — real-time shift monitor               (LEAD/MANAGER)
// ─────────────────────────────────────────────────────────────

import { getSessionUser } from "@/lib/auth";
import { MOCK_SHIFTS }    from "@/lib/mock-data";
import { RosterPageClient } from "@/components/roster/RosterPageClient";

export default async function RosterPage() {
  const user    = await getSessionUser();
  const canEdit = user?.role === "LEAD" || user?.role === "MANAGER";

  return (
    <RosterPageClient
      shifts={MOCK_SHIFTS}
      currentUser={user!}
      canEdit={canEdit}
    />
  );
}
