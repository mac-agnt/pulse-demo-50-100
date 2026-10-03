/* The people list in the original Pulse card-row style: avatar, name and title,
   a meta line with team, contract, manager and tenure, and status chips on the
   right. A row opens the person panel. */

import { useCore, fmtDate, tenureLabel } from "../../core";
import type { PersonRow } from "../../core/people";
import { Pill } from "../frame";
import { I } from "./bits";
import { CONTRACT_LABEL, ICONS, STAGE_LABEL, STAGE_TONE, certSummary, docSummary, fmtYear } from "./util";

export function PersonCardRow({ r, index, selected, onOpen }: { r: PersonRow; index: number; selected: boolean; onOpen: () => void }) {
  const { core, q } = useCore();
  const tz = core.config.timezone;
  const cert = certSummary(r, tz);
  const docs = docSummary(r);
  const started = r.tenureDays < 0 ? "Starts " + fmtDate(r.e.startDate, tz) : "Started " + fmtYear(r.e.startDate, tz) + ", " + tenureLabel(r.tenureDays);
  const place = [r.team, r.unit].filter(Boolean).join(" · ");
  const load = r.openTasks + " open" + (r.overdueTasks ? ", " + r.overdueTasks + " overdue" : "");
  return (
    <button type="button" className="pp-row" data-selected={selected} onClick={onOpen} style={{ animationDelay: Math.min(index, 12) * 30 + "ms" }}>
      <span className="pp-av" data-away={!!r.awayNow} title={r.awayNow ? "Away now" : undefined}>{q.initials(r.person.id)}</span>
      <span className="pp-main">
        <span style={{ display: "block" }}>
          <span className="pp-name">{r.person.name}</span>
          <span className="pp-title">{r.person.title}</span>
        </span>
        <span className="pp-meta">
          <span className="pp-m"><I d={ICONS.team} />{place || "No team"}</span>
          <span className="pp-m"><I d={ICONS.clock} />{CONTRACT_LABEL[r.e.contract]}, {r.e.hoursPerWeek} h/wk</span>
          <span className="pp-m"><I d={ICONS.person} />{r.e.managerId ? "Reports to " + r.manager : "No manager"}</span>
          <span className="pp-m" style={r.e.stage === "leaving" && r.e.endDate ? { color: "var(--warn)" } : undefined}>
            <I d={ICONS.cal} />{r.e.stage === "leaving" && r.e.endDate ? "Last day " + fmtDate(r.e.endDate, tz) : started}
          </span>
        </span>
      </span>
      <span className="pp-chips">
        {r.awayNow && <Pill tone="warn">Away to {fmtDate(r.awayNow.to, tz)}</Pill>}
        <Pill tone={STAGE_TONE[r.e.stage]}>{STAGE_LABEL[r.e.stage]}</Pill>
        <Pill tone={cert.tone} dot={false}><I d={ICONS.badge} size={11} />{cert.text}</Pill>
        <Pill tone={docs.tone} dot={false}><I d={ICONS.doc} size={11} />{docs.text}</Pill>
        <span className="pp-load" title="Workload: open tasks assigned to this person. Not a performance measure.">
          <I d={ICONS.tasks} size={11} />{load}
        </span>
      </span>
    </button>
  );
}
