/* Shared pieces for the Agents workspace: status pills, the work summary
   derived from runs, the keyboard-accessible action menu, and the list of
   permitted actions for an agent (the same list the chart, the List view and
   the narrow hierarchy use). */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  AVAILABILITY_LABEL, AVAILABILITY_TONE, RUN_STATE_LABEL, agentReadiness, agentState, availabilityOf, can, describeRef, moduleEnabled, navigate,
  runTone, scopeText, setAvailability, store, type AgentActivity, type AgentDef, type AgentRun, type CoreState, type Id, type Q, type Tone
} from "../../core";
import { Pill } from "../frame";
import { Icon } from "../kit";

export type PanelMode = "start" | "test" | "pause" | "move" | "archive" | "edit" | null;
export type PanelTab = "overview" | "responsibilities" | "access" | "runs" | "conversation" | "history";

export interface AgentNav {
  openAgent: (id: Id, tab?: PanelTab, mode?: PanelMode) => void;
  addAgent: (coordinatorId?: Id | null, templateId?: string) => void;
  openRun: (id: Id) => void;
}

export const AG_ICON = {
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  zoomIn: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M20 20l-4-4 M8 11h6 M11 8v6",
  zoomOut: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M20 20l-4-4 M8 11h6",
  fit: "M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5",
  chevDown: "M6 9l6 6 6-6",
  chevRight: "m9 6 6 6-6 6",
  plus: "M12 5v14 M5 12h14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M20 20l-4-4"
};

/** Availability as shown on a node. Archived wins over everything. */
export function availabilityView(a: AgentDef): { label: string; tone: Tone } {
  if (a.archived) return { label: "Archived", tone: "neutral" };
  const av = availabilityOf(a);
  return { label: AVAILABILITY_LABEL[av], tone: AVAILABILITY_TONE[av] };
}

export function AvailabilityPill({ agent }: { agent: AgentDef }) {
  const v = availabilityView(agent);
  return <Pill tone={v.tone}>{v.label}</Pill>;
}

export function RunPill({ run }: { run: AgentRun }) {
  return <Pill tone={runTone(run.state)}>{RUN_STATE_LABEL[run.state]}{run.test ? " (test)" : ""}</Pill>;
}

/** The face state reflects live work, never decoration. */
export function faceState(a: AgentDef, w: AgentActivity): string {
  if (a.archived) return "idle";
  if (w.failed) return "attention";
  if (w.waitingApproval || w.waitingInput || w.stopRequested) return "waiting";
  if (w.running) return "working";
  return availabilityOf(a) === "ready" ? "complete" : "idle";
}

export function workParts(w: AgentActivity): { text: string; tone: Tone; n: number }[] {
  const out: { text: string; tone: Tone; n: number }[] = [];
  if (w.running) out.push({ text: "running", tone: "accent", n: w.running });
  if (w.waitingApproval) out.push({ text: "waiting for approval", tone: "warn", n: w.waitingApproval });
  if (w.waitingInput) out.push({ text: "waiting for input", tone: "warn", n: w.waitingInput });
  if (w.stopRequested) out.push({ text: "stop requested", tone: "warn", n: w.stopRequested });
  if (w.failed) out.push({ text: "failed", tone: "bad", n: w.failed });
  return out;
}

export function workText(w: AgentActivity): string {
  const p = workParts(w);
  return p.length ? p.map((x) => x.n + " " + x.text).join(", ") : "Idle";
}

export function WorkSummary({ w, compact }: { w: AgentActivity; compact?: boolean }) {
  const parts = workParts(w);
  if (!parts.length) return <span className="ag-work ag-work--idle">Idle</span>;
  return (
    <span className="ag-work">
      {parts.map((p) => (
        <span key={p.text} className={"ag-count pk-tone-" + p.tone} title={p.n + " " + p.text}>
          <b>{p.n}</b>{compact ? null : <span>{p.text}</span>}
        </span>
      ))}
    </span>
  );
}

export function ownerAndScope(s: CoreState, a: AgentDef): string {
  const owner = s.data.people.find((p) => p.id === a.responsibleId)?.name || "No owner";
  return owner + " · " + scopeText(s, a.scope.teamIds);
}

/* ── Action menu ───────────────────────────────────────────────────────── */

export interface MenuAction { label: string; run?: () => void; disabled?: boolean; note?: string; danger?: boolean }

/** Permitted actions for an agent. Disabled ones say why. The same list everywhere. */
export function agentActions(s: CoreState, q: Q, a: AgentDef, nav: AgentNav): MenuAction[] {
  const manage = can(q.viewer, "agents.manage");
  const runOk = can(q.viewer, "agents.run");
  const av = availabilityOf(a);
  const noManage = "Needs the Manage agents permission.";
  if (a.archived) {
    return [{ label: "Open details", run: () => nav.openAgent(a.id) }, { label: "Runs and history", run: () => nav.openAgent(a.id, "runs") }];
  }
  const ready = agentReadiness(s, a);
  const items: MenuAction[] = [
    { label: "Open details", run: () => nav.openAgent(a.id) },
    { label: "Start a run", run: () => nav.openAgent(a.id, "overview", "start"), disabled: !runOk || av !== "ready",
      note: !runOk ? "Needs the Start agent runs permission." : av !== "ready" ? a.name + " is " + AVAILABILITY_LABEL[av].toLowerCase() + "." : undefined },
    { label: "Test run", run: () => nav.openAgent(a.id, "overview", "test"), disabled: !manage && !runOk, note: !manage && !runOk ? "Needs the Manage agents or Start agent runs permission." : undefined }
  ];
  if (av === "ready") items.push({ label: "Pause", run: () => nav.openAgent(a.id, "overview", "pause"), disabled: !manage, note: manage ? undefined : noManage });
  else items.push({ label: av === "paused" ? "Resume" : "Activate", run: () => { store.run(setAvailability, a.id, "ready"); }, disabled: !manage || (!ready.ok && !ready.onlyConnectionsMissing),
    note: !manage ? noManage : !ready.ok && !ready.onlyConnectionsMissing ? "Still needed: " + ready.items.filter((i) => !i.ok).map((i) => i.label.toLowerCase()).join(", ") + "." : undefined });
  items.push(
    { label: "Edit", run: () => nav.openAgent(a.id, "responsibilities", "edit"), disabled: !manage, note: manage ? undefined : noManage },
    { label: "Move", run: () => nav.openAgent(a.id, "overview", "move"), disabled: !manage, note: manage ? undefined : noManage },
    { label: "Add under this agent", run: () => nav.addAgent(a.id), disabled: !manage, note: manage ? undefined : noManage },
    { label: "Policy in Settings", run: () => openPolicy(a.id) },
    { label: "Archive", run: () => nav.openAgent(a.id, "overview", "archive"), disabled: !manage, note: manage ? undefined : noManage, danger: true }
  );
  return items;
}

export function openPolicy(agentId: Id) {
  navigate({ page: "Settings", section: "agents", focus: { kind: "agent", id: agentId } });
}

/** A small menu: arrow keys move, Escape closes and returns focus, Tab closes. */
export function ActionMenu({ items, label, open, onOpenChange, trigger, align = "right" }: {
  items: MenuAction[]; label: string; open: boolean; onOpenChange: (o: boolean) => void; trigger?: ReactNode; align?: "left" | "right";
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [flipUp, setFlipUp] = useState(false);
  useLayoutEffect(() => {
    if (!open || !menu.current) return;
    const r = menu.current.getBoundingClientRect();
    setFlipUp(r.bottom > window.innerHeight - 8 && r.top > r.height + 40);
    menu.current.querySelector<HTMLElement>("[role=menuitem]:not([disabled])")?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) onOpenChange(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);
  const key = (e: React.KeyboardEvent) => {
    const els = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") || [])];
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); els[els.length - 1]?.focus(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onOpenChange(false); btn.current?.focus(); }
    else if (e.key === "Tab") onOpenChange(false);
  };
  return (
    <span className="ag-menu-wrap" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <button ref={btn} type="button" className="ag-icon-btn" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(e) => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); onOpenChange(true); } }}>
        {trigger || <Icon d={AG_ICON.more} size={16} sw={2.4} />}
      </button>
      {open && (
        <div ref={menu} className={"ag-menu" + (align === "left" ? " ag-menu--left" : "") + (flipUp ? " ag-menu--up" : "")} role="menu" aria-label={label} onKeyDown={key}>
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" disabled={it.disabled} className={it.danger ? "ag-menu-danger" : undefined}
              title={it.note} onClick={() => { onOpenChange(false); it.run?.(); }}>
              <span>{it.label}</span>
              {it.disabled && it.note && <small>{it.note}</small>}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

/* ── Inputs a run may be given ─────────────────────────────────────────── */

export interface InputOption { kind: string; id: Id; label: string }

/** Objects the viewer can see and may hand to a run, grouped by kind. Disabled modules contribute nothing. */
export function inputOptions(q: Q): { kind: string; label: string; items: InputOption[] }[] {
  const s = q.s;
  const groups: { kind: string; label: string; items: InputOption[] }[] = [];
  const T = s.config.terminology;
  if (moduleEnabled(s.config, "projects")) {
    const items = s.data.projects.filter((p) => q.canSee({ ownerIds: [p.ownerId], teamId: p.teamId, unitId: p.unitId, visibility: p.visibility }))
      .map((p) => ({ kind: "project", id: p.id, label: p.title }));
    groups.push({ kind: "project", label: s.config.projects.label, items });
  }
  groups.push({ kind: "record", label: T.record, items: q.records({ ignoreScope: true }).slice(0, 60).map((r) => ({ kind: "record", id: r.id, label: r.ref + " " + r.title })) });
  groups.push({ kind: "file", label: "Document", items: q.files({ ignoreScope: true }).map((f) => ({ kind: "file", id: f.id, label: f.title })) });
  groups.push({ kind: "request", label: T.request, items: q.requests({ ignoreScope: true }).slice(0, 60).map((r) => ({ kind: "request", id: r.id, label: r.ref + " " + r.title })) });
  if (moduleEnabled(s.config, "standards")) {
    groups.push({ kind: "obligation", label: "Requirement evidence", items: s.data.obligations.filter((o) => o.state !== "missing").map((o) => ({ kind: "obligation", id: o.id, label: describeRef(s, { kind: "obligation", id: o.id }) + " (" + o.state.replace("_", " ") + ")" })) });
  }
  if (moduleEnabled(s.config, "purchasing") && can(q.viewer, "purchasing.manage")) {
    groups.push({ kind: "invoice", label: "Invoice", items: s.data.invoices.map((i) => ({ kind: "invoice", id: i.id, label: i.ref + " (" + i.status.replace("_", " ") + ")" })) });
  }
  return groups.filter((g) => g.items.length);
}

export const useWork = (q: Q, agentId: Id) => agentState(q, agentId);
