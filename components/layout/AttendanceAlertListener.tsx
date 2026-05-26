"use client";

import { useEffect, useState } from "react";
import type { UserRole } from "@/types";

interface Toast {
  id: string;
  headline: string;
  sub: string;
  type: "CLOCK_IN" | "CLOCK_OUT" | "SWAP_REQUEST";
}

export function AttendanceAlertListener({ role }: { role: UserRole }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (role !== "LEAD" && role !== "MANAGER") return;

    const remove = (id: string) =>
      setToasts((prev) => prev.filter((t) => t.id !== id));

    function onClockIn(e: Event) {
      const { userName, projectName, time } = (e as CustomEvent).detail;
      const timeStr = new Date(time).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const toast: Toast = {
        id: `t_${Date.now()}`,
        headline: `${userName} clocked in`,
        sub: `${projectName} · ${timeStr}`,
        type: "CLOCK_IN",
      };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => remove(toast.id), 7_000);
    }

    function onClockOut(e: Event) {
      const { userName, projectName, duration, time } = (e as CustomEvent).detail;
      const timeStr = new Date(time).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const toast: Toast = {
        id: `t_${Date.now()}`,
        headline: `${userName} clocked out`,
        sub: `${projectName} · ${timeStr}${duration ? ` · ${duration}` : ""}`,
        type: "CLOCK_OUT",
      };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => remove(toast.id), 7_000);
    }

    function onSwapRequest(e: Event) {
      const { requester, recipient } = (e as CustomEvent).detail;
      const toast: Toast = {
        id: `t_${Date.now()}`,
        headline: "Swap request submitted",
        sub: `${requester} → ${recipient}`,
        type: "SWAP_REQUEST",
      };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => remove(toast.id), 7_000);
    }

    window.addEventListener("sb:clock-in",      onClockIn);
    window.addEventListener("sb:clock-out",     onClockOut);
    window.addEventListener("sb:swap-request",  onSwapRequest);
    return () => {
      window.removeEventListener("sb:clock-in",     onClockIn);
      window.removeEventListener("sb:clock-out",    onClockOut);
      window.removeEventListener("sb:swap-request", onSwapRequest);
    };
  }, [role]);

  if (!toasts.length) return null;

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 w-72 shadow-lg
            ${toast.type === "CLOCK_IN"
              ? "bg-emerald-50 border-emerald-200"
              : toast.type === "SWAP_REQUEST"
              ? "bg-indigo-50 border-indigo-200"
              : "bg-red-50 border-red-200"
            }`}
        >
          <span
            className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0
              ${toast.type === "CLOCK_IN"
                ? "bg-emerald-500 animate-pulse"
                : toast.type === "SWAP_REQUEST"
                ? "bg-indigo-500 animate-pulse"
                : "bg-red-500"}`}
          />
          <div>
            <p className={`text-sm font-semibold
              ${toast.type === "CLOCK_IN"
                ? "text-emerald-800"
                : toast.type === "SWAP_REQUEST"
                ? "text-indigo-800"
                : "text-red-800"}`}>
              {toast.headline}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{toast.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
