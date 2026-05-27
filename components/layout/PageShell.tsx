// components/layout/PageShell.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Universal page template. Every page component should wrap its content in
// <PageShell>. This gives:
//   • Responsive padding  (px-4 py-4 → sm:px-6 sm:py-6)
//   • Max-width container (default max-w-6xl, override via `maxWidth`)
//   • Standard header row  (title + optional subtitle + back link + actions)
//   • Optional extra header slot (tabs, filters, pickers)
//   • Full-bleed mode (noPadding)
//
// Usage:
//   <PageShell title="Analytics" subtitle="KPIs for your shift org"
//              actions={<ExportButton />}>
//     <StatCards />
//     <Charts />
//   </PageShell>
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { cn } from "@/lib/utils";

interface PageShellProps {
  title: string;
  subtitle?: string;
  /** Back-link rendered above the title */
  back?: { href: string; label: string };
  /** Rendered on the right of the title row (buttons, pickers, …) */
  actions?: React.ReactNode;
  /** Rendered below the title row (tabs, period selectors, filter bars) */
  headerExtra?: React.ReactNode;
  /** Controls the max-width of the content area */
  maxWidth?: "max-w-4xl" | "max-w-5xl" | "max-w-6xl" | "max-w-7xl" | "max-w-full";
  /** When true, removes horizontal/vertical padding from the content area */
  noPadding?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function PageShell({
  title,
  subtitle,
  back,
  actions,
  headerExtra,
  maxWidth = "max-w-6xl",
  noPadding = false,
  className,
  children,
}: PageShellProps) {
  return (
    <div className={cn("w-full", !noPadding && "px-4 py-4 sm:px-6 sm:py-6", maxWidth !== "max-w-full" && "mx-auto", maxWidth, className)}>

      {/* ── Page Header ── */}
      <div className="mb-5 sm:mb-6">
        {back && (
          <Link
            href={back.href}
            className="mb-1.5 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
          >
            ← {back.label}
          </Link>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{title}</h1>
            {subtitle && (
              <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>

          {actions && (
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>

        {headerExtra && (
          <div className="mt-4">
            {headerExtra}
          </div>
        )}
      </div>

      {/* ── Page Content ── */}
      {children}
    </div>
  );
}
