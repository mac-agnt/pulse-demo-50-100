/* Records > Files, in the original Pulse design: the Records hero with a full
   text search, then a collapsible file tree on the left and the document
   viewer on the right. Files come from the shared core with their versions,
   owners, review dates and linked records. Restricted documents keep their
   source permissions: the query layer leaves them out for anyone who may not
   see them. */

import { useMemo, useState, type ReactNode } from "react";
import { useCore, can, ms, openObject, fmtDateTime, scopeLabel } from "../../core";
import type { FileDoc, FileVersion, Id, RecordItem } from "../../core";
import { Chip, Empty, KV, LABEL, Notice, PersonName, Section, SidePanel, toneOf } from "../kit";
import { Pill, eyebrowOf } from "../frame";
import { Grow, List, ListButton, Ref, RecordStatus, When, fmtDay, fileUses, sourceLabel, typeOf, useFocus } from "./common";
import { RecordPanel } from "./RecordPanel";
import { Highlight, RecCard, RecEmpty, RecPage, RecordsHero, matchesAll, plural, termsOf } from "./hero";

const latestVersion = (f: FileDoc): FileVersion | undefined => [...f.versions].sort((a, b) => b.n - a.n)[0];
/** The version that was current at a moment. */
const versionAt = (f: FileDoc, at: string): FileVersion | undefined =>
  [...f.versions].filter((v) => v.addedAt <= at).sort((a, b) => b.n - a.n)[0];

type Grouping = "kind" | "record";

const ICON_FILE = "M14 3v5h5 M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z";
const ICON_LOCK = "M7 11V8a5 5 0 0 1 10 0v3 M5 11h14v10H5z";

function Svg({ d, size = 12, sw = 1.7, color }: { d: string; size?: number; sw?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** The small marker on each file row: approved, not approved, or restricted. */
function Marker({ f }: { f: FileDoc }) {
  const v = latestVersion(f);
  const restricted = !!f.restrictedTo?.length;
  const text = (restricted ? "Restricted. " : "") + (v ? "Latest version " + (v.approved ? "approved" : "not approved") : "No versions");
  return (
    <span title={text} style={{ display: "inline-flex", alignItems: "center", gap: 5, flex: "none" }}>
      {restricted && <Svg d={ICON_LOCK} size={11} sw={1.9} color="var(--warn)" />}
      <span className={v?.approved ? "rf-mk-ok" : "rf-mk-no"} />
      <span className="rc-sr">{text}</span>
    </span>
  );
}

export default function FilesView(_props: { v?: unknown }) {
  const { core, ctx, q } = useCore();
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<Id | null>(null);
  const [treeOpen, setTreeOpen] = useState(true);
  const [grouping, setGrouping] = useState<Grouping>("kind");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [detailId, setDetailId] = useState<Id | null>(null);
  const [recordId, setRecordId] = useState<Id | null>(null);
  useFocus(["file"], (f) => { if (f.id) { setSel(f.id); setQuery(""); } });

  const now = ms(ctx.now);
  const T = core.config.terminology;
  const files = useMemo(() => [...q.files()].sort((a, b) => a.title.localeCompare(b.title)), [q]);

  if (!can(q.viewer, "records.view")) {
    return (
      <RecPage>
        <RecordsHero eyebrow={eyebrowOf("Records", "Files")} title="Files" blurb="Documents on record, with their versions, owners and review dates."
          query="" onQuery={() => undefined} placeholder="Search inside every document" kind="FULL TEXT" suggestions={[]} answer="" searchLabel="Search files" disabled />
        <RecCard title="Files"><RecEmpty title="Not available to you" body="Your role cannot see files. Ask an administrator if you need it." /></RecCard>
      </RecPage>
    );
  }

  const overdue = (f: FileDoc) => !!f.reviewDate && ms(f.reviewDate) < now;
  const restricted = (f: FileDoc) => !!f.restrictedTo?.length;
  const teamText = (f: FileDoc) => f.teamId ? q.teamLabel(f.teamId) : "Organisation-wide";
  const linkedRecords = (f: FileDoc) => f.linkedRecordIds.map((id) => q.record(id)).filter(Boolean) as RecordItem[];
  const hay = (f: FileDoc) => {
    const v = latestVersion(f);
    return [f.title, f.kind, f.summary, q.name(f.ownerId), teamText(f), ...f.versions.map((x) => x.note),
      ...linkedRecords(f).map((r) => r.ref + " " + r.title), restricted(f) ? "restricted" : "",
      overdue(f) ? "overdue review" : "", v ? (v.approved ? "approved" : "not approved unapproved") : ""].join(" ");
  };
  const terms = termsOf(query);
  const isHit = (f: FileDoc) => matchesAll(hay(f), terms);
  const hits = files.filter(isHit);
  const searching = terms.length > 0;

  const active = (sel ? files.find((f) => f.id === sel && (!searching || isHit(f))) : undefined)
    || (searching ? hits[0] : undefined) || files.find((f) => f.id === sel) || files[0];

  /* Folders: by file kind, or by the type of record each file is linked to. */
  const folderOf = (f: FileDoc): string[] => {
    if (grouping === "kind") return [f.kind || "Other"];
    const types = [...new Set(linkedRecords(f).map((r) => typeOf(core, r.typeId)?.plural || T.records))];
    return types.length ? types : ["Not linked to a " + T.record.toLowerCase()];
  };
  const folders = new Map<string, FileDoc[]>();
  for (const f of files) for (const name of folderOf(f)) folders.set(name, [...(folders.get(name) || []), f]);
  const folderNames = [...folders.keys()].sort((a, b) => a.startsWith("Not linked") ? 1 : b.startsWith("Not linked") ? -1 : a.localeCompare(b));
  const activeFolder = active ? folderOf(active)[0] : "";
  const path = active ? ["Files", activeFolder, active.title].join(" / ") : "Files";

  /* Suggestions from the files themselves. */
  const kinds = [...new Set(files.map((f) => f.kind))];
  const suggestions = [
    ...kinds.slice(0, 2).map((k) => k.toLowerCase()),
    ...(files.some(overdue) ? ["overdue review"] : []),
    ...(files.some((f) => !latestVersion(f)?.approved) ? ["not approved"] : []),
    ...(files.some(restricted) ? ["restricted"] : [])
  ].slice(0, 5);

  const overdueCount = files.filter(overdue).length;
  const hero = (
    <RecordsHero
      eyebrow={eyebrowOf("Records", "Files", plural(files.length, "document", "documents"), scopeLabel(core, ctx.scope))}
      title="Everything on record"
      blurb={"Documents with their versions, owners and review dates" + (overdueCount ? ". " + overdueCount + (overdueCount === 1 ? " is" : " are") + " past review." : ".")}
      query={query} onQuery={setQuery} placeholder="Search inside every document" kind="FULL TEXT" searchLabel="Search inside files"
      suggestions={suggestions}
      answer={hits.length
        ? <>{hits.length} of {plural(files.length, "document", "documents")} {hits.length === 1 ? "contains" : "contain"} that, in the title, summary, versions, links or status</>
        : <>No document contains that.<button type="button" onClick={() => setQuery("")}>Clear search</button></>}
    />
  );

  if (files.length === 0) {
    return (
      <RecPage>
        {hero}
        <RecCard title="Files" badge={"0"}>
          {core.data.files.length === 0
            ? <RecEmpty title="No files yet" body="Files appear here when a connected document source shares them, or when someone attaches evidence to a task or request. Each file keeps its versions, owner, review date and linked records." />
            : <RecEmpty title={"No files in " + scopeLabel(core, ctx.scope)} body="Files you can see appear here. Change the scope at the top to look wider. Restricted documents only show for the people their source allows." />}
        </RecCard>
      </RecPage>
    );
  }

  return (
    <RecPage>
      {hero}
      <div className="rf-wrap">
        {treeOpen && (
          <nav className="rf-pane rf-tree" aria-label="File tree">
            <div className="rf-head">
              <span className="rf-mono" style={{ flex: 1 }}>File tree</span>
              <span className="rf-group" role="group" aria-label="Group files by">
                <button type="button" aria-pressed={grouping === "kind"} onClick={() => setGrouping("kind")}>KIND</button>
                <button type="button" aria-pressed={grouping === "record"} onClick={() => setGrouping("record")} title={"Group by the type of " + T.record.toLowerCase() + " each file is linked to"}>LINKED</button>
              </span>
              <button type="button" className="rf-icon-btn ixm" onClick={() => setTreeOpen(false)} aria-label="Close file tree" title="Close file tree">
                <Svg d="M15 6l-6 6 6 6" size={13} sw={2} />
              </button>
            </div>
            <div className="rf-tree-body">
              {folderNames.map((name) => {
                const key = grouping + ":" + name;
                const list = folders.get(name) || [];
                const open = !collapsed[key];
                const inFolder = list.filter(isHit).length;
                return (
                  <div key={key}>
                    <button type="button" className="rf-row ix8" aria-expanded={open} onClick={() => setCollapsed({ ...collapsed, [key]: open })}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"
                        style={{ flex: "none", transform: "rotate(" + (open ? 90 : 0) + "deg)", transition: "transform .22s var(--ease)" }}><path d="M9 6l6 6-6 6" /></svg>
                      <span className="rh-ell" style={{ flex: 1, minWidth: 0 }}>{name}</span>
                      <span className="rf-count">{searching ? inFolder + "/" + list.length : list.length}</span>
                    </button>
                    {open && list.map((f) => {
                      const on = !!active && f.id === active.id;
                      return (
                        <button key={f.id} type="button" className="rf-row rf-row--file ix8" aria-current={on ? "true" : undefined}
                          data-dim={searching && !isHit(f) ? "true" : undefined} onClick={() => setSel(f.id)}>
                          <Svg d={ICON_FILE} />
                          <span className="rh-ell" style={{ flex: 1, minWidth: 0 }}>{f.title}</span>
                          <Marker f={f} />
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="rf-legend" aria-hidden="true">
              <span><span className="rf-mk-ok" />Approved</span>
              <span><span className="rf-mk-no" />Not approved</span>
              <span><Svg d={ICON_LOCK} size={11} sw={1.9} color="var(--warn)" />Restricted</span>
            </div>
          </nav>
        )}

        <article className="rf-pane rf-view" aria-label="Document viewer">
          <div className="rf-head" style={{ gap: 10 }}>
            {!treeOpen && (
              <button type="button" className="rf-icon-btn ixm" onClick={() => setTreeOpen(true)} aria-label="Open file tree" title="Open file tree" style={{ width: 30, height: 30 }}>
                <Svg d="M4.5 6h5 M4.5 12h5 M4.5 18h5 M12.5 6h7 M12.5 12h7 M12.5 18h7" size={14} sw={1.8} />
              </button>
            )}
            <span className="rf-mono rh-ell" style={{ flex: 1, minWidth: 0, fontSize: 10, letterSpacing: ".1em" }}>{path}</span>
            {searching && (
              <span style={{ flex: "none", padding: "3px 10px", borderRadius: "var(--chip-r,6px)", background: "var(--accent-faint)", border: "1px solid var(--accent-line)", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink)" }}>
                {hits.length} MATCHING
              </span>
            )}
            {active && <span className="rf-mono pf-hide-narrow" style={{ flex: "none", letterSpacing: ".1em" }}>{restricted(active) ? "RESTRICTED" : latestVersion(active)?.approved ? "APPROVED" : "NOT APPROVED"}</span>}
            {active && <button type="button" className="pf-btn pf-btn--sm" onClick={() => setDetailId(active.id)} title="Access, full version table and history">Details</button>}
          </div>
          <div className="rf-body">
            {active && <Doc key={active.id} f={active} terms={terms} folder={activeFolder} overdue={overdue(active)} onRecord={setRecordId} />}
          </div>
        </article>
      </div>

      {detailId && <FilePanel id={detailId} onClose={() => setDetailId(null)} />}
      <RecordPanel recordId={recordId} onClose={() => setRecordId(null)} />
    </RecPage>
  );
}

/* ── Document viewer ───────────────────────────────────────────────────── */

function Doc({ f, terms, folder, overdue, onRecord }: { f: FileDoc; terms: string[]; folder: string; overdue: boolean; onRecord: (id: Id) => void }) {
  const { core, q } = useCore();
  const tz = core.config.timezone;
  const T = core.config.terminology;
  const v = latestVersion(f);
  const versions = [...f.versions].sort((a, b) => b.n - a.n);
  const linked = f.linkedRecordIds.map((id) => q.record(id)).filter(Boolean) as RecordItem[];
  const hiddenLinked = f.linkedRecordIds.length - linked.length;
  const requests = q.requests({ ignoreScope: true }).filter((r) => r.fields.fileId === f.id || r.evidenceFileIds.includes(f.id));
  const tasks = q.tasks({ ignoreScope: true }).filter((t) => t.evidenceFileIds.includes(f.id));
  const uses = fileUses(core, q, f.id);
  const reqTone = (s: string) => s === "approved" ? "ok" as const : s === "declined" ? "bad" as const : s === "changes_requested" ? "warn" as const : s === "submitted" ? "accent" as const : "neutral" as const;

  const facts: [string, ReactNode][] = [
    ["Kind", <Highlight text={f.kind} terms={terms} />],
    ["Owner", <Highlight text={q.name(f.ownerId)} terms={terms} />],
    [T.team, f.teamId ? q.teamLabel(f.teamId) : "Organisation-wide"],
    ["Versions", versions.length ? versions.length + (v ? ", latest v" + v.n + (v.approved ? " approved" : " not approved") : "") : "None"],
    ["Effective", f.effectiveDate ? fmtDay(f.effectiveDate, tz) : "Not set"],
    ["Review due", f.reviewDate ? <span style={{ color: overdue ? "var(--bad)" : undefined }}>{fmtDay(f.reviewDate, tz)}{overdue ? ", overdue" : ""}</span> : "Not set"],
    ["Access", f.restrictedTo?.length ? <span style={{ color: "var(--warn)" }}>Restricted at source</span> : "Standard"],
    ["Source", sourceLabel(core, f.sourceId)]
  ];

  return (
    <div className="rf-doc">
      <div className="rf-mono">{"Files / " + folder}</div>
      <h2 className="rf-h2"><Highlight text={f.title} terms={terms} /></h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {v ? <Pill tone={v.approved ? "ok" : "neutral"}>v{v.n} {v.approved ? "approved" : "not approved"}</Pill> : <Pill>No versions</Pill>}
        {overdue && <Pill tone="bad">Review overdue</Pill>}
        {f.restrictedTo?.length ? <Pill tone="warn">Restricted</Pill> : null}
      </div>
      <div className="rf-facts">
        {facts.map(([k, val]) => (
          <div key={k}><div className="rf-fact-k">{k}</div><div className="rf-fact-v">{val}</div></div>
        ))}
      </div>
      <div className="rf-rule" />
      {f.summary ? <p className="rf-p"><Highlight text={f.summary} terms={terms} /></p> : <p className="rf-p" style={{ color: "var(--faint)" }}>No summary recorded for this document.</p>}
      {f.restrictedTo?.length ? (
        <p className="rf-p" style={{ fontSize: 13, color: "var(--dim)" }}>Pulse keeps the source permissions: only {f.restrictedTo.map((p) => q.name(p)).join(", ")} and administrators can see this file, its versions and its links.</p>
      ) : null}

      <div className="rf-box">
        <div className="rf-box-k">Versions · {versions.length}</div>
        {versions.length === 0 ? <div className="rc-small" style={{ marginTop: 8 }}>No versions recorded.</div> : (
          <div className="rf-list">
            {versions.map((x) => (
              <div key={x.id} className="rf-li">
                <span className="pk-mono" style={{ flex: "none", fontSize: 12, color: "var(--ink)", width: 26 }}>v{x.n}</span>
                <span className="rh-two" style={{ flex: 1 }}>
                  <span><Highlight text={x.note || "No note"} terms={terms} /></span>
                  <span title={fmtDateTime(x.addedAt, tz)}>{q.name(x.addedBy)}, {fmtDay(x.addedAt, tz)}, {x.sizeKb} KB</span>
                </span>
                {x.approved ? <Pill tone="ok">Approved</Pill> : <Pill>Not approved</Pill>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rf-box">
        <div className="rf-box-k">Linked {T.records.toLowerCase()} · {f.linkedRecordIds.length}</div>
        {linked.length === 0 && hiddenLinked === 0 ? <div className="rc-small" style={{ marginTop: 8 }}>Not linked to any {T.record.toLowerCase()}.</div> : (
          <div className="rf-chips">
            {linked.map((r) => (
              <button key={r.id} type="button" className="rf-chip ixu" onClick={() => onRecord(r.id)} title={"Open " + r.ref}>
                <span className="pk-mono" style={{ fontSize: 11, color: "var(--dim)", flex: "none" }}>{r.ref}</span><span>{r.title}</span>
              </button>
            ))}
          </div>
        )}
        {hiddenLinked > 0 && <div className="rc-small" style={{ marginTop: 8 }}>{plural(hiddenLinked, "linked record is", "linked records are")} not visible to you.</div>}
      </div>

      <div className="rf-box">
        <div className="rf-box-k">Used in · {requests.length + tasks.length + uses.length}</div>
        {requests.length + tasks.length + uses.length === 0 ? <div className="rc-small" style={{ marginTop: 8 }}>No request, decision, task, requirement or agent run refers to this file.</div> : (
          <div className="rf-list">
            {requests.map((r) => {
              const ap = r.approvalId ? q.approval(r.approvalId) : undefined;
              const submitted = r.versions[r.versions.length - 1]?.at || r.createdAt;
              const atSubmit = versionAt(f, submitted);
              const atDecision = ap?.decidedAt ? versionAt(f, ap.decidedAt) : undefined;
              const role = r.fields.fileId === f.id ? "Subject of the request" : "Evidence";
              return (
                <button key={r.id} type="button" className="rf-li" onClick={() => openObject("request", r.id)}>
                  <span className="pk-mono" style={{ flex: "none", fontSize: 11.5, color: "var(--dim)" }}>{r.ref}</span>
                  <span className="rh-two" style={{ flex: 1 }}>
                    <span>{r.title}</span>
                    <span>{role}. {atSubmit ? "v" + atSubmit.n + " when submitted" : "Submitted before any version"}{atDecision ? ", v" + atDecision.n + " when decided" : ap ? ", not decided yet" : ""}</span>
                  </span>
                  <Pill tone={reqTone(r.status)}>{LABEL.request[r.status]}</Pill>
                </button>
              );
            })}
            {tasks.map((t) => {
              const ov = q.isOverdue(t);
              return (
                <button key={t.id} type="button" className="rf-li" onClick={() => openObject("task", t.id)}>
                  <span className="rh-two" style={{ flex: 1 }}><span>{t.title}</span><span>Evidence on a task</span></span>
                  <Pill tone={toneOf.task(t.status, ov)}>{ov ? "Overdue" : LABEL.task[t.status]}</Pill>
                </button>
              );
            })}
            {uses.map((u) => (
              <button key={u.key} type="button" className="rf-li" onClick={u.open}>
                <span className="rh-two" style={{ flex: 1 }}><span>{u.label}</span><span>{u.sub}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── File panel ────────────────────────────────────────────────────────── */

export function FilePanel({ id, onClose }: { id: Id; onClose: () => void }) {
  const { core, ctx, q } = useCore();
  const f = q.file(id);
  if (!f) {
    return (
      <SidePanel open onClose={onClose} title="File not available" width={560}>
        <Empty title="Not available to you" body="This file does not exist any more, or its source permissions do not include you." />
      </SidePanel>
    );
  }
  const tz = core.config.timezone;
  const v = latestVersion(f);
  const versions = [...f.versions].sort((a, b) => b.n - a.n);
  const linked = f.linkedRecordIds.map((rid) => q.record(rid));
  const hiddenLinked = linked.filter((r) => !r).length;
  const requests = q.requests({ ignoreScope: true }).filter((r) => r.fields.fileId === f.id || r.evidenceFileIds.includes(f.id));
  const tasks = q.tasks({ ignoreScope: true }).filter((t) => t.evidenceFileIds.includes(f.id));
  const uses = fileUses(core, q, f.id);
  const events = q.events({ ignoreScope: true }).filter((e) => e.objectType === "file" && e.objectId === f.id).sort((a, b) => b.at.localeCompare(a.at));
  const overdue = !!f.reviewDate && ms(f.reviewDate) < ms(ctx.now);
  const reqTone = (s: string) => s === "approved" ? "ok" as const : s === "declined" ? "bad" as const : s === "changes_requested" ? "warn" as const : s === "submitted" ? "accent" as const : "neutral" as const;

  return (
    <SidePanel open onClose={onClose} width={620} eyebrow={f.kind}
      chips={<>{v && <Chip tone={v.approved ? "ok" : "neutral"}>v{v.n} {v.approved ? "approved" : "not approved"}</Chip>}{f.restrictedTo?.length ? <Chip tone="warn">Restricted</Chip> : null}{overdue && <Chip tone="bad">Review overdue</Chip>}</>}
      title={f.title}>
      {f.summary && <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--body)" }}>{f.summary}</p>}
      <div className="pk-section">
        <KV items={[
          ["Owner", <PersonName id={f.ownerId} />],
          [core.config.terminology.team, f.teamId ? q.teamLabel(f.teamId) : "Organisation-wide"],
          ["Effective", f.effectiveDate ? fmtDay(f.effectiveDate, tz) : "Not set"],
          ["Review due", f.reviewDate ? fmtDay(f.reviewDate, tz) + (overdue ? " (overdue)" : "") : "Not set"],
          ["Source", sourceLabel(core, f.sourceId)]
        ]} />
      </div>

      <Section label="Access">
        {f.restrictedTo?.length ? (
          <Notice tone="warn" icon="M7 11V8a5 5 0 0 1 10 0v3 M5 11h14v10H5z">
            Restricted at source. Pulse keeps the source permissions: only {f.restrictedTo.map((p) => q.name(p)).join(", ")} and administrators can see this file, its versions and its links. It does not appear in search, exports or answers for anyone else.
          </Notice>
        ) : (
          <div className="rc-small">Visible to {f.visibility === "organisation" ? "all staff" : f.visibility === "unit" ? "members of the unit" : f.visibility === "team" ? "members of " + (f.teamId ? q.teamLabel(f.teamId) : "the team") : "the owner"}, plus the managers who oversee it.</div>
        )}
      </Section>

      <Section label={"Versions · " + versions.length}>
        {versions.length === 0 ? <div className="rc-small">No versions recorded.</div> : (
          <div className="rc-mini-wrap">
            <table className="rc-mini">
              <thead><tr><th>Version</th><th>Added by</th><th>Added</th><th>Note</th><th>Size</th><th>Approved</th></tr></thead>
              <tbody>
                {versions.map((x) => (
                  <tr key={x.id}>
                    <td className="pk-mono">v{x.n}</td>
                    <td>{q.name(x.addedBy)}</td>
                    <td title={fmtDateTime(x.addedAt, tz)}>{fmtDay(x.addedAt, tz)}</td>
                    <td>{x.note || "None"}</td>
                    <td className="pk-mono">{x.sizeKb} KB</td>
                    <td>{x.approved ? <Chip tone="ok">Approved</Chip> : <span className="pk-faint">No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section label={"Linked records · " + f.linkedRecordIds.length}>
        {f.linkedRecordIds.length === 0 ? <div className="rc-small">Not linked to any record.</div> : (
          <>
            <List>
              {linked.filter(Boolean).map((r) => (
                <ListButton key={r!.id} onClick={() => openObject("record", r!.id)}>
                  <Ref>{r!.ref}</Ref><Grow>{r!.title}</Grow><RecordStatus r={r!} />
                </ListButton>
              ))}
            </List>
            {hiddenLinked > 0 && <div className="rc-small" style={{ marginTop: 6 }}>{hiddenLinked} linked {hiddenLinked === 1 ? "record is" : "records are"} not visible to you.</div>}
          </>
        )}
      </Section>

      <Section label={"Used in · " + (requests.length + tasks.length + uses.length)}>
        {requests.length + tasks.length + uses.length === 0 ? <div className="rc-small">No request, task, requirement or agent run refers to this file.</div> : (
          <List>
            {requests.map((r) => {
              const ap = r.approvalId ? q.approval(r.approvalId) : undefined;
              const submitted = r.versions[r.versions.length - 1]?.at || r.createdAt;
              const atSubmit = versionAt(f, submitted);
              const atDecision = ap?.decidedAt ? versionAt(f, ap.decidedAt) : undefined;
              const role = r.fields.fileId === f.id ? "Subject" : "Evidence";
              return (
                <ListButton key={r.id} onClick={() => openObject("request", r.id)}>
                  <Ref>{r.ref}</Ref>
                  <Grow>{r.title}<div className="rc-small">{role}. {atSubmit ? "v" + atSubmit.n + " when submitted" : "Submitted before any version"}{atDecision ? ", v" + atDecision.n + " when decided" : ap ? ", not decided yet" : ""}</div></Grow>
                  <Chip tone={reqTone(r.status)}>{LABEL.request[r.status]}</Chip>
                </ListButton>
              );
            })}
            {tasks.map((t) => {
              const ov = q.isOverdue(t);
              return (
                <ListButton key={t.id} onClick={() => openObject("task", t.id)}>
                  <Grow>{t.title}<div className="rc-small">Evidence on a task</div></Grow>
                  <Chip tone={toneOf.task(t.status, ov)}>{ov ? "Overdue" : LABEL.task[t.status]}</Chip>
                </ListButton>
              );
            })}
            {uses.map((u) => (
              <ListButton key={u.key} onClick={u.open}><Grow>{u.label}<div className="rc-small">{u.sub}</div></Grow></ListButton>
            ))}
          </List>
        )}
      </Section>

      <Section label={"History · " + events.length}>
        {events.length === 0 ? <div className="rc-small">No recorded activity on this file yet.</div> : (
          <List>
            {events.map((e) => (
              <div key={e.id} className="pk-li" style={{ alignItems: "flex-start" }}>
                <span className="pk-grow" style={{ fontSize: 12.5 }}>{e.summary}<div className="rc-small">{q.name(e.actorId)}</div></span>
                <span className="rc-small" style={{ flex: "none" }}><When at={e.at} /></span>
              </div>
            ))}
          </List>
        )}
      </Section>
    </SidePanel>
  );
}
