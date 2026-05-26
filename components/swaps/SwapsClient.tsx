"use client";

import { useState, useEffect } from "react";
import { Plus, X, ArrowLeftRight } from "lucide-react";
import { MOCK_USERS, MOCK_SHIFTS, MOCK_SWAPS } from "@/lib/mock-data";
import type { SessionUser } from "@/types";

const SWAPS_KEY = "sb_swaps";

interface LocalSwap {
  id: string;
  status: "PENDING";
  reason: string;
  requestedAt: string;
  shiftId: string;
  projectId: string;
  requesterId: string;
  recipientId: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:   "bg-yellow-100 text-yellow-800",
  APPROVED:  "bg-green-100  text-green-800",
  REJECTED:  "bg-red-100    text-red-800",
  CANCELLED: "bg-gray-100   text-gray-600",
};

export function SwapsClient({ user }: { user: SessionUser }) {
  const isContractor = user.role === "CONTRACTOR" || user.role === "EMPLOYEE";
  const isLead       = user.role === "LEAD" || user.role === "MANAGER";

  const [showModal,  setShowModal]  = useState(false);
  const [localSwaps, setLocalSwaps] = useState<LocalSwap[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(SWAPS_KEY) ?? "[]") as LocalSwap[];
      setLocalSwaps(stored);
    } catch { /* ignore */ }
  }, []);

  // My upcoming shifts
  const myShifts = MOCK_SHIFTS.filter((s) => s.assignedToId === user.id);

  // All other contractors/employees
  const colleagues = MOCK_USERS.filter(
    (u) => u.id !== user.id && (u.role === "CONTRACTOR" || u.role === "EMPLOYEE"),
  );

  function handleSubmit(
    shiftId: string,
    projectId: string,
    recipientId: string,
    reason: string,
  ) {
    const newSwap: LocalSwap = {
      id: `swap_${Date.now()}`,
      status: "PENDING",
      reason,
      requestedAt: new Date().toISOString(),
      shiftId,
      projectId,
      requesterId: user.id,
      recipientId,
    };

    const updated = [newSwap, ...localSwaps];
    setLocalSwaps(updated);
    localStorage.setItem(SWAPS_KEY, JSON.stringify(updated));
    setShowModal(false);

    // Notify leads via DOM event (same-tab alert)
    const recipientName = MOCK_USERS.find((u) => u.id === recipientId)?.name ?? "colleague";
    window.dispatchEvent(
      new CustomEvent("sb:swap-request", {
        detail: { requester: user.name, recipient: recipientName },
      }),
    );

    // Store in notification log for Notifications page
    try {
      const notifs = JSON.parse(localStorage.getItem("sb_att_notifications") ?? "[]");
      notifs.unshift({
        id: `notif_swap_${Date.now()}`,
        userId: user.id,
        userName: user.name,
        projectName: "Shift Swap",
        event: "SWAP_REQUEST",
        time: new Date().toISOString(),
        swapWith: recipientName,
      });
      localStorage.setItem("sb_att_notifications", JSON.stringify(notifs.slice(0, 50)));
    } catch { /* ignore */ }
  }

  // Merge local + mock swaps (local first = most recent on top)
  const allSwaps = [
    ...localSwaps.map((s) => ({ ...s, requestedAt: new Date(s.requestedAt), decidedAt: null as Date | null })),
    ...MOCK_SWAPS.map((s) => ({ ...s, decidedAt: s.decidedAt ?? null })),
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Shift Swap Requests</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Peer-to-peer shift swap requests pending lead approval.
          </p>
        </div>
        {isContractor && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" />
            Request Swap
          </button>
        )}
      </div>

      {/* Swap list */}
      {allSwaps.length === 0 ? (
        <div className="rounded-lg border bg-white p-10 text-center text-sm text-gray-400">
          No swap requests yet.
        </div>
      ) : (
        <div className="space-y-3">
          {allSwaps.map((swap) => {
            const requester     = MOCK_USERS.find((u) => u.id === swap.requesterId);
            const recipient     = MOCK_USERS.find((u) => u.id === swap.recipientId);
            const requesterShift = MOCK_SHIFTS.find((s) => s.id === swap.shiftId);
            const recipientShift = MOCK_SHIFTS.find((s) => s.assignedToId === swap.recipientId);
            const isMine = swap.requesterId === user.id;

            return (
              <div
                key={swap.id}
                className={`rounded-lg border bg-white p-5 space-y-3 ${isMine ? "border-indigo-200 ring-1 ring-indigo-100" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[swap.status]}`}>
                        {swap.status}
                      </span>
                      {isMine && (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                          My Request
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {requester?.name ?? "Unknown"}
                        <ArrowLeftRight className="inline h-3.5 w-3.5 text-gray-400 mx-1.5" />
                        {recipient?.name ?? "Unknown"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{swap.reason}</p>
                  </div>
                  <p className="text-xs text-gray-400 shrink-0">
                    {swap.requestedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <ShiftCard label={`${requester?.name ?? "—"}'s shift`} shift={requesterShift} />
                  <ShiftCard label={`${recipient?.name ?? "—"}'s shift`} shift={recipientShift} />
                </div>

                {isLead && swap.status === "PENDING" && (
                  <div className="flex gap-2 pt-1 border-t">
                    <button disabled className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white opacity-60 cursor-not-allowed">
                      Approve
                    </button>
                    <button disabled className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 opacity-60 cursor-not-allowed">
                      Reject
                    </button>
                    <span className="text-xs text-gray-400 self-center ml-1">
                      (requires database)
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <SwapRequestModal
          myShifts={myShifts}
          colleagues={colleagues}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// ── Shift info card ────────────────────────────────────────────────────────────

function ShiftCard({
  label,
  shift,
}: {
  label: string;
  shift: (typeof MOCK_SHIFTS)[number] | undefined;
}) {
  return (
    <div className="rounded-md border bg-gray-50 p-3">
      <p className="mb-1 text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">{shift?.pattern ?? "—"}</p>
      <p className="text-xs text-gray-500">
        {shift
          ? shift.startTime.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) +
            " · " +
            shift.startTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) +
            " IST"
          : "—"}
      </p>
    </div>
  );
}

// ── Request modal ─────────────────────────────────────────────────────────────

function SwapRequestModal({
  myShifts,
  colleagues,
  onSubmit,
  onClose,
}: {
  myShifts: typeof MOCK_SHIFTS;
  colleagues: typeof MOCK_USERS;
  onSubmit: (shiftId: string, projectId: string, recipientId: string, reason: string) => void;
  onClose: () => void;
}) {
  const [shiftId,     setShiftId]     = useState(myShifts[0]?.id ?? "");
  const [recipientId, setRecipientId] = useState(colleagues[0]?.id ?? "");
  const [reason,      setReason]      = useState("");

  const selectedShift = myShifts.find((s) => s.id === shiftId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shiftId || !recipientId || !reason.trim()) return;
    onSubmit(shiftId, selectedShift?.projectId ?? "", recipientId, reason.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Request Shift Swap</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Select your shift and a colleague — lead will approve.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* My shift */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Your shift to swap
            </label>
            {myShifts.length === 0 ? (
              <p className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-400">
                No upcoming shifts assigned.
              </p>
            ) : (
              <select
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {myShifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.pattern} ·{" "}
                    {s.startTime.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}{" "}
                    {s.startTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })} IST
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Swap with */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Swap with
            </label>
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {colleagues.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Doctor appointment, family event, travel plans..."
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={!shiftId || !recipientId || !reason.trim() || myShifts.length === 0}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit Request
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
