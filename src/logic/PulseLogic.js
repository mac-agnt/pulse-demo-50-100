import React from "react";
import { DCLogic } from "../runtime/logic";
import {
  INK,
  BODY,
  DIM,
  FAINT,
  LIME,
  GREEN,
  AMBER,
  RED,
  NEUTRAL,
  MONO,
  ICONS,
  REC_SECTIONS as REC_SECTIONS_RAW,
  ONTO_NODES,
  ONTO_EDGES,
  BG_DEFS,
  THEMES,
  NAV as NAV_RAW,
  WORK_SECTIONS,
  PERSONALITIES,
  ANSWER_STYLES,
  SKILL_DEFS,
  TRAIN_PHASES,
  BRIEF_QUESTIONS,
  STATE_LABELS,
  FACE_SHAPES,
  FACE_TINTS,
  CLUSTERS,
  mulberry,
  hexRGB,
  buildGraph
} from "./data";
import { store, nowFor, registerNavigator, scopeLabel, answer, openObject, visibleUpdates, ops as coreOps } from "../core";
import { workCounts, waitingOnMe, attention } from "../ui/selectors";
import { PAGES, GROUP_LABEL, visiblePages, sectionsFor, defaultSectionFor, pageLabel, pageDef } from "../core/modules";
import { SETTINGS_SECTIONS, SETTINGS_GROUPS } from "../ui/settings/registry";
import { pinnedPages, subscribePins } from "../ui/pins";

/* ── Locked layout ──────────────────────────────────────────────────────────
   These rules hold for every client build, whatever data.js says:
   1. Agents always sits directly under Home in the side rail.
   2. The Ontology graph is never deleted. In the 50-100 build it lives in
      Records as the "Relationships" tab (illustrative), and Records opens on
      Browse, as the V2 implementation brief requires. If a customisation drops
      it from REC_SECTIONS, the stock entry is put back.
   Re-theme and re-label freely; don't remove these guards. */
const ONTOLOGY_SECTION = {id:"ontology", label:"Ontology", blurb:"How every record connects: entities, predicates and the paths between them."};
const REC_SECTIONS = REC_SECTIONS_RAW.filter(s => s.id !== "ontology")
  .concat([REC_SECTIONS_RAW.find(s => s.id === "ontology") || ONTOLOGY_SECTION]);
void REC_SECTIONS;

/* Old section ids still work, so saved links and notifications never dead-end. */
const LEGACY_SECTION = {
  Work: {tasks:"mine", schedules:"calendar"},
  Records: {ontology:"relationships"},
  Activity: {all:"history", people:"overview", ai:"overview", systems:"overview"},
  Home: {}
};
/* Where each page keeps its current section in state. */
const SECTION_KEY = {Work:"workSection", Records:"recSection", Activity:"actKpi", Dashboard:"dashArea", Home:"homeMode", Agents:"agentsSection"};
const NAV = (() => {
  const items = NAV_RAW.filter(n => n.page !== "Home" && n.page !== "Agents");
  const home = NAV_RAW.find(n => n.page === "Home") || {label:"Home", icon:"helios", page:"Home"};
  const agents = NAV_RAW.find(n => n.page === "Agents") || {label:"Agents", icon:"navAgents", page:"Agents"};
  // Leading dividers would otherwise sit between Agents and the next item.
  while (items.length && items[0].divider) items.shift();
  return [home, agents].concat(items);
})();

/* All state and behaviour for Pulse. renderVals() returns the flat object the views render from. */
export default class PulseLogic extends DCLogic {
  state = { w: typeof window === "undefined" ? 1440 : window.innerWidth, theme:"harbour", page:"Home", draft:"", query:"", thread:[], typed:0, paletteOpen:false, showNotifs:false, palScope:"All", palSel:0, palRecent:[],
            done:{}, resolved:{}, approved:{}, inboxFilter:"All", approvalFilter:"Awaiting you", open:null, range:"30d",
            workDoc:null, workDocTab:"work",
            queue:"mine", recordTab:"Overview", record:"person", hovered:null, hoverLabel:"", hoverHint:"", hoverTop:0,
            flags:{approvals:true, automations:true, insights:true, customEntities:false, whatsapp:true, composio:false},
            workSection:"mine", workViews:{}, modSections:{}, homeMode:null, agentsSection:"organisation", addedTasks:[], newTask:"", newPriority:"Medium",
            timerRunning:false, timerTask:null, timerPreset:null, scheduleOff:{},
            adminCard:null, adminFlags:{},
            adminOpen:null, adminFlags:{}, adminGroup:null,
            actPaused:false, actHover:null, actKpi:"overview", actQuery:"", actOpen:null, actTick:0,
            recSection:"browse", recAsk:"", treeOpen:true, treeExpanded:{}, treeFile:"fl-1", treeQuery:"",
            ontoNode:"Organisation", ontoHover:null, ontoLayout:"Force",
            newRecOpen:false, newRecName:"", newRecTemplate:"Field sheet", newRecCat:"All",
            opsFilter:"all", opsOff:{}, opsOpen:null, opsScope:"week", opsDay:26, opsOrder:null, opsDrag:null,
            opsBuilderOpen:false, opsBuilderMode:"workflow", builderText:"", builderGenerated:false,
            railOpen:true, barOpen:true, chatRailPinned:false, widgetEdit:false, widgets:["inbox","work","activity"],
            kpiEdit:false, kpiKeys:["revenue","cash","overdue","margin","jobs"],
            aspect:"sales", filterMenuOpen:false, customFilter:"", extraFilters:[],
            workWidget:"queue", miniOpen:false, miniThread:[], miniDraft:"", miniTab:"chat", miniTone:"plain", miniWorkOpen:"tasks",
            agents:[], agentId:null, groupNames:{}, agentQuery:"", agentDraft:"", agentExtra:{},
            builderOpen:false, builderMode:"new", trained:false, training:false, trainPhase:0,
            briefThread:[], briefDraft:"", briefPicks:{},
            agentSpec:{name:"", shape:"crown-pebble", tint:"#191c1f", persona:"", personality:"Straight-talking",
                   answer:"Short answers", context:["Organisations","Tasks"], skills:["Search records","Summarise activity"], tasks:[]} };

  /* Several shortest-path searches run at once, each with its own hue. The
     settling order and parent tree are solved up front; the animation only
     reveals them, so every spark follows a route the graph really has. */
  QUERY_HUES(){ return ["#c8f04b", "#6ad0f0", "#9d8cf5", "#f0c04b", "#f07a9d", "#5fe0a8"]; }

  /* Keyword search: match the query against cluster names, then trace a real
     path between two matches (or around one, if only a single cluster hits)
     using the same Dijkstra the ambient sparks use — so the result is an
     actual route through the graph, not a fake highlight. */
  matchClusters(q){
    const words = q.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    if (!words.length) return [];
    const hit = [];
    CLUSTERS.forEach((c, i) => {
      const name = c[0].toLowerCase();
      if (words.some(w => name.includes(w) || w.includes(name.split(" ")[0]))) hit.push(i);
    });
    return hit;
  }

  runOntoQuery(){
    const q = (this.state.ontoQuery || "").trim();
    if (!q || !this.graph) { this.setState({ontoResult:null}); return; }
    const g = this.graph, hits = this.matchClusters(q);
    if (!hits.length){ this.setState({ontoResult:{empty:true, query:q}}); return; }

    const hubOf = (ci) => g.hubs.filter(h => g.nodes[h].cluster === ci);
    const hues = this.QUERY_HUES();

    if (hits.length > 1){
      const source = hubOf(hits[0])[Math.floor(Math.random() * hubOf(hits[0]).length)];
      const pool = hubOf(hits[1]);
      const target = pool[Math.floor(Math.random() * pool.length)];
      const search = this.makeTargetedSearch(source, target, 0, hues[0]);
      search.pinned = true;
      this.searches = [search];
      this.setState({ontoResult:{
        empty:false, query:q, mode:"path",
        from: CLUSTERS[g.nodes[source].cluster][0], to: CLUSTERS[g.nodes[target].cluster][0],
        hops: search.path.length ? search.path.length - 1 : null,
        found: search.path.length > 0
      }});
      return;
    }

    // A single match fans out several routes at once — everything the graph
    // has connected to that topic, not just one path to one other record.
    const hub = hubOf(hits[0]);
    const fanCount = Math.min(5, Math.max(3, hub.length));
    const touched = new Set();
    const runs = [];
    for (let i = 0; i < fanCount; i++){
      const source = this.rimNode();
      const target = this.centreNode();
      const search = this.makeTargetedSearch(source, target, i, hues[i % hues.length]);
      search.pinned = true;
      if (search.path.length){ touched.add(CLUSTERS[g.nodes[target].cluster][0]); }
      runs.push(search);
    }
    this.searches = runs;
    touched.delete(CLUSTERS[hits[0]][0]);
    this.setState({ontoResult:{
      empty:false, query:q, mode:"fan",
      from: CLUSTERS[hits[0]][0],
      connected: Array.from(touched),
      found: runs.some(s => s.path.length > 0)
    }});
  }

  makeTargetedSearch(source, target, slot, hue){
    const g = this.graph, n = g.nodes.length;
    const dist = new Float64Array(n).fill(Infinity);
    const parent = new Int32Array(n).fill(-1), pEdge = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n), order = [];
    dist[source] = 0;
    const heap = [[0, source]];
    const push = (d, v) => { heap.push([d, v]); let i = heap.length - 1;
      while (i > 0){ const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break;
        const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop();
      if (heap.length){ heap[0] = last; let i = 0;
        for(;;){ const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break; const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m; } }
      return top; };
    while (heap.length){
      const [d, v] = pop();
      if (done[v]) continue;
      done[v] = 1;
      order.push({v, edge: pEdge[v]});
      if (v === target) break;
      for (const [w, cost, id] of g.adj[v]){
        const nd = d + cost;
        if (nd < dist[w]){ dist[w] = nd; parent[w] = v; pEdge[w] = id; push(nd, w); }
      }
    }
    const path = [];
    if (done[target]){ let v = target; while (v !== -1){ path.push(v); v = parent[v]; } path.reverse(); }
    return {slot, hue, source, target, order, path,
      reveal: 0, cursor: 0, speed: 0.14,
      phase: "sweep", pathReveal: 0, hold: 0, fade: 0,
      delay: 0, sparks: [], traces: []};
  }

  clearOntoQuery(){ this.setState({ontoQuery:"", ontoResult:null}); this.planSearch(); }

  /* The node closest to the origin — every inbound trace converges here. */
  centreNode(){
    if (this._centre !== undefined) return this._centre;
    const nodes = this.graph.nodes;
    let best = 0, bd = Infinity;
    const pool = this.graph.coreIds && this.graph.coreIds.length ? this.graph.coreIds : nodes.map((_, i) => i);
    for (const i of pool){
      const nd = nodes[i];
      const d = nd.x * nd.x + nd.y * nd.y + nd.z * nd.z;
      if (d < bd){ bd = d; best = i; }
    }
    return (this._centre = best);
  }
  /* A leaf out on the rim, biased to the far edge of the structure. */
  rimNode(){
    const nodes = this.graph.nodes;
    let best = 0, bd = -1;
    for (let k = 0; k < 40; k++){
      const i = Math.floor(Math.random() * nodes.length);
      const nd = nodes[i];
      if (nd.kind === "core") continue;
      const d = nd.x * nd.x + nd.y * nd.y + nd.z * nd.z;
      if (d > bd){ bd = d; best = i; }
    }
    return best;
  }
  makeSearch(slot){
    const g = this.graph, n = g.nodes.length, rnd = Math.random;
    // Fire inward: out on the rim, home to the nucleus.
    const source = this.rimNode();
    const target = this.centreNode();

    const dist = new Float64Array(n).fill(Infinity);
    const parent = new Int32Array(n).fill(-1), pEdge = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n), order = [];
    dist[source] = 0;
    const heap = [[0, source]];
    const push = (d, v) => { heap.push([d, v]); let i = heap.length - 1;
      while (i > 0){ const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break;
        const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop();
      if (heap.length){ heap[0] = last; let i = 0;
        for(;;){ const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break; const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m; } }
      return top; };
    while (heap.length){
      const [d, v] = pop();
      if (done[v]) continue;
      done[v] = 1;
      order.push({v, edge: pEdge[v]});
      if (v === target) break;
      for (const [w, cost, id] of g.adj[v]){
        const nd = d + cost;
        if (nd < dist[w]){ dist[w] = nd; parent[w] = v; pEdge[w] = id; push(nd, w); }
      }
    }
    const path = [];
    if (done[target]){ let v = target; while (v !== -1){ path.push(v); v = parent[v]; } path.reverse(); }

    return {slot, hue: this.QUERY_HUES()[slot % 6], source, target, order, path,
      reveal: 0, cursor: 0, speed: 0.34 + Math.random() * 0.16,
      phase: "sweep", pathReveal: 0, hold: 0, fade: 0,
      delay: 2400 + Math.random() * 2600, sparks: [], traces: []};
  }

  /* One throwaway Dijkstra to find a record a short hop-count away. */
  nearbyTarget(source, steps){
    const g = this.graph, n = g.nodes.length;
    const dist = new Float64Array(n).fill(Infinity), done = new Uint8Array(n);
    dist[source] = 0;
    const heap = [[0, source]], order = [];
    while (heap.length && order.length <= steps + 2){
      heap.sort((a, b) => a[0] - b[0]);
      const next = heap.shift();
      const d = next[0], v = next[1];
      if (done[v]) continue;
      done[v] = 1; order.push(v);
      for (const link of g.adj[v]){
        const w = link[0], nd = d + link[1];
        if (nd < dist[w]){ dist[w] = nd; heap.push([nd, w]); }
      }
    }
    const tail = order.slice(Math.max(1, order.length - 8));
    return tail[Math.floor(Math.random() * tail.length)] || source;
  }

  planSearch(){
    if (!this.graph) return;
    this.searches = [this.makeSearch(0)];
    this.clock = 0;
  }

  advance(dt){
    if (!this.searches) return;
    this.clock = (this.clock || 0) + dt;
    for (let i = 0; i < this.searches.length; i++){
      const s = this.searches[i];
      if (s.delay > 0){ s.delay -= dt; continue; }

      if (s.phase === "sweep"){
        s.reveal += dt * s.speed;
        // Each newly settled edge throws a spark that runs its length.
        while (s.cursor < Math.min(s.order.length, Math.floor(s.reveal))){
          const step = s.order[s.cursor++];
          if (step.edge >= 0){
            if ((s.cursor & 3) === 0 && s.sparks.length < 90)
              s.sparks.push({e: step.edge, t: 0, life: 420 + Math.random() * 300});
            if (s.traces.length < 700) s.traces.push({e: step.edge, age: 0});
          }
        }
        if (s.reveal >= s.order.length){ s.phase = "path"; s.pathReveal = 0; }
      } else if (s.phase === "path"){
        s.pathReveal += dt * 0.020;
        if (s.pathReveal >= s.path.length + 1){ s.phase = "hold"; s.hold = 0; }
      } else if (s.phase === "hold"){
        s.hold += dt;
        if (s.hold > 900 + s.slot * 260) s.phase = "fade";
      } else if (s.phase === "fade"){
        if (s.pinned){ s.fade = Math.min(1, s.fade + dt * 0.0016); continue; }
        s.fade += dt * 0.0016;
        if (s.fade >= 1) this.searches[i] = this.makeSearch(s.slot);
      }

      for (let k = s.sparks.length - 1; k >= 0; k--){
        const sp = s.sparks[k];
        sp.t += dt / sp.life;
        if (sp.t >= 1) s.sparks.splice(k, 1);
      }
      for (let k = s.traces.length - 1; k >= 0; k--){
        s.traces[k].age += dt;
        if (s.traces[k].age > 1000) s.traces.splice(k, 1);
      }
    }
  }

  // A cached radial sprite per colour. shadowBlur is the most expensive call
  // in a per-node loop; a pre-rendered gradient drawn with drawImage is free.
  glowSprite(hex, dark){
    const cache = this._sprites || (this._sprites = {});
    const key = hex + (dark === false ? "-l" : "-d");
    if (cache[key]) return cache[key];
    const S = 64, cv = document.createElement("canvas");
    cv.width = S; cv.height = S;
    const c = cv.getContext("2d");
    let rgb = hexRGB(hex);
    const gr = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    if (dark === false){
      // On paper the same light has to read as ink: darken the hue and drop the
      // white core, so a source-over stamp deepens the ground instead of washing it.
      rgb = [Math.round(rgb[0] * 0.52), Math.round(rgb[1] * 0.52), Math.round(rgb[2] * 0.52)];
      gr.addColorStop(0, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",.62)");
      gr.addColorStop(0.3, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",.3)");
      gr.addColorStop(1, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0)");
    } else {
      gr.addColorStop(0, "rgba(255,255,255,.95)");
      gr.addColorStop(0.18, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",.9)");
      gr.addColorStop(0.5, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",.26)");
      gr.addColorStop(1, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0)");
    }
    c.fillStyle = gr; c.fillRect(0, 0, S, S);
    cache[key] = cv;
    return cv;
  }
  // Low-res bloom bed: everything bright is stamped here, then scaled up
  // additively over the scene.
  bloomBuffer(w, h, dark, pageCtx){
    if (dark === false) return {light:true, ctx:pageCtx, k:1};
    const q = 0.3;
    const bw = Math.max(8, Math.round(w * q)), bh = Math.max(8, Math.round(h * q));
    const b = this._bloom || (this._bloom = {cv: document.createElement("canvas")});
    if (b.cv.width !== bw || b.cv.height !== bh){ b.cv.width = bw; b.cv.height = bh; }
    b.ctx = b.cv.getContext("2d");
    b.k = q;
    b.ctx.setTransform(1, 0, 0, 1, 0, 0);
    b.ctx.clearRect(0, 0, bw, bh);
    b.ctx.globalCompositeOperation = "lighter";
    return b;
  }
  stamp(b, sprite, x, y, r, alpha){
    if (alpha <= 0.012 || r <= 0) return;
    const c = b.ctx, d = r * 2 * b.k;
    if (b.light){
      const prev = c.globalCompositeOperation, pa = c.globalAlpha;
      c.globalCompositeOperation = "source-over";
      c.globalAlpha = Math.min(1, alpha * 0.85);
      c.drawImage(sprite, x - r, y - r, r * 2, r * 2);
      c.globalCompositeOperation = prev; c.globalAlpha = pa;
      return;
    }
    c.globalAlpha = Math.min(1, alpha);
    c.drawImage(sprite, x * b.k - d / 2, y * b.k - d / 2, d, d);
  }

  drawGraph(){
    const cv = this.canvas, g = this.graph;
    if (!cv || !g || !this.searches) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const box = cv.getBoundingClientRect();
    if (!box.width || !box.height) return;
    if (cv.width !== Math.round(box.width * dpr) || cv.height !== Math.round(box.height * dpr)){
      cv.width = Math.round(box.width * dpr); cv.height = Math.round(box.height * dpr);
    }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, box.width, box.height);

    const now = this.clock || 0;
    if (!this._css || now - this._cssAt > 600){
      const cs = getComputedStyle(cv);
      const dk = cs.getPropertyValue("--ink").trim() !== "#16181c";
      this._css = {dark:dk, pathInk: dk ? "#ffffff" : "#16181c",
        matchInk: cs.getPropertyValue("--accent").trim() || "#c8f04b"};
      this._cssAt = now;
    }
    const dark = this._css.dark, pathInk = this._css.pathInk, matchInk = this._css.matchInk;

    // Adaptive quality: a rolling frame cost sheds the expensive layers before
    // the frame rate drops rather than after.
    const tStart = performance.now();
    if (this._cost === undefined) this._cost = 8;
    const heavy = this._cost < 13, mid = this._cost < 22;
    const bloom = this.bloomBuffer(box.width, box.height, dark, ctx);

    /* ---- camera: slow yaw, fixed tilt, perspective projection ----
       Everything downstream reads from the cached projection, so nodes,
       edges, sparks and rings all share one depth model. */
    const bd = g.bounds;
    const cam = this.cam || (this.cam = {yaw:0, pitch:0.42, zoom:1, vy:0, vp:0, drag:false, spin:0});
    if (!cam.drag){
      cam.yaw += cam.vy; cam.pitch += cam.vp;
      cam.vy *= 0.94; cam.vp *= 0.94;
      if (Math.abs(cam.vy) < 0.0004) cam.spin += 0.00013;   // idle drift resumes
    }
    cam.pitch = Math.max(-1.35, Math.min(1.35, cam.pitch));
    const yaw = cam.yaw + cam.spin;
    const pitch = cam.pitch;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    const FOV = 1.62, R = bd.reach || bd.radius || 1;
    const pad = 30;
    const scale = cam.zoom * Math.min((box.width - pad * 2), (box.height - pad * 2)) / (R * 2.02);
    const cx = box.width / 2, cy = box.height / 2;

    const n = g.nodes.length;
    if (!this._px || this._px.length !== n){
      this._px = new Float32Array(n); this._py = new Float32Array(n);
      this._pd = new Float32Array(n); this._pz = new Float32Array(n);
    }
    const px = this._px, py = this._py, pd = this._pd, pz = this._pz;
    for (let i = 0; i < n; i++){
      const nd = g.nodes[i];
      const x0 = nd.x, y0 = nd.y, z0 = nd.z;
      const x1 = x0 * cosY + z0 * sinY;
      const z1 = z0 * cosY - x0 * sinY;
      const y2 = y0 * cosP - z1 * sinP;
      const z2 = z1 * cosP + y0 * sinP;
      const depth = FOV * R / (FOV * R + z2);      // >1 near, <1 far
      px[i] = cx + x1 * scale * depth;
      py[i] = cy + y2 * scale * depth;
      pd[i] = depth;
      pz[i] = z2;
    }
    // fog: 0 at the back of the cloud, 1 at the front
    const fog = (i) => {
      const t = (pz[i] + R) / (2 * R);
      return 0.16 + 0.84 * Math.max(0, Math.min(1, t));
    };

    // project any point in the same camera, for the sphere's guide circles
    const project = (x0, y0, z0) => {
      const x1 = x0 * cosY + z0 * sinY;
      const z1 = z0 * cosY - x0 * sinY;
      const y2 = y0 * cosP - z1 * sinP;
      const z2 = z1 * cosP + y0 * sinP;
      const depth = FOV * R / (FOV * R + z2);
      return [cx + x1 * scale * depth, cy + y2 * scale * depth, z2];
    };
    const greatCircle = (tiltX, tiltZ, rad, alphaFront) => {
      const STEPS = 96;
      for (let k = 0; k < STEPS; k++){
        const t0 = (k / STEPS) * 6.2832, t1 = ((k + 1) / STEPS) * 6.2832;
        const p = (t) => {
          const x = Math.cos(t) * rad, y = Math.sin(t) * rad * tiltX, z = Math.sin(t) * rad * tiltZ;
          return project(x, y, z);
        };
        const A = p(t0), B = p(t1);
        const front = ((A[2] + B[2]) / 2 + R) / (2 * R);
        ctx.strokeStyle = dark
          ? "rgba(190,232,255," + (alphaFront * (0.12 + front * 0.88)).toFixed(3) + ")"
          : "rgba(20,22,28," + (alphaFront * (0.12 + front * 0.88)).toFixed(3) + ")";
        ctx.lineWidth = 0.5 + front * 0.5;
        ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      }
    };
    /* ---- volumetric cluster nebulae: each cluster's hub centroid carries a
       big additive bloom in its own hue, so the cloud reads as lit gas rather
       than flat dots. Depth drives both size and alpha. ---- */
    ctx.globalCompositeOperation = "lighter";
    for (let ci = 0; ci < CLUSTERS.length; ci++){
      const hubs = g.hubs.filter(h => g.nodes[h].cluster === ci);
      if (!hubs.length) continue;
      let sx = 0, sy = 0, sz = 0, sd = 0;
      for (const h of hubs){ sx += px[h]; sy += py[h]; sz += pz[h]; sd += pd[h]; }
      const mx = sx / hubs.length, my = sy / hubs.length;
      const depth = sd / hubs.length, front = ((sz / hubs.length) + R) / (2 * R);
      const rad = Math.max(30, R * scale * 0.22 * depth);
      const a = (dark ? 0.17 : 0.1) * (0.35 + front * 0.65);
      this.stamp(bloom, this.glowSprite(CLUSTERS[ci][1], dark), mx, my, rad, a);
    }
    ctx.globalCompositeOperation = "source-over";

    /* ---- starfield: a fixed dust shell outside the graph, projected in the
       same camera so orbiting the cloud parallaxes it. ---- */
    if (!this._dust){
      const rnd = mulberry(77712);
      const d = [];
      for (let i = 0; i < 220; i++){
        const u = rnd() * 2 - 1, th = rnd() * 6.2832, rr = R * (1.18 + rnd() * 0.55);
        const sq = Math.sqrt(1 - u * u);
        d.push([sq * Math.cos(th) * rr, u * rr, sq * Math.sin(th) * rr, 0.3 + rnd() * 0.7, rnd() * 6.28]);
      }
      this._dust = d;
    }
    ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
    const dustStep = heavy ? 1 : mid ? 2 : 3;
    let dustI = 0;
    for (const p of this._dust){
      if (dustI++ % dustStep) continue;
      const q = project(p[0], p[1], p[2]);
      const front = (q[2] + R * 1.8) / (R * 3.6);
      const tw = 0.55 + 0.45 * Math.sin(now / 900 + p[4]);
      const a = (dark ? 0.5 : 0.22) * p[3] * tw * (0.25 + front * 0.75);
      if (a <= 0.01) continue;
      ctx.fillStyle = dark ? "rgba(214,238,255," + a.toFixed(3) + ")" : "rgba(40,60,90," + a.toFixed(3) + ")";
      const rr = p[3] * (front > 0.55 ? 1.25 : 0.8);
      ctx.fillRect(q[0] - rr / 2, q[1] - rr / 2, rr, rr);
    }
    ctx.globalCompositeOperation = "source-over";

    greatCircle(0.06, 1, R * 0.40, 0.26);
    greatCircle(0.9, 0.42, R * 0.40, 0.17);
    greatCircle(0.06, 1, R * 0.95, 0.10);

    /* ---- resting field, drawn back to front in depth bands ----
       This is the most expensive layer (10.7k segments). The camera drifts a
       fraction of a degree per frame, so it renders into its own layer on
       alternate frames and is blitted on the others. */
    let edgeCtx = ctx, blitOnly = false;
    {
      const ew = Math.round(box.width * dpr), eh = Math.round(box.height * dpr);
      let L = this._edgeLayer;
      if (!L || L.cv.width !== ew || L.cv.height !== eh){
        const c2 = document.createElement("canvas");
        c2.width = ew; c2.height = eh;
        L = this._edgeLayer = {cv:c2, ctx:c2.getContext("2d"), frame:-1};
      }
      this._frameNo = (this._frameNo || 0) + 1;
      if (this._frameNo % 2 === 0 && L.frame >= 0) blitOnly = true;
      else {
        L.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        L.ctx.clearRect(0, 0, box.width, box.height);
        edgeCtx = L.ctx;
        L.frame = this._frameNo;
      }
    }
    const BANDS = 7;
    if (!this._bands){
      this._bands = [];
      for (let b = 0; b < BANDS; b++) this._bands.push(new Int32Array(g.edges.length));
      this._bandN = new Int32Array(BANDS);
    }
    const bands = this._bands, bandN = this._bandN;
    for (let b = 0; b < BANDS; b++) bandN[b] = 0;
    const W = box.width, H = box.height, MARGIN = 80;
    for (let e = 0; !blitOnly && e < g.edges.length; e++){
      const ed = g.edges[e];
      const ax = px[ed.a], ay = py[ed.a], bx = px[ed.b], by = py[ed.b];
      // cheap screen-space cull: skip anything wholly outside the viewport
      if ((ax < -MARGIN && bx < -MARGIN) || (ax > W + MARGIN && bx > W + MARGIN)
       || (ay < -MARGIN && by < -MARGIN) || (ay > H + MARGIN && by > H + MARGIN)) continue;
      const t = ((pz[ed.a] + pz[ed.b]) / 2 + R) / (2 * R);
      const bi = Math.max(0, Math.min(BANDS - 1, Math.floor(t * BANDS)));
      bands[bi][bandN[bi]++] = e;
    }
    for (let b = 0; b < BANDS; b++){
      const t = (b + 0.5) / BANDS;
      const c = CLUSTERS[b % CLUSTERS.length][1];
      const cc = hexRGB(c);
      // a faint cluster-hue wash mixed into the resting field, instead of flat grey
      const mixT = 0.26 + t * 0.16;
      const rr = Math.round(cc[0] * mixT + (dark ? 150 : 20) * (1 - mixT));
      const gg = Math.round(cc[1] * mixT + (dark ? 164 : 22) * (1 - mixT));
      const bb = Math.round(cc[2] * mixT + (dark ? 176 : 28) * (1 - mixT));
      if (blitOnly) break;
      edgeCtx.strokeStyle = "rgba(" + rr + "," + gg + "," + bb + "," + (dark ? (0.045 + t * 0.17) : (0.03 + t * 0.14)).toFixed(3) + ")";
      edgeCtx.lineWidth = 0.3 + t * 0.5;
      const arr = bands[b], cnt = bandN[b];
      if (!cnt) continue;
      edgeCtx.beginPath();
      for (let k = 0; k < cnt; k++){
        const ed = g.edges[arr[k]];
        edgeCtx.moveTo(px[ed.a], py[ed.a]); edgeCtx.lineTo(px[ed.b], py[ed.b]);
      }
      edgeCtx.stroke();
    }
    if (this._edgeLayer){
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this._edgeLayer.cv, 0, 0);
      ctx.restore();
    }

    // node order: far first, so near nodes occlude
    // Bucketed depth order: O(n) per frame instead of an n log n sort.
    const OB = 24;
    if (!this._buckets){
      this._buckets = [];
      for (let b = 0; b < OB; b++) this._buckets.push([]);
      this._order = new Array(n);
    }
    const bk = this._buckets;
    for (let b = 0; b < OB; b++) bk[b].length = 0;
    for (let i = 0; i < n; i++){
      const t = (pz[i] + R) / (2 * R);
      bk[Math.max(0, Math.min(OB - 1, OB - 1 - Math.floor(t * OB)))].push(i);
    }
    const order = this._order;
    let oi = 0;
    for (let b = 0; b < OB; b++){ const arr = bk[b]; for (let k = 0; k < arr.length; k++) order[oi++] = arr[k]; }
    if (order.length !== oi) order.length = oi;

    /* Nodes are filled in batches rather than one draw call each: within a depth
       bucket the fog value barely varies, so every node of a cluster can share
       one colour and one path. ~5,400 style changes per frame become ~200. */
    if (!this._colCache) this._colCache = {};
    const colCache = this._colCache;
    const nodeColour = (cluster, fwQ) => {
      const key = cluster + "|" + fwQ + "|" + (dark ? 1 : 0);
      let v = colCache[key];
      if (v) return v;
      const fw = fwQ / 16;
      if (cluster < 0){
        v = dark ? "rgba(198,233,255," + (fw * 0.74).toFixed(3) + ")"
                 : "rgba(24,48,90," + (fw * 0.56).toFixed(3) + ")";
      } else {
        const c = hexRGB(CLUSTERS[cluster][1]);
        const mix = Math.max(0, (fw - 0.62) / 0.38);
        v = dark
          ? "rgba(" + Math.round(c[0] + (255 - c[0]) * mix * 0.55) + ","
            + Math.round(c[1] + (255 - c[1]) * mix * 0.55) + ","
            + Math.round(c[2] + (255 - c[2]) * mix * 0.55) + "," + (fw * 0.78).toFixed(3) + ")"
          : "rgba(" + Math.round(c[0] * 0.7) + "," + Math.round(c[1] * 0.7) + ","
            + Math.round(c[2] * 0.7) + "," + (fw * 0.6).toFixed(3) + ")";
      }
      colCache[key] = v;
      return v;
    };
    const zoomK = 0.72 + cam.zoom * 0.28;
    const speculars = [];
    if (!this._batch) this._batch = new Map();
    const batch = this._batch;
    for (let b = 0; b < OB; b++){
      const arr = bk[b];
      if (!arr.length) continue;
      batch.clear();
      for (let k = 0; k < arr.length; k++){
        const i = arr[k];
        const nd = g.nodes[i];
        if (nd.kind === "hub" || nd.kind === "sub") continue;
        const x = px[i], y = py[i];
        if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
        const fw = fog(i);
        if (fw < 0.02) continue;
        const key = (nd.kind === "core" ? -1 : nd.cluster) * 32 + Math.round(fw * 16);
        let list = batch.get(key);
        if (!list){ list = []; batch.set(key, list); }
        list.push(i);
        if (fw > 0.92 && nd.r > 3) speculars.push(i);
      }
      batch.forEach((list, key) => {
        const fwQ = ((key % 32) + 32) % 32;
        const cluster = Math.round((key - fwQ) / 32);
        ctx.fillStyle = nodeColour(cluster, fwQ);
        ctx.beginPath();
        for (let k = 0; k < list.length; k++){
          const i = list[k];
          const r = Math.max(0.3, g.nodes[i].r * 0.56 * Math.pow(pd[i], 1.55) * zoomK);
          if (r < 1.1) ctx.rect(px[i] - r, py[i] - r, r * 2, r * 2);
          else { ctx.moveTo(px[i] + r, py[i]); ctx.arc(px[i], py[i], r, 0, 6.2832); }
        }
        ctx.fill();
      });
    }
    // the nearest nodes catch a specular cap, drawn once as a group
    if (speculars.length){
      ctx.fillStyle = dark ? "rgba(255,255,255,.26)" : "rgba(255,255,255,.7)";
      ctx.beginPath();
      for (const i of speculars){
        const r = Math.max(0.3, g.nodes[i].r * 0.56 * Math.pow(pd[i], 1.55) * zoomK);
        ctx.moveTo(px[i] - r * 0.28 + r * 0.42, py[i] - r * 0.3);
        ctx.arc(px[i] - r * 0.28, py[i] - r * 0.3, r * 0.42, 0, 6.2832);
      }
      ctx.fill();
    }

    ctx.lineCap = "round";
    for (const s of this.searches){
      if (s.delay > 0) continue;
      const alive = 1 - s.fade;

      for (const tr of s.traces){
        const e = g.edges[tr.e];
        const fw = (fog(e.a) + fog(e.b)) / 2;
        ctx.globalAlpha = alive * fw * Math.max(0, 0.20 * (1 - tr.age / 1500));
        ctx.strokeStyle = s.hue; ctx.lineWidth = 0.5 + fw * 0.5;
        ctx.beginPath(); ctx.moveTo(px[e.a], py[e.a]); ctx.lineTo(px[e.b], py[e.b]); ctx.stroke();
      }

      ctx.shadowColor = s.hue;
      for (const sp of s.sparks){
        const e = g.edges[sp.e];
        const fw = (fog(e.a) + fog(e.b)) / 2;
        const dep = (pd[e.a] + pd[e.b]) / 2;
        const ease = sp.t < 0.5 ? 2 * sp.t * sp.t : 1 - Math.pow(-2 * sp.t + 2, 2) / 2;
        const tail = Math.max(0, ease - 0.46);
        const ax = px[e.a], ay = py[e.a], bx = px[e.b], by = py[e.b];
        const hx = ax + (bx - ax) * ease, hy = ay + (by - ay) * ease;
        const tx = ax + (bx - ax) * tail, ty = ay + (by - ay) * tail;
        const fadeIn = Math.min(1, sp.t * 6), fadeOut = 1 - Math.max(0, (sp.t - 0.7) / 0.3);
        const vis = alive * Math.min(fadeIn, fadeOut) * fw;
        ctx.globalAlpha = vis * 0.95;
        ctx.strokeStyle = s.hue; ctx.lineWidth = (0.9 + fw * 1.1) * dep; ctx.shadowBlur = 9 * dep;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.globalAlpha = vis;
        ctx.fillStyle = dark ? "#ffffff" : s.hue; ctx.shadowBlur = 12 * dep;
        ctx.beginPath(); ctx.arc(hx, hy, 1.4 * dep, 0, 6.2832); ctx.fill();
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;

      if (s.phase !== "sweep"){
        const lit = Math.min(s.path.length, Math.floor(s.pathReveal));
        for (let i = 1; i < lit; i++){
          const a = s.path[i - 1], b = s.path[i];
          const fw = (fog(a) + fog(b)) / 2, dep = (pd[a] + pd[b]) / 2;
          ctx.strokeStyle = pathInk;
          ctx.globalAlpha = alive * fw * (dark ? 0.9 : 1);
          ctx.lineWidth = (dark ? 1.5 : 2.0) * dep;
          ctx.shadowColor = s.hue; ctx.shadowBlur = 11 * dep;
          ctx.beginPath(); ctx.moveTo(px[a], py[a]); ctx.lineTo(px[b], py[b]); ctx.stroke();
        }
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        if (lit > 0 && lit < s.path.length){
          const h = s.path[lit - 1];
          ctx.fillStyle = pathInk; ctx.shadowColor = s.hue; ctx.shadowBlur = 16;
          ctx.globalAlpha = alive * fog(h);
          ctx.beginPath(); ctx.arc(px[h], py[h], 2.6 * pd[h], 0, 6.2832); ctx.fill();
          ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        }
      }

      const ring = (idx, col, r) => {
        ctx.globalAlpha = alive * 0.9 * fog(idx);
        ctx.strokeStyle = col; ctx.lineWidth = 1.2 * pd[idx];
        ctx.shadowColor = col; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(px[idx], py[idx], r * pd[idx], 0, 6.2832); ctx.stroke();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      };
      ring(s.source, s.hue, 7 + Math.sin((this.clock + s.slot * 400) / 240) * 1.5);
      if (s.phase !== "sweep") ring(s.target, matchInk, 8.5);
    }

    /* ---- scan plane: a slow sweep through the volume that ignites what it
       passes, so the cloud reads as something being read ---- */
    const scanZ = Math.sin(now / 5200) * R * 0.95;

    /* ---- hubs and sub-hubs as lit spheres, far to near ---- */
    for (const i of order){
      const nd = g.nodes[i];
      if (nd.kind === "leaf" || nd.kind === "core") continue;
      const col = CLUSTERS[nd.cluster][1];
      const fw = fog(i), dep = pd[i];
      const r = Math.max(0.85, nd.r * (nd.kind === "hub" ? 0.42 : 0.37) * Math.pow(dep, 1.4));
      if (nd.kind === "hub"){
        // Only the nearest hubs carry any halo at all, and it is a soft
        // brightening of the surrounding field rather than a lamp.
        if (fw > 0.82) this.stamp(bloom, this.glowSprite(col, dark), px[i], py[i], r * 2.4, (fw - 0.82) * 0.28);
        const flash = Math.max(0, 1 - Math.abs(pz[i] - scanZ) / (R * 0.08));
        if (flash > 0.02) this.stamp(bloom, this.glowSprite(col, dark), px[i], py[i], r * 3.2, flash * 0.1);
        ctx.globalAlpha = 0.45 + fw * 0.45;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(px[i], py[i], r, 0, 6.2832); ctx.fill();
        if (fw > 0.86){
          ctx.globalAlpha = (fw - 0.86) * 2;
          ctx.fillStyle = "rgba(255,255,255,.4)";
          ctx.beginPath(); ctx.arc(px[i] - r * 0.26, py[i] - r * 0.28, r * 0.38, 0, 6.2832); ctx.fill();
        }
      } else {
        ctx.globalAlpha = fw * 0.5;
        ctx.fillStyle = dark ? "rgba(226,242,255,.36)" : "rgba(20,22,28,.3)";
        ctx.beginPath(); ctx.arc(px[i], py[i], r, 0, 6.2832); ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    /* ---- leader-line labels on the front hub of each cluster ---- */
    ctx.globalCompositeOperation = "source-over";
    ctx.font = "500 10px 'IBM Plex Mono', ui-monospace, monospace";
    ctx.textBaseline = "middle";
    for (let ci = 0; ci < CLUSTERS.length; ci++){
      const hubs = g.hubs.filter(h => g.nodes[h].cluster === ci);
      if (!hubs.length) continue;
      let i = hubs[0];
      for (const h of hubs) if (pz[h] > pz[i]) i = h;
      const f = fog(i);
      if (f < 0.66) continue;
      const col = CLUSTERS[ci][1], a = Math.min(1, (f - 0.66) / 0.26);
      const right = px[i] < cx;
      const lx = px[i] + (right ? 15 : -15), ly = py[i] - 13;
      ctx.globalAlpha = a * 0.45;
      ctx.strokeStyle = col; ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(px[i], py[i]); ctx.lineTo(lx, ly); ctx.lineTo(lx + (right ? 24 : -24), ly);
      ctx.stroke();
      ctx.globalAlpha = a * 0.92;
      ctx.textAlign = right ? "left" : "right";
      ctx.fillStyle = dark ? "rgba(238,247,255,.94)" : "rgba(20,22,28,.92)";
      ctx.fillText(CLUSTERS[ci][0].toUpperCase(), lx + (right ? 29 : -29), ly);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";

    // the bloom bed, scaled back over the scene (dark themes only — on paper the
    // stamps already landed source-over)
    if (!bloom.light){
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.34;
      ctx.drawImage(bloom.cv, 0, 0, box.width, box.height);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
    this._cost = this._cost * 0.88 + (performance.now() - tStart) * 0.12;

    // vignette: pulls the eye to the centre of the cloud the way a long lens would
    const vig = ctx.createRadialGradient(cx, cy, Math.min(box.width, box.height) * 0.28,
                                         cx, cy, Math.max(box.width, box.height) * 0.78);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, dark ? "rgba(0,0,0,.5)" : "rgba(24,28,34,.16)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, box.width, box.height);
  }

  /* Orbit and zoom. Pointer state lives on the instance, not in React state,
     so dragging never triggers a re-render. */
  bindGraphInput(cv){
    if (cv._pulseBound) return;
    cv._pulseBound = true;
    const cam = this.cam || (this.cam = {yaw:0, pitch:0.42, zoom:1, vy:0, vp:0, drag:false, spin:0});
    let lx = 0, ly = 0, id = null;
    cv.style.cursor = "grab";
    cv.style.touchAction = "none";
    cv.addEventListener("pointerdown", (e) => {
      id = e.pointerId; cam.drag = true; lx = e.clientX; ly = e.clientY;
      cam.vy = 0; cam.vp = 0;
      cv.style.cursor = "grabbing";
      try { cv.setPointerCapture(id); } catch (err) {}
    });
    cv.addEventListener("pointermove", (e) => {
      if (!cam.drag || e.pointerId !== id) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      cam.yaw += dx * 0.006;
      cam.pitch += dy * 0.006;
      cam.vy = dx * 0.0016; cam.vp = dy * 0.0016;
    });
    const release = (e) => {
      if (id !== null && e && e.pointerId !== id) return;
      cam.drag = false; id = null; cv.style.cursor = "grab";
    };
    cv.addEventListener("pointerup", release);
    cv.addEventListener("pointercancel", release);
    cv.addEventListener("wheel", (e) => {
      e.preventDefault();
      const k = Math.pow(0.9988, e.deltaY);
      cam.zoom = Math.max(0.45, Math.min(6, cam.zoom * k));
    }, {passive:false});
    cv.addEventListener("dblclick", () => {
      cam.yaw = 0; cam.pitch = 0.42; cam.zoom = 1; cam.vy = 0; cam.vp = 0; cam.spin = 0;
    });
  }

  refreshStats(){
    if (!this.searches) return;
    const now = Math.floor((this.clock || 0) / 1000);
    if (now === this._lastStat) return;
    this._lastStat = now;
    try { this.setState({gTick: now}); } catch (e) {}
  }

  // Split-flap board. Each tile keeps the character it last showed, so a change
  // (the minute rolling over, or the boot scramble settling) drops the old
  // character down and swings the new one up. Results are cached per stamp so
  // repeat renders inside one tick don't cancel a flip mid-air.
  buildFlipUnits(BODY, INK, LIME){
    // Demo clock, so the board agrees with the "due today" and "2 d ago" labels.
    const snap = store.get();
    const now = new Date(nowFor(snap.core, snap.session));
    const DAY = ["SUN","MON","TUE","WED","THU","FRI","SAT"][now.getDay()];
    const MON = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][now.getMonth()];
    const target = (DAY + String(now.getDate()).padStart(2,"0") + MON
      + String(now.getHours()).padStart(2,"0") + String(now.getMinutes()).padStart(2,"0")).split("");
    if (!this._flapMount) this._flapMount = Date.now();
    const el = Date.now() - this._flapMount;
    const settleAt = i => 200 + i * 75 + 200;
    const scrambling = el < settleAt(target.length - 1);
    const stamp = scrambling ? "s" + Math.floor(el / 75) : target.join("");
    if (this._flapStamp === stamp && this._flapCache) return this._flapCache;
    this._flapStamp = stamp;
    const NUM = "0123456789", ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const prev = this._flapPrev || (this._flapPrev = []);
    const seq = this._flapSeq || (this._flapSeq = []);
    const faces = target.map((c, i) => {
      if (scrambling && el < settleAt(i)) {
        const pool = /[0-9]/.test(c) ? NUM : ALPHA;
        return pool[Math.floor(Math.random() * pool.length)];
      }
      return c;
    }).map((v, i) => {
      const p = prev[i];
      const changed = p !== undefined && p !== v;
      if (changed) seq[i] = (seq[i] || 0) + 1;
      prev[i] = v;
      const k = (seq[i] || 0) % 2 ? "B" : "A";
      return {isTile:true, isColon:false, v, prev: changed ? p : v,
        flapShow: changed ? "block" : "none",
        topAnim: changed ? "flapDown" + k + " .16s cubic-bezier(.5,.05,.9,.4) both" : "none",
        botAnim: changed ? "flapUp" + k + " .24s cubic-bezier(.2,.85,.3,1) .16s both" : "none"};
    });
    const base = {w:"21px", h:"30px", size:"13px", cornerW:"17px", cornerSize:"11px", color:BODY};
    const big = {w:"22px", h:"31px", size:"14px", cornerW:"18px", cornerSize:"12px", color:INK};
    const time = {w:"22px", h:"31px", size:"14px", cornerW:"18px", cornerSize:"12px", color:LIME};
    const mk = (i, opts) => Object.assign({}, base, faces[i], opts || {});
    const out = [
      {tiles:[mk(0), mk(1), mk(2)]},
      {tiles:[mk(3, big), mk(4, big)]},
      {tiles:[mk(5), mk(6), mk(7)]},
      {tiles:[mk(8, time), mk(9, time), {isTile:false, isColon:true}, mk(10, time), mk(11, time)]}
    ];
    this._flapCache = out;
    return out;
  }

  /* The brief is a two-question interview: you say the job, it asks what to
     cover and when it should land, then turns the answers into tasks. */
  sendBrief(){
    const text = (this.state.briefDraft || "").trim();
    if (!text) return;
    this.setState(prev => {
      const thread = (prev.briefThread || []).slice();
      const asked = thread.filter(m => m.kind === "card").length;
      if (!thread.length) thread.push({kind:"msg", role:"agent", text:"Good to meet you. What is the main thing you want help with?"});
      thread.push({kind:"msg", role:"you", text});
      if (asked < BRIEF_QUESTIONS.length){
        thread.push({kind:"msg", role:"agent",
          text: asked === 0
            ? "Noted: \u201c" + text + "\u201d. First, what should it cover?"
            : "Noted. One more: when should it land?"});
        thread.push({kind:"card", q:asked, done:false});
      } else {
        thread.push({kind:"msg", role:"agent", text:"Added. Prepare the sample setup to draft an instruction from this brief."});
      }
      return {briefThread:thread, briefDraft:""};
    });
  }
  pickBrief(qi, label){
    this.setState(prev => {
      const picks = Object.assign({}, prev.briefPicks || {});
      const list = (picks[qi] || []).slice();
      const at = list.indexOf(label);
      if (at > -1) list.splice(at, 1); else list.push(label);
      picks[qi] = list;
      return {briefPicks:picks};
    });
  }
  confirmBrief(qi){
    this.setState(prev => {
      const picks = (prev.briefPicks || {})[qi] || [];
      const thread = prev.briefThread.map(m => m.kind === "card" && m.q === qi ? Object.assign({}, m, {done:true}) : m);
      const spec = Object.assign({}, prev.agentSpec);
      const tasks = (spec.tasks || []).slice();
      if (qi === 0 && picks.length) tasks.push({title:"Daily briefing", meta:"Covers " + picks.join(", ").toLowerCase()});
      if (qi === 1 && picks.length){
        if (tasks.length) tasks[tasks.length - 1] = Object.assign({}, tasks[tasks.length - 1], {meta: tasks[tasks.length - 1].meta + " · " + picks[0].toLowerCase()});
        else tasks.push({title:"Scheduled run", meta:picks[0].toLowerCase()});
      }
      spec.tasks = tasks;
      if (qi + 1 < BRIEF_QUESTIONS.length){
        thread.push({kind:"msg", role:"agent", text:"Got it. When should it land?"});
        thread.push({kind:"card", q:qi + 1, done:false});
      } else {
        thread.push({kind:"msg", role:"agent", text:"That is enough to start. Prepare the sample setup to draft an instruction from this brief."});
      }
      return {briefThread:thread, agentSpec:spec};
    });
  }
  /* Tuning by prompt: the change is described in words and lands on the pinned
     prompt, so the agent's behaviour and its prompt never drift apart. */
  /* KPI figures count in from zero whenever the filter changes, so a switch
     between aspects reads as the numbers moving rather than swapping. */
  countValue(raw, i){
    const t = this.state.kpiT;
    if (t === undefined || t >= 1) return raw;
    const m = String(raw).match(/^([^0-9-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/);
    if (!m) return raw;
    const dec = (m[2].split(".")[1] || "").length;
    const target = parseFloat(m[2].replace(/,/g, ""));
    const e = 1 - Math.pow(1 - Math.min(1, t + i * 0.04), 3);
    const now = (target * e).toFixed(dec);
    const [whole, frac] = now.split(".");
    return m[1] + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac ? "." + frac : "") + m[3];
  }
  goPage(page, extra){
    this.setState(Object.assign({page}, extra || {}));
    if (page === "Dashboard") this.startKpiCount();
  }
  /* A timer, not rAF: background/hidden frames throttle rAF to nothing and the
     count would freeze part-way through. */
  /* Shared by the picker, drag-and-drop and paste — the file dialog can be
     blocked in an embedded frame, so there is always another way in. */
  readBgFile(f){
    if (!f || !/^image\//.test(f.type || "")) return;
    const fr = new FileReader();
    fr.onload = () => this.setState(p => {
      const list = (p.bgUploads || []).concat([fr.result]);
      return {bgUploads:list, bgCat:"Your photos", bgGalleryOpen:true,
        homeBg:"up" + (list.length - 1),
        homeBgCss:"background:url(" + fr.result + ") center/cover"};
    });
    fr.readAsDataURL(f);
  }
  startKpiCount(){
    clearInterval(this._kpiTimer);
    const t0 = Date.now();
    this.setState({kpiT:0});
    this._kpiTimer = setInterval(() => {
      const t = Math.min(1, (Date.now() - t0) / 900);
      this.setState({kpiT:t});
      if (t >= 1) clearInterval(this._kpiTimer);
    }, 40);
  }
  systemPrompt(st){
    const s = st || this.state;
    if (s.sysPrompt !== undefined && s.sysPrompt !== null) return s.sysPrompt;
    return "You are " + (s.agentSpec.name || "this agent") + " inside Pulse.\n"
      + "Voice: " + s.agentSpec.personality.toLowerCase() + ". " + s.agentSpec.answer.toLowerCase() + ".\n"
      + "You read the whole ontology through registered tools only, filtered by the grants of whoever is asking.\n"
      + "Use this organisation's configured terminology and only the records the asker may see.\n"
      + "Never act on anything with an effect. Propose it and wait for a yes.";
  }
  sendTune(){
    const text = (this.state.tuneDraft || "").trim();
    if (!text) return;
    this.setState(prev => ({
      tuneDraft:"",
      tuneThread: (prev.tuneThread || []).concat([
        {role:"you", text},
        {role:"agent", text:"Added to the draft instruction below. It is a sample: no AI model is connected."}
      ]),
      sysPrompt: this.systemPrompt(prev) + "\n" + text
    }));
  }

  startTraining(){
    clearInterval(this._trainTimer);
    this.setState({training:true, trained:false, trainPhase:0});
    this._trainTimer = setInterval(() => {
      this.setState(prev => {
        const next = (prev.trainPhase || 0) + 1;
        if (next >= TRAIN_PHASES.length){
          clearInterval(this._trainTimer);
          return {trainPhase:TRAIN_PHASES.length, training:false, trained:true};
        }
        return {trainPhase:next};
      });
    }, 1150);
  }

  openPalette(){
    this._palOpenedAt = Date.now();
    this.setState({paletteOpen:true, showNotifs:false, query:"", palSel:0, palScope:"All"});
  }

  /* Default dashboard for the viewer's highest role (Settings > Experience). */
  defaultDashboard(){
    const snap = store.get();
    const roles = snap.q.viewer.roles.map(r => r.roleId);
    const top = roles.indexOf("admin") > -1 ? "admin" : roles.indexOf("team_manager") > -1 ? "team_manager" : "contributor";
    const id = (snap.core.config.roleLayouts[top] || {}).dashboardId;
    // Only views still shown (a view whose module is off is hidden).
    const list = sectionsFor(snap.core, "Dashboard").filter(d => d.id !== "reports");
    return list.some(d => d.id === id) ? id : (list[0] ? list[0].id : "reports");
  }

  /* Pages built on the core ask for navigation through here (see src/core/nav.ts). */
  navTo(t){
    let page = t.page, section = t.section;
    // Work > People moved to its own module; keep the old link working.
    if (page === "Work" && section === "people"){ page = "People"; section = "directory"; }
    if (!pageDef(page)) page = "Home";
    // A disabled or unpermitted module never opens from an old link; land on Home instead.
    { const snap = store.get(); if (page !== "Settings" && !visiblePages(snap.core, snap.session.viewerId).some(p => p.id === page)) { page = "Home"; section = undefined; } }
    const extra = {page, open:null, showNotifs:false, paletteOpen:false, miniOpen:false};
    if (page === "Settings"){ if (section){ extra.adminOpen = section; extra.adminGroup = null; } }
    else if (section) this.assignSection(extra, page, section);
    this.setState(extra);
    if (page === "Dashboard") this.startKpiCount();
  }
  /* Put a section into the state patch for a page, mapping legacy ids. */
  assignSection(patch, page, id){
    const legacy = (LEGACY_SECTION[page] || {})[id];
    const sec = legacy || id;
    const key = SECTION_KEY[page];
    if (key) patch[key] = sec;
    else patch.modSections = Object.assign({}, this.state.modSections, patch.modSections || {}, {[page]: sec});
  }
  /* The section showing on a page: saved choice if still valid, else the default. */
  sectionOf(page){
    const core = store.get().core;
    const list = sectionsFor(core, page);
    if (!list.length) return "";
    const key = SECTION_KEY[page];
    let cur = key ? this.state[key] : (this.state.modSections || {})[page];
    if (cur) cur = (LEGACY_SECTION[page] || {})[cur] || cur;
    if (page === "Dashboard" && !list.some(x => x.id === cur)) return this.defaultDashboard();
    if (page === "Home" && !cur){
      const snap = store.get();
      const top = (snap.q.viewer.roles[0] || {}).roleId;
      const pref = (() => { try { return localStorage.getItem("pulse.homeMode"); } catch (e) { return null; } })();
      cur = pref || ((snap.core.config.roleLayouts[top] || {}).homeMode) || "chat";
    }
    return list.some(x => x.id === cur) ? cur : defaultSectionFor(core, page);
  }
  /* Tabs tighten their padding when space is short for how many there are. */
  tabsTight(st, n){
    const avail = st.w - (st.railOpen ? 252 : 68);
    return (avail < 1000 && n >= 4) || (avail < 1400 && n >= 5);
  }
  /* Small counts on page tabs. Only where a number helps someone act. */
  sectionCounts(page, q){
    if (page === "Work"){
      const wc = workCounts(q);
      return {mine: wc.mine, approvals: wc.approvals, workflows: wc.workflows || undefined};
    }
    if (page === "Activity") return {attention: attention(q).length};
    return {};
  }
  setSection(page, id){
    const patch = {};
    this.assignSection(patch, page, id);
    if (page === "Home"){ try { localStorage.setItem("pulse.homeMode", id); } catch (e) {} }
    if (page === "Work") patch.opsOpen = null;
    this.setState(patch);
    if (page === "Dashboard") this.startKpiCount();
  }

  /* Direct links: #/Page/section. Read once on load, written on every page or section change. */
  readHash(){
    try {
      const m = (window.location.hash || "").match(/^#\/([A-Za-z]+)(?:\/([\w-]+))?/);
      if (m && pageDef(m[1])) this.navTo({page:m[1], section:m[2]});
    } catch (e) {}
  }
  componentDidMount(){
    this._unsubCore = store.subscribe(() => this.forceUpdate());
    this._unsubPins = subscribePins(() => this.forceUpdate());
    this.readHash();
    this._onHash = () => this.readHash();
    window.addEventListener("hashchange", this._onHash);
    // Desktop shows page tabs by default; a person can switch to the page menu.
    try { if (localStorage.getItem("pulse.pagesAsTabs") === "0") this.setState({pagesAsTabs:false}); } catch (e) {}
    registerNavigator((t) => this.navTo(t));
    requestAnimationFrame(() => this.syncRailThumb());
    setTimeout(() => this.syncRailThumb(), 700);
    setTimeout(() => { const nav = document.querySelector('nav[data-rail-nav]');
      if (nav && window.ResizeObserver){ this._railRO = new ResizeObserver(() => this.syncRailThumb()); this._railRO.observe(nav); } }, 50);
    if (this.state.page === "Dashboard") this.startKpiCount();
    this._clockTimer = setInterval(() => { if (this.state.page === "Home") this.forceUpdate(); }, 1000);
    this._flapBoot = setInterval(() => this.forceUpdate(), 70);
    setTimeout(() => clearInterval(this._flapBoot), 1500);
    // One frame driver, fed by rAF where it runs and by a timer where it does not
    // Warm the graph up in idle time: by the time the Ontology tab is opened the
    // nodes, edges and adjacency already exist, so the first frame paints.
    const warm = () => { if (!this.graph){ this.graph = buildGraph(); this.planSearch(); } };
    if (typeof requestIdleCallback === "function") requestIdleCallback(warm, {timeout:2500});
    else this._warmTimer = setTimeout(warm, 1200);

    // (throttled or hidden frames), so the graph is never left unpainted.
    let last = performance.now();
    this._frame = () => this.graphFrame();
    const loop = () => {
      const onGraph = this.state.page === "Records" && this.sectionOf("Records") === "relationships";
      if (onGraph){ this._raf = requestAnimationFrame(loop); this._frame(); }
      else { this._raf = null; this.canvas = null; }
    };
    this._startLoop = (force) => {
      if (force) { cancelAnimationFrame(this._raf); this._raf = null; }
      if (!this._raf) this._raf = requestAnimationFrame(loop);
    };
    // A watchdog, not just a poll: a stale _raf handle from a previous mount
    // used to leave the loop permanently unscheduled, so restart when the
    // ontology is open and no frame has landed for a while.
    this._fallback = setInterval(() => {
      if (this.state.page !== "Records" || this.sectionOf("Records") !== "relationships") return;
      const stale = !this._beat || performance.now() - this._beat > 600;
      this._startLoop(stale);
    }, 250);
    this._startLoop(true);
    /* Narrow screens start with the rail collapsed to icons, so content keeps the width. */
    this._resize = () => {
      const w = window.innerWidth;
      this.setState(prev => (w < 760 && prev.w >= 760 ? {w, railOpen:false} : {w}));
    };
    if (window.innerWidth < 760) this.setState({railOpen:false});
    window.addEventListener("resize", this._resize);
    this._key = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"){
        e.preventDefault();
        if (this.state.paletteOpen) this.setState({paletteOpen:false, query:"", palSel:0}); else this.openPalette();
      }
      if (e.key === "Escape") this.setState({paletteOpen:false, showNotifs:false});
    };
    window.addEventListener("keydown", this._key);
    this._paste = (e) => {
      if (!this.state.bgGalleryOpen) return;
      const items = (e.clipboardData && e.clipboardData.items) || [];
      for (let i = 0; i < items.length; i++){
        if (items[i].type && items[i].type.indexOf("image") === 0){ this.readBgFile(items[i].getAsFile()); break; }
      }
    };
    window.addEventListener("paste", this._paste);
  }
  componentWillUnmount(){ if (this._unsubCore) this._unsubCore(); if (this._unsubPins) this._unsubPins(); window.removeEventListener("hashchange", this._onHash); window.removeEventListener("paste", this._paste); window.removeEventListener("resize", this._resize); window.removeEventListener("keydown", this._key); clearInterval(this._t); clearInterval(this._clockTimer); clearInterval(this._flapBoot); cancelAnimationFrame(this._raf); clearInterval(this._fallback); clearInterval(this._kpiTimer); }

  /* Answers come from the core: built from the records the viewer can see and
     labelled as sample responses, because no AI model is connected. */
  ask(q){
    const snap = store.get();
    const a = answer(snap.core, snap.ctx, q);
    const words = a.text.split(" ").length;
    const thread = this.state.thread.concat([
      {role:"user", text:q},
      {role:"helios", full:a.text + " " + a.limitations.join(" "), words, tool:"SAMPLE ANSWER · " + a.scope.toUpperCase() + " · " + a.period.toUpperCase(), effect:"read only",
        cols:a.cols, rows:a.rows, citations:a.citations}
    ]);
    this.setState({thread, draft:"", query:"", paletteOpen:false, page:"Home", open:null});
  }

  hover(key, label, hint, e){
    const r = e && e.currentTarget ? e.currentTarget.getBoundingClientRect() : null;
    this.setState(prev => ({hovered:key, hoverLabel:label, hoverHint:hint,
      hoverTop: r ? Math.round(r.top + r.height / 2) : prev.hoverTop}));
  }
  unhover(key){ this.setState(prev => (prev.hovered === key ? {hovered:null} : null)); }

  syncRailThumb(){
    const nav = document.querySelector('nav[data-rail-nav]');
    const btn = nav && nav.querySelector('[data-rail="active"]');
    const prev = this.state.railThumb;
    if (!btn){ if (prev) this.setState({railThumb:null}); return; }
    const n = nav.getBoundingClientRect(), b = btn.getBoundingClientRect();
    const next = {t: Math.round(b.top - n.top + nav.scrollTop), l: Math.round(b.left - n.left), w: Math.round(b.width), h: Math.round(b.height)};
    if (!prev || prev.t !== next.t || prev.l !== next.l || prev.w !== next.w || prev.h !== next.h){
      this.setState({railThumb: next});
      if (!this._railLive){ this._railLive = true; setTimeout(() => this.setState({railThumbLive:true}), 60); }
    }
  }
  componentDidUpdate(){
    this.syncRailThumb();
    // A new page or section starts at the top, not where the previous one was scrolled.
    const st = this.state;
    const key = [st.page, st.workSection, st.recSection, st.actKpi, st.dashArea, st.adminOpen, st.homeMode, st.agentsSection, JSON.stringify(st.modSections)].join("|");
    if (this._viewKey !== key){
      this._viewKey = key;
      try {
        const sec = st.page === "Settings" ? (st.adminOpen || "") : this.sectionOf(st.page);
        const h = "#/" + st.page + (sec ? "/" + sec : "");
        if (window.location.hash !== h) window.history.replaceState(null, "", h);
      } catch (e) {}
      const main = document.querySelector("[data-scroll-main]");
      if (main) main.scrollTop = 0;
    }
  }

  /* Side rail: enabled, permitted pages only, grouped. Agents stays under Home (locked). */
  navItems(){
    const snap = store.get();
    /* Business modules: only pinned ones sit in the rail (plus the one open now);
       the rest stay reachable from the module switcher. See src/ui/pins.ts. */
    const pinned = pinnedPages(snap.core, snap.session.viewerId);
    const pages = visiblePages(snap.core, snap.session.viewerId).filter(p => p.id !== "Settings"
      && (p.group !== "business" || pinned.includes(p.id) || p.id === this.state.page));
    const home = pages.find(p => p.id === "Home"), agents = pages.find(p => p.id === "Agents");
    const rest = pages.filter(p => p.id !== "Home" && p.id !== "Agents");
    const ordered = [home, agents].filter(Boolean).concat(rest);
    const out = [];
    let group = null;
    ordered.forEach((p, i) => {
      if (i > 0 && p.group !== group) out.push({divider:true, groupLabel:GROUP_LABEL[p.group]});
      group = p.group;
      out.push({label:pageLabel(snap.core.config, p.id), icon:p.icon, page:p.id, dot: p.id === "Dashboard" || p.id === "Activity"});
    });
    return out;
  }
  go(page){
    const order = this.navItems().filter(n => !n.divider).map(n => n.page).concat(["Settings"]);
    const from = order.indexOf(this.state.page), to = order.indexOf(page);
    if (from > -1 && to > -1 && from !== to) this.setState(p => ({navDir: to > from ? 1 : -1, navSeq:(p.navSeq || 0) + 1}));
    this.setState({page, open:null, showNotifs:false, filterMenuOpen:false});
    if (page === "Dashboard") this.startKpiCount();
  }
  toggleIn(key, value){
    this.setState(prev => {
      const list = prev[key].slice(), i = list.indexOf(value);
      if (i > -1) list.splice(i, 1); else list.push(value);
      return {[key]: list};
    });
  }
  setSpec(patch){ this.setState(prev => ({agentSpec: Object.assign({}, prev.agentSpec, patch)})); }
  toggleSpecList(key, value){
    this.setState(prev => {
      const list = prev.agentSpec[key].slice(), i = list.indexOf(value);
      if (i > -1) list.splice(i, 1); else list.push(value);
      return {agentSpec: Object.assign({}, prev.agentSpec, {[key]: list})};
    });
  }
  askMini(q){
    const snap = store.get();
    const ans = answer(snap.core, snap.ctx, q);
    const a = {text: ans.text + " (" + ans.limitations[0] + ")"};
    this.setState(prev => ({
      miniThread: prev.miniThread.concat([{role:"user", text:q}, {role:"helios", text:a.text}]),
      miniDraft: ""
    }));
  }
  addWorkTask(){
    this.setState(prev => {
      const title = prev.newTask.trim();
      if (!title) return {newTask:""};
      return {newTask:"", addedTasks: [{id:"n" + Date.now(), title, status:"Not started",
        priority:prev.newPriority, who:"MK", due:"No due date", late:false,
        client:"No client", day:"Any day", mins:"Mins", view:"All tasks"}].concat(prev.addedTasks)};
    });
  }
  addCustom(){
    this.setState(prev => {
      const name = prev.customFilter.trim();
      if (!name) return {customFilter:""};
      if (prev.extraFilters.indexOf(name) > -1) return {customFilter:"", aspect:name, filterMenuOpen:false};
      return {extraFilters: prev.extraFilters.concat([name]), customFilter:"", aspect:name, filterMenuOpen:false};
    });
  }
  sendToAgent(q){
    const id = this.state.agentId;
    this.setState(prev => {
      const extra = (prev.agentExtra[id] || []).concat([
        {kind:"user", text:q},
        {kind:"agent", text:"Sample response: no AI model is connected in this build, so this agent cannot act on that. Its permitted actions and approval rules are listed in Settings, Agent controls."}
      ]);
      return {agentExtra: Object.assign({}, prev.agentExtra, {[id]: extra}), agentDraft:""};
    });
  }

  /* One graph frame. Safe to call from anywhere: it no-ops unless the ontology
     is on screen, and it builds the graph on first need. */
  graphFrame(){
    if (document.hidden) return;
    const t = performance.now();
    const dt = Math.min(48, t - (this._lastFrame || t - 16));
    if (dt < 8) return;
    this._lastFrame = t;
    // The canvas mounts and unmounts with the tab, and a ref on a plain element
    // is not wired by the template compiler, so resolve it from the DOM. Its
    // presence — not component state — is what says the ontology is on screen.
    if (!this.canvas || !this.canvas.isConnected){
      this.canvas = document.querySelector("canvas[data-onto-graph]");
    }
    if (!this.canvas || !this.canvas.isConnected){ this.canvas = null; return; }
    if (!this.graph) this.graph = buildGraph();
    if (!this.searches){
      try { this.planSearch(); } catch (e) { this.searches = []; }
    }
    this.bindGraphInput(this.canvas);
    this.advance(dt);
    this.drawGraph();
    this.refreshStats();
    this._beat = performance.now();
  }

  renderVals(){
    /* The graph is driven per instance from render, not from a closure created
       in componentDidMount: the runtime can render an instance that never ran
       mount, and a rAF scheduled from that realm never fires. A timer owned by
       whichever instance is actually showing the ontology always does. */
    if (!this._gTimer){
      const tick = () => {
        const t0 = performance.now();
        try { this.graphFrame(); } catch (e) { /* one bad frame must not stop the rest */ }
        const cost = performance.now() - t0;
        this._gTimer = setTimeout(tick, Math.max(16, Math.min(60, cost * 1.2)));
      };
      this._gTimer = setTimeout(tick, 16);
      setTimeout(() => {
        if (!this.graph){ try { this.graph = buildGraph(); } catch (e) {} }
        if (this.graph && !this._legendCounts){
          const c = new Array(CLUSTERS.length).fill(0);
          for (const nd of this.graph.nodes) if (nd.kind !== "core" && nd.cluster >= 0) c[nd.cluster]++;
          this._legendCounts = c;
        }
      }, 450);
    }
    const st = this.state, page = st.page;

    // Equal grid columns (width:max-content + 1fr) let a single thumb glide by
    // translateX(index * 100%) — no measurement, and identical motion everywhere.
    const SLIDE = "transform .46s cubic-bezier(.22,.9,.16,1),background .3s var(--ease)";
    const segTrack = (extra) => "position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:1fr;;border-radius:999px"
      + "width:max-content;max-width:100%;align-items:center;padding:4px;background:var(--surface-faint);"
      + "border:1px solid var(--border);border-radius:var(--r-sm,9px);backdrop-filter:blur(24px);"
      + "box-shadow:inset 0 1px 3px rgba(0,0,0,.36),inset 0 -1px 0 var(--glass-highlight);" + (extra || "");
    const segThumb = (count, index, fill) => {
      const n = Math.max(1, count), i = Math.max(0, index);
      const lift = "box-shadow:0 2px 5px rgba(0,0,0,.34),0 6px 16px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.5),inset 0 -1px 0 rgba(0,0,0,.08);";
      const glow = fill === "var(--accent)"
        ? "box-shadow:0 2px 6px rgba(0,0,0,.3),0 4px 18px var(--accent-line),inset 0 1px 0 rgba(255,255,255,.34);background-image:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0) 55%);background-blend-mode:overlay;"
        : lift;
      return "position:absolute;left:4px;top:4px;bottom:4px;z-index:0;pointer-events:none;"
        + "width:calc((100% - 8px) / " + n + ");transform:translateX(" + (i * 100) + "%);"
        + "border-radius:var(--r-ctl,9px);background-color:" + fill + ";transition:" + SLIDE + ";" + glow;
    };
    const railStyle = (active) => "position:relative;width:" + (st.railOpen ? "100%" : "44px") + ";height:42px;flex:none;display:flex;align-items:center;"
      + (st.railOpen ? "gap:13px;justify-content:flex-start;padding:0 14px;font-size:14px;" : "gap:0;justify-content:center;")
      + "border:0;border-radius:14px;cursor:pointer;overflow:visible;"
      + "transition:background .42s var(--ease),color .35s var(--ease),box-shadow .42s var(--ease),transform .3s cubic-bezier(.16,1.4,.3,1);"
      + (active ? "background:none;color:var(--rail-active-ink,var(--accent))"
                : "background:none;color:var(--mid)");
    // Hover: the icon springs up to 1.3× with a small lift and tilt, a soft accent
    // glow blooms behind it, and an accent stroke re-draws the icon's outline.
    const glyphStyle = (active, hovered) => "position:relative;z-index:1;flex:none;overflow:visible;"
      + "transition:transform .6s cubic-bezier(.2,1.6,.35,1),opacity .22s var(--ease);"
      + "transform:" + (hovered && !active ? "scale(1.3)" : active ? "scale(1.08)" : "none");
    const haloStyle = (active, hovered) => "position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:999px;pointer-events:none;"
      + "background:radial-gradient(closest-side,var(--accent-soft),transparent);"
      + "transition:transform .7s cubic-bezier(.2,1.2,.3,1),opacity .45s var(--ease);"
      + (hovered && !active ? "opacity:1;transform:scale(1)" : "opacity:0;transform:scale(.3)");
    const drawStyle = (active, hovered) => "stroke-dasharray:1;"
      + (hovered && !active
          ? "stroke-dashoffset:0;opacity:1;transition:stroke-dashoffset .75s cubic-bezier(.5,0,.2,1) .05s,opacity .2s"
          : "stroke-dashoffset:1;opacity:0;transition:stroke-dashoffset 0s .3s,opacity .3s");
    const labelStyle = (shown, top) => "position:fixed;left:46px;top:" + top + "px;z-index:90;display:flex;align-items:center;gap:9px;padding:9px 15px;border-radius:var(--r-sm,10px);"
      + "background:var(--tooltip);border:1px solid var(--border);box-shadow:0 16px 38px rgba(0,0,0,.4);"
      + "font-size:13px;font-weight:500;color:var(--tooltip-ink);white-space:nowrap;pointer-events:none;"
      + "transform-origin:left center;opacity:1;transform:translate(0,-50%) scale(1);"
      + "transition:opacity .2s ease,transform .38s cubic-bezier(.16,1.5,.3,1),visibility .2s;"
      + (shown ? "visibility:visible" : "visibility:hidden;opacity:0;transform:translate(-12px,-50%) scale(.92)")

    // Open rail shows labels inline; collapsed rail shows them as the hover pill — never both.
    const railOpen = st.railOpen;
    // Collapsed: the label leaves the flex row entirely — otherwise its gap decentres the icon.
    const inlineStyle = (hov, act) => railOpen
      ? "flex:1;min-width:0;font-size:13px;text-align:left;white-space:nowrap;overflow:hidden;opacity:1;"
        + "font-weight:" + (act ? "600" : "500") + ";"
        + "transform:translateX(" + (hov && !act ? "3px" : "0") + ");"
        + "transition:transform .5s cubic-bezier(.22,1.2,.36,1),font-weight .2s var(--ease)"
      : "display:none";
    const nav = this.navItems().map((n, idx) => n.divider
      ? {isDivider:true, isItem:false, groupLabel: railOpen ? n.groupLabel : ""}
      : {isItem:true, isDivider:false, label:n.label, hint: railOpen ? (n.hint || "") : "", d:ICONS[n.icon],
         dot: n.dot === true && attention(store.get().q).length > 0,
         dotStyle: "position:absolute;top:5px;" + (railOpen ? "left:30px" : "right:6px")
           + ";width:5px;height:5px;border-radius:50%;background:var(--accent)",
         inlineStyle: inlineStyle(st.railHov === idx, n.page === page),
         hintStyle: "flex:none;font-family:" + MONO + ";font-size:9.5px;color:var(--faint);white-space:nowrap",
         active: n.page === page,
         railKey: n.page === page ? "active" : "idle",
         glyphStyle: glyphStyle(n.page === page, st.hovered === idx || st.railHov === idx),
         haloStyle: haloStyle(n.page === page, st.hovered === idx || st.railHov === idx),
         drawStyle: drawStyle(n.page === page, st.hovered === idx || st.railHov === idx),
         style: railStyle(n.page === page) + ";animation:railIn .42s var(--ease) " + (idx * 45) + "ms both",
         enter: (e) => { if (!railOpen) this.hover(idx, n.label, n.hint || "", e); else this.setState({railHov:idx}); },
         leave: () => { if (this.state.railHov === idx) this.setState({railHov:null}); this.unhover(idx); },
         go: () => this.go(n.page)});

    /* ---- records: contacts, files, ontology ---- */
    /* Records tabs: Ontology first (locked), then Files, Contacts, Browse and
       Data quality, each shown only when its capability is enabled. */
    const core = store.get();
    const caps = core.core.config.capabilities;
    void caps;
    const recSections = sectionsFor(core.core, "Records");
    const recSec = recSections.find(s => s.id === this.sectionOf("Records")) || recSections[0] || {id:"browse", label:"Browse"};
    const ontoKind = {entity:["var(--accent)", INK], ledger:["var(--neutral)", BODY],
      module:["#9fd6f0", INK], predicate:["transparent", DIM]};
    const ontoSel = ONTO_NODES.find(n => n[0] === st.ontoNode) || ONTO_NODES[0];

    const recModel = {
      isContacts: page === "Records" && recSec.id === "contacts",
      isFiles: page === "Records" && recSec.id === "files",
      isOntology: page === "Records" && recSec.id === "relationships",
      isBrowse: page === "Records" && recSec.id === "browse",
      isQuality: page === "Records" && recSec.id === "quality",
      section: recSec.id
    };

    const appearanceModel = {
      groups: ["Dark","Light"].map(g => ({
        label: g,
        cards: THEMES.filter(t => t.group === g).map(t => {
          const on = st.theme === t.id;
          return {label:t.label, on,
            cardStyle: "text-align:left;padding:12px;border-radius:var(--card-r,18px);cursor:pointer;background:var(--chip);"
              + "transition:border-color .2s var(--ease),transform .18s var(--ease);"
              + "border:1.5px solid " + (on ? "var(--accent)" : "var(--chip-border)"),
            mockStyle: "position:relative;height:74px;border-radius:var(--r-md,14px);overflow:hidden;background:" + t.bg + ";border:1px solid rgba(127,127,127,.18)",
            barStyle: "position:absolute;left:0;top:0;bottom:0;width:20%;background:" + t.surface,
            cardMockStyle: "position:absolute;left:26%;top:14%;right:8%;height:34%;border-radius:var(--r-sm,9px);background:" + t.surface,
            dotStyle: "position:absolute;left:31%;top:60%;width:9px;height:9px;border-radius:2px;background:" + t.accent,
            lineStyle: "position:absolute;left:45%;top:62%;right:12%;height:5px;border-radius:2px;background:" + t.ink + ";opacity:.16",
            pick: () => this.setState({theme:t.id})};
        })
      }))
    };

    const g = this.graph, live = this.searches || [];
    const PHASE_WORD = {sweep:"expanding", path:"tracing", hold:"matched", fade:"clearing"};
    const graphModel = {
      nodeCount: g ? g.nodes.length.toLocaleString("en-IE") : "None",
      edgeCount: g ? g.edges.length.toLocaleString("en-IE") : "None",
      running: live.filter(s => s.delay <= 0).length + " OF " + live.length,
      queries: live.map((s, i) => {
        const settled = Math.min(s.order.length, Math.floor(s.reveal));
        const pct = s.phase === "sweep"
          ? Math.round(100 * settled / Math.max(1, s.order.length))
          : 100;
        return {hue: s.hue,
          label: "Query " + (i + 1) + " · " + (g ? CLUSTERS[g.nodes[s.source].cluster][0] : ""),
          detail: s.delay > 0 ? "queued"
            : s.phase === "sweep" ? settled + " settled"
            : PHASE_WORD[s.phase] + " · " + Math.max(0, s.path.length - 1) + " hops",
          progress: (s.delay > 0 ? 0 : pct) + "%"};
      }),
      run: () => { if ((st.ontoQuery || "").trim()) this.runOntoQuery(); else this.planSearch(); try { this.setState({gTick: Math.random()}); } catch (e) {} },
      legend: CLUSTERS.map((c, i) => ({label:c[0], bg:c[1],
        count: g ? String((this._legendCounts || (this._legendCounts = (() => {
          const c = new Array(CLUSTERS.length).fill(0);
          for (const nd of g.nodes) if (nd.kind !== "core" && nd.cluster >= 0) c[nd.cluster]++;
          return c; })()))[i]) : "None"}))
    };

    const oq = st.ontoQuery || "", ontoSearchRes = st.ontoResult;
    const ontoSearch = {
      query: oq, hasQuery: oq.length > 0,
      setQuery: (e) => this.setState({ontoQuery:e.target.value}),
      onKey: (e) => { if (e.key === "Enter") this.runOntoQuery(); },
      clear: () => this.clearOntoQuery(),
      hasResult: !!ontoSearchRes, resultEmpty: !!(ontoSearchRes && ontoSearchRes.empty),
      resultFound: !!(ontoSearchRes && !ontoSearchRes.empty && ontoSearchRes.mode === "path" && ontoSearchRes.found),
      resultNoPath: !!(ontoSearchRes && !ontoSearchRes.empty && ontoSearchRes.mode === "path" && !ontoSearchRes.found),
      resultFan: !!(ontoSearchRes && !ontoSearchRes.empty && ontoSearchRes.mode === "fan"),
      fromLabel: ontoSearchRes ? ontoSearchRes.from : "", toLabel: ontoSearchRes ? ontoSearchRes.to : "",
      hopsLabel: ontoSearchRes && ontoSearchRes.hops != null ? ontoSearchRes.hops + " hop" + (ontoSearchRes.hops === 1 ? "" : "s") + " between records" : "",
      connectedLabel: ontoSearchRes && ontoSearchRes.connected
        ? (ontoSearchRes.connected.length ? "Also connected to " + ontoSearchRes.connected.join(", ") : "No other clusters reached this time. Try again.")
        : ""
    };

    const ontoModel = {
      edges: ONTO_EDGES.map(e => {
        const near = ontoSel && (Math.abs(e[0] - ontoSel[2]) < 2 && Math.abs(e[1] - ontoSel[3]) < 2)
          || (Math.abs(e[2] - ontoSel[2]) < 2 && Math.abs(e[3] - ontoSel[3]) < 2);
        return {x1:e[0], y1:e[1], x2:e[2], y2:e[3],
          stroke: near ? "var(--accent-line)" : "var(--border)", width: near ? 1.6 : 1};
      }),
      // Predicates are edge labels, so they render inside the viewBox and scale
      // with the geometry instead of competing with the fixed-width node pills.
      labels: ONTO_NODES.filter(n => n[1] === "predicate").map(n => {
        const w = Math.round(n[0].length * 12.2 + 34);
        return {label:n[0], rx:n[2] - w / 2, ry:n[3] - 18, rw:w,
          stroke: st.ontoNode === n[0] ? "var(--accent-line)" : "var(--border)"};
      }),
      nodes: ONTO_NODES.filter(n => n[1] !== "predicate").map(n => {
        const [label, kind, x, y, big] = n;
        const tint = ontoKind[kind];
        const on = st.ontoNode === label, hot = st.ontoHover === label;
        const isPred = kind === "predicate";
        return {label, fontSize: isPred ? "10.5px" : big ? "13.5px" : "12.5px",
          ink: isPred ? DIM : tint[1],
          dotStyle: isPred ? "display:none"
            : "width:" + (big ? "10px" : "8px") + ";height:" + (big ? "10px" : "8px") + ";border-radius:var(--r-sm,9px);background:" + tint[0],
          style: "position:absolute;left:" + (7 + x * 0.086) + "%;top:" + (8 + y * 0.142) + "%;transform:translate(-50%,-50%)"
            + (hot || on ? " scale(1.06)" : "") + ";display:flex;align-items:center;gap:8px;cursor:pointer;"
            + "padding:" + (isPred ? "3px 9px" : "8px 14px") + ";border-radius:var(--r-sm,9px);white-space:nowrap;"
            + "transition:transform .24s var(--ease),border-color .2s var(--ease),background .2s var(--ease);"
            + (isPred
              ? "background:var(--surface-2);border:1px dashed " + (on ? "var(--accent-line)" : "var(--border)")
              : on ? "background:var(--surface-2);border:1px solid var(--accent);box-shadow:0 6px 20px var(--accent-faint)"
                   : "background:var(--overlay);border:1px solid var(--border);backdrop-filter:blur(20px)"),
          pick: () => this.setState({ontoNode:label}),
          enter: () => this.setState({ontoHover:label}),
          leave: () => this.setState(prev => (prev.ontoHover === label ? {ontoHover:null} : null))};
      }),
      selectedLabel: ontoSel[0],
      selectedNote: ontoSel[5],
      legend: [["Core entity","var(--accent)", ONTO_NODES.filter(n => n[1] === "entity").length],
        ["Synced from a source","var(--neutral)", ONTO_NODES.filter(n => n[1] === "ledger").length],
        ["Configured per client","#9fd6f0", ONTO_NODES.filter(n => n[1] === "module").length],
        ["Predicate","var(--track)", ONTO_NODES.filter(n => n[1] === "predicate").length]]
        .map(l => ({label:l[0], bg:l[1], count:String(l[2])})),
      layouts: [],
      ...ontoSearch
    };

    const chip = (on) => "height:31px;padding:0 14px;border-radius:var(--r-ctl,9px);cursor:pointer;font-size:12.5px;white-space:nowrap;"
      + "transition:background .2s var(--ease),border-color .2s var(--ease),color .2s var(--ease),transform .18s var(--ease);"
      + (on ? "background:var(--accent-faint);border:1px solid var(--accent-line);color:var(--ink)"
            : "background:var(--surface);border:1px solid var(--border);color:var(--dim)");
    /* Agents come from the shared configuration (Settings > Agent controls). */
    const coreAgentList = store.get().core.config.agents.map(a => ({id:a.id, name:a.name, shape:a.shape, tint:a.tint, state:"complete",
      role:a.purpose, when:"", preview:a.purpose, thread:[]}));
    const aq = st.agentQuery.trim().toLowerCase();
    const agentMatches = coreAgentList.filter(a => !aq || (a.name + " " + a.role + " " + a.preview).toLowerCase().indexOf(aq) > -1);
    const activeAgent = coreAgentList.find(a => a.id === st.agentId) || coreAgentList[0]
      || {id:"none", name:"Agent", shape:"crown-pebble", tint:"#191c1f", state:"complete", role:"", thread:[], when:"", preview:""};
    const activeThread = activeAgent.thread.concat(st.agentExtra[activeAgent.id] || []);

    const segStyle = (active) => "display:flex;align-items:center;gap:7px;height:30px;padding:0 14px;border:0;border-radius:var(--r-ctl,11px);cursor:pointer;font-size:12.5px;white-space:nowrap;"
      + "transition:background .24s var(--ease),color .24s var(--ease),font-weight .24s var(--ease);"
      + (active ? "background:var(--pill-bg);color:var(--pill-ink);font-weight:500;box-shadow:0 2px 5px rgba(0,0,0,.34),0 6px 16px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.5);" : "background:none;color:var(--dim)");
    // active/inactive are booleans the template branches on — a changed style string
    // on a keyless reused node does not reliably commit.
    const seg = (label, active, go, count) => ({label, go, count: count || "",
      active: !!active, inactive: !active});

    /* Notifications are the same unresolved items as Activity > Attention, plus
       decisions waiting on the viewer. In-app only: nothing is emailed. */
    const coreSnap = store.get();
    const toneDot = {bad:RED, warn:AMBER, accent:LIME, ok:GREEN, neutral:NEUTRAL};
    const relWhen = (at) => { const h = Math.max(0, (Date.parse(coreSnap.ctx.now) - Date.parse(at)) / 3600000);
      return h < 1 ? Math.max(1, Math.round(h * 60)) + "m" : h < 48 ? Math.round(h) + "h" : Math.round(h / 24) + "d"; };
    const notificationFeed = waitingOnMe(coreSnap.q).map(a => {
      const r = coreSnap.core.data.requests.find(x => x.id === a.requestId);
      const stg = a.stages.find(x => x.status === "pending");
      return {dot:LIME, text:"Decision waiting on you: " + (r ? r.ref + " " + r.title : "a request"), event:"approval.pending", meta: relWhen((stg && stg.startedAt) || a.submittedAt),
        open: () => { this.setState({showNotifs:false}); openObject("approval", a.id); }};
    }).concat(attention(coreSnap.q).map(i => ({dot: toneDot[i.tone] || AMBER, text: i.title + ": " + i.reason, event: i.kind, meta: relWhen(i.since),
      open: () => { this.setState({showNotifs:false}); openObject(i.objectKind, i.id); }})))
      /* Mentions in comments from the last week open the object the comment is on. */
      .concat(coreSnap.core.data.comments.filter(c => c.mentions.includes(coreSnap.session.viewerId) && c.by !== coreSnap.session.viewerId
        && Date.parse(coreSnap.ctx.now) - Date.parse(c.at) < 7 * 864e5 && c.at <= coreSnap.ctx.now).map(c => ({dot:LIME,
        text: coreSnap.q.name(c.by) + " mentioned you: " + c.text.replace(/@[A-Z][a-z]+ [A-Z][a-z]+\s*/g, "").slice(0, 110), event:"comment.mention", meta: relWhen(c.at),
        open: () => { this.setState({showNotifs:false}); openObject(c.objectType, c.objectId); }})))
      /* Company updates published to this person in the last three days. */
      .concat(visibleUpdates(coreSnap.core, coreSnap.session.viewerId).filter(u => u.state === "published" && u.publishedBy !== coreSnap.session.viewerId
        && Date.parse(coreSnap.ctx.now) - Date.parse(u.publishedAt) < 3 * 864e5).map(u => ({dot:GREEN, text:"Company update: " + u.title, event:"update.published", meta: relWhen(u.publishedAt),
        open: () => { this.setState({showNotifs:false}); this.navTo({page:"Activity", section:"overview"}); }})));

    const q = st.query.trim();
    const ql = q.toLowerCase();
    const scope = st.palScope || "All";
    const GLYPH = {
      agent: "M12 4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2 M4.8 20a7.2 7.2 0 0 1 14.4 0",
      task: "M4 6h16 M4 12h16 M4 18h9",
      person: "M12 4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2 M4.8 20a7.2 7.2 0 0 1 14.4 0",
      org: "M4 20V7.5L12 4l8 3.5V20 M9.5 20v-5.5h5V20",
      page: "M6.5 3.5h8l4 4v13h-12z M14.5 3.5v4h4",
      action: "M13 3 4.5 14H10l-1 7 9-11h-5.5z",
      recent: "M12 7v5l3.4 2 M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9"
    };
    const recents = st.palRecent || [];
    const themeAction = st.theme === "dark" ? "Switch to light appearance" : "Switch to dark appearance";
    const SEARCH = [
      recents.length ? {group:"Recent", scope:"All", items:recents.slice(0, 3).map(r => ({title:r, meta:"Recent search", hint:"AGAIN", glyph:"recent",
        go: () => this.setState({query:r, palSel:0})}))} : null,
      {group:"Actions", scope:"Actions", items:[
        {title:"Start a new Helios conversation", meta:"Clears the current thread", hint:"ACTION", glyph:"action",
          go: () => { clearInterval(this._t); this.setState({page:"Home", thread:[], typed:0, draft:""}); }},
        {title:"Review decisions waiting on you", meta:"Work · approvals", hint:"ACTION", glyph:"action",
          go: () => this.navTo({page:"Work", section:"approvals"})},
        {title:themeAction, meta:"Appearance", hint:"ACTION", glyph:"action",
          go: () => this.setState(p => p.theme === "light" ? {theme: p.darkTheme || this.props.theme || "harbour"} : {theme:"light", darkTheme:p.theme})},
        {title:"Open connections and sync", meta:"Settings · systems", hint:"ACTION", glyph:"action",
          go: () => this.navTo({page:"Settings", section:"connections"})}
      ]},
      /* Search reads through the query layer, so it only finds what the viewer may see. */
      {group:"Agents", scope:"Agents", items:coreSnap.core.config.agents.filter(a => a.enabled).map(a => ({title:a.name, meta:a.purpose, hint:"AGENT", glyph:"agent",
        go: () => openObject("agent", a.id)}))},
      {group:"Work", scope:"Work", items:coreSnap.q.tasks({ignoreScope:true}).filter(t => coreSnap.q.isOpenTask(t)).map(t => ({title:t.title,
        meta:coreSnap.q.teamLabel(t.teamId) + " · " + coreSnap.q.name(t.assigneeId), hint:"TASK", glyph:"task",
        go: () => openObject("task", t.id)}))
        .concat(coreSnap.q.requests({ignoreScope:true}).map(r => ({title:r.ref + " " + r.title, meta:"Request · " + coreSnap.q.name(r.requesterId), hint:"REQUEST", glyph:"task",
        go: () => openObject("request", r.id)})))},
      {group:"Records", scope:"Records", items:coreSnap.q.records({ignoreScope:true}).map(r => ({title:r.ref + " " + r.title, meta:coreSnap.q.teamLabel(r.teamId) + " · " + r.status, hint:"RECORD", glyph:"page",
        go: () => openObject("record", r.id)}))
        .concat(coreSnap.q.people().filter(p => p.kind === "staff" || coreSnap.q.viewer.person.kind === "staff").map(p => ({title:p.name, meta:p.title + (p.organisation ? " · " + p.organisation : ""), hint:"PERSON", glyph:"person",
        go: () => this.navTo({page:"Records", section:"contacts"})})))
        .concat(coreSnap.q.files({ignoreScope:true}).map(f => ({title:f.title, meta:"File · v" + f.versions.length, hint:"FILE", glyph:"page",
        go: () => openObject("file", f.id)})))},
      {group:"Pages", scope:"Pages", items:[
        /* Every enabled, permitted page, with its configured label; disabled modules never appear. */
        ...visiblePages(coreSnap.core, coreSnap.session.viewerId).filter(pg => pg.id !== "Settings").map(pg => ({title:pageLabel(coreSnap.core.config, pg.id), meta:"Page", hint:"PAGE", glyph:"page",
          go: () => this.navTo({page:pg.id})})),
        {title:"Data quality", meta:"Records · issues to resolve", hint:"PAGE", glyph:"page", go: () => this.navTo({page:"Records", section:"quality"})},
        {title:"Needs attention", meta:"Activity · unresolved items", hint:"PAGE", glyph:"page", go: () => this.navTo({page:"Activity", section:"attention"})},
        {title:"Roles and permissions", meta:"Settings · organisation", hint:"CONFIG", glyph:"page", go: () => this.navTo({page:"Settings", section:"roles"})},
        {title:"Connections", meta:"Settings · systems", hint:"CONFIG", glyph:"page", go: () => this.navTo({page:"Settings", section:"connections"})}
      ]}
    ].filter(Boolean);

    const match = g => g.items.filter(i => !ql || (i.title + " " + i.meta).toLowerCase().includes(ql));
    const scopeCounts = {All:0};
    SEARCH.forEach(g => { const n = match(g).length; scopeCounts.All += n; if (g.scope !== "All") scopeCounts[g.scope] = (scopeCounts[g.scope] || 0) + n; });
    const palScopes = ["All","Actions","Agents","Work","Records","Pages"].map(name => {
      const on = scope === name;
      return {label:name, count:scopeCounts[name] || 0,
        style:"flex:none;display:flex;align-items:center;gap:6px;height:26px;padding:0 11px;border-radius:var(--r-ctl,9px);cursor:pointer;font-size:12px;transition:background .2s var(--ease),color .2s var(--ease),border-color .2s var(--ease);"
          + (on ? "background:var(--pill-bg);border:1px solid var(--accent-line);color:var(--pill-ink);box-shadow:0 2px 5px rgba(0,0,0,.34),0 6px 16px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.5);" : "background:none;border:1px solid var(--border);color:var(--dim)"),
        countStyle:"font-family:var(--mono);font-size:9.5px;" + (on ? "color:var(--pill-ink);opacity:.75" : "color:var(--faint)"),
        pick: () => this.setState({palScope:name, palSel:0})};
    });

    const groups = SEARCH.filter(g => scope === "All" || g.scope === scope || g.group === "Recent")
      .map(g => ({group:g.group, items:match(g).slice(0, 6)})).filter(g => g.items.length);
    const base = q ? 1 : 0;
    const total = base + groups.reduce((n, g) => n + g.items.length, 0);
    const sel = total ? Math.max(0, Math.min(st.palSel || 0, total - 1)) : 0;
    const fresh = Date.now() - (this._palOpenedAt || 0) < 420;
    const rowBase = "display:flex;align-items:center;gap:12px;padding:9px 20px;cursor:pointer;transition:background .16s var(--ease),box-shadow .16s var(--ease)";
    const flat = [];
    const remember = (title, go) => () => {
      const list = [title].concat((st.palRecent || []).filter(r => r !== title)).slice(0, 4);
      this.setState({paletteOpen:false, query:"", palSel:0, palRecent:list});
      go();
    };
    let n = base;
    const results = groups.map((g, gi) => ({
      group:g.group, count:g.items.length,
      anim: fresh ? "animation:rowIn .34s var(--ease) " + (70 + gi * 40) + "ms both" : "",
      items:g.items.map(i => {
        const idx = n++;
        const active = idx === sel;
        const open = remember(i.title, i.go);
        flat[idx] = open;
        const at = ql ? i.title.toLowerCase().indexOf(ql) : -1;
        return {
          pre: at < 0 ? i.title : i.title.slice(0, at),
          match: at < 0 ? "" : i.title.slice(at, at + ql.length),
          post: at < 0 ? "" : i.title.slice(at + ql.length),
          meta:i.meta, hint:i.hint, icon:GLYPH[i.glyph] || GLYPH.page,
          rowStyle: rowBase + (active ? ";background:var(--surface);box-shadow:inset 2px 0 0 var(--accent)" : ""),
          iconStyle: "flex:none;width:26px;height:26px;border-radius:var(--r-sm,9px);display:flex;align-items:center;justify-content:center;border:1px solid var(--border);transition:color .16s var(--ease),border-color .16s var(--ease);"
            + (active ? "background:var(--pill-bg);border-color:var(--accent-line);color:var(--accent)" : "background:var(--surface-2);color:var(--dim)"),
          enterStyle: "flex:none;font-family:var(--mono);font-size:9px;letter-spacing:.08em;color:var(--accent);"
            + (active ? "opacity:1" : "opacity:0"),
          open, hover: () => { if (st.palSel !== idx) this.setState({palSel:idx}); }
        };
      })
    }));
    const askActive = base === 1 && sel === 0;
    /* launcher rows extend the same flat index; see below */
    if (base === 1) flat[0] = () => this.ask(q);

    /* ---- launcher (no query): page kit, frequents, recents, jump-to ---- */
    const jump = (p, extra) => () => {
      this.setState(Object.assign({page:p, paletteOpen:false, query:"", palSel:0}, extra || {}));
      if (p === "Dashboard") this.startKpiCount();
    };
    const KITS = {
      Home: [
        {title:"Ask what changed today", meta:"Sample answer from your records", icon:ICONS.helios, go: () => { clearInterval(this._t); this.setState({paletteOpen:false, query:"", page:"Home"}); this.ask("What changed in the last day?"); }},
        {title:"Decisions waiting on you", meta:waitingOnMe(coreSnap.q).length + " waiting", icon:ICONS.approvals, go: () => this.navTo({page:"Work", section:"approvals"})},
        {title:"Edit widgets", meta:"Show or hide rail widgets", icon:ICONS.dash, go: jump("Home", {widgetEdit:true})},
        {title:"My work", meta:"Tasks assigned to you", icon:ICONS.work, go: () => this.navTo({page:"Work", section:"tasks"})}
      ],
      Work: [
        {title:"Approvals", meta:"Decisions and their stages", icon:ICONS.approvals, go: () => this.navTo({page:"Work", section:"approvals"})},
        {title:"Workflow runs", meta:"Cases, failures and recovery", icon:ICONS.autos, go: () => this.navTo({page:"Work", section:"schedules"})},
        {title:"Schedules", meta:"Recurring work and automation", icon:ICONS.visits, go: () => this.navTo({page:"Work", section:"schedules"})},
        {title:"Tasks", meta:"Queues for you and your teams", icon:ICONS.work, go: () => this.navTo({page:"Work", section:"tasks"})}
      ],
      Records: [
        {title:"Browse records", meta:"Every record you can see", icon:ICONS.records, go: () => this.navTo({page:"Records", section:"browse"})},
        {title:"Data quality", meta:"Missing, duplicate and conflicting data", icon:ICONS.health, go: () => this.navTo({page:"Records", section:"quality"})},
        {title:"Files", meta:"Documents and versions", icon:ICONS.files, go: () => this.navTo({page:"Records", section:"files"})},
        {title:"Ontology graph", meta:"How records relate", icon:ICONS.navRecords, go: () => this.navTo({page:"Records", section:"ontology"})}
      ],
      Dashboard: [
        {title:"Needs attention", meta:"Unresolved items", icon:ICONS.health, go: () => this.navTo({page:"Activity", section:"attention"})},
        {title:"Metric definitions", meta:"How each figure is calculated", icon:ICONS.insights, go: () => this.navTo({page:"Settings", section:"metrics"})},
        {title:"Role dashboards", meta:"Defaults per role", icon:ICONS.dash, go: () => this.navTo({page:"Settings", section:"layouts"})},
        {title:"Data quality", meta:"Completeness and open issues", icon:ICONS.records, go: () => this.navTo({page:"Records", section:"quality"})}
      ],
      Agents: [
        {title:"Agent controls", meta:"Purpose, scope and permitted actions", icon:ICONS.navAdmin, go: () => this.navTo({page:"Settings", section:"agents"})},
        {title:"Agent runs", meta:"What agents are doing and did", icon:ICONS.agents, go: () => this.navTo({page:"Agents", section:"runs"})},
        {title:"Build an agent", meta:"Start from a blank brief", icon:ICONS.modules, go: () => this.setState({paletteOpen:false, query:"", page:"Agents", builderOpen:true, builderMode:"new"})},
        {title:"Needs attention", meta:"Unresolved items", icon:ICONS.health, go: () => this.navTo({page:"Activity", section:"attention"})}
      ],
      Activity: [
        {title:"Needs attention", meta:"Failures, overdue work and decisions", icon:ICONS.health, go: jump("Activity", {actKpi:"attention"})},
        {title:"Overview", meta:"Stories, business changes and company updates", icon:ICONS.navActivity, go: jump("Activity", {actKpi:"overview"})},
        {title:"Company updates and recaps", meta:"Activity · overview", icon:ICONS.agents, go: jump("Activity", {actKpi:"overview"})},
        {title:"History", meta:"Full audit trail with export", icon:ICONS.navActivity, go: jump("Activity", {actKpi:"history"})}
      ],
      Settings: [
        {title:"Roles and permissions", meta:"Who can see and do what", icon:ICONS.navAdmin, go: () => this.navTo({page:"Settings", section:"roles"})},
        {title:"Approval routing", meta:"Stages and thresholds", icon:ICONS.approvals, go: () => this.navTo({page:"Settings", section:"approvals"})},
        {title:"Connections and sync", meta:"Source systems", icon:ICONS.health, go: () => this.navTo({page:"Settings", section:"connections"})},
        {title:"Terminology", meta:"Labels this organisation uses", icon:ICONS.modules, go: () => this.navTo({page:"Settings", section:"terminology"})}
      ]
    };
    const palPageRaw = KITS[page] || [
      {title:"Ask Helios about this page", meta:"It sees what you see", icon:ICONS.helios, go: () => { this.setState({paletteOpen:false, query:"", page:"Home"}); this.ask("What should I know about " + page + "?"); }},
      {title:"Decisions waiting on you", meta:waitingOnMe(coreSnap.q).length + " waiting", icon:ICONS.approvals, go: () => this.navTo({page:"Work", section:"approvals"})},
      {title:"My work", meta:"Tasks assigned to you", icon:ICONS.work, go: () => this.navTo({page:"Work", section:"tasks"})},
      {title:"Records", meta:"Every record you can see", icon:ICONS.navRecords, go: () => this.navTo({page:"Records", section:"browse"})}
    ];
    /* Shortcuts, not usage counts: nothing here pretends to measure behaviour. */
    const FREQ = [
      {title:"Approvals", count:"", icon:ICONS.approvals, go: () => this.navTo({page:"Work", section:"approvals"})},
      {title:"Data quality", count:"", icon:ICONS.health, go: () => this.navTo({page:"Records", section:"quality"})},
      {title:"Browse records", count:"", icon:ICONS.records, go: () => this.navTo({page:"Records", section:"browse"})},
      {title:"Workflow runs", count:"", icon:ICONS.autos, go: () => this.navTo({page:"Work", section:"schedules"})}
    ];
    /* Jump-to lists only enabled, permitted pages (module pages included), under their configured labels. */
    const JUMPS = visiblePages(coreSnap.core, coreSnap.session.viewerId).map(pg => ({title:pageLabel(coreSnap.core.config, pg.id), icon:ICONS[pg.icon] || ICONS.navHome,
      go: () => this.navTo({page:pg.id})}));
    const RECENT_WHEN = ["2 min", "18 min", "1 h", "yesterday"];
    const recentRaw = (st.palRecent || []).slice(0, 4);

    const homeCount = q ? 0 : palPageRaw.length + FREQ.length + recentRaw.length + JUMPS.length;
    const homeSel = q ? -1 : Math.max(0, Math.min(st.palSel || 0, Math.max(homeCount - 1, 0)));
    let hi = 0;
    const homeItem = (i, run) => {
      const idx = hi++;
      const active = !q && idx === homeSel;
      const open = () => { this.setState({paletteOpen:false, query:"", palSel:0}); run(); };
      if (!q) flat[idx] = open;
      return {active, open, hover: () => { if (!q && st.palSel !== idx) this.setState({palSel:idx}); }};
    };
    const tileBase = "display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:var(--r-sm,11px);cursor:pointer;text-align:left;transition:background .16s var(--ease),border-color .16s var(--ease),transform .18s var(--ease);";
    const chipBase = "display:flex;align-items:center;gap:7px;height:30px;padding:0 12px;border-radius:var(--r-ctl,11px);cursor:pointer;font-size:12px;transition:background .16s var(--ease),border-color .16s var(--ease),color .16s var(--ease);";
    const palPage = palPageRaw.map(p => {
      const h = homeItem(0, p.go);
      return {title:p.title, meta:p.meta, icon:p.icon, open:h.open, hover:h.hover,
        style: tileBase + (h.active
          ? "background:var(--surface);border:1px solid var(--accent-line);transform:translateY(-1px)"
          : "background:var(--surface-2);border:1px solid var(--border)"),
        iconStyle: "flex:none;width:26px;height:26px;border-radius:var(--r-sm,9px);display:flex;align-items:center;justify-content:center;border:1px solid var(--border);"
          + (h.active ? "background:var(--pill-bg);border-color:var(--accent-line);color:var(--accent)" : "background:var(--surface);color:var(--dim)")};
    });
    const palFrequent = FREQ.map(f => {
      const h = homeItem(0, f.go);
      return {title:f.title, count:f.count, icon:f.icon, open:h.open, hover:h.hover,
        style: chipBase + (h.active
          ? "background:var(--pill-bg);border:1px solid var(--accent-line);color:var(--pill-ink)"
          : "background:var(--surface-2);border:1px solid var(--border);color:var(--body)"),
        countStyle: "font-family:var(--mono);font-size:9.5px;" + (h.active ? "color:var(--pill-ink);opacity:.7" : "color:var(--faint)")};
    });
    const palRecentRows = recentRaw.map((r, i) => {
      const h = homeItem(0, () => this.setState({paletteOpen:false, query:r, palSel:0, palScope:"All"}));
      return {title:r, when:RECENT_WHEN[i] || "earlier", icon:GLYPH.recent, open:h.open, hover:h.hover,
        rowStyle: "display:flex;align-items:center;gap:11px;padding:9px 20px;cursor:pointer;transition:background .16s var(--ease),box-shadow .16s var(--ease);"
          + (h.active ? "background:var(--surface);box-shadow:inset 2px 0 0 var(--accent)" : ""),
        iconStyle: "flex:none;width:24px;height:24px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);"
          + (h.active ? "background:var(--pill-bg);border-color:var(--accent-line);color:var(--accent)" : "background:var(--surface-2);color:var(--dim)"),
        enterStyle: "flex:none;font-family:var(--mono);font-size:9px;color:var(--accent);" + (h.active ? "opacity:1" : "opacity:0")};
    });
    const palJump = JUMPS.map(j => {
      const h = homeItem(0, j.go);
      return {title:j.title, icon:j.icon, open:h.open, hover:h.hover,
        style: chipBase + (h.active
          ? "background:var(--pill-bg);border:1px solid var(--accent-line);color:var(--pill-ink)"
          : "background:none;border:1px solid var(--border);color:var(--dim)")};
    });

    let contextNav, contextHint, searchHint;
    if (page === "Settings"){
      contextNav = SETTINGS_GROUPS.map(grp => seg(
        grp.charAt(0) + grp.slice(1).toLowerCase(),
        st.adminGroup === grp,
        () => this.setState({adminGroup: st.adminGroup === grp ? null : grp}),
        String(SETTINGS_SECTIONS.filter(c => c.group === grp).length)));
      contextHint = "SETTINGS · " + SETTINGS_SECTIONS.length + " AREAS";
      searchHint = "Search settings";
    } else if (pageDef(page)){
      /* Every other page: its sections from the shared registry (src/core/modules.ts). */
      const cur = this.sectionOf(page);
      const counts = this.sectionCounts(page, core.q);
      const list = sectionsFor(core.core, page);
      contextNav = list.map(x => seg(x.label, cur === x.id, () => this.setSection(page, x.id), counts[x.id] !== undefined ? String(counts[x.id]) : undefined));
      const curSec = list.find(x => x.id === cur);
      contextHint = pageLabel(core.core.config, page).toUpperCase() + (curSec ? " · " + curSec.label.toUpperCase() : "") + " · " + scopeLabel(core.core, core.session.scope).toUpperCase();
      searchHint = page === "Home" ? "Search every record you can see" : "Search " + (curSec ? curSec.label.toLowerCase() : pageLabel(core.core.config, page).toLowerCase());
    } else {
      contextNav = [seg(page, true, () => {}), seg("Home", false, () => this.go("Home"))];
      contextHint = "CLIENT CONFIG";
      searchHint = "Search this page";
    }

    // Below these widths the nav keeps its room and the softer furniture gives way:
    // the context hint first, then the search label, then the profile text.
    const roomy = st.w >= 1320, mid = st.w >= 1120;
    return {
      nav, contextNav, contextHint, searchHint,
      rec: recModel, onto: ontoModel, graph: graphModel,
      notificationFeed, results,
      isRecords: page === "Records",
      isActivity: page === "Activity",
      // Working pages use compact headers, so the large Records wash is off.
      showRecordsWash: false,
      recSectionId: recSec.id,
      setRecSection: (id) => this.setSection("Records", id),
      appearance: appearanceModel,
      workSectionId: this.sectionOf("Work"),
      setWorkSection: (id) => this.setSection("Work", id),
      actLens: this.sectionOf("Activity"),
      setActLens: (id) => this.setSection("Activity", id),
      agentsSection: this.sectionOf("Agents"),
      setAgentsSection: (id) => this.setSection("Agents", id),
      adminGroupSel: st.adminGroup,
      adminOpenId: st.adminOpen,
      setAdminOpen: (id) => this.setState({adminOpen:id}),
      /* rail */
      railOuter: "position:relative;z-index:2;width:" + (railOpen ? "252px" : "68px")
        + ";flex:none;display:flex;flex-direction:column;align-items:" + (railOpen ? "stretch" : "center")
        + ";gap:4px;padding:22px " + (railOpen ? "16px" : "0") + " 16px"
        + ";background:transparent;"
        + "overflow-y:auto;overflow-x:hidden;scrollbar-width:none;"
        + "transition:width .32s var(--ease),padding .32s var(--ease)",
      brandStyle: railOpen
        ? "flex:1;min-width:0;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;opacity:1"
        : "display:none",
      railToggleStyle: "width:28px;height:28px;flex:none;border:0;border-radius:var(--r-ctl,10px);background:none;color:var(--mid);cursor:pointer;"
        + "display:flex;align-items:center;justify-content:center;transition:background .2s var(--ease),color .2s var(--ease);"
        + (railOpen ? "" : "position:absolute;opacity:0;pointer-events:none"),
      railOpen,
      railRowStyle: "display:flex;align-items:center;gap:10px;"
        + (railOpen ? "width:100%;padding:0 10px;" : "justify-content:center;width:40px;"),
      railLabel: railOpen ? "Collapse sidebar" : "Expand sidebar",
      toggleRail: () => this.setState(prev => ({railOpen: !prev.railOpen, hovered:null})),
      settingsInlineStyle: inlineStyle(st.railHov === "settings", page === "Settings"),

      /* header zones */
      isAgents: page === "Agents",
      showPillNav: true,

      /* home widgets */
      widgetEdit: st.widgetEdit,
      toggleWidgetEdit: () => this.setState(prev => ({widgetEdit: !prev.widgetEdit})),
      widgetEditLabel: st.widgetEdit ? "Done" : "Edit",
      widgetEditBg: st.widgetEdit ? "var(--accent)" : "var(--surface)",
      widgetEditBorder: st.widgetEdit ? "var(--accent)" : "var(--border)",
      widgetEditColor: st.widgetEdit ? "var(--on-accent)" : "var(--dim)",
      /* dashboard */
      isDashboard: page === "Dashboard",
      // One area at a time: the slider selects, it does not accumulate.
      /* home widget board */
      /* agents */
      agentCountLabel: (() => { const n = coreSnap.core.config.agents.filter(a => a.enabled).length; return n + (n === 1 ? " AGENT" : " AGENTS") + " CONFIGURED"; })(),
      /* mini chat */
      showFab: page !== "Home" && page !== "Agents",
      fabTitle: st.miniOpen ? "Close Helios" : "Ask Helios",
      fabChatStyle: "position:absolute;inset:0;transition:transform .34s var(--ease),opacity .24s var(--ease);"
        + (st.miniOpen ? "transform:rotate(-90deg) scale(.7);opacity:0" : "transform:none;opacity:1"),
      fabCloseStyle: "position:absolute;inset:0;transition:transform .34s var(--ease),opacity .24s var(--ease);"
        + (st.miniOpen ? "transform:none;opacity:1" : "transform:rotate(90deg) scale(.7);opacity:0"),
      miniMicStyle: "width:34px;height:34px;flex:none;border-radius:var(--r-ctl,12px);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:color .2s var(--ease),border-color .2s var(--ease),background .2s var(--ease);"
        + (st.miniMic ? "border:1px solid var(--accent-line);background:var(--accent-soft);color:var(--accent)" : "border:1px solid var(--border);background:none;color:var(--dim)"),
      miniDictate: () => this.setState(prev => ({miniMic: !prev.miniMic})),
      miniAttach: () => this.openPalette(),
      miniFooter: st.miniMic ? "LISTENING" : "SEES " + page.toUpperCase() + " · ENTER TO SEND",
      miniOpen: st.miniOpen,
      toggleMini: () => this.setState(prev => ({miniOpen: !prev.miniOpen})),
      miniContext: "SEES " + page.toUpperCase(),
      goHomeChat: () => this.setState({page:"Home", miniOpen:false}),
      miniIsChat: (st.miniTab || "chat") === "chat", miniIsWork: (st.miniTab || "chat") === "work",
      miniTabTrack: "position:relative;display:flex;align-items:center;width:164px;padding:2px;background:var(--surface-faint);border:1px solid var(--border);border-radius:var(--r-md,14px);flex:none;box-shadow:inset 0 1px 3px rgba(0,0,0,.34),inset 0 -1px 0 var(--glass-highlight);",
      miniTabThumb: (() => {
        const idx = (st.miniTab || "chat") === "chat" ? 0 : 1;
        return "position:absolute;top:2px;bottom:2px;left:2px;width:calc(50% - 2px);border-radius:var(--r-sm,9px);background:var(--pill-bg);box-shadow:0 2px 5px rgba(0,0,0,.34),0 6px 16px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.5);"
          + "transform:translateX(" + (idx * 100) + "%);transition:transform .3s var(--ease)";
      })(),
      miniTabs: [["chat","Chat"],["work","Work"]].map(t => {
        const on = (st.miniTab || "chat") === t[0];
        return {label:t[1],
          style: "position:relative;z-index:1;flex:1;height:28px;padding:0;border:0;border-radius:var(--r-ctl,10px);background:none;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;transition:color .24s var(--ease);"
            + (on ? "color:var(--pill-ink)" : "color:var(--dim)"),
          pick: () => this.setState({miniTab:t[0]})};
      }),
      miniHasRecent: st.thread.length > 0,
      miniRecent: st.thread.length > 0 ? [{title: (st.thread.find(m => m.role === "user") || {}).text || "Recent conversation",
        date: new Date().toLocaleDateString("en-GB"), open: () => this.setState({page:"Home", miniOpen:false})}] : [],
      miniEmpty: st.miniThread.length === 0,
      miniGreeting: (() => { const h = new Date().getHours();
        const g = h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 22 ? "Good evening" : "Still going";
        return g + ", " + coreSnap.q.viewer.person.name.split(" ")[0]; })(),
      miniSuggestions: [
        {label:"What changed today?", run:() => this.askMini("What changed today?")},
        {label:"What needs my decision?", run:() => this.askMini("What needs my decision?")},
        {label:"Any data quality issues?", run:() => this.askMini("Any data quality issues?")}
      ],
      miniWorkSections: (() => {
        const q = coreSnap.q;
        const mine = q.tasks({ignoreScope:true}).filter(t => t.assigneeId === q.viewer.person.id && q.isOpenTask(t))
          .sort((a, b) => (a.dueAt || "9").localeCompare(b.dueAt || "9")).slice(0, 4);
        const decisions = waitingOnMe(q);
        const items = attention(q).slice(0, 3);
        const tasksOpen = (st.miniWorkOpen || "tasks") === "tasks";
        const decOpen = st.miniWorkOpen === "decisions";
        const notifsOpen = st.miniWorkOpen === "notifications";
        const toggle = (key) => () => this.setState(prev => ({miniWorkOpen: prev.miniWorkOpen === key ? null : key}));
        const wrap = "background:var(--surface);border:1px solid var(--border);border-radius:var(--card-r,18px);overflow:hidden";
        return [
          {num:"01", title:"My tasks", icon:"M5 6.5h2l1.4 1.4L11 5.5 M5 12.5h2l1.4 1.4 2.6-2.4 M5 18.5h2l1.4 1.4 2.6-2.4 M15 6.5h4 M15 12.5h4 M15 18.5h4",
            statusText:mine.length + " open", statusColor:"var(--accent)", open:tasksOpen, toggle:toggle("tasks"),
            isEmpty:mine.length === 0, emptyText:"Nothing assigned to you.",
            rows: mine.map(t => ({isCheck:true, title:t.title, hasTag: q.isOverdue(t), tag:"Overdue",
              tagStyle:"flex:none;padding:2px 9px;border-radius:var(--chip-r,6px);font-size:11px;background:var(--bad-soft);color:var(--bad)"})),
            hasLink:true, linkLabel:"All tasks", linkGo: () => { this.setState({miniOpen:false}); this.navTo({page:"Work", section:"tasks"}); },
            wrapStyle: wrap},
          {num:"02", title:"Decisions", icon:"M12 3.6 19.5 6v6.1c0 4-3.1 6.9-7.5 8.3-4.4-1.4-7.5-4.3-7.5-8.3V6L12 3.6Z M9.2 12.2l2 2 3.6-3.7",
            statusText:decisions.length + " waiting", statusColor:"var(--warn)", open:decOpen, toggle:toggle("decisions"),
            isEmpty:decisions.length === 0, emptyText:"No decisions waiting on you.",
            rows: decisions.slice(0, 4).map(a => { const r = coreSnap.core.data.requests.find(x => x.id === a.requestId); return {isCheck:false, title:(r ? r.ref + " " + r.title : "Request"), hasTag:false}; }),
            hasLink:true, linkLabel:"Approvals", linkGo: () => { this.setState({miniOpen:false}); this.navTo({page:"Work", section:"approvals"}); },
            wrapStyle: wrap},
          {num:"03", title:"Needs attention", icon:"M12 4a5.5 5.5 0 0 0-5.5 5.5v3.2L5 16h14l-1.5-3.3V9.5A5.5 5.5 0 0 0 12 4Z M9.8 19a2.2 2.2 0 0 0 4.4 0",
            statusText:attention(q).length + " open", statusColor:"var(--bad)", open:notifsOpen, toggle:toggle("notifications"),
            isEmpty:items.length === 0, emptyText:"Nothing needs attention.",
            rows: items.map(i => ({isCheck:false, title:i.title + ": " + i.reason, hasTag:false})),
            hasLink:true, linkLabel:"Activity", linkGo: () => { this.setState({miniOpen:false}); this.navTo({page:"Activity", section:"attention"}); },
            wrapStyle: wrap}
        ];
      })(),
      miniThread: st.miniThread.map(m => ({
        text:m.text,
        wrapStyle: "display:flex;margin-bottom:12px;" + (m.role === "user" ? "justify-content:flex-end" : "justify-content:flex-start"),
        bubbleStyle: "max-width:84%;padding:11px 14px;font-size:13px;line-height:1.6;border-radius:"
          + (m.role === "user" ? "16px 16px 5px 16px" : "16px 16px 16px 5px") + ";"
          + (m.role === "user" ? "background:var(--accent-fill,var(--accent));color:var(--on-accent);box-shadow:var(--accent-glow,none)"
                               : "background:var(--surface);border:1px solid var(--border);color:var(--body)")
      })),
      miniDraft: st.miniDraft,
      setMiniDraft: (e) => this.setState({miniDraft:e.target.value}),
      onMiniKey: (e) => { if (e.key === "Enter" && st.miniDraft.trim()) this.askMini(st.miniDraft.trim()); },
      sendMini: () => { if (st.miniDraft.trim()) this.askMini(st.miniDraft.trim()); },

      /* agent builder */
      builderOpen: st.builderOpen,
      closeBuilder: () => { clearInterval(this._trainTimer); this.setState({builderOpen:false, training:false}); },
      openBuilder: () => this.setState({page:"Agents", builderOpen:true, builderMode:"new", trained:false, training:false, trainPhase:0, briefThread:[], briefDraft:"", briefPicks:{}, tuneThread:[], tuneDraft:"", sysPrompt:undefined,
        agentSpec:{name:"", shape:"crown-pebble", tint:"#191c1f", persona:"", personality:"Straight-talking",
               answer:"Short answers", context:["Organisations","Tasks"], skills:["Search records","Summarise activity"], tasks:[]}}),
      openBuilderForAgent: () => this.setState({builderOpen:true, builderMode:"tune", trained:true, training:false, trainPhase:0, briefThread:[], briefDraft:"", briefPicks:{}, tuneThread:[], tuneDraft:"", sysPrompt:undefined,
        agentSpec:{name:activeAgent.name, shape:activeAgent.shape || "crown-pebble", tint:activeAgent.tint || "#191c1f",
               persona:activeAgent.role, personality:"Straight-talking", answer:"Short answers",
               context:["Organisations","Tasks","Records"], skills:["Search records","Summarise activity","Draft request"], tasks:[]}}),
      draftAgent: {name:st.agentSpec.name, persona:st.agentSpec.persona,
        shape:st.agentSpec.shape, tint:st.agentSpec.tint, state:"working",
        shapeLabel: (FACE_SHAPES.find(s => s[0] === st.agentSpec.shape) || FACE_SHAPES[0])[1]},
      builderHint: st.builderMode === "tune" ? "SAMPLE AGENT · NO AI MODEL CONNECTED" : "NEW AGENT · NOT SAVED YET",
      isTune: st.builderMode === "tune",
      isNewAgent: st.builderMode !== "tune",
      faceTopStyle: st.builderMode === "tune" ? "margin-top:24px" : "",
      syncStats: [
        {value:String(store.get().core.config.recordTypes.length), label:"RECORD TYPES"},
        {value:String(store.get().q.records().length), label:"RECORDS IN SCOPE"},
        {value:"None", label:"AI MODEL"}
      ],
      sysPrompt: this.systemPrompt(),
      setSysPrompt: (e) => this.setState({sysPrompt:e.target.value}),
      sysMeta: "DRAFT FROM TEMPLATE",
      sysTokens: String(Math.max(1, Math.round(this.systemPrompt().length / 4))).replace(/\B(?=(\d{3})+$)/g, ",") + " tokens",
      sysLines: this.systemPrompt().split("\n").length + " lines",
      sysEdited: st.sysPrompt !== undefined && st.sysPrompt !== null,
      sysClean: st.sysPrompt === undefined || st.sysPrompt === null,
      revertPrompt: () => this.setState({sysPrompt:null, tuneThread:[]}),
      retrain: () => this.startTraining(),
      tuneCount: (st.tuneThread || []).filter(m => m.role === "you").length,
      tuneCountLabel: (st.tuneThread || []).filter(m => m.role === "you").length + " change"
        + ((st.tuneThread || []).filter(m => m.role === "you").length === 1 ? "" : "s"),
      /* Concrete starting points beat an instruction paragraph — one tap writes
         the line into the prompt the same way typing it would. */
      quickTunes: [
        "Always name the account in the first line",
        "Stop mentioning margin",
        "Flag anything past its deadline to me first",
        "Keep answers to three sentences"
      ].map(q => ({label:q, apply: () => { this.setState({tuneDraft:q}, () => this.sendTune()); }})),
      tuneDraft: st.tuneDraft || "",
      setTuneDraft: (e) => this.setState({tuneDraft:e.target.value}),
      onTuneKey: (e) => { if (e.key === "Enter" && !e.shiftKey){ e.preventDefault(); this.sendTune(); } },
      sendTune: () => this.sendTune(),
      hasTuneThread: (st.tuneThread || []).length > 0,
      noTuneThread: (st.tuneThread || []).length === 0,
      tuneThread: (st.tuneThread || []).map(m => ({
        text:m.text,
        rowStyle: "display:flex;justify-content:" + (m.role === "you" ? "flex-end" : "flex-start") + ";animation:expandIn .3s var(--ease) both",
        bubbleStyle: "max-width:94%;padding:8px 11px;border-radius:var(--r-sm,9px);font-size:12px;line-height:1.45;"
          + (m.role === "you"
              ? "background:var(--surface-strong);border:1px solid var(--border);color:var(--ink);border-bottom-right-radius:5px"
              : "background:var(--accent-faint);border:1px solid var(--accent-line);color:var(--ink);border-bottom-left-radius:5px")
      })),
      setAgentName: (e) => this.setSpec({name:e.target.value}),
      setPersona: (e) => this.setSpec({persona:e.target.value}),
      faceChoices: FACE_SHAPES.map(sh => {
        const on = st.agentSpec.shape === sh[0];
        return {shape:sh[0], label:sh[1], state:"working", tint:st.agentSpec.tint,
          style: "display:flex;align-items:center;justify-content:center;padding:6px;border-radius:8px;cursor:pointer;"
            + "transition:background .2s var(--ease),border-color .2s var(--ease),transform .2s var(--ease);"
            + (on ? "background:var(--accent-faint);border:1px solid var(--accent);transform:translateY(-1px)"
                  : "background:var(--surface);border:1px solid var(--border)"),
          pick: () => this.setSpec({shape:sh[0]})};
      }),
      tintChoices: FACE_TINTS.map(t => {
        const on = st.agentSpec.tint === t[0];
        return {label:t[1],
          style: "width:32px;height:32px;border-radius:var(--r-ctl,11px);cursor:pointer;padding:0;"
            + "background:linear-gradient(160deg," + t[0] + ",#0b0d0f);"
            + "transition:transform .2s var(--ease),border-color .2s var(--ease);"
            + (on ? "border:2px solid var(--accent);transform:scale(1.08)" : "border:1px solid var(--border)"),
          pick: () => this.setSpec({tint:t[0]})};
      }),
      personalities: PERSONALITIES.map(p => ({label:p, style:chip(st.agentSpec.personality === p), pick: () => this.setSpec({personality:p})})),
      answerStyles: ANSWER_STYLES.map(a => ({label:a, style:chip(st.agentSpec.answer === a), pick: () => this.setSpec({answer:a})})),
      /* ---- skills: every registered tool in one list. Context is not a choice —
         an agent reads the whole ontology, and anything with an effect still
         waits for a yes, so grouping by effect earned nothing here. ---- */
      skills: SKILL_DEFS.map(d => {
        const on = st.agentSpec.skills.indexOf(d[0]) > -1;
        return {label:d[0], style: chip(on), toggle: () => this.toggleSpecList("skills", d[0])};
      }),
      skillCount: st.agentSpec.skills.length + " of " + SKILL_DEFS.length + " granted",
      grantAllSkills: () => this.setState(prev => ({agentSpec: Object.assign({}, prev.agentSpec,
        {skills: prev.agentSpec.skills.length === SKILL_DEFS.length ? [] : SKILL_DEFS.map(d => d[0])})})),
      grantAllSkillsLabel: st.agentSpec.skills.length === SKILL_DEFS.length ? "Clear all" : "Grant all",

      /* ---- the brief: you say the job, it asks the follow-ups ---- */
      briefDraft: st.briefDraft || "",
      briefPlaceholder: (st.briefThread || []).length ? "Answer, or add another job" : "What do you want this agent to do?",
      setBriefDraft: (e) => this.setState({briefDraft:e.target.value}),
      onBriefKey: (e) => { if (e.key === "Enter" && !e.shiftKey){ e.preventDefault(); this.sendBrief(); } },
      sendBrief: () => this.sendBrief(),
      briefEmpty: (st.briefThread || []).length === 0,
      briefThread: (st.briefThread || []).map((m, i) => {
        if (m.kind === "card"){
          const q = BRIEF_QUESTIONS[m.q];
          const picks = st.briefPicks[m.q] || [];
          return {isCard:true, isMsg:false, title:q.title, sub:q.sub,
            live: !m.done, answered: m.done === true,
            answerSummary: picks.length ? picks.join(", ") : "Skipped",
            rowStyle: "animation:expandIn .3s var(--ease) both",
            cardStyle: "width:100%;background:var(--surface-strong);border:1px solid var(--border);border-radius:var(--card-r,18px);overflow:hidden;"
              + (m.done ? "opacity:.72" : ""),
            confirmLabel: picks.length ? "Use these " + picks.length : "Skip",
            confirm: () => { if (!m.done) this.confirmBrief(m.q); },
            options: q.options.map((o, oi) => {
              const on = picks.indexOf(o[0]) > -1;
              return {key: String.fromCharCode(65 + oi), label:o[0], meta:o[1],
                style: "display:flex;align-items:center;gap:11px;width:100%;padding:10px 12px;border:0;"
                  + (oi ? "border-top:1px solid var(--border);" : "")
                  + "background:" + (on ? "var(--accent-faint)" : "none") + ";cursor:pointer;text-align:left;"
                  + "transition:background .16s var(--ease)",
                keyStyle: "flex:none;width:20px;height:20px;border-radius:7px;display:flex;align-items:center;justify-content:center;"
                  + "font-family:" + MONO + ";font-size:9.5px;"
                  + (on ? "background:var(--accent-fill,var(--accent));color:var(--on-accent);box-shadow:var(--accent-glow,none)" : "background:var(--surface-2);color:var(--faint)"),
                labelStyle: "display:block;font-size:13px;color:" + (on ? "var(--ink)" : "var(--body)"),
                pick: () => { if (!m.done) this.pickBrief(m.q, o[0]); }};
            })};
        }
        return {isCard:false, isMsg:true, text:m.text,
          rowStyle: "display:flex;justify-content:" + (m.role === "you" ? "flex-end" : "flex-start") + ";animation:expandIn .3s var(--ease) both",
          bubbleStyle: "max-width:82%;padding:10px 14px;border-radius:var(--card-r,18px);font-size:13px;line-height:1.5;"
            + (m.role === "you"
                ? "background:var(--surface-strong);border:1px solid var(--border);color:var(--ink);border-bottom-right-radius:6px"
                : "background:var(--accent-faint);border:1px solid var(--accent-line);color:var(--ink);border-bottom-left-radius:6px")};
      }),
      briefTasks: (st.agentSpec.tasks || []).map((t, i) => ({
        title:t.title, meta:t.meta,
        remove: () => this.setState(prev => ({agentSpec: Object.assign({}, prev.agentSpec,
          {tasks: prev.agentSpec.tasks.filter((_, k) => k !== i)})}))
      })),
      hasTasks: (st.agentSpec.tasks || []).length > 0,
      taskCount: (st.agentSpec.tasks || []).length + " job" + ((st.agentSpec.tasks || []).length === 1 ? "" : "s") + " briefed",

      /* ---- training run ---- */
      trainBg: st.trained ? "var(--accent-faint)" : "var(--surface)",
      trainBorder: st.trained ? "var(--accent-line)" : "var(--border)",
      trainTitle: st.training ? "Preparing (simulated)" : st.trained ? "Sample setup ready" : "Prepare a sample setup",
      trainBody: st.training
        ? TRAIN_PHASES[Math.min(st.trainPhase || 0, TRAIN_PHASES.length - 1)][0]
        : st.trained
          ? "A draft instruction was written from your brief and this organisation's terminology. No AI model is connected, so nothing was learned."
          : "Writes a draft instruction from your brief and the configured terminology. This is a simulation: no AI model is connected.",
      trainLabel: st.training ? "Preparing" : st.trained ? "Prepare again" : "Prepare",
      trainBusy: st.training === true,
      trainIdle: st.training !== true,
      trainPct: Math.round(((st.trainPhase || 0) / TRAIN_PHASES.length) * 100) + "%",
      trainDashStyle: "stroke-dashoffset:" + (145 * (1 - (st.trainPhase || 0) / TRAIN_PHASES.length)).toFixed(1)
        + ";transition:stroke-dashoffset .85s cubic-bezier(.22,.9,.16,1)",
      trainPhaseLabel: st.training
        ? "PHASE " + Math.min((st.trainPhase || 0) + 1, TRAIN_PHASES.length) + " OF " + TRAIN_PHASES.length
        : "READY",
      train: () => this.startTraining(),
      trainSteps: st.trained || st.training,
      trainLog: TRAIN_PHASES.slice(0, st.training ? (st.trainPhase || 0) : TRAIN_PHASES.length).map((p, i) => ({
        text:p[0], meta:p[1], dot:LIME,
        rowStyle: "display:flex;align-items:center;gap:10px;animation:expandIn .28s var(--ease) both"
      })),
      builderFooter: (() => {
        const jobs = (st.agentSpec.tasks || []).length;
        return "Full ontology context · every registered tool · "
          + (jobs ? jobs + " job" + (jobs === 1 ? "" : "s") + " briefed" : "nothing briefed yet")
          + " · anything with an effect waits for your yes";
      })(),
      saveLabel: st.builderMode === "tune" ? "Save changes" : "Create agent",
      /* A new agent is saved into the shared configuration, so it appears on the
         Agents page and in Settings > Agent controls. Administrators only. */
      saveAgent: () => {
        const prev = this.state;
        if (prev.builderMode === "tune") { this.setState({builderOpen:false}); return; }
        const name = prev.agentSpec.name.trim() || "New agent";
        const snap = store.get();
        const res = store.run(coreOps.updateConfig, (c) => {
          c.agents.push({id:"ag-" + Date.now().toString(36), name, purpose: prev.agentSpec.persona || "Sample agent created in the agent builder.",
            responsibleId: snap.ctx.viewerId, scope:{teamIds:"all"},
            permittedActions: prev.agentSpec.skills.filter(k => (SKILL_DEFS.find(d => d[0] === k) || [])[1] === "read"),
            approvalRequired: prev.agentSpec.skills.filter(k => (SKILL_DEFS.find(d => d[0] === k) || [])[1] !== "read"),
            shape: prev.agentSpec.shape, tint: prev.agentSpec.tint, enabled:true});
        }, "Added agent " + name);
        if (res.ok) this.setState({builderOpen:false, page:"Agents"});
      },
      /* On the dashboard the KPI band is a solid accent field. Running that
         field up behind the nav bar removes the seam between them; the pill
         goes opaque dark so it still reads on the lime. */
      headerFieldStyle: false && page === "Dashboard"
        /* 70px stopped short of the header's real height, so a hairline of page
           background showed between it and the sticky KPI band once scrolled.
           82px clears the header and laps 8px into the band's own padding. */
        ? "position:absolute;left:0;right:0;top:0;height:76px;z-index:3;pointer-events:none;background:var(--accent)"
        : "display:none",
      headerPillStyle: "display:flex;align-items:center;gap:4px;height:54px;padding:5px;box-sizing:border-box;max-width:100%;min-width:0;overflow:hidden;"
        + ((contextNav.length <= 6 && (st.w - (st.railOpen ? 252 : 68) - 12) >= 780) ? "" : "width:fit-content;margin:0 auto;")
        + "background:var(--surface);border:1px solid var(--border);border-radius:999px;"
        + "backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);"
        + "box-shadow:0 1px 0 rgba(255,255,255,.05) inset,0 10px 30px rgba(0,0,0,.28)",
      headerStyle: "flex:none;display:grid;align-items:center;gap:14px;padding:14px 22px 12px;border-bottom:1px solid var(--border);"
        + "grid-template-columns:minmax(0,1fr) " + (mid ? "minmax(150px,340px)" : "44px") + " minmax(0,1fr)",
      barOpen: st.barOpen,
      railShut: !st.railOpen,
      kpiBackdrop: this.props.dashboardBackdrop || this.props.kpiBackdrop || "#5f8f63",
      // One colour from App.tsx repaints the Records wash (and the New record
      // dialog). It is blended into the theme's own --bg, so the same colour
      // reads right in dark and light themes. Unset keeps the theme gradient.
      rootVars: this.props.recordsBackdrop ? (() => {
        const c = this.props.recordsBackdrop;
        const m = (pct) => "color-mix(in oklab, " + c + " " + pct + "%, var(--bg))";
        return {"--hero-grad": "linear-gradient(180deg," + m(10) + " 0%," + m(28) + " 20%," + m(55) + " 42%," + m(90) + " 62%," + m(48) + " 83%," + m(12) + " 100%)"};
      })() : undefined,
      kpiBackdropOn: st.theme !== "light" && this.props.kpiBackdropOn !== false,
      railThumbStyle: "position:absolute;z-index:0;pointer-events:none;border-radius:14px;"
        + "background:var(--rail-active,var(--accent-faint));box-shadow:var(--rail-active-ring,inset 0 0 0 1px var(--accent-line));"
        + (st.railThumb
            ? "left:" + st.railThumb.l + "px;top:0;width:" + st.railThumb.w + "px;height:" + st.railThumb.h + "px;"
              + "transform:translateY(" + st.railThumb.t + "px);opacity:1;"
              + (st.railThumbLive ? "transition:transform .55s cubic-bezier(.3,1.25,.4,1),width .3s var(--ease),height .3s var(--ease),left .3s var(--ease),opacity .2s" : "transition:none")
            : "opacity:0"),
      pageDy: (st.navDir === -1 ? "-22px" : "22px"),
      pageSweepEl: React.createElement("span", {key:"sweep" + (st.navSeq || 0), style:{position:"absolute", left:0, right:0, top:0, height:1, zIndex:6, pointerEvents:"none",
        background:"linear-gradient(90deg,transparent,var(--accent) 40%,var(--accent) 60%,transparent)",
        animation:(st.navSeq ? "pageSweep .8s cubic-bezier(.4,0,.2,1) both" : "none"), opacity:(st.navSeq ? 1 : 0)}}),
      // Hover: the dot eases a few px right and deepens; the arrow slips out
      // through its right edge while a twin slides in from the left.
      setBtnIn: () => this.setState({setBtnHover:true}),
      setBtnOut: () => this.setState({setBtnHover:false}),
      // Hover: the dot un-rolls leftward into a darker capsule behind the label,
      // the mixer knobs slide to new levels, one sheen passes, the arrow swaps.
      setDotStyle: "position:absolute;z-index:1;right:5px;top:5px;bottom:5px;border-radius:999px;"
        + "background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--accent-line);"
        + "width:" + (st.setBtnHover ? "calc(100% - 10px)" : "36px") + ";"
        + "transition:width .62s cubic-bezier(.65,0,.15,1)",
      setSheen: "position:absolute;z-index:1;top:0;bottom:0;left:0;width:45%;pointer-events:none;"
        + "background:linear-gradient(100deg,transparent,rgba(255,255,255,.1),transparent);"
        + "transform:translateX(" + (st.setBtnHover ? "260%" : "-120%") + ") skewX(-18deg);"
        + "transition:" + (st.setBtnHover ? "transform .9s cubic-bezier(.3,0,.2,1) .1s" : "none"),
      setIconStyle: "position:relative;z-index:2;flex:none;overflow:visible;transition:color .4s var(--ease);color:" + (st.setBtnHover ? "var(--accent)" : "var(--dim)"),
      setKnobA: "transition:transform .55s cubic-bezier(.34,1.4,.5,1);transform:translateY(" + (st.setBtnHover ? "-6px" : "0") + ")",
      setKnobB: "transition:transform .55s cubic-bezier(.34,1.4,.5,1) .06s;transform:translateY(" + (st.setBtnHover ? "9px" : "0") + ")",
      setKnobC: "transition:transform .55s cubic-bezier(.34,1.4,.5,1) .12s;transform:translateY(" + (st.setBtnHover ? "-5px" : "0") + ")",
      setArrowA: "position:absolute;left:50%;top:50%;margin:-7.5px 0 0 -7.5px;"
        + "transform:translateX(" + (st.setBtnHover ? "22px" : "0") + ");opacity:" + (st.setBtnHover ? "0" : "1") + ";"
        + "transition:transform .45s cubic-bezier(.5,0,.2,1),opacity .3s var(--ease)",
      setArrowB: "position:absolute;left:50%;top:50%;margin:-7.5px 0 0 -7.5px;"
        + "transform:translateX(" + (st.setBtnHover ? "0" : "-22px") + ");opacity:" + (st.setBtnHover ? "1" : "0") + ";"
        + "transition:transform .45s cubic-bezier(.22,.9,.16,1) " + (st.setBtnHover ? ".08s" : "0s") + ",opacity .3s var(--ease) " + (st.setBtnHover ? ".08s" : "0s"),
      showTeam: (st.w - (st.railOpen ? 252 : 68)) >= (contextNav.length >= 5 ? 1500 : 1000) || contextNav.length <= 3,
      showTheme: (st.w - (st.railOpen ? 252 : 68)) >= 820 || contextNav.length <= 3,
      tabPad: this.tabsTight(st, contextNav.length) ? (contextNav.length >= 6 ? "0 9px" : "0 11px")
        : (st.w - (st.railOpen ? 252 : 68)) >= 1100 ? "0 18px" : (st.w - (st.railOpen ? 252 : 68)) >= 1000 ? "0 12px" : "0 10px",
      _tabs: (() => { const tight = this.tabsTight(st, contextNav.length);
        contextNav.forEach(t => { t.showCount = !!t.count && !tight; }); return 0; })(),
      tabsLoose: !(this.tabsTight(st, contextNav.length)),
      tabsTight: this.tabsTight(st, contextNav.length),
      tabActiveBg: (this.tabsTight(st, contextNav.length)) ? "var(--surface-2)" : "none",
      searchWrapFlex: ((contextNav.length <= 3 && (st.w - (st.railOpen ? 252 : 68) - 12) >= 780) || (contextNav.length <= 5 && st.w >= 1600)) ? "1 1 auto" : "0 0 auto",
      barLabel: st.barOpen ? "Collapse the bar" : "Expand the bar",
      barChevronStyle: "transition:transform .3s var(--ease);transform:rotate(" + (st.barOpen ? "0deg" : "180deg") + ")",
      toggleBar: () => this.setState(prev => ({barOpen: !prev.barOpen})),
      // The scope control already says where you are, so the hint only shows with spare room.
      showHint: roomy && st.barOpen && contextNav.length <= 2 && st.w >= 1500,
      showSearchText: mid && st.barOpen,
      showProfileText: roomy,
      // Tabs size to their own labels; NavThumb measures, so equal tracks aren't needed.
      navGroupStyle: "position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:max-content;"
        + "width:max-content;max-width:100%;align-items:center;padding:0;flex:" + (contextNav.length <= 3 ? "none" : "0 1 auto") + ";min-width:0;border-radius:999px;"
        + "overflow-x:auto;overflow-y:hidden;scrollbar-width:none;overscroll-behavior-x:contain;"
        + "-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 14px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 14px),transparent)",
      // Static look only. NavThumb measures the active tab and writes its own
      // width and offset, so long labels, counts or an overflowing group can't
      // push the pill off the tab it belongs to.
      navThumb: "position:absolute;left:0;top:0;bottom:0;width:0;z-index:0;pointer-events:none;border-radius:999px;opacity:0;"
        + "background-color:var(--surface-2);box-shadow:0 1px 0 rgba(255,255,255,.05) inset,0 4px 12px rgba(0,0,0,.35);"
        + "background-image:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0) 55%);background-blend-mode:overlay;"
        + "transition:transform .46s cubic-bezier(.22,.9,.16,1),width .46s cubic-bezier(.22,.9,.16,1),opacity .2s",
      navThumbKey: contextNav.map(t => (t.active ? "*" : "") + t.label).join("|"),
      searchStyle: "height:38px;justify-self:center;min-width:0;" + (mid ? "width:100%;padding:0 8px 0 15px;" : "width:44px;justify-content:center;padding:0;"),
      // The bar is one row: the fewer sub-nav segments a page has, the more of the
      // leftover width the search field takes.
      searchExpanded: (contextNav.length <= 3 && (st.w - (st.railOpen ? 252 : 68) - 12) >= 780) || (contextNav.length <= 5 && st.w >= 1600),
      searchBarStyle: (() => {
        const segs = contextNav.length;
        // No min-width floor: when the sub-nav pill group is wide, the search
        // must be free to shrink rather than overflow its centring parent and
        // slide under the nav.
        const cap = segs <= 2 ? 520 : segs <= 4 ? 440 : 340;
        // A real floor so the label always fits — the sub-nav group is now
        // shrinkable, so this comes out of its slack, not out of an overflow.
        const collapsed = !((segs <= 3 && (st.w - (st.railOpen ? 252 : 68) - 12) >= 780) || (segs <= 5 && st.w >= 1600));
        if (collapsed) return "flex:none;width:42px;height:42px;display:flex;align-items:center;justify-content:center;padding:0;margin:0 2px;"
          + "background:var(--track);border:1px solid transparent;border-radius:999px;cursor:pointer;color:var(--body);"
          + "transition:border-color .2s var(--ease),color .2s var(--ease)";
        return "flex:1 1 auto;width:100%;min-width:0;max-width:" + cap + "px;height:42px;"
          + "display:flex;align-items:center;gap:9px;padding:0 6px 0 15px;margin:0 2px;"
          + "background:var(--track);border:1px solid transparent;border-radius:999px;"
          + "box-shadow:0 1px 2px rgba(0,0,0,.22) inset;"
          + "cursor:pointer;color:var(--body);"
          + "transition:border-color .2s var(--ease),color .2s var(--ease),background .2s var(--ease),max-width .3s var(--ease)";
      })(),
      settingsStyle: railStyle(page === "Settings") + ";animation:railIn .42s var(--ease) 300ms both",
      settingsGlyphStyle: glyphStyle(page === "Settings", st.hovered === "__settings"),
      settingsHovered: st.hovered === "__settings",
      // Live: renderVals reads the real clock every render, and a 1s ticker
      // (Home page only) is what makes a render happen when no one is typing.
      closeNotifs: () => this.setState({showNotifs:false}),
      homeEyebrow: (() => {
        const live = st.agents.filter(a => a.state === "working" || a.state === "thinking").length;
        return (live ? live + " AGENTS RUNNING" : "NO AGENTS RUNNING") + " · SYNCED 2 MIN AGO";
      })(),
      homeSubline: "Ask about any record, task or decision you can see in " + scopeLabel(coreSnap.core, coreSnap.session.scope) + ".",
      approvalsPill: (() => { const n = waitingOnMe(coreSnap.q).length; return n + (n === 1 ? " DECISION" : " DECISIONS") + " WAITING ON YOU"; })(),
      goApprovals: () => this.navTo({page:"Work", section:"approvals"}),
      /* Home canvas: a decorative layer the user can switch, scoped to the
         empty chat view so it never competes with a live thread. */
      homeCanvasStyle: (() => {
        const bgs = {
          none: "",
          bloom: "background:radial-gradient(60% 48% at 50% 34%, var(--accent-faint), transparent 72%), radial-gradient(44% 38% at 16% 84%, rgba(255,255,255,.05), transparent 70%)",
          mist: "background:radial-gradient(52% 44% at 24% 22%, rgba(255,255,255,.07), transparent 70%), radial-gradient(56% 46% at 80% 76%, rgba(255,255,255,.05), transparent 72%)",
          grid: "background-image:linear-gradient(var(--border) 1px, transparent 1px),linear-gradient(90deg, var(--border) 1px, transparent 1px);background-size:56px 56px;mask-image:radial-gradient(62% 56% at 50% 46%, #000, transparent 78%);-webkit-mask-image:radial-gradient(62% 56% at 50% 46%, #000, transparent 78%)"
        };
        const key = st.homeBg || "bloom";
        const def = BG_DEFS.find(b => b.id === key);
        const css = def ? def.css : (st.homeBgCss || bgs[key] || "");
        return "position:absolute;top:-24px;bottom:-24px;left:-24px;right:-24px;z-index:0;pointer-events:none;overflow:hidden;opacity:"
          + (st.thread.length ? ".35" : "1") + ";transition:opacity .4s var(--ease);" + css;
      })(),
      bgMenuOpen: false,
      toggleBgMenu: () => this.setState({bgGalleryOpen:true, bgSpot:null}),
      bgGallery: (() => {
        const cur = st.homeBg || "bloom";
        const ups = st.bgUploads || [];
        const cats = ["Signature","Gradient","Abstract","Your photos"];
        const active = st.bgCat || "Signature";
        const pickOf = (id, css) => () => this.setState({homeBg:id, homeBgCss: css === undefined ? null : css});
        let tiles;
        if (active === "Your photos"){
          tiles = ups.map((u, i) => ({
            id:"up" + i, name:"Photo " + (i + 1), isUpload:false,
            thumbStyle:"position:absolute;inset:0;background:url(" + u + ") center/cover",
            on: cur === "up" + i,
            pick: pickOf("up" + i, "background:url(" + u + ") center/cover")}));
        } else {
          tiles = BG_DEFS.filter(b => b.cat === active).map(b => ({
            id:b.id, name:b.name, isUpload:false,
            thumbStyle:"position:absolute;inset:0;" + b.thumb,
            on: cur === b.id,
            pick: pickOf(b.id, b.css)}));
        }
        const spot = st.bgSpot;
        return {
          open: !!st.bgGalleryOpen,
          close: () => this.setState({bgGalleryOpen:false, bgSpot:null}),
          cats: cats.map(c => ({label:c, count: c === "Your photos" ? String(ups.length) : String(BG_DEFS.filter(b => b.cat === c).length),
            style:"height:30px;padding:0 13px;border-radius:var(--r-ctl,10px);cursor:pointer;font-size:12.5px;white-space:nowrap;transition:background .2s var(--ease),color .2s var(--ease),border-color .2s var(--ease);"
              + (c === active ? "background:var(--accent);border:1px solid var(--accent);color:var(--on-accent);font-weight:500"
                              : "background:var(--surface-2);border:1px solid var(--border);color:var(--dim)"),
            pick: () => this.setState({bgCat:c})})),
          isPhotos: active === "Your photos",
          emptyPhotos: active === "Your photos" && ups.length === 0,
          tiles,
          currentName: (BG_DEFS.find(b => b.id === cur) || {}).name || (cur.indexOf("up") === 0 ? "Your photo" : "None"),
          heroStyle: "position:absolute;inset:0;" + ((BG_DEFS.find(b => b.id === cur) || {}).thumb || (st.homeBgCss || "background:var(--surface-2)")),
          /* the spotlight follows the pointer across the whole grid */
          onMove: (e) => {
            const r = e.currentTarget.getBoundingClientRect();
            this.setState({bgSpot:{x: Math.round(e.clientX - r.left), y: Math.round(e.clientY - r.top)}});
          },
          onLeave: () => this.setState({bgSpot:null}),
          spotStyle: "position:absolute;inset:0;z-index:2;pointer-events:none;transition:opacity .3s var(--ease);opacity:"
            + (spot ? "1" : "0") + ";background:radial-gradient(220px circle at "
            + (spot ? spot.x + "px " + spot.y + "px" : "50% 50%")
            + ", var(--accent-faint), transparent 72%)",
          onUpload: (e) => { this.readBgFile(e.target.files && e.target.files[0]); e.target.value = ""; },
          onDragOver: (e) => { e.preventDefault(); if (!st.bgDrag) this.setState({bgDrag:true}); },
          onDragLeave: (e) => { e.preventDefault(); this.setState({bgDrag:false}); },
          onDrop: (e) => {
            e.preventDefault();
            this.setState({bgDrag:false});
            const dt = e.dataTransfer;
            const f = dt && dt.files && dt.files[0];
            if (f) this.readBgFile(f);
          },
          dragging: !!st.bgDrag,
          dropHint: st.bgDrag ? "Drop to use this image" : "Click to choose, drop a file, or paste"
        };
      })(),
      bgButtonStyle: "width:26px;height:26px;border:1px solid var(--border);border-radius:var(--r-ctl,9px);background:var(--surface);backdrop-filter:blur(16px);color:var(--faint);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:color .2s var(--ease),border-color .2s var(--ease)",
      bgPlusStyle: "transition:transform .3s var(--ease);" + (st.bgMenuOpen ? "transform:rotate(45deg)" : ""),
      bgOptions: [["bloom","Bloom","radial-gradient(circle at 40% 35%, var(--accent), #16181a)"],
                  ["mist","Mist","radial-gradient(circle at 40% 35%, rgba(255,255,255,.55), #16181a)"],
                  ["grid","Grid","repeating-linear-gradient(0deg,#2b2e2c 0 1px,#16181a 1px 4px)"],
                  ["none","None","#16181a"]].map(o => {
        const on = (st.homeBg || "bloom") === o[0];
        return {label:o[1],
          style: "display:flex;align-items:center;gap:9px;width:100%;height:28px;padding:0 10px 0 7px;border:0;border-radius:var(--r-ctl,10px);cursor:pointer;font-size:12px;text-align:left;white-space:nowrap;transition:background .18s var(--ease),color .18s var(--ease);"
            + (on ? "background:var(--surface-2);color:var(--ink)" : "background:none;color:var(--dim)"),
          swatch: "width:15px;height:15px;flex:none;border-radius:6px;border:1px solid " + (on ? "var(--accent-line)" : "var(--border)") + ";background:" + o[2],
          pick: () => this.setState({homeBg:o[0]})};
      }),
      greetingPrefix: (() => {
        const h = new Date().getHours();
        const pool = h < 5 ? ["Still up","Burning the midnight oil"]
          : h < 12 ? ["Good morning","Rise and grind","Morning"]
          : h < 17 ? ["Good afternoon","Afternoon"]
          : h < 22 ? ["Good evening","Evening"]
          : ["Still going","Night owl mode"];
        // A goofy one about 1 in 5 times, otherwise the plain greeting — picked
        // once per hour and cached, so it doesn't flip on every re-render.
        const goofy = ["Top of the morning","Look who it is","Well if it isn't"];
        const bucket = Math.floor(Date.now() / 3600000);
        if (this._greetBucket !== bucket) {
          this._greetBucket = bucket;
          const useGoofy = bucket % 5 === 0;
          const list = useGoofy ? pool.concat(goofy) : pool;
          this._greetPick = list[Math.floor(Math.random() * list.length)];
        }
        return this._greetPick;
      })(),
      greetingName: coreSnap.q.viewer.person.name.split(" ")[0],
      /* Management view keeps the same Home shell with a smaller greeting. */
      homeCompact: (() => {
        if (coreSnap.session.homeView) return coreSnap.session.homeView === "management";
        const roles = coreSnap.q.viewer.roles.map(r => r.roleId);
        const top = roles.includes("admin") ? "admin" : roles.includes("team_manager") ? "team_manager" : "contributor";
        return ((coreSnap.core.config.roleLayouts[top] || {}).homeView) === "management";
      })(),
      flipUnits: this.buildFlipUnits(BODY, INK, LIME),
      enterSettings: (e) => this.hover("__settings", "Settings", "", e),
      leaveSettings: () => this.unhover("__settings"),
      // Always mounted: the resting state is the visible one, so the reveal is a
      // transition off a real style rather than an animation supplying the end frame.
      hoverLabel: {
        label: st.hoverLabel, hint: st.hoverHint,
        style: labelStyle(st.hovered !== null, st.hoverTop)
      },
      isChat: page === "Home",
      page,
      section: this.sectionOf(page),
      setSection: (id) => this.setSection(page, id),
      isModulePage: !!(pageDef(page) && pageDef(page).module),
      pagesAsTabs: st.pagesAsTabs !== false && st.w >= 900,
      togglePagesAsTabs: () => this.setState(p => {
        const next = p.pagesAsTabs === false;
        try { localStorage.setItem("pulse.pagesAsTabs", next ? "1" : "0"); } catch (e) {}
        return {pagesAsTabs: next};
      }),
      dashArea: this.sectionOf("Dashboard"),
      setDashArea: (id) => this.setSection("Dashboard", id),
      homeMode: this.sectionOf("Home"),
      setHomeMode: (id) => this.setSection("Home", id),
      isWork: page === "Work",
      isSettings: page === "Settings",
      inboxCount: String(notificationFeed.length),
      heliosEmpty: st.thread.length === 0,
      threadOpen: st.thread.length > 0,
      threadTitle: st.thread.length ? st.thread[0].text : "",
      thread: st.thread.map((m, idx) => {
        const isHelios = m.role === "helios";
        // The reveal is derived from a word counter in state, so a re-render or a
        // hot reload can never leave a message stuck mid-stream.
        const text = isHelios ? m.full : m.text;
        const done = isHelios;

    return {
          isUser: m.role === "user", isHelios, text, typing:false,
          hasTool: isHelios, tool:m.tool || "", toolEffect: m.effect ? "· " + m.effect : "",
          toolDot: m.effect === "write" ? AMBER : LIME,
          hasTable: done && !!m.cols,
          cols:m.cols || [], tableCols: m.cols ? "1.6fr 1fr .85fr .9fr" : "1fr",
          rows:(m.rows || []).map(r => ({cells:r.map((v,i) => ({v, color: i===0 ? INK : DIM, font: i===0 ? "inherit" : MONO}))})),
          hasConfirm: done && m.confirm === true,
          confirmSummary: m.confirmSummary || "",
          confirmHash: "sha256 a4f19c…",
          hasActions: done && m.confirm !== true && !!m.actions,
          actions:(m.actions || []).map(a => ({label:a[0], bg:a[1] ? LIME : "none", color:a[1] ? "var(--on-accent)" : "var(--ink)", border:a[1] ? LIME : "var(--border)", run:() => this.ask(a[0])}))
        };
      }),
      suggestions: [
        {label:"What is overdue?", run:() => this.ask("What is overdue?")},
        {label:"Which decisions are waiting on me?", run:() => this.ask("Which decisions are waiting on me?")},
        {label:"Any data quality issues?", run:() => this.ask("Any data quality issues?")}
      ],

      /* Cards, not rows: each one lands on its own spring, newest first, with
         the status colour carried into a soft glow behind its marker. */
      notifications: notificationFeed.slice(0,6).map((n, i) => ({
        dot:n.dot, text:n.text, when:n.meta, event:n.event, open:n.open,
        cardStyle: "position:relative;flex:none;display:flex;align-items:flex-start;gap:11px;padding:13px 15px;border-radius:var(--r-md,16px);cursor:pointer;"
          + "background:var(--surface);border:1px solid var(--border);"
          + "transition:background .2s var(--ease),border-color .2s var(--ease),transform .22s var(--ease);"
          + "animation:notifCard .62s cubic-bezier(.16,1,.28,1) " + (110 + i * 62) + "ms both",
        washStyle: "position:absolute;left:0;top:0;bottom:0;width:58%;pointer-events:none;border-radius:var(--r-md,16px) 0 0 16px;"
          + "background:linear-gradient(90deg," + n.dot + "14, transparent 78%)",
        dotStyle: "position:relative;width:7px;height:7px;border-radius:50%;flex:none;margin-top:5px;background:" + n.dot
          + ";box-shadow:0 0 10px " + n.dot + ";animation:notifDot .56s cubic-bezier(.16,1,.3,1) " + (200 + i * 62) + "ms both"
      })),
      paletteOpen: st.paletteOpen, showNotifs: st.showNotifs, query: st.query, draft: st.draft,
      noResults: results.length === 0,
      palScopes, hasQuery: q.length > 0, askPreview: q ? '"' + q + '"' : "",
      palIsHome: !q, palPage, palFrequent, palRecentRows, palJump,
      palPageLabel: page.toUpperCase(),
      palHasRecent: recentRaw.length > 0,
      palClearRecent: () => this.setState({palRecent:[], palSel:0}),
      palFooter: q ? total + (total === 1 ? " RESULT" : " RESULTS") : "TYPE TO SEARCH EVERYTHING",
      askRowStyle: rowBase + (askActive ? ";background:var(--surface);box-shadow:inset 2px 0 0 var(--accent)" : ""),
      askIconStyle: "flex:none;width:26px;height:26px;border-radius:var(--r-sm,9px);display:flex;align-items:center;justify-content:center;border:1px solid var(--accent-line);background:var(--pill-bg);color:var(--accent)",
      hoverAsk: () => { if (st.palSel !== 0) this.setState({palSel:0}); },
      askHelios: () => this.ask(q),
      clearQuery: () => this.setState({query:"", palSel:0}),
      setDraft: (e) => this.setState({draft:e.target.value}),
      onDraftKey: (e) => { if (e.key === "Enter" && !e.shiftKey){ e.preventDefault(); if (st.draft.trim()) this.ask(st.draft.trim()); } },
      onQueryKey: (e) => {
        const n = q ? total : homeCount, cur = q ? sel : homeSel;
        if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)){ e.preventDefault(); this.setState({palSel: n ? (cur + 1) % n : 0}); return; }
        if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)){ e.preventDefault(); this.setState({palSel: n ? (cur - 1 + n) % n : 0}); return; }
        if (e.key === "Enter"){
          e.preventDefault();
          if ((e.metaKey || e.ctrlKey) && q) { this.ask(q); return; }
          const target = flat[q ? sel : homeSel];
          if (target) target();
          else if (q) this.ask(q);
        }
      },
      send: () => { if (st.draft.trim()) this.ask(st.draft.trim()); },
      newThread: () => { clearInterval(this._t); this.setState({thread:[], typed:0, draft:""}); },
      setQuery: (e) => this.setState({query:e.target.value, palSel:0}),
      openPalette: () => this.openPalette(),
      closePalette: () => this.setState({paletteOpen:false, query:"", palSel:0}),
      stop: (e) => e.stopPropagation(),
      theme: st.theme,
      themeLabel: st.theme === "light" ? "Switch to dark" : "Switch to light",
      themeIcon: st.theme === "light"
        ? "M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.5 8.5 0 1 0 20.2 15.4Z"
        : "M12 4.2V2.6 M12 21.4v-1.6 M4.2 12H2.6 M21.4 12h-1.6 M6.5 6.5 5.4 5.4 M18.6 18.6l-1.1-1.1 M6.5 17.5l-1.1 1.1 M18.6 5.4l-1.1 1.1 M12 16.6a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2Z",
      /* The two glyphs are stacked and swapped, so the control shows which way
         it is going rather than redrawing a thin outline. */
      sunStyle: "position:absolute;inset:0;transition:transform .42s cubic-bezier(.16,1,.3,1),opacity .26s var(--ease);"
        + (st.theme === "light" ? "transform:none;opacity:1;color:var(--accent)" : "transform:rotate(-80deg) scale(.55);opacity:0"),
      moonStyle: "position:absolute;inset:0;transition:transform .42s cubic-bezier(.16,1,.3,1),opacity .26s var(--ease);"
        + (st.theme === "light" ? "transform:rotate(80deg) scale(.55);opacity:0" : "transform:none;opacity:1"),
      // Back from light returns to whichever dark theme you were on, not the base "dark".
      toggleTheme: () => this.setState(p => p.theme === "light"
        ? {theme: p.darkTheme || this.props.theme || "harbour"}
        : {theme: "light", darkTheme: p.theme}),
      toggleNotifs: () => this.setState({showNotifs:!st.showNotifs}),
      /* Home: the widget rail steps away once a conversation starts, so the
         thread gets the full width — brought back on demand, not automatically. */
      showRail: st.thread.length === 0 || st.chatRailPinned,
      toggleChatRail: () => this.setState(prev => ({chatRailPinned: !prev.chatRailPinned})),
      chatRailLabel: st.chatRailPinned ? "Hide widgets" : "Widgets",
      chatScrollStyle: st.thread.length
        ? "flex:1 1 0;min-height:0;overflow-y:auto;display:flex;flex-direction:column"
        : "flex:0 0 auto;display:flex;flex-direction:column",
      chatColumnStyle: "position:relative;z-index:1;flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;"
        + "transition:max-width .38s var(--ease)",
      threadWidthStyle: "flex:0 0 auto;width:100%;margin:0 auto;padding:14px 4px 8px;"
        + "max-width:" + (st.thread.length && !st.chatRailPinned ? "880px" : "760px") + ";"
        + "transition:max-width .38s var(--ease)",
      composerTools: [
        {label:"Records", icon:ICONS.navRecords, go: () => this.setState({page:"Records"})},
        {label:"Files", icon:ICONS.files, go: () => this.setState({page:"Records", recSection:"files"})},
        {label:"Agents", icon:ICONS.navAgents, go: () => this.setState({page:"Agents"})}
      ],
      composerPrompts: [
        {label:"What changed in the last day?", tag:"BRIEFING", icon:ICONS.insights,
          run: () => this.ask("What changed in the last day?")},
        {label:"Which decisions are waiting on me?", tag:"DECISIONS", icon:ICONS.approvals,
          run: () => this.ask("Which decisions are waiting on me?")},
        {label:"What is overdue?", tag:"WORK", icon:ICONS.work,
          run: () => this.ask("What is overdue?")}
      ].map((p, i) => Object.assign(p, {
        rowStyle: "display:flex;align-items:center;gap:13px;width:100%;padding:10px 14px;background:none;border:0;"
          + (i ? "border-top:1px solid var(--border);" : "")
          + "color:var(--body);font-size:13.5px;text-align:left;cursor:pointer;transition:background .18s var(--ease),color .18s var(--ease)"
      })),
      showPrompts: st.promptsHidden !== true,
      promptsStyle: (() => {
        const w = st.thread.length ? (st.chatRailPinned ? "760px" : "880px") : "600px";
        return "width:100%;max-width:" + w + ";margin:0 auto;animation:" + (st.promptsFading ? "fadeOutUp .26s var(--ease) both" : "rowIn .34s var(--ease) both");
      })(),
      hidePrompts: () => { this.setState({promptsFading:true}); setTimeout(() => this.setState({promptsHidden:true, promptsFading:false}), 240); },
      composerShellStyle: "background:var(--surface);border:1px solid var(--border);border-radius:var(--card-r,18px);backdrop-filter:blur(22px) saturate(1.35);box-shadow:0 18px 44px rgba(0,0,0,.34);overflow:hidden;transition:border-color .22s var(--ease),box-shadow .3s var(--ease)",
      composerWidthStyle: "width:100%;margin:0 auto;"
        + "max-width:" + (st.thread.length ? (st.chatRailPinned ? "760px" : "880px") : "600px") + ";"
        + "transition:max-width .38s var(--ease)",
      goSettings: () => this.go("Settings")
    };
  }
}
