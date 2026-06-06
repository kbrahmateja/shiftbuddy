// lib/shift-roster.ts
// ─────────────────────────────────────────────────────────────
// Helpers to derive shift member lists and determine the
// current / next shift from wall-clock time.
// Used by HandoverAttendanceSheet.
// ─────────────────────────────────────────────────────────────

export type ShiftCode = "Shift1" | "Shift2" | "Shift3";

export const SHIFT_LABELS: Record<ShiftCode, string> = {
  Shift1: "Morning  (05:30 – 13:30)",
  Shift2: "Afternoon (13:30 – 21:30)",
  Shift3: "Night    (21:30 – 05:30)",
};

export const SHIFT_SHORT: Record<ShiftCode, string> = {
  Shift1: "S1 · Morning",
  Shift2: "S2 · Afternoon",
  Shift3: "S3 · Night",
};

export const NEXT_SHIFT: Record<ShiftCode, ShiftCode> = {
  Shift1: "Shift2",
  Shift2: "Shift3",
  Shift3: "Shift1",
};

// ── Member data ──────────────────────────────────────────────

export interface ShiftMember {
  userId: string;
  name: string;
  displayName: string;
  email: string;
  role: "EMPLOYEE" | "LEAD" | "CONTRACTOR";
  projectId: string;
  projectName: string;
  shift: ShiftCode;
}

const PROJECT_NAMES: Record<string, string> = {
  proj_checkout:     "Checkout + Bag",
  proj_payment_core: "Payment Core",
  proj_browse:       "Browse + Profile",
  proj_buyui:        "Buy UI",
  proj_webapp:       "PT-WebApp",
  proj_dam:          "DAM",
  proj_marketing:    "PT-Marketing",
};

// Mirrors EMPLOYEE_DEFS in mock-data.ts — only Shift1/Shift2/Shift3 included
const RAW_MEMBERS: [string, string, string, string, ShiftCode, "EMPLOYEE" | "LEAD" | "CONTRACTOR"][] = [
  // Checkout
  ["u_ck_01", "Sneha Bhatia",          "sneha.bhatia@yci.com",        "proj_checkout",     "Shift1", "EMPLOYEE"],
  ["u_ck_02", "Meena Iyer",             "meena.iyer@yci.com",           "proj_checkout",     "Shift1", "EMPLOYEE"],
  ["u_ck_03", "Rajesh Nair",            "rajesh.nair@yci.com",          "proj_checkout",     "Shift2", "EMPLOYEE"],
  ["u_ck_04", "Abhishek Pawar",        "abhishek.pawar@yci.com",      "proj_checkout",     "Shift2", "EMPLOYEE"],
  ["u_ck_05", "Kavitha Reddy",            "kavitha.reddy@yci.com",         "proj_checkout",     "Shift3", "LEAD"],
  ["u_ck_06", "Shiv Rathod",           "shiv.rathod@yci.com",         "proj_checkout",     "Shift3", "EMPLOYEE"],
  // Payment Core
  ["u_pc_01", "Arjun Sharma",             "arjun.sharma@yci.com",           "proj_payment_core", "Shift1", "LEAD"],    // temp lead
  ["u_pc_02", "Rahul Syal",             "rahul.syal@yci.com",           "proj_payment_core", "Shift1", "EMPLOYEE"],
  ["u_pc_03", "Sanjay Jadhav",         "sanjay.jadhav@yci.com",       "proj_payment_core", "Shift2", "EMPLOYEE"],
  ["u_pc_04", "Amit Tiwari",             "amit.tiwari@yci.com",           "proj_payment_core", "Shift2", "EMPLOYEE"],
  ["u_pc_05", "Naveen Koduri",  "naveen.koduri@yci.com",     "proj_payment_core", "Shift3", "EMPLOYEE"],
  ["u_pc_06", "Karthik Gupta",         "karthik.gupta@yci.com",       "proj_payment_core", "Shift3", "EMPLOYEE"],
  // Browse + Profile
  ["u_bp_01", "Rohit Anand",             "rohit.anand@yci.com",           "proj_browse",       "Shift1", "EMPLOYEE"],
  ["u_bp_02", "Sandeep Sharma",    "sandeep.sharma@yci.com",        "proj_browse",       "Shift1", "EMPLOYEE"],
  ["u_bp_03", "Amit Singh",             "amit.singh@yci.com",           "proj_browse",       "Shift2", "EMPLOYEE"],
  ["u_bp_04", "Debraj Roy",           "debraj.roy@yci.com",         "proj_browse",       "Shift2", "EMPLOYEE"],
  ["u_bp_05", "Vijay Kiran",         "vijay.kiran@yci.com",           "proj_browse",       "Shift2", "EMPLOYEE"],
  ["u_bp_06", "Vikram Nair",         "vikram.nair@yci.com",       "proj_browse",       "Shift2", "LEAD"],
  ["u_bp_07", "Ravi Pillai",       "ravi.pillai@yci.com",     "proj_browse",       "Shift3", "EMPLOYEE"],
  ["u_bp_08", "Rahul Kapoor", "rahul.kapoor@yci.com",          "proj_browse",       "Shift3", "EMPLOYEE"],
  ["u_bp_09", "Kiran Mehta",     "kiran.mehta@yci.com",   "proj_browse",       "Shift3", "CONTRACTOR"],
  ["u_bp_10", "Kartik Sharma",          "kartik.sharma@yci.com",        "proj_browse",       "Shift1", "EMPLOYEE"],
  // Buy UI
  ["u_bu_01", "Aradhana Verma",    "aradhana.verma@yci.com",  "proj_buyui",        "Shift1", "EMPLOYEE"],
  ["u_bu_02", "Pratik Tiwari",  "pratik.tiwari@yci.com",            "proj_buyui",        "Shift1", "EMPLOYEE"],
  ["u_bu_03", "Dinesh Arora",         "dinesh.arora@yci.com",       "proj_buyui",        "Shift1", "EMPLOYEE"],
  ["u_bu_04", "Priyanka Pandey",              "priyanka.pandey@yci.com",            "proj_buyui",        "Shift2", "EMPLOYEE"],
  ["u_bu_05", "Sravani Puri",          "sravani.puri@yci.com",        "proj_buyui",        "Shift2", "EMPLOYEE"],
  ["u_bu_06", "Mahesh Naik",        "mahesh.naik@yci.com",      "proj_buyui",        "Shift2", "EMPLOYEE"],
  ["u_bu_07", "Vinod Kumar",  "vinod.kumar@yci.com",      "proj_buyui",        "Shift3", "EMPLOYEE"],
  ["u_bu_08", "Pavan Shaikh",        "pavan.shaikh@yci.com",      "proj_buyui",        "Shift3", "EMPLOYEE"],
  ["u_bu_09", "Uday Prasad",          "uday.prasad@yci.com",        "proj_buyui",        "Shift3", "EMPLOYEE"],
  // PT-WebApp
  ["u_wa_01", "Sai Narayana",     "sai.narayana@yci.com",             "proj_webapp",       "Shift1", "EMPLOYEE"],
  ["u_wa_02", "Bharat Reddy", "bharat.reddy@yci.com",           "proj_webapp",       "Shift2", "EMPLOYEE"],
  ["u_wa_03", "Neelan Kumar",              "neelan.kumar@yci.com",            "proj_webapp",       "Shift2", "EMPLOYEE"],
  ["u_wa_04", "Aryan Shaikh",       "aryan.shaikh@yci.com",         "proj_webapp",       "Shift2", "EMPLOYEE"],
  ["u_wa_05", "Ramesh Yadav",       "ramesh.yadav@yci.com",     "proj_webapp",       "Shift3", "EMPLOYEE"],
  // DAM
  ["u_dm_05", "Manish Kapoor",            "manish.kapoor@yci.com",          "proj_dam",          "Shift1", "EMPLOYEE"],
  ["u_dm_01", "Prasad Varma",  "prasad.varma@yci.com",            "proj_dam",          "Shift3", "EMPLOYEE"],
];

export const ALL_SHIFT_MEMBERS: ShiftMember[] = RAW_MEMBERS.map(
  ([userId, name, email, projectId, shift, role]) => ({
    userId,
    name,
    displayName: name.split(" ").slice(0, 2).join(" "),
    email,
    role,
    projectId,
    projectName: PROJECT_NAMES[projectId] ?? projectId,
    shift,
  })
);

/** Get all members scheduled for a given shift */
export function getShiftMembers(shift: ShiftCode): ShiftMember[] {
  return ALL_SHIFT_MEMBERS.filter((m) => m.shift === shift);
}

/**
 * Determine the current shift code from wall-clock IST time.
 * S1 Morning:   05:30 – 13:29
 * S2 Afternoon: 13:30 – 21:29
 * S3 Night:     21:30 – 05:29
 */
export function getCurrentShiftCode(tz = "Asia/Kolkata"): ShiftCode {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
  const t = h * 60 + m;
  if (t >= 330 && t < 810)  return "Shift1"; // 05:30–13:30
  if (t >= 810 && t < 1290) return "Shift2"; // 13:30–21:30
  return "Shift3";                            // 21:30–05:30
}
