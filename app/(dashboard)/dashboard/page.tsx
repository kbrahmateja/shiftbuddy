import { DashboardWorkspace } from "@/components/dashboard/DashboardWorkspace";
import { getSessionUser } from "@/lib/auth";
import {
  MOCK_LOGS,
  MOCK_SHIFTS,
  MOCK_USERS,
  MOCK_HANDOVERS,
  MOCK_SWAPS,
  MOCK_PROJECTS,
} from "@/lib/mock-data";
import type { OperationalMetrics, ProjectHealthSummary, Source } from "@/types";

// ── Compute project health summaries from mock logs ───────────────────────────
function buildProjectSummaries(): ProjectHealthSummary[] {
  return MOCK_PROJECTS.map((proj) => {
    const logs = MOCK_LOGS.filter((l) => l.projectId === proj.id);
    const total = logs.length;

    // Source distribution
    const sourceCounts: Partial<Record<Source, number>> = {};
    logs.forEach((l) => {
      sourceCounts[l.source] = (sourceCounts[l.source] ?? 0) + 1;
    });
    const sourceDistribution = (Object.entries(sourceCounts) as [Source, number][]).map(
      ([source, count]) => ({
        source,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      })
    );

    // SLA breach: P1/P2 open > 4h without ack, or P3 open > 24h without ack
    const slaBreachCount = logs.filter((l) => {
      if (l.resolvedAt) return false;
      const ageMs = Date.now() - l.occurredAt.getTime();
      if (!l.acknowledgedAt) {
        if (l.severity === "P1_CRITICAL" && ageMs > 30 * 60 * 1000)   return true;
        if (l.severity === "P2_HIGH"    && ageMs > 2 * 60 * 60 * 1000) return true;
        if (l.severity === "P3_MEDIUM"  && ageMs > 8 * 60 * 60 * 1000) return true;
      }
      return false;
    }).length;

    const sorted = [...logs].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );

    return {
      projectId:      proj.id,
      projectName:    proj.name,
      projectCode:    proj.id.replace("proj_", "").toUpperCase(),
      totalLogs:      total,
      openLogs:       logs.filter((l) => l.status === "OPEN" || l.status === "IN_PROGRESS").length,
      escalatedLogs:  logs.filter((l) => l.status === "ESCALATED").length,
      p1Count:        logs.filter((l) => l.severity === "P1_CRITICAL").length,
      slaBreachCount,
      lastActivityAt: sorted[0]?.updatedAt ?? null,
      sourceDistribution,
    };
  });
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  const now  = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Operational metrics
  const metrics: OperationalMetrics = {
    totalContractors:         MOCK_USERS.filter((u) => u.role === "CONTRACTOR" || u.role === "EMPLOYEE").length,
    activeShiftsNow:          MOCK_SHIFTS.filter((s) => s.status === "ACTIVE").length,
    logsLast24h:              MOCK_LOGS.filter((l) => l.loggedAt >= since24h).length,
    openHandovers:            MOCK_HANDOVERS.filter((h) => h.status === "SUBMITTED" || h.status === "DRAFT").length,
    pendingSwapRequests:      MOCK_SWAPS.filter((s) => s.status === "PENDING").length,
    unacknowledgedHandovers:  MOCK_HANDOVERS.filter((h) => h.status === "SUBMITTED" && !h.acknowledgedAt).length,
  };

  // Project health summaries (for Manager + Stakeholder views)
  const projectSummaries = buildProjectSummaries();

  // Pending handovers enriched with lead user objects (for Lead view)
  const pendingHandovers = MOCK_HANDOVERS
    .filter((h) => h.status === "SUBMITTED" || h.status === "DRAFT")
    .map((h) => ({
      ...h,
      outgoingLead: MOCK_USERS.find((u) => u.id === h.outgoingLeadId),
      incomingLead: MOCK_USERS.find((u) => u.id === h.incomingLeadId),
    }));

  // Pending swaps enriched with requester/recipient objects (for Lead view)
  const pendingSwaps = MOCK_SWAPS
    .filter((s) => s.status === "PENDING")
    .map((s) => ({
      ...s,
      requester: MOCK_USERS.find((u) => u.id === s.requesterId),
      recipient: MOCK_USERS.find((u) => u.id === s.recipientId),
    }));

  return (
    <DashboardWorkspace
      user={user!}
      logs={MOCK_LOGS}
      shifts={MOCK_SHIFTS}
      metrics={metrics}
      projectSummaries={projectSummaries}
      pendingHandovers={pendingHandovers as typeof MOCK_HANDOVERS}
      pendingSwaps={pendingSwaps as typeof MOCK_SWAPS}
    />
  );
}
