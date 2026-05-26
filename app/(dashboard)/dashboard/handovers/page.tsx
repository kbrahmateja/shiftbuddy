export const runtime = 'edge';

import { getSessionUser } from "@/lib/auth";
import { HandoversClient } from "@/components/handover/HandoversClient";

export default async function HandoversPage() {
  const user = await getSessionUser();
  return <HandoversClient user={user!} />;
}
