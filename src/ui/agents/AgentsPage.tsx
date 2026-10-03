/* Agents, in the original Pulse chat layout: the agent list with faces and
   previews on the left, the selected agent's conversation in the centre with
   its face and name at the top, and the composer at the bottom.
   Every thread is built from the shared core (see thread.ts): the agent's
   recorded actions, then a summary assembled from records the asker can see.
   Replies are sample answers from those records; no AI model is connected. */

import { useEffect, useMemo, useRef, useState } from "react";
import AgentFace from "../../components/AgentFace";
import { useCore, navigate, openObject } from "../../core";
import type { AgentDef } from "../../core";
import { PageFrame, Panel, Btn } from "../frame";
import { Icon, ICON } from "../kit";
import AgentDefinitionPanel from "./AgentDefinitionPanel";
import { agentAnswer, buildThread, whenOf, type Item, type Line } from "./thread";
import "../../styles/agents.css";

const SUGGESTIONS = ["What is overdue?", "What is waiting on approval?", "Any open data issues?", "What failed?", "What changed in the last day?"];

const PENCIL = "M12 20h9 M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z";
const GEAR = "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.9 1.2v.17a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-2.96-1.14l-.06.06A2 2 0 1 1 4.16 17l.06-.06A1.7 1.7 0 0 0 3 14.04H2.9a2 2 0 1 1 0-4h.17A1.7 1.7 0 0 0 4.22 7.1l-.06-.06A2 2 0 1 1 7 4.21l.06.06a1.7 1.7 0 0 0 2.9-1.2V2.9a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 2.9 1.2l.06-.06A2 2 0 1 1 19.75 7l-.06.06A1.7 1.7 0 0 0 21 10.04h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z";
const CLOCK = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7.6V12l3 1.8";
const MIC = "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z M6 11a6 6 0 0 0 12 0 M12 17v3";
const SEND = "M12 19V5 M5 12l7-7 7 7";
const CHEV = "m9 6 6 6-6 6";

export default function AgentsPage({ v }: { v?: { openBuilder?: () => void } }) {
  const { core, ctx, q } = useCore();
  const agents = core.config.agents;
  const [selId, setSelId] = useState<string | null>(agents[0]?.id || null);
  const [extra, setExtra] = useState<Record<string, Item[]>>({});
  const [seen, setSeen] = useState<Set<string>>(() => new Set(agents[0] ? [agents[0].id] : []));
  const [query, setQuery] = useState("");
  const [defOpen, setDefOpen] = useState(false);
  const sel = agents.find((a) => a.id === selId) || agents[0];

  const threads = useMemo(() => new Map(agents.map((a) => [a.id, buildThread(core, ctx, q, a)])), [agents, core, ctx, q]);

  if (!core.config.capabilities.agents) {
    return (
      <PageFrame>
        <Panel style={{ marginTop: 40 }}>
          <div className="pf-empty" style={{ borderTop: 0 }}>
            <b>Agents are switched off</b>
            <span>This organisation has the agents capability turned off. An administrator can switch it on in Settings, under Enabled views.</span>
            <div style={{ marginTop: 16 }}><Btn onClick={() => navigate({ page: "Settings", section: "views" })}>Open Enabled views</Btn></div>
          </div>
        </Panel>
      </PageFrame>
    );
  }

  if (!agents.length || !sel) {
    return (
      <div className="ag-root">
        <aside className="ag-list" aria-label="Agents">
          <ListHead onNew={v?.openBuilder} />
          <div className="ag-list-empty">No agents yet.</div>
        </aside>
        <section className="ag-main ag-main--empty" aria-label="No agents">
          <AgentFace shape="crown-pebble" tint="#191c1f" state="idle" size={56} />
          <div className="ag-empty-t">No agents set up</div>
          <div className="ag-empty-b">Each agent has a purpose, a responsible person, a data scope and the actions it may take or must ask approval for. Set one up in Settings, under Agent controls.</div>
          <Btn primary onClick={() => navigate({ page: "Settings", section: "agents" })}>Set up an agent</Btn>
        </section>
      </div>
    );
  }

  const needle = query.trim().toLowerCase();
  const shown = needle ? agents.filter((a) => (a.name + " " + a.purpose).toLowerCase().includes(needle)) : agents;
  const pick = (id: string) => { setSelId(id); setSeen((s) => new Set(s).add(id)); };
  const base = threads.get(sel.id)!;
  const items = [...base.items, ...(extra[sel.id] || [])];

  const send = (text: string) => {
    const question = text.trim();
    if (!question || !sel.enabled) return;
    const res = agentAnswer(core, ctx, sel, question);
    const n = (extra[sel.id] || []).length;
    setExtra((x) => ({ ...x, [sel.id]: [...(x[sel.id] || []),
      { kind: "user", id: "u" + n, text: question },
      { kind: "agent", id: "a" + n, text: res.text, answer: res, notes: res.limitations.filter((l) => !/No AI model is connected/.test(l)) }] }));
  };

  return (
    <div className="ag-root">
      <aside className="ag-list" aria-label="Agents">
        <ListHead onNew={v?.openBuilder} />
        <div className="ag-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="m21 21-4.3-4.3 M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0" /></svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search agents" />
          {query && (
            <button type="button" className="ag-search-x" onClick={() => setQuery("")} aria-label="Clear search">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12 M18 6 6 18" /></svg>
            </button>
          )}
        </div>
        <div className="ag-list-b" role="list">
          {shown.map((a) => {
            const t = threads.get(a.id)!;
            const mine = extra[a.id] || [];
            const last = mine[mine.length - 1];
            const unread = a.id !== sel.id && t.recent && !seen.has(a.id);
            return (
              <button key={a.id} type="button" role="listitem" className="ag-row" aria-current={a.id === sel.id || undefined} onClick={() => pick(a.id)}>
                {unread && <span className="ag-unread" aria-label="New activity" />}
                <span className="ag-row-face"><AgentFace shape={a.shape} tint={a.tint} state={a.enabled ? "complete" : "idle"} size={44} /></span>
                <span className="ag-row-body">
                  <span className="ag-row-top">
                    <span className="ag-row-name">{a.name}</span>
                    <span className="ag-row-when">{a.enabled ? whenOf(t.lastAt, ctx.now, core.config.timezone) : "Disabled"}</span>
                  </span>
                  <span className="ag-row-prev">{last && (last.kind === "user" || last.kind === "agent") ? (last.kind === "user" ? "You: " : "") + last.text : t.preview}</span>
                </span>
              </button>
            );
          })}
          {shown.length === 0 && <div className="ag-list-empty">No agent matches that search.</div>}
        </div>
      </aside>

      <Conversation key={sel.id} agent={sel} items={items} onSend={send} onDefinition={() => setDefOpen(true)} />
      <AgentDefinitionPanel agent={sel} open={defOpen} onClose={() => setDefOpen(false)} />
    </div>
  );
}

function ListHead({ onNew }: { onNew?: () => void }) {
  return (
    <div className="ag-list-h">
      <span className="ag-list-t">Agents</span>
      <button type="button" className="ag-round" onClick={onNew} disabled={!onNew}
        title={onNew ? "New agent: opens the agent builder. Administrators can save it into the organisation's agents." : "The agent builder is not available here"} aria-label="New agent">
        <Icon d={PENCIL} size={15} sw={1.8} />
      </button>
    </div>
  );
}

function Conversation({ agent, items, onSend, onDefinition }: { agent: AgentDef; items: Item[]; onSend: (t: string) => void; onDefinition: () => void }) {
  const [draft, setDraft] = useState("");
  const [tips, setTips] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const count = items.length;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  const has = draft.trim().length > 0;
  const submit = (text: string) => { if (!agent.enabled) return; onSend(text); setDraft(""); setTips(false); };

  return (
    <section className="ag-main" aria-label={"Conversation with " + agent.name}>
      <header className="ag-head">
        <AgentFace shape={agent.shape} tint={agent.tint} state={agent.enabled ? "complete" : "idle"} size={48} />
        <button type="button" className="ag-name" onClick={onDefinition} title={"What " + agent.name + " is for, what it may do and who answers for it"}>
          {agent.name}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={CHEV} /></svg>
        </button>
        <div className="ag-purpose">{agent.purpose}</div>
        <button type="button" className="ag-round ag-gear" onClick={onDefinition} title="Agent definition" aria-label={"Definition of " + agent.name}>
          <Icon d={GEAR} size={13} sw={1.7} />
        </button>
      </header>

      <div ref={scroller} className="ag-thread" aria-live="polite">
        {items.map((m) => <ThreadItem key={m.id} m={m} />)}
      </div>

      {tips && agent.enabled && (
        <div className="ag-tips" aria-label="Suggested questions">
          {SUGGESTIONS.map((s) => <button key={s} type="button" className="ag-tip" onClick={() => submit(s)}>{s}</button>)}
        </div>
      )}
      <form className="ag-compose" onSubmit={(e) => { e.preventDefault(); if (has) submit(draft); }}>
        <button type="button" className="ag-round ag-plus" onClick={() => setTips((t) => !t)} disabled={!agent.enabled}
          aria-pressed={tips} title={agent.enabled ? "Suggested questions" : agent.name + " is disabled"} aria-label="Suggested questions">
          <Icon d={ICON.plus} size={16} sw={2} />
        </button>
        <div className="ag-field">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} disabled={!agent.enabled}
            placeholder={agent.enabled ? "Message " + agent.name : agent.name + " is disabled. An administrator can enable it in Settings."}
            aria-label={"Message " + agent.name} />
          <button type={has ? "submit" : "button"} className="ag-send" data-on={has} disabled={!has || !agent.enabled}
            title={has ? "Send" : "Voice input is not connected. Type a message to send."} aria-label={has ? "Send" : "Voice input not connected"}>
            <span className="ag-send-i">
              <span className="ag-send-mic"><Icon d={MIC} size={15} sw={1.8} /></span>
              <span className="ag-send-go"><Icon d={SEND} size={15} sw={2.1} /></span>
            </span>
          </button>
        </div>
      </form>
    </section>
  );
}

function LineRow({ l }: { l: Line }) {
  const body = (
    <>
      <span className="ag-line-tick"><Icon d={ICON.check} size={13} sw={2.2} /></span>
      <span className="ag-line-t">
        <span className="ag-line-k">{l.k}</span>
        <span className="ag-line-arrow"><Icon d={ICON.arrow} size={11} sw={1.9} /></span>
        {l.v}
      </span>
    </>
  );
  const go = l.cite ? () => openObject(l.cite!.kind, l.cite!.id) : l.nav ? () => navigate(l.nav!) : null;
  return go
    ? <button type="button" className="ag-line ag-line--btn" onClick={go} title={l.cite ? "Open " + l.cite.label : "Open"}>{body}</button>
    : <div className="ag-line">{body}</div>;
}

function ThreadItem({ m }: { m: Item }) {
  if (m.kind === "stamp") return <div className="ag-stamp">{m.text}</div>;
  if (m.kind === "note") return <div className="ag-sample">{m.text}</div>;
  if (m.kind === "routine") {
    return (
      <div className="ag-routine-wrap">
        <button type="button" className="ag-routine" onClick={() => openObject("event", m.eventId)} title="Open this action in Activity">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={CLOCK} /></svg>
          <span>{m.label}</span>
          <span className="ag-routine-n">{m.name}</span>
        </button>
      </div>
    );
  }
  if (m.kind === "user") {
    return <div className="ag-msg ag-msg--user"><div className="ag-bubble ag-bubble--user">{m.text}</div></div>;
  }
  const a = m.answer;
  const replyLines: Line[] = a?.rows ? a.rows.map((r) => ({ k: r[0], v: r.slice(1).join(", ") })) : [];
  const lines = m.lines || replyLines;
  return (
    <div className="ag-msg">
      <div className="ag-bubble">
        {m.text}
        {lines.length > 0 && <div className="ag-lines">{lines.map((l, i) => <LineRow key={i} l={l} />)}</div>}
        {a && a.citations.length > 0 && (
          <div className="ag-cites" aria-label="Evidence">
            {a.citations.map((c) => (
              <button key={c.kind + c.id} type="button" className="ag-cite" onClick={() => openObject(c.kind, c.id)} title={c.kind === "event" ? "Open this event in Activity" : "Open " + c.label}>
                <span>{c.label}</span><Icon d={ICON.arrow} size={10} sw={2} />
              </button>
            ))}
          </div>
        )}
        {m.notes && m.notes.length > 0 && <ul className="ag-limits">{m.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      </div>
    </div>
  );
}
