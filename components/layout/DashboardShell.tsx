"use client";

// DashboardShell — responsive layout shell for all authenticated pages.
// Manages mobile sidebar open/close state. Server layout.tsx passes data as props.

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { AttendanceAlertListener } from "@/components/layout/AttendanceAlertListener";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types";

interface DashboardShellProps {
  user: SessionUser;
  notificationCount: number;
  pendingHandovers: number;
  pendingSwaps: number;
  children: React.ReactNode;
}

function DashboardSkeleton() {
  return (
    <div className="flex h-screen w-full animate-pulse">
      <div className="hidden h-full w-64 bg-gray-100 lg:block" />
      <div className="flex flex-1 flex-col">
        <div className="h-14 w-full bg-gray-50 border-b" />
        <div className="flex-1 bg-gray-50 p-4">
          <div className="mb-4 h-8 w-1/3 rounded-lg bg-gray-200" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardShell({
  user,
  notificationCount,
  pendingHandovers,
  pendingSwaps,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gray-50">

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <div
        className={cn(
          // Mobile: fixed full-height drawer — use dvh so browser chrome is excluded
          "fixed left-0 top-0 z-30 h-[100dvh] transition-transform duration-200 ease-in-out",
          // Desktop: relative, always visible, normal flow
          "lg:relative lg:h-auto lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar
          user={user}
          notificationCount={notificationCount}
          pendingHandovers={pendingHandovers}
          pendingSwaps={pendingSwaps}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* ── Main content area ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <TopBar
          user={user}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Toast alerts */}
        <AttendanceAlertListener role={user.role} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<DashboardSkeleton />}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
