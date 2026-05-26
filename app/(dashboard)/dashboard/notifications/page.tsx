"use client";

export const runtime = 'edge';

import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, ArrowLeftRight, Clock, LogIn, LogOut } from "lucide-react";
import { getAttendanceNotifications, type AttendanceNotification } from "@/lib/attendance";

// ── Static mock notifications ─────────────────────────────────────────────────

const STATIC_NOTIFICATIONS = [
  {
    id: "n1",
    type: "HANDOVER",
    Icon: Clock,
    iconColor: "text-yellow-600",
    iconBg: "bg-yellow-100",
    title: "Handover awaiting acknowledgement",
    body: "Arjun Sharma submitted a handover. You have 5 minutes to acknowledge.",
    isRead: false,
    time: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: "n2",
    type: "INCIDENT",
    Icon: AlertCircle,
    iconColor: "text-red-600",
    iconBg: "bg-red-100",
    title: "P1 incident escalated",
    body: "Payment service timeout — Stripe webhook failures escalated to GAPINC.",
    isRead: false,
    time: new Date(Date.now() - 60 * 60 * 1000),
  },
  {
    id: "n3",
    type: "SWAP",
    Icon: ArrowLeftRight,
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-100",
    title: "Shift swap request",
    body: "Chaitanya Addepalli requested a shift swap with Dipak Rahangadale for Saturday.",
    isRead: false,
    time: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "n4",
    type: "RESOLVED",
    Icon: CheckCircle2,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-100",
    title: "Incident resolved",
    body: "SSL certificate renewal completed and validated.",
    isRead: true,
    time: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function attNotifToDisplay(n: AttendanceNotification) {
  const isIn = n.event === "CLOCK_IN";
  return {
    id: n.id,
    type: n.event,
    Icon: isIn ? LogIn : LogOut,
    iconColor: isIn ? "text-emerald-600" : "text-red-600",
    iconBg: isIn ? "bg-emerald-100" : "bg-red-100",
    title: isIn ? `${n.userName} clocked in` : `${n.userName} clocked out`,
    body: `${n.projectName}${n.duration ? ` · Duration: ${n.duration}` : ""}`,
    isRead: false,
    time: new Date(n.time),
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [attNotifs, setAttNotifs] = useState<ReturnType<typeof attNotifToDisplay>[]>([]);

  useEffect(() => {
    const load = () =>
      setAttNotifs(getAttendanceNotifications().map(attNotifToDisplay));
    load();
    window.addEventListener("sb:clock-in", load);
    window.addEventListener("sb:clock-out", load);
    return () => {
      window.removeEventListener("sb:clock-in", load);
      window.removeEventListener("sb:clock-out", load);
    };
  }, []);

  const all = [...attNotifs, ...STATIC_NOTIFICATIONS].sort(
    (a, b) => b.time.getTime() - a.time.getTime()
  );
  const unread = all.filter((n) => !n.isRead).length;

  return (
    <div className="p-6 max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {unread} unread notification{unread !== 1 ? "s" : ""}.
          </p>
        </div>
        <button
          disabled
          className="text-xs text-indigo-600 hover:underline opacity-60 cursor-not-allowed"
        >
          Mark all as read
        </button>
      </div>

      <div className="space-y-2">
        {all.map((n) => {
          const Icon = n.Icon;
          return (
            <div
              key={n.id}
              className={`flex gap-4 rounded-lg border p-4 transition-colors ${
                n.isRead
                  ? "bg-white text-gray-500"
                  : "bg-indigo-50 border-indigo-200"
              }`}
            >
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.iconBg}`}
              >
                <Icon className={`h-4 w-4 ${n.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    n.isRead ? "text-gray-600" : "text-gray-900"
                  }`}
                >
                  {n.title}
                  {!n.isRead && (
                    <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-indigo-500 align-middle" />
                  )}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{n.body}</p>
              </div>
              <p className="shrink-0 text-xs text-gray-400">{relativeTime(n.time)}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
        Attendance clock-in/out events appear here in real time.
        Live push notifications require database + WebSocket integration.
      </div>
    </div>
  );
}
