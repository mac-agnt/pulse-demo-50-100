/* The core KPI band, in the original Pulse design: accent backdrop, mono
   eyebrow, "<organisation> · <area>" title, Edit KPIs, and glass KPI cards
   whose figures count in. The core KPIs are the same on every area; each
   browser chooses its own 4 to 6. Every card is the metric engine's own
   result and opens the metric panel with the working. */

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useCore, scopeLabel, scopeKey } from "../../core";
import { MetricPanel } from "./MetricPanel";
import { CORE_MAX, CORE_MIN, basisText, dashStore, deltaText, metricView, useCoreKpis, type MetricView } from "./state";
import "../../styles/dashboard.css";

export function useReducedMotion(): boolean {
  const get = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [r, setR] = useState(get);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

/** 0 to 1 over 900 ms whenever key changes. A timer, not rAF, so hidden frames cannot freeze it. */
export function useCountIn(key: string): number {
  const still = useReducedMotion();
  const [t, setT] = useState(1);
  useEffect(() => {
    if (still) { setT(1); return; }
    const t0 = Date.now();
    setT(0);
    const id = window.setInterval(() => {
      const x = Math.min(1, (Date.now() - t0) / 900);
      setT(x);
      if (x >= 1) window.clearInterval(id);
    }, 40);
    return () => window.clearInterval(id);
  }, [key, still]);
  return t;
}

/** The figure part-way through its count-in. Leaves text without a single leading number alone. */
export function countValue(raw: string, i: number, t: number): string {
  if (t >= 1) return raw;
  const m = raw.match(/^([^0-9-]*)(-?[\d,]+(?:\.\d+)?)([^0-9]*)$/);
  if (!m) return raw;
  const dec = (m[2].split(".")[1] || "").length;
  const target = parseFloat(m[2].replace(/,/g, ""));
  const e = 1 - Math.pow(1 - Math.min(1, t + i * 0.04), 3);
  const [whole, frac] = (target * e).toFixed(dec).split(".");
  return m[1] + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac ? "." + frac : "") + m[3];
}

const UP = "M12 19V7 M6 12l6-6 6 6";
const DOWN = "M12 5v12 M6 12l6 6 6-6";

export function KpiBand({ backdrop, area, backdropColor }: { backdrop?: ReactNode; area: string; backdropColor?: string }) {
  const { core, ctx } = useCore();
  const kpis = useCoreKpis(core);
  const [edit, setEdit] = useState(false);
  const views = kpis.ids.map((id) => metricView(core, ctx, id)).filter((x): x is MetricView => !!x);
  const t = useCountIn(area + "|" + scopeKey(ctx.scope) + "|" + kpis.ids.join(","));
  const scope = scopeLabel(core, ctx.scope);
  const enabled = core.config.metrics.filter((m) => m.enabled);
  const choices = enabled.filter((m) => !kpis.ids.includes(m.id));
  const floor = Math.min(CORE_MIN, enabled.length);
  const full = kpis.ids.length >= CORE_MAX;

  return (
    <section data-kpi-band="1" className="db-band" aria-label="Core KPIs" style={{ ["--kb" as string]: backdropColor }}>
      {backdrop}
      <div className="db-band-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="db-band-eyebrow">{("Core KPIs · " + scope + " · Click any number to see the working").toUpperCase()}</div>
          <h2 className="db-band-title">{core.config.workspace.name} · {area}</h2>
        </div>
        <button type="button" className="ixb db-edit" aria-pressed={edit} onClick={() => setEdit(!edit)}
          style={{ background: edit ? "var(--on-accent)" : "var(--on-accent-soft)", borderColor: edit ? "var(--on-accent)" : "var(--on-accent-soft)", color: edit ? "var(--accent)" : "var(--on-accent)" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20h4L19 9a2.4 2.4 0 0 0-3.4-3.4L4.6 16.6V20Z" />
          </svg>
          {edit ? "Done" : "Edit KPIs"}
        </button>
      </div>

      {views.length === 0 ? (
        <div className="db-band-empty">No measures are enabled. An administrator can enable measures in Settings.</div>
      ) : (
        <div className="db-kpis">
          {views.map((v, i) => {
            const r = v.result;
            const d = deltaText(r);
            const good = r.delta !== null && ((r.delta > 0 && r.def.better === "up") || (r.delta < 0 && r.def.better === "down"));
            const color = good ? "var(--kpi-up)" : "var(--kpi-down)";
            const canRemove = kpis.ids.length > floor;
            return (
              <div key={r.def.id} className={"ixc db-kpi" + (edit ? " db-kpi--edit" : "")}>
                <button type="button" className="db-kpi-btn" onClick={() => dashStore.set({ metricId: r.def.id })}
                  aria-label={r.def.label + ": " + v.display + ". Open the working"}>
                  <span className="db-kpi-top">
                    <span className="db-kpi-label">{r.def.label}</span>
                    {r.partial && <span className="db-flag" title={r.missing.map((m) => m.label + ": " + m.reason).join(" ") || "Some contributors could not be counted"}>PARTIAL</span>}
                    {r.stale && <span className="db-flag" title="Some source data is older than 24 hours">STALE</span>}
                  </span>
                  <span className={"db-kpi-value" + (v.noData ? " db-kpi-value--none" : "")} style={{ animationDelay: i * 70 + "ms" }}>
                    {v.noData ? "No data" : countValue(v.display, i, t)}
                  </span>
                  <span className="db-kpi-delta">
                    {v.noData ? (
                      <span className="db-kpi-hint" title={v.explanation || undefined}>{v.explanation}</span>
                    ) : (
                      <>
                        {d && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                            style={{ flex: "none", animation: (r.delta! > 0 ? "driftUp" : "driftDown") + " 2.4s ease-in-out " + i * 180 + "ms infinite" }}>
                            <path d={r.delta! > 0 ? UP : DOWN} />
                          </svg>
                        )}
                        {d && <span style={{ fontSize: 11.5, whiteSpace: "nowrap", color }}>{d}</span>}
                        <span className="db-kpi-hint">{basisText(r)}</span>
                      </>
                    )}
                  </span>
                </button>
                {edit && (
                  <button type="button" className="ixd db-kpi-x" onClick={() => kpis.set(kpis.ids.filter((x) => x !== r.def.id))}
                    disabled={!canRemove} title={canRemove ? "Remove " + r.def.label + " from the core KPIs" : "Keep at least " + floor + " core KPIs"}
                    aria-label={"Remove " + r.def.label}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12 M18 6 6 18" /></svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {edit && (
        <div className="db-kpi-edit">
          <span className="db-kpi-edit-k">ADD KPI</span>
          {choices.map((m) => (
            <button key={m.id} type="button" className="ixe db-kpi-add" disabled={full} title={full ? "The band holds " + CORE_MAX + " KPIs. Remove one first." : undefined}
              onClick={() => kpis.set([...kpis.ids, m.id])}>
              <span style={{ color: "var(--accent)" }}>+</span>{m.label}
            </button>
          ))}
          {choices.length === 0 && <span style={{ fontSize: 12, color: "var(--faint)" }}>Every enabled measure is pinned.</span>}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, color: "var(--on-accent-2)" }}>Saved in this browser only.</span>
          {kpis.custom && <button type="button" className="ixe db-kpi-add" onClick={kpis.reset}>Reset to default</button>}
        </div>
      )}
      {/* The panel renders into the themed shell root, outside the band's stacking context. */}
      {typeof document !== "undefined" && createPortal(<MetricPanel />, document.querySelector("[data-theme]") || document.body)}
    </section>
  );
}
