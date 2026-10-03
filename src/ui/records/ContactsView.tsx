/* Records > Contacts, in the original Pulse design: the Records hero with an
   "ask in your own words" search, then the Directory card of staff and
   external contacts. A row opens the person panel with their teams, roles,
   records and open work. Staff only. */

import { useState } from "react";
import { useCore, openObject } from "../../core";
import type { Id, Person, RoleScope, Tone } from "../../core";
import { Chip, Empty, KV, LABEL, Notice, Section, SidePanel, toneOf } from "../kit";
import { SegTabs, eyebrowOf } from "../frame";
import { Grow, List, ListButton, Ref, RecordStatus } from "./common";
import { Initials, RecCard, RecEmpty, RecPage, RecordsHero, matchesAll, plural, termsOf } from "./hero";

type KindSel = "all" | "staff" | "external";
const STATUS_LABEL: Record<Person["status"], string> = { active: "Active", invited: "Invited", suspended: "Suspended" };
const STATUS_TONE: Record<Person["status"], Tone> = { active: "ok", invited: "warn", suspended: "bad" };

/** The directory tag: suspended and invited win over the contact kind. */
function tagOf(p: Person): { label: string; color: string } {
  if (p.status === "suspended") return { label: "Suspended", color: "var(--bad)" };
  if (p.status === "invited") return { label: "Invited", color: "var(--warn)" };
  return p.kind === "staff" ? { label: "Staff", color: "var(--accent)" } : { label: "External", color: "var(--body)" };
}

const COLS = "minmax(200px,1.5fr) minmax(140px,1.2fr) minmax(170px,1.3fr) minmax(140px,.9fr) minmax(110px,.8fr)";

export default function ContactsView(_props: { v: unknown }) {
  const { core, q } = useCore();
  const [kind, setKind] = useState<KindSel>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<Id | null>(null);
  const T = core.config.terminology;

  if (q.viewer.person.kind !== "staff") {
    return (
      <RecPage>
        <RecordsHero eyebrow={eyebrowOf("Records", "Contacts")} title="Everyone you deal with" blurb="Staff and external contacts in one place."
          query="" onQuery={() => undefined} placeholder="Search people" kind="KEYWORD" suggestions={[]} answer="" searchLabel="Search contacts" disabled />
        <RecCard title="Directory"><RecEmpty title="Not available to you" body="The contact directory is for staff." /></RecCard>
      </RecPage>
    );
  }

  const all = [...q.people()].sort((a, b) => a.name.localeCompare(b.name));
  const teamsOf = (p: Person) => core.data.memberships.filter((m) => m.personId === p.id).map((m) => q.teamLabel(m.teamId));
  const orgOrTeams = (p: Person) => p.kind === "external" ? (p.organisation || "No organisation") : (teamsOf(p).join(", ") || "No " + T.team.toLowerCase());
  const hay = (p: Person) => [p.name, p.title, p.email, orgOrTeams(p), tagOf(p).label, p.kind, STATUS_LABEL[p.status]].join(" ");
  const terms = termsOf(query);
  const matched = all.filter((p) => matchesAll(hay(p), terms));
  const rows = kind === "all" ? matched : matched.filter((p) => p.kind === kind);
  const staffN = all.filter((p) => p.kind === "staff").length;
  const extN = all.length - staffN;

  const firstOrg = all.find((p) => p.kind === "external" && p.organisation)?.organisation;
  const suggestions = [
    ...(extN ? ["external"] : []),
    ...(firstOrg ? [firstOrg] : []),
    ...(all.some((p) => p.status === "invited") ? ["invited"] : []),
    ...(all.some((p) => p.title) ? [all.find((p) => p.title)!.title.split(/\s+/)[0].toLowerCase()] : [])
  ].filter((s, i, a) => a.indexOf(s) === i).slice(0, 4);

  const empty = all.length <= 1
    ? <RecEmpty title="Only you so far" body="People appear here when an administrator invites them in Settings, or when a connected source shares external contacts." />
    : <RecEmpty title="No contacts match" body="Try fewer words. It matches on name, role, email, organisation or team, and tag."
      action={<button type="button" className="pf-btn" onClick={() => { setQuery(""); setKind("all"); }}>Show everyone</button>} />;

  return (
    <RecPage>
      <RecordsHero
        eyebrow={eyebrowOf("Records", "Contacts", plural(all.length, "person", "people"))}
        title="Everyone you deal with"
        blurb="Staff and external contacts in one place. Ask in your own words: it matches on name, role, organisation and tag."
        query={query} onQuery={setQuery} placeholder="Try a name, a team, an organisation or a tag" kind="KEYWORD" searchLabel="Search contacts"
        suggestions={suggestions}
        answer={matched.length
          ? <>{matched.length} of {all.length} match on name, role, email, organisation and tag</>
          : <>Nothing matched. It searches name, role, email, organisation and tag only.<button type="button" onClick={() => setQuery("")}>Clear search</button></>}
      />

      <RecCard
        title="Directory"
        caption={terms.length ? "Filtered by " + terms.map((t) => "“" + t + "”").join(" and ") : "Staff and external contacts as one set of records."}
        right={<SegTabs<KindSel> label="Contact kind" value={kind} onChange={setKind}
          options={[{ value: "all", label: "All", count: matched.length }, { value: "staff", label: "Staff", count: matched.filter((p) => p.kind === "staff").length },
            { value: "external", label: "External", count: matched.filter((p) => p.kind === "external").length }]} />}
        badge={rows.length + " / " + all.length}
        footer={<><span style={{ flex: 1 }}>Showing {rows.length} of {plural(all.length, "contact", "contacts")}</span><span>{staffN} staff, {extN} external</span><span>Sorted by name</span></>}
      >
        <div className="rh-scroll">
          <div style={{ minWidth: 760 }} role="table" aria-label="Contacts">
            <div className="rh-th" role="row" style={{ gridTemplateColumns: COLS }}>
              {["Name", "Role", "Email", "Organisation or " + T.team.toLowerCase(), "Tag"].map((c) => <span key={c} role="columnheader">{c}</span>)}
            </div>
            {rows.map((p, i) => {
              const tag = tagOf(p);
              return (
                <button key={p.id} type="button" role="row" className="rh-tr" aria-current={openId === p.id ? "true" : undefined}
                  style={{ gridTemplateColumns: COLS, animationDelay: Math.min(i, 12) * 18 + "ms" }} onClick={() => setOpenId(p.id)}>
                  <span className="rh-td" role="cell">
                    <Initials name={p.name} initials={q.initials(p.id)} />
                    <span className="rh-ell" style={{ fontSize: 13.5, color: "var(--ink)" }}>{p.name}</span>
                  </span>
                  <span className="rh-td" role="cell"><span className="rh-ell">{p.title || "No role recorded"}</span></span>
                  <span className="rh-td" role="cell"><span className="rh-ell">{p.email || "No email"}</span></span>
                  <span className="rh-td" role="cell"><span className="rh-ell">{orgOrTeams(p)}</span></span>
                  <span className="rh-td" role="cell"><span className="rh-tag" style={{ color: tag.color }}>{tag.label}</span></span>
                </button>
              );
            })}
          </div>
        </div>
        {rows.length === 0 && empty}
      </RecCard>
      {openId && <PersonPanel id={openId} onClose={() => setOpenId(null)} />}
    </RecPage>
  );
}

export function PersonPanel({ id, onClose }: { id: Id; onClose: () => void }) {
  const { core, q } = useCore();
  const p = core.data.people.find((x) => x.id === id);
  if (!p) return <SidePanel open onClose={onClose} title="Person not found" width={520}><Empty title="Not found" body="This person is no longer in the directory." /></SidePanel>;
  const teams = core.data.memberships.filter((m) => m.personId === p.id).map((m) => m.teamId);
  const scopeText = (s: RoleScope) => s.kind === "organisation" ? "Whole " + core.config.terminology.organisation.toLowerCase()
    : s.kind === "unit" ? q.unitLabel(s.unitId) || "Unknown unit" : q.teamLabel(s.teamId);
  const roles = core.data.roleAssignments.filter((ra) => ra.personId === p.id);
  const records = q.records({ ignoreScope: true }).filter((r) => r.ownerId === p.id);
  const tasks = q.tasks({ ignoreScope: true }).filter((t) => t.assigneeId === p.id && q.isOpenTask(t));

  return (
    <SidePanel open onClose={onClose} width={560} eyebrow={p.kind === "staff" ? "Staff" : "External contact"}
      chips={<Chip tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Chip>} title={p.name}>
      <div className="pk-section" style={{ marginTop: 4 }}>
        <KV items={[
          ["Title", p.title || "None"],
          ["Email", p.email || "None"],
          ...(p.kind === "external" ? [["Organisation", p.organisation || "None"] as [string, string]] : [])
        ]} />
      </div>
      {p.status === "invited" && <div className="pk-section"><Notice>Invited and not signed in yet.</Notice></div>}
      {p.status === "suspended" && <div className="pk-section"><Notice tone="warn">Suspended: this person has no access while suspended.</Notice></div>}

      {p.kind === "staff" && (
        <>
          <Section label={core.config.terminology.teams + " · " + teams.length}>
            {teams.length === 0 ? <div className="rc-small">Not in a {core.config.terminology.team.toLowerCase()}.</div>
              : <div className="rc-row">{teams.map((t) => <Chip key={t} tone="neutral" plain>{q.teamLabel(t)}</Chip>)}</div>}
          </Section>
          <Section label={"Roles · " + roles.length}>
            {roles.length === 0 ? <div className="rc-small">No role assigned.</div> : (
              <List>
                {roles.map((ra) => (
                  <div key={ra.id} className="pk-li">
                    <Grow>{core.config.roles.find((r) => r.id === ra.roleId)?.label || ra.roleId}</Grow>
                    <span className="rc-small" style={{ flex: "none" }}>{scopeText(ra.scope)}</span>
                  </div>
                ))}
              </List>
            )}
          </Section>
        </>
      )}

      <Section label={"Records they own that you can see · " + records.length}>
        {records.length === 0 ? <div className="rc-small">None you can see.</div> : (
          <List>
            {records.slice(0, 12).map((r) => (
              <ListButton key={r.id} onClick={() => openObject("record", r.id)}>
                <Ref>{r.ref}</Ref><Grow>{r.title}</Grow><RecordStatus r={r} />
              </ListButton>
            ))}
            {records.length > 12 && <div className="pk-li rc-small">{records.length - 12} more. Filter Browse by owner to see them all.</div>}
          </List>
        )}
      </Section>

      {p.kind === "staff" && (
        <Section label={"Open tasks assigned · " + tasks.length}>
          <div className="rc-small" style={{ marginBottom: 8 }}>Listed so you can find their work. Only tasks you can see are counted, and this is not a measure of performance.</div>
          {tasks.length === 0 ? <div className="rc-small">No open tasks you can see.</div> : (
            <List>
              {tasks.map((t) => {
                const ov = q.isOverdue(t);
                return (
                  <ListButton key={t.id} onClick={() => openObject("task", t.id)}>
                    <Grow>{t.title}</Grow>
                    <Chip tone={toneOf.task(t.status, ov)}>{ov ? "Overdue" : LABEL.task[t.status]}</Chip>
                  </ListButton>
                );
              })}
            </List>
          )}
        </Section>
      )}
    </SidePanel>
  );
}
