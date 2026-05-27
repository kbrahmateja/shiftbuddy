"use client";

import { useState, useEffect } from "react";
import { Pencil, X, Check, User, Mail, Globe } from "lucide-react";
import type { UserRole } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SpocInfo   { userId: string; name: string; email: string }
export interface TeamMember { userId: string; name: string; email: string }

export interface ProjectCoverage {
  projectId: string;
  projectName: string;
  shift1: SpocInfo | null;
  shift2: SpocInfo | null;
  shift3: SpocInfo | null;
}

interface GapSme { name: string; email: string; timezone: string }

type ShiftKey    = "shift1" | "shift2" | "shift3";
type GapSmeStore  = Record<string, Partial<Record<ShiftKey, GapSme>>>;
type SpocStore    = Record<string, Partial<Record<ShiftKey, SpocInfo>>>;

const GAP_KEY  = "sb_gap_smes";
const SPOC_KEY = "sb_spoc_overrides";

const GAP_DEFAULTS: GapSmeStore = {
  proj_browse: {
    shift2: { name: "Sarah Mitchell", email: "sarah.mitchell@corp.com", timezone: "America/Los_Angeles (PST)" },
  },
};

const SHIFT_META: Record<ShiftKey, { label: string; time: string; border: string; dot: string }> = {
  shift1: { label: "Shift 1 · Morning",   time: "05:30 – 14:30 IST", border: "border-l-amber-400",  dot: "bg-amber-400"  },
  shift2: { label: "Shift 2 · Afternoon", time: "13:30 – 22:30 IST", border: "border-l-sky-400",    dot: "bg-sky-400"    },
  shift3: { label: "Shift 3 · Night",     time: "21:30 – 06:30 IST", border: "border-l-indigo-400", dot: "bg-indigo-400" },
};

const COMMON_TZ = [
  "America/Los_Angeles (PST)",
  "America/Chicago (CST)",
  "America/New_York (EST)",
  "Europe/London (GMT)",
  "Asia/Kolkata (IST)",
  "Asia/Singapore (SGT)",
];

// ── Component ─────────────────────────────────────────────────────────────────

export function CoverageMatrix({
  projects,
  viewerRole,
  teamMembers,
}: {
  projects: ProjectCoverage[];
  viewerRole: UserRole;
  teamMembers: TeamMember[];
}) {
  const isManager = viewerRole === "MANAGER";

  const [gapStore,  setGapStore]  = useState<GapSmeStore>(GAP_DEFAULTS);
  const [spocStore, setSpocStore] = useState<SpocStore>({});

  // Modal state — one for GAP SME, one for SPOC
  const [editingGap,  setEditingGap]  = useState<{ projectId: string; shift: ShiftKey } | null>(null);
  const [editingSpoc, setEditingSpoc] = useState<{ projectId: string; shift: ShiftKey } | null>(null);
  const [gapForm,  setGapForm]  = useState<GapSme>({ name: "", email: "", timezone: "" });
  const [spocForm, setSpocForm] = useState<SpocInfo>({ userId: "", name: "", email: "" });

  useEffect(() => {
    try {
      const rawGap  = localStorage.getItem(GAP_KEY);
      const rawSpoc = localStorage.getItem(SPOC_KEY);
      if (rawGap) {
        const parsed = JSON.parse(rawGap) as GapSmeStore;
        const merged: GapSmeStore = { ...GAP_DEFAULTS };
        Object.entries(parsed).forEach(([pid, shifts]) => {
          merged[pid] = { ...(merged[pid] ?? {}), ...shifts };
        });
        setGapStore(merged);
      }
      if (rawSpoc) setSpocStore(JSON.parse(rawSpoc) as SpocStore);
    } catch { /* ignore */ }
  }, []);

  // ── GAP SME helpers ──────────────────────────────────────────────────────

  function openEditGap(projectId: string, shift: ShiftKey) {
    setGapForm(gapStore[projectId]?.[shift] ?? { name: "", email: "", timezone: "" });
    setEditingGap({ projectId, shift });
  }

  function saveGap() {
    if (!editingGap) return;
    const updated = {
      ...gapStore,
      [editingGap.projectId]: { ...(gapStore[editingGap.projectId] ?? {}), [editingGap.shift]: { ...gapForm } },
    };
    setGapStore(updated);
    localStorage.setItem(GAP_KEY, JSON.stringify(updated));
    setEditingGap(null);
  }

  function clearGap(projectId: string, shift: ShiftKey) {
    const updated = { ...gapStore, [projectId]: { ...(gapStore[projectId] ?? {}) } };
    delete updated[projectId][shift];
    setGapStore(updated);
    localStorage.setItem(GAP_KEY, JSON.stringify(updated));
  }

  // ── SPOC helpers ─────────────────────────────────────────────────────────

  function openEditSpoc(projectId: string, shift: ShiftKey, current: SpocInfo | null) {
    const override = spocStore[projectId]?.[shift];
    const active   = override ?? current;
    setSpocForm(active ?? { userId: teamMembers[0]?.userId ?? "", name: "", email: "" });
    setEditingSpoc({ projectId, shift });
  }

  function handleSpocSelect(userId: string) {
    const member = teamMembers.find((m) => m.userId === userId);
    if (member) setSpocForm({ userId: member.userId, name: member.name, email: member.email });
  }

  function saveSpoc() {
    if (!editingSpoc || !spocForm.userId) return;
    const updated = {
      ...spocStore,
      [editingSpoc.projectId]: { ...(spocStore[editingSpoc.projectId] ?? {}), [editingSpoc.shift]: { ...spocForm } },
    };
    setSpocStore(updated);
    localStorage.setItem(SPOC_KEY, JSON.stringify(updated));
    setEditingSpoc(null);
  }

  function clearSpoc(projectId: string, shift: ShiftKey) {
    const updated = { ...spocStore, [projectId]: { ...(spocStore[projectId] ?? {}) } };
    delete updated[projectId][shift];
    setSpocStore(updated);
    localStorage.setItem(SPOC_KEY, JSON.stringify(updated));
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {projects.map((proj) => (
        <div key={proj.projectId} className="rounded-xl border bg-white shadow-sm overflow-hidden">
          {/* Project header */}
          <div className="border-b bg-gray-50 px-5 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">{proj.projectName}</h2>
            <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">
              {proj.projectId.replace("proj_", "")}
            </span>
          </div>

          {/* Shift rows */}
          <div className="divide-y">
            {(["shift1", "shift2", "shift3"] as ShiftKey[]).map((shiftKey) => {
              const meta         = SHIFT_META[shiftKey];
              const defaultSpoc  = proj[shiftKey];
              const spocOverride = spocStore[proj.projectId]?.[shiftKey];
              const spoc         = spocOverride ?? defaultSpoc;
              const sme          = gapStore[proj.projectId]?.[shiftKey];
              const isOverridden = !!spocOverride;

              return (
                <div key={shiftKey} className={`border-l-4 ${meta.border} grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x`}>

                  {/* ── HCL SPOC ── */}
                  <div className="flex items-start gap-3 px-5 py-4">
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${meta.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-semibold text-gray-500">
                          {meta.label}
                          <span className="ml-1.5 font-normal text-gray-400">· {meta.time}</span>
                          <span className="ml-2 font-medium text-[10px] uppercase tracking-wide text-gray-400">HCL SPOC</span>
                          {isOverridden && (
                            <span className="ml-1.5 text-[10px] text-indigo-500 font-medium">· updated</span>
                          )}
                        </p>
                        {isManager && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openEditSpoc(proj.projectId, shiftKey, defaultSpoc)}
                              className="text-gray-400 hover:text-indigo-600 transition-colors"
                              title="Change SPOC"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {isOverridden && (
                              <button
                                onClick={() => clearSpoc(proj.projectId, shiftKey)}
                                className="text-gray-300 hover:text-red-500 transition-colors"
                                title="Reset to default"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {spoc ? (
                        <>
                          <p className="text-sm font-medium text-gray-900">{spoc.name}</p>
                          <p className="text-xs text-gray-500">{spoc.email}</p>
                        </>
                      ) : (
                        isManager ? (
                          <button
                            onClick={() => openEditSpoc(proj.projectId, shiftKey, null)}
                            className="text-sm text-indigo-500 hover:underline"
                          >
                            + Assign SPOC
                          </button>
                        ) : (
                          <p className="text-sm text-gray-400 italic">Not assigned</p>
                        )
                      )}
                    </div>
                  </div>

                  {/* ── GAP SME ── */}
                  <div className="flex items-start gap-3 px-5 py-4">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0 bg-emerald-400" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-semibold text-gray-500">
                          GAP SME
                          <span className="ml-1.5 font-normal text-gray-400">· Support Contact</span>
                        </p>
                        {isManager && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openEditGap(proj.projectId, shiftKey)}
                              className="text-gray-400 hover:text-emerald-600 transition-colors"
                              title="Edit GAP SME"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {sme && (
                              <button
                                onClick={() => clearGap(proj.projectId, shiftKey)}
                                className="text-gray-300 hover:text-red-500 transition-colors"
                                title="Clear"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {sme ? (
                        <>
                          <p className="text-sm font-medium text-gray-900">{sme.name}</p>
                          <p className="text-xs text-gray-500">{sme.email}</p>
                          {sme.timezone && (
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400">
                              <Globe className="h-3 w-3" />{sme.timezone}
                            </p>
                          )}
                        </>
                      ) : (
                        isManager ? (
                          <button
                            onClick={() => openEditGap(proj.projectId, shiftKey)}
                            className="text-sm text-emerald-600 hover:underline"
                          >
                            + Add GAP SME
                          </button>
                        ) : (
                          <p className="text-sm text-gray-400 italic">Not assigned</p>
                        )
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── SPOC edit modal ─────────────────────────────────────────────────── */}
      {editingSpoc && (
        <Modal
          title="Change HCL SPOC"
          subtitle={`${projects.find((p) => p.projectId === editingSpoc.projectId)?.projectName} · ${SHIFT_META[editingSpoc.shift].label}`}
          onClose={() => setEditingSpoc(null)}
        >
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <User className="h-3.5 w-3.5 text-gray-400" /> Select Team Member
            </label>
            <select
              value={spocForm.userId}
              onChange={(e) => handleSpocSelect(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Choose a person…</option>
              {teamMembers.map((m) => (
                <option key={m.userId} value={m.userId}>{m.name}</option>
              ))}
            </select>
            {spocForm.name && (
              <p className="mt-1.5 text-xs text-gray-500">{spocForm.email}</p>
            )}
          </div>
          <ModalActions
            onSave={saveSpoc}
            disabled={!spocForm.userId}
            onCancel={() => setEditingSpoc(null)}
          />
        </Modal>
      )}

      {/* ── GAP SME edit modal ───────────────────────────────────────────────── */}
      {editingGap && (
        <Modal
          title="GAP SME Details"
          subtitle={`${projects.find((p) => p.projectId === editingGap.projectId)?.projectName} · ${SHIFT_META[editingGap.shift].label}`}
          onClose={() => setEditingGap(null)}
        >
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <User className="h-3.5 w-3.5 text-gray-400" /> Name
            </label>
            <input
              type="text"
              value={gapForm.name}
              onChange={(e) => setGapForm({ ...gapForm, name: e.target.value })}
              placeholder="e.g. John Smith"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Mail className="h-3.5 w-3.5 text-gray-400" /> Email
            </label>
            <input
              type="email"
              value={gapForm.email}
              onChange={(e) => setGapForm({ ...gapForm, email: e.target.value })}
              placeholder="e.g. john.smith@corp.com"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Globe className="h-3.5 w-3.5 text-gray-400" /> Timezone / Location
            </label>
            <select
              value={gapForm.timezone}
              onChange={(e) => setGapForm({ ...gapForm, timezone: e.target.value })}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select timezone…</option>
              {COMMON_TZ.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <ModalActions
            onSave={saveGap}
            disabled={!gapForm.name.trim() || !gapForm.email.trim()}
            onCancel={() => setEditingGap(null)}
          />
        </Modal>
      )}
    </div>
  );
}

// ── Shared modal shell ────────────────────────────────────────────────────────

function Modal({
  title, subtitle, onClose, children,
}: {
  title: string; subtitle: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  onSave, disabled, onCancel,
}: {
  onSave: () => void; disabled: boolean; onCancel: () => void;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <button
        onClick={onSave}
        disabled={disabled}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Check className="h-4 w-4" /> Save
      </button>
      <button
        onClick={onCancel}
        className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
      >
        Cancel
      </button>
    </div>
  );
}
