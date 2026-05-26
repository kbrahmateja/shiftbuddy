"use client";

import { useState, useCallback } from "react";
import {
  AlertOctagon, Bell, Ticket, Hash, Video, MessageCircle,
  BookOpen, Wrench, ListTodo, AlertTriangle, CheckCircle2,
  Plus, Trash2, ChevronDown, ChevronUp, Save, Send,
  Clock, MoreHorizontal, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SOURCE_CONFIG, SEVERITY_CONFIG } from "@/lib/utils";
import type {
  SessionUser, ShiftPattern, Source, Severity,
  DiaryIncidentInput, DiaryKtItemInput, DiaryKtloItemInput, DiaryTaskInput,
  DiaryEntryPayload, DailyDiary,
} from "@/types";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Badge }     from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { saveDiaryEntry, submitDiaryEntry } from "@/app/actions/diary";

// ─────────────────────────────────────────────
// SMALL UI HELPERS
// ─────────────────────────────────────────────

function SectionHeader({
  icon: Icon, title, count, color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  color: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2", color)}>
      <Icon className="h-4 w-4" />
      <span className="text-sm font-semibold">{title}</span>
      {count !== undefined && count > 0 && (
        <span className="ml-auto rounded-full bg-white/60 px-2 py-0.5 text-[11px] font-bold">
          {count}
        </span>
      )}
    </div>
  );
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-1">
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      {hint && <span className="ml-1.5 text-[11px] text-gray-400">{hint}</span>}
    </div>
  );
}

function TextArea({
  value, onChange, placeholder, rows = 3, maxLength,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number; maxLength?: number;
}) {
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 transition-colors"
      />
      {maxLength && (
        <span className="absolute bottom-1.5 right-2 text-[10px] text-gray-300">
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
}

function NumberStepper({
  value, onChange, min = 0, max = 100,
}: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
        disabled={value <= min}
      >
        −
      </button>
      <span className="min-w-[2.5rem] text-center text-sm font-bold text-gray-800">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}

// KT progress slider
function KtProgressSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const color =
    value >= 80 ? "bg-emerald-500" :
    value >= 50 ? "bg-indigo-500"  :
    value >= 25 ? "bg-amber-500"   : "bg-red-400";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">KT Completion</span>
        <span className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-bold text-white",
          color,
        )}>
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={0} max={100} step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-indigo-600"
      />
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// INCIDENT ITEM
// ─────────────────────────────────────────────

const INCIDENT_SOURCES: Source[] = ["PAGERDUTY", "SERVICENOW", "SLACK", "TEAMS", "VERBAL", "OTHER"];
const INCIDENT_SEVERITIES: Severity[] = ["P1_CRITICAL", "P2_HIGH", "P3_MEDIUM", "P4_LOW", "INFORMATIONAL"];
const SOURCE_ICONS: Record<Source, React.ComponentType<{ className?: string }>> = {
  PAGERDUTY: Bell, SERVICENOW: Ticket, SLACK: Hash,
  TEAMS: Video, VERBAL: MessageCircle, OTHER: MoreHorizontal,
};

function IncidentItem({
  item, index, onChange, onRemove,
}: {
  item: DiaryIncidentInput; index: number;
  onChange: (i: number, update: Partial<DiaryIncidentInput>) => void;
  onRemove: (i: number) => void;
}) {
  const srcCfg = SOURCE_CONFIG[item.source];
  const SrcIcon = SOURCE_ICONS[item.source];

  return (
    <div className={cn("rounded-xl border p-3 border-l-4", srcCfg.borderClass)}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
          #{index + 1}
        </span>
        <div className="flex-1 space-y-2.5">
          {/* Title */}
          <Input
            value={item.title}
            onChange={(e) => onChange(index, { title: e.target.value })}
            placeholder="Brief incident title…"
            className="h-8 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            {/* Source */}
            <div>
              <FieldLabel label="Source" />
              <Select value={item.source} onValueChange={(v) => onChange(index, { source: v as Source })}>
                <SelectTrigger className="h-8 text-xs">
                  <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", srcCfg.badgeClass)}>
                    <SrcIcon className="h-2.5 w-2.5" />{srcCfg.label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_SOURCES.map((s) => {
                    const cfg = SOURCE_CONFIG[s];
                    const Ic = SOURCE_ICONS[s];
                    return (
                      <SelectItem key={s} value={s} className="text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", cfg.dotClass)} />
                          <Ic className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {/* Severity */}
            <div>
              <FieldLabel label="Severity" />
              <Select value={item.severity} onValueChange={(v) => onChange(index, { severity: v as Severity })}>
                <SelectTrigger className="h-8 text-xs">
                  <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", SEVERITY_CONFIG[item.severity].badgeClass)}>
                    {SEVERITY_CONFIG[item.severity].label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_SEVERITIES.map((sv) => (
                    <SelectItem key={sv} value={sv} className="text-xs">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", SEVERITY_CONFIG[sv].badgeClass)}>
                        {SEVERITY_CONFIG[sv].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* External Ref */}
          <Input
            value={item.externalRef}
            onChange={(e) => onChange(index, { externalRef: e.target.value })}
            placeholder="Ticket / incident ref (e.g. INC0001234 or PD-ABC123)"
            className="h-8 text-xs"
          />
          {/* Notes */}
          <TextArea
            value={item.notes}
            onChange={(v) => onChange(index, { notes: v })}
            placeholder="What happened? What was done? Is it resolved?"
            rows={2}
            maxLength={500}
          />
          {/* Resolved toggle */}
          <button
            type="button"
            onClick={() => onChange(index, { wasResolved: !item.wasResolved })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
              item.wasResolved
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            )}
          >
            <CheckCircle2 className="h-3 w-3" />
            {item.wasResolved ? "Resolved ✓" : "Mark as resolved"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="ml-1 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// KT ITEM
// ─────────────────────────────────────────────

type KtItemType = "SESSION" | "DOCUMENT" | "DEMO" | "REVIEW";
const KT_TYPES: { value: KtItemType; label: string }[] = [
  { value: "SESSION",  label: "📚 Session"  },
  { value: "DOCUMENT", label: "📄 Document" },
  { value: "DEMO",     label: "🎥 Demo"     },
  { value: "REVIEW",   label: "🔍 Review"   },
];

function KtItem({
  item, index, onChange, onRemove,
}: {
  item: DiaryKtItemInput; index: number;
  onChange: (i: number, u: Partial<DiaryKtItemInput>) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
          #{index + 1}
        </span>
        <div className="flex-1 space-y-2">
          <Input
            value={item.topic}
            onChange={(e) => onChange(index, { topic: e.target.value })}
            placeholder="KT topic or module name…"
            className="h-8 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel label="Type" />
              <Select value={item.type} onValueChange={(v) => onChange(index, { type: v as KtItemType })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel label="Duration (min)" />
              <Input
                type="number"
                value={item.durationMins}
                onChange={(e) => onChange(index, { durationMins: Number(e.target.value) })}
                min={0} max={600}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <TextArea
            value={item.notes}
            onChange={(v) => onChange(index, { notes: v })}
            placeholder="Topics covered, documents updated, attendees…"
            rows={2}
            maxLength={500}
          />
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="ml-1 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// KTLO ITEM
// ─────────────────────────────────────────────

type KtloCategory = "MONITORING" | "DEPLOYMENT" | "PATCH" | "MAINTENANCE" | "ALERT";
const KTLO_CATEGORIES: { value: KtloCategory; label: string; color: string }[] = [
  { value: "MONITORING",  label: "Monitoring",  color: "bg-sky-100 text-sky-700"     },
  { value: "DEPLOYMENT",  label: "Deployment",  color: "bg-violet-100 text-violet-700" },
  { value: "PATCH",       label: "Patch",       color: "bg-orange-100 text-orange-700" },
  { value: "MAINTENANCE", label: "Maintenance", color: "bg-gray-100 text-gray-600"   },
  { value: "ALERT",       label: "Alert",       color: "bg-red-100 text-red-700"     },
];

function KtloItem({
  item, index, onChange, onRemove,
}: {
  item: DiaryKtloItemInput; index: number;
  onChange: (i: number, u: Partial<DiaryKtloItemInput>) => void;
  onRemove: (i: number) => void;
}) {
  const catCfg = KTLO_CATEGORIES.find((c) => c.value === item.category) ?? KTLO_CATEGORIES[3];
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
          #{index + 1}
        </span>
        <div className="flex-1 space-y-2">
          <Input
            value={item.title}
            onChange={(e) => onChange(index, { title: e.target.value })}
            placeholder="KTLO task completed…"
            className="h-8 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel label="Category" />
              <Select value={item.category} onValueChange={(v) => onChange(index, { category: v as KtloCategory })}>
                <SelectTrigger className="h-8 text-xs">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", catCfg.color)}>
                    {catCfg.label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {KTLO_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="text-xs">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", c.color)}>
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel label="Reference (optional)" />
              <Input
                value={item.externalRef}
                onChange={(e) => onChange(index, { externalRef: e.target.value })}
                placeholder="Ticket / change ID"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <TextArea
            value={item.notes}
            onChange={(v) => onChange(index, { notes: v })}
            placeholder="What was done / what was the outcome?"
            rows={1}
            maxLength={500}
          />
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="ml-1 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TASK ITEM
// ─────────────────────────────────────────────

const TASK_PRIORITIES: { value: string; label: string; color: string }[] = [
  { value: "HIGH",   label: "High",   color: "bg-red-100 text-red-700"     },
  { value: "MEDIUM", label: "Medium", color: "bg-amber-100 text-amber-700" },
  { value: "LOW",    label: "Low",    color: "bg-gray-100 text-gray-600"   },
];

function TaskItem({
  item, index, onChange, onRemove,
}: {
  item: DiaryTaskInput; index: number;
  onChange: (i: number, u: Partial<DiaryTaskInput>) => void;
  onRemove: (i: number) => void;
}) {
  const priCfg = TASK_PRIORITIES.find((p) => p.value === item.priority) ?? TASK_PRIORITIES[1];
  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-600">
          #{index + 1}
        </span>
        <div className="flex-1 space-y-2">
          <Input
            value={item.title}
            onChange={(e) => onChange(index, { title: e.target.value })}
            placeholder="New task title…"
            className="h-8 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel label="Priority" />
              <Select value={item.priority} onValueChange={(v) => onChange(index, { priority: v as import("@/types").DiaryTaskPriority })}>
                <SelectTrigger className="h-8 text-xs">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", priCfg.color)}>
                    {priCfg.label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value} className="text-xs">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", p.color)}>
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel label="Due date (optional)" />
              <Input
                type="date"
                value={item.dueDate}
                onChange={(e) => onChange(index, { dueDate: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <TextArea
            value={item.notes}
            onChange={(v) => onChange(index, { notes: v })}
            placeholder="Context or acceptance criteria…"
            rows={1}
            maxLength={500}
          />
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="ml-1 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FORM STATE
// ─────────────────────────────────────────────

function defaultIncident(): DiaryIncidentInput {
  return { title: "", source: "PAGERDUTY", severity: "P3_MEDIUM", externalRef: "", wasResolved: false, notes: "" };
}
function defaultKtItem(): DiaryKtItemInput {
  return { topic: "", type: "SESSION", durationMins: 60, notes: "" };
}
function defaultKtloItem(): DiaryKtloItemInput {
  return { title: "", category: "MAINTENANCE", externalRef: "", notes: "" };
}
function defaultTask(): DiaryTaskInput {
  return { title: "", priority: "MEDIUM", dueDate: "", notes: "" };
}

interface FormState {
  incidentCount:     number;
  incidentNotes:     string;
  incidents:         DiaryIncidentInput[];

  ktSessionsCount:   number;
  ktProgressPercent: number;
  ktNotes:           string;
  ktItems:           DiaryKtItemInput[];

  ktloResolvedCount: number;
  ktloNotes:         string;
  ktloItems:         DiaryKtloItemInput[];

  newTaskCount:      number;
  newTaskNotes:      string;
  tasks:             DiaryTaskInput[];

  hasBlockers:       boolean;
  blockerDetails:    string;

  generalNotes:      string;
}

function initForm(existing?: DailyDiary): FormState {
  if (!existing) {
    return {
      incidentCount: 0, incidentNotes: "", incidents: [],
      ktSessionsCount: 0, ktProgressPercent: 0, ktNotes: "", ktItems: [],
      ktloResolvedCount: 0, ktloNotes: "", ktloItems: [],
      newTaskCount: 0, newTaskNotes: "", tasks: [],
      hasBlockers: false, blockerDetails: "", generalNotes: "",
    };
  }
  return {
    incidentCount:     existing.incidentCount,
    incidentNotes:     existing.incidentNotes ?? "",
    incidents:         (existing.incidents ?? []).map((i) => ({
      title: i.title, source: i.source, severity: i.severity,
      externalRef: i.externalRef ?? "", wasResolved: i.wasResolved, notes: i.notes ?? "",
    })),
    ktSessionsCount:   existing.ktSessionsCount,
    ktProgressPercent: existing.ktProgressPercent,
    ktNotes:           existing.ktNotes ?? "",
    ktItems:           (existing.ktItems ?? []).map((i) => ({
      topic: i.topic, type: i.type, durationMins: i.durationMins, notes: i.notes ?? "",
    })),
    ktloResolvedCount: existing.ktloResolvedCount,
    ktloNotes:         existing.ktloNotes ?? "",
    ktloItems:         (existing.ktloItems ?? []).map((i) => ({
      title: i.title, category: i.category, externalRef: i.externalRef ?? "", notes: i.notes ?? "",
    })),
    newTaskCount:      existing.newTaskCount,
    newTaskNotes:      existing.newTaskNotes ?? "",
    tasks:             (existing.tasks ?? []).map((t) => ({
      title: t.title, priority: t.priority,
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : "",
      notes: t.notes ?? "",
    })),
    hasBlockers:       existing.hasBlockers,
    blockerDetails:    existing.blockerDetails ?? "",
    generalNotes:      existing.generalNotes ?? "",
  };
}

// ─────────────────────────────────────────────
// MAIN FORM COMPONENT
// ─────────────────────────────────────────────

interface DiaryEntryFormProps {
  user: SessionUser;
  projectId: string;
  shiftPattern: ShiftPattern;
  diaryDate?: Date;        // Defaults to today
  existingDiary?: DailyDiary;
  onSaved?: (diaryId: string) => void;
  onSubmitted?: (diaryId: string) => void;
}

export function DiaryEntryForm({
  user,
  projectId,
  shiftPattern,
  diaryDate,
  existingDiary,
  onSaved,
  onSubmitted,
}: DiaryEntryFormProps) {
  const dateStr = (diaryDate ?? new Date()).toISOString().slice(0, 10);
  const isReadOnly = existingDiary?.status === "REVIEWED";

  const [form, setForm] = useState<FormState>(() => initForm(existingDiary));
  const [savedId, setSavedId]   = useState<string | null>(existingDiary?.id ?? null);
  const [saving,  setSaving]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Collapsed section state
  const [open, setOpen] = useState({
    incidents: true,
    kt: true,
    ktlo: true,
    tasks: true,
    blockers: form.hasBlockers,
    general: true,
  });

  function toggleSection(key: keyof typeof open) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // ── List helpers ──
  function updateList<T>(
    key: keyof Pick<FormState, "incidents" | "ktItems" | "ktloItems" | "tasks">,
    idx: number,
    update: Partial<T>
  ) {
    setForm((f) => ({
      ...f,
      [key]: (f[key] as T[]).map((item, i) => (i === idx ? { ...item, ...update } : item)),
    }));
  }

  function removeFromList(
    key: keyof Pick<FormState, "incidents" | "ktItems" | "ktloItems" | "tasks">,
    idx: number
  ) {
    setForm((f) => ({ ...f, [key]: (f[key] as unknown[]).filter((_, i) => i !== idx) }));
  }

  // ── Build payload ──
  const buildPayload = useCallback((): DiaryEntryPayload => ({
    projectId,
    diaryDate:         dateStr,
    shiftPattern,
    incidentCount:     form.incidents.length || form.incidentCount,
    incidentNotes:     form.incidentNotes,
    incidents:         form.incidents,
    ktSessionsCount:   form.ktItems.length || form.ktSessionsCount,
    ktProgressPercent: form.ktProgressPercent,
    ktNotes:           form.ktNotes,
    ktItems:           form.ktItems,
    ktloResolvedCount: form.ktloItems.length || form.ktloResolvedCount,
    ktloNotes:         form.ktloNotes,
    ktloItems:         form.ktloItems,
    newTaskCount:      form.tasks.length || form.newTaskCount,
    newTaskNotes:      form.newTaskNotes,
    tasks:             form.tasks,
    hasBlockers:       form.hasBlockers,
    blockerDetails:    form.blockerDetails,
    generalNotes:      form.generalNotes,
  }), [form, projectId, dateStr, shiftPattern]);

  // ── Save draft ──
  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    const result = await saveDiaryEntry(buildPayload());
    setSaving(false);
    if (result.success) {
      setSavedId(result.data.diaryId);
      setFeedback({ type: "success", msg: "Draft saved successfully." });
      onSaved?.(result.data.diaryId);
    } else {
      setFeedback({ type: "error", msg: result.error });
    }
  }

  // ── Submit ──
  async function handleSubmit() {
    if (!savedId) {
      // Auto-save first
      setSaving(true);
      const saveResult = await saveDiaryEntry(buildPayload());
      setSaving(false);
      if (!saveResult.success) {
        setFeedback({ type: "error", msg: saveResult.error });
        return;
      }
      setSavedId(saveResult.data.diaryId);
    }

    setSubmitting(true);
    setFeedback(null);
    const result = await submitDiaryEntry(savedId!);
    setSubmitting(false);
    if (result.success) {
      setFeedback({ type: "success", msg: result.message ?? "Diary submitted to your shift lead." });
      onSubmitted?.(result.data.diaryId);
    } else {
      setFeedback({ type: "error", msg: result.error });
    }
  }

  const totalKtMins = form.ktItems.reduce((s, i) => s + i.durationMins, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            End-of-Shift Diary
          </h2>
          <p className="text-xs text-gray-500">
            {new Date(dateStr).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" · "}
            <span className="font-medium text-indigo-600">{shiftPattern}</span>
            {isReadOnly && (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                Reviewed — read-only
              </span>
            )}
          </p>
        </div>
        {/* Quick stats row */}
        <div className="flex flex-wrap gap-2 text-[11px]">
          {form.incidents.length > 0 && (
            <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700">
              {form.incidents.length} incident{form.incidents.length > 1 ? "s" : ""}
            </span>
          )}
          {form.ktItems.length > 0 && (
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">
              KT {form.ktProgressPercent}% · {Math.floor(totalKtMins/60)}h{totalKtMins%60 > 0 ? ` ${totalKtMins%60}m` : ""}
            </span>
          )}
          {form.ktloItems.length > 0 && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
              {form.ktloItems.length} KTLO
            </span>
          )}
          {form.tasks.length > 0 && (
            <span className="rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-violet-700">
              {form.tasks.length} task{form.tasks.length > 1 ? "s" : ""}
            </span>
          )}
          {form.hasBlockers && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
              ⚠️ Blocker
            </span>
          )}
        </div>
      </div>

      {/* ─── Section 1: Incidents ─────────────────────────── */}
      <div className="rounded-xl border border-red-100 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection("incidents")}
          className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-red-50/50 transition-colors"
        >
          <SectionHeader
            icon={AlertOctagon}
            title="Incidents Handled"
            count={form.incidents.length}
            color="text-red-700"
          />
          <div className="ml-auto flex items-center gap-2">
            <NumberStepper
              value={form.incidentCount}
              onChange={(v) => !isReadOnly && setForm((f) => ({ ...f, incidentCount: v }))}
              max={100}
            />
            {open.incidents ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </button>
        {open.incidents && (
          <div className="border-t border-red-100 px-4 py-3 space-y-3">
            <div>
              <FieldLabel label="Summary" hint="(optional — overall incident narrative)" />
              <TextArea
                value={form.incidentNotes}
                onChange={(v) => !isReadOnly && setForm((f) => ({ ...f, incidentNotes: v }))}
                placeholder="Brief summary of incidents handled this shift…"
                rows={2}
                maxLength={2000}
              />
            </div>
            {form.incidents.map((item, idx) => (
              <IncidentItem
                key={idx} item={item} index={idx}
                onChange={(i, u) => !isReadOnly && updateList("incidents", i, u)}
                onRemove={(i) => !isReadOnly && removeFromList("incidents", i)}
              />
            ))}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, incidents: [...f.incidents, defaultIncident()] }))}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-red-200 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add incident
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Section 2: KT Progress ──────────────────────── */}
      <div className="rounded-xl border border-indigo-100 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection("kt")}
          className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-indigo-50/50 transition-colors"
        >
          <SectionHeader
            icon={BookOpen}
            title="KT Progress"
            count={form.ktItems.length}
            color="text-indigo-700"
          />
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-600">{form.ktProgressPercent}%</span>
            {open.kt ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </button>
        {open.kt && (
          <div className="border-t border-indigo-100 px-4 py-3 space-y-3">
            <KtProgressSlider
              value={form.ktProgressPercent}
              onChange={(v) => !isReadOnly && setForm((f) => ({ ...f, ktProgressPercent: v }))}
            />
            <div>
              <FieldLabel label="KT Notes" hint="(topics, docs updated, areas completed)" />
              <TextArea
                value={form.ktNotes}
                onChange={(v) => !isReadOnly && setForm((f) => ({ ...f, ktNotes: v }))}
                placeholder="What KT work was done? What modules/topics were covered?"
                rows={2}
                maxLength={2000}
              />
            </div>
            {form.ktItems.map((item, idx) => (
              <KtItem
                key={idx} item={item} index={idx}
                onChange={(i, u) => !isReadOnly && updateList("ktItems", i, u)}
                onRemove={(i) => !isReadOnly && removeFromList("ktItems", i)}
              />
            ))}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, ktItems: [...f.ktItems, defaultKtItem()] }))}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-indigo-200 py-2 text-xs font-medium text-indigo-500 hover:bg-indigo-50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add KT session
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Section 3: KTLO Tasks ───────────────────────── */}
      <div className="rounded-xl border border-emerald-100 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection("ktlo")}
          className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-emerald-50/50 transition-colors"
        >
          <SectionHeader
            icon={Wrench}
            title="KTLO Tasks Resolved"
            count={form.ktloItems.length}
            color="text-emerald-700"
          />
          <div className="ml-auto flex items-center gap-2">
            <NumberStepper
              value={form.ktloResolvedCount}
              onChange={(v) => !isReadOnly && setForm((f) => ({ ...f, ktloResolvedCount: v }))}
              max={200}
            />
            {open.ktlo ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </button>
        {open.ktlo && (
          <div className="border-t border-emerald-100 px-4 py-3 space-y-3">
            <div>
              <FieldLabel label="KTLO Summary" hint="(overall what was maintained/operated)" />
              <TextArea
                value={form.ktloNotes}
                onChange={(v) => !isReadOnly && setForm((f) => ({ ...f, ktloNotes: v }))}
                placeholder="Health checks, deployments, patches, monitoring tasks…"
                rows={2}
                maxLength={2000}
              />
            </div>
            {form.ktloItems.map((item, idx) => (
              <KtloItem
                key={idx} item={item} index={idx}
                onChange={(i, u) => !isReadOnly && updateList("ktloItems", i, u)}
                onRemove={(i) => !isReadOnly && removeFromList("ktloItems", i)}
              />
            ))}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, ktloItems: [...f.ktloItems, defaultKtloItem()] }))}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-emerald-200 py-2 text-xs font-medium text-emerald-500 hover:bg-emerald-50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add KTLO task
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Section 4: New Tasks ─────────────────────────── */}
      <div className="rounded-xl border border-violet-100 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection("tasks")}
          className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-violet-50/50 transition-colors"
        >
          <SectionHeader
            icon={ListTodo}
            title="New Tasks Created"
            count={form.tasks.length}
            color="text-violet-700"
          />
          <div className="ml-auto">
            {open.tasks ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </button>
        {open.tasks && (
          <div className="border-t border-violet-100 px-4 py-3 space-y-3">
            <div>
              <FieldLabel label="New Task Notes" hint="(brief overview)" />
              <TextArea
                value={form.newTaskNotes}
                onChange={(v) => !isReadOnly && setForm((f) => ({ ...f, newTaskNotes: v }))}
                placeholder="Summary of tasks added to the backlog this shift…"
                rows={1}
                maxLength={2000}
              />
            </div>
            {form.tasks.map((item, idx) => (
              <TaskItem
                key={idx} item={item} index={idx}
                onChange={(i, u) => !isReadOnly && updateList("tasks", i, u)}
                onRemove={(i) => !isReadOnly && removeFromList("tasks", i)}
              />
            ))}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, tasks: [...f.tasks, defaultTask()] }))}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-violet-200 py-2 text-xs font-medium text-violet-500 hover:bg-violet-50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add task
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Section 5: Blockers ─────────────────────────── */}
      <div className={cn(
        "rounded-xl border bg-white overflow-hidden transition-colors",
        form.hasBlockers ? "border-amber-300" : "border-gray-200"
      )}>
        <button
          type="button"
          onClick={() => !isReadOnly && setForm((f) => ({ ...f, hasBlockers: !f.hasBlockers }))}
          className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-amber-50/50 transition-colors"
        >
          <SectionHeader icon={AlertTriangle} title="Blockers for Incoming Shift" color={form.hasBlockers ? "text-amber-700" : "text-gray-500"} />
          <div className="ml-auto flex items-center gap-2">
            <span className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
              form.hasBlockers ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
            )}>
              {form.hasBlockers ? "YES" : "None"}
            </span>
          </div>
        </button>
        {form.hasBlockers && (
          <div className="border-t border-amber-200 px-4 py-3">
            <FieldLabel label="Describe the blocker" hint="(incoming shift must act on this)" />
            <TextArea
              value={form.blockerDetails}
              onChange={(v) => !isReadOnly && setForm((f) => ({ ...f, blockerDetails: v }))}
              placeholder="What is blocked, why, and what needs to happen next shift to unblock it?"
              rows={3}
              maxLength={1000}
            />
          </div>
        )}
      </div>

      {/* ─── Section 6: General Notes ────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection("general")}
          className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <SectionHeader icon={Info} title="General End-of-Shift Notes" color="text-gray-600" />
          <div className="ml-auto">
            {open.general ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </button>
        {open.general && (
          <div className="border-t border-gray-100 px-4 py-3">
            <TextArea
              value={form.generalNotes}
              onChange={(v) => !isReadOnly && setForm((f) => ({ ...f, generalNotes: v }))}
              placeholder="Overall shift summary, anything worth noting for the record, observations for the team…"
              rows={4}
              maxLength={3000}
            />
          </div>
        )}
      </div>

      {/* Feedback message */}
      {feedback && (
        <div className={cn(
          "flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm",
          feedback.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
        )}>
          {feedback.type === "success"
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            : <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* ─── Action buttons ─────────────────────────────── */}
      {!isReadOnly && (
        <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-4">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saving || submitting}
            className="gap-2"
          >
            {saving ? (
              <>
                <Clock className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save Draft
              </>
            )}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || submitting}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {submitting ? (
              <>
                <Clock className="h-4 w-4 animate-spin" /> Submitting…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Submit to Lead
              </>
            )}
          </Button>
          <p className="flex-1 text-[11px] text-gray-400 self-center">
            Save as draft to continue later. Submit when your shift ends — your lead will be notified.
          </p>
        </div>
      )}

      {/* Lead review note (read-only view) */}
      {existingDiary?.reviewNotes && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-semibold text-blue-800 mb-1">Lead Review Note</p>
          <p className="text-xs text-blue-700">{existingDiary.reviewNotes}</p>
          {existingDiary.reviewedAt && (
            <p className="mt-1 text-[10px] text-blue-400">
              Reviewed at {new Date(existingDiary.reviewedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
