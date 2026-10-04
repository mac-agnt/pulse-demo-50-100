/* Project > Files and updates: linked documents with their versions (and the
   evidence held for its gates and tasks), dated progress updates, comments
   with @mentions, and the project's one linked history (every event whose
   story is this project). */

import { useState } from "react";
import {
  linkProjectFile, ops, openObject, postProjectUpdate, projectStory, projectTasks, store, OBLIGATION_STATE_TEXT, PROJECT_HEALTH_LABEL,
  type FileDoc, type Health, type Project
} from "../../core";
import { Button, Field, PersonName, Select, SidePanel, TextArea } from "../kit";
import { Faint, HealthChip, useProjectsCtx } from "./shared";

export function FilesTab({ p, canChange, onPostUpdate }: { p: Project; canChange: boolean; onPostUpdate: () => void }) {
  const { core, q, d, T } = useProjectsCtx();
  const [pick, setPick] = useState("");
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);

  type Row = { f: FileDoc; why: string; linked: boolean; version?: number };
  const rows: Row[] = [];
  const add = (id: string, why: string, linked: boolean, version?: number) => {
    const f = q.file(id);
    if (f && !rows.some((r) => r.f.id === id && r.why === why)) rows.push({ f, why, linked, version });
  };
  (p.fileIds || []).forEach((id) => add(id, "Linked to the project", true));
  const gateObs = core.data.milestones.filter((m) => m.projectId === p.id && m.gate).flatMap((m) => m.gate!.obligationIds.map((id) => ({ m, ob: core.data.obligations.find((o) => o.id === id) })));
  for (const { m, ob } of gateObs) {
    if (ob?.evidence) {
      const req = core.config.standards.requirements.find((r) => r.id === ob.requirementId);
      add(ob.evidence.fileId, "Evidence for " + (req?.label || "a requirement") + " (gate on “" + m.label + "”): version " + ob.evidence.version + " received " + d(ob.evidence.receivedAt) + ", " + OBLIGATION_STATE_TEXT[ob.state].toLowerCase(), false, ob.evidence.version);
    }
  }
  for (const t of projectTasks(core, p.id)) t.evidenceFileIds.forEach((id) => add(id, "Evidence on task “" + t.title + "”", false));
  const hiddenLinked = (p.fileIds || []).filter((id) => !q.file(id)).length;
  const linkable = q.files({ ignoreScope: true }).filter((f) => !(p.fileIds || []).includes(f.id));

  const updates = core.data.projectUpdates.filter((u) => u.projectId === p.id).sort((a, b) => b.at.localeCompare(a.at));
  const comments = core.data.comments.filter((c) => c.objectType === "project" && c.objectId === p.id).sort((a, b) => a.at.localeCompare(b.at));
  const story = projectStory(p.id);
  /* The project's own story. Anyone who can see the project sees its history, including
     changes made by others (the Activity page applies its own event rules). */
  const taskIds = new Set(projectTasks(core, p.id).map((t) => t.id));
  const history = core.data.events.filter((e) => e.storyKey === story || e.objectId === p.id || (e.objectType === "task" && taskIds.has(e.objectId)))
    .sort((a, b) => b.at.localeCompare(a.at));
  const inActivity = new Set(q.events({ ignoreScope: true }).map((e) => e.id));

  const post = () => {
    const r = store.run(ops.addComment, "project", p.id, comment);
    if (r.ok) { setComment(""); setErr(null); } else setErr(r.error);
  };

  return (
    <div className="pj-ov">
      <div className="pj-col">
        <section className="pj-box">
          <div className="pk-eyebrow">Documents · {rows.length}</div>
          {rows.length === 0 ? <div className="pj-faint" style={{ marginTop: 8 }}>No documents linked yet.</div> : (
            <div className="pk-list" style={{ marginTop: 8 }}>
              {rows.map((r) => {
                const latest = r.f.versions[r.f.versions.length - 1];
                return (
                  <div key={r.f.id + r.why} className="pk-li" style={{ alignItems: "flex-start" }}>
                    <div className="pk-grow" style={{ minWidth: 0 }}>
                      <button type="button" className="pj-linkbtn" onClick={() => openObject("file", r.f.id)}>{r.f.title}</button>
                      <div className="pj-faint">{r.f.kind} · version {r.version ?? latest?.n ?? 1}{r.version && latest && r.version !== latest.n ? " (latest is " + latest.n + ")" : ""}
                        {latest ? " · " + d(latest.addedAt) : ""}{latest?.approved ? " · approved" : ""} · owner {q.name(r.f.ownerId)}</div>
                      <div className="pj-faint">{r.why}</div>
                    </div>
                    {r.linked && canChange && <Button size="sm" variant="ghost" onClick={() => store.run(linkProjectFile, p.id, r.f.id, false)}>Unlink</Button>}
                  </div>
                );
              })}
            </div>
          )}
          {hiddenLinked > 0 && <div className="pj-faint" style={{ marginTop: 6 }}>{hiddenLinked} linked document{hiddenLinked === 1 ? " is" : "s are"} restricted and not shown to you.</div>}
          {canChange && (
            <div className="pj-inline" style={{ marginTop: 10 }}>
              <Select ariaLabel="Document to link" value={pick} onChange={setPick} options={[{ value: "", label: "Link a document" }, ...linkable.map((f) => ({ value: f.id, label: f.title }))]} />
              <Button disabled={!pick} onClick={() => { const r = store.run(linkProjectFile, p.id, pick, true); if (r.ok) setPick(""); }}>Link</Button>
            </div>
          )}
        </section>

        <section className="pj-box">
          <div className="pj-tabhead" style={{ marginBottom: 6 }}>
            <div className="pk-eyebrow">Progress updates · {updates.length}</div>
            <Button size="sm" onClick={onPostUpdate} disabled={!canChange}>Post update</Button>
          </div>
          {updates.length === 0 ? <div className="pj-faint">No updates yet.</div> : updates.map((u) => (
            <div key={u.id} className="pj-update">
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <PersonName id={u.by} /><span className="pj-faint pj-mono">{d(u.at)}</span><HealthChip health={u.health} prefix="Reported: " />
              </div>
              <p className="pj-text">{u.text}</p>
            </div>
          ))}
        </section>
      </div>

      <div className="pj-col">
        <section className="pj-box">
          <div className="pk-eyebrow">Comments · {comments.length}</div>
          {comments.map((c) => (
            <div key={c.id} className="pj-update">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}><PersonName id={c.by} /><span className="pj-faint pj-mono">{d(c.at)}</span></div>
              <p className="pj-text">{c.text}</p>
              {c.mentions.length > 0 && <div className="pj-faint">Mentioned: {c.mentions.map((m) => q.name(m)).join(", ")}</div>}
            </div>
          ))}
          <Field label="Add a comment" help="Mention someone with @ and their full name, for example @Casey Lund. They see it in their notifications." error={err}>
            <TextArea value={comment} onChange={setComment} rows={2} />
          </Field>
          <div style={{ marginTop: 8 }}><Button onClick={post} disabled={!comment.trim()}>Comment</Button></div>
        </section>

        <section className="pj-box">
          <div className="pk-eyebrow">History · {history.length}</div>
          <div className="pj-faint" style={{ margin: "4px 0 8px" }}>Every change to this {T.oneLower}, its plan and its tasks, newest first. Each change is one entry.</div>
          {history.length === 0 ? <Faint>No history yet.</Faint> : (
            <div className="pk-list">
              {history.slice(0, 40).map((e) => {
                const body = (
                  <>
                    <span style={{ flex: "none", width: 130 }}><PersonName id={e.actorId} /></span>
                    <span className="pk-grow" style={{ whiteSpace: "normal" }}>{e.summary}{e.simulated ? " (simulated)" : ""}</span>
                    <span className="pj-faint pj-mono" style={{ flex: "none" }}>{d(e.at)}</span>
                  </>
                );
                return inActivity.has(e.id)
                  ? <button key={e.id} type="button" className="pk-li pk-li--btn" style={{ alignItems: "flex-start" }} title="Open in Activity" onClick={() => openObject("event", e.id)}>{body}</button>
                  : <div key={e.id} className="pk-li" style={{ alignItems: "flex-start" }}>{body}</div>;
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function UpdatePanel({ p, onClose }: { p: Project; onClose: () => void }) {
  const { T } = useProjectsCtx();
  const [text, setText] = useState("");
  const [health, setHealth] = useState<Health>(p.reportedHealth || "on_track");
  const [err, setErr] = useState<string | null>(null);
  const save = () => {
    const r = store.run(postProjectUpdate, p.id, text, health);
    if (r.ok) onClose(); else setErr(r.error);
  };
  return (
    <SidePanel open onClose={onClose} title="Post update" eyebrow={p.ref} width={520}
      footer={<><span className="pk-grow" /><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={!text.trim()}>Post update</Button></>}>
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="What changed and what is next"><TextArea value={text} onChange={setText} rows={5} /></Field>
        <Field label="Reported health" help={"Your view as owner. It is shown beside the computed health and never replaces it."}>
          <Select ariaLabel="Reported health" value={health} onChange={(x) => setHealth(x as Health)}
            options={(["on_track", "at_risk", "off_track"] as Health[]).map((h) => ({ value: h, label: PROJECT_HEALTH_LABEL[h] }))} />
        </Field>
        <div className="pk-help">The update is dated today and appears on the {T.oneLower}, in its history and in Activity.</div>
        {err && <div className="pk-error" role="alert">{err}</div>}
      </div>
    </SidePanel>
  );
}
