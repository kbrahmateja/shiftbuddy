import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { CompileHandoverClient } from "@/components/handover/CompileHandoverClient";

export default async function NewHandoverPage() {
  const user = await getSessionUser();

  if (user?.role !== "LEAD" && user?.role !== "MANAGER") {
    return (
      <div className="p-6 max-w-md">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center space-y-3">
          <p className="text-sm font-medium text-amber-800">
            Only Shift Leads can compile handovers.
          </p>
          <p className="text-xs text-amber-600">
            Submit your shift update from the Handovers page — your lead will compile it.
          </p>
          <Link href="/dashboard/handovers" className="inline-block text-sm text-indigo-600 hover:underline">
            ← Go to Handovers
          </Link>
        </div>
      </div>
    );
  }

  return <CompileHandoverClient user={user!} />;
}
