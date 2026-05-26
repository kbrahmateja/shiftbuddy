"use client";

import { Switch } from "@/components/ui/switch";

const CHANNELS = [
  { label: "In-App Notifications",  description: "Show badge counts and notification panel.", enabled: true  },
  { label: "Email Notifications",   description: "Receive handover SLA alerts via email.",    enabled: false },
  { label: "Slack Notifications",   description: "Push updates to your Slack DM.",            enabled: false },
  { label: "MS Teams Notifications",description: "Push updates to your Teams channel.",       enabled: false },
];

export function NotificationChannels() {
  return (
    <section className="rounded-lg border bg-white p-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">Notification Channels</h2>
      {CHANNELS.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-4 py-2 border-b last:border-b-0">
          <div>
            <p className="text-sm font-medium text-gray-800">{item.label}</p>
            <p className="text-xs text-gray-500">{item.description}</p>
          </div>
          <Switch
            checked={item.enabled}
            onCheckedChange={() => {}}
            disabled
          />
        </div>
      ))}
    </section>
  );
}
