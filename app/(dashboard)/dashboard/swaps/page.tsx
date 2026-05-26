import { getSessionUser } from "@/lib/auth";
import { SwapsClient } from "@/components/swaps/SwapsClient";

export default async function SwapsPage() {
  const user = await getSessionUser();
  return <SwapsClient user={user!} />;
}
