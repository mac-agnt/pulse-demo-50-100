/* People area: headcount, certificates in date, who is away and overdue work;
   certificate expiries over the next 60 days by week; headcount by unit; the
   comparison table; and the people who need an action. Employment details
   come through personRows, so only rows the viewer may see are counted. */

import { useCore, personRows, DAY, ms, type MetricDef } from "../../core";
import { CompareTable, comparisonRows } from "./Comparison";
import { ExceptionList, type ExceptionRow } from "./Exceptions";
import { CardHead, ColumnChart, EmptyNote, Glass } from "./parts";
import { MetricCards, WhereFrom, toPeople } from "./blocks";
import { weeks, type WeekPoint, type WeekSeries } from "./series";

export function PeopleArea({ defs, data }: { defs: MetricDef[]; data: ReturnType<typeof comparisonRows> }) {
  const { core, ctx, q } = useCore();
  const tz = core.config.timezone;
  const rows = personRows(q);
  const horizon = ms(ctx.now) + 60 * DAY;
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short" });

  /* Certificate expiries in the next 60 days, by week. Real expiry dates only. */
  const expiring = rows.flatMap((r) => r.certs.filter((c) => c.cert.expires && ms(c.cert.expires) > ms(ctx.now) && ms(c.cert.expires) <= horizon)
    .map((c) => ({ at: c.cert.expires as string, id: r.person.id, who: r.person.name + ", " + c.cert.name })));
  const points: WeekPoint[] = weeks(ctx.now, 9, "next").map((w) => {
    const hit = expiring.filter((c) => c.at > w.start && c.at <= w.end && ms(c.at) <= horizon);
    return { label: f.format(new Date(w.start)), start: w.start, end: w.end, value: hit.length, display: String(hit.length), ids: hit.map((c) => c.id) };
  });
  const series: WeekSeries = { caption: "Certificates expiring, next 60 days", unit: "COUNT", points, entity: "person", rolling: false };

  /* The same rule as the Work, People count: lapsed certificates, probation reviews within 30 days, unsigned documents. */
  const needs = rows.filter((r) => r.certIssue === "lapsed" || (r.probationDueDays !== null && r.probationDueDays <= 30) || r.docsOutstanding > 0);
  const exc: ExceptionRow[] = needs.slice(0, 6).map((r) => {
    const why = [
      r.certIssue === "lapsed" ? "certificate lapsed" : null,
      r.probationDueDays !== null && r.probationDueDays <= 30 ? (r.probationDueDays < 0 ? "probation review overdue" : "probation review in " + r.probationDueDays + " days") : null,
      r.docsOutstanding > 0 ? r.docsOutstanding + (r.docsOutstanding === 1 ? " document" : " documents") + " to sign" : null
    ].filter(Boolean).join(", ");
    return { key: r.person.id, tone: r.certIssue === "lapsed" ? "bad" : "warn", tag: r.certIssue === "lapsed" ? "Lapsed" : "Action", title: r.person.name,
      reason: r.team + (r.unit ? ", " + r.unit : "") + ". " + why.charAt(0).toUpperCase() + why.slice(1) + ".", onOpen: toPeople };
  });

  const headcount = core.config.metrics.find((m) => m.id === "headcount" && m.enabled) || defs[0];

  return (
    <>
      <MetricCards defs={defs} />
      <div className="db-main">
        <Glass>
          <CardHead title="Certificate expiries by week" unit="NEXT 60 DAYS · COUNT"
            right={<button type="button" className="db-link" onClick={toPeople}>Open Work, People</button>} />
          <div style={{ marginTop: 18 }}>
            {rows.length === 0 ? (
              <EmptyNote title="No people in this scope" body="Employment details are added in Work, People. Certificate expiries appear here once they are recorded." />
            ) : expiring.length === 0 ? (
              <EmptyNote title="No certificates expire in the next 60 days" body={rows.some((r) => r.certIssue === "missing" || r.certIssue === "lapsed") ? "Some people have missing or lapsed certificates; see the list below." : "Every recorded certificate is in date beyond 60 days."} />
            ) : (
              <ColumnChart series={series} onBar={() => toPeople()} />
            )}
          </div>
        </Glass>
        <WhereFrom def={headcount} by={data.by} onRow={() => toPeople()} />
      </div>
      <div style={{ marginTop: 12 }}><CompareTable defs={defs} data={data} /></div>
      <div style={{ marginTop: 12 }}>
        <ExceptionList title="People needing an action" rows={exc} total={needs.length}
          empty={{ title: rows.length ? "Nobody needs an action" : "No people in this scope", body: rows.length
            ? "Lapsed certificates, probation reviews due within 30 days and unsigned documents appear here."
            : "Employment details are added in Work, People." }} />
      </div>
    </>
  );
}
