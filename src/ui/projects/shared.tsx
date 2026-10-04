/* Small pieces shared by the Projects views: labels from configuration,
   health and progress display, dates. Everything reads the core helpers in
   src/core/projects.ts, so the table, the board, the timeline and the
   detail page show the same figures. */

import type { ReactNode } from "react";
import {
  useCore, fmtDate, ms, projectTerms, projectProgress, projectHealth, PROJECT_HEALTH_LABEL, PROJECT_HEALTH_TONE,
  type Health, type Project, type ProjectHealth, type ProjectProgress
} from "../../core";
import { Chip } from "../kit";
import "../../styles/projects.css";

export function useProjectsCtx() {
  const { core, ctx, q, session } = useCore();
  const tz = core.config.timezone;
  return { core, ctx, q, session, tz, now: ctx.now, T: projectTerms(core.config), d: (at?: string) => (at ? fmtDate(at, tz) : "None") };
}

export type DetailTab = "overview" | "plan" | "tasks" | "budget" | "risks" | "files";

export function HealthChip({ health, prefix, title }: { health?: Health; prefix?: string; title?: string }) {
  if (!health) return <span className="pj-faint">{prefix ? prefix + "not reported" : "Not reported"}</span>;
  return <Chip tone={PROJECT_HEALTH_TONE[health]} title={title}>{(prefix || "") + PROJECT_HEALTH_LABEL[health]}</Chip>;
}

export function reasonsText(h: ProjectHealth): string {
  return h.reasons.length ? h.reasons.map((r) => r.text).join(". ") + "." : "No warning signs: next milestone on schedule, no overdue tasks, gates clear and no open high risks.";
}

/** Computed health beside the owner-reported health. The two are never merged. */
export function HealthPair({ h, compact }: { h: ProjectHealth; compact?: boolean }) {
  return (
    <span className="pj-health" title={"Computed: " + reasonsText(h) + (h.reported ? " Reported by the owner: " + PROJECT_HEALTH_LABEL[h.reported] + "." : "")}>
      <HealthChip health={h.health} />
      {compact
        ? <span className={"pj-reported" + (h.differs ? " pj-reported--differs" : "")}>{h.reported ? "Reported " + PROJECT_HEALTH_LABEL[h.reported].toLowerCase() : "Not reported"}</span>
        : <span className={"pj-reported" + (h.differs ? " pj-reported--differs" : "")}>Owner reports {h.reported ? PROJECT_HEALTH_LABEL[h.reported].toLowerCase() : "nothing yet"}</span>}
    </span>
  );
}

export function progressTitle(pr: ProjectProgress): string {
  return "Basis: " + pr.basisLabel + ". " + pr.text + "." + (pr.excluded.length ? " Left out: " + pr.excluded.join("; ") + "." : "") + " " + pr.note;
}

export function ProgressBar({ pr, wide }: { pr: ProjectProgress; wide?: boolean }) {
  const v = pr.value;
  return (
    <span className={"pj-progress" + (wide ? " pj-progress--wide" : "")} title={progressTitle(pr)}>
      <span className="pj-bar" aria-hidden="true"><span style={{ width: (v === null ? 0 : Math.max(2, Math.min(100, v))) + "%" }} /></span>
      <span className="pj-mono">{v === null ? "Not measurable" : Math.round(v) + "%"}</span>
      {pr.excluded.length > 0 && <span className="pj-flag" aria-label={pr.excluded.join("; ")}>partial</span>}
    </span>
  );
}

export function SlipChip({ days }: { days: number }) {
  if (days === 0) return null;
  const late = days > 0;
  return <Chip tone={late ? "warn" : "ok"} title={late ? days + " days later than the baseline date" : -days + " days earlier than the baseline date"}>{(late ? "+" : "") + days + "d"}</Chip>;
}

export const useHealth = (p: Project) => {
  const { core, now } = useProjectsCtx();
  return projectHealth(core, p, now);
};

export const useProgress = (p: Project) => {
  const { core } = useProjectsCtx();
  return projectProgress(core, p);
};

export function daysFromNow(at: string, now: string) {
  return Math.round((ms(at) - ms(now)) / 864e5);
}

export function Faint({ children }: { children: ReactNode }) {
  return <span className="pj-faint">{children}</span>;
}

/** The main scroll container, so leaving and returning to a list keeps its place. */
export function mainScroller(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-scroll-main="1"]') || (document.scrollingElement as HTMLElement | null);
}

export function newKey(prefix: string) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

export function money(n: number, currency: string) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

/** Today's date as YYYY-MM-DD in the organisation's timezone. */
export function dayInput(at: string, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}

export const BACK_ICON = "M15 6l-6 6 6 6";
