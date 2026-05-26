"use client";

import { useRouter } from "next/navigation";

const ROLES = ["CONTRACTOR", "EMPLOYEE", "LEAD", "MANAGER", "GAP_STAKEHOLDER"] as const;

export function RoleSwitcher({ currentRole }: { currentRole: string }) {
  const router = useRouter();

  function switchRole(role: string) {
    document.cookie = `demo_role=${role}; path=/; max-age=86400`;
    window.location.reload();
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 space-y-3">
      <h2 className="text-sm font-semibold text-amber-800">POC Role Switcher</h2>
      <p className="text-xs text-amber-700">
        Click a role to switch persona instantly. In production this is replaced by OAuth/SAML.
      </p>
      <div className="flex flex-wrap gap-2">
        {ROLES.map((role) => {
          const active = role === currentRole;
          return (
            <button
              key={role}
              onClick={() => switchRole(role)}
              className={`rounded-md border px-3 py-1.5 text-xs font-mono transition-all ${
                active
                  ? "border-amber-500 bg-amber-300 text-amber-900 font-bold cursor-default"
                  : "border-amber-300 bg-white text-amber-700 hover:bg-amber-100 hover:border-amber-400 cursor-pointer"
              }`}
            >
              {active ? "✓ " : ""}{role}
            </button>
          );
        })}
      </div>
      {currentRole && (
        <p className="text-xs text-amber-600">
          Currently viewing as <strong>{currentRole}</strong>.
        </p>
      )}
    </section>
  );
}
