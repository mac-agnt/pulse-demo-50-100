/* Automatic top-down layout for the organisation chart. A tidy tree: levels
   follow coordinatorId, each parent sits centred over its children, several
   roots sit side by side, and wide branches fold into one group node instead
   of shrinking into unreadable miniatures. Pure: no DOM. */

import type { AgentDef, Id } from "../../core";

export const NODE_W = 248;
export const NODE_H = 156;
export const GROUP_H = 76;
export const GAP_X = 20;
export const GAP_Y = 68;
export const ROOT_GAP = 72;
/** More children than this fold the rest into a group node until expanded. */
export const MAX_KIDS = 6;

export interface LNode {
  key: string;
  kind: "agent" | "group";
  agent?: AgentDef;
  /** Group node: the agents it stands for. */
  hidden?: AgentDef[];
  parentKey?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  /** Visible or not, how many agents report here. */
  childCount: number;
  collapsed: boolean;
}

export interface Layout { nodes: LNode[]; edges: { parent: LNode; kids: LNode[] }[]; width: number; height: number; byAgent: Map<Id, LNode> }

interface T { node: LNode; kids: T[]; sw: number }

export function layoutChart(agents: AgentDef[], opts: { collapsed: Set<Id>; expandedGroups: Set<Id>; forceOpen?: Set<Id> }): Layout {
  const ids = new Set(agents.map((a) => a.id));
  const kidsOf = (id: Id | null) => agents.filter((a) => (id === null ? !a.coordinatorId || !ids.has(a.coordinatorId) : a.coordinatorId === id));
  const build = (a: AgentDef, depth: number, parentKey?: string, seen = new Set<Id>()): T => {
    seen.add(a.id);
    const all = kidsOf(a.id).filter((k) => !seen.has(k.id));
    const collapsed = opts.collapsed.has(a.id) && !opts.forceOpen?.has(a.id);
    const node: LNode = { key: a.id, kind: "agent", agent: a, parentKey, x: 0, y: 0, w: NODE_W, h: NODE_H, depth, childCount: all.length, collapsed: collapsed && all.length > 0 };
    let kids: T[] = [];
    if (!node.collapsed) {
      const fold = all.length > MAX_KIDS && !opts.expandedGroups.has(a.id) && !all.some((k) => opts.forceOpen?.has(k.id));
      const shown = fold ? all.slice(0, MAX_KIDS - 1) : all;
      kids = shown.map((k) => build(k, depth + 1, a.id, seen));
      if (fold) {
        const rest = all.slice(MAX_KIDS - 1);
        kids.push({ node: { key: "group:" + a.id, kind: "group", hidden: rest, parentKey: a.id, x: 0, y: 0, w: NODE_W, h: GROUP_H, depth: depth + 1, childCount: 0, collapsed: true }, kids: [], sw: NODE_W });
      }
    }
    const span = kids.reduce((s, k) => s + k.sw, 0) + Math.max(0, kids.length - 1) * GAP_X;
    return { node, kids, sw: Math.max(NODE_W, span) };
  };
  const roots = kidsOf(null).map((r) => build(r, 0));
  const place = (t: T, left: number) => {
    t.node.y = t.node.depth * (NODE_H + GAP_Y);
    if (!t.kids.length) { t.node.x = left + (t.sw - NODE_W) / 2; return; }
    const span = t.kids.reduce((s, k) => s + k.sw, 0) + (t.kids.length - 1) * GAP_X;
    let cur = left + (t.sw - span) / 2;
    for (const k of t.kids) { place(k, cur); cur += k.sw + GAP_X; }
    const first = t.kids[0].node, last = t.kids[t.kids.length - 1].node;
    t.node.x = (first.x + last.x) / 2;
  };
  /* Trees with reports first, side by side. Independent agents without reports
     then take free room on the top row (beside a coordinator, above its wide
     branches) before widening the chart; a wide chart would force unreadable zoom. */
  const trees = roots.filter((r) => r.kids.length), loners = roots.filter((r) => !r.kids.length);
  let left = 0;
  for (const r of trees) { place(r, left); left += r.sw + ROOT_GAP; }
  const topRow = trees.map((t) => t.node);
  let slotRight = Math.max(0, left - ROOT_GAP);
  for (const r of loners) {
    const x = slotRight - NODE_W;
    const clash = topRow.some((n) => x < n.x + n.w + ROOT_GAP && x + NODE_W + ROOT_GAP > n.x);
    if (trees.length && x >= 0 && !clash) {
      r.node.x = x; r.node.y = 0; topRow.push(r.node); slotRight = x - GAP_X;
    } else {
      place(r, left); left += r.sw + ROOT_GAP;
    }
  }
  const nodes: LNode[] = [];
  const edges: Layout["edges"] = [];
  const walk = (t: T) => { nodes.push(t.node); if (t.kids.length) edges.push({ parent: t.node, kids: t.kids.map((k) => k.node) }); t.kids.forEach(walk); };
  roots.forEach(walk);
  const width = Math.max(NODE_W, left - ROOT_GAP, ...nodes.map((n) => n.x + n.w));
  const height = nodes.reduce((m, n) => Math.max(m, n.y + n.h), NODE_H);
  return { nodes, edges, width, height, byAgent: new Map(nodes.filter((n) => n.agent).map((n) => [n.agent!.id, n])) };
}

/** One orthogonal connector per parent: a stem down, a bar across, a drop to each child. */
export function connectorPath(parent: LNode, kids: LNode[]): string {
  const px = parent.x + parent.w / 2;
  const py = parent.y + parent.h;
  const mid = py + GAP_Y / 2;
  const xs = kids.map((k) => k.x + k.w / 2);
  const minX = Math.min(px, ...xs), maxX = Math.max(px, ...xs);
  let d = "M" + px + " " + py + "V" + mid + "M" + minX + " " + mid + "H" + maxX;
  for (const k of kids) d += "M" + (k.x + k.w / 2) + " " + mid + "V" + k.y;
  return d;
}

/** Runtime delegation for the overlay: a dashed curve, deliberately unlike a reporting line. */
export function delegationPath(from: LNode, to: LNode): string {
  const sx = from.x + from.w * 0.72, sy = from.y + from.h;
  const ex = to.x + to.w * 0.28, ey = to.y;
  if (ey > sy) {
    const c = Math.max(40, (ey - sy) * 0.5);
    return "M" + sx + " " + sy + "C" + sx + " " + (sy + c) + " " + ex + " " + (ey - c) + " " + ex + " " + ey;
  }
  // Delegation to an agent at the same level or above (the chart and the runtime graph can differ).
  const lift = Math.min(from.y, to.y) - 36;
  return "M" + (from.x + from.w / 2) + " " + from.y + "C" + (from.x + from.w / 2) + " " + lift + " " + (to.x + to.w / 2) + " " + lift + " " + (to.x + to.w / 2) + " " + to.y;
}
