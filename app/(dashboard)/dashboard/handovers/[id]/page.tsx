import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCK_HANDOVERS, MOCK_USERS, MOCK_LOGS } from "@/lib/mock-data";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-yellow-100 text-yellow-800",
  ACKNOWLEDGED: "bg-green-100 text-green-800",
  DISPUTED: "bg-red-100 text-red-800",
};

export default async function HandoverDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const handover = MOCK_HANDOVERS.find((h) => h.id === params.id);
  if (!handover) notFound();

  const outgoing = MOCK_USERS.find((u) => u.id === handover.outgoingLeadId);
  const incoming = MOCK_USERS.find((u) => u.id === handover.incomingLeadId);
  const blockingLogs = MOCK_LOGS.filter((l) => l.isBlockingDependency);
  const isOverdue = !handover.acknowledgedAt && !!handover.dueBy && handover.dueBy < new Date();

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <Link
          href="/dashboard/handovers"
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Back to Handovers
        </Link>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-gray-900">
            Handover — {outgoing?.name} → {incoming?.name}
          </h1>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[handover.status] ?? "bg-gray-100 text-gray-700"}`}
          >
            {handover.status}
          </span>
          {isOverdue && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
              OVERDUE
            </span>
          )}
        </div>
        {handover.dueBy && (
          <p className="mt-1 text-sm text-gray-500">
            Due by{" "}
            {handover.dueBy.toLocaleString([], {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        )}
      </div>

      <div className="space-y-5">
        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Open Items</h2>
          <p className="text-sm text-gray-600">{handover.openItemsSummary}</p>
        </section>

        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Resolved This Shift</h2>
          <p className="text-sm text-gray-600">{handover.resolvedSummary}</p>
        </section>

        {blockingLogs.length > 0 && (
          <section className="rounded-lg border bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Blocking Dependencies ({blockingLogs.length})
            </h2>
            <div className="space-y-2">
              {blockingLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3"
                >
                  <span className="mt-0.5 h-2 w-2 rounded-full bg-red-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{log.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{log.blockingReason}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {handover.escalationNotes && (
          <section className="rounded-lg border bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Escalation Notes</h2>
            <p className="text-sm text-gray-600">{handover.escalationNotes}</p>
          </section>
        )}

        {handover.status === "SUBMITTED" && (
          <div className="flex gap-3">
            <button className="flex-1 rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700">
              Acknowledge Handover
            </button>
            <button className="flex-1 rounded-md border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
              Dispute
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
