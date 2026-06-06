"use server";
// app/actions/shift.ts
// ─────────────────────────────────────────────────────────────
// Server Actions for shift management.
// Only LEAD and MANAGER may mutate shifts.
// All writes are Prisma-stubbed; logic runs fully on mock data.
// ─────────────────────────────────────────────────────────────

import { z } from "zod";
import { requireRole, AuthError } from "@/lib/auth";
import { MOCK_SHIFTS, MOCK_USERS, MOCK_PROJECTS } from "@/lib/mock-data";
import type { ActionResult, Shift, ShiftPattern, ShiftStatus } from "@/types";

// ── Zod schemas ───────────────────────────────────────────────────────────

const AddMemberSchema = z.object({
  userId:     z.string().min(1, "User required"),
  projectId:  z.string().min(1, "Project required"),
  pattern:    z.enum(["MORNING", "AFTERNOON", "NIGHT", "GENERAL", "WEEKEND", "ON_CALL"]),
  startTime:  z.string().datetime({ message: "Valid start datetime required" }),
  endTime:    z.string().datetime({ message: "Valid end datetime required" }),
  timezone:   z.string().default("Asia/Kolkata"),
  notes:      z.string().max(500).optional(),
}).superRefine((d, ctx) => {
  if (new Date(d.endTime) <= new Date(d.startTime)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End time must be after start time", path: ["endTime"] });
  }
});

const BulkAssignSchema = z.object({
  userIds:    z.array(z.string()).min(1, "Select at least one member"),
  projectId:  z.string().min(1, "Project required"),
  pattern:    z.enum(["MORNING", "AFTERNOON", "NIGHT", "GENERAL", "WEEKEND", "ON_CALL"]),
  startDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD required"),
  endDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD required"),
  timezone:   z.string().default("Asia/Kolkata"),
  notes:      z.string().max(500).optional(),
}).superRefine((d, ctx) => {
  if (new Date(d.endDate) < new Date(d.startDate)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date must be on or after start date", path: ["endDate"] });
  }
});

const EditShiftSchema = z.object({
  shiftId:   z.string().min(1),
  pattern:   z.enum(["MORNING", "AFTERNOON", "NIGHT", "GENERAL", "WEEKEND", "ON_CALL"]).optional(),
  startTime: z.string().datetime().optional(),
  endTime:   z.string().datetime().optional(),
  notes:     z.string().max(500).optional(),
  status:    z.enum(["SCHEDULED", "ACTIVE", "HANDED_OVER", "COMPLETED", "CANCELLED"]).optional(),
});

const RemoveShiftSchema = z.object({
  shiftId: z.string().min(1, "Shift ID required"),
  reason:  z.string().max(300).optional(),
});

const BulkRemoveSchema = z.object({
  shiftIds: z.array(z.string()).min(1, "Select at least one shift"),
  reason:   z.string().max(300).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────

function shiftHoursForPattern(pattern: ShiftPattern): [number, number, number, number] {
  const map: Record<ShiftPattern, [number, number, number, number]> = {
    MORNING:   [5,  30, 14, 30],
    AFTERNOON: [13, 30, 22, 30],
    NIGHT:     [21, 30, 6,  30],
    GENERAL:   [9,  0,  17, 0],
    WEEKEND:   [9,  0,  17, 0],
    ON_CALL:   [0,  0,  23, 59],
  };
  return map[pattern];
}

function buildShiftsForDateRange(
  userIds: string[],
  projectId: string,
  pattern: ShiftPattern,
  startDate: string,
  endDate: string,
  timezone: string,
  notes: string | undefined,
  approvedById: string,
): (Shift & { assignedTo: { id: string; name: string; role: string } })[] {
  const [sh, sm, eh, em] = shiftHoursForPattern(pattern);
  const result: (Shift & { assignedTo: { id: string; name: string; role: string } })[] = [];

  const cursor = new Date(startDate + "T00:00:00");
  const end    = new Date(endDate   + "T00:00:00");

  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    for (const userId of userIds) {
      const user = MOCK_USERS.find((u) => u.id === userId);
      if (!user) continue;

      const start = new Date(`${dateStr}T${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}:00`);
      const endT  = new Date(`${dateStr}T${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}:00`);
      if (sh > eh) endT.setDate(endT.getDate() + 1); // overnight

      const now    = new Date();
      const status: ShiftStatus = now >= start && now <= endT ? "ACTIVE"
        : endT < now ? "COMPLETED"
        : "SCHEDULED";

      result.push({
        id:             `shift_new_${userId}_${dateStr}`,
        pattern,
        status,
        startTime:      start,
        endTime:        endT,
        timezone,
        notes:          notes ?? null,
        projectId,
        partnerTeamId:  null,
        assignedToId:   userId,
        approvedById,
        assignedTo:     { id: user.id, name: user.name, role: user.role },
        createdAt:      new Date(),
        updatedAt:      new Date(),
      } as Shift & { assignedTo: { id: string; name: string; role: string } });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

// ── Actions ───────────────────────────────────────────────────────────────

/**
 * Add a single member to a shift.
 */
export async function addMemberToShift(
  raw: unknown
): Promise<ActionResult<{ shiftId: string }>> {
  try {
    const actor  = await requireRole(["LEAD", "MANAGER"], "addMemberToShift");
    const parsed = AddMemberSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    const d = parsed.data;

    // Scope check: LEAD can only add to their own project
    if (actor.role === "LEAD" && actor.activeProjectId && actor.activeProjectId !== d.projectId) {
      return { success: false, error: "Leads can only manage shifts within their own project." };
    }

    // Duplicate check
    const conflict = MOCK_SHIFTS.find(
      (s) =>
        s.assignedToId === d.userId &&
        s.status !== "CANCELLED" &&
        new Date(d.startTime) < s.endTime &&
        new Date(d.endTime)   > s.startTime
    );
    if (conflict) {
      return {
        success: false,
        error: `Shift conflict: this member already has a ${conflict.pattern} shift overlapping that window.`,
      };
    }

    // Production: await prisma.shift.create({ data: { ... } });
    const newId = `shift_${d.userId}_${Date.now()}`;
    console.log("[addMemberToShift] Would create:", { ...d, id: newId, approvedById: actor.id });

    return { success: true, data: { shiftId: newId } };
  } catch (err) {
    if (err instanceof AuthError) return { success: false, error: err.message };
    console.error("[addMemberToShift]:", err);
    return { success: false, error: "Failed to add member to shift." };
  }
}

/**
 * Bulk-assign multiple members to shifts across a date range.
 * Creates one shift per member per day in [startDate, endDate].
 */
export async function bulkAssignShifts(
  raw: unknown
): Promise<ActionResult<{ created: number; skipped: number }>> {
  try {
    const actor  = await requireRole(["LEAD", "MANAGER"], "bulkAssignShifts");
    const parsed = BulkAssignSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    const d = parsed.data;

    if (actor.role === "LEAD" && actor.activeProjectId && actor.activeProjectId !== d.projectId) {
      return { success: false, error: "Leads can only manage shifts within their own project." };
    }

    const shifts = buildShiftsForDateRange(
      d.userIds, d.projectId, d.pattern as ShiftPattern,
      d.startDate, d.endDate, d.timezone, d.notes, actor.id
    );

    // Conflict filter
    let created = 0;
    let skipped = 0;
    for (const s of shifts) {
      const conflict = MOCK_SHIFTS.find(
        (ex) =>
          ex.assignedToId === s.assignedToId &&
          ex.status !== "CANCELLED" &&
          s.startTime < ex.endTime &&
          s.endTime   > ex.startTime
      );
      if (conflict) { skipped++; continue; }
      // Production: await prisma.shift.create({ data: s });
      created++;
    }

    console.log(`[bulkAssignShifts] Would create ${created} shifts, skip ${skipped} conflicts`);
    return { success: true, data: { created, skipped } };
  } catch (err) {
    if (err instanceof AuthError) return { success: false, error: err.message };
    console.error("[bulkAssignShifts]:", err);
    return { success: false, error: "Failed to bulk-assign shifts." };
  }
}

/**
 * Edit an existing shift (pattern, times, notes, status).
 */
export async function editShift(
  raw: unknown
): Promise<ActionResult<{ shiftId: string }>> {
  try {
    const actor  = await requireRole(["LEAD", "MANAGER"], "editShift");
    const parsed = EditShiftSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    const d = parsed.data;

    const shift = MOCK_SHIFTS.find((s) => s.id === d.shiftId);
    if (!shift) return { success: false, error: "Shift not found." };

    // LEAD scope check
    if (actor.role === "LEAD" && actor.activeProjectId && shift.projectId !== actor.activeProjectId) {
      return { success: false, error: "Leads can only edit shifts within their own project." };
    }

    if (d.startTime && d.endTime && new Date(d.endTime) <= new Date(d.startTime)) {
      return { success: false, error: "End time must be after start time." };
    }

    // Production: await prisma.shift.update({ where: { id: d.shiftId }, data: { ...d } });
    console.log("[editShift] Would update:", d);
    return { success: true, data: { shiftId: d.shiftId } };
  } catch (err) {
    if (err instanceof AuthError) return { success: false, error: err.message };
    console.error("[editShift]:", err);
    return { success: false, error: "Failed to edit shift." };
  }
}

/**
 * Remove a single member from a shift (cancel it).
 */
export async function removeFromShift(
  raw: unknown
): Promise<ActionResult<{ shiftId: string }>> {
  try {
    const actor  = await requireRole(["LEAD", "MANAGER"], "removeFromShift");
    const parsed = RemoveShiftSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const shift = MOCK_SHIFTS.find((s) => s.id === parsed.data.shiftId);
    if (!shift) return { success: false, error: "Shift not found." };

    if (actor.role === "LEAD" && actor.activeProjectId && shift.projectId !== actor.activeProjectId) {
      return { success: false, error: "Leads can only remove shifts from their own project." };
    }

    if (shift.status === "ACTIVE") {
      return { success: false, error: "Cannot remove an ACTIVE shift. Complete or hand over first." };
    }

    // Production: await prisma.shift.update({ where: { id: parsed.data.shiftId }, data: { status: "CANCELLED" } });
    console.log("[removeFromShift] Would cancel:", parsed.data.shiftId, "reason:", parsed.data.reason);
    return { success: true, data: { shiftId: parsed.data.shiftId } };
  } catch (err) {
    if (err instanceof AuthError) return { success: false, error: err.message };
    console.error("[removeFromShift]:", err);
    return { success: false, error: "Failed to remove from shift." };
  }
}

/**
 * Bulk-remove (cancel) multiple shifts at once.
 */
export async function bulkRemoveShifts(
  raw: unknown
): Promise<ActionResult<{ cancelled: number }>> {
  try {
    const actor  = await requireRole(["LEAD", "MANAGER"], "bulkRemoveShifts");
    const parsed = BulkRemoveSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const shifts = parsed.data.shiftIds
      .map((id) => MOCK_SHIFTS.find((s) => s.id === id))
      .filter(Boolean) as typeof MOCK_SHIFTS;

    // Scope filter
    const allowed = shifts.filter((s) =>
      actor.role === "MANAGER" ||
      !actor.activeProjectId ||
      s.projectId === actor.activeProjectId
    );

    const activeCount = allowed.filter((s) => s.status === "ACTIVE").length;
    if (activeCount > 0) {
      return { success: false, error: `${activeCount} shift(s) are currently ACTIVE and cannot be cancelled.` };
    }

    // Production: await prisma.shift.updateMany({ where: { id: { in: parsed.data.shiftIds } }, data: { status: "CANCELLED" } });
    console.log("[bulkRemoveShifts] Would cancel:", allowed.length, "shifts");
    return { success: true, data: { cancelled: allowed.length } };
  } catch (err) {
    if (err instanceof AuthError) return { success: false, error: err.message };
    console.error("[bulkRemoveShifts]:", err);
    return { success: false, error: "Failed to bulk-remove shifts." };
  }
}
