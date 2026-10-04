/* A business appointment: add, edit or cancel. Appointments are not
   automation schedules and send nothing: no invitation leaves Pulse in this
   demo. The ops recheck who may change it (its owner, or a manager of its
   team) and write an audit event. */

import { useState } from "react";
import { useCore, store, createAppointment, updateAppointment, cancelAppointment, canSeeAppointment, moduleEnabled, localDay, zonedTime, openObject } from "../../core";
import type { Appointment } from "../../core";
import { Button, Field, KV, NoAccess, Notice, PersonName, Section, Select, SidePanel, TextArea, TextInput } from "../kit";
import { clockText, History, InlineError, useClock, useViewer } from "./shared";

const MINUTES = [15, 30, 45, 60, 90, 120, 180, 240, 480];

function splitAt(at: string, tz: string) {
  return { date: localDay(at, tz), time: clockText(at, tz) };
}

export function AppointmentPanel({ appointmentId, defaultDay, onClose, onSaved }: {
  appointmentId?: string; defaultDay?: string; onClose: () => void; onSaved?: (id: string) => void;
}) {
  const { core, q } = useCore();
  const existing = appointmentId ? core.data.appointments.find((a) => a.id === appointmentId) : undefined;
  if (appointmentId && (!existing || !canSeeAppointment(q, existing))) {
    return <SidePanel open onClose={onClose} title="Appointment"><NoAccess what="this appointment" /></SidePanel>;
  }
  return <Body key={appointmentId || "new"} a={existing} defaultDay={defaultDay} onClose={onClose} onSaved={onSaved} />;
}

function Body({ a, defaultDay, onClose, onSaved }: { a?: Appointment; defaultDay?: string; onClose: () => void; onSaved?: (id: string) => void }) {
  const { core, q, ctx } = useCore();
  const { v, me, can: canDo, oversees } = useViewer();
  const { tz, dt } = useClock();
  const start = a ? splitAt(a.startAt, tz) : { date: defaultDay || localDay(ctx.now, tz), time: "10:00" };
  const [title, setTitle] = useState(a?.title || "");
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [minutes, setMinutes] = useState(String(a?.minutes || 60));
  const teamIds = v.isOrgWide ? core.config.teams.map((t) => t.id) : [...new Set([...v.memberTeamIds, ...v.overseenTeamIds])];
  const [teamId, setTeamId] = useState(a?.teamId || v.memberTeamIds[0] || teamIds[0] || "");
  const [attendees, setAttendees] = useState<string[]>(a?.attendeeIds || []);
  const [projectId, setProjectId] = useState(a?.projectId || "");
  const [locationId, setLocationId] = useState(a?.locationId || "");
  const [note, setNote] = useState(a?.note || "");
  const [reason, setReason] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const may = !a || a.ownerId === me || (canDo("tasks.manage") && (v.isOrgWide || oversees(a.teamId)));
  const staff = core.data.people.filter((p) => p.kind === "staff" && p.status !== "suspended" && p.id !== (a?.ownerId || me));
  const projectsOn = moduleEnabled(core.config, "projects");
  const projects = projectsOn ? core.data.projects.filter((p) => p.status !== "cancelled" && q.canSee({ ownerIds: [p.ownerId], teamId: p.teamId, unitId: p.unitId, visibility: p.visibility })) : [];
  const toIso = () => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const t = /^(\d{2}):(\d{2})$/.exec(time);
    return m && t ? zonedTime(Number(m[1]), Number(m[2]), Number(m[3]), Number(t[1]), Number(t[2]), tz) : "";
  };
  const titleErr = tried && !title.trim() ? "Give the appointment a title." : null;

  const save = () => {
    setTried(true);
    if (!title.trim()) return;
    const at = toIso();
    if (!at) { setErr("Pick a date and a start time."); return; }
    const payload = { title, startAt: at, minutes: Number(minutes), attendeeIds: attendees, teamId: teamId || undefined, projectId: projectId || undefined, locationId: locationId || undefined, note };
    const res = a ? store.run(updateAppointment, a.id, payload) : store.run(createAppointment, payload);
    if (!res.ok) { setErr(res.error); return; }
    onSaved?.(a ? a.id : res.id || "");
    if (!a) onClose();
  };
  const cancel = () => {
    if (!a) return;
    const res = store.run(cancelAppointment, a.id, reason);
    if (res.ok) onClose(); else setErr(res.error);
  };

  return (
    <SidePanel open onClose={onClose} width={560} eyebrow="Appointment" title={a ? a.title : "New appointment"}
      footer={may ? <>
        {a && (confirmCancel
          ? <><TextInput ariaLabel="Reason for cancelling" value={reason} onChange={setReason} placeholder="Reason (kept in the history)" /><Button variant="danger" onClick={cancel}>Confirm cancel</Button></>
          : <Button variant="ghost" onClick={() => setConfirmCancel(true)}>Cancel appointment</Button>)}
        <span className="pk-grow" />
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button variant="primary" onClick={save}>{a ? "Save changes" : "Add to calendar"}</Button>
      </> : <span className="wk-small">Only the owner or a manager of its team can change this appointment.</span>}>
      {a && (
        <KV items={[
          ["Owner", <PersonName key="o" id={a.ownerId} />],
          ["When", dt(a.startAt) + ", " + a.minutes + " min (" + tz + ")"],
          ["Team", q.teamLabel(a.teamId)],
          ["Project", a.projectId ? (core.data.projects.find((p) => p.id === a.projectId)?.title || "Unknown") : "None"]
        ]} />
      )}
      <Notice>A business appointment on the shared calendar. It is separate from automation schedules, and nobody is sent an invitation from this demo.</Notice>
      {may && (
        <div className="wk-stack" style={{ marginTop: 14 }}>
          <Field label="Title" htmlFor="apt-title" error={titleErr}><TextInput id="apt-title" value={title} onChange={setTitle} invalid={!!titleErr} placeholder="For example: Quarterly review with Team B" /></Field>
          <div className="pk-grid2">
            <Field label="Date" htmlFor="apt-date"><TextInput id="apt-date" type="date" value={date} onChange={setDate} /></Field>
            <Field label={"Start (" + tz + ")"} htmlFor="apt-time"><TextInput id="apt-time" type="time" value={time} onChange={setTime} /></Field>
            <Field label="Length" htmlFor="apt-min"><Select id="apt-min" value={minutes} onChange={setMinutes} options={MINUTES.map((m) => ({ value: String(m), label: m < 60 ? m + " minutes" : m / 60 + (m === 60 ? " hour" : " hours") }))} /></Field>
            <Field label={core.config.terminology.team} htmlFor="apt-team" help="Who can see it besides the people attending.">
              <Select id="apt-team" value={teamId} onChange={setTeamId} options={[{ value: "", label: "No team" }, ...teamIds.map((id) => ({ value: id, label: q.teamLabel(id) }))]} />
            </Field>
            {projectsOn && projects.length > 0 && (
              <Field label={core.config.projects.label || "Project"} htmlFor="apt-project">
                <Select id="apt-project" value={projectId} onChange={setProjectId} options={[{ value: "", label: "None" }, ...projects.map((p) => ({ value: p.id, label: p.title }))]} />
              </Field>
            )}
            {core.config.locations.length > 0 && (
              <Field label="Location" htmlFor="apt-loc">
                <Select id="apt-loc" value={locationId} onChange={setLocationId} options={[{ value: "", label: "None" }, ...core.config.locations.map((l) => ({ value: l.id, label: l.label }))]} />
              </Field>
            )}
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="pk-label" style={{ padding: 0, marginBottom: 6 }}>Attendees ({attendees.length})</legend>
            <div className="wk-layers">
              {staff.map((p) => (
                <label key={p.id} className="wk-check" style={{ fontSize: 12.5, marginRight: 10 }}>
                  <input type="checkbox" checked={attendees.includes(p.id)} onChange={() => setAttendees(attendees.includes(p.id) ? attendees.filter((x) => x !== p.id) : [...attendees, p.id])} />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Note" htmlFor="apt-note"><TextArea id="apt-note" value={note} onChange={setNote} rows={2} /></Field>
          <InlineError text={err} />
        </div>
      )}
      {a?.projectId && projectsOn && (
        <div className="wk-row" style={{ marginTop: 12 }}><Button size="sm" onClick={() => openObject("project", a.projectId!)}>Open the project</Button></div>
      )}
      {a && <Section label="History"><History ids={[a.id]} /></Section>}
    </SidePanel>
  );
}
