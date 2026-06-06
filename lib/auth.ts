// lib/auth.ts
// ─────────────────────────────────────────────────────────────
// Session resolution helpers.
// In production, wire this to NextAuth.js / Auth.js with a
// database adapter. The stub below returns a typed SessionUser
// so the rest of the codebase has a concrete shape to depend on.
// ─────────────────────────────────────────────────────────────

import { cookies } from "next/headers";
import type { SessionUser, UserRole } from "@/types";

/**
 * Resolves the current server-side session from the cookie store.
 * Returns null if unauthenticated.
 *
 * Production implementation: replace body with:
 *   const session = await getServerSession(authOptions);
 *   if (!session?.user) return null;
 *   return mapSessionToUser(session.user);
 */
/** Role → demo persona mapping for POC role-switching */
const DEMO_PERSONAS: Record<UserRole, SessionUser> = {
  CONTRACTOR: {
    id: "u_bp_09",
    email: "kiran.mehta@yci.com",
    name: "Kiran Mehta",
    role: "CONTRACTOR",
    timezone: "Asia/Kolkata",
    avatarUrl: null,
    activeProjectId: "proj_browse",
    activePartnerTeamId: null,
  },
  EMPLOYEE: {
    id: "u_bp_08",
    email: "rahul.kapoor@yci.com",
    name: "Rahul Kapoor",
    role: "EMPLOYEE",
    timezone: "Asia/Kolkata",
    avatarUrl: null,
    activeProjectId: "proj_browse",
    activePartnerTeamId: null,
  },
  LEAD: {
    id: "u_bp_06",
    email: "vikram.nair@yci.com",
    name: "Vikram Nair",
    role: "LEAD",
    timezone: "Asia/Kolkata",
    avatarUrl: null,
    activeProjectId: "proj_browse",
    activePartnerTeamId: null,
  },
  MANAGER: {
    id: "user_mgr_001",
    email: "vikram.singh@yci.com",
    name: "Vikram Singh",
    role: "MANAGER",
    timezone: "Asia/Kolkata",
    avatarUrl: null,
    activeProjectId: null,
    activePartnerTeamId: null,
  },
  GAP_STAKEHOLDER: {
    id: "user_gap_001",
    email: "sarah.mitchell@corp.com",
    name: "Sarah Mitchell",
    role: "GAP_STAKEHOLDER",
    timezone: "America/Los_Angeles",
    avatarUrl: null,
    activeProjectId: null,
    activePartnerTeamId: null,
  },
};

export async function getSessionUser(): Promise<SessionUser | null> {
  // ── POC STUB: read a "demo_role" cookie to simulate role switching ──
  const cookieStore = await cookies();
  const demoRole = (cookieStore.get("demo_role")?.value ?? "LEAD") as UserRole;
  return DEMO_PERSONAS[demoRole] ?? DEMO_PERSONAS.LEAD;
}

/**
 * Server-side role assertion.
 * Throws a structured error that Server Actions can catch and surface.
 */
export async function requireRole(
  allowedRoles: UserRole[],
  actionLabel: string
): Promise<SessionUser> {
  const session = await getSessionUser();

  if (!session) {
    throw new AuthError("UNAUTHENTICATED", "You must be signed in to perform this action.");
  }

  if (!allowedRoles.includes(session.role)) {
    throw new AuthError(
      "UNAUTHORIZED",
      `Role "${session.role}" is not permitted to "${actionLabel}". ` +
        `Required: ${allowedRoles.join(" | ")}.`
    );
  }

  return session;
}

/**
 * Structured auth error that Server Actions re-throw as ActionResult failures.
 */
export class AuthError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "UNAUTHORIZED",
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}
