"use server";

// ============================================================
// Server Actions — Daily Diary
// ─────────────────────────────────────────────────────────────
// saveDiaryEntry    — Create/update (CONTRACTOR / EMPLOYEE / LEAD / MANAGER)
// submitDiaryEntry  — Mark SUBMITTED (same roles above)
// reviewDiaryEntry  — Add review note (LEAD / MANAGER only)
// getDiaryReport    — Build period aggregate (LEAD / MANAGER / GAP_STAKEHOLDER)
// exportDiaryReport — Export as Markdown string (same as above)
// GAP_STAKEHOLDER cannot write any diary entry.
// ============================================================

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole, AuthError } from "@/lib/auth";
import type { ActionResult, DiaryReport, DiaryReportPeriod, DailyDiary } from "@/types";

// ─────────────────────────────────────────────
// ZOD SCHEMAS
// ─────────────────────────────────────────────

const DiaryIncidentSchema = z.object({
  title:       z.string().min(3).max(300).trim(),
  source:      z.enum(["PAGERDUTY", "SERVICENOW", "SLACK", "TEAMS", "VERBAL", "OTHER"]),
  severity:    z.enum(["P1_CRITICAL", "P2_HIGH", "P3_MEDIUM", "P4_LOW", "INFORMATIONAL"]),
  externalRef: z.string().max(255).trim().optional().default(""),
  wasResolved: z.boolean().default(false),
  notes:       z.string().max(1000).trim().optional().default(""),
});

const DiaryKtItemSchema = z.object({
  topic:        z.string().min(3).max(300).trim(),
  type:         z.enum(["SESSION", "DOCUMENT", "DEMO", "REVIEW"]).default("SESSION"),
  durationMins: z.number().int().min(0).max(600),
  notes:        z.string().max(500).trim().optional().default(""),
});

const DiaryKtloItemSchema = z.object({
  title:       z.string().min(3).max(300).trim(),
  category:    z.enum(["MONITORING", "DEPLOYMENT", "PATCH", "MAINTENANCE", "ALERT"]).default("MAINTENANCE"),
  externalRef: z.string().max(255).trim().optional().default(""),
  notes:       z.string().max(500).trim().optional().default(""),
});

const DiaryTaskSchema = z.object({
  title:    z.string().min(3).max(300).trim(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  dueDate:  z.string().optional().default(""),
  notes:    z.string().max(500).trim().optional().default(""),
});

const DiaryEntrySchema = z
  .object({
    projectId:         z.string().cuid("projectId must be a valid CUID."),
    diaryDate:         z
      .string()
      .date("diaryDate must be a valid ISO date (YYYY-MM-DD).")
      .refine((d) => new Date(d) <= new Date(), {
        message: "Diary date cannot be in the future.",
      }),
    shiftPattern:      z.enum([
      "GENERAL", "MORNING", "AFTERNOON", "NIGHT", "WEEKEND", "ON_CALL",
    ]),
    shiftId:           z.string().cuid().optional(),

    // Incidents
    incidentCount:     z.number().int().min(0).max(100).default(0),
    incidentNotes:     z.string().max(2000).trim().default(""),
    incidents:         z.array(DiaryIncidentSchema).max(50).default([]),

    // KT
    ktSessionsCount:   z.number().int().min(0).max(20).default(0),
    ktProgressPercent: z.number().int().min(0).max(100).default(0),
    ktNotes:           z.string().max(2000).trim().default(""),
    ktItems:           z.array(DiaryKtItemSchema).max(20).default([]),

    // KTLO
    ktloResolvedCount: z.number().int().min(0).max(200).default(0),
    ktloNotes:         z.string().max(2000).trim().default(""),
    ktloItems:         z.array(DiaryKtloItemSchema).max(50).default([]),

    // New Tasks
    newTaskCount:      z.number().int().min(0).max(50).default(0),
    newTaskNotes:      z.string().max(2000).trim().default(""),
    tasks:             z.array(DiaryTaskSchema).max(50).default([]),

    // Blockers
    hasBlockers:       z.boolean().default(false),
    blockerDetails:    z.string().max(1000).trim().default(""),

    // General
    generalNotes:      z.string().max(3000).trim().default(""),
  })
  .superRefine((data, ctx) => {
    // Blocker requires details
    if (data.hasBlockers && !data.blockerDetails.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["blockerDetails"],
        message: "Please describe the blocker so the incoming shift can act on it.",
      });
    }

    // incident count should align with number of listed items
    if (data.incidents.length > 0 && data.incidentCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["incidentCount"],
        message: "Incident count should be at least 1 when incidents are listed.",
      });
    }

    // KT items require at least one note or topic
    for (const item of data.ktItems) {
      if (!item.topic.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ktItems"],
          message: "Each KT item must have a topic.",
        });
        break;
      }
    }
  });

const ReviewSchema = z.object({
  diaryId:     z.string().min(1, "diaryId is required."),
  reviewNotes: z.string().max(1000).trim().optional().default(""),
});

// ─────────────────────────────────────────────
// ACTION: saveDiaryEntry (create or upsert as DRAFT)
// ─────────────────────────────────────────────

export async function saveDiaryEntry(
  rawInput: z.input<typeof DiaryEntrySchema>
): Promise<ActionResult<{ diaryId: string }>> {
  try {
    const session = await requireRole(
      ["CONTRACTOR", "EMPLOYEE", "LEAD", "MANAGER"],
      "saveDiaryEntry"
    );

    const parsed = DiaryEntrySchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed. Please check the highlighted fields.",
        fieldErrors: Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v ?? []])
        ),
      };
    }

    const data = parsed.data;

    // Scope guard: CONTRACTOR / EMPLOYEE can only write diary for their own project
    if (
      (session.role === "CONTRACTOR" || session.role === "EMPLOYEE") &&
      session.activeProjectId !== null &&
      data.projectId !== session.activeProjectId
    ) {
      return {
        success: false,
        error: "You can only write diary entries for your active project.",
      };
    }

    // In production — upsert via Prisma:
    //
    // const diary = await prisma.dailyDiary.upsert({
    //   where: {
    //     authorId_diaryDate_shiftPattern: {
    //       authorId: session.id,
    //       diaryDate: new Date(data.diaryDate),
    //       shiftPattern: data.shiftPattern,
    //     },
    //   },
    //   update: {
    //     incidentCount:     data.incidentCount,
    //     incidentNotes:     data.incidentNotes || null,
    //     ktSessionsCount:   data.ktSessionsCount,
    //     ktProgressPercent: data.ktProgressPercent,
    //     ktNotes:           data.ktNotes || null,
    //     ktloResolvedCount: data.ktloResolvedCount,
    //     ktloNotes:         data.ktloNotes || null,
    //     newTaskCount:      data.newTaskCount,
    //     newTaskNotes:      data.newTaskNotes || null,
    //     hasBlockers:       data.hasBlockers,
    //     blockerDetails:    data.blockerDetails || null,
    //     generalNotes:      data.generalNotes || null,
    //     // Delete and re-create child rows on each save
    //     incidents:  { deleteMany: {}, create: data.incidents },
    //     ktItems:    { deleteMany: {}, create: data.ktItems },
    //     ktloItems:  { deleteMany: {}, create: data.ktloItems },
    //     tasks:      { deleteMany: {}, create: data.tasks.map(t => ({
    //       ...t, dueDate: t.dueDate ? new Date(t.dueDate) : null,
    //     })) },
    //   },
    //   create: {
    //     authorId:    session.id,
    //     projectId:   data.projectId,
    //     shiftId:     data.shiftId ?? null,
    //     diaryDate:   new Date(data.diaryDate),
    //     shiftPattern: data.shiftPattern,
    //     status:      "DRAFT",
    //     incidentCount: data.incidentCount,
    //     ...etc
    //   },
    //   select: { id: true },
    // });

    const diary = { id: `diary_${session.id}_${Date.now()}` };

    revalidatePath("/dashboard/diary");

    return {
      success: true,
      data: { diaryId: diary.id },
      message: "Diary entry saved as draft.",
    };
  } catch (err) {
    if (err instanceof AuthError) return { success: false, error: err.message };
    console.error("[saveDiaryEntry]:", err);
    return { success: false, error: "Failed to save diary entry. Please try again." };
  }
}

// ─────────────────────────────────────────────
// ACTION: submitDiaryEntry
// Marks the entry SUBMITTED — visible to lead & manager.
// Cannot submit a REVIEWED entry (must save a new one).
// ─────────────────────────────────────────────

export async function submitDiaryEntry(
  diaryId: string
): Promise<ActionResult<{ diaryId: string }>> {
  try {
    const session = await requireRole(
      ["CONTRACTOR", "EMPLOYEE", "LEAD", "MANAGER"],
      "submitDiaryEntry"
    );

    if (!diaryId?.trim()) {
      return { success: false, error: "diaryId is required." };
    }

    // In production:
    //   const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } });
    //   if (!diary) return { success: false, error: "Diary entry not found." };
    //   if (diary.authorId !== session.id && session.role !== "MANAGER") {
    //     return { success: false, error: "You can only submit your own diary entries." };
    //   }
    //   if (diary.status === "REVIEWED") {
    //     return { success: false, error: "A reviewed diary entry cannot be re-submitted. Create a new entry." };
    //   }
    //   await prisma.dailyDiary.update({
    //     where: { id: diaryId },
    //     data:  { status: "SUBMITTED", submittedAt: new Date() },
    //   });
    //
    //   // Notify shift lead
    //   await prisma.notification.create({
    //     data: {
    //       userId:  session.activeProjectId ? ... /* find lead */ : session.id,
    //       title:  `Daily Diary Submitted — ${session.name}`,
    //       body:   `${session.name} submitted their end-of-shift diary. Review it in the Daily Diary section.`,
    //       linkUrl: `/dashboard/diary?date=${diary.diaryDate.toISOString().slice(0,10)}`,
    //     },
    //   });

    revalidatePath("/dashboard/diary");

    return {
      success: true,
      data: { diaryId },
      message: "Diary entry submitted successfully. Your shift lead has been notified.",
    };
  } catch (err) {
    if (err instanceof AuthError) return { success: false, error: err.message };
    console.error("[submitDiaryEntry]:", err);
    return { success: false, error: "Failed to submit diary entry." };
  }
}

// ─────────────────────────────────────────────
// ACTION: reviewDiaryEntry (LEAD / MANAGER only)
// ─────────────────────────────────────────────

export async function reviewDiaryEntry(
  rawInput: z.input<typeof ReviewSchema>
): Promise<ActionResult<{ diaryId: string }>> {
  try {
    await requireRole(["LEAD", "MANAGER"], "reviewDiaryEntry");

    const parsed = ReviewSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: "Validation failed." };
    }

    const data = parsed.data;

    // In production:
    //   await prisma.dailyDiary.update({
    //     where: { id: data.diaryId },
    //     data:  { status: "REVIEWED", reviewedAt: new Date(), reviewNotes: data.reviewNotes || null },
    //   });

    revalidatePath("/dashboard/diary");

    return {
      success: true,
      data: { diaryId: data.diaryId },
      message: "Diary entry marked as reviewed.",
    };
  } catch (err) {
    if (err instanceof AuthError) return { success: false, error: err.message };
    console.error("[reviewDiaryEntry]:", err);
    return { success: false, error: "Failed to mark diary as reviewed." };
  }
}

// ─────────────────────────────────────────────
// ACTION: getDiaryReport
// Aggregates diary entries for a period and project.
// Available to LEAD / MANAGER / GAP_STAKEHOLDER (read-only).
// ─────────────────────────────────────────────

export async function getDiaryReport(params: {
  projectId?: string;
  period: DiaryReportPeriod;
  referenceDate?: string; // ISO date — defaults to today
}): Promise<ActionResult<DiaryReport>> {
  try {
    await requireRole(
      ["LEAD", "MANAGER", "GAP_STAKEHOLDER"],
      "getDiaryReport"
    );

    const refDate = params.referenceDate
      ? new Date(params.referenceDate)
      : new Date();

    // Calculate date range
    let fromDate: Date;
    let toDate: Date = new Date(refDate);
    toDate.setHours(23, 59, 59, 999);

    switch (params.period) {
      case "DAILY":
        fromDate = new Date(refDate);
        fromDate.setHours(0, 0, 0, 0);
        break;
      case "WEEKLY": {
        fromDate = new Date(refDate);
        const dow = fromDate.getDay() || 7;
        fromDate.setDate(fromDate.getDate() - (dow - 1)); // Monday
        fromDate.setHours(0, 0, 0, 0);
        break;
      }
      case "MONTHLY":
        fromDate = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
        break;
      default:
        fromDate = new Date(refDate);
        fromDate.setHours(0, 0, 0, 0);
    }

    // In production — fetch from DB:
    //   const diaries = await prisma.dailyDiary.findMany({
    //     where: {
    //       diaryDate: { gte: fromDate, lte: toDate },
    //       ...(params.projectId ? { projectId: params.projectId } : {}),
    //       status: { in: ["SUBMITTED", "REVIEWED"] },
    //     },
    //     include: { author: true, project: true, incidents: true, ktItems: true, ktloItems: true, tasks: true },
    //   });
    //
    //   return buildReport(diaries, fromDate, toDate, params.period);

    // POC: import mock data and aggregate
    const { MOCK_DIARY_ENTRIES, MOCK_PROJECTS, MOCK_USERS } = await import("@/lib/mock-data");

    const filteredDiaries = MOCK_DIARY_ENTRIES.filter((d) => {
      const inRange = d.diaryDate >= fromDate && d.diaryDate <= toDate;
      const matchProject = !params.projectId || d.projectId === params.projectId;
      const submitted = d.status === "SUBMITTED" || d.status === "REVIEWED";
      return inRange && matchProject && submitted;
    });

    const report = buildReport(filteredDiaries, fromDate, toDate, params.period, MOCK_USERS, [...MOCK_PROJECTS]);

    return { success: true, data: report };
  } catch (err) {
    if (err instanceof AuthError) return { success: false, error: err.message };
    console.error("[getDiaryReport]:", err);
    return { success: false, error: "Failed to generate report." };
  }
}

// ─────────────────────────────────────────────
// REPORT BUILDER (pure function — reusable server-side)
// ─────────────────────────────────────────────

function buildReport(
  diaries: DailyDiary[],
  fromDate: Date,
  toDate: Date,
  period: DiaryReportPeriod,
  allUsers: { id: string; name: string }[],
  allProjects: { id: string; name: string }[]
): DiaryReport {
  // Group by project
  const projectMap = new Map<string, DailyDiary[]>();
  for (const d of diaries) {
    const list = projectMap.get(d.projectId) ?? [];
    list.push(d);
    projectMap.set(d.projectId, list);
  }

  const projectStats = Array.from(projectMap.entries()).map(([projectId, projDiaries]) => {
    const project = allProjects.find((p) => p.id === projectId);

    // Group by author within project
    const authorMap = new Map<string, DailyDiary[]>();
    for (const d of projDiaries) {
      const list = authorMap.get(d.authorId) ?? [];
      list.push(d);
      authorMap.set(d.authorId, list);
    }

    const members = Array.from(authorMap.entries()).map(([userId, userDiaries]) => {
      const user = allUsers.find((u) => u.id === userId);
      const allIncidents = userDiaries.flatMap((d) => d.incidents ?? []);
      const avgKt =
        userDiaries.length > 0
          ? Math.round(
              userDiaries.reduce((s, d) => s + d.ktProgressPercent, 0) /
                userDiaries.length
            )
          : 0;

      return {
        userId,
        userName:          user?.name ?? "Unknown",
        projectId,
        projectName:       project?.name ?? projectId,
        shiftPattern:      userDiaries[0]?.shiftPattern ?? "GENERAL",
        totalDiaryDays:    userDiaries.length,
        submittedDays:     userDiaries.filter((d) => d.status !== "DRAFT").length,
        totalIncidents:    userDiaries.reduce((s, d) => s + d.incidentCount, 0),
        resolvedIncidents: allIncidents.filter((i) => i.wasResolved).length,
        totalKtSessions:   userDiaries.reduce((s, d) => s + d.ktSessionsCount, 0),
        avgKtProgress:     avgKt,
        totalKtloResolved: userDiaries.reduce((s, d) => s + d.ktloResolvedCount, 0),
        totalNewTasks:     userDiaries.reduce((s, d) => s + d.newTaskCount, 0),
        daysWithBlockers:  userDiaries.filter((d) => d.hasBlockers).length,
      };
    });

    const totalExpectedDiaries = members.reduce((s, m) => s + m.totalDiaryDays, 0);
    const totalSubmitted = members.reduce((s, m) => s + m.submittedDays, 0);

    return {
      projectId,
      projectName:       project?.name ?? projectId,
      memberCount:       members.length,
      diarySubmitRate:   totalExpectedDiaries > 0
        ? Math.round((totalSubmitted / totalExpectedDiaries) * 100)
        : 0,
      totalIncidents:    members.reduce((s, m) => s + m.totalIncidents, 0),
      resolvedIncidents: members.reduce((s, m) => s + m.resolvedIncidents, 0),
      avgKtProgress:     members.length > 0
        ? Math.round(members.reduce((s, m) => s + m.avgKtProgress, 0) / members.length)
        : 0,
      totalKtloResolved: members.reduce((s, m) => s + m.totalKtloResolved, 0),
      totalNewTasks:     members.reduce((s, m) => s + m.totalNewTasks, 0),
      members,
    };
  });

  const totalDiaries = diaries.length;
  const totalSubmitted = diaries.filter((d) => d.status !== "DRAFT").length;

  return {
    period,
    fromDate,
    toDate,
    generatedAt:  new Date(),
    projectStats,
    totalDiaries,
    submitRate:   totalDiaries > 0
      ? Math.round((totalSubmitted / totalDiaries) * 100)
      : 0,
  };
}

// ─────────────────────────────────────────────
// ACTION: exportDiaryReport (returns Markdown string)
// ─────────────────────────────────────────────

export async function exportDiaryReport(params: {
  projectId?: string;
  period: DiaryReportPeriod;
  referenceDate?: string;
}): Promise<ActionResult<{ markdown: string; filename: string }>> {
  try {
    await requireRole(
      ["LEAD", "MANAGER", "GAP_STAKEHOLDER"],
      "exportDiaryReport"
    );

    const reportResult = await getDiaryReport(params);
    if (!reportResult.success) {
      return { success: false, error: reportResult.error };
    }

    const report = reportResult.data;
    const md = buildMarkdownReport(report);
    const dateStr = report.fromDate.toISOString().slice(0, 10);
    const filename = `shiftbuddy-diary-report-${params.period.toLowerCase()}-${dateStr}.md`;

    return { success: true, data: { markdown: md, filename } };
  } catch (err) {
    if (err instanceof AuthError) return { success: false, error: err.message };
    return { success: false, error: "Failed to export report." };
  }
}

function buildMarkdownReport(report: DiaryReport): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  const PERIOD_LABELS: Record<DiaryReportPeriod, string> = {
    DAILY:   "Daily",
    WEEKLY:  "Weekly",
    MONTHLY: "Monthly",
  };

  const lines: string[] = [
    `# ShiftBuddy — ${PERIOD_LABELS[report.period]} Diary Report`,
    ``,
    `**Period:** ${fmt(report.fromDate)} – ${fmt(report.toDate)}  `,
    `**Generated:** ${fmt(report.generatedAt)} at ${report.generatedAt.toLocaleTimeString()}  `,
    `**Total diary submissions:** ${report.totalDiaries}  `,
    `**Overall submit rate:** ${report.submitRate}%`,
    ``,
    `---`,
    ``,
  ];

  for (const proj of report.projectStats) {
    lines.push(`## ${proj.projectName}`);
    lines.push(``);
    lines.push(`| Metric | Value |`);
    lines.push(`|---|---|`);
    lines.push(`| Members reporting | ${proj.memberCount} |`);
    lines.push(`| Diary submit rate | ${proj.diarySubmitRate}% |`);
    lines.push(`| Total incidents handled | ${proj.totalIncidents} |`);
    lines.push(`| Incidents resolved | ${proj.resolvedIncidents} |`);
    lines.push(`| Total KT sessions | ${proj.members.reduce((s, m) => s + m.totalKtSessions, 0)} |`);
    lines.push(`| Avg KT progress | ${proj.avgKtProgress}% |`);
    lines.push(`| KTLO tasks resolved | ${proj.totalKtloResolved} |`);
    lines.push(`| New tasks created | ${proj.totalNewTasks} |`);
    lines.push(``);

    lines.push(`### Team Member Breakdown`);
    lines.push(``);
    lines.push(`| Name | Shift | Diary Days | Incidents | KT % | KTLOs | New Tasks | Blockers |`);
    lines.push(`|---|---|---|---|---|---|---|---|`);
    for (const m of proj.members) {
      const shift = m.shiftPattern.charAt(0) + m.shiftPattern.slice(1).toLowerCase();
      lines.push(
        `| ${m.userName} | ${shift} | ${m.submittedDays}/${m.totalDiaryDays} | ` +
        `${m.totalIncidents} (${m.resolvedIncidents} resolved) | ${m.avgKtProgress}% | ` +
        `${m.totalKtloResolved} | ${m.totalNewTasks} | ${m.daysWithBlockers > 0 ? `⚠️ ${m.daysWithBlockers}d` : "—"} |`
      );
    }
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(`*Generated by ShiftBuddy — Corp / YCI Support Operations Platform*`);

  return lines.join("\n");
}
