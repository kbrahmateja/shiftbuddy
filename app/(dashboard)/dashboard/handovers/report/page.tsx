export const runtime = 'edge';

import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MOCK_PROJECTS, MOCK_SHIFTS, MOCK_LOGS, MOCK_USERS } from "@/lib/mock-data";
import { PrintButton } from "@/components/handover/PrintButton";

// ── helpers ──────────────────────────────────────────────────────────────────

function sev(logs: typeof MOCK_LOGS, key: string) {
  return logs.filter((l) => l.severity === key);
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function HandoverReportPage() {
  const user = await getSessionUser();
  if (user?.role !== "MANAGER" && user?.role !== "LEAD") {
    redirect("/dashboard?error=unauthorized");
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  // Per-project stats from mock logs
  const projectStats = MOCK_PROJECTS.map((proj) => {
    const logs = MOCK_LOGS.filter((l) => l.projectId === proj.id);
    const p1 = sev(logs, "P1_CRITICAL");
    const p2 = sev(logs, "P2_HIGH");
    const p3 = sev(logs, "P3_MEDIUM");
    const p4 = sev(logs, "P4_LOW");
    return {
      ...proj,
      logs,
      p1, p2, p3, p4,
      total: logs.length,
      resolved: logs.filter((l) => l.resolvedAt !== null).length,
      pending: logs.filter((l) => l.resolvedAt === null).length,
    };
  });

  // Shift team members per project (deduplicated by name)
  const shiftsByProject = MOCK_PROJECTS.map((proj) => {
    const projShifts = MOCK_SHIFTS.filter((s) => s.projectId === proj.id);
    const unique = (pattern: string) =>
      Array.from(new Set(
        projShifts.filter((s) => s.pattern === pattern).map((s) => s.assignedTo.name)
      ));
    return {
      proj,
      outgoing: unique("NIGHT"),   // Shift3 → outgoing
      incoming: unique("MORNING"), // Shift1 → incoming
    };
  });

  // Active incidents for section 3
  const activeIncidents = MOCK_LOGS.filter(
    (l) => l.status === "OPEN" || l.status === "IN_PROGRESS" || l.status === "ESCALATED"
  );

  // Sign-off leads
  const leads = MOCK_USERS.filter((u) => u.role === "LEAD" || u.role === "MANAGER");
  const outgoingLead = leads[0];
  const incomingLead = leads[1] ?? leads[0];

  return (
    <div className="bg-gray-100 min-h-screen print:bg-white">
      {/* ── Toolbar (hidden when printing) ── */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/handovers"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            ← Handovers
          </Link>
          <span className="text-gray-300">|</span>
          <span className="font-semibold text-gray-800 text-sm">Shift Handover Report</span>
          <span className="text-xs text-gray-400">{dateStr}</span>
        </div>
        <PrintButton />
      </div>

      {/* ── Report Body ── */}
      <div className="max-w-5xl mx-auto bg-white p-10 print:p-8 my-6 print:my-0 shadow-sm print:shadow-none">

        {/* Title */}
        <div className="text-center mb-8 pb-5 border-b-2 border-gray-800">
          <h1 className="text-2xl font-bold tracking-widest uppercase">Shift Handover Report</h1>
          <p className="text-sm text-gray-600 mt-1.5">
            Gap Digital Experience and Commerce &nbsp;·&nbsp; Shift3 (21:30–06:30) → Shift1 (05:30–14:30) Handover
          </p>
        </div>

        {/* ── 1. Shift Details ── */}
        <ReportSection number="1" title="Shift Details">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {[
                ["Project / Product", "Gap Digital Experience and Commerce"],
                ["Shift Date", dateStr],
                ["Shift Time", "Night Shift (Shift3): 21:30 IST – 06:30 IST"],
                ["Report Prepared By", user?.name ?? "Shift Lead"],
                ["Outgoing Shift", "Shift3 — Night (21:30 – 06:30 IST)"],
                ["Incoming Shift", "Shift1 — Morning (05:30 – 14:30 IST)"],
                ["Client / Account", "Gap Digital Experience and Commerce – Support"],
                ["Handover Time", "06:30 IST"],
              ].map(([label, value]) => (
                <tr key={label} className="border border-gray-300">
                  <td className="bg-gray-50 font-medium px-3 py-2 w-48 border-r border-gray-300 align-top">
                    {label}
                  </td>
                  <td className="px-3 py-2">{value}</td>
                </tr>
              ))}
              <tr className="border border-gray-300">
                <td className="bg-gray-50 font-medium px-3 py-2 border-r border-gray-300 align-top">
                  Outgoing Teams
                </td>
                <td className="px-3 py-2 space-y-0.5">
                  {shiftsByProject.map(({ proj, outgoing }) =>
                    outgoing.length > 0 ? (
                      <p key={proj.id} className="text-sm">
                        <span className="font-medium text-gray-700">{proj.name}:</span>{" "}
                        <span className="text-gray-600">{outgoing.join(", ")}</span>
                      </p>
                    ) : null
                  )}
                </td>
              </tr>
              <tr className="border border-gray-300">
                <td className="bg-gray-50 font-medium px-3 py-2 border-r border-gray-300 align-top">
                  Incoming Teams
                </td>
                <td className="px-3 py-2 space-y-0.5">
                  {shiftsByProject.map(({ proj, incoming }) =>
                    incoming.length > 0 ? (
                      <p key={proj.id} className="text-sm">
                        <span className="font-medium text-gray-700">{proj.name}:</span>{" "}
                        <span className="text-gray-600">{incoming.join(", ")}</span>
                      </p>
                    ) : null
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </ReportSection>

        {/* ── 2. Shift Summary ── */}
        <ReportSection number="2" title="Shift Summary — Ticket Snapshot and SLA">
          {projectStats.map((proj) => {
            const sp = shiftsByProject.find((s) => s.proj.id === proj.id);

            const rows = [
              { key: "P1_CRITICAL", label: "P1 — Critical Incidents",       logs: proj.p1, rowClass: "bg-red-50" },
              { key: "P2_HIGH",     label: "P2 — High Priority",            logs: proj.p2, rowClass: "bg-orange-50" },
              { key: "P3_MEDIUM",   label: "P3 — Medium",                   logs: proj.p3, rowClass: "" },
              { key: "P4_LOW",      label: "P4 — Low / Service Request",    logs: proj.p4, rowClass: "" },
            ];

            return (
              <div key={proj.id} className="mb-7 border border-gray-300 rounded overflow-hidden">
                {/* Project header */}
                <div className="bg-indigo-700 text-white px-3 py-2 text-sm font-semibold">
                  {proj.name}
                </div>

                {/* Shift members */}
                {sp && (sp.outgoing.length > 0 || sp.incoming.length > 0) && (
                  <div className="grid grid-cols-2 divide-x divide-gray-200 bg-indigo-50 border-b border-gray-200 text-xs">
                    <div className="px-3 py-1.5">
                      <span className="font-semibold text-indigo-700">Outgoing (Shift3): </span>
                      <span className="text-gray-700">{sp.outgoing.join(", ") || "—"}</span>
                    </div>
                    <div className="px-3 py-1.5">
                      <span className="font-semibold text-indigo-700">Incoming (Shift1): </span>
                      <span className="text-gray-700">{sp.incoming.join(", ") || "—"}</span>
                    </div>
                  </div>
                )}

                {/* Ticket snapshot table */}
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="border-r border-gray-300 px-2 py-1.5 text-left font-semibold">Priority</th>
                      <th className="border-r border-gray-300 px-2 py-1.5 text-center font-semibold">Received</th>
                      <th className="border-r border-gray-300 px-2 py-1.5 text-center font-semibold">Resolved</th>
                      <th className="border-r border-gray-300 px-2 py-1.5 text-center font-semibold">Pending</th>
                      <th className="border-r border-gray-300 px-2 py-1.5 text-left font-semibold">Incident No</th>
                      <th className="px-2 py-1.5 text-center font-semibold">SLA Met</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Total row */}
                    <tr className="border-b border-gray-200 font-semibold bg-gray-50">
                      <td className="border-r border-gray-200 px-2 py-1.5">Total Tickets</td>
                      <td className="border-r border-gray-200 px-2 py-1.5 text-center">{proj.total}</td>
                      <td className="border-r border-gray-200 px-2 py-1.5 text-center">{proj.resolved}</td>
                      <td className="border-r border-gray-200 px-2 py-1.5 text-center">{proj.pending}</td>
                      <td className="border-r border-gray-200 px-2 py-1.5">—</td>
                      <td className="px-2 py-1.5 text-center">—</td>
                    </tr>
                    {rows.map(({ key, label, logs, rowClass }) => {
                      const ids = logs
                        .map((l) => l.snowTicketId ?? l.pagerDutyRef)
                        .filter(Boolean) as string[];
                      const res = logs.filter((l) => l.resolvedAt !== null).length;
                      const cnt = logs.length;
                      return (
                        <tr key={key} className={`border-b border-gray-100 ${rowClass}`}>
                          <td className="border-r border-gray-200 px-2 py-1.5">{label}</td>
                          <td className="border-r border-gray-200 px-2 py-1.5 text-center">{cnt || "—"}</td>
                          <td className="border-r border-gray-200 px-2 py-1.5 text-center">{res || (cnt ? "0" : "—")}</td>
                          <td className="border-r border-gray-200 px-2 py-1.5 text-center">
                            {cnt ? cnt - res : "—"}
                          </td>
                          <td className="border-r border-gray-200 px-2 py-1.5 text-gray-600 font-mono">
                            {ids.join(", ") || "—"}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {cnt === 0 ? "—" : res === cnt ? "Yes" : "Partial"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Remarks */}
                {proj.logs.length > 0 && (
                  <div className="bg-gray-50 border-t border-gray-200 px-3 py-2 space-y-0.5">
                    <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wide mb-1">Remarks</p>
                    {proj.logs.map((l) => (
                      <p key={l.id} className="text-[11px] text-gray-700">
                        <span className={`font-semibold ${l.severity === "P1_CRITICAL" ? "text-red-700" : l.severity === "P2_HIGH" ? "text-orange-700" : "text-gray-600"}`}>
                          [{l.severity.replace("_", " ")}]
                        </span>{" "}
                        {l.title}
                        {" — "}
                        <span className="text-gray-500">{l.status.replace("_", " ")}</span>
                        {l.isBlockingDependency && (
                          <span className="ml-1 text-red-600 font-semibold"> [BLOCKING]</span>
                        )}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </ReportSection>

        {/* ── 3. Active Incidents ── */}
        <ReportSection number="3" title="Active Incidents & Open Tickets — Applicable for All PT">
          {activeIncidents.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No active incidents at time of handover.</p>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  {["INC #", "Pri", "Summary", "Module / Service", "Current Status", "Action Required by Incoming Shift"].map((h) => (
                    <th key={h} className="border border-gray-300 px-2 py-1.5 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeIncidents.map((inc) => {
                  const proj = MOCK_PROJECTS.find((p) => p.id === inc.projectId);
                  const sevLabel = inc.severity.replace("_", " ").split(" ")[0];
                  return (
                    <tr
                      key={inc.id}
                      className={inc.severity === "P1_CRITICAL" ? "bg-red-50" : inc.severity === "P2_HIGH" ? "bg-orange-50" : ""}
                    >
                      <td className="border border-gray-300 px-2 py-1.5 font-mono whitespace-nowrap">
                        {inc.snowTicketId ?? inc.pagerDutyRef ?? "—"}
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 font-bold text-center">
                        {sevLabel}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 max-w-[200px]">{inc.title}</td>
                      <td className="border border-gray-300 px-2 py-1.5 whitespace-nowrap">{proj?.name ?? "—"}</td>
                      <td className="border border-gray-300 px-2 py-1.5 whitespace-nowrap">
                        {inc.status.replace("_", " ")}
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        {inc.isBlockingDependency
                          ? "⚠ Immediate attention required — blocking dependency active"
                          : "Monitor and update incoming shift lead"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </ReportSection>

        {/* ── 4. Risks ── */}
        <ReportSection number="4" title="Risks">
          {activeIncidents.filter((i) => i.isBlockingDependency).length > 0 ? (
            <ul className="space-y-2 text-sm">
              {activeIncidents
                .filter((i) => i.isBlockingDependency)
                .map((i) => (
                  <li key={i.id} className="flex gap-2 items-start rounded border border-red-200 bg-red-50 px-3 py-2">
                    <span className="mt-0.5 text-red-600">▲</span>
                    <span>
                      <strong className="text-red-700">{i.severity.replace("_", " ")}:</strong>{" "}
                      {i.title}
                      {i.blockingReason && (
                        <span className="block text-xs text-gray-600 mt-0.5">{i.blockingReason}</span>
                      )}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <div className="border border-gray-300 rounded px-4 py-3 text-sm text-gray-500 italic">
              No significant risks identified at time of handover.
            </div>
          )}
        </ReportSection>

        {/* ── 5. Sign-off ── */}
        <ReportSection number="5" title="Handover Sign-Off">
          <div className="grid grid-cols-2 gap-6">
            <SignOffBox
              heading="Outgoing Shift Sign-Off"
              name={outgoingLead?.name ?? "—"}
              role="Night Shift Lead"
              time="06:30 IST"
            />
            <SignOffBox
              heading="Incoming Shift Acknowledgement"
              name={incomingLead?.name ?? "—"}
              role="Morning Shift Lead"
              time="________________"
            />
          </div>
          <p className="text-center text-xs text-gray-400 mt-8 pt-5 border-t border-gray-200">
            — End of Shift Handover Report —
          </p>
        </ReportSection>

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReportSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-xs font-bold uppercase tracking-widest bg-gray-800 text-white px-4 py-2 rounded-sm mb-4">
        {number}.&nbsp; {title}
      </h2>
      {children}
    </section>
  );
}

function SignOffBox({
  heading,
  name,
  role,
  time,
}: {
  heading: string;
  name: string;
  role: string;
  time: string;
}) {
  return (
    <div className="border border-gray-300 rounded p-5 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-700">{heading}</p>
      <div className="text-sm space-y-2">
        <p><span className="font-medium w-20 inline-block">Name:</span> {name}</p>
        <p><span className="font-medium w-20 inline-block">Role:</span> {role}</p>
        <p><span className="font-medium w-20 inline-block">Time:</span> {time}</p>
        <div className="mt-5 pt-4 border-t border-gray-200">
          <p className="font-medium text-gray-700 mb-4">Signature:</p>
          <div className="border-b border-gray-400 w-48 h-8" />
        </div>
      </div>
    </div>
  );
}
