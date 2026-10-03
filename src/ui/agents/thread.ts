/* Builds each agent's conversation from the shared core. Nothing here is
   canned: day stamps and routine rows come from the agent's own audit events,
   and the summary is assembled with answer() for that agent's purpose, inside
   the agent's data scope. No AI model is connected. */

import { answer, scopeLabel, scopeTeams, localDay, fmtDate, ms, DAY } from "../../core";
import type { AgentDef, Answer, Citation, CoreState, Ctx, Id, NavTarget } from "../../core";
import type { Q } from "../../core/query";
import { leaveInWindow } from "../../core/people";
import { attention } from "../selectors";
import { actionLabel, objectResolver } from "../activity/eventInfo";

export const SAMPLE_LABEL = "Sample answer from your records. No AI model is connected.";
const SAMPLE_NOTE = "Sample response built from the records you can see. No AI model is connected.";

export interface Line { k: string; v: string; cite?: Citation; nav?: NavTarget }

export type Item =
  | { kind: "stamp"; id: string; text: string }
  | { kind: "routine"; id: string; label: string; name: string; eventId: string }
  | { kind: "note"; id: string; text: string }
  | { kind: "agent"; id: string; text: string; lines?: Line[]; answer?: Answer; notes?: string[] }
  | { kind: "user"; id: string; text: string };

export type Role = "briefing" | "steward" | "intake" | "general";

/** What the agent is for, read from its own definition. */
export function agentRole(a: AgentDef): Role {
  const t = (a.name + " " + a.purpose + " " + a.permittedActions.join(" ")).toLowerCase();
  if (/brief|summar|what changed|digest/.test(t)) return "briefing";
  if (/data issue|missing|conflict|duplicate|quality|steward/.test(t)) return "steward";
  if (/request|draft|intake/.test(t)) return "intake";
  return "general";
}

export function teamsText(s: CoreState, a: AgentDef): string {
  if (a.scope.teamIds === "all") return "All teams the asker can see";
  if (!a.scope.teamIds.length) return "No teams";
  return andList(a.scope.teamIds.map((id) => s.config.teams.find((t) => t.id === id)?.label || "Unknown"));
}

const andList = (xs: string[]) => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];

/** Teams a team-limited agent may read in the selected scope; null when the agent is not limited. */
export function agentTeams(s: CoreState, ctx: Ctx, a: AgentDef): Id[] | null {
  if (a.scope.teamIds === "all") return null;
  const sel = scopeTeams(s, ctx.scope);
  const allowed = a.scope.teamIds;
  if (sel && sel.length && sel.every((t) => allowed.includes(t))) return null;
  return sel ? allowed.filter((t) => sel.includes(t)) : allowed;
}

/** answer() inside the agent's data scope. A team-limited agent answers for
    its own teams only and says so, rather than refusing. */
export function agentAnswer(s: CoreState, ctx: Ctx, a: AgentDef, question: string): Answer {
  const teams = agentTeams(s, ctx, a);
  if (!teams) return answer(s, ctx, question);
  const scope = scopeLabel(s, ctx.scope);
  const covers = teamsText(s, a);
  if (!teams.length) {
    return { text: a.name + " only covers " + covers + ", and none of those is in " + scope + ". Switch the scope at the top to one of them to ask it about that work.",
      citations: [], scope, period: "Now", sample: true, limitations: [SAMPLE_NOTE] };
  }
  const parts = teams.map((id) => answer(s, { ...ctx, scope: { kind: "team", id } }, question));
  const seen = new Set<string>();
  const citations = parts.flatMap((p) => p.citations).filter((c) => { const k = c.kind + ":" + c.id; if (seen.has(k)) return false; seen.add(k); return true; });
  const limits = [...new Set(parts.flatMap((p) => p.limitations))];
  return {
    text: parts.map((p) => p.text).join(" "),
    cols: parts[0].cols,
    rows: parts.flatMap((p) => p.rows || []).slice(0, 8),
    citations: citations.slice(0, 8),
    scope: andList(teams.map((id) => s.config.teams.find((t) => t.id === id)?.label || "Unknown")),
    period: parts[0].period,
    sample: true,
    limitations: [...limits, a.name + " only covers " + covers + ", so this answer leaves out the rest of " + scope + "."]
  };
}

const extraNotes = (a: Answer) => a.limitations.filter((l) => l !== SAMPLE_NOTE);

/** The summary message for the agent's purpose. */
function summary(s: CoreState, ctx: Ctx, q: Q, a: AgentDef): { text: string; lines: Line[]; notes: string[]; follow?: string } {
  const role = agentRole(a);
  const teams = agentTeams(s, ctx, a);
  const inTeams = (teamId?: Id) => !teams || (!!teamId && teams.includes(teamId));

  if (role === "briefing") {
    const changed = agentAnswer(s, ctx, a, "what changed in the last day");
    const work = agentAnswer(s, ctx, a, "what is overdue");
    const dec = agentAnswer(s, ctx, a, "what is waiting on approval");
    const data = agentAnswer(s, ctx, a, "open data issues");
    const away = leaveInWindow(q, 0, 0).filter((x) => inTeams(x.row.e.teamId));
    const names = away.slice(0, 3).map((x) => x.row.person.name);
    const lines: Line[] = [
      { k: "Work", v: work.text, cite: work.citations[0], nav: work.citations[0] ? undefined : { page: "Work", section: "tasks" } },
      { k: "Decisions", v: dec.text, cite: dec.citations[0], nav: dec.citations[0] ? undefined : { page: "Work", section: "approvals" } },
      { k: "Data quality", v: data.text, cite: data.citations[0], nav: data.citations[0] ? undefined : { page: "Records", section: "quality" } },
      { k: "People away", nav: { page: "Work", section: "people" },
        v: away.length ? away.length + " on approved leave today: " + names.join(", ") + (away.length > names.length ? " and " + (away.length - names.length) + " more" : "") + "."
          : "Nobody is on approved leave today." }
    ];
    let follow: string | undefined;
    if (!teams) {
      const mine = attention(q).filter((i) => i.ownerId === ctx.viewerId);
      follow = mine.length === 0 ? "Nothing in the attention list sits with you right now."
        : mine.length === 1 ? "One thing needs you: " + mine[0].title + "."
        : mine.length + " things need you, starting with " + mine[0].title + " and " + mine[1].title + ".";
    }
    return { text: changed.text, lines, notes: [...new Set([...extraNotes(changed), ...extraNotes(work), ...extraNotes(dec), ...extraNotes(data)])], follow };
  }

  if (role === "steward") {
    const res = agentAnswer(s, ctx, a, "open data issues");
    const lines = (res.rows || []).map((r, i): Line => ({ k: r[1], v: r[0] + ", with " + r[2], cite: res.citations[i] }));
    return { text: res.text, lines, notes: extraNotes(res) };
  }

  if (role === "intake") {
    const dec = agentAnswer(s, ctx, a, "what is waiting on approval");
    const drafts = q.requests().filter((r) => r.status === "draft" && inTeams(r.teamId));
    const lines: Line[] = [
      ...(dec.rows || []).map((r, i): Line => ({ k: "Decision", v: r[0] + ", with " + r[1] + ", waiting since " + r[2], cite: dec.citations[i] })),
      ...drafts.slice(0, 6).map((r): Line => ({ k: "Draft", v: r.ref + " " + r.title + ", not submitted yet", cite: { kind: "request", id: r.id, label: r.ref } }))
    ];
    const pending = q.approvals().filter((ap) => ap.status === "pending" && inTeams(s.data.requests.find((r) => r.id === ap.requestId)?.teamId));
    const decText = pending.length ? pending.length + " decision" + (pending.length === 1 ? " is" : "s are") + " pending in " + dec.scope + "."
      : "No decisions are pending in " + dec.scope + ".";
    const draftText = drafts.length ? drafts.length + " draft request" + (drafts.length === 1 ? " has" : "s have") + " not been submitted yet."
      : "No draft requests are waiting to be submitted.";
    return { text: teams && !teams.length ? dec.text : decText + " " + draftText, lines, notes: extraNotes(dec) };
  }

  const res = agentAnswer(s, ctx, a, a.purpose);
  const lines = (res.rows || []).map((r, i): Line => ({ k: r[0], v: r.slice(1).join(", "), cite: res.citations[i] }));
  return { text: res.text, lines, notes: extraNotes(res) };
}

/** Day stamp in the original style: "Today 08:00", "Yesterday 14:12", "Mon 3 Mar 09:30". */
export function stampOf(at: string, now: string, tz: string): string {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(at));
  const day = localDay(at, tz);
  if (day === localDay(now, tz)) return "Today " + time;
  if (day === localDay(new Date(ms(now) - DAY).toISOString(), tz)) return "Yesterday " + time;
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short" }).format(new Date(at));
  return wd + " " + fmtDate(at, tz) + " " + time;
}

/** List time: "09:12" today, "Yesterday", a weekday within the week, else a date. */
export function whenOf(at: string | undefined, now: string, tz: string): string {
  if (!at) return "";
  const day = localDay(at, tz);
  if (day === localDay(now, tz)) return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(at));
  if (day === localDay(new Date(ms(now) - DAY).toISOString(), tz)) return "Yesterday";
  if (ms(now) - ms(at) < 6 * DAY) return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short" }).format(new Date(at));
  return fmtDate(at, tz);
}

export interface AgentThread { items: Item[]; lastAt?: string; preview: string; recent: boolean }

/** The agent's thread: its recorded actions, then a summary built now. */
export function buildThread(s: CoreState, ctx: Ctx, q: Q, a: AgentDef): AgentThread {
  const tz = s.config.timezone;
  const resolve = objectResolver(q);
  const events = q.events().filter((e) => e.actorId === a.id).sort((x, y) => x.at.localeCompare(y.at)).slice(-6);
  const items: Item[] = [];
  let day = "";
  for (const e of events) {
    const d = localDay(e.at, tz);
    if (d !== day) { items.push({ kind: "stamp", id: "st-" + e.id, text: stampOf(e.at, ctx.now, tz) }); day = d; }
    const routine = e.action === "schedule.ran";
    items.push({ kind: "routine", id: "rt-" + e.id, eventId: e.id,
      label: routine ? "Ran routine" : actionLabel(e.action), name: resolve(e).label });
  }
  if (localDay(ctx.now, tz) !== day) items.push({ kind: "stamp", id: "st-now", text: stampOf(ctx.now, ctx.now, tz) });
  items.push({ kind: "note", id: "note", text: SAMPLE_LABEL });

  let preview: string;
  if (!a.enabled) {
    preview = a.name + " is disabled.";
    items.push({ kind: "agent", id: "sum", text: a.name + " is disabled, so it has not built a summary. " + a.purpose });
  } else {
    const sum = summary(s, ctx, q, a);
    items.push({ kind: "agent", id: "sum", text: sum.text, lines: sum.lines, notes: sum.notes });
    if (sum.follow) items.push({ kind: "agent", id: "sum-2", text: sum.follow });
    preview = sum.text;
  }
  const lastAt = events.length ? events[events.length - 1].at : undefined;
  return { items, lastAt, preview, recent: !!lastAt && ms(ctx.now) - ms(lastAt) < DAY };
}
