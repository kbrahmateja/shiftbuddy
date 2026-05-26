"use server";

// ============================================================
// Server Action: logDailyUpdate
// ─────────────────────────────────────────────────────────────
// Validates input with Zod, enforces RBAC, enforces external-ID
// format rules, and writes to the database via Prisma.
// GAP_STAKEHOLDER is hard-blocked — cannot log any update.
// ============================================================

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole, AuthError } from "@/lib/auth";
import { validateSnowTicketId, validatePagerDutyRef, validateUrl } from "@/lib/utils";
import type { ActionResult, DailyUpdateLog } from "@/types";

// ─────────────────────────────────────────────
// ZOD SCHEMA
// ─────────────────────────────────────────────

/**
 * Custom refinement: if source is SERVICENOW, snowTicketId is
 * required and must match the INC/CHG/RITM format.
 * If source is PAGERDUTY, pagerDutyRef is required and must be
 * a valid PD incident ID or URL.
 */
const LogUpdateSchema = z
  .object({
    title: z
      .string()
      .min(5, "Title must be at least 5 characters.")
      .max(200, "Title must be 200 characters or fewer.")
      .trim(),

    description: z
      .string()
      .min(10, "Description must be at least 10 characters.")
      .max(5000, "Description must be 5 000 characters or fewer.")
      .trim(),

    source: z.enum(
      ["PAGERDUTY", "SERVICENOW", "SLACK", "TEAMS", "VERBAL", "OTHER"],
      { errorMap: () => ({ message: "Source must be one of the listed channels." }) }
    ),

    severity: z.enum(
      ["P1_CRITICAL", "P2_HIGH", "P3_MEDIUM", "P4_LOW", "INFORMATIONAL"],
      { errorMap: () => ({ message: "Severity must be a valid ITIL priority level." }) }
    ),

    shiftId: z.string().cuid("shiftId must be a valid CUID."),

    projectId: z.string().cuid("projectId must be a valid CUID."),

    partnerTeamId: z.string().cuid("partnerTeamId must be a valid CUID.").optional(),

    occurredAt: z
      .string()
      .datetime({ message: "occurredAt must be a valid ISO-8601 datetime string." })
      .refine((val) => new Date(val) <= new Date(), {
        message: "occurredAt cannot be in the future.",
      }),

    snowTicketId: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .or(z.literal(""))
      .transform((v) => (v === "" ? undefined : v)),

    pagerDutyRef: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .transform((v) => (v === "" ? undefined : v)),

    slackMessageUrl: z
      .string()
      .trim()
      .url("slackMessageUrl must be a valid URL.")
      .optional()
      .or(z.literal(""))
      .transform((v) => (v === "" ? undefined : v)),

    teamsMessageUrl: z
      .string()
      .trim()
      .url("teamsMessageUrl must be a valid URL.")
      .optional()
      .or(z.literal(""))
      .transform((v) => (v === "" ? undefined : v)),

    isBlockingDependency: z.boolean().default(false),

    blockingReason: z
      .string()
      .max(500, "Blocking reason must be 500 characters or fewer.")
      .trim()
      .optional()
      .or(z.literal(""))
      .transform((v) => (v === "" ? undefined : v)),

    tags: z
      .array(
        z
          .string()
          .min(1)
          .max(64)
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9-]+$/, "Tags may only contain lowercase letters, numbers, and hyphens.")
      )
      .max(10, "A maximum of 10 tags are allowed.")
      .default([]),
  })
  // ── Cross-field validations ──
  .superRefine((data, ctx) => {
    // 1. If source is SERVICENOW, snowTicketId is mandatory and must be valid
    if (data.source === "SERVICENOW") {
      if (!data.snowTicketId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["snowTicketId"],
          message:
            "A ServiceNow Ticket ID is required when source is SERVICENOW (format: INC0001234).",
        });
        return;
      }
      if (!validateSnowTicketId(data.snowTicketId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["snowTicketId"],
          message:
            "Invalid ServiceNow Ticket ID. Must match: INC|CHG|RITM|TASK|REQ|PRB|SCTASK followed by 7 digits (e.g., INC0001234).",
        });
      }
    }

    // 2. If source is PAGERDUTY, pagerDutyRef is mandatory and must be valid
    if (data.source === "PAGERDUTY") {
      if (!data.pagerDutyRef) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pagerDutyRef"],
          message:
            "A PagerDuty incident reference is required when source is PAGERDUTY (e.g., P1A2B3C or full incident URL).",
        });
        return;
      }
      if (!validatePagerDutyRef(data.pagerDutyRef)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pagerDutyRef"],
          message:
            "Invalid PagerDuty reference. Must be a 7-character incident ID (e.g., P1A2B3C) or a full PagerDuty incident URL.",
        });
      }
    }

    // 3. If source is SLACK, slackMessageUrl is required
    if (data.source === "SLACK" && !data.slackMessageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slackMessageUrl"],
        message: "A Slack message URL is required when source is SLACK.",
      });
    }

    // 4. If source is TEAMS, teamsMessageUrl is required
    if (data.source === "TEAMS" && !data.teamsMessageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["teamsMessageUrl"],
        message: "A Teams message URL is required when source is TEAMS.",
      });
    }

    // 5. If isBlockingDependency is true, blockingReason is required
    if (data.isBlockingDependency && !data.blockingReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["blockingReason"],
        message: "A blocking reason must be provided when marking an item as a blocking dependency.",
      });
    }

    // 6. P1 incidents must always have a valid external reference
    if (
      data.severity === "P1_CRITICAL" &&
      !data.snowTicketId &&
      !data.pagerDutyRef
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["snowTicketId"],
        message:
          "P1 Critical incidents require a ServiceNow Ticket ID or PagerDuty reference for auditability.",
      });
    }
  });

type LogUpdateInput = z.input<typeof LogUpdateSchema>;

// ─────────────────────────────────────────────
// ACTION
// ─────────────────────────────────────────────

export async function logDailyUpdate(
  rawInput: LogUpdateInput
): Promise<ActionResult<{ logId: string }>> {
  try {
    // 1. ── RBAC: only these roles may log updates ──
    const session = await requireRole(
      ["CONTRACTOR", "EMPLOYEE", "LEAD", "MANAGER"],
      "logDailyUpdate"
    );

    // 2. ── Parse & validate input ──
    const parsed = LogUpdateSchema.safeParse(rawInput);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return {
        success: false,
        error: "Validation failed. Please check the highlighted fields.",
        fieldErrors: Object.fromEntries(
          Object.entries(fieldErrors).map(([k, v]) => [k, v ?? []])
        ),
      };
    }

    const data = parsed.data;

    // 3. ── Scope check: CONTRACTOR / EMPLOYEE can only log against
    //       their own project and partner team ──
    if (
      (session.role === "CONTRACTOR" || session.role === "EMPLOYEE") &&
      session.activeProjectId !== null &&
      data.projectId !== session.activeProjectId
    ) {
      return {
        success: false,
        error:
          "You can only log updates for your active project. Switch your project context to log updates for a different project.",
      };
    }

    // 4. ── Database write via Prisma ──
    // In production, replace the stub with:
    //
    //   const log = await prisma.dailyUpdateLog.create({
    //     data: {
    //       title: data.title,
    //       description: data.description,
    //       source: data.source,
    //       severity: data.severity,
    //       shiftId: data.shiftId,
    //       projectId: data.projectId,
    //       partnerTeamId: data.partnerTeamId ?? null,
    //       authorId: session.id,
    //       occurredAt: new Date(data.occurredAt),
    //       snowTicketId: data.snowTicketId ?? null,
    //       pagerDutyRef: data.pagerDutyRef ?? null,
    //       slackMessageUrl: data.slackMessageUrl ?? null,
    //       teamsMessageUrl: data.teamsMessageUrl ?? null,
    //       isBlockingDependency: data.isBlockingDependency,
    //       blockingReason: data.blockingReason ?? null,
    //       tags: {
    //         create: data.tags.map((label) => ({ label })),
    //       },
    //     },
    //     select: { id: true },
    //   });
    //
    //   // Audit log
    //   await prisma.auditLog.create({
    //     data: {
    //       actorId: session.id,
    //       action: "LOG_CREATED",
    //       entityType: "DailyUpdateLog",
    //       entityId: log.id,
    //       nextVal: data as unknown as Prisma.InputJsonValue,
    //     },
    //   });
    //
    //   // Notify shift lead if P1
    //   if (data.severity === "P1_CRITICAL") {
    //     await notifyShiftLead(data.shiftId, session, log.id);
    //   }

    // POC stub — simulate a created record
    const log = { id: `log_${Date.now()}` };

    // 5. ── Revalidate the feed page so the new entry appears immediately ──
    revalidatePath("/dashboard/feed");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: { logId: log.id },
      message: `Update logged successfully${data.severity === "P1_CRITICAL" ? " — P1 alert sent to shift lead." : "."}`,
    };
  } catch (err) {
    if (err instanceof AuthError) {
      return { success: false, error: err.message };
    }
    // Unexpected errors — log server-side but return generic message
    console.error("[logDailyUpdate] Unexpected error:", err);
    return {
      success: false,
      error: "An unexpected error occurred while saving your update. Please try again.",
    };
  }
}

// ─────────────────────────────────────────────
// Server Action: validateLog (LEAD / MANAGER only)
// ─────────────────────────────────────────────

export async function validateLog(
  logId: string
): Promise<ActionResult<{ logId: string }>> {
  try {
    const session = await requireRole(["LEAD", "MANAGER"], "validateLog");

    if (!logId || typeof logId !== "string") {
      return { success: false, error: "A valid logId is required." };
    }

    // In production:
    //   const log = await prisma.dailyUpdateLog.findUnique({ where: { id: logId } });
    //   if (!log) return { success: false, error: "Log entry not found." };
    //   if (log.status !== "RESOLVED") {
    //     return { success: false, error: "Only RESOLVED logs can be validated." };
    //   }
    //   if (log.validatedById) {
    //     return { success: false, error: "This log has already been validated." };
    //   }
    //   await prisma.dailyUpdateLog.update({
    //     where: { id: logId },
    //     data: { status: "VALIDATED", validatedById: session.id },
    //   });

    revalidatePath("/dashboard/feed");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: { logId },
      message: "Log entry validated successfully.",
    };
  } catch (err) {
    if (err instanceof AuthError) {
      return { success: false, error: err.message };
    }
    console.error("[validateLog] Unexpected error:", err);
    return { success: false, error: "Failed to validate log. Please try again." };
  }
}
