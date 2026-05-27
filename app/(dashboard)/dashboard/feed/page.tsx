export const runtime = 'edge';

import { getSessionUser } from "@/lib/auth";
import { MOCK_LOGS } from "@/lib/mock-data";
import { FeedTabs } from "@/components/feed/FeedTabs";
import { PageShell } from "@/components/layout/PageShell";

export default async function FeedPage() {
  const user = await getSessionUser();
  return (
    <PageShell
      title="Daily Feed"
      subtitle="All shift update logs across your active projects."
      maxWidth="max-w-full"
      noPadding={false}
    >
      <div className="flex-1 overflow-hidden -mx-4 sm:-mx-6">
        <FeedTabs logs={MOCK_LOGS} userRole={user!.role} />
      </div>
    </PageShell>
  );
}
