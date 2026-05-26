# ShiftBuddy — GAPINC / HCL Support Operations Platform

**A production-ready Next.js 14 POC for multi-channel incident ingestion, roster management, and shift handover tracking across global timezone-distributed support teams.**

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Directory Structure](#directory-structure)
3. [Tech Stack](#tech-stack)
4. [User Roles & Permissions Matrix](#user-roles--permissions-matrix)
5. [Multi-Channel Source Attribution](#multi-channel-source-attribution)
6. [Setup & Local Development](#setup--local-development)
7. [Environment Variables](#environment-variables)
8. [Database Setup](#database-setup)
9. [Key Design Decisions](#key-design-decisions)

---

## Architecture Overview

```
GAPINC / HCL Operations
        │
        ▼
┌────────────────────────────────────────────┐
│           ShiftBuddy Dashboard             │
│         (Next.js 14 App Router)            │
│                                            │
│  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Sidebar   │  │   DashboardWorkspace │  │
│  │  (RBAC nav) │  │  (role-conditional)  │  │
│  └─────────────┘  └─────────────────────┘  │
│         │                   │              │
│         ▼                   ▼              │
│  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Server     │  │   DailyLogsFeed     │  │
│  │  Actions    │  │  (multi-channel     │  │
│  │  (Zod +     │  │   badges + filters) │  │
│  │   RBAC)     │  └─────────────────────┘  │
│  └─────────────┘                           │
│         │                                  │
│         ▼                                  │
│  ┌─────────────────────────────────────┐   │
│  │        Prisma ORM → PostgreSQL      │   │
│  └─────────────────────────────────────┘   │
└────────────────────────────────────────────┘
         │
         ▼
  Multi-Channel Sources:
  PagerDuty | ServiceNow | Slack | MS Teams | Verbal
```

---

## Directory Structure

```
shiftbuddy/
│
├── prisma/
│   └── schema.prisma              ← Full DB schema (enums + all models)
│
├── app/
│   ├── (auth)/
│   │   ├── signin/
│   │   │   └── page.tsx           ← Sign-in page
│   │   └── signout/
│   │       └── route.ts           ← Sign-out handler
│   │
│   ├── (dashboard)/               ← Route group — all protected routes
│   │   ├── layout.tsx             ← RBAC layout: sidebar + topbar + auth gate
│   │   ├── page.tsx               ← /dashboard — DashboardWorkspace
│   │   ├── feed/
│   │   │   └── page.tsx           ← /dashboard/feed — DailyLogsFeed full page
│   │   ├── log-update/
│   │   │   └── page.tsx           ← /dashboard/log-update — Log entry form
│   │   ├── shifts/
│   │   │   └── page.tsx           ← /dashboard/shifts — User's shift calendar
│   │   ├── handovers/
│   │   │   ├── page.tsx           ← /dashboard/handovers — Handover list
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx       ← Handover detail + acknowledge / dispute
│   │   │   └── new/
│   │   │       └── page.tsx       ← Initiate new handover (LEAD / MANAGER)
│   │   ├── swaps/
│   │   │   └── page.tsx           ← /dashboard/swaps — Swap requests
│   │   ├── roster/
│   │   │   ├── page.tsx           ← /dashboard/roster — ShiftRosterGrid (MANAGER)
│   │   │   └── new/
│   │   │       └── page.tsx       ← Create/edit roster entries
│   │   ├── analytics/
│   │   │   └── page.tsx           ← /dashboard/analytics (LEAD / MANAGER / GAP)
│   │   ├── sla/
│   │   │   └── page.tsx           ← /dashboard/sla (MANAGER / GAP)
│   │   ├── projects/
│   │   │   └── page.tsx           ← /dashboard/projects
│   │   ├── team/
│   │   │   └── page.tsx           ← /dashboard/team (MANAGER only)
│   │   ├── notifications/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   │
│   ├── actions/                   ← Next.js Server Actions
│   │   ├── log-update.ts          ← logDailyUpdate + validateLog (Zod + RBAC)
│   │   └── handover.ts            ← executeHandover, acknowledgeHandover,
│   │                                  disputeHandover, swap CRUD
│   │
│   ├── api/
│   │   └── webhooks/
│   │       ├── pagerduty/
│   │       │   └── route.ts       ← PagerDuty webhook receiver
│   │       └── servicenow/
│   │           └── route.ts       ← ServiceNow outbound message receiver
│   │
│   ├── globals.css
│   └── layout.tsx                 ← Root layout (fonts, providers)
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx            ← RBAC-aware sidebar with live badge counts
│   │   └── TopBar.tsx             ← Live TZ clock + breadcrumb + role badge
│   │
│   ├── dashboard/
│   │   ├── DashboardWorkspace.tsx ← Master multi-persona view (role switch)
│   │   ├── DailyLogsFeed.tsx      ← Feed with source badges + filter sidebar
│   │   └── ShiftRosterGrid.tsx    ← TZ-aware weekly roster calendar
│   │
│   ├── forms/
│   │   ├── LogUpdateForm.tsx      ← Controlled form wired to logDailyUpdate action
│   │   ├── HandoverForm.tsx       ← Handover compilation form
│   │   └── ShiftSwapForm.tsx      ← Swap request form
│   │
│   └── ui/                        ← Shadcn UI primitives (auto-generated)
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── collapsible.tsx
│       ├── input.tsx
│       ├── progress.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       ├── tabs.tsx
│       └── tooltip.tsx
│
├── lib/
│   ├── auth.ts                    ← Session resolution + requireRole + AuthError
│   └── utils.ts                   ← Source/severity configs, TZ utils, RBAC helpers,
│                                     nav builder, Markdown export
│
├── types/
│   └── index.ts                   ← All domain types, enums, form payloads,
│                                     analytics aggregates, ActionResult<T>
│
├── .env.local                     ← (gitignored) local environment variables
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server Components + Server Actions |
| Language | TypeScript (strict) | `"strict": true` in tsconfig |
| Styling | Tailwind CSS v3 | JIT, custom color extensions |
| Components | Shadcn UI | Radix UI primitives, fully unstyled base |
| Icons | Lucide React | Consistent icon library |
| ORM | Prisma 5 | Type-safe DB access |
| Database | PostgreSQL 16 | Target; can use Neon/Supabase for hosted |
| Auth | NextAuth.js v5 (Auth.js) | Wire up in lib/auth.ts |
| Validation | Zod | Schema validation in all Server Actions |

---

## User Roles & Permissions Matrix

| Capability | Contractor | Employee (FTE) | Shift Lead | Manager | GAPINC |
|---|---|---|---|---|---|
| Log daily updates | ✅ | ✅ | ✅ | ✅ | ❌ |
| View own shift | ✅ | ✅ | ✅ | ✅ | ❌ |
| Request shift swap | ✅ | ✅ | ✅ | ❌ | ❌ |
| Approve/reject swaps | ❌ | ❌ | ✅ | ✅ | ❌ |
| Validate log entries | ❌ | ❌ | ✅ | ✅ | ❌ |
| Execute handover | ❌ | ❌ | ✅ | ✅ | ❌ |
| Acknowledge handover | ❌ | ❌ | ✅ | ✅ | ❌ |
| Manage roster | ❌ | ❌ | ❌ | ✅ | ❌ |
| View analytics | ❌ | ❌ | ✅ | ✅ | ✅ |
| Export reports | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage users/teams | ❌ | ❌ | ❌ | ✅ | ❌ |

---

## Multi-Channel Source Attribution

Every `DailyUpdateLog` record carries a mandatory `source` field. The system enforces source-specific external reference validation:

| Source | Badge Color | Required Field | Format |
|---|---|---|---|
| `PAGERDUTY` | Purple | `pagerDutyRef` | 7-char ID `P1A2B3C` or full PD incident URL |
| `SERVICENOW` | Emerald/Green | `snowTicketId` | `INC\|CHG\|RITM\|TASK` + 7 digits |
| `SLACK` | Sky Blue | `slackMessageUrl` | Valid HTTPS URL |
| `TEAMS` | Indigo | `teamsMessageUrl` | Valid HTTPS URL |
| `VERBAL` | Amber | *(none required)* | Free text description only |
| `OTHER` | Gray | *(none required)* | Free text description only |

P1 Critical incidents additionally require either a `snowTicketId` **or** a `pagerDutyRef` regardless of source.

---

## Setup & Local Development

### Prerequisites

- Node.js 20+
- pnpm (recommended) or npm
- PostgreSQL 16 running locally or a hosted connection string

### 1. Clone & install

```bash
git clone <repo-url>
cd shiftbuddy
pnpm install
```

### 2. Install Shadcn UI components

```bash
pnpm dlx shadcn-ui@latest init
pnpm dlx shadcn-ui@latest add badge button card collapsible input \
  progress select separator sheet tabs tooltip
```

### 3. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local — see Environment Variables section below
```

### 4. Set up the database

```bash
pnpm prisma generate        # generate the Prisma client
pnpm prisma migrate dev      # apply migrations + seed
```

### 5. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The app will redirect to `/dashboard`. Set the `demo_role` cookie to switch personas:

```
demo_role=CONTRACTOR | EMPLOYEE | LEAD | MANAGER | GAP_STAKEHOLDER
```

---

## Environment Variables

```env
# .env.local

# ── Database ──
DATABASE_URL="postgresql://user:password@localhost:5432/shiftbuddy"

# ── NextAuth.js ──
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-32-char-secret-here"

# ── OAuth (example: Azure AD for GAPINC/HCL SSO) ──
AZURE_AD_CLIENT_ID=""
AZURE_AD_CLIENT_SECRET=""
AZURE_AD_TENANT_ID=""

# ── PagerDuty Webhook ──
PAGERDUTY_WEBHOOK_SECRET=""

# ── ServiceNow Outbound ──
SNOW_WEBHOOK_SECRET=""

# ── Optional: Slack notifications ──
SLACK_BOT_TOKEN=""
SLACK_CHANNEL_ID=""
```

---

## Database Setup

```bash
# Initial migration
pnpm prisma migrate dev --name init

# Seed demo data (create seed.ts in prisma/seed.ts)
pnpm prisma db seed

# Reset and reseed
pnpm prisma migrate reset

# View your data
pnpm prisma studio
```

---

## Key Design Decisions

**1. Mandatory Source Attribution** — Every log entry requires a `source` enum field. Server Action validation (`superRefine` in Zod) enforces source-specific external ID formats at the API boundary so no log can exist without a traceable origin.

**2. UTC-First Timezones** — All `DateTime` fields in Prisma store UTC. The display layer uses `Intl.DateTimeFormat` with the user's or shift's IANA timezone string for rendering. The roster grid lets any viewer switch the reference timezone independently.

**3. RBAC at the Server Action layer** — The `requireRole()` helper throws `AuthError` at the start of every mutating action. The client never receives capability booleans it could spoof — the server unconditionally re-checks role before any write.

**4. GAP_STAKEHOLDER immutability** — The `modifyStakeholderDashboard` action unconditionally returns an error regardless of session, making the read-only contract enforceable in code (not just in the UI).

**5. Audit Trail** — Every state-changing action writes to `AuditLog` with before/after JSON snapshots, actor ID, and timestamp. This gives GAPINC a tamper-evident record for compliance reviews.

**6. Handover SLA** — `ShiftHandover.dueBy` is set to 30 minutes after submission. A background job (e.g., Vercel Cron) can query `status = SUBMITTED AND dueBy < NOW()` and trigger escalation notifications to the manager.
