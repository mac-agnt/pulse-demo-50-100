/* Comments and @mentions on one object (record, request, task, project,
   invoice or agent run). One component, one op (ops.addComment): there is no
   second chat app. Mentions resolve to people by full name; the op records
   who was mentioned and writes an audit event grouped under the object. */

import { useMemo, useRef, useState } from "react";
import { useCore, ops, store, can, fmtDateTime, relative } from "../../core";
import type { Comment, Person } from "../../core";
import { Button, PersonName } from "../kit";
import "../../styles/work.css";

type ObjectType = Comment["objectType"];

/** Show the text with known @mentions marked. */
function Body({ c }: { c: Comment }) {
  const { core } = useCore();
  const names = c.mentions.map((id) => core.data.people.find((p) => p.id === id)?.name).filter((n): n is string => !!n);
  if (!names.length) return <>{c.text}</>;
  const esc = names.map((n) => ("@" + n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = c.text.split(new RegExp("(" + esc.join("|") + ")", "g"));
  return <>{parts.map((p, i) => (i % 2 ? <span key={i} className="cm-mention">{p}</span> : <span key={i}>{p}</span>))}</>;
}

export function Comments({ objectType, objectId, label = "Comments" }: { objectType: ObjectType; objectId: string; label?: string }) {
  const { core, ctx, q } = useCore();
  const tz = core.config.timezone;
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const may = can(q.viewer, "comments.write");
  const list = (core.data.comments || []).filter((c) => c.objectType === objectType && c.objectId === objectId).sort((a, b) => a.at.localeCompare(b.at));

  /* "@Ja" at the end of the text suggests active staff whose name starts with it. */
  const partial = /(^|\s)@([\p{L}][\p{L} ]{0,30})$/u.exec(text)?.[2] || (/(^|\s)@$/.test(text) ? "" : null);
  const suggestions: Person[] = useMemo(() => partial === null ? [] : core.data.people
    .filter((p) => p.kind === "staff" && p.status !== "suspended" && p.name.toLowerCase().startsWith(partial.toLowerCase()) && !text.endsWith("@" + p.name))
    .slice(0, 5), [partial, core.data.people, text]);

  const pick = (p: Person) => {
    const at = text.lastIndexOf("@");
    setText(text.slice(0, at) + "@" + p.name + " ");
    box.current?.focus();
  };

  const send = () => {
    const res = store.run(ops.addComment, objectType, objectId, text);
    if (res.ok) { setText(""); setErr(null); } else setErr(res.error);
  };

  return (
    <section className="cm" aria-label={label}>
      {list.length === 0 ? <div className="wk-muted">No comments yet.</div> : (
        <ol className="cm-list">
          {list.map((c) => (
            <li key={c.id} className="cm-item">
              <div className="cm-head">
                <PersonName id={c.by} />
                <span className="cm-when" title={fmtDateTime(c.at, tz)}>{relative(c.at, ctx.now, tz)}</span>
              </div>
              <div className="cm-text"><Body c={c} /></div>
              {c.mentions.length > 0 && <div className="wk-small">Mentioned: {c.mentions.map((id) => q.name(id)).join(", ")}</div>}
            </li>
          ))}
        </ol>
      )}
      {may ? (
        <div className="cm-compose">
          <label className="pk-label" htmlFor={"cm-" + objectId}>Add a comment</label>
          <textarea ref={box} id={"cm-" + objectId} className="pk-textarea cm-input" rows={2} value={text} maxLength={2000}
            placeholder="Type @ and a name to mention someone"
            onChange={(e) => { setText(e.target.value); if (err) setErr(null); }}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }} />
          {suggestions.length > 0 && (
            <div className="cm-suggest" role="group" aria-label="Mention someone">
              {suggestions.map((p) => <button key={p.id} type="button" className="cm-chip" onClick={() => pick(p)}>@{p.name}</button>)}
            </div>
          )}
          <div className="wk-row" style={{ marginTop: 8 }}>
            <span className="wk-small pk-grow">Mentioned people see it in their notifications. Nothing is emailed from this demo.</span>
            <Button size="sm" variant="primary" disabled={!text.trim()} title={text.trim() ? undefined : "Write something first"} onClick={send}>Comment</Button>
          </div>
          {err && <div className="pk-error wk-inline-err" role="alert">{err}</div>}
        </div>
      ) : <div className="wk-small" style={{ marginTop: 8 }}>Your role cannot comment.</div>}
    </section>
  );
}

export default Comments;
