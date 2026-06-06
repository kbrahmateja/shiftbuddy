"use server";

// ============================================================
// Server Actions: Shift Handover Protocol
// ─────────────────────────────────────────────────────────────
// executeHandover    — LEAD / MANAGER only
// acknowledgeHandover — LEAD / MANAGER only (incoming lead)
// disputeHandover    — LEAD / MANAGER only (incoming lead)
// approveSwapRequest — LEAD / MANAGER only
// rejectSwapRequest  — LEAD / MANAGER only
// requestShiftSwap   — CONTRACTOR / EMPLOYEE / LEAD only
// ============================================================

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole, AuthError } from "@/lib/auth";
import type { ActionResult } from "@/types";

// ─────────────────────────────────────────────
// HANDOVER SCHEMAS
// ─────────────────────────────────────────────

const HandoverSchema = z.object({
  projectId: z.string().cuid("projectId must be a valid CUID."),
  outgoingShiftId: z.string().cuid("outgoingShiftId must be a valid CUID."),
  incomingShiftId: z.string().cuid("incomingShiftId must be a valid CUID."),
  incomingLeadId: z.string().cuid("incomingLeadId must be a valid CUID."),
  openItemsSummary: z
    .string()
    .min(20, "Open items summary must be at least 20 characters.")
    .max(10_000, "Summary cannot exceed 10 000 characters.")
    .trim(),
  resolvedSummary: z
    .string()
    .min(20, "Resolved summary must be at least 20 characters.")
    .max(10_000, "Summary cannot exceed 10 000 characters.")
    .trim(),
  escalationNotes: z
    .string()
    .max(3_000, "Escalation notes cannot exceed 3 000 characters.")
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
}).refine(
  (d) => d.outgoingShiftId !== d.incomingShiftId,
  {
    path: ["incomingShiftId"],
    message: "Outgoing and incoming shift IDs cannot be the same.",
  }
);

const AcknowledgeSchema = z.object({
  handoverId: z.string().cuid("handoverId must be a valid CUID."),
  incomingLeadNotes: z
    .string()
    .max(2_000, "Notes cannot exceed 2 000 characters.")
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
});

const DisputeSchema = z.object({
  handoverId: z.string().cuid("handoverId must be a valid CUID."),
  disputeReason: z
    .string()
    .min(10, "Please provide a meaningful dispute reason (at least 10 characters).")
    .max(2_000, "Dispute reason cannot exceed 2 000 characters.")
    .trim(),
});

const SwapSchema = z.object({
  shiftId: z.string().cuid("shiftId must be a valid CUID."),
  projectId: z.string().cuid("projectId must be a valid CUID."),
  recipientId: z.string().cuid("recipientId must be a valid CUID."),
  reason: z
    .string()
    .min(10, "Please provide a reason for the swap request (at least 10 characters).")
    .max(1_000, "Reason cannot exceed 1 000 characters.")
    .trim(),
});

const SwapDecisionSchema = z.object({
  swapRequestId: z.string().cuid("swapRequestId must be a valid CUID."),
  rejectionNote: z
    .string()
    .max(500, "Rejection note cannot exceed 500 characters.")
    .trim()
    .optional(),
});

// ─────────────────────────────────────────────
// ACTION: executeHandover
// Only LEAD or MANAGER may initiate a formal handover.
// CONTRACTOR / EMPLOYEE / GAP_STAKEHOLDER are hard-blocked.
// ─────────────────────────────────────────────

export async function executeHandover(
  rawInput: z.input<typeof HandoverSchema>
): Promise<ActionResult<{ handoverId: string }>> {
  try {
    // ── RBAC guard ──
    const session = await requireRole(
      ["LEAD", "MANAGER"],
      "executeHandover"
    );

    // ── Validate input ──
    const parsed = HandoverSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed.",
        fieldErrors: Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v ?? []])
        ),
      };
    }

    const data = parsed.data;

    // ── Scope check: LEAD may only initiate handovers for their own project ──
    if (
      session.role === "LEAD" &&
      session.activeProjectId !== null &&
      data.projectId !== session.activeProjectId
    ) {
      return {
        success: false,
        error: "You can only initiate handovers for your active project.",
      };
    }

    // In production:
    //   const existing = await prisma.shiftHandover.findFirst({
    //     where: { outgoingShiftId: data.outgoingShiftId, status: { not: "DISPUTED" } },
    //   });
    //   if (existing) {
    //     return { success: false, error: "A handover note already exists for this shift." };
    //   }
    //
    //   const handover = await prisma.shiftHandover.create({
    //     data: {
    //       status: "SUBMITTED",
    //       projectId: data.projectId,
    //       outgoingShiftId: data.outgoingShiftId,
    //       incomingShiftId: data.incomingShiftId,
    //       outgoingLeadId: session.id,
    //       incomingLeadId: data.incomingLeadId,
    //       openItemsSummary: data.openItemsSummary,
    //       resolvedSummary: data.resolvedSummary,
    //       escalationNotes: data.escalationNotes ?? null,
    //       submittedAt: new Date(),
    //       dueBy: new Date(Date.now() + 30 * 60 * 1000), // 30 min SLA
    //     },
    //     select: { id: true },
    //   });
    //
    //   // Update outgoing shift status
    //   await prisma.shift.update({
    //     where: { id: data.outgoingShiftId },
    //     data: { status: "HANDED_OVER" },
    //   });
    //
    //   // Notify incoming lead
    //   await prisma.notification.create({
    //     data: {
    //       userId: data.incomingLeadId,
    //       title: "Handover Pending Acknowledgment",
    //       body: `${session.name} has submitted a shift handover note. Please acknowledge within 30 minutes.`,
    //       linkUrl: `/dashboard/handovers/${handover.id}`,
    //     },
    //   });
    //
    //   await prisma.auditLog.create({
    //     data: {
    //       actorId: session.id,
    //       action: "HANDOVER_SUBMITTED",
    //       entityType: "ShiftHandover",
    //       entityId: handover.id,
    //     },
    //   });

    const handover = { id: `handover_${Date.now()}` };

    revalidatePath("/dashboard/handovers");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: { handoverId: handover.id },
      message: "Handover note submitted. The incoming lead has been notified and has 30 minutes to acknowledge.",
    };
  } catch (err) {
    if (err instanceof AuthError) {
      return { success: false, error: err.message };
    }
    console.error("[executeHandover] Unexpected error:", err);
    return { success: false, error: "Failed to submit handover. Please try again." };
  }
}

// ─────────────────────────────────────────────
// ACTION: acknowledgeHandover
// ─────────────────────────────────────────────

export async function acknowledgeHandover(
  rawInput: z.input<typeof AcknowledgeSchema>
): Promise<ActionResult<{ handoverId: string }>> {
  try {
    const session = await requireRole(["LEAD", "MANAGER"], "acknowledgeHandover");

    const parsed = AcknowledgeSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed.",
        fieldErrors: Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v ?? []])
        ),
      };
    }

    const data = parsed.data;

    // In production:
    //   const handover = await prisma.shiftHandover.findUnique({ where: { id: data.handoverId } });
    //   if (!handover) return { success: false, error: "Handover not found." };
    //   if (handover.incomingLeadId !== session.id && session.role !== "MANAGER") {
    //     return { success: false, error: "Only the designated incoming lead can acknowledge this handover." };
    //   }
    //   if (handover.status !== "SUBMITTED") {
    //     return { success: false, error: `Cannot acknowledge a handover in "${handover.status}" status.` };
    //   }
    //   await prisma.shiftHandover.update({
    //     where: { id: data.handoverId },
    //     data: {
    //       status: "ACKNOWLEDGED",
    //       incomingLeadNotes: data.incomingLeadNotes ?? null,
    //       acknowledgedAt: new Date(),
    //     },
    //   });
    //   await prisma.shift.update({
    //     where: { id: handover.incomingShiftId },
    //     data: { status: "ACTIVE" },
    //   });

    revalidatePath("/dashboard/handovers");

    return {
      success: true,
      data: { handoverId: data.handoverId },
      message: "Handover acknowledged. Your shift is now marked as active.",
    };
  } catch (err) {
    if (err instanceof AuthError) return { success: false, error: err.message };
    console.error("[acknowledgeHandover]:", err);
    return { success: false, error: "Failed to acknowledge handover." };
  }
}

// ─────────────────────────────────────────────
// ACTION: disputeHandover
// ─────────────────────────────────────────────

export async function disputeHandover(
  rawInput: z.input<typeof DisputeSchema>
): Promise<ActionResult<{ handoverId: string }>> {
  try {
    const session = await requireRole(["LEAD", "MANAGER"], "disputeHandover");

    const parsed = DisputeSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.flatten().fieldErrors.disputeReason?.[0] ?? "Validation failed." };
    }

    const data = parsed.data;

    // In production:
    //   await prisma.shiftHandover.update({
    //     where: { id: data.handoverId },
    //     data: { status: "DISPUTED", disputeReason: data.disputeReason },
    //   });
    //   // Notify outgoing lead of the dispute
    //   ...

    revalidatePath("/dashboard/handovers");

    return {
      success: true,
      data: { handoverId: data.handoverId },
      message: "Handover disputed. The outgoing lead has been notified to resolve the discrepancy.",
    };
  } catch (err) {
    if (err instanceof AuthError) return { success: false, error: err.message };
    console.error("[disputeHandover]:", err);
    return { success: false, error: "Failed to dispute handover." };
  }
}

// ─────────────────────────────────────────────
// ACTION: requestShiftSwap
// CONTRACTOR / EMPLOYEE / LEAD can request; cannot self-approve.
// ─────────────────────────────────────────────

export async function requestShiftSwap(
  rawInput: z.input<typeof SwapSchema>
): Promise<ActionResult<{ swapId: string }>> {
  try {
    const session = await requireRole(
      ["CONTRACTOR", "EMPLOYEE", "LEAD"],
      "requestShiftSwap"
    );

    const parsed = SwapSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed.",
        fieldErrors: Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v ?? []])
        ),
      };
    }

    const data = parsed.data;

    if (data.recipientId === session.id) {
      return {
        success: false,
        error: "You cannot request a shift swap with yourself.",
      };
    }

    // In production:
    //   const shift = await prisma.shift.findUnique({ where: { id: data.shiftId } });
    //   if (!shift) return { success: false, error: "Shift not found." };
    //   if (shift.assignedToId !== session.id) {
    //     return { success: false, error: "You can only swap shifts assigned to you." };
    //   }
    //   const swap = await prisma.shiftSwapRequest.create({ data: { ... } });

    const swap = { id: `swap_${Date.now()}` };

    revalidatePath("/dashboard/swaps");

    return {
      success: true,
      data: { swapId: swap.id },
      message: "Swap request submitted. Your shift lead will review and approve.",
    };
  } catch (err) {
    if (err instanceof AuthError) return { success: false, error: err.message };
    console.error("[requestShiftSwap]:", err);
    return { success: false, error: "Failed to submit swap request." };
  }
}

// ─────────────────────────────────────────────
// ACTION: approveSwapRequest (LEAD / MANAGER only)
// ─────────────────────────────────────────────

export async function approveSwapRequest(
  rawInput: z.input<typeof SwapDecisionSchema>
): Promise<ActionResult<{ swapId: string }>> {
  try {
    const session = await requireRole(["LEAD", "MANAGER"], "approveSwapRequest");

    const parsed = SwapDecisionSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: "Invalid swap request ID." };
    }

    // In production:
    //   const swap = await prisma.shiftSwapRequest.findUnique({ ... });
    //   if (!swap) return { success: false, error: "Swap request not found." };
    //   if (swap.status !== "PENDING") {
    //     return { success: false, error: `Cannot approve a swap in "${swap.status}" status.` };
    //   }
    //   await prisma.$transaction([
    //     prisma.shiftSwapRequest.update({ where: { id: swap.id }, data: { status: "APPROVED", approvedById: session.id, decidedAt: new Date() } }),
    //     prisma.shift.update({ where: { id: swap.shiftId }, data: { assignedToId: swap.recipientId } }),
    //   ]);

    revalidatePath("/dashboard/swaps");
    revalidatePath("/dashboard/shifts");

    return {
      success: true,
      data: { swapId: parsed.data.swapRequestId },
      message: "Shift swap approved. Both parties have been notified.",
    };
  } catch (err) {
    if (err instanceof AuthError) return { success: false, error: err.message };
    console.error("[approveSwapRequest]:", err);
    return { success: false, error: "Failed to approve swap request." };
  }
}

// ─────────────────────────────────────────────
// ACTION: rejectSwapRequest (LEAD / MANAGER only)
// ─────────────────────────────────────────────

export async function rejectSwapRequest(
  rawInput: z.input<typeof SwapDecisionSchema> & { rejectionNote: string }
): Promise<ActionResult<{ swapId: string }>> {
  try {
    const session = await requireRole(["LEAD", "MANAGER"], "rejectSwapRequest");

    const parsed = SwapDecisionSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: "Invalid swap request ID." };
    }

    if (!rawInput.rejectionNote?.trim()) {
      return {
        success: false,
        error: "A rejection note is required when rejecting a swap request.",
        fieldErrors: { rejectionNote: ["Rejection note is required."] },
      };
    }

    // In production:
    //   await prisma.shiftSwapRequest.update({
    //     where: { id: parsed.data.swapRequestId },
    //     data: { status: "REJECTED", approvedById: session.id, rejectionNote: rawInput.rejectionNote.trim(), decidedAt: new Date() },
    //   });

    revalidatePath("/dashboard/swaps");

    return {
      success: true,
      data: { swapId: parsed.data.swapRequestId },
      message: "Shift swap rejected. The requester has been notified.",
    };
  } catch (err) {
    if (err instanceof AuthError) return { success: false, error: err.message };
    console.error("[rejectSwapRequest]:", err);
    return { success: false, error: "Failed to reject swap request." };
  }
}

// ─────────────────────────────────────────────
// ACTION: modifyStakeholderDashboard — EXPLICITLY BLOCKED
// Any attempt to modify the GAP_STAKEHOLDER read-only dashboard
// layout is rejected regardless of who calls it.
// ─────────────────────────────────────────────

export async function modifyStakeholderDashboard(): Promise<ActionResult<never>> {
  // No session check needed — this action is unconditionally forbidden.
  // Even a MANAGER cannot modify the stakeholder view layout, as it is
  // a client-controlled configuration managed by Corp IT.
  return {
    success: false,
    error:
      "FORBIDDEN: The Corp Stakeholder dashboard layout is read-only and cannot be modified through this system. Contact your Corp IT administrator to adjust visibility settings.",
  };
}
