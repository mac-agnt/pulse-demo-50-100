/* The agent conversation, in the original Pulse chat style, inside the agent's
   panel. Built from the shared core (thread.ts): the agent's recorded actions,
   then a summary from records the asker can see. Replies are sample answers;
   no AI model is connected. */

import { useEffect, useMemo, useRef, useState } from "react";
import { availabilityOf, navigate, openObject, useCore, type AgentDef } from "../../core";
import { Icon, ICON } from "../kit";
import { agentAnswer, buildThread, type Item, type Line } from "./thread";

const SUGGESTIONS = ["What is overdue?", "What is waiting on approval?", "Any open data issues?", "What failed?", "What changed in the last day?"];
const CLOCK = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7.6V12l3 1.8";
const MIC = "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z M6 11a6 6 0 0 0 12 0 M12 17v3";
const SEND = "M12 19V5 M5 12l7-7 7 7";

/* Messages typed in this session, per agent, so reopening the panel keeps them. */
const sessionExtra: Record<string, Item[]> = {};

export function Conversation({ agent }: { agent: AgentDef }) {
  const { core, ctx, q } = useCore();
  const [extra, setExtra] = useState<Item[]>(sessionExtra[agent.id] || []);
  const [draft, setDraft] = useState("");
  const [tips, setTips] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const base = useMemo(() => buildThread(core, ctx, q, agent), [core, ctx, q, agent]);
  const items = [...base.items, ...extra];
  const ready = availabilityOf(agent) === "ready" && !agent.archived;
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [items.length]);

  const send = (text: string) => {
    const question = text.trim();
    if (!question || !ready) return;
    const res = agentAnswer(core, ctx, agent, question);
    const n = extra.length;
    const next: Item[] = [...extra, { kind: "user", id: "u" + n, text: question },
      { kind: "agent", id: "a" + n, text: res.text, answer: res, notes: res.limitations.filter((l) => !/No AI model is connected/.test(l)) }];
    sessionExtra[agent.id] = next;
    setExtra(next);
    setDraft("");
    setTips(false);
  };
  const has = draft.trim().length > 0;

  return (
    <section className="ag-conv" aria-label={"Conversation with " + agent.name}>
      <div ref={scroller} className="ag-thread" aria-live="polite">
        {items.map((m) => <ThreadItem key={m.id} m={m} />)}
      </div>
      {tips && ready && (
        <div className="ag-tips" aria-label="Suggested questions">
          {SUGGESTIONS.map((s) => <button key={s} type="button" className="ag-tip" onClick={() => send(s)}>{s}</button>)}
        </div>
      )}
      <form className="ag-compose" onSubmit={(e) => { e.preventDefault(); if (has) send(draft); }}>
        <button type="button" className="ag-round" onClick={() => setTips((t) => !t)} disabled={!ready} aria-pressed={tips}
          title={ready ? "Suggested questions" : agent.name + " is not ready"} aria-label="Suggested questions">
          <Icon d={ICON.plus} size={16} sw={2} />
        </button>
        <div className="ag-field">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} disabled={!ready}
            placeholder={ready ? "Message " + agent.name : agent.name + " is not ready, so it is not answering."} aria-label={"Message " + agent.name} />
          <button type={has ? "submit" : "button"} className="ag-send" data-on={has} disabled={!has || !ready}
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
      <span className="ag-line-t"><span className="ag-line-k">{l.k}</span><span className="ag-line-arrow"><Icon d={ICON.arrow} size={11} sw={1.9} /></span>{l.v}</span>
    </>
  );
  const go = l.cite ? () => openObject(l.cite!.kind, l.cite!.id) : l.nav ? () => navigate(l.nav!) : null;
  return go ? <button type="button" className="ag-line ag-line--btn" onClick={go} title={l.cite ? "Open " + l.cite.label : "Open"}>{body}</button> : <div className="ag-line">{body}</div>;
}

function ThreadItem({ m }: { m: Item }) {
  if (m.kind === "stamp") return <div className="ag-stamp">{m.text}</div>;
  if (m.kind === "note") return <div className="ag-sample">{m.text}</div>;
  if (m.kind === "routine") {
    return (
      <div className="ag-routine-wrap">
        <button type="button" className="ag-routine" onClick={() => openObject("event", m.eventId)} title="Open this action in Activity">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={CLOCK} /></svg>
          <span>{m.label}</span><span className="ag-routine-n">{m.name}</span>
        </button>
      </div>
    );
  }
  if (m.kind === "user") return <div className="ag-msg ag-msg--user"><div className="ag-bubble ag-bubble--user">{m.text}</div></div>;
  const a = m.answer;
  const lines = m.lines || (a?.rows ? a.rows.map((r) => ({ k: r[0], v: r.slice(1).join(", ") })) : []);
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
