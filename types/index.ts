// ============================================================
// ShiftBuddy — Shared TypeScript Domain Types
// ============================================================

// ─────────────────────────────────────────────
// ENUMS (mirror Prisma enums for client-side use)
// ─────────────────────────────────────────────

export const UserRole = {
  CONTRACTOR: "CONTRACTOR",
  EMPLOYEE: "EMPLOYEE",
  LEAD: "LEAD",
  MANAGER: "MANAGER",
  GAP_STAKEHOLDER: "GAP_STAKEHOLDER",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const Source = {
  PAGERDUTY: "PAGERDUTY",
  SERVICENOW: "SERVICENOW",
  SLACK: "SLACK",
  TEAMS: "TEAMS",
  VERBAL: "VERBAL",
  OTHER: "OTHER",
} as const;
export type Source = (typeof Source)[keyof typeof Source];

export const Severity = {
  P1_CRITICAL: "P1_CRITICAL",
  P2_HIGH: "P2_HIGH",
  P3_MEDIUM: "P3_MEDIUM",
  P4_LOW: "P4_LOW",
  INFORMATIONAL: "INFORMATIONAL",
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const ShiftPattern = {
  GENERAL: "GENERAL",
  MORNING: "MORNING",
  AFTERNOON: "AFTERNOON",
  NIGHT: "NIGHT",
  WEEKEND: "WEEKEND",
  ON_CALL: "ON_CALL",
} as const;
export type ShiftPattern = (typeof ShiftPattern)[keyof typeof ShiftPattern];

export const ShiftStatus = {
  SCHEDULED: "SCHEDULED",
  ACTIVE: "ACTIVE",
  HANDED_OVER: "HANDED_OVER",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type ShiftStatus = (typeof ShiftStatus)[keyof typeof ShiftStatus];

export const LogStatus = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  VALIDATED: "VALIDATED",
  CLOSED: "CLOSED",
  ESCALATED: "ESCALATED",
} as const;
export type LogStatus = (typeof LogStatus)[keyof typeof LogStatus];

export const SwapStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;
export type SwapStatus = (typeof SwapStatus)[keyof typeof SwapStatus];

export const HandoverStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  DISPUTED: "DISPUTED",
} as const;
export type HandoverStatus = (typeof HandoverStatus)[keyof typeof HandoverStatus];

// ─────────────────────────────────────────────
// DOMAIN TYPES
// ─────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PartnerTeam {
  id: string;
  name: string;
  code: string;
  description: string | null;
  timezone: string;
  isActive: boolean;
  projectId: string;
  project?: Project;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  timezone: string;
  employeeId: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMembership {
  id: string;
  userId: string;
  projectId: string;
  partnerTeamId: string | null;
  roleOverride: UserRole | null;
  joinedAt: Date;
  leftAt: Date | null;
  isActive: boolean;
  user?: User;
  project?: Project;
  partnerTeam?: PartnerTeam;
}

export interface Shift {
  id: string;
  pattern: ShiftPattern;
  status: ShiftStatus;
  startTime: Date;
  endTime: Date;
  timezone: string;
  notes: string | null;
  projectId: string;
  partnerTeamId: string | null;
  assignedToId: string;
  approvedById: string | null;
  project?: Project;
  partnerTeam?: PartnerTeam;
  assignedTo?: User;
  approvedBy?: User | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LogTag {
  id: string;
  label: string;
  color: string;
  logId: string;
}

export interface DailyUpdateLog {
  id: string;
  title: string;
  description: string;
  source: Source;
  severity: Severity;
  status: LogStatus;
  snowTicketId: string | null;
  pagerDutyRef: string | null;
  slackMessageUrl: string | null;
  teamsMessageUrl: string | null;
  isBlockingDependency: boolean;
  blockingReason: string | null;
  occurredAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  loggedAt: Date;
  updatedAt: Date;
  shiftId: string;
  projectId: string;
  partnerTeamId: string | null;
  authorId: string;
  validatedById: string | null;
  shift?: Shift;
  project?: Project;
  partnerTeam?: PartnerTeam;
  author?: User;
  validatedBy?: User | null;
  tags?: LogTag[];
}

export interface ShiftHandover {
  id: string;
  status: HandoverStatus;
  openItemsSummary: string;
  resolvedSummary: string;
  escalationNotes: string | null;
  incomingLeadNotes: string | null;
  disputeReason: string | null;
  compiledAt: Date | null;
  submittedAt: Date | null;
  acknowledgedAt: Date | null;
  dueBy: Date | null;
  projectId: string;
  outgoingShiftId: string;
  incomingShiftId: string;
  outgoingLeadId: string;
  incomingLeadId: string;
  project?: Project;
  outgoingShift?: Shift;
  incomingShift?: Shift;
  outgoingLead?: User;
  incomingLead?: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShiftSwapRequest {
  id: string;
  status: SwapStatus;
  reason: string;
  rejectionNote: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
  shiftId: string;
  projectId: string;
  requesterId: string;
  recipientId: string;
  approvedById: string | null;
  shift?: Shift;
  project?: Project;
  requester?: User;
  recipient?: User;
  approvedBy?: User | null;
}

export interface Notification {
  id: string;
  userId: string;
  channel: "IN_APP" | "EMAIL" | "SLACK" | "TEAMS";
  title: string;
  body: string;
  linkUrl: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

// ─────────────────────────────────────────────
// SESSION / AUTH CONTEXT TYPE
// ─────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  timezone: string;
  avatarUrl: string | null;
  /** Active project context — set after project selection */
  activeProjectId: string | null;
  /** Active partner team context — relevant for Contractor / Employee */
  activePartnerTeamId: string | null;
}

// ─────────────────────────────────────────────
// FORM PAYLOAD TYPES (used by Server Actions)
// ─────────────────────────────────────────────

export interface LogUpdatePayload {
  title: string;
  description: string;
  source: Source;
  severity: Severity;
  shiftId: string;
  projectId: string;
  partnerTeamId?: string;
  occurredAt: string; // ISO-8601
  snowTicketId?: string;
  pagerDutyRef?: string;
  slackMessageUrl?: string;
  teamsMessageUrl?: string;
  isBlockingDependency: boolean;
  blockingReason?: string;
  tags?: string[]; // label strings
}

export interface HandoverPayload {
  projectId: string;
  outgoingShiftId: string;
  incomingShiftId: string;
  incomingLeadId: string;
  openItemsSummary: string;
  resolvedSummary: string;
  escalationNotes?: string;
}

export interface AcknowledgeHandoverPayload {
  handoverId: string;
  incomingLeadNotes?: string;
}

export interface DisputeHandoverPayload {
  handoverId: string;
  disputeReason: string;
}

export interface ShiftSwapPayload {
  shiftId: string;
  projectId: string;
  recipientId: string;
  reason: string;
}

// ─────────────────────────────────────────────
// ANALYTICS / DASHBOARD AGGREGATE TYPES
// ─────────────────────────────────────────────

export interface SourceDistribution {
  source: Source;
  count: number;
  percentage: number;
}

export interface SeverityDistribution {
  severity: Severity;
  count: number;
  percentage: number;
}

export interface ProjectHealthSummary {
  projectId: string;
  projectName: string;
  projectCode: string;
  totalLogs: number;
  openLogs: number;
  escalatedLogs: number;
  p1Count: number;
  slaBreachCount: number;
  lastActivityAt: Date | null;
  sourceDistribution: SourceDistribution[];
}

export interface OperationalMetrics {
  totalContractors: number;
  activeShiftsNow: number;
  logsLast24h: number;
  openHandovers: number;
  pendingSwapRequests: number;
  unacknowledgedHandovers: number;
}

// ─────────────────────────────────────────────
// MEMBER SUBMISSION (handover pre-submission by team members)
// ─────────────────────────────────────────────

export interface MemberSubmission {
  id: string;
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  shift: string;
  openItems: string;
  resolvedItems: string;
  notes: string;
  submittedAt: string; // ISO
}

// ─────────────────────────────────────────────
// SERVER ACTION RESULT WRAPPER
// ─────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// ─────────────────────────────────────────────
// UI CONFIGURATION MAPS
// ─────────────────────────────────────────────

export interface SourceConfig {
  label: string;
  badgeClass: string;       // Tailwind classes for the badge background/text
  iconName: string;         // Lucide icon name
  borderClass: string;      // Left-border color class for cards
  dotClass: string;         // Dot indicator class
}

export interface SeverityConfig {
  label: string;
  badgeClass: string;
  iconName: string;
  sortOrder: number;        // Lower = more urgent
}

export interface RoleConfig {
  label: string;
  description: string;
  badgeClass: string;
  canLogUpdates: boolean;
  canApproveSwaps: boolean;
  canInitiateHandover: boolean;
  canAcknowledgeHandover: boolean;
  canManageRoster: boolean;
  canViewAnalytics: boolean;
  canExportReports: boolean;
  canManageUsers: boolean;
}

// ─────────────────────────────────────────────
// DAILY DIARY TYPES
// ─────────────────────────────────────────────

export const DiaryStatus = {
  DRAFT:     "DRAFT",
  SUBMITTED: "SUBMITTED",
  REVIEWED:  "REVIEWED",
} as const;
export type DiaryStatus = (typeof DiaryStatus)[keyof typeof DiaryStatus];

export type DiaryKtItemType   = "SESSION" | "DOCUMENT" | "DEMO" | "REVIEW";
export type DiaryKtloCategory = "MONITORING" | "DEPLOYMENT" | "PATCH" | "MAINTENANCE" | "ALERT";
export type DiaryTaskPriority = "LOW" | "MEDIUM" | "HIGH";

/** One incident referenced inside a diary */
export interface DiaryIncident {
  id:          string;
  title:       string;
  source:      Source;
  severity:    Severity;
  externalRef: string | null;
  wasResolved: boolean;
  notes:       string | null;
  diaryId:     string;
}

/** One KT session/activity referenced in a diary */
export interface DiaryKtItem {
  id:           string;
  topic:        string;
  type:         DiaryKtItemType;
  durationMins: number;
  notes:        string | null;
  diaryId:      string;
}

/** One KTLO task resolved during the shift */
export interface DiaryKtloItem {
  id:          string;
  title:       string;
  category:    DiaryKtloCategory;
  externalRef: string | null;
  notes:       string | null;
  diaryId:     string;
}

/** One new task picked up during the shift */
export interface DiaryTask {
  id:      string;
  title:   string;
  priority: DiaryTaskPriority;
  dueDate: Date | null;
  notes:   string | null;
  diaryId: string;
}

/** The master diary record — one per team member per shift-day */
export interface DailyDiary {
  id:                string;
  diaryDate:         Date;       // Stored as date only
  shiftPattern:      ShiftPattern;
  status:            DiaryStatus;

  // Incidents
  incidentCount:     number;
  incidentNotes:     string | null;

  // KT
  ktSessionsCount:   number;
  ktProgressPercent: number;     // 0–100
  ktNotes:           string | null;

  // KTLO
  ktloResolvedCount: number;
  ktloNotes:         string | null;

  // New Tasks
  newTaskCount:      number;
  newTaskNotes:      string | null;

  // Blockers
  hasBlockers:       boolean;
  blockerDetails:    string | null;

  // General
  generalNotes:      string | null;

  // Review
  reviewedAt:        Date | null;
  reviewNotes:       string | null;

  submittedAt:       Date | null;
  createdAt:         Date;
  updatedAt:         Date;

  // FK
  authorId:   string;
  projectId:  string;
  shiftId:    string | null;

  // Optional hydrated relations
  author?:    User;
  project?:   { id: string; name: string; code?: string };
  incidents?: DiaryIncident[];
  ktItems?:   DiaryKtItem[];
  ktloItems?: DiaryKtloItem[];
  tasks?:     DiaryTask[];
}

// ── Form payloads ──────────────────────────────

export interface DiaryIncidentInput {
  title:       string;
  source:      Source;
  severity:    Severity;
  externalRef: string;
  wasResolved: boolean;
  notes:       string;
}

export interface DiaryKtItemInput {
  topic:        string;
  type:         DiaryKtItemType;
  durationMins: number;
  notes:        string;
}

export interface DiaryKtloItemInput {
  title:       string;
  category:    DiaryKtloCategory;
  externalRef: string;
  notes:       string;
}

export interface DiaryTaskInput {
  title:    string;
  priority: DiaryTaskPriority;
  dueDate:  string;   // ISO date string
  notes:    string;
}

export interface DiaryEntryPayload {
  projectId:         string;
  diaryDate:         string;     // ISO-8601 date string
  shiftPattern:      ShiftPattern;
  shiftId?:          string;

  incidentCount:     number;
  incidentNotes:     string;
  incidents:         DiaryIncidentInput[];

  ktSessionsCount:   number;
  ktProgressPercent: number;
  ktNotes:           string;
  ktItems:           DiaryKtItemInput[];

  ktloResolvedCount: number;
  ktloNotes:         string;
  ktloItems:         DiaryKtloItemInput[];

  newTaskCount:      number;
  newTaskNotes:      string;
  tasks:             DiaryTaskInput[];

  hasBlockers:       boolean;
  blockerDetails:    string;

  generalNotes:      string;
}

// ── Report aggregate types ─────────────────────

/** Per-person summary for a report period */
export interface DiaryPersonSummary {
  userId:            string;
  userName:          string;
  projectId:         string;
  projectName:       string;
  shiftPattern:      ShiftPattern;
  totalDiaryDays:    number;    // Days they submitted a diary
  submittedDays:     number;    // Days with SUBMITTED or REVIEWED status
  totalIncidents:    number;
  resolvedIncidents: number;
  totalKtSessions:   number;
  avgKtProgress:     number;    // Average KT % across the period
  totalKtloResolved: number;
  totalNewTasks:     number;
  daysWithBlockers:  number;
}

/** Project-level roll-up for a report period */
export interface DiaryProjectSummary {
  projectId:         string;
  projectName:       string;
  memberCount:       number;
  diarySubmitRate:   number;    // % of expected diaries that were submitted
  totalIncidents:    number;
  resolvedIncidents: number;
  avgKtProgress:     number;
  totalKtloResolved: number;
  totalNewTasks:     number;
  members:           DiaryPersonSummary[];
}

export type DiaryReportPeriod = "DAILY" | "WEEKLY" | "MONTHLY";

export interface DiaryReport {
  period:       DiaryReportPeriod;
  fromDate:     Date;
  toDate:       Date;
  generatedAt:  Date;
  projectStats: DiaryProjectSummary[];
  totalDiaries: number;
  submitRate:   number;   // overall %
}
