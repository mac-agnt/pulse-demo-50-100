/* Raise a request from a configured form. Evidence can be an existing
   document, or a named evidence note that is attached once the request has
   been saved (no file upload happens in this demo). */

import { useState } from "react";
import { useCore, ops, navigate } from "../../core";
import { Button, Empty, Field, Icon, ICON, Notice, Select, SidePanel, TextInput } from "../kit";
import { InlineError, LinkRow, Muted, Rows, useRunner, useViewer } from "./shared";
import { fieldErrors, RequestFields, toValues, type Draft } from "./RequestFields";

export function RequestForm({ onClose, onCreated, initialFormId }: { onClose: () => void; onCreated: (requestId: string) => void; initialFormId?: string }) {
  const { core, q } = useCore();
  const { v } = useViewer();
  const { err, setErr, run } = useRunner();
  const forms = core.config.requestForms.filter((f) => f.enabled);
  const [formId, setFormId] = useState(initialFormId && forms.some((f) => f.id === initialFormId) ? initialFormId : forms[0]?.id || "");
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState<Draft>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [tried, setTried] = useState(false);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [pickFile, setPickFile] = useState("");
  const [notes, setNotes] = useState<{ title: string; note: string }[]>([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const teamIds = v.memberTeamIds;
  const [teamId, setTeamId] = useState(teamIds[0] || "");

  if (!forms.length) {
    return (
      <SidePanel open onClose={onClose} title="New request" eyebrow="Requests" width={520}>
        <Empty title="No request forms yet" body="No request forms are configured yet. An administrator can add one in Settings > Control."
          action={<Button onClick={() => { onClose(); navigate({ page: "Settings", section: "requestForms" }); }}>Open request forms in Settings</Button>} />
      </SidePanel>
    );
  }

  const form = forms.find((f) => f.id === formId) || forms[0];
  const errors = fieldErrors(form.fields, draft);
  const show = tried ? Object.fromEntries(form.fields.map((f) => [f.key, true])) : touched;
  const titleErr = tried && !title.trim() ? "Give the request a title." : null;
  const evidenceCount = fileIds.length + notes.length;
  const evidenceErr = tried && form.evidenceRequired && evidenceCount === 0 ? "This form needs evidence before it can be submitted." : null;
  const files = q.files({ ignoreScope: true }).filter((f) => !fileIds.includes(f.id));

  const onDraft = (d: Draft) => {
    const changed = Object.keys(d).filter((k) => d[k] !== draft[k]);
    setTouched({ ...touched, ...Object.fromEntries(changed.map((k) => [k, true])) });
    setDraft(d);
  };

  const save = (submit: boolean) => {
    setTried(true);
    if (!title.trim()) return;
    if (submit && (Object.keys(errors).length || (form.evidenceRequired && evidenceCount === 0))) {
      setErr("Fix the highlighted fields first. Nothing has been saved yet.");
      return;
    }
    // Save as a draft first so evidence notes can be attached to it, then submit.
    const res = run(ops.createRequest, { formId: form.id, title, fields: toValues(form.fields, draft), evidenceFileIds: fileIds, linkedRecordIds: [], teamId: teamId || undefined, submit: false });
    if (!res.ok || !res.id) return;
    const id = res.id;
    for (const n of notes) run(ops.attachEvidence, { requestId: id }, n.title, n.note);
    if (submit) {
      const sub = run(ops.submitRequest, id);
      if (!sub.ok) { setErr(sub.error + " The request was kept as a draft."); onCreated(id); return; }
    }
    onCreated(id);
  };

  return (
    <SidePanel open onClose={onClose} title="New request" eyebrow="Requests" width={580}
      footer={<>
        <span className="wk-small pk-grow">Submitting sends it for a decision.</span>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => save(false)}>Save draft</Button>
        <Button variant="primary" onClick={() => save(true)}>Submit</Button>
      </>}>
      <div className="wk-stack">
        <Field label="Form" htmlFor="rq-form" help={form.description}>
          <Select id="rq-form" value={form.id} onChange={(id) => { setFormId(id); setDraft({}); setTouched({}); setTried(false); setErr(null); }}
            options={forms.map((f) => ({ value: f.id, label: f.label }))} />
        </Field>
        <Field label="Title" htmlFor="rq-title" error={titleErr}>
          <TextInput id="rq-title" value={title} onChange={setTitle} invalid={!!titleErr} placeholder="A short summary for the decision maker" />
        </Field>
        {teamIds.length > 1 && (
          <Field label="Raised for team" htmlFor="rq-team" help="Decides who reviews it.">
            <Select id="rq-team" value={teamId} onChange={setTeamId} options={teamIds.map((id) => ({ value: id, label: q.teamLabel(id) }))} />
          </Field>
        )}
        <RequestFields defs={form.fields} draft={draft} onChange={onDraft} errors={errors} show={show} idPrefix="rq" />

        <div className="pk-section" style={{ marginTop: 6 }}>
          <div className="wk-row" style={{ marginBottom: 8 }}>
            <span className="pk-eyebrow pk-grow">Evidence{form.evidenceRequired ? " (required)" : " (optional)"}</span>
          </div>
          {evidenceCount === 0 ? <Muted>No evidence yet.</Muted> : (
            <Rows>
              {fileIds.map((id) => (
                <LinkRow key={id} right={<Button size="sm" variant="ghost" onClick={() => setFileIds(fileIds.filter((x) => x !== id))}>Remove</Button>}>
                  <span className="wk-wrap">{q.file(id)?.title || "Document"}</span><span className="wk-small">existing document</span>
                </LinkRow>
              ))}
              {notes.map((n, i) => (
                <LinkRow key={"n" + i} right={<Button size="sm" variant="ghost" onClick={() => setNotes(notes.filter((_, j) => j !== i))}>Remove</Button>}>
                  <span className="wk-wrap">{n.title}</span><span className="wk-small">evidence note, attached on save</span>
                </LinkRow>
              ))}
            </Rows>
          )}
          <div className="wk-row" style={{ marginTop: 10 }}>
            <div style={{ minWidth: 220, flex: "1 1 220px" }}>
              <Select ariaLabel="Existing document as evidence" value={pickFile} onChange={setPickFile}
                options={[{ value: "", label: files.length ? "Choose an existing document" : "No other documents you can see" }, ...files.map((f) => ({ value: f.id, label: f.title }))]} />
            </div>
            <Button disabled={!pickFile} title={pickFile ? undefined : "Pick a document first"} onClick={() => { setFileIds([...fileIds, pickFile]); setPickFile(""); }}>Add document</Button>
          </div>
          <div className="pk-grid2" style={{ marginTop: 10 }}>
            <Field label="Evidence note title" htmlFor="rq-evt"><TextInput id="rq-evt" value={noteTitle} onChange={setNoteTitle} placeholder="For example: Source extract" /></Field>
            <Field label="Note" htmlFor="rq-evn"><TextInput id="rq-evn" value={noteText} onChange={setNoteText} placeholder="What it shows" /></Field>
          </div>
          <div className="wk-row" style={{ marginTop: 8 }}>
            <span className="wk-small pk-grow">No file is uploaded in this demo. A named evidence note is recorded and attached once the request is saved.</span>
            <Button disabled={!noteTitle.trim()} title={noteTitle.trim() ? undefined : "Name the evidence first"}
              onClick={() => { setNotes([...notes, { title: noteTitle.trim(), note: noteText.trim() }]); setNoteTitle(""); setNoteText(""); }}>
              <Icon d={ICON.plus} />Add evidence note
            </Button>
          </div>
          {evidenceErr && <div className="pk-error" role="alert" style={{ marginTop: 6 }}>{evidenceErr}</div>}
        </div>

        {form.effect && <Notice>Once approved: {form.effect.label.charAt(0).toLowerCase() + form.effect.label.slice(1)}. That runs as a separate step after the decision.</Notice>}
        <InlineError text={err} />
      </div>
    </SidePanel>
  );
}
