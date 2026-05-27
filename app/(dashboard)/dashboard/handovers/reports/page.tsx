export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { HandoverReportsClient } from "@/components/handover/HandoverReportsClient";

export default async function HandoverReportsPage() {
  const user = await getSessionUser();
  if (user?.role !== "MANAGER" && user?.role !== "LEAD") {
    redirect("/dashboard?error=unauthorized");
  }
  return <HandoverReportsClient />;
}
