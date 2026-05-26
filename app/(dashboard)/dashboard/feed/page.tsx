export const runtime = 'edge';

import { getSessionUser } from "@/lib/auth";
import { MOCK_LOGS } from "@/lib/mock-data";
import { FeedTabs } from "@/components/feed/FeedTabs";

export default async function FeedPage() {
  const user = await getSessionUser();
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b bg-white">
        <h1 className="text-xl font-bold text-gray-900">Daily Feed</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          All shift update logs across your active projects.
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <FeedTabs logs={MOCK_LOGS} userRole={user!.role} />
      </div>
    </div>
  );
}
