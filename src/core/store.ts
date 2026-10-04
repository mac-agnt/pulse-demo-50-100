/* Demo adapter. Holds the core state in the browser, persists it to
   localStorage and exposes it to React. It stands in for a backend: swap it
   for API calls in production and keep the ops/query/metric modules as the
   shared rules (a real backend must enforce them server-side). */

import { useSyncExternalStore } from "react";
import { cleanState, CLEAN_DEFAULT_VIEWER } from "./fixtures/clean";
import { sampleState, SAMPLE_DEFAULT_VIEWER } from "./fixtures/sample";
import { query, type Q } from "./query";
import { scopeLabel, scopeOptions, validScope, viewerOf } from "./access";
import { iso, ms } from "./time";
import type { CoreState, Ctx, ScopeSel } from "./types";
import type { Result } from "./ops";

export interface Focus {
  kind: "record" | "task" | "approval" | "run" | "issue" | "file" | "request" | "metric" | "ids" | "event" | "schedule"
    | "project" | "milestone" | "agent" | "agentRun" | "invoice" | "order" | "obligation" | "budget" | "person" | "supplier" | "unit" | "team" | "appointment";
  id?: string;
  ids?: string[];
  label?: string;
  entity?: string;
}

export interface Session {
  viewerId: string;
  scope: ScopeSel;
  /** Real time the session started, so the demo clock moves forward from the reference date. */
  startedAt: number;
  homeView: "personal" | "management" | null;
  focus: Focus | null;
  scopeNotice: string | null;
  toast: { id: number; text: string; kind: "ok" | "error" } | null;
}

interface Snapshot { core: CoreState; session: Session; ctx: Ctx; q: Q }

/* v2: adds projects, finance, purchasing, standards and agent runs. Older saved state is not migrated; the sample loads fresh. */
const KEY = "pulse.core.v3";
const SKEY = "pulse.session.v3";

function freshSession(core: CoreState): Session {
  const viewerId = core.mode === "sample" ? SAMPLE_DEFAULT_VIEWER : CLEAN_DEFAULT_VIEWER;
  const opts = scopeOptions(core, viewerOf(core, viewerId));
  return { viewerId, scope: opts[Math.min(1, opts.length - 1)].sel, startedAt: Date.now(), homeView: null, focus: null, scopeNotice: null, toast: null };
}

function load(): { core: CoreState; session: Session } {
  try {
    const raw = localStorage.getItem(KEY);
    const sraw = localStorage.getItem(SKEY);
    if (raw) {
      const core = JSON.parse(raw) as CoreState;
      const session = sraw ? { ...freshSession(core), ...JSON.parse(sraw), focus: null, toast: null } as Session : freshSession(core);
      if (core?.data && core.config) return { core, session };
    }
  } catch { /* storage blocked or corrupt: fall through to fixtures */ }
  const core = sampleState();
  return { core, session: freshSession(core) };
}

let { core, session } = load();
const listeners = new Set<() => void>();
let snap: Snapshot | null = null;

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(core));
    const { focus: _f, toast: _t, scopeNotice: _n, ...rest } = session;
    localStorage.setItem(SKEY, JSON.stringify(rest));
  } catch { /* private mode: state lives for this tab only */ }
}

export function nowFor(c: CoreState, sess: Session): string {
  if (c.mode === "clean") return new Date().toISOString();
  return iso(ms(c.config.referenceDate) + (Date.now() - sess.startedAt));
}

function emit() {
  snap = null;
  persist();
  listeners.forEach((l) => l());
}

export const store = {
  get(): Snapshot {
    if (!snap) {
      const ctx: Ctx = { viewerId: session.viewerId, scope: session.scope, now: nowFor(core, session) };
      snap = { core, session, ctx, q: query(core, ctx) };
    }
    return snap;
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
  /** Run an operation as the current viewer. The result's message becomes a toast. */
  run<A extends unknown[]>(op: (s: CoreState, ctx: Ctx, ...args: A) => Result, ...args: A): Result {
    const { ctx } = store.get();
    const res = op(core, ctx, ...args);
    if (res.ok) {
      core = res.state;
      if (res.message) session = { ...session, toast: { id: Date.now(), text: res.message, kind: "ok" } };
    } else {
      session = { ...session, toast: { id: Date.now(), text: res.error, kind: "error" } };
    }
    emit();
    return res;
  },
  setSession(patch: Partial<Session>) {
    session = { ...session, ...patch };
    emit();
  },
  toast(text: string, kind: "ok" | "error" = "ok") {
    session = { ...session, toast: { id: Date.now(), text, kind } };
    emit();
  },
  setViewer(viewerId: string) {
    const v = viewerOf(core, viewerId);
    const res = validScope(core, v, session.scope);
    const before = scopeLabel(core, session.scope);
    session = { ...session, viewerId, scope: res.sel, homeView: null,
      scopeNotice: res.changed ? before + " is not available to " + v.person.name + ", so the view switched to " + scopeLabel(core, res.sel) + "." : null };
    emit();
  },
  setScope(scope: ScopeSel) {
    session = { ...session, scope, scopeNotice: null };
    emit();
  },
  reset(mode: "sample" | "clean") {
    core = mode === "sample" ? sampleState() : cleanState();
    session = freshSession(core);
    emit();
  },
  /** Re-check the scope after organisation changes (role or membership edits). */
  revalidate() {
    const v = viewerOf(core, session.viewerId);
    const res = validScope(core, v, session.scope);
    if (res.changed) {
      session = { ...session, scope: res.sel, scopeNotice: "Your access changed, so the view switched to " + scopeLabel(core, res.sel) + "." };
      emit();
    }
  }
};

export function useCore(): Snapshot {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
