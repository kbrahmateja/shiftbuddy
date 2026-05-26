import type {
  DailyUpdateLog, Shift, User, ShiftHandover, ShiftSwapRequest, ShiftPattern,
  DailyDiary, DiaryIncident, DiaryKtItem, DiaryKtloItem, DiaryTask, DiaryStatus,
} from "@/types";

// ─── Projects ─────────────────────────────────────────────
export const MOCK_PROJECTS = [
  { id: "proj_checkout",     name: "Checkout + Bag + Composite",          description: "Cart, bag, payment & order fulfilment" },
  { id: "proj_payment_core", name: "OnlinePayment + Core + CustomerProfile", description: "Payments, platform core & customer identity" },
  { id: "proj_browse",       name: "Browse + Profile",                    description: "Product discovery, search & customer profile" },
  { id: "proj_buyui",        name: "Buy UI + Ecom FUI",                   description: "Frontend buy flow & e-commerce UI" },
  { id: "proj_webapp",       name: "PT-WebApp",                           description: "Web application platform & delivery" },
  { id: "proj_dam",          name: "DAM",                                 description: "Digital Asset Management" },
  { id: "proj_marketing",    name: "PT-Marketing",                        description: "Campaign, promotions & email platform" },
] as const;

export type ProjectId = typeof MOCK_PROJECTS[number]["id"];

// ─── Shift timing helpers ─────────────────────────────────
// All times IST (UTC+5:30). startTime/endTime stored as local Date objects.
type WeekOff = "Sun-Mon" | "Fri-Sat" | "Sat-Sun";
type ShiftCode = "Shift1" | "Shift2" | "Shift3" | "General" | "TBD";

const SHIFT_HOURS: Record<ShiftCode, [number, number, number, number]> = {
  Shift1:  [5,  30, 14, 30], // 05:30 – 14:30 IST
  Shift2:  [13, 30, 22, 30], // 13:30 – 22:30 IST
  Shift3:  [21, 30, 6,  30], // 21:30 – 06:30 IST (crosses midnight)
  General: [9,  0,  17, 0 ],
  TBD:     [9,  0,  17, 0 ],
};

const SHIFT_PATTERN: Record<ShiftCode, ShiftPattern> = {
  Shift1:  "MORNING",
  Shift2:  "AFTERNOON",
  Shift3:  "NIGHT",
  General: "GENERAL",
  TBD:     "GENERAL",
};

// Working day indices (0=Sun...6=Sat) for each week-off pattern
const WORK_DAYS: Record<WeekOff, number[]> = {
  "Sun-Mon": [2, 3, 4, 5, 6],  // Tue-Sat
  "Fri-Sat": [0, 1, 2, 3, 4],  // Sun-Thu
  "Sat-Sun": [1, 2, 3, 4, 5],  // Mon-Fri
};

function getWeekStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // Sunday of current week
  d.setHours(0, 0, 0, 0);
  return d;
}

function shiftDates(weekOffset: number, shiftCode: ShiftCode) {
  const [sh, sm, eh, em] = SHIFT_HOURS[shiftCode];
  const weekStart = getWeekStart();
  const start = new Date(weekStart);
  start.setDate(start.getDate() + weekOffset);
  start.setHours(sh, sm, 0, 0);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + weekOffset + (sh > eh ? 1 : 0)); // crosses midnight
  end.setHours(eh, em, 0, 0);
  return { start, end };
}

function isToday(d: Date): boolean {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth();
}

function generateShifts(
  userId: string,
  user: User,
  projectId: string,
  shiftCode: ShiftCode,
  weekOff: WeekOff,
  approvedById: string | null,
  idPrefix: string,
): (Shift & { assignedTo: User })[] {
  if (shiftCode === "TBD") return [];
  const workDays = WORK_DAYS[weekOff];
  return workDays.map((dayIdx) => {
    const { start, end } = shiftDates(dayIdx, shiftCode);
    const now = new Date();
    const active = isToday(start) && now >= start && now <= end;
    const past = end < now && !active;
    const status = active ? "ACTIVE" : past ? "COMPLETED" : "SCHEDULED";
    return {
      id: `${idPrefix}_d${dayIdx}`,
      pattern: SHIFT_PATTERN[shiftCode],
      status,
      startTime: start,
      endTime: end,
      timezone: "Asia/Kolkata",
      notes: null,
      projectId,
      partnerTeamId: null,
      assignedToId: userId,
      approvedById,
      assignedTo: user,
      createdAt: new Date("2024-05-01"),
      updatedAt: new Date(),
    };
  });
}

// ─── Core team users (demo accounts) ─────────────────────
const LEAD_USER: User = {
  id: "user_lead_001", email: "arjun.sharma@hcl.com", name: "Arjun Sharma",
  displayName: "Arjun S.", avatarUrl: null, role: "LEAD", timezone: "Asia/Kolkata",
  employeeId: "HCL-1001", isActive: true,
  lastLoginAt: new Date(Date.now() - 30 * 60 * 1000),
  createdAt: new Date("2024-01-10"), updatedAt: new Date(),
};

// ─── Employee registry ────────────────────────────────────
// Format: [id, name, email, projectId, shiftCode, weekOff]
type EmpDef = [string, string, string, string, ShiftCode, WeekOff];

const EMPLOYEE_DEFS: EmpDef[] = [
  // Checkout + Bag + Composite
  ["u_ck_01", "Sonam Bhardwaj",     "sonam.bhardwaj@hcl.com",     "proj_checkout",     "Shift1",  "Sun-Mon"],
  ["u_ck_02", "Meenu Singh",        "meenu.singh@hcl.com",        "proj_checkout",     "Shift1",  "Fri-Sat"],
  ["u_ck_03", "Rajeev Kumar",       "rajeev.kumar@hcl.com",       "proj_checkout",     "Shift2",  "Sun-Mon"],
  ["u_ck_04", "Abhinandan Patil",   "abhinandan.patil@hcl.com",   "proj_checkout",     "Shift2",  "Fri-Sat"],
  ["u_ck_05", "MadhaviLatha",       "madhavi.latha@hcl.com",      "proj_checkout",     "Shift3",  "Sun-Mon"],
  ["u_ck_06", "Shivam Rathor",      "shivam.rathor@hcl.com",      "proj_checkout",     "Shift3",  "Fri-Sat"],
  ["u_ck_07", "Dundi Kari",         "dundi.kari@hcl.com",         "proj_checkout",     "TBD",     "Sun-Mon"],

  // OnlinePayment + Core + CustomerProfile
  ["u_pc_01", "Ankit Singh",        "ankit.singh@hcl.com",        "proj_payment_core", "Shift1",  "Fri-Sat"],
  ["u_pc_02", "Rajbir Syal",        "rajbir.syal@hcl.com",        "proj_payment_core", "Shift1",  "Sun-Mon"],
  ["u_pc_03", "Samadhan Jadhav",    "samadhan.jadhav@hcl.com",    "proj_payment_core", "Shift2",  "Fri-Sat"],
  ["u_pc_04", "Ankit Bisht",        "ankit.bisht@hcl.com",        "proj_payment_core", "Shift2",  "Sun-Mon"],
  ["u_pc_05", "Naveen Babu Kodiaganti", "naveen.kodiaganti@hcl.com", "proj_payment_core", "Shift3", "Fri-Sat"],
  ["u_pc_06", "Karthikay Gupta",    "karthikay.gupta@hcl.com",    "proj_payment_core", "Shift3",  "Sun-Mon"],

  // Browse + Profile
  ["u_bp_01", "Rahul Anand",        "rahul.anand@hcl.com",        "proj_browse",       "Shift1",  "Fri-Sat"],
  ["u_bp_02", "Sandeep Kumar Sharma","sandeep.sharma@hcl.com",     "proj_browse",       "Shift1",  "Sun-Mon"],
  ["u_bp_03", "Amit Sharma",        "amit.sharma@hcl.com",        "proj_browse",       "Shift2",  "Fri-Sat"],
  ["u_bp_04", "Debashish Ray",      "debashish.ray@hcl.com",      "proj_browse",       "Shift2",  "Sun-Mon"],
  ["u_bp_05", "P C Vijay Kiran",    "vijay.kiran@hcl.com",        "proj_browse",       "Shift2",  "Fri-Sat"],
  ["u_bp_06", "Prateek Agarwal",    "prateek.agarwal@hcl.com",    "proj_browse",       "Shift2",  "Sun-Mon"],
  ["u_bp_07", "Dipak Rahangadale",  "dipak.rahangadale@hcl.com",  "proj_browse",       "Shift3",  "Fri-Sat"],
  ["u_bp_08", "Brahmateja Kanchibhotla", "brahmateja.k@hcl.com",  "proj_browse",       "Shift3",  "Sun-Mon"],
  ["u_bp_09", "Chaitanya Lakshmikumar Addepalli", "chaitanya.addepalli@hcl.com", "proj_browse", "Shift3", "Fri-Sat"],
  ["u_bp_10", "Karthik Sharma",     "karthik.sharma@hcl.com",     "proj_browse",       "Shift1",  "Sun-Mon"],

  // Buy UI + Ecom FUI
  ["u_bu_01", "Aradhana Vishwakarma", "aradhana.vishwakarma@hcl.com", "proj_buyui",    "Shift1",  "Fri-Sat"],
  ["u_bu_02", "Prathala Tirishmaradha", "prathala.t@hcl.com",       "proj_buyui",     "Shift1",  "Sun-Mon"],
  ["u_bu_03", "Dinesh Aragonda",    "dinesh.aragonda@hcl.com",    "proj_buyui",        "Shift1",  "Fri-Sat"],
  ["u_bu_04", "Priyanka P",         "priyanka.p@hcl.com",         "proj_buyui",        "Shift2",  "Sun-Mon"],
  ["u_bu_05", "Sravani Popuri",     "sravani.popuri@hcl.com",     "proj_buyui",        "Shift2",  "Fri-Sat"],
  ["u_bu_06", "Inaganti Maruthi",   "inaganti.maruthi@hcl.com",   "proj_buyui",        "Shift2",  "Sun-Mon"],
  ["u_bu_07", "Vinodh Kumar Darangula", "vinodh.darangula@hcl.com","proj_buyui",       "Shift3",  "Fri-Sat"],
  ["u_bu_08", "Patan Sabeerkhan",   "patan.sabeerkhan@hcl.com",   "proj_buyui",        "Shift3",  "Sun-Mon"],
  ["u_bu_09", "Utsav Parashar",     "utsav.parashar@hcl.com",     "proj_buyui",        "Shift3",  "Fri-Sat"],

  // PT-WebApp
  ["u_wa_01", "Salipalli Naga Raju","naga.raju@hcl.com",          "proj_webapp",       "Shift1",  "Sun-Mon"],
  ["u_wa_02", "Bharat Kumar Reddy Daka", "bharat.daka@hcl.com",   "proj_webapp",       "Shift2",  "Fri-Sat"],
  ["u_wa_03", "Neelkandan",         "neelkandan@hcl.com",         "proj_webapp",       "Shift2",  "Sat-Sun"],
  ["u_wa_04", "Arafath Ali Shaik",  "arafath.shaik@hcl.com",      "proj_webapp",       "Shift2",  "Sun-Mon"],
  ["u_wa_05", "Ramamohan Yedluru",  "ramamohan.yedluru@hcl.com",  "proj_webapp",       "Shift3",  "Fri-Sat"],

  // DAM
  ["u_dm_01", "Puralasetti Vinodvarma","vinodvarma@hcl.com",       "proj_dam",          "Shift3",  "Fri-Sat"],
  ["u_dm_02", "Habibur Rahaman Kotwal","habibur.kotwal@hcl.com",   "proj_dam",          "General", "Sat-Sun"],
  ["u_dm_03", "Nirmalkumar Karuppusamy","nirmal.karuppusamy@hcl.com","proj_dam",         "General", "Sat-Sun"],
  ["u_dm_04", "Ian McNemar",        "ian.mcnemar@hcl.com",        "proj_dam",          "General", "Sat-Sun"],
  ["u_dm_05", "Manish Kumar",       "manish.kumar@hcl.com",       "proj_dam",          "Shift1",  "Sun-Mon"],

  // PT-Marketing
  ["u_mk_01", "Santosh Parida",     "santosh.parida@hcl.com",     "proj_marketing",    "General", "Sat-Sun"],
  ["u_mk_02", "Vishwesh",           "vishwesh@hcl.com",           "proj_marketing",    "General", "Sat-Sun"],
  ["u_mk_03", "Rajkumar Samala",    "rajkumar.samala@hcl.com",    "proj_marketing",    "General", "Sat-Sun"],
  ["u_mk_04", "Rohit Roshan",       "rohit.roshan@hcl.com",       "proj_marketing",    "General", "Sat-Sun"],
  ["u_mk_05", "Theeda Dhananjay",   "theeda.dhananjay@hcl.com",   "proj_marketing",    "General", "Sat-Sun"],
  ["u_mk_06", "Uma Ghanta",         "uma.ghanta@hcl.com",         "proj_marketing",    "General", "Sat-Sun"],
];

// Role overrides — default is EMPLOYEE; only exceptions listed here
const ROLE_OVERRIDES: Partial<Record<string, User["role"]>> = {
  "u_bp_09": "CONTRACTOR", // Chaitanya Lakshmikumar Addepalli (only contractor)
  "u_bp_06": "LEAD",       // Prateek Agarwal
  "u_ck_05": "LEAD",       // MadhaviLatha (handover lead)
};

// Build user objects
const BUILT_USERS: User[] = EMPLOYEE_DEFS.map(([id, name, email]) => ({
  id,
  email,
  name,
  displayName: name.split(" ").slice(0, 2).join(" "),
  avatarUrl: null,
  role: (ROLE_OVERRIDES[id] ?? "EMPLOYEE") as User["role"],
  timezone: "Asia/Kolkata",
  employeeId: null,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date("2024-05-01"),
  updatedAt: new Date(),
}));

// Manager and stakeholder demo accounts
const MANAGER_USER: User = {
  id: "user_mgr_001", email: "shailesh@hcl.com", name: "Shailesh",
  displayName: "Shailesh", avatarUrl: null, role: "MANAGER",
  timezone: "Asia/Kolkata", employeeId: "HCL-0010", isActive: true,
  lastLoginAt: new Date(Date.now() - 15 * 60 * 1000),
  createdAt: new Date("2024-01-05"), updatedAt: new Date(),
};

const GAP_USER: User = {
  id: "user_gap_001", email: "archana@gap.com", name: "Archana",
  displayName: "Archana", avatarUrl: null, role: "GAP_STAKEHOLDER",
  timezone: "America/Los_Angeles", employeeId: "GAP-501", isActive: true,
  lastLoginAt: new Date(Date.now() - 60 * 60 * 1000),
  createdAt: new Date("2024-02-01"), updatedAt: new Date(),
};

export const MOCK_USERS: User[] = [LEAD_USER, MANAGER_USER, GAP_USER, ...BUILT_USERS];

// Build shifts for all employees
const ALL_EMPLOYEE_SHIFTS: (Shift & { assignedTo: User })[] = [];
EMPLOYEE_DEFS.forEach(([id, , , projectId, shiftCode, weekOff], idx) => {
  const user = BUILT_USERS[idx];
  const shifts = generateShifts(
    id, user, projectId, shiftCode, weekOff,
    LEAD_USER.id, `s_${id}`
  );
  ALL_EMPLOYEE_SHIFTS.push(...shifts);
});

// ── Demo over-assignment scenarios (visible in Manage Roster) ─────────────
// These make the OverloadSummaryStrip appear so managers can see the feature.
//
//  1. Sonam Bhardwaj (u_ck_01, proj_checkout, Sun-Mon off)  → extra Shift2 on same Mon
//     → double-shift on same day (should be off too)
//  2. Ankit Singh (u_pc_01, proj_payment_core, Fri-Sat off)  → extra shift on Fri
//     → off-day violation
//  3. Rahul Anand (u_bp_01, proj_browse, Fri-Sat off)        → 6th shift (extra Thu)
//     → >5 days in a week
function makeDemoShift(
  id: string, userId: string, user: User, projectId: string,
  shiftCode: ShiftCode, jsDayOffset: number,
): Shift & { assignedTo: User } {
  // jsDayOffset: 0=Sun,1=Mon,...6=Sat relative to week start (Sunday)
  const weekStart = getWeekStart();
  const [sh, sm, eh, em] = SHIFT_HOURS[shiftCode];
  const start = new Date(weekStart);
  start.setDate(start.getDate() + jsDayOffset);
  start.setHours(sh, sm, 0, 0);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + jsDayOffset + (sh > eh ? 1 : 0));
  end.setHours(eh, em, 0, 0);
  const now = new Date();
  const active = start <= now && now <= end;
  const past   = end < now && !active;
  return {
    id, pattern: SHIFT_PATTERN[shiftCode],
    status: active ? "ACTIVE" : past ? "COMPLETED" : "SCHEDULED",
    startTime: start, endTime: end, timezone: "Asia/Kolkata",
    notes: "⚠ Demo over-assignment", projectId, partnerTeamId: null,
    assignedToId: userId, approvedById: null,
    assignedTo: user, createdAt: new Date("2024-05-01"), updatedAt: new Date(),
  };
}

const sonam  = BUILT_USERS.find((u) => u.id === "u_ck_01")!;
const ankit  = BUILT_USERS.find((u) => u.id === "u_pc_01")!;
const rahul  = BUILT_USERS.find((u) => u.id === "u_bp_01")!;

if (sonam) ALL_EMPLOYEE_SHIFTS.push(
  // Double shift on Monday (Mon=dayOffset 2 from Sun-start; also their weekoff day)
  makeDemoShift("demo_ck01_ov1", "u_ck_01", sonam, "proj_checkout", "Shift2", 2),
);
if (ankit) ALL_EMPLOYEE_SHIFTS.push(
  // Shift on Friday (Fri=dayOffset 6 from Sun-start; Fri-Sat is their weekoff)
  makeDemoShift("demo_pc01_ov1", "u_pc_01", ankit, "proj_payment_core", "Shift1", 6),
);
if (rahul) ALL_EMPLOYEE_SHIFTS.push(
  // Extra 6th shift on Thursday (Fri-Sat off, already works Sun-Thu → add a duplicate Thu)
  makeDemoShift("demo_bp01_ov1", "u_bp_01", rahul, "proj_browse", "Shift2", 5),
);

export const MOCK_SHIFTS: (Shift & { assignedTo: User })[] = ALL_EMPLOYEE_SHIFTS;

// ─── Logs ────────────────────────────────────────────────
export const MOCK_LOGS: DailyUpdateLog[] = [
  {
    id: "log_001",
    shiftId: "s_u_bp_08_d3",
    authorId: "u_bp_08",
    projectId: "proj_browse",
    partnerTeamId: null,
    source: "PAGERDUTY",
    severity: "P2_HIGH",
    status: "IN_PROGRESS",
    title: "Search API latency spike — product browse degraded",
    description:
      "P99 search latency increased from 120ms to 850ms. Investigating root cause. Suspect upstream Elasticsearch connection pool saturation.",
    snowTicketId: null,
    pagerDutyRef: "PD-A1B2C3",
    slackMessageUrl: null,
    teamsMessageUrl: null,
    isBlockingDependency: true,
    blockingReason: "Blocking browse/search flow — conversion impact confirmed.",
    occurredAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    acknowledgedAt: new Date(Date.now() - 3.8 * 60 * 60 * 1000),
    resolvedAt: null,
    loggedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    validatedById: null,
    tags: [{ id: "t1", label: "search", color: "#6366f1", logId: "log_001" }],
  },
  {
    id: "log_002",
    shiftId: "s_u_pc_02_d1",
    authorId: "u_pc_02",
    projectId: "proj_payment_core",
    partnerTeamId: null,
    source: "SERVICENOW",
    severity: "P3_MEDIUM",
    status: "RESOLVED",
    title: "SSL certificate renewal for Core API staging",
    description:
      "Renewed SSL cert for api-staging.core.gapinc.com. Cert was expiring in 3 days. Renewed via Let's Encrypt automation.",
    snowTicketId: "CHG0012345",
    pagerDutyRef: null,
    slackMessageUrl: null,
    teamsMessageUrl: null,
    isBlockingDependency: false,
    blockingReason: null,
    occurredAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
    acknowledgedAt: new Date(Date.now() - 6.9 * 60 * 60 * 1000),
    resolvedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    loggedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    validatedById: null,
    tags: [{ id: "t2", label: "ssl", color: "#10b981", logId: "log_002" }],
  },
  {
    id: "log_003",
    shiftId: "s_u_dm_02_d2",
    authorId: "u_dm_02",
    projectId: "proj_dam",
    partnerTeamId: null,
    source: "SLACK",
    severity: "P4_LOW",
    status: "OPEN",
    title: "Scheduled DB vacuum job delayed on reporting cluster",
    description:
      "Nightly vacuum job started 45 min late due to long-running analytics query. No data loss. Job completed successfully.",
    snowTicketId: null,
    pagerDutyRef: null,
    slackMessageUrl: "https://hcl.slack.com/archives/C01ABC/p123456",
    teamsMessageUrl: null,
    isBlockingDependency: false,
    blockingReason: null,
    occurredAt: new Date(Date.now() - 9 * 60 * 60 * 1000),
    acknowledgedAt: null,
    resolvedAt: null,
    loggedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    validatedById: null,
    tags: [{ id: "t3", label: "database", color: "#f59e0b", logId: "log_003" }],
  },
  {
    id: "log_004",
    shiftId: "s_u_ck_05_d3",
    authorId: "u_ck_05",
    projectId: "proj_checkout",
    partnerTeamId: null,
    source: "PAGERDUTY",
    severity: "P1_CRITICAL",
    status: "ESCALATED",
    title: "Payment service timeout — Stripe webhook failures",
    description:
      "Payment confirmations not arriving. Stripe webhook retries exhausting. Escalated to vendor and GAPINC Retail Payments team.",
    snowTicketId: "INC0087654",
    pagerDutyRef: "PD-Z9Y8X7",
    slackMessageUrl: null,
    teamsMessageUrl: null,
    isBlockingDependency: true,
    blockingReason: "All payment flows blocked. Revenue impact: ~$4k/min.",
    occurredAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
    acknowledgedAt: new Date(Date.now() - 1.4 * 60 * 60 * 1000),
    resolvedAt: null,
    loggedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 20 * 60 * 1000),
    validatedById: null,
    tags: [
      { id: "t4", label: "payments", color: "#ef4444", logId: "log_004" },
      { id: "t5", label: "escalated", color: "#dc2626", logId: "log_004" },
    ],
  },
  {
    id: "log_005",
    shiftId: "s_u_mk_01_d2",
    authorId: "u_mk_01",
    projectId: "proj_marketing",
    partnerTeamId: null,
    source: "TEAMS",
    severity: "P3_MEDIUM",
    status: "VALIDATED",
    title: "Email campaign cron skipped two dispatch cycles",
    description:
      "Email dispatch cron skipped 02:00 and 04:00 IST runs. Manually triggered at 05:30. Emails reconciled. Root cause: memory limit exceeded on worker pod.",
    snowTicketId: "INC0081111",
    pagerDutyRef: null,
    slackMessageUrl: null,
    teamsMessageUrl: "https://teams.microsoft.com/l/message/abc123",
    isBlockingDependency: false,
    blockingReason: null,
    occurredAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    acknowledgedAt: new Date(Date.now() - 11.8 * 60 * 60 * 1000),
    resolvedAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
    loggedAt: new Date(Date.now() - 11 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 9 * 60 * 60 * 1000),
    validatedById: LEAD_USER.id,
    tags: [{ id: "t6", label: "cron", color: "#8b5cf6", logId: "log_005" }],
  },
  {
    id: "log_006",
    shiftId: "s_u_bp_06_d3",
    authorId: "u_bp_06",
    projectId: "proj_browse",
    partnerTeamId: null,
    source: "PAGERDUTY",
    severity: "P2_HIGH",
    status: "IN_PROGRESS",
    title: "Profile service 503 errors — login degraded",
    description:
      "Customer login failing intermittently. Profile microservice returning 503 on ~15% of requests. Auth token refresh also impacted.",
    snowTicketId: "INC0091234",
    pagerDutyRef: "PD-M3N4O5",
    slackMessageUrl: null,
    teamsMessageUrl: null,
    isBlockingDependency: true,
    blockingReason: "Customers unable to sign in — affects all personalised features.",
    occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    acknowledgedAt: new Date(Date.now() - 1.9 * 60 * 60 * 1000),
    resolvedAt: null,
    loggedAt: new Date(Date.now() - 1.8 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000),
    validatedById: null,
    tags: [{ id: "t7", label: "auth", color: "#f43f5e", logId: "log_006" }],
  },

  // ── Payment Core ──────────────────────────────────────────────────────────
  {
    id: "log_007",
    shiftId: "s_u_pc_01_d3",
    authorId: "u_pc_01",
    projectId: "proj_payment_core",
    partnerTeamId: null,
    source: "PAGERDUTY",
    severity: "P1_CRITICAL",
    status: "ESCALATED",
    title: "Vault Service mismatch — AKS properties missing in Chartis",
    description:
      "Root cause identified: Vault Service version mismatch between Chartis env and AKS config. Missing properties causing auth token failures for 30% of payment requests. Escalated to Platform team.",
    snowTicketId: "INC1351802",
    pagerDutyRef: "PD-V7W8X9",
    slackMessageUrl: null,
    teamsMessageUrl: null,
    isBlockingDependency: true,
    blockingReason: "30% of payment requests failing — direct revenue impact.",
    occurredAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    acknowledgedAt: new Date(Date.now() - 2.9 * 60 * 60 * 1000),
    resolvedAt: null,
    loggedAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 40 * 60 * 1000),
    validatedById: null,
    tags: [{ id: "t8", label: "vault", color: "#ef4444", logId: "log_007" }],
  },
  {
    id: "log_008",
    shiftId: "s_u_pc_02_d3",
    authorId: "u_pc_02",
    projectId: "proj_payment_core",
    partnerTeamId: null,
    source: "PAGERDUTY",
    severity: "P2_HIGH",
    status: "IN_PROGRESS",
    title: "Apple Pay token validation — intermittent 40% error rate",
    description:
      "Apple Pay token validation returning HTTP 422 for ~40% of requests. Impacting mobile checkout. Apple Way gateway was down for 40 min; converted from P1. Root cause under investigation.",
    snowTicketId: "INC1351688",
    pagerDutyRef: "PD-A4P5Q6",
    slackMessageUrl: null,
    teamsMessageUrl: null,
    isBlockingDependency: false,
    blockingReason: null,
    occurredAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    acknowledgedAt: new Date(Date.now() - 4.8 * 60 * 60 * 1000),
    resolvedAt: null,
    loggedAt: new Date(Date.now() - 4.5 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
    validatedById: null,
    tags: [{ id: "t9", label: "apple-pay", color: "#f97316", logId: "log_008" }],
  },
  {
    id: "log_009",
    shiftId: "s_u_pc_04_d3",
    authorId: "u_pc_04",
    projectId: "proj_payment_core",
    partnerTeamId: null,
    source: "SERVICENOW",
    severity: "P4_LOW",
    status: "RESOLVED",
    title: "Customer profile cache TTL misconfiguration — stale data on refresh",
    description:
      "Cache TTL was set to 1h instead of 5m. Customer profile updates not reflecting immediately. TTL updated and cache cleared. No data loss.",
    snowTicketId: "INC1349287",
    pagerDutyRef: null,
    slackMessageUrl: null,
    teamsMessageUrl: null,
    isBlockingDependency: false,
    blockingReason: null,
    occurredAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
    acknowledgedAt: new Date(Date.now() - 9.8 * 60 * 60 * 1000),
    resolvedAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
    loggedAt: new Date(Date.now() - 9 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    validatedById: LEAD_USER.id,
    tags: [{ id: "t10", label: "cache", color: "#10b981", logId: "log_009" }],
  },

  // ── Buy UI ────────────────────────────────────────────────────────────────
  {
    id: "log_010",
    shiftId: "s_u_bu_01_d3",
    authorId: "u_bu_01",
    projectId: "proj_buyui",
    partnerTeamId: null,
    source: "PAGERDUTY",
    severity: "P2_HIGH",
    status: "IN_PROGRESS",
    title: "Buy flow — rule engine rules throwing TypeError on promo stacking",
    description:
      "TypeError in checkout rule engine when two or more promotions are stacked. Affects ~12% of checkout sessions with active promo codes. Draft PR raised, addressing review comments.",
    snowTicketId: "INC1351908",
    pagerDutyRef: "PD-R1S2T3",
    slackMessageUrl: null,
    teamsMessageUrl: null,
    isBlockingDependency: false,
    blockingReason: null,
    occurredAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
    acknowledgedAt: new Date(Date.now() - 3.4 * 60 * 60 * 1000),
    resolvedAt: null,
    loggedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 45 * 60 * 1000),
    validatedById: null,
    tags: [{ id: "t11", label: "checkout", color: "#f97316", logId: "log_010" }],
  },
  {
    id: "log_011",
    shiftId: "s_u_bu_03_d3",
    authorId: "u_bu_03",
    projectId: "proj_buyui",
    partnerTeamId: null,
    source: "TEAMS",
    severity: "P3_MEDIUM",
    status: "OPEN",
    title: "Ecom FUI — story FUI-6211 validation bugs observed",
    description:
      "While validating FUI-6211, identified 3 UI regression bugs in the cart summary component. Shared observations to dev. Awaiting fix.",
    snowTicketId: null,
    pagerDutyRef: null,
    slackMessageUrl: null,
    teamsMessageUrl: "https://teams.microsoft.com/l/message/fui6211",
    isBlockingDependency: false,
    blockingReason: null,
    occurredAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    acknowledgedAt: null,
    resolvedAt: null,
    loggedAt: new Date(Date.now() - 5.5 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    validatedById: null,
    tags: [{ id: "t12", label: "ui-bug", color: "#8b5cf6", logId: "log_011" }],
  },

  // ── Checkout ──────────────────────────────────────────────────────────────
  {
    id: "log_012",
    shiftId: "s_u_ck_01_d3",
    authorId: "u_ck_01",
    projectId: "proj_checkout",
    partnerTeamId: null,
    source: "SERVICENOW",
    severity: "P3_MEDIUM",
    status: "RESOLVED",
    title: "BRFC — Savings calculator showing 20% instead of 25%",
    description:
      "Savings calculator in bag/checkout showing incorrect 20% savings figure instead of 25%. Root cause: percentage constant not updated post campaign config change. Hotfix deployed.",
    snowTicketId: "INC1352900",
    pagerDutyRef: null,
    slackMessageUrl: null,
    teamsMessageUrl: null,
    isBlockingDependency: false,
    blockingReason: null,
    occurredAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    acknowledgedAt: new Date(Date.now() - 7.9 * 60 * 60 * 1000),
    resolvedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    loggedAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    validatedById: LEAD_USER.id,
    tags: [{ id: "t13", label: "brfc", color: "#10b981", logId: "log_012" }],
  },

  // ── Web Apps ──────────────────────────────────────────────────────────────
  {
    id: "log_013",
    shiftId: "s_u_wa_01_d3",
    authorId: "u_wa_01",
    projectId: "proj_webapp",
    partnerTeamId: null,
    source: "PAGERDUTY",
    severity: "P2_HIGH",
    status: "IN_PROGRESS",
    title: "buy-next-prod JS error rate >5.0 — HUI excluding ApplePay/PayPal",
    description:
      "JS error rate exceeded 5.0 threshold on buy-next-prod for 5 consecutive minutes (HUI). Reviewed GCP logs, New Relic alerts and PT-Webapps Runbooks. RCA in progress.",
    snowTicketId: "INC1334766",
    pagerDutyRef: "PDCN-8420",
    slackMessageUrl: null,
    teamsMessageUrl: null,
    isBlockingDependency: false,
    blockingReason: null,
    occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    acknowledgedAt: new Date(Date.now() - 1.9 * 60 * 60 * 1000),
    resolvedAt: null,
    loggedAt: new Date(Date.now() - 1.7 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 35 * 60 * 1000),
    validatedById: null,
    tags: [{ id: "t14", label: "js-error", color: "#f97316", logId: "log_013" }],
  },

  // ── Browse ─────────────────────────────────────────────────────────────────
  {
    id: "log_014",
    shiftId: "s_u_bp_09_d3",
    authorId: "u_bp_09",
    projectId: "proj_browse",
    partnerTeamId: null,
    source: "SLACK",
    severity: "P4_LOW",
    status: "VALIDATED",
    title: "KTLO — PWFO-2126 feature flag cleanup reviewed",
    description:
      "Reviewed KTLO ticket PWFO-2126 for feature flag cleanup. Change is low-risk, will raise PR in upcoming sprint. No production impact.",
    snowTicketId: null,
    pagerDutyRef: null,
    slackMessageUrl: "https://hcl.slack.com/archives/C01ABC/p202",
    teamsMessageUrl: null,
    isBlockingDependency: false,
    blockingReason: null,
    occurredAt: new Date(Date.now() - 11 * 60 * 60 * 1000),
    acknowledgedAt: new Date(Date.now() - 10.8 * 60 * 60 * 1000),
    resolvedAt: new Date(Date.now() - 9 * 60 * 60 * 1000),
    loggedAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    validatedById: LEAD_USER.id,
    tags: [{ id: "t15", label: "ktlo", color: "#6366f1", logId: "log_014" }],
  },

  // ── DAM ────────────────────────────────────────────────────────────────────
  {
    id: "log_015",
    shiftId: "s_u_da_01_d3",
    authorId: "u_da_01",
    projectId: "proj_dam",
    partnerTeamId: null,
    source: "SERVICENOW",
    severity: "P3_MEDIUM",
    status: "OPEN",
    title: "DAM asset sync job delayed — CDN propagation lag >15 min",
    description:
      "Scheduled asset sync job took 47 min instead of expected 30 min. CDN propagation lag observed across 3 edge nodes. Investigating network bottleneck on DAM → CDN pipeline.",
    snowTicketId: "INC1351765",
    pagerDutyRef: null,
    slackMessageUrl: null,
    teamsMessageUrl: null,
    isBlockingDependency: false,
    blockingReason: null,
    occurredAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    acknowledgedAt: null,
    resolvedAt: null,
    loggedAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    validatedById: null,
    tags: [{ id: "t16", label: "cdn", color: "#0ea5e9", logId: "log_015" }],
  },
];

// ─── Handovers ────────────────────────────────────────────
export const MOCK_HANDOVERS: ShiftHandover[] = [
  {
    id: "ho_001",
    status: "SUBMITTED",
    openItemsSummary:
      "1 P1 active (Stripe webhook failures in Checkout). Search latency spike in Browse still under investigation. Profile 503s being monitored.",
    resolvedSummary:
      "SSL cert renewed for Core API staging. Email cron reconciled in Marketing. DB vacuum completed in DAM.",
    escalationNotes: "P1 in Checkout needs immediate attention from incoming lead.",
    incomingLeadNotes: null,
    disputeReason: null,
    compiledAt: null,
    projectId: "proj_browse",
    outgoingShiftId: "s_u_bp_08_d3",
    incomingShiftId: "s_u_bp_06_d3",
    outgoingLeadId: LEAD_USER.id,
    incomingLeadId: "u_bp_06",
    submittedAt: new Date(Date.now() - 25 * 60 * 1000),
    acknowledgedAt: null,
    dueBy: new Date(Date.now() + 5 * 60 * 1000),
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
    updatedAt: new Date(Date.now() - 25 * 60 * 1000),
  },
];

// ─── Swap Requests ────────────────────────────────────────
export const MOCK_SWAPS: ShiftSwapRequest[] = [
  {
    id: "swap_001",
    status: "PENDING",
    reason: "Family event — need to swap Sat shift.",
    rejectionNote: null,
    requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    decidedAt: null,
    shiftId: "s_u_bp_09_d6",
    projectId: "proj_browse",
    requesterId: "u_bp_09",
    recipientId: "u_bp_08",
    approvedById: null,
  },
  {
    id: "swap_002",
    status: "PENDING",
    reason: "Medical appointment in the morning.",
    rejectionNote: null,
    requestedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    decidedAt: null,
    shiftId: "s_u_ck_03_d3",
    projectId: "proj_checkout",
    requesterId: "u_ck_03",
    recipientId: "u_ck_01",
    approvedById: null,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DAILY DIARIES
// A realistic week's worth of end-of-shift diary entries across all projects.
// ─────────────────────────────────────────────────────────────────────────────
// Diary types are already imported at the top of this file.

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Helper: build a full diary object ──────────────────────────────────────
function makeDiary(
  id: string,
  authorId: string,
  projectId: string,
  diaryDate: Date,
  shiftPattern: ShiftPattern,
  status: DiaryStatus,
  data: {
    incidentCount?: number; incidentNotes?: string;
    ktSessionsCount?: number; ktProgressPercent?: number; ktNotes?: string;
    ktloResolvedCount?: number; ktloNotes?: string;
    newTaskCount?: number; newTaskNotes?: string;
    hasBlockers?: boolean; blockerDetails?: string;
    generalNotes?: string; reviewNotes?: string;
    incidents?: DiaryIncident[]; ktItems?: DiaryKtItem[];
    ktloItems?: DiaryKtloItem[]; tasks?: DiaryTask[];
  }
): DailyDiary {
  const now = new Date();
  return {
    id, authorId, projectId, diaryDate, shiftPattern, status,
    incidentCount:     data.incidentCount     ?? 0,
    incidentNotes:     data.incidentNotes     ?? null,
    ktSessionsCount:   data.ktSessionsCount   ?? 0,
    ktProgressPercent: data.ktProgressPercent ?? 0,
    ktNotes:           data.ktNotes           ?? null,
    ktloResolvedCount: data.ktloResolvedCount ?? 0,
    ktloNotes:         data.ktloNotes         ?? null,
    newTaskCount:      data.newTaskCount      ?? 0,
    newTaskNotes:      data.newTaskNotes      ?? null,
    hasBlockers:       data.hasBlockers       ?? false,
    blockerDetails:    data.blockerDetails    ?? null,
    generalNotes:      data.generalNotes      ?? null,
    reviewedAt:        status === "REVIEWED" ? new Date(now.getTime() - 30 * 60 * 1000) : null,
    reviewNotes:       data.reviewNotes       ?? null,
    submittedAt:       status !== "DRAFT"  ? new Date(now.getTime() - 2 * 60 * 60 * 1000) : null,
    createdAt:         diaryDate,
    updatedAt:         now,
    shiftId:           null,
    incidents:         data.incidents  ?? [],
    ktItems:           data.ktItems    ?? [],
    ktloItems:         data.ktloItems  ?? [],
    tasks:             data.tasks      ?? [],
  };
}

export const MOCK_DIARY_ENTRIES: DailyDiary[] = [

  // ── TODAY ──────────────────────────────────────────────────────────────

  makeDiary("diary_bp08_today", "u_bp_08", "proj_browse", daysAgo(0), "NIGHT", "SUBMITTED", {
    incidentCount: 3, incidentNotes: "Handled 3 incidents during shift — 1 P2 search latency, 2 P4 infra alerts.",
    incidents: [
      { id: "di_1", diaryId: "diary_bp08_today", title: "Search API latency spike (P2)", source: "PAGERDUTY", severity: "P2_HIGH", externalRef: "PD-A1B2C3", wasResolved: false, notes: "Under investigation — ES connection pool saturation suspected." },
      { id: "di_2", diaryId: "diary_bp08_today", title: "Browse CDN cache miss rate high (P4)", source: "SLACK", severity: "P4_LOW", externalRef: null, wasResolved: true, notes: "Cache purge triggered; miss rate back to normal within 10 min." },
      { id: "di_3", diaryId: "diary_bp08_today", title: "Profile service slow 200 (P4)", source: "TEAMS", severity: "P4_LOW", externalRef: null, wasResolved: true, notes: "DB query optimization applied; response time normalised." },
    ],
    ktSessionsCount: 1, ktProgressPercent: 45, ktNotes: "Covered Browse product taxonomy module with Rahul Anand — documented key queries.",
    ktItems: [
      { id: "ki_1", diaryId: "diary_bp08_today", topic: "Browse taxonomy & category API", type: "SESSION", durationMins: 90, notes: "Walkthrough with Rahul, documented in Confluence." },
    ],
    ktloResolvedCount: 4, ktloNotes: "Nightly health-checks, log rotation, SSL cert expiry check, disk usage monitoring.",
    ktloItems: [
      { id: "kl_1", diaryId: "diary_bp08_today", title: "Nightly health check script executed", category: "MONITORING", externalRef: null, notes: "All services green at shift end." },
      { id: "kl_2", diaryId: "diary_bp08_today", title: "Log rotation for app-browse-prod-01/02", category: "MAINTENANCE", externalRef: null, notes: "Logs archived to S3 cold tier." },
      { id: "kl_3", diaryId: "diary_bp08_today", title: "SSL cert expiry sweep (30-day window)", category: "MONITORING", externalRef: "CHG0099001", notes: "2 certs flagged for renewal next week." },
      { id: "kl_4", diaryId: "diary_bp08_today", title: "Disk usage alert resolved — /var/log cleanup", category: "ALERT", externalRef: null, notes: "Freed 18 GB on prod server." },
    ],
    newTaskCount: 2, newTaskNotes: "Opened ticket for ES connection pool tuning; flagged for Prateek to review in morning.",
    tasks: [
      { id: "dt_1", diaryId: "diary_bp08_today", title: "Tune Elasticsearch connection pool limits (prod)", priority: "HIGH", dueDate: new Date(Date.now() + 2 * 86400000), notes: "Linked to P2 search latency incident." },
      { id: "dt_2", diaryId: "diary_bp08_today", title: "Update runbook: Browse CDN cache purge procedure", priority: "MEDIUM", dueDate: new Date(Date.now() + 5 * 86400000), notes: "Current runbook is outdated." },
    ],
    hasBlockers: true, blockerDetails: "P2 Search latency still open — ES connection pool not resolved. Incoming shift (Shift 1) to prioritise.",
    generalNotes: "Overall shift was manageable. 3 incidents handled, 4 KTLO tasks done, 1 KT session with Rahul. The P2 search latency needs ES-level fix which requires access we don't have — escalated to platform team.",
  }),

  makeDiary("diary_bp09_today", "u_bp_09", "proj_browse", daysAgo(0), "NIGHT", "SUBMITTED", {
    incidentCount: 2, incidentNotes: "Monitored P2 handed over from previous shift. Resolved 1 P4.",
    incidents: [
      { id: "di_5", diaryId: "diary_bp09_today", title: "P2 Search latency monitoring (handover)", source: "PAGERDUTY", severity: "P2_HIGH", externalRef: "PD-A1B2C3", wasResolved: false, notes: "Monitored throughout shift — no worsening. ES ticket raised." },
      { id: "di_6", diaryId: "diary_bp09_today", title: "404 spike on /browse/categories endpoint", source: "SLACK", severity: "P4_LOW", externalRef: null, wasResolved: true, notes: "Caused by stale route cache. Cache invalidated." },
    ],
    ktSessionsCount: 0, ktProgressPercent: 35, ktNotes: "No formal KT session today — reviewed existing docs for onboarding prep.",
    ktloResolvedCount: 3, ktloNotes: "Cron job monitoring, Redis memory check, deployment pipeline verification.",
    ktloItems: [
      { id: "kl_5", diaryId: "diary_bp09_today", title: "Cron job health monitoring", category: "MONITORING", externalRef: null, notes: "All 12 cron jobs executed successfully." },
      { id: "kl_6", diaryId: "diary_bp09_today", title: "Redis memory utilisation check", category: "MONITORING", externalRef: null, notes: "At 68% — within normal range." },
      { id: "kl_7", diaryId: "diary_bp09_today", title: "Verify nightly deployment pipeline", category: "DEPLOYMENT", externalRef: "CHG0099002", notes: "Pipeline completed, all stages green." },
    ],
    newTaskCount: 1, newTaskNotes: "Flagged route-cache TTL review.",
    tasks: [
      { id: "dt_3", diaryId: "diary_bp09_today", title: "Review route-cache TTL settings for /browse/categories", priority: "MEDIUM", dueDate: null, notes: "Recurring cause of 404 spikes." },
    ],
    hasBlockers: false,
    generalNotes: "Quiet shift with the P2 in monitoring state. Deployment pipeline verified. Will hand over P2 status clearly to incoming Shift 1 team.",
  }),

  makeDiary("diary_bp06_today", "u_bp_06", "proj_browse", daysAgo(0), "AFTERNOON", "SUBMITTED", {
    incidentCount: 1, incidentNotes: "1 P3 customer profile 503 resolved during shift.",
    incidents: [
      { id: "di_7", diaryId: "diary_bp06_today", title: "Customer profile 503 — DB connection leak", source: "SERVICENOW", severity: "P3_MEDIUM", externalRef: "INC0098777", wasResolved: true, notes: "Connection pool exhausted due to long-running query. Query killed, pool recycled." },
    ],
    ktSessionsCount: 2, ktProgressPercent: 60, ktNotes: "KT sessions with Karthik (new joiner): Browse API routing, profile schema deep-dive.",
    ktItems: [
      { id: "ki_2", diaryId: "diary_bp06_today", topic: "Browse API routing & gateway config", type: "SESSION", durationMins: 60, notes: "Karthik onboarding — covered upstream/downstream services." },
      { id: "ki_3", diaryId: "diary_bp06_today", topic: "Customer profile schema & data model", type: "SESSION", durationMins: 45, notes: "Covered Postgres schema for profile data." },
    ],
    ktloResolvedCount: 5, ktloNotes: "Deployed hotfix for profile 503, updated grafana alert thresholds, reviewed pending SNOW queue.",
    ktloItems: [
      { id: "kl_8", diaryId: "diary_bp06_today", title: "Deploy profile-service hotfix v2.1.7", category: "DEPLOYMENT", externalRef: "CHG0099010", notes: "Deployed to prod, verified in monitoring." },
      { id: "kl_9", diaryId: "diary_bp06_today", title: "Grafana alert threshold tuning for DB connections", category: "MONITORING", externalRef: null, notes: "Updated thresholds to fire at 80% pool utilisation." },
      { id: "kl_10", diaryId: "diary_bp06_today", title: "SNOW queue review — 8 tickets triaged", category: "MAINTENANCE", externalRef: null, notes: "3 resolved, 5 assigned to team." },
      { id: "kl_11", diaryId: "diary_bp06_today", title: "Patch applied: node-fetch CVE-2022-0355", category: "PATCH", externalRef: "CHG0099011", notes: "Applied in browse-search-service." },
      { id: "kl_12", diaryId: "diary_bp06_today", title: "Weekly backup verification", category: "MAINTENANCE", externalRef: null, notes: "All backups healthy, restore tested on dev." },
    ],
    newTaskCount: 1, newTaskNotes: "Query performance review for long-running profile queries added to sprint.",
    tasks: [
      { id: "dt_4", diaryId: "diary_bp06_today", title: "Profile DB: query performance review & indexing", priority: "HIGH", dueDate: new Date(Date.now() + 3 * 86400000), notes: "Root cause of today P3 503." },
    ],
    hasBlockers: false,
    generalNotes: "Good shift overall. Resolved P3, did 2 KT sessions with Karthik, 5 KTLO items. KT is at 60% — on track for target by end of sprint.",
  }),

  // ── YESTERDAY ──────────────────────────────────────────────────────────

  makeDiary("diary_bp08_y1", "u_bp_08", "proj_browse", daysAgo(1), "NIGHT", "REVIEWED", {
    incidentCount: 1, incidentNotes: "Minor P4 — Elasticsearch index rebuild triggered auto-alert.",
    incidents: [
      { id: "di_8", diaryId: "diary_bp08_y1", title: "ES index rebuild auto-alert (P4)", source: "PAGERDUTY", severity: "P4_LOW", externalRef: "PD-B2C3D4", wasResolved: true, notes: "Expected maintenance window — alert acknowledged and silenced." },
    ],
    ktSessionsCount: 1, ktProgressPercent: 40, ktNotes: "KT on Elasticsearch index management with Dipak.",
    ktItems: [
      { id: "ki_4", diaryId: "diary_bp08_y1", topic: "Elasticsearch index management", type: "SESSION", durationMins: 75, notes: "Covered index lifecycle policies, shard allocation." },
    ],
    ktloResolvedCount: 3, ktloNotes: "ES index rebuild, routine monitoring, old log cleanup.",
    newTaskCount: 0,
    hasBlockers: false,
    generalNotes: "Very quiet shift. Only 1 expected P4 alert. Good progress on ES KT session.",
    reviewNotes: "Good entry — KT documentation uploaded. Acknowledged.",
  }),

  makeDiary("diary_ck01_y1", "u_ck_01", "proj_checkout", daysAgo(1), "MORNING", "REVIEWED", {
    incidentCount: 2, incidentNotes: "P2 Stripe webhook failure & P4 cart session timeout spike.",
    incidents: [
      { id: "di_9", diaryId: "diary_ck01_y1", title: "Stripe webhook delivery failure (P2)", source: "PAGERDUTY", severity: "P2_HIGH", externalRef: "PD-C3D4E5", wasResolved: true, notes: "Stripe endpoint returned 502. Investigated — nginx config misconfiguration on checkout-webhook-relay. Fixed and redeployed." },
      { id: "di_10", diaryId: "diary_ck01_y1", title: "Cart session timeout spike — Redis latency (P4)", source: "SERVICENOW", severity: "P4_LOW", externalRef: "INC0097123", wasResolved: true, notes: "Redis cluster node was under memory pressure. Restarted replica node." },
    ],
    ktSessionsCount: 1, ktProgressPercent: 55, ktNotes: "KT on Stripe webhook handling — internal runbook updated.",
    ktItems: [
      { id: "ki_5", diaryId: "diary_ck01_y1", topic: "Stripe webhook relay architecture", type: "SESSION", durationMins: 90, notes: "Documented end-to-end webhook flow with Meenu." },
    ],
    ktloResolvedCount: 4, ktloNotes: "Webhook relay redeployed, Redis node restarted, SNOW queue triaged, morning health check.",
    newTaskCount: 2, newTaskNotes: "nginx config review for webhook relay; Redis memory capacity planning.",
    tasks: [
      { id: "dt_5", diaryId: "diary_ck01_y1", title: "nginx config review — checkout-webhook-relay", priority: "HIGH", dueDate: new Date(Date.now() + 1 * 86400000), notes: "Prevent recurrence of P2." },
      { id: "dt_6", diaryId: "diary_ck01_y1", title: "Redis memory capacity planning review", priority: "MEDIUM", dueDate: new Date(Date.now() + 7 * 86400000), notes: "Current node sizes need review." },
    ],
    hasBlockers: false,
    generalNotes: "Active shift. Resolved 2 incidents, done KT with Meenu, updated Stripe runbook. Task added for nginx config review.",
    reviewNotes: "Well documented. Good handling of P2. nginx ticket is critical — ensure Abhinandan picks it up.",
  }),

  makeDiary("diary_pc01_y1", "u_pc_01", "proj_payment_core", daysAgo(1), "MORNING", "SUBMITTED", {
    incidentCount: 1, incidentNotes: "P3 payment core API timeout during peak load window.",
    incidents: [
      { id: "di_11", diaryId: "diary_pc01_y1", title: "Payment Core API timeout (P3) — peak load", source: "SERVICENOW", severity: "P3_MEDIUM", externalRef: "INC0097200", wasResolved: true, notes: "Horizontal pod autoscaler kicked in after 4-minute delay. Response time normalised. HPA delay config to review." },
    ],
    ktSessionsCount: 2, ktProgressPercent: 70, ktNotes: "KT sessions on payment processing flow and HPA configuration.",
    ktItems: [
      { id: "ki_6", diaryId: "diary_pc01_y1", topic: "Payment Core HPA & scaling configuration", type: "SESSION", durationMins: 60, notes: "Deep-dive with Rajbir on HPA metrics & thresholds." },
      { id: "ki_7", diaryId: "diary_pc01_y1", topic: "Payment processing flow — end-to-end walkthrough", type: "DEMO", durationMins: 45, notes: "Demo to new joiners Ankit Bisht and Samadhan." },
    ],
    ktloResolvedCount: 6, ktloNotes: "HPA config tuning, SNOW queue (6 tickets), cert renewals, backup validation, log shipping check, monitoring dashboard update.",
    newTaskCount: 1, newTaskNotes: "HPA cooldown period needs revisiting — too slow on scale-up.",
    tasks: [
      { id: "dt_7", diaryId: "diary_pc01_y1", title: "Review HPA cooldown/scale-up parameters for payment-core", priority: "HIGH", dueDate: new Date(Date.now() + 2 * 86400000), notes: "Root cause of P3 timeout delay." },
    ],
    hasBlockers: false,
    generalNotes: "Productive shift — resolved P3, 2 KT sessions done, 6 KTLO tasks completed. Payment Core KT is at 70% — ahead of plan.",
  }),

  makeDiary("diary_dm02_y1", "u_dm_02", "proj_dam", daysAgo(1), "GENERAL", "SUBMITTED", {
    incidentCount: 0, incidentNotes: "No incidents during shift.",
    ktSessionsCount: 1, ktProgressPercent: 25, ktNotes: "Initial KT on DAM ingestion pipeline — early stage.",
    ktItems: [
      { id: "ki_8", diaryId: "diary_dm02_y1", topic: "DAM asset ingestion pipeline overview", type: "SESSION", durationMins: 60, notes: "Covered S3 bucket triggers, Lambda processors, metadata indexing." },
    ],
    ktloResolvedCount: 7, ktloNotes: "Weekly maintenance window — applied 3 dependency patches, rebuilt stale indexes, verified CDN asset delivery, cleared orphaned temp files.",
    ktloItems: [
      { id: "kl_13", diaryId: "diary_dm02_y1", title: "Apply dependency patches: sharp v0.33.2, imagemin v8.0.1", category: "PATCH", externalRef: "CHG0099020", notes: "Zero-downtime patch applied." },
      { id: "kl_14", diaryId: "diary_dm02_y1", title: "Rebuild stale metadata indexes", category: "MAINTENANCE", externalRef: null, notes: "Improved asset search response by ~30%." },
      { id: "kl_15", diaryId: "diary_dm02_y1", title: "CDN asset delivery verification (spot-check 200 assets)", category: "MONITORING", externalRef: null, notes: "All assets delivering correctly. 2 stale entries found and cleared." },
    ],
    newTaskCount: 0,
    hasBlockers: false,
    generalNotes: "Maintenance-heavy shift. No incidents. KT starting from scratch — will need 3–4 more sessions to reach 60%. Indexes rebuilt should speed up daily ops.",
  }),

  // ── 2 DAYS AGO ──────────────────────────────────────────────────────────

  makeDiary("diary_bp08_y2", "u_bp_08", "proj_browse", daysAgo(2), "NIGHT", "REVIEWED", {
    incidentCount: 4, incidentNotes: "Busy shift — 1 P2, 1 P3, 2 P4s.",
    incidents: [
      { id: "di_12", diaryId: "diary_bp08_y2", title: "Browse search down — P2 (Elasticsearch OOM)", source: "PAGERDUTY", severity: "P2_HIGH", externalRef: "PD-D4E5F6", wasResolved: true, notes: "ES node ran out of memory. Restarted node, re-routed traffic to hot replica. Fully resolved." },
      { id: "di_13", diaryId: "diary_bp08_y2", title: "Product image thumbnails 404 on CDN (P3)", source: "SERVICENOW", severity: "P3_MEDIUM", externalRef: "INC0096800", wasResolved: true, notes: "S3 bucket policy update accidentally blocked CDN origin pull. Reverted policy." },
      { id: "di_14", diaryId: "diary_bp08_y2", title: "High error rate on /profile/preferences (P4)", source: "SLACK", severity: "P4_LOW", externalRef: null, wasResolved: true, notes: "Schema migration left stale column ref. Fixed with hotfix query." },
      { id: "di_15", diaryId: "diary_bp08_y2", title: "Slow query alert — profile read latency (P4)", source: "PAGERDUTY", severity: "P4_LOW", externalRef: null, wasResolved: true, notes: "Missing index on user_preferences.user_id. Added index." },
    ],
    ktSessionsCount: 0, ktProgressPercent: 30, ktNotes: "No KT session — too many incidents.",
    ktloResolvedCount: 2, ktloNotes: "Health check + mandatory nightly backups.",
    newTaskCount: 3, newTaskNotes: "3 new tasks from P2 and P3 root cause analysis.",
    tasks: [
      { id: "dt_8", diaryId: "diary_bp08_y2", title: "ES node memory sizing review (JVM heap)", priority: "HIGH", dueDate: null, notes: "OOM root cause." },
      { id: "dt_9", diaryId: "diary_bp08_y2", title: "S3 bucket policy change management process", priority: "HIGH", dueDate: null, notes: "Policy change broke CDN. Need approval gate." },
      { id: "dt_10", diaryId: "diary_bp08_y2", title: "DB migration review process — add stale ref checks", priority: "MEDIUM", dueDate: null, notes: "Prevent /profile/preferences style breakage." },
    ],
    hasBlockers: false,
    generalNotes: "Hectic shift — 4 incidents all resolved. P2 ES OOM was most critical and took 45 mins. 3 new tasks opened from root cause analysis. No KT session possible due to incident load.",
    reviewNotes: "Outstanding job handling the P2. All 3 action tasks are high-priority — ensure these are picked up this week.",
  }),

  makeDiary("diary_wa02_y2", "u_wa_02", "proj_webapp", daysAgo(2), "AFTERNOON", "SUBMITTED", {
    incidentCount: 1, incidentNotes: "P4 — WebApp CI/CD pipeline stage failure during off-peak.",
    incidents: [
      { id: "di_16", diaryId: "diary_wa02_y2", title: "CI/CD pipeline stage failure — Docker layer cache miss", source: "TEAMS", severity: "P4_LOW", externalRef: null, wasResolved: true, notes: "Cache invalidated after base image update. Forced rebuild fixed it. Updated pipeline config to pin base image." },
    ],
    ktSessionsCount: 1, ktProgressPercent: 40, ktNotes: "KT on WebApp deployment pipeline with Arafath.",
    ktItems: [
      { id: "ki_9", diaryId: "diary_wa02_y2", topic: "WebApp CI/CD pipeline — GitHub Actions + ArgoCD", type: "SESSION", durationMins: 80, notes: "Covered full pipeline from PR merge to prod deploy." },
    ],
    ktloResolvedCount: 5, ktloNotes: "Pipeline config update, dependency audit, monitoring setup for new service, health checks.",
    newTaskCount: 1, newTaskNotes: "Base image pinning policy for all WebApp pipelines.",
    tasks: [
      { id: "dt_11", diaryId: "diary_wa02_y2", title: "Pin base Docker images in all WebApp CI pipelines", priority: "MEDIUM", dueDate: new Date(Date.now() + 4 * 86400000), notes: "Prevent recurrence of layer cache miss failures." },
    ],
    hasBlockers: false,
    generalNotes: "Stable shift. Fixed CI/CD issue quickly. Good KT progress with Arafath — WebApp pipeline is well-documented now.",
  }),

  // ── 3 DAYS AGO ──────────────────────────────────────────────────────────

  makeDiary("diary_bu07_y3", "u_bu_07", "proj_buyui", daysAgo(3), "NIGHT", "SUBMITTED", {
    incidentCount: 2, incidentNotes: "1 P3 checkout UI render error, 1 P4 performance warning.",
    incidents: [
      { id: "di_17", diaryId: "diary_bu07_y3", title: "Checkout UI broken on Safari 16 (P3)", source: "SERVICENOW", severity: "P3_MEDIUM", externalRef: "INC0096100", wasResolved: true, notes: "CSS grid gap property not supported on Safari 16. Applied vendor prefix. Tested on 5 Safari versions." },
      { id: "di_18", diaryId: "diary_bu07_y3", title: "Buy UI FCP >3s on mobile (P4 perf)", source: "TEAMS", severity: "P4_LOW", externalRef: null, wasResolved: false, notes: "First Contentful Paint degraded. Likely large JS bundle. Opened task." },
    ],
    ktSessionsCount: 1, ktProgressPercent: 50, ktNotes: "KT on Buy UI frontend architecture with Patan.",
    ktItems: [
      { id: "ki_10", diaryId: "diary_bu07_y3", topic: "Buy UI React component architecture & state management", type: "SESSION", durationMins: 90, notes: "Covered Redux store, component tree, API integration patterns." },
    ],
    ktloResolvedCount: 3, ktloNotes: "Bundle analysis, Lighthouse CI run, cross-browser smoke tests.",
    newTaskCount: 2, newTaskNotes: "JS bundle size analysis task; Safari CSS compatibility audit.",
    tasks: [
      { id: "dt_12", diaryId: "diary_bu07_y3", title: "JS bundle size analysis & code splitting opportunities", priority: "HIGH", dueDate: new Date(Date.now() + 3 * 86400000), notes: "Root cause of mobile FCP regression." },
      { id: "dt_13", diaryId: "diary_bu07_y3", title: "Safari CSS compatibility audit for Buy UI", priority: "MEDIUM", dueDate: new Date(Date.now() + 5 * 86400000), notes: "Check all CSS grid/flex usage for Safari 15-16 compat." },
    ],
    hasBlockers: true, blockerDetails: "Mobile FCP issue requires frontend performance access — need Lighthouse CI results shared by morning shift lead.",
    generalNotes: "Safari CSS fix was fast. Mobile performance issue needs platform team involvement. KT with Patan was thorough — Redux store flow documented.",
  }),

  makeDiary("diary_mk01_y3", "u_mk_01", "proj_marketing", daysAgo(3), "GENERAL", "REVIEWED", {
    incidentCount: 0, incidentNotes: "No incidents. Scheduled maintenance day.",
    ktSessionsCount: 2, ktProgressPercent: 65, ktNotes: "KT on email campaign pipeline and Salesforce Marketing Cloud integration.",
    ktItems: [
      { id: "ki_11", diaryId: "diary_mk01_y3", topic: "Email campaign scheduling & SFMC integration", type: "SESSION", durationMins: 120, notes: "Full walkthrough of campaign lifecycle. Covered SFMC journeys." },
      { id: "ki_12", diaryId: "diary_mk01_y3", topic: "Marketing data pipeline — Segment + BigQuery", type: "DOCUMENT", durationMins: 60, notes: "Updated technical documentation for Segment events schema." },
    ],
    ktloResolvedCount: 8, ktloNotes: "Weekly maintenance: campaign queue audit, bounce rate review, DKIM/DMARC check, suppression list sync, link tracker health check.",
    newTaskCount: 0,
    hasBlockers: false,
    generalNotes: "Full maintenance day — no incidents, excellent KT progress at 65%. Campaign pipeline docs updated. Suppression list sync was overdue — now current.",
    reviewNotes: "Best KT day this sprint. Documentation is excellent — share with wider team.",
  }),

  // ── 4 DAYS AGO ──────────────────────────────────────────────────────────

  makeDiary("diary_bp08_y4", "u_bp_08", "proj_browse", daysAgo(4), "NIGHT", "REVIEWED", {
    incidentCount: 0, incidentNotes: "No incidents — very quiet shift.",
    ktSessionsCount: 2, ktProgressPercent: 25, ktNotes: "First KT sessions — system overview and architecture walkthrough.",
    ktItems: [
      { id: "ki_13", diaryId: "diary_bp08_y4", topic: "Browse + Profile system architecture overview", type: "SESSION", durationMins: 90, notes: "High-level walkthrough of all 6 services: browse-api, search, profile, recommendations, product-detail, CDN config." },
      { id: "ki_14", diaryId: "diary_bp08_y4", topic: "Monitoring & alerting stack (Grafana/PagerDuty)", type: "SESSION", durationMins: 60, notes: "Covered all critical dashboards and alert policies." },
    ],
    ktloResolvedCount: 5, ktloNotes: "Nightly routines — health checks, log review, certificate audit, backup verification.",
    newTaskCount: 0,
    hasBlockers: false,
    generalNotes: "Quiet first-week shift — used the time well for KT. Architecture overview done. Will cover deep-dive on search and ES next session.",
    reviewNotes: "Good start. KT plan is well-structured.",
  }),

  makeDiary("diary_pc05_y4", "u_pc_05", "proj_payment_core", daysAgo(4), "NIGHT", "SUBMITTED", {
    incidentCount: 3, incidentNotes: "3 incidents — 1 P1 payment failure, 2 P4 infra.",
    incidents: [
      { id: "di_19", diaryId: "diary_pc05_y4", title: "P1 — Payment gateway timeout (Stripe + PayPal)", source: "PAGERDUTY", severity: "P1_CRITICAL", externalRef: "PD-E5F6G7", wasResolved: true, notes: "Both payment gateways timing out simultaneously. Root cause: network ACL rule applied incorrectly by infra team blocked egress to payment provider IPs. Reverted ACL. Full resolution in 18 mins." },
      { id: "di_20", diaryId: "diary_pc05_y4", title: "DB read replica lag spike (P4)", source: "PAGERDUTY", severity: "P4_LOW", externalRef: null, wasResolved: true, notes: "Replica lag spiked to 8s during P1 incident — self-healed post-resolution." },
      { id: "di_21", diaryId: "diary_pc05_y4", title: "Payment webhook delivery delay (P4)", source: "SERVICENOW", severity: "P4_LOW", externalRef: "INC0095500", wasResolved: true, notes: "Queue backup during P1 incident. Cleared within 10 mins post-resolution." },
    ],
    ktSessionsCount: 0, ktProgressPercent: 60, ktNotes: "No KT today — P1 consumed first 2 hours of shift.",
    ktloResolvedCount: 3, ktloNotes: "ACL audit post-P1, mandatory SNOW update, payment queue verification.",
    newTaskCount: 3, newTaskNotes: "P1 post-mortem tasks — ACL change management, dual-gateway monitoring, post-incident report.",
    tasks: [
      { id: "dt_14", diaryId: "diary_pc05_y4", title: "P1 Post-mortem: Payment gateway ACL change", priority: "HIGH", dueDate: new Date(Date.now() + 1 * 86400000), notes: "Root cause and prevention plan required." },
      { id: "dt_15", diaryId: "diary_pc05_y4", title: "Implement dual-gateway health monitoring alert", priority: "HIGH", dueDate: new Date(Date.now() + 3 * 86400000), notes: "Current monitoring did not flag the ACL issue fast enough." },
      { id: "dt_16", diaryId: "diary_pc05_y4", title: "Write P1 incident report for GAPINC", priority: "HIGH", dueDate: new Date(Date.now() + 1 * 86400000), notes: "Required within 24h per SLA policy." },
    ],
    hasBlockers: false,
    generalNotes: "Very stressful shift due to P1. Resolved in 18 mins which is within SLA. Root cause was infra team applying wrong ACL rule. 3 post-mortem tasks opened. Will need morning lead to chase infra team on ACL change management process.",
  }),
];

// ── Helper: get today's diary for a specific user ─────────────────────────
export function getTodayDiary(userId: string): DailyDiary | undefined {
  const todayStr = new Date().toISOString().slice(0, 10);
  return MOCK_DIARY_ENTRIES.find(
    (d) => d.authorId === userId && d.diaryDate.toISOString().slice(0, 10) === todayStr
  );
}

// ── Get all diaries for a date ────────────────────────────────────────────
export function getDiariesForDate(date: Date): DailyDiary[] {
  const key = date.toISOString().slice(0, 10);
  return MOCK_DIARY_ENTRIES.filter(
    (d) => d.diaryDate.toISOString().slice(0, 10) === key
  );
}

// ── Get all diaries for a project in a date range ────────────────────────
export function getDiariesForProject(
  projectId: string, from: Date, to: Date
): DailyDiary[] {
  return MOCK_DIARY_ENTRIES.filter(
    (d) =>
      d.projectId === projectId &&
      d.diaryDate >= from &&
      d.diaryDate <= to
  );
}
