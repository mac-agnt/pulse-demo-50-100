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
  CONTACTS,
  FILE_TREE,
  ONTO_NODES,
  ONTO_EDGES,
  REC_TEMPLATES,
  REC_TEMPLATE_CATS,
  PEOPLE,
  ROLE_LEVELS,
  PERM_KEYS,
  GRANT_DEFS,
  ROLE_SCOPES,
  DEFAULT_PERMS,
  INTEGRATIONS,
  BG_DEFS,
  THEMES,
  ADMIN_ICONS,
  ADMIN_CARDS,
  ADMIN_GROUPS,
  SRC_TINT,
  SRC_ABBR,
  STREAM_DEFS,
  NAV as NAV_RAW,
  ITEMS,
  ORDER,
  synthesizeCustomArea,
  pickAnswer,
  ORGS,
  AGENT_DEFS,
  KPI_DEFS,
  ASPECT_DEFS,
  FILTER_GROUPS,
  OPS_DEFS,
  OPS_FILTERS,
  WORK_SECTIONS,
  WORK_TASKS,
  WORKFLOWS,
  SCHEDULES,
  WIDGET_DEFS,
  WORK_WIDGETS,
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

/* ── Locked layout ──────────────────────────────────────────────────────────
   These two rules hold for every client build, whatever data.js says:
   1. Records always opens on Ontology, and Ontology is always the first tab.
      If a customisation drops or renames it, the stock Ontology tab is put back.
   2. Agents always sits directly under Home in the side rail.
   Re-theme and re-label freely; don't remove these guards. */
const ONTOLOGY_SECTION = {id:"ontology", label:"Ontology", blurb:"How every record connects: entities, predicates and the paths between them."};
const REC_SECTIONS = [REC_SECTIONS_RAW.find(s => s.id === "ontology") || ONTOLOGY_SECTION]
  .concat(REC_SECTIONS_RAW.filter(s => s.id !== "ontology"));
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
  state = { w: typeof window === "undefined" ? 1440 : window.innerWidth, theme:"harbour", page:"Home", draft:"", query:"", thread:[], typed:0, paletteOpen:false, showNotifs:false, palScope:"All", palSel:0, palRecent:["Dunne & Sons Ltd","Credit Control"],
            done:{}, resolved:{}, approved:{}, inboxFilter:"All", approvalFilter:"Awaiting you", open:null, range:"30d",
            workDoc:null, workDocTab:"work",
            queue:"mine", recordTab:"Overview", record:"person", hovered:null, hoverLabel:"", hoverHint:"", hoverTop:0,
            flags:{approvals:true, automations:true, insights:true, customEntities:false, whatsapp:true, composio:false},
            workSection:"tasks", workViews:{}, addedTasks:[], newTask:"", newPriority:"Medium",
            timerRunning:false, timerTask:null, timerPreset:null, scheduleOff:{},
            adminCard:null, adminFlags:{},
            adminOpen:null, adminFlags:{}, adminGroup:null,
            actPaused:false, actHover:null, actKpi:"all", actQuery:"", actOpen:null, actTick:0,
            recSection:"ontology", recAsk:"", treeOpen:true, treeExpanded:{}, treeFile:"fl-1", treeQuery:"",
            ontoNode:"Organisation", ontoHover:null, ontoLayout:"Force",
            newRecOpen:false, newRecName:"", newRecTemplate:"Field sheet", newRecCat:"All",
            opsFilter:"all", opsOff:{}, opsOpen:null, opsScope:"week", opsDay:26, opsOrder:null, opsDrag:null,
            opsBuilderOpen:false, opsBuilderMode:"workflow", builderText:"", builderGenerated:false,
            railOpen:true, barOpen:true, chatRailPinned:false, widgetEdit:false, widgets:["inbox","work","activity"],
            kpiEdit:false, kpiKeys:["revenue","cash","overdue","margin","jobs"],
            aspect:"sales", filterMenuOpen:false, customFilter:"", extraFilters:[],
            workWidget:"queue", miniOpen:false, miniThread:[], miniDraft:"", miniTab:"chat", miniTone:"plain", miniWorkOpen:"tasks",
            agents:AGENT_DEFS, agentId:"briefing", groupNames:{}, agentQuery:"", agentDraft:"", agentExtra:{},
            builderOpen:false, builderMode:"new", trained:false, training:false, trainPhase:0,
            briefThread:[], briefDraft:"", briefPicks:{},
            agentSpec:{name:"", shape:"crown-pebble", tint:"#191c1f", persona:"", personality:"Straight-talking",
                   answer:"Short answers", context:["Organisations","Tasks"], skills:["Search records","Summarise activity"], tasks:[]} };

  /* One event per stream on its own cadence, so the three columns never move in
     lockstep. A hovered column and a paused view are both simply skipped. */
  seedActivity(){
    const now = Date.now();
    this._actId = 0;
    const seed = (def, count) => def.pool.slice(0, count).map((e, i) => this.mkEvent(def, e, now - (i + 1) * def.every * 1.4));
    this.feeds = {};
    STREAM_DEFS.forEach(d => { this.feeds[d.id] = seed(d, 5); this._actCursor = 0; });
    this._nextPush = {};
    STREAM_DEFS.forEach(d => { this._nextPush[d.id] = now + d.every * (0.4 + Math.random() * 0.6); });
  }

  mkEvent(def, tpl, at){
    const status = tpl[5];
    return {id: "e" + (++this._actId), stream: def.id, title: tpl[0], note: tpl[1],
      actor: tpl[2], rel: tpl[3], src: tpl[4], status,
      progress: status === "working" ? 8 + Math.random() * 22 : 100,
      at: at === undefined ? Date.now() : at, fresh: at === undefined};
  }

  tickActivity(){
    if (!this.feeds) return;
    const now = Date.now();
    let dirty = false;
    for (const def of STREAM_DEFS){
      const list = this.feeds[def.id];
      for (const e of list){
        if (e.status === "working"){
          e.progress = Math.min(100, e.progress + 2.4 + Math.random() * 3);
          if (e.progress >= 100){ e.status = "completed"; dirty = true; }
        }
        if (e.fresh && now - e.at > 1400){ e.fresh = false; dirty = true; }
      }
      if (this.state.actPaused || this.state.actHover === def.id) continue;
      if (now >= this._nextPush[def.id]){
        const tpl = def.pool[Math.floor(Math.random() * def.pool.length)];
        list.unshift(this.mkEvent(def, tpl));
        if (list.length > 7) list.pop();
        this._nextPush[def.id] = now + def.every * (0.7 + Math.random() * 0.7);
        dirty = true;
      }
    }
    if (dirty || now - (this._actStamp || 0) > 900){
      this._actStamp = now;
      try { this.setState({actTick: now}); } catch (e) {}
    }
  }

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
    const now = new Date();
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
            ? "\u201c" + text + "\u201d — I can do that. First, what should it cover?"
            : "Noted. One more: when should it land?"});
        thread.push({kind:"card", q:asked, done:false});
      } else {
        thread.push({kind:"msg", role:"agent", text:"Added. Train me and I will write my own prompt from the records you granted."});
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
        thread.push({kind:"msg", role:"agent", text:"That is enough to work from. Train me and I will write my own prompt from the records you granted."});
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
      + "This client says merchant, not organisation, and job, not task. Money is in euro.\n"
      + "Never act on anything with an effect. Propose it and wait for a yes.";
  }
  sendTune(){
    const text = (this.state.tuneDraft || "").trim();
    if (!text) return;
    this.setState(prev => ({
      tuneDraft:"",
      tuneThread: (prev.tuneThread || []).concat([
        {role:"you", text},
        {role:"agent", text:"Done — I pinned that to my prompt. It takes effect on the next run."}
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

  componentDidMount(){
    requestAnimationFrame(() => this.syncRailThumb());
    setTimeout(() => this.syncRailThumb(), 700);
    setTimeout(() => { const nav = document.querySelector('nav[data-rail-nav]');
      if (nav && window.ResizeObserver){ this._railRO = new ResizeObserver(() => this.syncRailThumb()); this._railRO.observe(nav); } }, 50);
    this.seedActivity();
    if (this.state.page === "Dashboard") this.startKpiCount();
    this._actTimer = setInterval(() => { if (this.state.page === "Activity") this.tickActivity(); }, 700);
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
      const onGraph = this.state.page === "Records" && this.state.recSection === "ontology";
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
      if (this.state.page !== "Records" || this.state.recSection !== "ontology") return;
      const stale = !this._beat || performance.now() - this._beat > 600;
      this._startLoop(stale);
    }, 250);
    this._startLoop(true);
    this._resize = () => this.setState({w: window.innerWidth});
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
  componentWillUnmount(){ window.removeEventListener("paste", this._paste); window.removeEventListener("resize", this._resize); window.removeEventListener("keydown", this._key); clearInterval(this._t); clearInterval(this._clockTimer); clearInterval(this._flapBoot); cancelAnimationFrame(this._raf); clearInterval(this._fallback); clearInterval(this._actTimer); clearInterval(this._kpiTimer); }

  ask(q){
    const a = pickAnswer(q);
    const words = a.text.split(" ").length;
    const thread = this.state.thread.concat([
      {role:"user", text:q},
      {role:"helios", full:a.text, words, tool:a.tool, effect:a.effect, cols:a.cols, rows:a.rows, actions:a.actions, confirm:a.confirm, confirmSummary:a.confirmSummary}
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
  componentDidUpdate(){ this.syncRailThumb(); }

  go(page){
    const order = NAV.filter(n => !n.divider).map(n => n.page).concat(["Settings"]);
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
    const a = pickAnswer(q);
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
        {kind:"agent", text:"on it. i'll come back when there's something to decide — nothing that changes a record goes through without your yes."}
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
    const openKeys = ORDER.filter(k => !st.resolved[k]);

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
    const nav = NAV.map((n, idx) => n.divider
      ? {isDivider:true, isItem:false}
      : {isItem:true, isDivider:false, label:n.label, hint: railOpen ? (n.hint || "") : "", d:ICONS[n.icon],
         dot: n.dot === true && openKeys.length > 0,
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

    const workSec = WORK_SECTIONS.find(s => s.id === st.workSection) || WORK_SECTIONS[0];
    const workView = st.workViews[workSec.id] || workSec.views[0];
    const allWorkTasks = st.addedTasks.concat(WORK_TASKS);
    const openWork = allWorkTasks.filter(t => !(st.done[t.id] !== undefined ? st.done[t.id] : t.done));
    /* ---- the operations control room ---- */
    const opsOn = (w) => st.opsOff[w.id] === undefined ? w.on : !st.opsOff[w.id];
    const opsStatusOf = (w) => opsOn(w) ? w.status : "paused";
    const STATUS_TINT = {
      healthy:[GREEN, "var(--ok-soft)", "Healthy"],
      approval:[AMBER, "var(--warn-soft)", "Approval needed"],
      failed:[RED, "var(--bad-soft)", "Failed"],
      paused:[DIM, "var(--track)", "Paused"]
    };
    const KIND_LABEL = {routine:"AGENT ROUTINE", automation:"AUTOMATION", report:"SCHEDULED REPORT", task:"RECURRING TASK"};
    const opsMatch = (w) => st.opsFilter === "all" ? true
      : st.opsFilter === "active" ? opsOn(w)
      : st.opsFilter === "attention" ? (w.status === "failed" || w.status === "approval")
      : st.opsFilter === "approval" ? w.status === "approval"
      : st.opsFilter === "failed" ? w.status === "failed"
      : st.opsFilter === "dueToday" ? /tomorrow|:|today/i.test(w.next)
      : w.kind === st.opsFilter;
    const opsVisible = OPS_DEFS.filter(opsMatch);
    const savedHours = OPS_DEFS.reduce((n, w) => n + parseInt(w.saved, 10), 0);

    const opsModel = {
      columns: ["Workflow", "Trigger", "Owner", "Next run", "Status", ""],
      empty: opsVisible.length === 0,
      create: () => this.setState({opsBuilderOpen:true, opsBuilderMode:"workflow", builderText:"", builderGenerated:false}),
      schedule: () => this.setState({opsBuilderOpen:true, opsBuilderMode:"schedule", builderText:"", builderGenerated:false}),
      teach: () => this.setState({opsBuilderOpen:true, opsBuilderMode:"teach", builderText:"", builderGenerated:false}),
      summary: [
        ["Active", String(OPS_DEFS.filter(opsOn).length), "active"],
        ["Due today", String(OPS_DEFS.filter(w => /tomorrow|:|today/i.test(w.next)).length), "dueToday"],
        ["Needs attention", String(OPS_DEFS.filter(w => w.status === "failed" || w.status === "approval").length), "attention"],
        ["Time saved", savedHours + "h", "all"]
      ].map(s => {
        const on = st.opsFilter === s[2] && s[2] !== "all";
        return {label:s[0].toUpperCase(), value:s[1],
          active: on, inactive: !on,
          valueColor: s[2] === "attention" ? AMBER : INK,
          pick: () => this.setState({opsFilter: st.opsFilter === s[2] ? "all" : s[2]})};
      }),
      filters: OPS_FILTERS.map(fl => {
        const on = st.opsFilter === fl[0];
        const count = fl[0] === "all" ? OPS_DEFS.length
          : fl[0] === "approval" ? OPS_DEFS.filter(w => w.status === "approval").length
          : fl[0] === "failed" ? OPS_DEFS.filter(w => w.status === "failed").length
          : OPS_DEFS.filter(w => w.kind === fl[0]).length;
        return {label:fl[1], count:String(count), active:on, inactive:!on,
          pick: () => this.setState({opsFilter:fl[0]})};
      }),
      rows: opsVisible.map(w => {
        const tint = STATUS_TINT[opsStatusOf(w)];
        return {
          name:w.name, trigger:w.trigger, owner:w.owner, ownerInitials:w.initials,
          nextRun: opsOn(w) ? w.next : "Paused", lastResult:w.last,
          kindLabel: KIND_LABEL[w.kind], triggerKind: w.triggerKind,
          status: tint[2], statusColor: tint[0],
          statusStyle: "padding:3px 10px;border-radius:var(--r-sm,9px);font-size:11px;width:fit-content;background:" + tint[1] + ";color:" + tint[0],
          rate: w.rate + "%",
          ownerChip: "width:24px;height:24px;flex:none;border-radius:" + (w.ownerKind === "agent" ? "50%" : "8px")
            + ";background:" + (w.ownerKind === "agent" ? "var(--accent)" : "var(--track)")
            + ";color:" + (w.ownerKind === "agent" ? "#0b0c0b" : BODY)
            + ";display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600",
          trackBg: opsOn(w) ? "var(--accent)" : "var(--track)",
          knobLeft: opsOn(w) ? "19px" : "3px",
          knobBg: opsOn(w) ? "var(--on-accent)" : DIM,
          rowBg: st.opsOpen === w.id ? "var(--surface-2)" : "transparent",
          open: () => this.setState({opsOpen:w.id}),
          toggle: (e) => { if (e) e.stopPropagation();
            this.setState(prev => ({opsOff: Object.assign({}, prev.opsOff, {[w.id]: opsOn(w)})})); }
        };
      })
    };

    const DAY_LOAD = {24:2, 25:3, 26:4, 27:5, 28:3, 29:0, 30:1, 31:2};
    // A denser, Google-Calendar-style spread of events across the whole month —
    // not just the last week — so the month grid actually has something in it.
    const MONTH_EVENTS = [
      [2,"o1"], [3,"o6"], [5,"o2"], [6,"o4"], [9,"o3"], [10,"o5"], [12,"o1"], [13,"o6"],
      [16,"o2"], [17,"o4"], [19,"o3"], [20,"o5"], [23,"o1"], [24,"o2"], [24,"o5"],
      [25,"o3"], [25,"o6"], [26,"o1"], [26,"o4"], [26,"o5"], [26,"o2"],
      [27,"o1"], [27,"o2"], [27,"o3"], [27,"o4"], [27,"o5"],
      [28,"o2"], [28,"o6"], [28,"o3"], [29,"o1"],
      [30,"o4"], [30,"o1"], [31,"o5"], [31,"o2"]
    ].map(e => { const w = OPS_DEFS.find(x => x.id === e[1]);
      return w ? {day:e[0], name:w.name, color:STATUS_TINT[opsStatusOf(w)][0]} : null; }).filter(Boolean);
    const eventsFor = (d) => MONTH_EVENTS.filter(e => e.day === d);

    const calModel = {
      monthLabel: st.opsScope === "week" ? "This week · 26 Aug" : "August 2026",
      hint: "Everything Pulse will do on its own, and when.",
      load: (st.opsOrder || ["o5","o2","o3","o10","o4","o6","o9","o8"]).length + " routines",
      scopes: [["week","Week"],["month","Month"]].map(s => ({label:s[1],
        style: "height:26px;padding:0 12px;border:0;border-radius:var(--r-ctl,9px);cursor:pointer;font-size:11.5px;"
          + (st.opsScope === s[0] ? "background:var(--pill-bg);color:var(--pill-ink);font-weight:500;box-shadow:0 2px 5px rgba(0,0,0,.34),0 6px 16px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.5);" : "background:none;color:" + DIM),
        pick: () => this.setState({opsScope:s[0]})})),
      dayNames: ["MON","TUE","WED","THU","FRI","SAT","SUN"],
      cellH: st.opsScope === "week" ? "height:118px" : "height:96px",
      days: (st.opsScope === "week" ? [24,25,26,27,28,29,30]
        : [null,null,null,null,null,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]
      ).map(d => {
        if (d === null) return {date:"", pick:() => {}, chips:[], hasMore:false,
          cellStyle: st.opsScope === "week" ? "height:118px" : "height:96px" + ";border-radius:var(--r-sm,9px);background:none;border:1px dashed var(--border)"};
        const today = d === 26, sel = st.opsDay === d && !today;
        const evs = eventsFor(d);
        const shown = evs.slice(0, st.opsScope === "week" ? 4 : 2);
        const more = evs.length - shown.length;
        return {date:String(d),
          cellStyle: (st.opsScope === "week" ? "height:118px" : "height:96px")
            + ";border-radius:8px;cursor:pointer;padding:7px 8px;display:flex;flex-direction:column;gap:4px;overflow:hidden;"
            + "transition:border-color .2s var(--ease),background .2s var(--ease);"
            + (today ? "background:var(--accent-faint);border:1.5px solid var(--accent)"
              : sel ? "background:var(--surface-2);border:1.5px solid var(--border-strong)"
              : "background:var(--surface-2);border:1px solid var(--border)"),
          numStyle: "flex:none;width:20px;height:20px;border-radius:7px;display:flex;align-items:center;justify-content:center;"
            + "font-family:var(--mono);font-size:11.5px;"
            + (today ? "background:var(--accent-fill,var(--accent));color:var(--on-accent);box-shadow:var(--accent-glow,none);font-weight:600" : "color:var(--body)"),
          chips: shown.map(e => ({label:e.name,
            style: "display:flex;align-items:center;gap:5px;padding:2px 6px;border-radius:var(--chip-r,6px);background:var(--surface);"
              + "font-size:10px;line-height:1.3;color:var(--body);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
              + "border-left:2.5px solid " + e.color})),
          hasMore: more > 0, moreLabel: "+" + more + " more",
          pick: () => this.setState({opsDay:d})};
      }),
      monthTitle: "August 2026",
      monthDays: [null,null,null,null,null,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31].map(d => {
        if (d === null) return {date:"", pick:() => {}, chips:[], hasMore:false, moreLabel:"",
          cellStyle:"min-height:104px;border-radius:var(--r-sm,9px);background:none;border:1px dashed var(--border)"};
        const today = d === 26, sel = st.opsDay === d && !today;
        const evs = eventsFor(d);
        const shown = evs.slice(0, 3);
        const more = evs.length - shown.length;
        return {date:String(d),
          cellStyle: "min-height:104px;border-radius:var(--r-sm,9px);cursor:pointer;padding:8px 9px;display:flex;flex-direction:column;gap:4px;overflow:hidden;"
            + "transition:border-color .2s var(--ease),background .2s var(--ease);"
            + (today ? "background:var(--accent-faint);border:1.5px solid var(--accent)"
              : sel ? "background:var(--surface-2);border:1.5px solid var(--border-strong)"
              : "background:var(--surface-2);border:1px solid var(--border)"),
          numStyle: "flex:none;width:21px;height:21px;border-radius:7px;display:flex;align-items:center;justify-content:center;"
            + "font-family:var(--mono);font-size:12px;"
            + (today ? "background:var(--accent-fill,var(--accent));color:var(--on-accent);box-shadow:var(--accent-glow,none);font-weight:600" : "color:var(--body)"),
          chips: shown.map(e => ({label:e.name,
            style: "display:flex;align-items:center;gap:5px;padding:3px 7px;border-radius:var(--chip-r,6px);background:var(--surface);"
              + "font-size:10.5px;line-height:1.3;color:var(--body);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
              + "border-left:2.5px solid " + e.color})),
          hasMore: more > 0, moreLabel: "+" + more + " more",
          pick: () => this.setState({opsDay:d})};
      }),
      legend: [{label:"Agent routine", bg:"var(--accent)"}, {label:"Automation", bg:"var(--neutral)"}, {label:"Nothing scheduled", bg:"var(--track)"}],
      weekStats: (() => {
        const sched = OPS_DEFS.filter(w => w.triggerKind === "schedule");
        const runs = Object.keys(DAY_LOAD).reduce((n, k) => n + DAY_LOAD[k], 0);
        const hours = OPS_DEFS.reduce((n, w) => n + (parseInt(w.saved, 10) || 0), 0);
        const busiest = Object.keys(DAY_LOAD).reduce((a, b) => DAY_LOAD[b] > DAY_LOAD[a] ? b : a, "24");
        return [
          {label:"Runs this week", value:String(runs), note:"across " + sched.length + " routines"},
          {label:"Busiest day", value:busiest + " Aug", note:DAY_LOAD[busiest] + " scheduled runs"},
          {label:"Needs a person", value:String(OPS_DEFS.filter(w => opsStatusOf(w) === "approval").length), note:"waiting on an approval"},
          {label:"Failing", value:String(OPS_DEFS.filter(w => opsStatusOf(w) === "failed").length), note:"routines to look at"},
          {label:"Time saved", value:hours + "h", note:"per month, all routines"},
          {label:"Median run", value:"31s", note:"across the last 200 runs"}
        ];
      })(),
      nextUp: OPS_DEFS.filter(w => w.triggerKind === "schedule" && opsOn(w)).slice(0, 4).map(w => ({
        name:w.name, when:w.next, owner:w.owner,
        color: STATUS_TINT[opsStatusOf(w)][0]
      })),
      workload: "Expected workload this week: " + Object.keys(DAY_LOAD).reduce((n, k) => n + DAY_LOAD[k], 0) + " runs across " + OPS_DEFS.filter(w => w.triggerKind === "schedule").length + " routines",
      recurring: OPS_DEFS.filter(w => w.triggerKind === "schedule").map(w => {
        const on = opsOn(w);
        return {name:w.name, cadence:w.trigger, owner:w.owner, next: on ? w.next : "Paused",
          tileStyle: "width:30px;height:30px;flex:none;border-radius:var(--r-sm,11px);display:flex;align-items:center;justify-content:center;"
            + (on ? "background:var(--accent-faint);color:var(--accent)" : "background:var(--track);color:" + DIM),
          trackBg: on ? "var(--accent)" : "var(--track)",
          knobLeft: on ? "19px" : "3px",
          knobBg: on ? "var(--on-accent)" : DIM,
          toggle: () => this.setState(prev => ({opsOff: Object.assign({}, prev.opsOff, {[w.id]: on})}))};
      }),
      agendaTitle: st.opsDay === 26 ? "Today" : "Wed " + st.opsDay + " Aug",
      dragHint: true,
      agenda: (st.opsOrder || ["o5","o2","o3","o10","o4","o6","o9","o8"]).map(id => OPS_DEFS.find(w => w.id === id)).filter(Boolean).map(w => ({
        time: (w.trigger.match(/\d{2}:\d{2}/) || ["—"])[0],
        name:w.name, owner:w.owner,
        color: STATUS_TINT[opsStatusOf(w)][0],
        opacity: st.opsDrag === w.id ? "0.5" : "1",
        drag: () => this.setState({opsDrag:w.id}),
        over: (e) => e.preventDefault(),
        drop: (e) => { e.preventDefault();
          this.setState(prev => {
            const order = (prev.opsOrder || ["o5","o2","o3","o10","o4","o6","o9","o8"]).slice();
            const from = order.indexOf(prev.opsDrag), to = order.indexOf(w.id);
            if (from < 0 || to < 0 || from === to) return {opsDrag:null};
            order.splice(to, 0, order.splice(from, 1)[0]);
            return {opsOrder:order, opsDrag:null};
          }); }
      }))
    };

    const detailDef = OPS_DEFS.find(w => w.id === st.opsOpen);
    const detailModel = detailDef ? (() => {
      const tint = STATUS_TINT[opsStatusOf(detailDef)];
      return {
        open:true, name:detailDef.name, kindLabel:KIND_LABEL[detailDef.kind],
        status:tint[2], statusStyle: "padding:3px 10px;border-radius:var(--r-sm,9px);font-size:11px;background:" + tint[1] + ";color:" + tint[0],
        what:detailDef.what, why:detailDef.why,
        close: () => this.setState({opsOpen:null}),
        facts: [
          {k:"OWNER", v:detailDef.owner, color:INK},
          {k:"TRIGGER", v:detailDef.trigger, color:INK},
          {k:"NEXT RUN", v: opsOn(detailDef) ? detailDef.next : "Paused", color:INK},
          {k:"LAST RUN", v:detailDef.runs[0][0], color:INK},
          {k:"SUCCESS RATE", v:detailDef.rate + "%", color: detailDef.rate > 90 ? GREEN : AMBER},
          {k:"TIME SAVED", v:detailDef.saved, color:INK}
        ],
        steps: detailDef.steps.map((s, i, arr) => ({
          n: String(i + 1), verb:s[0], detail:s[1], isGate: s[2] === "gate",
          gateColor: AMBER,
          dotBg: s[2] === "gate" ? "var(--warn-soft)" : i === 0 ? "var(--accent)" : "var(--surface-2)",
          dotBorder: s[2] === "gate" ? "var(--warn-soft)" : i === 0 ? "var(--accent)" : "var(--border)",
          dotInk: i === 0 ? "var(--on-accent)" : s[2] === "gate" ? AMBER : BODY,
          lineStyle: "flex:1;width:1px;min-height:14px;background:" + (i === arr.length - 1 ? "transparent" : "var(--border)")
        })),
        runs: detailDef.runs.map(r => ({
          started:r[0], duration:r[1], result:r[2], records:r[3], cost:r[4],
          hasError: !!r[5], error:r[5] || "", errorColor:RED,
          dot: r[2] === "ok" ? GREEN : r[2] === "partial" ? AMBER : RED,
          resultStyle: "padding:2px 9px;border-radius:var(--r-sm,9px);font-size:10.5px;"
            + (r[2] === "ok" ? "background:var(--ok-soft);color:" + GREEN
               : r[2] === "partial" ? "background:var(--warn-soft);color:" + AMBER
               : "background:var(--bad-soft);color:" + RED)
        }))
      };
    })() : {open:false, steps:[], runs:[], facts:[]};

    const BUILDER_COPY = {
      workflow: {title:"Create a workflow", hint:"PLAIN ENGLISH FIRST",
        placeholder:"Every Friday, review all open deals. Flag anything inactive for 10 days and prepare a summary for management.",
        examples:["Chase quotes nobody replied to","Warn me before a certificate lapses"], save:"Create workflow"},
      schedule: {title:"Schedule a task", hint:"RECURRING WORK",
        placeholder:"Every Thursday at 9am, check stock against this week's jobs and raise the order lines.",
        examples:["Monthly VAT return reminder","Weekly van checks"], save:"Schedule it"},
      teach: {title:"Teach an agent", hint:"A NEW ROUTINE FOR AN AGENT",
        placeholder:"When an invoice goes past 60 days, tell me what changed about how that customer pays before you draft anything.",
        examples:["Watch payment behaviour","Summarise the week for management"], save:"Teach it"}
    }[st.opsBuilderMode] || {title:"Create a workflow", hint:"PLAIN ENGLISH FIRST", placeholder:"Describe what should happen.", examples:[], save:"Create"};

    const builderModel = {
      open: st.opsBuilderOpen, title:BUILDER_COPY.title, hint:BUILDER_COPY.hint,
      placeholder:BUILDER_COPY.placeholder, saveLabel:BUILDER_COPY.save,
      text: st.builderText, generated: st.builderGenerated,
      generateLabel: st.builderGenerated ? "Rebuild from the description" : "Build it",
      footer: st.builderGenerated ? "Steps with effects always wait for your yes" : "Describe the outcome — Pulse works out the steps",
      examples: BUILDER_COPY.examples.map(e => ({label:e, use: () => this.setState({builderText:e, builderGenerated:false})})),
      setText: (e) => this.setState({builderText:e.target.value}),
      generate: () => this.setState({builderGenerated:true}),
      close: () => this.setState({opsBuilderOpen:false}),
      save: () => this.setState({opsBuilderOpen:false, opsFilter:"all"}),
      blocks: [
        ["TRIGGER", "Every Friday at 17:00", "From “every Friday” in your description", "var(--accent-line)", "var(--accent)"],
        ["FIND", "All open deals with no activity for 10 days", "", "var(--border)", "var(--faint)"],
        ["CONDITION", "Skip deals already marked won or lost", "", "var(--border)", "var(--faint)"],
        ["ACTION", "Flag each one and write a management summary", "", "var(--border)", "var(--faint)"],
        ["AGENT", "Sales Agent", "It already has the deal context", "var(--border)", "var(--faint)"],
        ["APPROVAL", "None — nothing leaves Pulse", "Add one if you want it emailed out", "var(--warn-soft)", AMBER],
        ["ON FAILURE", "Retry twice, then tell Operations", "", "var(--border)", "var(--faint)"],
        ["NOTIFY", "Post to Home and the management group", "", "var(--border)", "var(--faint)"]
      ].map(b => ({label:b[0], value:b[1], note:b[2], border:b[3], labelColor:b[4], edit: () => {}}))
    };

    /* ---- records: contacts, files, ontology ---- */
    const recSec = REC_SECTIONS.find(s => s.id === st.recSection) || REC_SECTIONS[0];
    const askQ = st.recAsk.trim().toLowerCase();
    const TAG_TINT = {staff:[LIME,""], customer:[BODY,""], supplier:[BODY,""],
      watch:[AMBER,""], "on stop":[RED,""]};
    const askTerms = askQ ? askQ.split(/\s+/).filter(w => w.length > 2 &&
      ["the","and","for","who","any","anyone","all","are","with","from","that","show","find","list","get","people","contact","contacts"].indexOf(w) < 0) : [];
    const matchedContacts = CONTACTS.filter(c => {
      if (!askTerms.length) return true;
      const hay = c.slice(0, 5).join(" ").toLowerCase();
      return askTerms.some(t => hay.indexOf(t) > -1);
    });

    const treeOpen = st.treeOpen;
    const expanded = st.treeExpanded;
    const activeFile = FILE_TREE.find(r => r.id === st.treeFile) || FILE_TREE.find(r => r.type === "file");
    const fileQ = st.treeQuery.trim().toLowerCase();
    const fileHits = fileQ
      ? FILE_TREE.filter(r => r.type === "file" && (r.name + " " + (r.body || []).join(" ")).toLowerCase().indexOf(fileQ) > -1).length
      : 0;
    const treeRows = FILE_TREE.filter(r => r.type === "folder" || expanded[r.parent] !== false).map(r => {
      if (r.type === "folder"){
        return {isFolder:true, isFile:false, name:r.name, pad:"9px",
          count: String(FILE_TREE.filter(x => x.parent === r.id).length),
          rot: expanded[r.id] === false ? "0deg" : "90deg",
          toggle: () => this.setState(prev => ({treeExpanded: Object.assign({}, prev.treeExpanded,
            {[r.id]: prev.treeExpanded[r.id] === false})}))};
      }
      const on = activeFile && r.id === activeFile.id;
      const dim = fileQ && (r.name + " " + (r.body || []).join(" ")).toLowerCase().indexOf(fileQ) < 0;
      return {isFolder:false, isFile:true, name:r.name, indexed:r.indexed,
        fileStyle: "width:100%;display:flex;align-items:center;gap:8px;padding:7px 9px 7px 26px;border:0;border-radius:8px;"
          + "cursor:pointer;font-size:12px;text-align:left;transition:background .18s var(--ease),color .18s var(--ease);"
          + (on ? "background:var(--accent-faint);color:var(--ink)"
                : dim ? "background:none;color:var(--faint)" : "background:none;color:var(--body)"),
        pick: () => this.setState({treeFile:r.id})};
    });

    const ontoKind = {entity:["var(--accent)", INK], ledger:["var(--neutral)", BODY],
      module:["#9fd6f0", INK], predicate:["transparent", DIM]};
    const ontoSel = ONTO_NODES.find(n => n[0] === st.ontoNode) || ONTO_NODES[0];

    const HERO = {
      contacts:{eyebrow:"CONTACTS · " + CONTACTS.length + " ON FILE", title:"Everyone you deal with",
        blurb:"Staff and external in one place. Ask in your own words — it matches on name, role, organisation and tag.",
        placeholder:"Try “buyers in Cork”, “installers”, “on stop”…", kind:"KEYWORD", scroll:"SCROLL FOR THE FULL LIST",
        suggestions:["on stop","installer","Casey","supplier"]},
      files:{eyebrow:"FILES · " + FILE_TREE.filter(r => r.type === "file").length + " DOCUMENTS",
        title:"Everything on record", blurb:"Contracts, certificates and invoices. Indexed pages are the ones Helios can read from.",
        placeholder:"Search inside every document…", kind:"FULL TEXT", scroll:"SCROLL FOR THE VIEWER",
        suggestions:["credit","expiry","framework","invoice"]},
      ontology:{eyebrow:"ONTOLOGY", title:"Ontology", blurb:recSec.blurb,
        placeholder:"", kind:"", scroll:"", suggestions:[]}
    }[recSec.id];

    const recModel = {
      title: HERO.title, blurb: HERO.blurb,
      eyebrow: HERO.eyebrow, askPlaceholder: HERO.placeholder,
      searchKind: HERO.kind, scrollHint: HERO.scroll,
      hasHero: page === "Records" && recSec.id !== "ontology",
      isContacts: page === "Records" && recSec.id === "contacts",
      isFiles: page === "Records" && recSec.id === "files",
      isOntology: page === "Records" && recSec.id === "ontology",
      openNew: () => this.setState({newRecOpen:true, newRecName:"", newRecTemplate:"Field sheet"}),
      // On Files the hero field IS the in-file search, so there is only ever one
      // search box on the page and it always drives what is shown below.
      ask: recSec.id === "files" ? st.treeQuery : st.recAsk,
      asking: recSec.id === "files" ? fileQ.length > 0 : askTerms.length > 0,
      notAsking: recSec.id === "files" ? fileQ.length === 0 : askTerms.length === 0,
      setAsk: (e) => this.setState(recSec.id === "files" ? {treeQuery:e.target.value} : {recAsk:e.target.value}),
      clearAsk: () => this.setState(recSec.id === "files" ? {treeQuery:""} : {recAsk:""}),
      askAnswer: recSec.id === "files"
        ? (fileHits ? fileHits + " of " + FILE_TREE.filter(r => r.type === "file").length + " documents contain that" : "No document contains that")
        : (matchedContacts.length
          ? matchedContacts.length + " of " + CONTACTS.length + " match — on name, role, organisation and tag"
          : "Nothing matched. It searches name, role, organisation and tag only."),
      askTerms,
      askSuggestions: HERO.suggestions.map(s => ({label:s,
        use: () => this.setState(recSec.id === "files" ? {treeQuery:s} : {recAsk:s})})),
      contactCols: ["Name","Role","Email","Organisation","Tag"],
      tableCaption: askTerms.length
        ? "Filtered by " + askTerms.map(t => "“" + t + "”").join(" or ")
        : "Staff, customers and suppliers as one set of records.",
      tableBadge: matchedContacts.length + " / " + CONTACTS.length,
      tableFooter: "Showing " + matchedContacts.length + " of " + CONTACTS.length + " contacts",
      contactsEmpty: matchedContacts.length === 0,
      contacts: matchedContacts.map(c => {
        const tint = TAG_TINT[c[4]] || [BODY,""];
        return {name:c[0], role:c[1], email:c[2], org:c[3], tag:c[4], bg:c[5],
          initials: c[0].split(" ").map(w => w[0]).slice(0,2).join(""),
          tagStyle: "padding:3px 11px;border-radius:var(--r-sm,9px);font-size:11px;background:var(--chip);border:1px solid var(--chip-border);color:" + tint[0],
          open: () => this.setState({recSection:"files"})};
      })
    };

    const treeModel = {
      open: treeOpen, closed: !treeOpen, rows: treeRows,
      toggle: () => this.setState(prev => ({treeOpen: !prev.treeOpen})),
      query: st.treeQuery,
      setQuery: (e) => this.setState({treeQuery:e.target.value}),
      searching: fileQ.length > 0,
      hits: fileQ ? fileHits + " MATCHING" : "",
      meta: activeFile ? (activeFile.indexed ? "INDEXED" : "NOT INDEXED") : "",
      path: activeFile ? activeFile.path : "",
      fileTitle: activeFile ? activeFile.title : "",
      facts: activeFile ? activeFile.facts.map(k => ({k:k[0], v:k[1]})) : [],
      body: activeFile ? activeFile.body : [],
      links: activeFile ? activeFile.links.map(l => ({label:l[0],
        open: () => this.setState({recSection: l[1] === "person" || l[1] === "org" ? "contacts" : "ontology"})})) : []
    };

    /* ---- admin ---- */
    const SEV = {high:RED, medium:AMBER, low:DIM};
    const adminCard = ADMIN_CARDS.find(c => c.id === st.adminOpen) || ADMIN_CARDS[0];
    const badgeTint = (kind) => kind === "bad" ? "background:var(--bad-soft);color:" + RED
      : kind === "warn" ? "background:var(--warn-soft);color:" + AMBER
      : "background:var(--chip);color:" + BODY;
    const adminRows = (card) => (card.rows || []).map((r, i) => {
      const key = card.id + ":" + i;
      const isToggle = r.length > 2;
      const on = st.adminFlags[key] !== undefined ? st.adminFlags[key] : r[2] === true;
      return {label:r[0], note:r[1] || "", hasNote: !!r[1] && isToggle,
        isValue: !isToggle && !!r[1], value:r[1] || "",
        isToggle,
        trackBg: on ? "var(--accent)" : "var(--track)",
        knobLeft: on ? "19px" : "3px",
        knobBg: on ? "var(--on-accent)" : DIM,
        toggle: () => this.setState(p => ({adminFlags: Object.assign({}, p.adminFlags, {[key]: !on})}))};
    });

    const roster = PEOPLE.concat(st.peopleExtra || []);
    const statusTint = {active:[GREEN,"var(--ok-soft)"], external:["#f0c04b","var(--warn-soft)"], inactive:[DIM,"var(--track)"], suspended:[RED,"var(--bad-soft)"]};
    const peopleModel = {
      total: roster.length,
      active: roster.filter(p => p[4] === "active").length,
      external: roster.filter(p => p[4] === "external").length,
      suspended: roster.filter((p, i) => (st.peopleSuspended || {})[p[2]]).length,
      addOpen: !!st.peopleAddOpen,
      toggleAdd: () => this.setState(p => ({peopleAddOpen: !p.peopleAddOpen, peopleForm: {name:"", email:"", role:"Standard"}})),
      form: st.peopleForm || {name:"", email:"", role:"Standard"},
      setName: (e) => this.setState(p => ({peopleForm: Object.assign({}, p.peopleForm, {name:e.target.value})})),
      setEmail: (e) => this.setState(p => ({peopleForm: Object.assign({}, p.peopleForm, {email:e.target.value})})),
      /* Custom account types live alongside the four built-ins. */
      roleChoices: ROLE_LEVELS.concat((st.customRoles || []).map(r => r.name)).map(r => ({label:r,
        style: "height:28px;padding:0 12px;border-radius:var(--r-ctl,9px);font-size:11.5px;cursor:pointer;border:1px solid var(--border);"
          + ((st.peopleForm || {}).role === r ? "background:var(--pill-bg);color:var(--pill-ink);box-shadow:0 2px 5px rgba(0,0,0,.34),0 6px 16px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.5);" : "background:var(--surface-2);color:var(--body)"),
        pick: () => this.setState(p => ({peopleForm: Object.assign({}, p.peopleForm, {role:r})}))})),
      newRoleOpen: !!st.roleBuilderOpen,
      openNewRole: () => this.setState({roleBuilderOpen:true,
        roleDraft:{name:"", scope:"All records", grants:{view:true}}}),
      closeNewRole: () => this.setState({roleBuilderOpen:false}),
      roleDraft: st.roleDraft || {name:"", scope:"All records", grants:{view:true}},
      setRoleName: (e) => this.setState(p => ({roleDraft: Object.assign({}, p.roleDraft, {name:e.target.value})})),
      roleScopes: ROLE_SCOPES.map(sc => ({label:sc,
        style: "height:28px;padding:0 12px;border-radius:var(--r-ctl,9px);font-size:11.5px;cursor:pointer;border:1px solid var(--border);"
          + (((st.roleDraft || {}).scope || "All records") === sc
              ? "background:var(--accent);border-color:var(--accent);color:var(--on-accent)"
              : "background:var(--surface-2);color:var(--body)"),
        pick: () => this.setState(p => ({roleDraft: Object.assign({}, p.roleDraft, {scope:sc})}))})),
      roleGrants: GRANT_DEFS.map(g => {
        const on = !!(((st.roleDraft || {}).grants) || {})[g[0]];
        return {label:g[1], meta:g[2],
          style: "display:flex;align-items:center;gap:10px;width:100%;padding:9px 11px;border-radius:var(--r-md,12px);cursor:pointer;text-align:left;"
            + "transition:background .18s var(--ease),border-color .18s var(--ease);"
            + (on ? "background:var(--accent-faint);border:1px solid var(--accent-line)"
                  : "background:var(--surface-2);border:1px solid var(--border)"),
          boxStyle: "width:16px;height:16px;flex:none;border-radius:5px;display:flex;align-items:center;justify-content:center;"
            + (on ? "background:var(--accent-fill,var(--accent));color:var(--on-accent);box-shadow:var(--accent-glow,none)" : "background:var(--track);color:transparent"),
          on,
          toggle: () => this.setState(p => {
            const gr = Object.assign({}, (p.roleDraft || {}).grants);
            if (gr[g[0]]) delete gr[g[0]]; else gr[g[0]] = true;
            return {roleDraft: Object.assign({}, p.roleDraft, {grants:gr})};
          })};
      }),
      grantCount: String(Object.keys(((st.roleDraft || {}).grants) || {}).length) + " of " + GRANT_DEFS.length + " granted",
      canSaveRole: !!(((st.roleDraft || {}).name) || "").trim(),
      saveRole: () => {
        const d = st.roleDraft || {};
        if (!(d.name || "").trim()) return;
        this.setState(p => ({
          customRoles: (p.customRoles || []).concat([{name:d.name.trim(), scope:d.scope, grants:d.grants || {}}]),
          roleBuilderOpen:false,
          peopleForm: Object.assign({}, p.peopleForm, {role:d.name.trim()})
        }));
      },
      customRoles: (st.customRoles || []).map((r, i) => ({
        name:r.name, scope:r.scope,
        grants: Object.keys(r.grants || {}).length + " grants",
        remove: () => this.setState(p => ({customRoles: (p.customRoles || []).filter((_, k) => k !== i)}))
      })),
      hasCustomRoles: (st.customRoles || []).length > 0,
      canAdd: !!((st.peopleForm || {}).name || "").trim() && !!((st.peopleForm || {}).email || "").trim(),
      addAccount: () => {
        const f = st.peopleForm || {};
        if (!f.name || !f.email) return;
        const entry = [f.name, "Invited", f.email, "—", "active", f.role || "Standard", "Just invited"];
        this.setState(p => ({peopleExtra: (p.peopleExtra || []).concat([entry]), peopleAddOpen:false, peopleForm:{name:"",email:"",role:"Standard"}}));
      },
      rows: roster.map((p, i) => {
        const key = p[2], suspended = !!(st.peopleSuspended || {})[key];
        const status = suspended ? "suspended" : p[4];
        const t = statusTint[status] || statusTint.active;
        const role = (st.peopleRole || {})[key] || p[5];
        const perms = Object.assign({}, DEFAULT_PERMS[role], (st.peoplePerm || {})[key]);
        const expanded = st.peopleExpanded === key;
        const initials = p[0].split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
        return {
          key, name:p[0], jobTitle:p[1], email:p[2], location:p[3], lastActive:p[6], initials,
          statusLabel: suspended ? "Suspended" : status.charAt(0).toUpperCase() + status.slice(1),
          statusStyle: "flex:none;padding:3px 9px;border-radius:var(--chip-r,6px);font-size:10.5px;font-weight:500;background:" + t[1] + ";color:" + t[0],
          role,
          cycleRole: () => {
            const idx = ROLE_LEVELS.indexOf(role);
            const next = ROLE_LEVELS[(idx + 1) % ROLE_LEVELS.length];
            this.setState(p2 => ({peopleRole: Object.assign({}, p2.peopleRole, {[key]:next}),
              peoplePerm: Object.assign({}, p2.peoplePerm, {[key]: DEFAULT_PERMS[next]})}));
          },
          expanded, chevronStyle: "transition:transform .2s var(--ease);transform:rotate(" + (expanded ? "180deg" : "0deg") + ")",
          toggleExpand: () => this.setState(p2 => ({peopleExpanded: p2.peopleExpanded === key ? null : key})),
          perms: PERM_KEYS.map(pk => ({label:pk[1], on: !!perms[pk[0]],
            trackBg: perms[pk[0]] ? "var(--accent)" : "var(--track)", knobLeft: perms[pk[0]] ? "18px" : "3px", knobBg: perms[pk[0]] ? "var(--on-accent)" : "var(--dim)",
            toggle: () => this.setState(p2 => ({peoplePerm: Object.assign({}, p2.peoplePerm,
              {[key]: Object.assign({}, perms, {[pk[0]]: !perms[pk[0]]})})}))})),
          suspendLabel: suspended ? "Restore access" : "Suspend",
          toggleSuspend: () => this.setState(p2 => ({peopleSuspended: Object.assign({}, p2.peopleSuspended, {[key]: !suspended})}))
        };
      })
    };

    /* Each connection reads as a pairing — Pulse on the left, the system on the
       right, joined by a live link whose colour carries the status. */
    const integrationsModel = {
      cards: INTEGRATIONS.map((it, idx) => {
        const kindTint = {ok:[GREEN,"var(--ok-soft)"], warn:[AMBER,"var(--warn-soft)"], bad:[RED,"var(--bad-soft)"], off:[DIM,"var(--track)"]}[it.statusKind];
        const live = it.statusKind === "ok" || it.statusKind === "warn";
        const link = it.statusKind === "ok" ? "var(--accent)" : it.statusKind === "bad" ? RED : it.statusKind === "off" ? "var(--track)" : AMBER;
        const on = (st.intOff || {})[it.name] ? false : it.statusKind !== "off";
        const tint = it.tint === "var(--accent)" ? "var(--accent)" : it.tint;
        const alpha = (hex, a) => hex.charAt(0) === "#" ? hex + a : hex;
        return {name:it.name, glyph:it.glyph, blurb:it.blurb,
          pairTitle: "Pulse + " + it.name,
          status:it.status,
          statusStyle:"flex:none;padding:3px 10px;border-radius:var(--chip-r,7px);font-size:10.5px;font-weight:500;background:" + kindTint[1] + ";color:" + kindTint[0],
          lastSync:it.lastSync, usage:it.usage, auth:it.auth,
          hasScopes: it.scopes.length > 0,
          scopes: it.scopes.map(sc => ({label:sc})),
          /* header art: dotted mesh + a bloom behind the two tiles */
          artStyle: "position:relative;height:124px;display:flex;align-items:center;justify-content:center;gap:0;overflow:hidden;"
            + "background:radial-gradient(120% 140% at 50% 120%, " + alpha(link, "26") + " 0%, transparent 62%),"
            + "radial-gradient(90% 120% at 50% -20%, rgba(255,255,255,.05) 0%, transparent 60%), var(--surface-2);"
            + "border-bottom:1px solid var(--border)",
          meshStyle: "position:absolute;inset:0;pointer-events:none;opacity:.5;"
            + "background-image:radial-gradient(" + alpha(link, "55") + " 1px, transparent 1px);"
            + "background-size:9px 9px;"
            + "-webkit-mask-image:radial-gradient(120% 130% at 50% 118%, #000 0%, transparent 66%);"
            + "mask-image:radial-gradient(120% 130% at 50% 118%, #000 0%, transparent 66%)",
          pulseTileStyle: "position:relative;z-index:1;width:58px;height:58px;flex:none;border-radius:var(--card-r,18px);display:flex;align-items:center;justify-content:center;"
            + "background:var(--surface-strong);border:1px solid var(--border-strong);color:var(--accent);box-shadow:0 10px 26px rgba(0,0,0,.4)",
          appTileStyle: "position:relative;z-index:1;width:58px;height:58px;flex:none;border-radius:var(--card-r,18px);display:flex;align-items:center;justify-content:center;"
            + "background:linear-gradient(160deg," + alpha(tint, "3a") + "," + alpha(tint, "14") + "), var(--surface-strong);"
            + "border:1px solid " + alpha(tint, "66") + ";color:" + tint
            + ";box-shadow:0 10px 26px rgba(0,0,0,.4),inset 0 1px 0 " + alpha(tint, "33"),
          wireStyle: "position:relative;z-index:0;width:58px;height:2px;flex:none;border-radius:2px;background:linear-gradient(90deg,"
            + alpha(link, "00") + "," + link + "," + alpha(link, "00") + ");box-shadow:0 0 12px " + link,
          sparkStyle: "position:absolute;top:-2px;left:0;width:14px;height:6px;border-radius:3px;background:" + link
            + ";filter:blur(2px);" + (live ? "animation:wireRun 2.6s var(--ease) " + (idx * 240) + "ms infinite" : "opacity:0"),
          toggleTrackStyle: "position:relative;width:46px;height:26px;flex:none;border-radius:var(--r-ctl,13px);cursor:pointer;border:1px solid "
            + (on ? "var(--accent)" : "var(--border)") + ";background:" + (on ? "var(--accent)" : "var(--track)")
            + ";transition:background .24s var(--ease),border-color .24s var(--ease)",
          toggleKnobStyle: "position:absolute;top:2px;left:" + (on ? "22px" : "2px") + ";width:20px;height:20px;border-radius:var(--r-sm,10px);"
            + "background:" + (on ? "var(--on-accent)" : "var(--dim)") + ";transition:left .24s var(--ease),background .24s var(--ease)",
          toggle: () => this.setState(p => ({intOff: Object.assign({}, p.intOff, {[it.name]: on})})),
          actionLabel: it.statusKind === "bad" ? "Reconnect" : it.statusKind === "off" ? "Connect" : "View integration",
          actionStyle: "height:32px;padding:0 14px;border-radius:var(--r-ctl,10px);font-size:12.5px;cursor:pointer;transition:border-color .2s var(--ease),color .2s var(--ease);"
            + (it.statusKind === "bad"
                ? "background:var(--bad-soft);border:1px solid " + RED + ";color:" + RED
                : "background:var(--surface-2);border:1px solid var(--border);color:var(--body)")};
      })
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

    const adminModel = {
      company: "Kilbride Group",
      urgent: [
        ["3", "employees awaiting access", AMBER, "var(--warn-soft)", "people"],
        ["1", "integration disconnected", RED, "var(--bad-soft)", "integrations"],
        ["74", "duplicate records", AMBER, "var(--warn-soft)", "health"],
        ["2", "security recommendations", AMBER, "var(--warn-soft)", "security"]
      ].map(u => ({count:u[0], label:u[1], dot:u[2], border:u[3],
        go: () => this.setState({adminOpen:u[4]})})),
      panelAnim: "animation:" + ((st.adminTick || 0) ? "panelSwapB" : "panelSwapA")
        + " .46s cubic-bezier(.16,1,.28,1) both",
      groups: ADMIN_GROUPS.filter(grp => !st.adminGroup || grp[0] === st.adminGroup).map(grp => ({
        label: grp[0], cols: grp[1], count: String(ADMIN_CARDS.filter(c => c.group === grp[0]).length),
        thumbStyle: (() => {
          const list = ADMIN_CARDS.filter(c => c.group === grp[0]);
          const at = list.findIndex(c => c.id === adminCard.id);
          const y = at < 0 ? 0 : at * 43;
          return "position:absolute;left:0;right:0;top:0;height:40px;border-radius:var(--r-md,14px);pointer-events:none;"
            + "background:var(--accent-faint);box-shadow:inset 3px 0 0 var(--accent),inset 0 0 0 1px var(--accent-line);"
            + "transform:translateY(" + y + "px);opacity:" + (at < 0 ? "0" : "1")
            + ";transition:transform .42s cubic-bezier(.22,.9,.16,1),opacity .24s var(--ease)";
        })(),
        cards: ADMIN_CARDS.filter(c => c.group === grp[0]).map((c, ci) => {
          const on = c.id === adminCard.id;
          return {
          delay: (ci * 60) + "ms",
          title:c.title, blurb:c.blurb, icon:ADMIN_ICONS[c.icon], tint:c.tint, tags:c.tags,
          hasBadge: !!c.badge, badge: c.badge || "",
          badgeStyle: "flex:none;padding:3px 9px;border-radius:var(--chip-r,6px);font-size:10.5px;font-weight:500;white-space:nowrap;" + badgeTint(c.badgeKind),
          navStyle: "position:relative;z-index:1;display:flex;align-items:center;gap:10px;width:100%;height:40px;padding:0 12px 0 " + (on ? "14px" : "12px")
            + ";border:0;border-radius:var(--r-md,14px);cursor:pointer;font-size:13px;text-align:left;background:none;"
            + "transition:color .22s var(--ease),padding-left .38s cubic-bezier(.22,.9,.16,1);"
            + (on ? "color:var(--ink);font-weight:600" : "color:var(--dim)"),
          navIconWrap: "flex:none;width:26px;height:26px;border-radius:var(--r-sm,9px);display:flex;align-items:center;justify-content:center;color:" + (on ? c.tint : "var(--faint)"),
          navBadgeStyle: "flex:none;padding:2px 7px;border-radius:var(--chip-r,6px);font-size:9.5px;font-weight:500;white-space:nowrap;" + badgeTint(c.badgeKind),
          hasFooter: !!c.footer, footer: c.footer || "", action: c.action || "",
          open: () => this.setState(p => ({adminOpen:c.id, adminTick:((p.adminTick || 0) + 1) % 2}))
        };})
      })),
      panelOpen: !!adminCard,
      close: () => this.setState({adminOpen:null}),
      panel: adminCard ? {
        group: adminCard.group, title: adminCard.title,
        icon: ADMIN_ICONS[adminCard.icon], tint: adminCard.tint, blurb: adminCard.blurb,
        hasHero: !!adminCard.heroText, heroLabel: adminCard.heroLabel || "",
        heroText: adminCard.heroText || "", heroAction: adminCard.heroAction || "",
        hasIssues: !!adminCard.issues,
        isDataHealth: adminCard.id === "health",
        health: adminCard.trend ? (() => {
          const peak = Math.max.apply(null, adminCard.trend);
          const first = adminCard.trend[0], last = adminCard.trend[adminCard.trend.length - 1];
          const pctDown = Math.round(100 * (first - last) / first);
          return {
            summary: "Open issues fallen " + pctDown + "% over the last 7 scans",
            bars: adminCard.trend.map((v, i, arr) => ({
              h: Math.max(6, Math.round(100 * v / peak)) + "%",
              bg: i === arr.length - 1 ? "var(--accent)" : "var(--track)",
              value: v
            })),
            severity: adminCard.bySeverity.map(s => ({
              label:s[0], count:s[1],
              pct: Math.round(100 * Number(s[1]) / adminCard.bySeverity.reduce((n, x) => n + Number(x[1]), 0)) + "%",
              bg: s[2]
            }))
          };
        })() : null,
        issues: (adminCard.issues || []).map(it => ({title:it[0], count:it[1],
          dot: SEV[it[2]] || DIM, fix:it[3], action:it[4]})),
        listLabel: adminCard.listLabel || "SETTINGS",
        rows: adminRows(adminCard),
        audit: "Every change here is written to the audit log as you",
        isPeople: adminCard.id === "people", isIntegrations: adminCard.id === "integrations",
        isAppearance: adminCard.id === "appearance",
        showGenericRows: adminCard.id !== "people" && adminCard.id !== "integrations" && adminCard.id !== "appearance" && adminRows(adminCard).length > 0,
        people: adminCard.id === "people" ? peopleModel : null,
        integrations: adminCard.id === "integrations" ? integrationsModel : null,
        appearance: adminCard.id === "appearance" ? appearanceModel : null
      } : {rows:[], issues:[]}
    };

    /* ---- activity ---- */
    const feeds = this.feeds || {data:[], people:[], ai:[]};
    const allEvents = STREAM_DEFS.flatMap(d => feeds[d.id] || []);
    const ago = (at) => {
      const s = Math.max(1, Math.round((Date.now() - at) / 1000));
      return s < 60 ? s + " seconds ago" : s < 3600 ? Math.round(s / 60) + " min ago" : Math.round(s / 3600) + " h ago";
    };
    const STATUS_TINT2 = {completed:[GREEN,"var(--ok-soft)","completed"], working:[LIME,"var(--accent-faint)","working"],
      failed:[RED,"var(--bad-soft)","failed"], awaiting:[AMBER,"var(--warn-soft)","awaiting approval"]};
    const statusChip = (st2) => {
      const t = STATUS_TINT2[st2] || STATUS_TINT2.completed;
      return "flex:none;padding:1px 8px;border-radius:var(--chip-r,6px);font-size:9.5px;font-weight:500;white-space:nowrap;"
        + "letter-spacing:.01em;background:" + t[1] + ";color:" + t[0];
    };
    const shortAgo = (at) => {
      const s = Math.max(1, Math.round((Date.now() - at) / 1000));
      return s < 60 ? s + "s" : s < 3600 ? Math.round(s / 60) + "m" : Math.round(s / 3600) + "h";
    };
    const kpiMatch = (e) => {
      if (st.actKpi === "all") return true;
      if (st.actKpi === "people") return e.stream === "people";
      if (st.actKpi === "ai") return e.stream === "ai";
      if (st.actKpi === "attention") return e.status === "failed" || e.status === "awaiting";
      return true;
    };
    const logQ = st.actQuery.trim().toLowerCase();
    const auditRows = allEvents.filter(kpiMatch)
      .filter(e => !logQ || (e.title + " " + e.note + " " + e.actor + " " + e.rel + " " + e.src).toLowerCase().includes(logQ))
      .sort((a, b) => b.at - a.at);
    const openEvent = allEvents.find(e => e.id === st.actOpen);

    /* The Agents lens is its own page, not the generic board with two empty
       lanes: agent-specific numbers, a roster of what each agent is doing, and
       the AI lane given the width beside it. */
    const agentLens = st.actKpi === "ai";
    const AGENT_STATE = {working:[LIME,"working"], complete:[GREEN,"idle"], waiting:[AMBER,"waiting on you"],
      thinking:["#6ad0f0","thinking"], attention:[RED,"needs attention"]};
    const solo = AGENT_DEFS.filter(a => !a.group);
    const actionsFor = (i) => [84,62,47,38,34,29,24][i] || 18;
    const agentRoster = solo.map((a, i) => {
      const t = AGENT_STATE[a.state] || AGENT_STATE.complete;
      const live = a.state === "working" || a.state === "thinking";
      const acts = actionsFor(i);
      return {name:a.name, shape:a.shape, tint:a.tint, state:a.state,
        stateLabel:t[1], preview:a.preview, actions:String(acts),
        dotStyle: "width:6px;height:6px;flex:none;border-radius:50%;background:" + t[0]
          + (live ? ";box-shadow:0 0 8px " + t[0] + ";animation:breathe 1.6s ease-in-out infinite" : ""),
        stateStyle: "font-family:" + MONO + ";font-size:9px;letter-spacing:0.12em;color:" + t[0],
        barStyle: "height:2px;border-radius:2px;width:" + Math.round(100 * acts / 84) + "%;background:" + t[0],
        style: "display:flex;flex-direction:column;gap:10px;width:100%;padding:14px 15px;text-align:left;cursor:pointer;"
          + "background:var(--surface);border:1px solid var(--border);border-radius:var(--card-r,18px);backdrop-filter:blur(20px);"
          + "transition:border-color .22s var(--ease),transform .2s var(--ease);animation:glide .5s var(--ease) " + (i * 60) + "ms both",
        go: () => this.setState({page:"Agents", agentOpen:a.id})};
    });
    /* Needs attention is a triage queue, not a feed: one row per distinct
       problem, deduped and oldest first, each answering what happened, why it
       matters and what can be done. */
    const attentionLens = st.actKpi === "attention";
    const seenTri = {};
    const attentionItems = allEvents
      .filter(e => e.status === "failed" || e.status === "awaiting")
      .filter(e => { const k = e.title + "|" + e.actor + "|" + e.rel; if (seenTri[k]) return false; seenTri[k] = 1; return true; })
      .sort((a, b) => a.at - b.at);
    const WHY = {
      failed: ["Nothing was lost — the work is queued and posts on reconnect.", "Retry", "Open the connection"],
      awaiting: ["Drafted and parked. It only moves when you say yes.", "Review and decide", "Open the record"]
    };
    const triageGroups = [
      ["failed", "FAILED", "Stopped working. Nothing lost.", RED, "var(--bad-soft)"],
      ["awaiting", "WAITING ON YOUR YES", "Written, never sent.", AMBER, "var(--warn-soft)"]
    ].map(g => {
      const rows = attentionItems.filter(e => e.status === g[0]);
      return {key:g[0], label:g[1], blurb:g[2], count:String(rows.length), any: rows.length > 0,
        labelStyle: "font-family:" + MONO + ";font-size:9.5px;letter-spacing:0.14em;color:" + g[3],
        rows: rows.map((e, i) => ({
          title:e.title, note:e.note, actor:e.actor, rel:e.rel,
          why: WHY[g[0]][0], primary: WHY[g[0]][1], secondary: WHY[g[0]][2],
          waited: "waiting " + shortAgo(e.at),
          railStyle: "position:absolute;left:0;top:0;bottom:0;width:2px;background:" + g[3],
          chip: g[0] === "failed" ? "failed" : "awaiting your yes",
          chipStyle: "flex:none;padding:2px 9px;border-radius:var(--chip-r,6px);font-size:9.5px;font-weight:500;background:" + g[4] + ";color:" + g[3],
          primaryStyle: "flex:none;height:30px;padding:0 14px;border:0;border-radius:var(--cta-r,10px);background:var(--accent-fill,var(--accent));color:var(--on-accent);box-shadow:var(--accent-glow,none);"
            + "font-size:12.5px;font-weight:500;cursor:pointer;transition:transform .18s var(--ease)",
          style: "position:relative;display:flex;flex-direction:column;gap:9px;padding:15px 17px 15px 19px;background:var(--surface);"
            + "border:1px solid var(--border);border-radius:var(--card-r,18px);backdrop-filter:blur(20px);overflow:hidden;"
            + "transition:border-color .22s var(--ease);animation:glide .5s var(--ease) " + (i * 55) + "ms both",
          open: () => this.setState({actOpen:e.id})
        }))};
    });
    /* The People lens answers who is doing what right now — a roster of the
       staff with access, what each last touched, and what is parked on them. */
    const peopleLens = st.actKpi === "people";
    const peopleEvents = (feeds.people || []);
    const staff = PEOPLE.slice(0, 6);
    const P_STATE = [[LIME,"active now"],[LIME,"active now"],["#6ad0f0","in a record"],[GREEN,"idle"],[AMBER,"away"],[GREEN,"idle"]];
    const actsFor = (i) => [38,31,24,17,11,6][i] || 4;
    const peopleRoster = staff.map((p, i) => {
      const t = P_STATE[i % P_STATE.length];
      const live = t[1] === "active now" || t[1] === "in a record";
      const acts = actsFor(i);
      const last = peopleEvents[i % Math.max(1, peopleEvents.length)];
      const waiting = i === 2 || i === 4;
      return {name:p[0], role:p[1], org:p[3],
        initials: p[0].split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase(),
        stateLabel:t[1], actions:String(acts),
        preview: last ? last.title : "Nothing today",
        avatarStyle: "width:34px;height:34px;flex:none;border-radius:var(--r-md,12px);background:var(--surface-2);border:1px solid var(--border);"
          + "color:var(--body);display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:500",
        dotStyle: "width:6px;height:6px;flex:none;border-radius:50%;background:" + t[0]
          + (live ? ";box-shadow:0 0 8px " + t[0] + ";animation:breathe 1.6s ease-in-out infinite" : ""),
        stateStyle: "font-family:" + MONO + ";font-size:9px;letter-spacing:0.12em;color:" + t[0],
        barStyle: "height:2px;border-radius:2px;width:" + Math.round(100 * acts / 38) + "%;background:" + t[0],
        waiting, waitLabel: waiting ? "1 waiting on them" : "",
        style: "display:flex;flex-direction:column;gap:10px;width:100%;padding:14px 15px;text-align:left;cursor:pointer;"
          + "background:var(--surface);border:1px solid var(--border);border-radius:var(--card-r,18px);backdrop-filter:blur(20px);"
          + "transition:border-color .22s var(--ease),transform .2s var(--ease);animation:glide .5s var(--ease) " + (i * 60) + "ms both",
        go: () => this.setState({page:"People"})};
    });
    const actModel = {
      agentLens, attentionLens, peopleLens,
      genericLens: !agentLens && !attentionLens && !peopleLens,
      showLanes: !attentionLens,
      eyebrow: agentLens ? "AGENT ACTIVITY" : attentionLens ? "TRIAGE" : peopleLens ? "PEOPLE ACTIVITY" : "ACTIVITY",
      heading: agentLens ? "What the agents did" : attentionLens ? "What needs you" : peopleLens ? "Who did what" : "Everything happening now",
      subhead: agentLens
        ? solo.length + " agents are registered. Every action below went through a tool they were granted, and anything that changes data is still waiting on you."
        : attentionLens
          ? "Everything that stopped working or is parked waiting on a decision, oldest first. Nothing here has been lost."
          : peopleLens
            ? "42 of 48 staff have used Pulse today. Every edit, approval and decision below is written against the person who made it."
            : "Data arriving, people acting and agents working — then the audit trail underneath.",
      peopleKpis: [
        ["Active today", "42 of 48", "signed in and working", LIME],
        ["Decisions made", "27", "approvals and sign-offs", GREEN],
        ["Waiting on someone", "5", "parked on a person", AMBER],
        ["Records touched", "184", "edits written to the spine", "#6ad0f0"]
      ].map((k, ki) => ({label:k[0], value:k[1], hint:k[2], dot:k[3],
        valueColor: k[3] === RED || k[3] === AMBER ? k[3] : INK,
        style: "padding:15px 17px 17px;border-radius:var(--card-r,18px);text-align:left;background:var(--surface);border:1px solid var(--border);"
          + "backdrop-filter:blur(20px);animation:springIn .5s var(--ease) " + (ki * 70) + "ms both"})),
      peopleRoster,
      triage: triageGroups,
      triageEmpty: attentionItems.length === 0,
      attentionKpis: [
        ["Failed", String(attentionItems.filter(e => e.status === "failed").length), "queued, nothing lost", RED],
        ["Awaiting your yes", String(attentionItems.filter(e => e.status === "awaiting").length), "drafted, never sent", AMBER],
        ["Oldest wait", attentionItems.length ? shortAgo(attentionItems[0].at) : "—", "since it was raised", "#6ad0f0"],
        ["Retried automatically", "12", "cleared without you", LIME]
      ].map((k, ki) => ({label:k[0], value:k[1], hint:k[2], dot:k[3],
        valueColor: k[3] === RED || k[3] === AMBER ? k[3] : INK,
        style: "padding:15px 17px 17px;border-radius:var(--card-r,18px);text-align:left;background:var(--surface);border:1px solid var(--border);"
          + "backdrop-filter:blur(20px);animation:springIn .5s var(--ease) " + (ki * 70) + "ms both"})),
      agentKpis: [
        ["Actions today", "318", "through granted tools", LIME],
        ["Working now", String(solo.filter(a => a.state === "working" || a.state === "thinking").length) + " of " + solo.length, "the rest are idle", "#6ad0f0"],
        ["Waiting on your yes", String(solo.filter(a => a.state === "waiting").length), "drafted, never sent", AMBER],
        ["Needs attention", String(solo.filter(a => a.state === "attention").length), "failed or blocked", RED]
      ].map((k, ki) => ({label:k[0], value:k[1], hint:k[2], dot:k[3],
        valueColor: k[3] === RED || k[3] === AMBER ? k[3] : INK,
        style: "padding:15px 17px 17px;border-radius:var(--card-r,18px);text-align:left;background:var(--surface);border:1px solid var(--border);"
          + "backdrop-filter:blur(20px);animation:springIn .5s var(--ease) " + (ki * 70) + "ms both"})),
      roster: agentRoster,
      laneCols: (agentLens || peopleLens) ? "minmax(0,1fr)" : "repeat(3,minmax(0,1fr))",
      togglePause: () => this.setState(p => ({actPaused: !p.actPaused})),
      pauseLabel: st.actPaused ? "Resume live view" : "Pause live view",
      pauseIcon: st.actPaused ? "M7 4.5v15l13-7.5-13-7.5Z" : "M9 5.5v13 M15 5.5v13",
      pauseStyle: "height:36px;display:flex;align-items:center;gap:8px;padding:0 15px;border-radius:var(--r-ctl,9px);cursor:pointer;font-size:13px;font-weight:500;"
        + "transition:background .2s var(--ease),border-color .2s var(--ease);"
        + (st.actPaused ? "background:var(--accent);border:1px solid var(--accent);color:var(--on-accent)"
                        : "background:var(--chip);border:1px solid var(--chip-border);color:var(--body)"),
      kpis: [
        ["Events today", "1,284", "all", "across every source", LIME],
        ["Employees active", "42", "people", "of 48 with access", "#f0c04b"],
        ["AI actions", "318", "ai", "by " + solo.length + " installed agents", "#6ad0f0"],
        ["Need attention", "7", "attention", "failed or awaiting a yes", RED]
      ].map((k, ki) => {
        const on = st.actKpi === k[2];
        return {label:k[0], value:k[1], hint:k[3], dot:k[4],
          labelColor: on ? "var(--on-accent-2)" : "var(--dim)",
          valueColor: on ? "var(--on-accent)" : (k[2] === "attention" ? RED : INK),
          hintColor: on ? "var(--on-accent-2)" : "var(--faint)",
          style: "padding:16px 18px 18px;border-radius:var(--card-r,18px);cursor:pointer;text-align:left;"
            + "transition:background .2s var(--ease),border-color .2s var(--ease),transform .18s var(--ease);"
            + (on ? "background:var(--accent);border:1px solid var(--accent)"
                  : "background:var(--surface);border:1px solid var(--border);backdrop-filter:blur(20px)"),
          pick: () => this.setState({actKpi: on ? "all" : k[2]})};
      }).map((k, ki) => Object.assign(k, {style: k.style + ";animation:springIn .5s var(--ease) " + (ki * 70) + "ms both"})),
      streams: (agentLens ? STREAM_DEFS.filter(d => d.id === "ai")
        : peopleLens ? STREAM_DEFS.filter(d => d.id === "people") : STREAM_DEFS).map((d, di) => {
        const items = (feeds[d.id] || []).filter(kpiMatch);
        const hovered = st.actHover === d.id;
        return {title:d.title, sub:d.sub, icon:d.icon, tint:d.tint, delay: (di * 110) + "ms",
          state: st.actPaused ? "PAUSED" : hovered ? "HELD" : "LIVE",
          stateColor: st.actPaused || hovered ? "var(--faint)" : d.tint,
          empty: items.length === 0,
          enter: () => this.setState({actHover:d.id}),
          leave: () => this.setState(p => (p.actHover === d.id ? {actHover:null} : null)),
          items: items.map((e, i) => {
            const t = STATUS_TINT2[e.status] || STATUS_TINT2.completed;
            return {title:e.title, note:e.note, status:t[2], statusColor:t[0],
              statusStyle: statusChip(e.status),
              // Only unfinished work earns a chip; everything else says it with the rail.
              showChip: e.status !== "completed",
              rail: e.status === "completed" ? "var(--track)" : t[0],
              actor: e.actor, rel: e.rel, short: shortAgo(e.at),
              srcAbbr: SRC_ABBR[e.src] || "PL", srcTint: SRC_TINT[e.src] || LIME,
              isWorking: e.status === "working", progress: Math.round(e.progress) + "%",
              style: "position:relative;padding:9px 11px 10px 13px;border-radius:var(--r-sm,10px);cursor:pointer;margin-bottom:3px;"
                + "background:" + (i === 0 && e.fresh ? "var(--surface-2)" : "transparent") + ";"
                + "transition:background .2s var(--ease);"
                + (e.fresh && i === 0
                  ? (e.status === "failed" ? "animation:cardIn .34s var(--ease) both,failFlash .9s var(--ease) 1"
                                           : "animation:cardIn .34s var(--ease) both,glowIn 1.4s var(--ease) 1")
                  : ""),
              open: () => this.setState({actOpen:e.id})};
          })};
      }),
      query: st.actQuery,
      setQuery: (e) => this.setState({actQuery:e.target.value}),
      auditCols: ["Time","Event","Person or agent","Related record","Source","Status"],
      auditCaption: logQ ? "Filtered by “" + st.actQuery.trim() + "”"
        : st.actKpi === "all" ? "Every event, with who or what caused it."
        : "Filtered by the metric above.",
      auditBadge: auditRows.length + " shown",
      auditFooter: "Showing " + auditRows.length + " of " + allEvents.length + " events in this session",
      auditFilters: ["Last 24 hours","Anyone","Any system","Any type","Any status"].map(l => ({label:l,
        style: "height:34px;display:flex;align-items:center;gap:7px;padding:0 13px;background:var(--chip);border:1px solid var(--chip-border);"
          + "border-radius:var(--r-sm,9px);font-size:12.5px;color:var(--dim);cursor:pointer;white-space:nowrap;transition:border-color .2s var(--ease),color .2s var(--ease)",
        pick: () => {}})),
      audit: auditRows.slice(0, 12).map(e => ({
        when: new Date(e.at).toLocaleTimeString("en-IE", {hour:"2-digit", minute:"2-digit", second:"2-digit"}),
        title:e.title, actor:e.actor, rel:e.rel, src:e.src,
        status: (STATUS_TINT2[e.status] || STATUS_TINT2.completed)[2],
        statusStyle: statusChip(e.status),
        open: () => this.setState({actOpen:e.id})
      })),
      detailOpen: !!openEvent,
      closeDetail: () => this.setState({actOpen:null}),
      detail: openEvent ? (() => {
        const t = STATUS_TINT2[openEvent.status] || STATUS_TINT2.completed;
        const streamName = {data:"NEW DATA", people:"EMPLOYEE ACTIVITY", ai:"AI ACTIVITY"}[openEvent.stream];
        return {eyebrow: streamName + " · " + openEvent.src.toUpperCase(),
          title:openEvent.title, note:openEvent.note, status:t[2],
          statusStyle: statusChip(openEvent.status),
          why: openEvent.stream === "ai"
            ? "An agent routine matched this record, so the agent acted within the permissions it was granted."
            : openEvent.stream === "data"
              ? "The source system pushed this in, and the record spine matched it to an existing account."
              : "A person with the permission to do it made this decision, and it was written as them.",
          facts: [{k:"RESPONSIBLE", v:openEvent.actor}, {k:"SOURCE SYSTEM", v:openEvent.src},
            {k:"RELATED RECORD", v:openEvent.rel}, {k:"STATUS", v:t[2]},
            {k:"WHEN", v: new Date(openEvent.at).toLocaleTimeString("en-IE")},
            {k:"EVENT ID", v: openEvent.id.toUpperCase()}],
          hasDiff: openEvent.stream === "people" || openEvent.stream === "data",
          diff: [{field:"Status", before:"active", after:"on stop"},
            {field:"Credit limit", before:"€20,000", after:"€20,000"},
            {field:"Billing email", before:"—", after:"accounts@dunneandsons.ie"}],
          related: [openEvent.rel, openEvent.actor, openEvent.src],
          audit: "Written to the event log · immutable · " + openEvent.id.toUpperCase(),
          canUndo: openEvent.stream === "people" && openEvent.status === "completed"};
      })() : {facts:[], diff:[], related:[]}
    };

    const g = this.graph, live = this.searches || [];
    const PHASE_WORD = {sweep:"expanding", path:"tracing", hold:"matched", fade:"clearing"};
    const graphModel = {
      nodeCount: g ? g.nodes.length.toLocaleString("en-IE") : "—",
      edgeCount: g ? g.edges.length.toLocaleString("en-IE") : "—",
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
          return c; })()))[i]) : "—"}))
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
        ? (ontoSearchRes.connected.length ? "Also connected to " + ontoSearchRes.connected.join(", ") : "No other clusters reached this time — try again")
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
        ["Read through the spine","var(--neutral)", ONTO_NODES.filter(n => n[1] === "ledger").length],
        ["Module entity","#9fd6f0", ONTO_NODES.filter(n => n[1] === "module").length],
        ["Predicate","var(--track)", ONTO_NODES.filter(n => n[1] === "predicate").length]]
        .map(l => ({label:l[0], bg:l[1], count:String(l[2])})),
      layouts: [],
      ...ontoSearch
    };

    const newRecModel = {
      open: st.newRecOpen, name: st.newRecName,
      footer: st.newRecName.trim() ? "Saves into " + recSec.label.toLowerCase() : "Every record gets an id, an owner and an audit trail",
      setName: (e) => this.setState({newRecName:e.target.value}),
      close: () => this.setState({newRecOpen:false}),
      save: () => this.setState({newRecOpen:false}),
      cats: REC_TEMPLATE_CATS.map(c => {
        const on = (st.newRecCat || "All") === c;
        return {label:c,
          style: "height:28px;padding:0 13px;border:0;border-radius:var(--r-ctl,9px);cursor:pointer;font-size:12px;white-space:nowrap;"
            + "transition:background .16s var(--ease),color .16s var(--ease);"
            + (on ? "background:var(--pill-bg);color:var(--pill-ink);font-weight:600;box-shadow:0 2px 5px rgba(0,0,0,.34),0 6px 16px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.5);" : "background:none;color:" + DIM),
          pick: () => this.setState({newRecCat:c})};
      }),
      templates: REC_TEMPLATES.filter(t => (st.newRecCat || "All") === "All" || t[1] === st.newRecCat).map(t => {
        const on = st.newRecTemplate === t[0];
        const ink = on ? "var(--accent)" : "var(--dim)";
        return {label:t[0], note:t[2], icon:t[3], kind:t[4], picked:on,
          iconColor: ink,
          thumbStyle: "position:relative;height:80px;border-radius:var(--r-md,14px);display:flex;align-items:center;justify-content:center;padding:10px;"
            + "transition:background .16s var(--ease);"
            + (on ? "background:var(--accent-faint)" : "background:var(--chip)"),
          isGrid: t[4] === "grid", isCard: t[4] === "card", isRows: t[4] === "rows", isTimeline: t[4] === "timeline",
          isKanban: t[4] === "kanban", isChecklist: t[4] === "checklist", isLedger: t[4] === "ledger",
          isInvoice: t[4] === "invoice", isDocument: t[4] === "document", isGallery: t[4] === "gallery",
          isMap: t[4] === "map", isSchedule: t[4] === "schedule",
          rows3: [1,2,3].map(() => ({})),
          style: "padding:10px;border-radius:var(--card-r,18px);cursor:pointer;text-align:left;display:flex;flex-direction:column;"
            + "transition:border-color .16s var(--ease),background .16s var(--ease),transform .16s var(--ease);"
            + (on ? "background:var(--chip);border:1.5px solid var(--accent)"
                  : "background:var(--records-card);border:1px solid var(--chip-border)"),
          pick: () => this.setState({newRecTemplate:t[0]})};
      })
    };

    const areaDef = ASPECT_DEFS.find(x => x.id === st.aspect);
    const areaLabel = areaDef ? areaDef.label : st.aspect;
    const chip = (on) => "height:31px;padding:0 14px;border-radius:var(--r-ctl,9px);cursor:pointer;font-size:12.5px;white-space:nowrap;"
      + "transition:background .2s var(--ease),border-color .2s var(--ease),color .2s var(--ease),transform .18s var(--ease);"
      + (on ? "background:var(--accent-faint);border:1px solid var(--accent-line);color:var(--ink)"
            : "background:var(--surface);border:1px solid var(--border);color:var(--dim)");
    const aq = st.agentQuery.trim().toLowerCase();
    const agentMatches = st.agents.filter(a => !aq || (a.name + " " + a.role + " " + a.preview).toLowerCase().indexOf(aq) > -1);
    const activeAgent = st.agents.find(a => a.id === st.agentId) || st.agents[0];
    const activeThread = activeAgent.thread.concat(st.agentExtra[activeAgent.id] || []);

    const segStyle = (active) => "display:flex;align-items:center;gap:7px;height:30px;padding:0 14px;border:0;border-radius:var(--r-ctl,11px);cursor:pointer;font-size:12.5px;white-space:nowrap;"
      + "transition:background .24s var(--ease),color .24s var(--ease),font-weight .24s var(--ease);"
      + (active ? "background:var(--pill-bg);color:var(--pill-ink);font-weight:500;box-shadow:0 2px 5px rgba(0,0,0,.34),0 6px 16px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.5);" : "background:none;color:var(--dim)");
    // active/inactive are booleans the template branches on — a changed style string
    // on a keyless reused node does not reliably commit.
    const seg = (label, active, go, count) => ({label, go, count: count || "",
      active: !!active, inactive: !active});

    const importanceStyle = {
      critical:{dot:RED, tileBg:"var(--bad-soft)"},
      high:{dot:AMBER, tileBg:"var(--warn-soft)"},
      normal:{dot:DIM, tileBg:"var(--track)"}
    };
    const rowFor = (k) => {
      const it = ITEMS[k], expanded = st.open === k, imp = importanceStyle[it.importance];
      return Object.assign({}, it, imp, {
        expanded, chevron: expanded ? "180deg" : "0deg",
        open: () => this.setState({open: expanded ? null : k}),
        action: (e) => { if (e) e.stopPropagation(); this.setState({resolved:Object.assign({},st.resolved,{[k]:true}), open:null}); },
        ask: (e) => { if (e) e.stopPropagation(); this.ask(it.title); }
      });
    };
    const inboxKeys = openKeys.filter(k => st.inboxFilter === "All" || ITEMS[k].group === st.inboxFilter);
    const pillStyle = (active) => "height:30px;padding:0 15px;border:0;border-radius:var(--r-ctl,9px);cursor:pointer;font-size:12.5px;white-space:nowrap;transition:background .24s var(--ease),color .24s var(--ease);"
      + (active ? "background:var(--pill-bg);color:var(--pill-ink);font-weight:500;box-shadow:0 2px 5px rgba(0,0,0,.34),0 6px 16px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.5);" : "background:none;color:var(--dim)");

    const TASKS = [
      {id:"t1", title:"Chase INV-10428 — Dunne & Sons", due:"09:30", who:"AN", queue:["mine","overdue"], subject:"Dunne & Sons Ltd", priority:"high", late:true},
      {id:"t2", title:"Reassign Van 04 jobs off Ballincollig", due:"11:00", who:"MK", queue:["mine","overdue"], subject:"Ballincollig depot", priority:"high", late:true},
      {id:"t3", title:"Approve purchase order PO-4471", due:"12:00", who:"MK", queue:["mine"], subject:"PO-4471", priority:"normal"},
      {id:"t4", title:"Call Casey Builders about Thursday", due:"14:00", who:"TW", queue:["mine","team"], subject:"Casey Builders", priority:"normal"},
      {id:"t5", title:"Sign off August counter stocktake", due:"16:30", who:"SB", queue:["team"], subject:"Head office", priority:"low"},
      {id:"t6", title:"Assign installer to Thursday depot visit", due:"Tomorrow", who:"—", queue:["unassigned","upcoming"], subject:"site-visits.visit", priority:"high"},
      {id:"t7", title:"VAT return — August", due:"Fri", who:"AN", queue:["team","upcoming"], subject:"Head office", priority:"normal"},
      {id:"t8", title:"Ballincollig lease decision", due:"Thu", who:"MK", queue:["mine","upcoming"], subject:"Ballincollig depot", priority:"high"}
    ];
    const decorateTask = (t) => {
      const done = !!st.done[t.id];
      return Object.assign({}, t, {
        checkOpacity: done ? "1" : "0",
        fill: done ? LIME : "transparent",
        ring: done ? LIME : "var(--track)",
        color: done ? FAINT : INK,
        strike: done ? "line-through" : "none",
        dueColor: done ? FAINT : (t.late ? RED : "var(--mid)"),
        showPriority: t.priority !== "normal",
        prioBg: t.priority === "high" ? "var(--warn-soft)" : "var(--track)",
        prioColor: t.priority === "high" ? AMBER : DIM,
        toggle: () => this.setState({done:Object.assign({},st.done,{[t.id]:!done})})
      });
    };
    const queueCounts = {
      mine: TASKS.filter(t => t.queue.includes("mine")).length,
      team: TASKS.filter(t => t.queue.includes("team")).length,
      overdue: TASKS.filter(t => t.queue.includes("overdue")).length,
      upcoming: TASKS.filter(t => t.queue.includes("upcoming")).length,
      unassigned: TASKS.filter(t => t.queue.includes("unassigned")).length,
      all: TASKS.length
    };
    const queues = [["mine","My work"],["team","Team"],["overdue","Overdue"],["upcoming","Next 7 days"],["unassigned","Unassigned"],["all","Everything"]].map(q => ({
      label:q[1], count:String(queueCounts[q[0]]),
      style: pillStyle(st.queue === q[0]) + ";display:flex;align-items:center;gap:8px",
      countStyle: "font-family:"+MONO+";font-size:10.5px;color:" + (st.queue === q[0] ? "var(--pill-ink)" : FAINT),
      pick: () => this.setState({queue:q[0]})
    }));
    const queueTasks = (st.queue === "all" ? TASKS : TASKS.filter(t => t.queue.includes(st.queue))).map(decorateTask);

    const APPROVALS = [
      {id:"a1", title:"Purchase order PO-4471 — €14,280", subject:"Munster Plumbing Supplies · raised by Aoife Nolan", age:"18m", status:"awaiting you",
       steps:[{who:"Aoife Nolan",state:"raised 08:54",dot:GREEN},{who:"Martin Kilbride",state:"pending",dot:AMBER}],
       work:{kind:"table", label:"PURCHASE ORDER", viewLabel:"View order",
         headline:"PO-4471 · Munster Plumbing Supplies", sub:"Delivery Thursday 18 Sep · terms 30 days",
         cols:["Line","Qty","Unit","Total"], align:["left","right","right","right"],
         rows:[["22mm copper tube — 3m","240","€38.40","€9,216.00"],
               ["Compression elbow 22mm","400","€4.10","€1,640.00"],
               ["Solder ring coupler 22mm","600","€2.85","€1,710.00"],
               ["Flux paste 350g","60","€28.57","€1,714.00"]],
         totals:[["Net","€14,280.00"],["VAT 23% (reverse charge)","€0.00"],["Payable","€14,280.00"]],
         thinking:[["Checked stock levels","All four lines are below reorder point"],
                   ["Matched pricing","Unit prices equal the June supplier agreement"],
                   ["Checked commitments","Three lines are committed to Thursday's jobs"],
                   ["Checked threshold","€4,280 over Martin's sign-off limit, so it routed here"]],
         tools:[["records.read","read"],["invoices.read","read"],["approvals.route","write"]],
         risk:"No alternative supplier quote on file. Last price change was 14 June."}},
      {id:"a2", title:"Credit limit increase — Casey Builders", subject:"€10,000 → €18,000 · raised by Niamh Cronin", age:"Yesterday", status:"awaiting you",
       steps:[{who:"Niamh Cronin",state:"raised 16:02",dot:GREEN},{who:"Aoife Nolan",state:"approved 16:40",dot:GREEN},{who:"Martin Kilbride",state:"pending",dot:AMBER}],
       work:{kind:"diff", label:"RECORD CHANGE", viewLabel:"View change",
         headline:"Casey Builders Ltd · account CB-0142", sub:"Three fields change on approval, one unchanged",
         diff:[["Credit limit","€10,000","€18,000"],["Terms","30 days","45 days"],["Risk band","B","B"],["Reviewed","14 Mar 2026","Today"]],
         thinking:[["Read payment history","24 invoices, 22 paid on time, average 27 days"],
                   ["Checked exposure","Current balance €7,400 — 74% of the existing limit"],
                   ["Checked open work","€21k of quoted work would be blocked by the current limit"],
                   ["Checked policy","Increases above €15,000 need your decision"]],
         tools:[["records.read","read"],["invoices.read","read"],["records.update","write"]],
         risk:"One late payment in February, 19 days over. Cleared in full."}},
      {id:"a4", title:"Proposal — Ballincollig retrofit €62,400", subject:"Drafted by Helios · raised by Niamh Cronin", age:"3h", status:"awaiting you",
       steps:[{who:"Niamh Cronin",state:"raised 06:10",dot:GREEN},{who:"Martin Kilbride",state:"pending",dot:AMBER}],
       work:{kind:"doc", label:"PROPOSAL · 4 PAGES", viewLabel:"Read proposal",
         headline:"Heating retrofit — Ballincollig depot", sub:"Prepared for Casey Builders Ltd · valid 30 days",
         doc:[["Scope","Replace the depot's two oil boilers with a cascaded air-source system, re-balance the existing circuit and fit weather compensation controls. Work is phased over two weekends so the yard keeps running."],
              ["Approach","Week one strips the plant room and lands the new units on the existing plinth. Week two commissions the cascade and hands over with a 12-month monitoring window."],
              ["Commercials","€62,400 fixed price, 30% on order, 40% on plant delivery, 30% on handover. Excludes making good to the render."],
              ["Why us","We hold the maintenance contract on the Glanmire site and carry the same plant in stock, so lead time is three weeks rather than nine."]],
         totals:[["Plant","€38,900.00"],["Labour","€18,100.00"],["Controls and commissioning","€5,400.00"],["Total","€62,400.00"]],
         thinking:[["Pulled the site record","Two oil boilers, 2009, last serviced March"],
                   ["Priced from live stock","Plant is in stock at the Cork branch"],
                   ["Reused past wording","Lifted scope language from the Glanmire proposal you approved"],
                   ["Left a gap","No allowance for asbestos survey — flagged below"]],
         tools:[["records.read","read"],["files.read","read"],["email.send","external"]],
         risk:"No asbestos survey allowance. If the plant room needs one, add roughly €1,200."}},
      {id:"a5", title:"Payment run — 14 suppliers €48,920", subject:"Scheduled by Cash Watch · Friday 19 Sep", age:"1h", status:"awaiting you",
       steps:[{who:"Cash Watch",state:"proposed 09:40",dot:GREEN},{who:"Martin Kilbride",state:"pending",dot:AMBER}],
       work:{kind:"table", label:"PAYMENT RUN", viewLabel:"View run",
         headline:"Run PR-0238 · 14 payments", sub:"Leaves the AIB current account on Friday 19 Sep",
         cols:["Supplier","Due","Invoices","Amount"], align:["left","left","right","right"],
         rows:[["Munster Plumbing Supplies","19 Sep","3","€18,240.00"],
               ["Tyrrell Insulation","19 Sep","1","€9,110.00"],
               ["Kelleher Haulage","20 Sep","4","€7,480.00"],
               ["Cork Electrical Wholesale","19 Sep","2","€6,300.00"],
               ["10 others","19–24 Sep","11","€7,790.00"]],
         totals:[["Run total","€48,920.00"],["Account balance after","€61,380.00"],["Held back","€2,410.00"]],
         thinking:[["Read the ledger","31 invoices due inside seven days"],
                   ["Held two back","Tyrrell credit note unresolved, Dineen job in dispute"],
                   ["Checked the balance","Run leaves €61,380, above your €50k floor"],
                   ["Checked mandates","All 14 have current SEPA mandates on file"]],
         tools:[["invoices.read","read"],["payments.read","read"],["bank.payment.create","external"]],
         risk:"Two invoices held back total €2,410. They will age past 60 days if not paid next run."}},
      {id:"a3", title:"Write-off — INV-10233 €412", subject:"Glanmire Mechanical · raised by Aoife Nolan", age:"2 days", status:"approved",
       steps:[{who:"Aoife Nolan",state:"raised",dot:GREEN},{who:"Martin Kilbride",state:"approved",dot:GREEN}],
       work:{kind:"diff", label:"WRITE-OFF", viewLabel:"View write-off",
         headline:"INV-10233 · Glanmire Mechanical", sub:"Two fields change on approval",
         diff:[["Status","Past due 94 days","Written off"],["Balance","€412.00","€0.00"]],
         thinking:[["Checked the age","94 days past due, three chases sent"],
                   ["Checked the account","Company dissolved 12 August"],
                   ["Checked the amount","Below your €500 write-off threshold"]],
         tools:[["invoices.read","read"],["invoices.update","write"]],
         risk:"None. The counterparty no longer exists."}}
    ];
    const bucketOf = (a) => a.status === "approved" ? "Decided"
      : a.steps.some(s => s.state === "pending" && s.who === "Martin Kilbride") ? "Awaiting you" : "Awaiting others";
    const APPROVAL_COUNTS = {"Awaiting you":0, "Awaiting others":0, "Decided":0};
    APPROVALS.filter(a => !st.approved[a.id]).forEach(a => { APPROVAL_COUNTS[bucketOf(a)] += 1; });
    const approvalView = st.workViews.approvals || "Awaiting you";
    const pendingApprovals = APPROVAL_COUNTS["Awaiting you"];
    const approvalRows = APPROVALS.filter(a => !st.approved[a.id] && bucketOf(a) === approvalView).map(a => Object.assign({}, a, {
      statusStyle: "padding:3px 10px;border-radius:var(--r-sm,9px);font-size:11px;"
        + (a.status === "approved" ? "background:var(--ok-soft);color:" + GREEN : "background:var(--warn-soft);color:" + AMBER),
      pending: a.status !== "approved",
      viewLabel: a.work.viewLabel,
      openWork: () => this.setState({workDoc:a.id, workDocTab:"work"}),
      approve: () => this.setState(prev => ({approved: Object.assign({}, prev.approved, {[a.id]:true})}))
    }));
    const WORK_COUNTS = {
      tasks: st.addedTasks.concat(WORK_TASKS).filter(t => !(st.done[t.id] !== undefined ? st.done[t.id] : t.done)).length,
      approvals: APPROVALS.filter(a => !st.approved[a.id] && bucketOf(a) === "Awaiting you").length,
      workflows: OPS_DEFS.filter(w => w.kind !== "task" && (st.opsOff[w.id] === undefined ? w.on : !st.opsOff[w.id])).length,
      schedules: OPS_DEFS.filter(w => w.triggerKind === "schedule").length
    };
    const approvals = APPROVALS.filter(a => !st.approved[a.id] && bucketOf(a) === st.approvalFilter).map(a => Object.assign({}, a, {
      pending: a.status !== "approved",
      statusBg: a.status === "approved" ? "var(--ok-soft)" : "var(--warn-soft)",
      statusColor: a.status === "approved" ? GREEN : AMBER,
      viewLabel: a.work.viewLabel,
      openWork: () => this.setState({workDoc:a.id, workDocTab:"work"}),
      approve: () => this.setState({approved:Object.assign({}, st.approved, {[a.id]:true})})
    }));

    /* An approval is a decision about a piece of work, so the work itself has
       to be readable before the yes. The payload shape differs per request —
       a document, a table, a field-level change — and the viewer renders
       whichever one the approval carries, alongside the reasoning and the
       tools that will fire. */
    const wDoc = APPROVALS.find(a => a.id === st.workDoc);
    const effectTint = (fx) => fx === "read" ? FAINT : fx === "write" ? AMBER : RED;
    const workViewer = !wDoc ? {open:false} : (() => {
      const w = wDoc.work, tab = st.workDocTab || "work";
      const tabDef = [["work","The work"],["thinking","Thinking"],["trail","Trail"]];
      const lastTotal = (w.totals || [])[(w.totals || []).length - 1];
      const changed = (w.diff || []).filter(d => d[1] !== d[2]);
      /* The summary strip answers the question the kind of work actually
         raises: a purchase order is about lines and money, a limit change is
         about before and after, a document is about scope. */
      let facts = [];
      let kindIcon = "M6 3.5h9l3.5 3.5v13.5H6Z M15 3.5V7h3.5";
      if (w.kind === "table"){
        facts = [["Lines", String((w.rows || []).length)],
                 ["Value", lastTotal ? lastTotal[1] : "—"],
                 ["Terms", (w.sub || "").split(" · ").slice(-1)[0] || "—"]];
        kindIcon = "M4 6.5h16 M4 12h16 M4 17.5h16 M9 4v16";
      } else if (w.kind === "diff"){
        facts = [["Fields changing", String(changed.length)]]
          .concat(changed.slice(0, 2).map(d => [d[0], d[1] + " → " + d[2]]));
        kindIcon = "M4 8h9l-2.5-2.5 M20 16h-9l2.5 2.5";
      } else if (w.kind === "doc"){
        facts = [["Sections", String((w.doc || []).length)],
                 ["Value", lastTotal ? lastTotal[1] : (wDoc.title.match(/€[\d,\.]+/) || ["—"])[0]],
                 ["Prepared by", (wDoc.subject || "").indexOf("Helios") > -1 ? "Agent draft" : "Team"]];
        kindIcon = "M6 3.5h9l3.5 3.5v13.5H6Z M15 3.5V7h3.5 M9 12h6 M9 16h4";
      }
      const effects = (w.tools || []).filter(t => t[1] !== "read");
      return {
        open:true, id:wDoc.id, title:wDoc.title, subject:wDoc.subject, label:w.label,
        headline:w.headline,
        kindIcon,
        facts: facts.map(f => ({label:f[0], value:f[1]})),
        hasFacts: facts.length > 0,
        effectCount: effects.length ? String(effects.length) + " effect" + (effects.length === 1 ? "" : "s") + " on approval" : "No effects",
        effectStyle: "display:flex;align-items:center;gap:7px;height:26px;padding:0 11px;border-radius:var(--r-sm,9px);font-size:11px;"
          + (effects.length ? "background:var(--warn-soft);color:" + AMBER : "background:var(--ok-soft);color:" + GREEN),
        /* Decided approvals describe what happened, not what will. */
        sub: (wDoc.status === "approved" || st.approved[wDoc.id])
          ? w.sub.replace(" change on approval", " changed on approval").replace("On approval", "Applied")
          : w.sub,
        risk:w.risk, age:wDoc.age,
        pending: wDoc.status !== "approved" && !st.approved[wDoc.id],
        decided: wDoc.status === "approved" || st.approved[wDoc.id] === true,
        close: () => this.setState({workDoc:null}),
        approve: () => this.setState(prev => ({approved: Object.assign({}, prev.approved, {[wDoc.id]:true}), workDoc:null})),
        tabs: tabDef.map(t => ({
          label:t[1],
          style: "height:28px;padding:0 13px;border:0;border-radius:var(--r-ctl,9px);font-size:12.5px;cursor:pointer;transition:background .2s var(--ease),color .2s var(--ease);"
            + (tab === t[0] ? "background:var(--accent-fill,var(--accent));color:var(--on-accent);box-shadow:var(--accent-glow,none)" : "background:none;color:var(--dim)"),
          pick: () => this.setState({workDocTab:t[0]})
        })),
        onWork: tab === "work", onThinking: tab === "thinking", onTrail: tab === "trail",
        isDoc: w.kind === "doc", isTable: w.kind === "table", isDiff: w.kind === "diff",
        doc: (w.doc || []).map(d => ({heading:d[0], body:d[1]})),
        cols: (w.cols || []).map((c, i) => ({label:c,
          style: "padding:9px 12px;font-family:" + MONO + ";font-size:9px;letter-spacing:0.12em;color:var(--faint);text-align:" + (w.align[i] || "left")})),
        rows: (w.rows || []).map((r, ri) => ({
          cells: r.map((v, i) => ({v,
            style: "padding:11px 12px;font-size:12.5px;color:" + (i === 0 ? "var(--ink)" : "var(--body)")
              + ";text-align:" + (w.align[i] || "left")
              + (i > 1 ? ";font-family:" + MONO : "")})),
          style: "border-top:1px solid var(--border)" + (ri % 2 ? ";background:var(--surface-faint)" : "")
        })),
        hasTotals: (w.totals || []).length > 0,
        footer: wDoc.status === "approved" || st.approved[wDoc.id]
          ? "Decided. The trail is written against your name."
          : "Nothing has run yet. Approving fires " + (w.tools.filter(t => t[1] !== "read").map(t => t[0]).join(" and ") || "no effects") + ".",
        totals: (w.totals || []).map((t, i, arr) => ({label:t[0], value:t[1],
          style: "display:flex;align-items:baseline;gap:10px;padding:8px 2px"
            + (i === arr.length - 1 ? ";margin-top:4px;padding-top:11px;border-top:1px solid var(--border)" : ""),
          labelStyle: "flex:1;font-size:12.5px;color:" + (i === arr.length - 1 ? "var(--ink)" : "var(--dim)"),
          valueStyle: "font-family:" + MONO + ";font-size:" + (i === arr.length - 1 ? "15px" : "12.5px")
            + ";color:var(--ink)"})),
        diff: (w.diff || []).map(d => {
          const same = d[1] === d[2];
          return {field:d[0], from:d[1], to:d[2], same, changed: !same,
            rowStyle: "display:flex;align-items:center;gap:12px;padding:11px 13px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-sm,11px)"
              + (same ? ";opacity:.6" : ""),
            fromStyle: "font-family:" + MONO + ";font-size:12.5px;color:var(--faint)"
              + (same ? "" : ";text-decoration:line-through"),
            toStyle: "font-family:" + MONO + ";font-size:12.5px;color:" + (same ? "var(--dim)" : "var(--accent)")};
        }),
        thinking: (w.thinking || []).map((t, i) => ({n:String(i + 1), step:t[0], detail:t[1]})),
        tools: (w.tools || []).map(t => ({name:t[0], effect:t[1],
          style: "display:flex;align-items:center;gap:8px;padding:8px 11px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-sm,9px)",
          effectStyle: "font-family:" + MONO + ";font-size:9px;letter-spacing:0.1em;color:" + effectTint(t[1])})),
        steps: wDoc.steps
      };
    })();

    const cell = (v, opts) => Object.assign({v, isText:true, isBadge:false, avatar:false, font:"inherit", size:"13px", color:INK, avatarRadius:"50%", initials:"", badgeBg:"", badgeColor:""}, opts || {});
    const initials = (name) => name.split(" ").map(w => w[0].toUpperCase()).slice(0,2).join("");
    const statusBadge = (s) => {
      const map = {active:[GREEN,"var(--ok-soft)"], external:[DIM,"var(--track)"], inactive:[FAINT,"var(--track)"],
        "on stop":[RED,"var(--bad-soft)"], watch:[AMBER,"var(--warn-soft)"], "lease review":[AMBER,"var(--warn-soft)"]};
      const c = map[s] || [DIM,"var(--track)"];
      return cell(s, {isBadge:true, isText:false, badgeColor:c[0], badgeBg:c[1]});
    };





    // Deltas are tinted against the card they sit on: the lime tile has dark ink,
    // so the dark-card GREEN/AMBER/RED tokens are illegible on it.
    const delta = (dir, cardBg) => {
      const onLight = cardBg === LIME;
      if (onLight) return dir === "down" ? "var(--bad-on-accent)" : "var(--on-accent-2)";
      return dir === "up" ? GREEN : dir === "down" ? RED : AMBER;
    };
    const bars = (arr, hot) => arr.map((v,i,a) => ({h: Math.max(3, Math.round(v*28))+"px", bg: i === a.length-1 ? hot : "var(--track)"}));
    const limeBars = (arr) => arr.map((v,i,a) => ({h: Math.max(3, Math.round(v*28))+"px", bg: i === a.length-1 ? "var(--on-accent-strong)" : "var(--on-accent-soft)"}));
    const rangeLabel = {"7d":"7 days","30d":"30 days","90d":"90 days"}[st.range];
    const scale = {"7d":0.3,"30d":1,"90d":2.7}[st.range];
    const money = (n) => "€" + Math.round(n*scale).toLocaleString("en-IE");

    const metricGroups = [
      {title:"Operations", description:"Universal measures every deployment has.", hasBreakdown:true,
       metrics:[
        {label:"Revenue", value:money(412800), change:"+6.2%", changeColor:delta("up", LIME), hint:"vs previous "+rangeLabel,
         cardBg:LIME, cardBorder:LIME, ink:"var(--on-accent)", bars:limeBars([.4,.55,.44,.62,.5,.7,.6,.78,.68,1])},
        {label:"Tasks completed", value:String(Math.round(126*scale)), change:"+4", changeColor:delta("up"), hint:"7 overdue",
         cardBg:"var(--surface)", cardBorder:"var(--track)", ink:INK, bars:bars([.5,.6,.44,.7,.55,.75,.62,.8,.7,.9], LIME)},
        {label:"Overdue tasks", value:String(Math.max(1, Math.round(11*Math.min(scale,1.4)))), change:"+3", changeColor:delta("down"), hint:"worse than before",
         cardBg:"var(--surface)", cardBorder:"var(--bad-soft)", ink:INK, bars:bars([.3,.36,.3,.44,.4,.5,.46,.6,.7,.85], RED)},
        {label:"Approvals waiting", value:String(approvals.filter(a => a.pending).length), change:"−1", changeColor:delta("up"), hint:"oldest 18m",
         cardBg:"var(--surface)", cardBorder:"var(--track)", ink:INK, bars:bars([.4,.5,.44,.6,.5,.55,.48,.6,.5,.45], AMBER)}
       ],
       breakdown:[
        {key:"Head office", value:money(214600), pct:"72%", color:LIME},
        {key:"Ballincollig depot", value:money(156800), pct:"53%", color:"var(--track)"},
        {key:"Mallow yard", value:money(41400), pct:"18%", color:"var(--track)"}
       ]},
      {title:"site-visits", description:"Contributed by an installed module.", hasBreakdown:false,
       metrics:[
        {label:"Visits completed", value:String(Math.round(38*scale)), change:"+11%", changeColor:delta("up"), hint:"vs previous "+rangeLabel,
         cardBg:"var(--surface)", cardBorder:"var(--track)", ink:INK, bars:bars([.4,.5,.6,.5,.66,.6,.72,.66,.8,.9], LIME)},
        {label:"Unassigned", value:"1", change:"—", changeColor:delta("flat"), hint:"Thursday 09:00",
         cardBg:"var(--surface)", cardBorder:"var(--warn-soft)", ink:INK, bars:bars([.2,.3,.2,.4,.3,.25,.2,.3,.25,.4], AMBER)},
        {label:"Average duration", value:"1h 48m", change:"−6m", changeColor:delta("up"), hint:"across completed visits",
         cardBg:"var(--surface)", cardBorder:"var(--track)", ink:INK, bars:bars([.6,.55,.6,.5,.55,.48,.5,.46,.44,.4], LIME)},
        {label:"Cancelled", value:String(Math.round(3*scale)), change:"+1", changeColor:delta("flat"), hint:"client-side",
         cardBg:"var(--surface)", cardBorder:"var(--track)", ink:INK, bars:bars([.2,.24,.2,.3,.26,.34,.3,.4,.36,.5], AMBER)}
       ], breakdown:[]}
    ];

    const runBar = (state) => ({ok:"var(--accent)", partial:"var(--warn)", failed:"var(--bad)", idle:"var(--track)"})[state];
    const runs = (pattern) => pattern.map(p => ({bg:runBar(p), label:p}));
    const automations = [
      {name:"Overdue invoice reminder", state:"live", stateBg:"var(--ok-soft)", stateColor:GREEN,
       trigger:"schedule · daily 08:00", actions:[{label:"notify.email", border:"var(--bad-soft)", color:AMBER},{label:"tasks.create", border:"var(--track)", color:BODY}],
       lastRun:"Today 08:00", result:"6 of 10 sent · partial", resultColor:AMBER, hasRuns:true, runSummary:"11 ok · 3 partial",
       runs:runs(["ok","ok","partial","ok","ok","ok","partial","ok","ok","ok","ok","ok","partial","partial"])},
      {name:"Approval routing over €10k", state:"live", stateBg:"var(--ok-soft)", stateColor:GREEN,
       trigger:"event · core.approval.created", actions:[{label:"approvals.route", border:"var(--track)", color:BODY},{label:"notify.inbox", border:"var(--track)", color:BODY}],
       lastRun:"Today 08:54", result:"ok", resultColor:GREEN, hasRuns:true, runSummary:"14 ok",
       runs:runs(["ok","ok","ok","ok","ok","ok","ok","ok","ok","ok","ok","ok","ok","ok"])},
      {name:"Unassigned visit escalation", state:"live", stateBg:"var(--ok-soft)", stateColor:GREEN,
       trigger:"event · site-visits.visit.created", actions:[{label:"notify.inbox", border:"var(--track)", color:BODY}],
       lastRun:"Today 07:00", result:"ok", resultColor:GREEN, hasRuns:true, runSummary:"9 ok · 1 failed",
       runs:runs(["idle","idle","ok","ok","failed","ok","ok","ok","idle","ok","ok","ok","ok","ok"])},
      {name:"Xero invoice sync", state:"failing", stateBg:"var(--bad-soft)", stateColor:RED,
       trigger:"schedule · hourly", actions:[{label:"xero.post", border:"var(--bad-soft)", color:RED}],
       lastRun:"Today 02:14", result:"invalid_grant · dead-lettered", resultColor:RED, hasRuns:true, runSummary:"4 failed",
       runs:runs(["ok","ok","ok","ok","ok","ok","ok","ok","ok","ok","failed","failed","failed","failed"])}
    ];

    const health = [
      {label:"Events waiting", value:"12", hint:"oldest 4 minutes ago", color:INK, border:"var(--track)"},
      {label:"Being processed", value:"3", hint:"claimed by a worker", color:INK, border:"var(--track)"},
      {label:"Dead letters", value:"2", hint:"gave up after retrying", color:RED, border:"var(--bad-soft)"},
      {label:"Failed deliveries", value:"5", hint:"across 2 subscribers", color:AMBER, border:"var(--warn-soft)"}
    ];
    const failures = [
      {name:"Xero invoice sync", status:"failed", error:"invalid_grant: refresh token expired", at:"02:14", tagBg:"var(--bad-soft)", tagColor:RED},
      {name:"Overdue invoice reminder", status:"partial", error:"notify.email: 4 records missing billing_email", at:"08:00", tagBg:"var(--warn-soft)", tagColor:AMBER},
      {name:"Unassigned visit escalation", status:"failed", error:"notify.inbox: actor has no grant for core:notification:create", at:"Mon", tagBg:"var(--bad-soft)", tagColor:RED}
    ];
    const calls = [
      {tool:"xero.invoices.post", status:"failed", ms:"1,204 ms", at:"02:14", tagBg:"var(--bad-soft)", tagColor:RED},
      {tool:"whatsapp.messages.send", status:"ok", ms:"412 ms", at:"07:02", tagBg:"var(--ok-soft)", tagColor:GREEN},
      {tool:"resend.email.send", status:"ok", ms:"286 ms", at:"08:00", tagBg:"var(--ok-soft)", tagColor:GREEN},
      {tool:"resend.email.send", status:"failed", ms:"94 ms", at:"08:00", tagBg:"var(--bad-soft)", tagColor:RED},
      {tool:"anthropic.messages", status:"ok", ms:"2,940 ms", at:"09:11", tagBg:"var(--ok-soft)", tagColor:GREEN}
    ];

    const modules = [
      {label:"Pulse Core", id:"core", version:"0.1.0", state:"always installed", bg:"var(--surface)", border:"var(--track)",
       stateBg:"var(--track)", stateColor:BODY,
       description:"People, organisations, locations, teams and the relationships between them — registered through the same contract a module uses.",
       contributions:[{n:"31",k:"routes"},{n:"10",k:"nav items"},{n:"21",k:"events"},{n:"7",k:"predicates"},{n:"64",k:"permissions"}]},
      {label:"Site visits", id:"site-visits", version:"1.0.0", state:"installed", bg:"var(--accent-faint)", border:"var(--accent-line)",
       stateBg:"var(--accent-soft)", stateColor:LIME,
       description:"The fixture that proves the architecture holds: an entity with a real table, a predicate, two Helios tools, a metric, an event, a trigger, a page and a nav item. Not one line of core changes to install it.",
       contributions:[{n:"1",k:"entity"},{n:"2",k:"helios tools"},{n:"4",k:"metrics"},{n:"1",k:"predicate"},{n:"1",k:"trigger"}]},
      {label:"UI showcase", id:"ui-showcase", version:"0.1.0", state:"installed", bg:"var(--surface)", border:"var(--track)",
       stateBg:"var(--accent-soft)", stateColor:LIME,
       description:"Component sheet, directory and record fixtures used to review the primitives before they reach a client build.",
       contributions:[{n:"3",k:"pages"},{n:"1",k:"widget"},{n:"0",k:"tables"}]},
      {label:"Wholesale", id:"wholesale", version:"—", state:"available", bg:"var(--surface-faint)", border:"var(--track)",
       stateBg:"var(--track)", stateColor:FAINT,
       description:"Orders, price lists, stock and purchase orders. One line in this client's config would add its pages, permissions, events and Helios tools.",
       contributions:[{n:"6",k:"entities"},{n:"9",k:"helios tools"},{n:"12",k:"events"}]}
    ];

    const notificationFeed = [
      {dot:LIME, text:"Aoife Nolan assigned you “Approve purchase order PO-4471”", event:"core.approval.created", channel:"Inbox", meta:"18m"},
      {dot:RED, text:"Xero invoice sync failed — refresh token expired", event:"core.automation.failed", channel:"Inbox · WhatsApp", meta:"6h"},
      {dot:AMBER, text:"Helios flagged a change in Dunne & Sons payment behaviour", event:"core.notification.created", channel:"Inbox", meta:"2h"},
      {dot:AMBER, text:"Thursday's depot visit is still unassigned", event:"site-visits.visit.created", channel:"Inbox", meta:"2h"},
      {dot:NEUTRAL, text:"Séamus Byrne mentioned you on “Reassign Van 04 jobs”", event:"core.comment.created", channel:"Inbox", meta:"Yesterday"},
      {dot:NEUTRAL, text:"Your daily briefing is ready", event:"core.briefing.sent", channel:"WhatsApp", meta:"07:00"}
    ];

    const FEATURES = [["approvals","Approvals"],["automations","Automations"],["insights","Insights"],["customEntities","Custom entities"],["whatsapp","WhatsApp channel"],["composio","Composio actions"]];
    const features = FEATURES.map(f => {
      const on = st.flags[f[0]];

    return {label:f[1], trackBg: on ? "var(--accent)" : "var(--track)", knobLeft: on ? "19px" : "3px",
        knobBg: on ? "var(--on-accent)" : "var(--dim)",
        toggle: () => this.setState({flags:Object.assign({}, st.flags, {[f[0]]:!on})})};
    });

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
        {title:"Review approvals waiting on you", meta:"Work · approvals", hint:"ACTION", glyph:"action",
          go: () => this.setState({page:"Work", queue:"mine"})},
        {title:themeAction, meta:"Appearance", hint:"ACTION", glyph:"action",
          go: () => this.setState(p => p.theme === "light" ? {theme: p.darkTheme || this.props.theme || "harbour"} : {theme:"light", darkTheme:p.theme})},
        {title:"Open system health", meta:"Admin · modules and jobs", hint:"ACTION", glyph:"action",
          go: () => this.setState({page:"Settings"})}
      ]},
      {group:"Agents", scope:"Agents", items:st.agents.slice(0, 4).map(a => ({title:a.name, meta:a.role, hint:a.group ? "GROUP" : "AGENT", glyph:"agent",
        go: () => this.setState({page:"Agents", agentId:a.id})}))},
      {group:"Work", scope:"Work", items:TASKS.slice(0, 4).map(t => ({title:t.title, meta:t.subject + " · due " + t.due, hint:"TASK", glyph:"task",
        go: () => this.setState({page:"Work", queue:"mine"})}))},
      {group:"Records", scope:"Records", items:PEOPLE.slice(0, 3).map(p => ({title:p[0], meta:p[1] + " · " + p[3], hint:"PERSON", glyph:"person",
        go: () => this.setState({page:"Records", record:"person"})}))
        .concat(ORGS.slice(0, 3).map(o => ({title:o[0], meta:o[1] + " · " + o[2] + " outstanding", hint:"ORG", glyph:"org",
        go: () => this.setState({page:"Records", record:"org"})})))},
      {group:"Pages", scope:"Pages", items:ASPECT_DEFS.slice(0, 3).map(a => ({title:a.label, meta:a.description, hint:"AREA", glyph:"page",
        go: () => this.goPage("Dashboard", {aspect:a.id})}))
        .concat([{title:"Roles and grants", meta:"Who can see and do what", hint:"CONFIG", glyph:"page",
        go: () => this.setState({page:"Settings"})}])}
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
        {title:"Ask what changed today", meta:"Helios · briefing", icon:ICONS.helios, go: () => { clearInterval(this._t); this.setState({paletteOpen:false, query:"", page:"Home"}); this.ask("What changed today?"); }},
        {title:"Action inbox", meta:openKeys.length + " waiting on you", icon:ICONS.inbox, go: jump("Home", {open:null})},
        {title:"Edit widgets", meta:"Rearrange the right rail", icon:ICONS.dash, go: jump("Home", {widgetEdit:true})},
        {title:"My work", meta:"Tasks due today", icon:ICONS.work, go: jump("Work", {queue:"mine"})}
      ],
      Work: [
        {title:"Approvals awaiting you", meta:"Work · approvals", icon:ICONS.approvals, go: jump("Work", {workSection:"approvals"})},
        {title:"Overdue queue", meta:"Past the due time", icon:ICONS.work, go: jump("Work", {queue:"overdue"})},
        {title:"Unassigned", meta:"Nobody owns these yet", icon:ICONS.teams, go: jump("Work", {queue:"unassigned"})},
        {title:"Schedules", meta:"Recurring routines", icon:ICONS.visits, go: jump("Work", {workSection:"schedules"})}
      ],
      Records: [
        {title:"File tree", meta:"Browse indexed documents", icon:ICONS.files, go: jump("Records", {recSection:"files"})},
        {title:"Contacts", meta:"People and organisations", icon:ICONS.people, go: jump("Records", {recSection:"contacts"})},
        {title:"Ontology graph", meta:"How records relate", icon:ICONS.navRecords, go: jump("Records", {recSection:"ontology"})},
        {title:"New record", meta:"From a template", icon:ICONS.modules, go: () => this.setState({paletteOpen:false, query:"", page:"Records", newRecOpen:true, newRecName:"", newRecTemplate:"Field sheet"})}
      ],
      Dashboard: [
        {title:"Sales", meta:"Pipeline and quotes", icon:ICONS.insights, go: jump("Dashboard", {aspect:"sales"})},
        {title:"Cash", meta:"Owed, overdue, collected", icon:ICONS.navDash, go: jump("Dashboard", {aspect:"cash"})},
        {title:"Last 7 days", meta:"Shorten the range", icon:ICONS.autos, go: jump("Dashboard", {range:"7d"})},
        {title:"Edit metrics", meta:"Pick the five on top", icon:ICONS.dash, go: jump("Dashboard", {kpiEdit:true})}
      ],
      Agents: [
        {title:"Month-end close", meta:"Group of three agents", icon:ICONS.agents, go: jump("Agents", {agentId:"monthend"})},
        {title:"Credit Control", meta:"Watches payment behaviour", icon:ICONS.agents, go: jump("Agents", {agentId:"credit"})},
        {title:"Build an agent", meta:"Start from a blank brief", icon:ICONS.modules, go: () => this.setState({paletteOpen:false, query:"", page:"Agents", builderOpen:true, builderMode:"new"})},
        {title:"Tools and grants", meta:"What agents may do", icon:ICONS.navAdmin, go: jump("Settings")}
      ],
      Activity: [
        {title:"Needs attention", meta:"Failures and retries", icon:ICONS.health, go: jump("Activity", {actKpi:"attention"})},
        {title:"Agent events", meta:"Only what Helios did", icon:ICONS.agents, go: jump("Activity", {actKpi:"ai"})},
        {title:"People events", meta:"Only what the team did", icon:ICONS.people, go: jump("Activity", {actKpi:"people"})},
        {title:"Everything", meta:"Full audit trail", icon:ICONS.navActivity, go: jump("Activity", {actKpi:"all"})}
      ],
      Settings: [
        {title:"Roles and grants", meta:"Who can see and do what", icon:ICONS.navAdmin, go: jump("Settings")},
        {title:"Installed modules", meta:"What this client runs", icon:ICONS.modules, go: jump("Settings")},
        {title:"System health", meta:"Jobs, queues, sync", icon:ICONS.health, go: jump("Settings")},
        {title:"Automations", meta:"Triggers and runs", icon:ICONS.autos, go: jump("Settings")}
      ]
    };
    const palPageRaw = KITS[page] || [
      {title:"Ask Helios about this page", meta:"It sees what you see", icon:ICONS.helios, go: () => { this.setState({paletteOpen:false, query:"", page:"Home"}); this.ask("What should I know about " + page + "?"); }},
      {title:"Action inbox", meta:openKeys.length + " waiting on you", icon:ICONS.inbox, go: jump("Home")},
      {title:"My work", meta:"Tasks due today", icon:ICONS.work, go: jump("Work", {queue:"mine"})},
      {title:"Records", meta:"Every record you can see", icon:ICONS.navRecords, go: jump("Records")}
    ];
    const FREQ = [
      {title:"Action inbox", count:"31×", icon:ICONS.inbox, go: jump("Home")},
      {title:"Approvals", count:"24×", icon:ICONS.approvals, go: jump("Work", {workSection:"approvals"})},
      {title:"Overdue invoices", count:"18×", icon:ICONS.insights, go: jump("Dashboard", {aspect:"cash"})},
      {title:"Dunne & Sons Ltd", count:"12×", icon:ICONS.orgs, go: jump("Records", {recSection:"contacts", record:"org"})},
      {title:"Month-end close", count:"9×", icon:ICONS.agents, go: jump("Agents", {agentId:"monthend"})},
      {title:"Site visits", count:"7×", icon:ICONS.visits, go: jump("Work", {workSection:"schedules"})}
    ];
    const JUMPS = [
      {title:"Home", icon:ICONS.navHome, go: jump("Home")},
      {title:"Work", icon:ICONS.navWork, go: jump("Work")},
      {title:"Records", icon:ICONS.navRecords, go: jump("Records")},
      {title:"Dashboard", icon:ICONS.navDash, go: jump("Dashboard")},
      {title:"Agents", icon:ICONS.navAgents, go: jump("Agents")},
      {title:"Activity", icon:ICONS.navActivity, go: jump("Activity")},
      {title:"Settings", icon:ICONS.navAdmin, go: jump("Settings")}
    ];
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

    const DIRS_ORDER = ["People","Organisations","Teams","Locations","Site visits"];
    const ADMIN_ORDER = ["Automations","System health","Installed modules"];
    let contextNav, contextHint, searchHint;
    if (page === "Settings"){
      contextNav = ADMIN_GROUPS.map(grp => seg(
        grp[0].charAt(0) + grp[0].slice(1).toLowerCase(),
        st.adminGroup === grp[0],
        () => this.setState({adminGroup: st.adminGroup === grp[0] ? null : grp[0]}),
        String(ADMIN_CARDS.filter(c => c.group === grp[0]).length)));
      contextHint = "ADMIN · 13 AREAS";
      searchHint = "Search settings";
    } else if (page === "Activity"){
      contextNav = [["all","Everything"],["people","People"],["ai","Agents"],["attention",(st.w - (st.railOpen ? 252 : 68)) < 1000 ? "Attention" : "Needs attention"]]
        .map(k => seg(k[1], st.actKpi === k[0], () => this.setState({actKpi:k[0]})));
      contextHint = st.actPaused ? "LIVE VIEW PAUSED" : "LIVE · EVENT LOG";
      searchHint = "Search the audit trail";
    } else if (page === "Records"){
      contextNav = REC_SECTIONS.map(s => seg(s.label, st.recSection === s.id,
        () => this.setState({recSection:s.id})));
      contextHint = "RECORDS · " + recSec.label.toUpperCase();
      searchHint = recSec.id === "ontology" ? "Search the ontology" : "Search " + recSec.label.toLowerCase();
    } else if (page === "Work"){
      contextNav = WORK_SECTIONS.map(s => seg(s.label, st.workSection === s.id,
        () => this.setState({workSection:s.id, opsOpen:null}), String(WORK_COUNTS[s.id])));
      contextHint = "WORK · " + workSec.label.toUpperCase();
      searchHint = "Search " + workSec.label.toLowerCase();
    } else if (page === "Home" || page === "Dashboard"){
      contextNav = [
        seg("Home", page === "Home", () => this.go("Home")),
        seg("Dashboard", page === "Dashboard", () => this.go("Dashboard"))
      ];
      contextHint = page === "Home" ? "HELIOS · " + openKeys.length + " WAITING" : "CRM · " + areaLabel.toUpperCase();
      searchHint = page === "Dashboard" ? "Search the dashboard" : "Search every record you can see";
    } else if (page === "Agents"){
      contextNav = [];
      contextHint = "";
      searchHint = "Search agents";
    } else if (page === "Action inbox"){
      contextNav = ["All","Approvals","Alerts","Work","Automations"].map(fl =>
        seg(fl, st.inboxFilter === fl, () => this.setState({inboxFilter:fl, open:null}),
          fl === "All" ? String(openKeys.length) : String(openKeys.filter(k => ITEMS[k].group === fl).length)));
      contextHint = "PROVIDERS · CORE + MODULES";
      searchHint = "Search the inbox";
    } else if (page === "Work"){
      contextNav = [["mine","My work"],["team","Team"],["overdue","Overdue"],["upcoming","Next 7 days"],["unassigned","Unassigned"],["all","Everything"]]
        .map(q => seg(q[1], st.queue === q[0], () => this.setState({queue:q[0]}), String(queueCounts[q[0]])));
      contextHint = "QUEUES · CORE:TASK:VIEW";
      searchHint = "Search tasks";
    } else if (page === "Insights"){
      contextNav = [["7d","7 days"],["30d","30 days"],["90d","90 days"]].map(r => seg(r[1], st.range === r[0], () => this.setState({range:r[0]})));
      contextHint = "METRICS FROM THE REGISTRY";
      searchHint = "Search metrics";
    } else if (DIRS_ORDER.indexOf(page) > -1){
      contextNav = DIRS_ORDER.map(d => seg(d, page === d, () => this.go(d)));
      contextHint = "DIRECTORY · SPINE-BACKED";
      searchHint = "Search " + page.toLowerCase();
    } else if (page === "Approvals"){
      contextNav = ["Awaiting you","Awaiting others","Decided"].map(s =>
        seg(s, st.approvalFilter === s, () => this.setState({approvalFilter:s}),
          String(APPROVAL_COUNTS[s])));
      contextHint = "STEPS · CORE:APPROVAL:DECIDE";
      searchHint = "Search approvals";
    } else if (ADMIN_ORDER.indexOf(page) > -1){
      contextNav = ADMIN_ORDER.map(a => seg(a, page === a, () => this.go(a)));
      contextHint = "ADMIN · CORE:AUTOMATION:VIEW";
      searchHint = "Search automations and runs";
    } else if (page === "Settings"){
      contextNav = ADMIN_GROUPS.map(g => seg(g.name.charAt(0) + g.name.slice(1).toLowerCase(), false, () => {}));
      contextHint = "ADMIN · CONFIGURATION";
      searchHint = "Search settings";
    } else {
      contextNav = [seg(page, true, () => {}), seg("Home", false, () => this.go("Home"))];
      contextHint = "CLIENT CONFIG";
      searchHint = "Search this page";
    }

    // Below these widths the nav keeps its room and the softer furniture gives way:
    // the context hint first, then the search label, then the profile text.
    const roomy = st.w >= 1320, mid = st.w >= 1120;
    return {
      nav, contextNav, contextHint, searchHint, queueTasks,
      isRecords: page === "Records",
      isActivity: page === "Activity",
      act: actModel,
      admin: adminModel,
      showRecordsWash: page === "Records" && recSec.id !== "ontology",
      rec: recModel, tree: treeModel, onto: ontoModel, newRec: newRecModel, graph: graphModel,

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
      showPillNav: page !== "Agents",

      /* home widgets */
      widgetHint: st.widgetEdit ? "EDITING BOARD" : String(st.widgets.length) + " WIDGETS",
      widgetEdit: st.widgetEdit,
      toggleWidgetEdit: () => this.setState(prev => ({widgetEdit: !prev.widgetEdit})),
      widgetEditLabel: st.widgetEdit ? "Done" : "Edit",
      widgetEditBg: st.widgetEdit ? "var(--accent)" : "var(--surface)",
      widgetEditBorder: st.widgetEdit ? "var(--accent)" : "var(--border)",
      widgetEditColor: st.widgetEdit ? "var(--on-accent)" : "var(--dim)",
      widgetChoices: WIDGET_DEFS.filter(w => st.widgets.indexOf(w[0]) < 0)
        .map(w => ({label:w[1], add: () => this.toggleIn("widgets", w[0])})),
      noWidgetChoices: WIDGET_DEFS.every(w => st.widgets.indexOf(w[0]) > -1),
      show: {
        inbox: st.widgets.indexOf("inbox") > -1, work: st.widgets.indexOf("work") > -1,
        activity: st.widgets.indexOf("activity") > -1, kpi: st.widgets.indexOf("kpi") > -1,
        visits: st.widgets.indexOf("visits") > -1
      },
      removeInbox: () => this.toggleIn("widgets", "inbox"),
      removeWork: () => this.toggleIn("widgets", "work"),
      removeActivity: () => this.toggleIn("widgets", "activity"),
      removeKpi: () => this.toggleIn("widgets", "kpi"),
      removeVisits: () => this.toggleIn("widgets", "visits"),
      miniKpis: ["revenue","overdue","jobs","margin"].map(k => {
        const d = KPI_DEFS[k];
        return {label:d.label, value:d.value, delta:d.delta, deltaColor: d.dir === "up" ? GREEN : RED};
      }),
      visitWidget: [
        {title:"Boiler service · Casey Builders", when:"Wed 09:00", dot:LIME},
        {title:"Pre-install survey · Ó Riain", when:"Wed 14:00", dot:LIME},
        {title:"Depot check · Ballincollig", when:"Thu 09:00", dot:AMBER}
      ],

      /* dashboard */
      isDashboard: page === "Dashboard",
      dashTitle: "Kilbride Group · " + areaLabel,
      kpiEdit: st.kpiEdit,
      toggleKpiEdit: () => this.setState(prev => ({kpiEdit: !prev.kpiEdit})),
      kpiEditLabel: st.kpiEdit ? "Done" : "Edit KPIs",
      kpiEditBg: st.kpiEdit ? "var(--on-accent)" : "var(--on-accent-soft)",
      kpiEditBorder: st.kpiEdit ? "var(--on-accent)" : "var(--on-accent-soft)",
      kpiEditColor: st.kpiEdit ? "var(--accent)" : "var(--on-accent)",
      kpiColumns: String(Math.max(1, st.kpiKeys.length)),
      kpis: st.kpiKeys.map((k, ki) => {
        const d = KPI_DEFS[k];
        const up = d.dir === "up";
        return {label:d.label, value:this.countValue(d.value, ki), delta:d.delta, hint:d.hint,
          bg: "var(--kpi-card)",
          border: "var(--kpi-card)",
          ink: "var(--kpi-ink)",
          deltaColor: up ? "var(--kpi-up)" : "var(--kpi-down)",
          arrow: up ? "M12 19V7 M6 12l6-6 6 6" : "M12 5v12 M6 12l6 6 6-6",
          arrowStyle: "flex:none;animation:" + (up ? "driftUp" : "driftDown") + " 2.4s ease-in-out "
            + (ki * 180) + "ms infinite",
          valueStyle: "font-size:22px;font-weight:500;letter-spacing:-.8px;margin-top:7px;line-height:1;"
            + "font-variant-numeric:tabular-nums;animation:kpiRoll .62s var(--ease) " + (ki * 70) + "ms both",
          remove: () => this.toggleIn("kpiKeys", k)};
      }),
      kpiChoices: Object.keys(KPI_DEFS).filter(k => st.kpiKeys.indexOf(k) < 0)
        .map(k => ({label:KPI_DEFS[k].label, add: () => this.toggleIn("kpiKeys", k)})),
      noKpiChoices: Object.keys(KPI_DEFS).every(k => st.kpiKeys.indexOf(k) > -1),
      aspectTrack: segTrack("flex:0 1 auto;overflow:hidden"),
      aspectThumb: (() => {
        const ids = ASPECT_DEFS.map(a => a.id).concat(st.extraFilters);
        return segThumb(ids.length, Math.max(0, ids.indexOf(st.aspect)), "var(--pill-bg)");
      })(),
      // One area at a time: the slider selects, it does not accumulate.
      aspects: ASPECT_DEFS.map(a => ({
        label:a.label, color:a.color,
        active: st.aspect === a.id, inactive: st.aspect !== a.id,
        pick: () => { this.setState({aspect:a.id}); this.startKpiCount(); }
      })).concat(st.extraFilters.map(name => ({
        label:name, color:"var(--accent)",
        active: st.aspect === name, inactive: st.aspect !== name,
        pick: () => { this.setState({aspect:name}); this.startKpiCount(); }
      }))),
      area: (() => {
        const a = ASPECT_DEFS.find(x => x.id === st.aspect) || synthesizeCustomArea(st.aspect);
        if (!a) return {title: st.aspect, description:"Custom filter — no metrics registered against it yet.",
          owner:"CUSTOM", color:"var(--accent)", metrics:[], chart:[], chartTitle:"No series", chartUnit:"",
          splitTitle:"No breakdown", split:[], tableCols:["Name","Value","Change","Note"], table:[]};
        const isCustom = !ASPECT_DEFS.find(x => x.id === st.aspect);
        const peak = Math.max.apply(null, a.chart.map(c => c[1]));
        return {
          title:a.label, description:a.description, owner:a.owner, color:a.color,
          isCustom, customBadge: isCustom ? "GENERATED FROM PLAIN ENGLISH" : "",
          metrics: a.metrics.map((m, mi) => ({
            delay: (mi * 70) + "ms",
            label:m[0], value:m[1], delta:m[2], hint:m[4],
            deltaColor: m[3] === "up" ? GREEN : RED,
            bars: m[5].map((v, i, arr) => ({h: Math.max(3, Math.round(v * 24)) + "px",
              bg: i === arr.length - 1 ? a.color : "var(--track)"})),
            isHero: false, cardStyle: "", valueStyle: "", barsStyle: ""
          })).map((m, i, arr) => {
            const hero = (a.kind === "columns" || a.kind === "area") && i === 0;
            const card = "display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:var(--card-r,18px);"
              + "backdrop-filter:blur(20px) saturate(1.3);box-shadow:var(--card-shadow);padding:18px 20px 20px;"
              + "transition:transform .32s cubic-bezier(.16,1.4,.3,1),border-color .22s var(--ease),box-shadow .3s var(--ease);"
              + "animation:springIn .5s var(--ease) both;animation-delay:" + m.delay + ";"
              + (hero ? "border-color:var(--border-strong)" : "");
            return Object.assign(m, {
              isHero: hero,
              cardStyle: card,
              valueStyle: "font-weight:500;letter-spacing:-.8px;margin-top:9px;line-height:1;font-size:" + (hero ? "34px" : "24px"),
              barsStyle: "display:flex;align-items:flex-end;gap:3px;margin-top:auto;padding-top:14px;height:" + (hero ? "40px" : "26px")
            });
          }),
          /* Structure follows the shape of the data. A trend aspect leads with
             one hero metric and a tall chart; a ranking or funnel aspect is
             short, so its metrics stay equal and the two cards share the row
             evenly — that is what keeps the second row from leaving a hole. */
          metricGrid: (a.kind === "columns" || a.kind === "area")
            ? "display:grid;grid-template-columns:1.7fr 1fr 1fr 1fr;gap:12px;align-items:stretch"
            : a.kind === "dots"
              ? "display:grid;grid-template-columns:repeat(2,1fr);gap:12px;align-items:stretch"
              : "display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:stretch",
          mainGrid: (a.kind === "rows" || a.kind === "funnel")
            ? "display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;align-items:stretch"
            : a.kind === "stacked"
              ? "display:grid;grid-template-columns:1.35fr 1fr;gap:12px;margin-top:12px;align-items:stretch"
              : "display:grid;grid-template-columns:1.6fr 1fr;gap:12px;margin-top:12px;align-items:stretch",
          /* The footer totals the rows it sits under — parsed from the row
             values themselves, so it can never drift into quoting an
             unrelated metric. Euro rows total in euro, counts in counts. */
          splitUnit: (() => {
            const v = (a.split[0] || [])[1] || "";
            return /€/.test(v) ? "EUR" : "COUNT";
          })(),
          splitFootLabel: "TOTAL",
          splitFootValue: (() => {
            if (!a.split.length) return "—";
            const raw = a.split.map(r => String(r[1]));
            const euro = /€/.test(raw[0]);
            const nums = raw.map(v => {
              const n = parseFloat(v.replace(/[^0-9.]/g, "")) || 0;
              return /k/i.test(v) ? n * 1000 : n;
            });
            const sum = nums.reduce((t, n) => t + n, 0);
            if (!euro) return sum.toLocaleString();
            return sum >= 1000
              ? "€" + (sum / 1000).toFixed(1).replace(/\.0$/, "") + "k"
              : "€" + Math.round(sum).toLocaleString();
          })(),
          chartTitle:a.chartTitle, chartUnit:a.chartUnit,
          chart: a.chart.map(c => ({label:c[0], value:c[2],
            h: Math.max(6, Math.round(100 * c[1] / peak)) + "%",
            bg: c[1] === peak ? a.color : "var(--track)",
            labelOpacity: c[1] === peak ? "1" : "0.55"})),
          // The chart form follows the data: a trend gets a line, a mix gets a
          // funnel or stack, a ranking gets rows, a target gets a dot plot.
          isColumns: a.kind === "columns", isArea: a.kind === "area", isFunnel: a.kind === "funnel",
          isStacked: a.kind === "stacked", isRows: a.kind === "rows", isDots: a.kind === "dots",
          gridLines: [0, 1, 2, 3].map(i => ({y: 10 + i * 40})),
          areaPath: (() => {
            const pts = a.chart.map((c, i) => [i * (600 / (a.chart.length - 1)), 140 - 130 * (c[1] / peak)]);
            return "M0," + 150 + " L" + pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" L") + " L600,150 Z";
          })(),
          linePath: (() => {
            const pts = a.chart.map((c, i) => [i * (600 / (a.chart.length - 1)), 140 - 130 * (c[1] / peak)]);
            return "M" + pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" L");
          })(),
          points: a.chart.map((c, i) => ({
            x: (i * (600 / (a.chart.length - 1))).toFixed(1),
            y: (140 - 130 * (c[1] / peak)).toFixed(1),
            r: c[1] === peak ? 5 : 3.2
          })),
          funnel: (a.funnel || []).map((s, i, arr) => ({
            label:s[0], value:s[1], rate:s[2],
            pct: Math.round(100 * s[3] / arr[0][3]) + "%",
            bg: i === 0 ? a.color : i === arr.length - 1 ? "var(--surface-2)" : "var(--neutral)",
            ink: i === 0 ? "var(--on-accent)" : "var(--ink)"
          })),
          stacked: (a.stacked || []).map(col => {
            const total = col[1].reduce((x, y) => x + y, 0);
            const colMax = Math.max.apply(null, a.stacked.map(c => c[1].reduce((x, y) => x + y, 0)));
            return {label:col[0], h: Math.max(8, Math.round(100 * total / colMax)) + "%",
              parts: col[1].map((v, i) => ({
                flex: String(v), title: a.legend[i] + ": " + v,
                radius: i === 0 ? "5px 5px 2px 2px" : "2px",
                bg: [a.color, "var(--neutral)", "var(--track)"][i]
              }))};
          }),
          legend: (a.legend || []).map((l, i) => ({label:l, bg: [a.color, "var(--neutral)", "var(--track)"][i]})),
          rows: (a.rows || []).map(r => {
            const rmax = Math.max.apply(null, a.rows.map(x => x[2]));
            return {label:r[0], value:r[1], pct: Math.max(4, Math.round(100 * r[2] / rmax)) + "%",
              bg: r[2] === rmax ? a.color : "var(--neutral)"};
          }),
          targetY: (140 - 130 * (a.target / peak)).toFixed(1),
          targetLabel: a.targetLabel || "",
          dots: a.chart.map((c, i) => ({
            x: (i * (600 / (a.chart.length - 1))).toFixed(1),
            y: (140 - 130 * (c[1] / peak)).toFixed(1),
            r: c[1] <= a.target ? 5.5 : 4,
            fill: c[1] <= a.target ? a.color : "var(--bg)",
            stroke: c[1] <= a.target ? a.color : "var(--neutral)"
          })),
          splitTitle:a.splitTitle,
          split: a.split.map(s => ({key:s[0], value:s[1], pct:s[2],
            color: s[3] ? a.color : "var(--neutral)"})),
          tableCols:a.tableCols,
          table: a.table.map(r => ({cells:[
            {v:r[0], font:"inherit", color:INK},
            {v:r[1], font:MONO, color:INK},
            {v:r[2], font:MONO, color: /^[−-]/.test(r[2]) ? RED : GREEN},
            {v:r[3], font:"inherit", color:DIM}
          ]}))
        };
      })(),
      filterMenuOpen: st.filterMenuOpen,
      toggleFilterMenu: () => this.setState(prev => ({filterMenuOpen: !prev.filterMenuOpen})),
      filterGroups: FILTER_GROUPS.map(g => ({title:g.title, items:g.items.map(label => {
        const asp = ASPECT_DEFS.find(a => a.label === label);
        const on = asp ? st.aspect === asp.id : st.aspect === label;
        return {label,
          style: "height:30px;padding:0 13px;border-radius:var(--r-ctl,9px);cursor:pointer;font-size:12px;white-space:nowrap;"
            + "transition:border-color .2s var(--ease),background .2s var(--ease),color .2s var(--ease);"
            + (on ? "background:var(--accent-faint);border:1px solid var(--accent-line);color:var(--ink)"
                  : "background:var(--surface-2);border:1px solid var(--border);color:var(--body)"),
          pick: () => asp ? (this.setState({aspect:asp.id, filterMenuOpen:false}), this.startKpiCount())
            : this.setState(prev => ({aspect:label, filterMenuOpen:false,
                extraFilters: prev.extraFilters.indexOf(label) > -1 ? prev.extraFilters : prev.extraFilters.concat([label])}))};
      })})),
      customFilter: st.customFilter,
      setCustomFilter: (e) => this.setState({customFilter:e.target.value}),
      onCustomFilterKey: (e) => { if (e.key === "Enter") this.addCustom(); },
      addCustomFilter: () => this.addCustom(),

      /* work: tasks, approvals, workflows, schedules */
      work: (() => {
        const sec = WORK_SECTIONS.find(s => s.id === st.workSection) || WORK_SECTIONS[0];
        const ico = {
          open:"M4 6.5h3 M4 12h3 M4 17.5h3 M10 6.5h10 M10 12h10 M10 17.5h10",
          today:"M8 4v3 M16 4v3 M4.5 9.5h15 M6.4 6h11.2A1.9 1.9 0 0 1 19.5 8v10a1.9 1.9 0 0 1-1.9 1.9H6.4A1.9 1.9 0 0 1 4.5 18V8A1.9 1.9 0 0 1 6.4 6Z",
          overdue:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7.6v5 M12 16h.01",
          done:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M8.4 12.2l2.4 2.4 4.8-4.8"
        };
        const stats = {
          tasks: [["OPEN FOR ME", String(openWork.length), INK, ico.open],
                  ["DUE TODAY", String(WORK_TASKS.filter(t => /today|12:00/i.test(t.due) && !st.done[t.id]).length), INK, ico.today],
                  ["OVERDUE", String(WORK_TASKS.filter(t => t.late && !st.done[t.id]).length), RED, ico.overdue],
                  ["DONE BY ME", String(WORK_TASKS.filter(t => st.done[t.id] || t.done).length), INK, ico.done]],
          approvals: [["AWAITING YOU", String(pendingApprovals), AMBER, ico.open],
                  ["AWAITING OTHERS", "1", INK, ico.today],
                  ["OVER THRESHOLD", "2", INK, ico.overdue],
                  ["DECIDED THIS MONTH", "9", INK, ico.done]],
          workflows: [["LIVE", "3", INK, ico.open],
                  ["RUNS TODAY", "42", INK, ico.today],
                  ["FAILING", "1", RED, ico.overdue],
                  ["OK LAST 14 DAYS", "96%", INK, ico.done]],
          workflows: [], schedules: []
        }[sec.id];
        return {
          title:sec.label, blurb:sec.blurb,
          isTasks: sec.id === "tasks", isApprovals: sec.id === "approvals",
          isWorkflows: sec.id === "workflows", isSchedules: sec.id === "schedules",
          showBlurb: sec.id === "workflows" || sec.id === "schedules",
          showOpsHeader: sec.id === "workflows" || sec.id === "schedules",
          hasStats: sec.id === "tasks" || sec.id === "approvals", hasViews: sec.views.length > 0,
          add: () => this.setState({workSection:"tasks"}),
          stats: stats.map(s => ({label:s[0], value:s[1], color:s[2], icon:s[3]})),
          filters: sec.filters,
          viewTrack: segTrack(""),
          viewThumb: segThumb(sec.views.length, Math.max(0, sec.views.indexOf(workView)), "var(--pill-bg)"),
          views: sec.views.map(v => ({label:v, active: workView === v, inactive: workView !== v,
            pick: () => this.setState(prev => ({workViews: Object.assign({}, prev.workViews, {[sec.id]: v})}))}))
        };
      })(),
      timer: (() => {
        const running = st.timerRunning, task = st.timerTask;
        return {
          eyebrow:"FOCUS TIMER",
          state: running ? "RUNNING" : task ? "PAUSED" : "IDLE",
          stateColor: running ? LIME : "var(--faint)",
          display: st.timerPreset ? String(st.timerPreset).padStart(2, "0") + ":00" : "00:00",
          ringColor: running ? LIME : "var(--border)",
          /* A second, inset ring — it turns slowly while the timer runs. */
          innerRingStyle: "position:absolute;inset:9px;border-radius:50%;border:1px solid "
            + (running ? LIME : "var(--border)") + ";opacity:" + (running ? ".8" : ".45"),
          title: task || "No task started",
          subtitle: task ? "Timing this task. Stopping logs the minutes against it."
            : "Hit Start on a task, or pick a preset",
          presets: [15, 25, 50].map(m => ({label:m + "m",
            style: "height:30px;padding:0 13px;border-radius:var(--r-ctl,9px);cursor:pointer;font-size:12px;white-space:nowrap;"
              + "transition:background .2s var(--ease),border-color .2s var(--ease),color .2s var(--ease);"
              + (st.timerPreset === m ? "background:var(--accent-faint);border:1px solid var(--accent-line);color:var(--ink)"
                                      : "background:var(--surface-2);border:1px solid var(--border);color:var(--body)"),
            pick: () => this.setState({timerPreset:m})})),
          buttonBg: running ? "var(--surface-2)" : "var(--ink)",
          buttonInk: running ? "var(--ink)" : "var(--bg)",
          buttonLabel: running ? "Pause" : "Start",
          buttonIcon: running ? "M9 5.5v13 M15 5.5v13" : "M7 4.5v15l13-7.5-13-7.5Z",
          toggle: () => this.setState(prev => ({timerRunning: !prev.timerRunning,
            timerTask: prev.timerTask || "Chase INV-10428 — Dunne & Sons",
            timerPreset: prev.timerPreset || 25})),
          reset: () => this.setState({timerRunning:false, timerTask:null, timerPreset:null}),
          complete: () => this.setState({timerRunning:false, timerTask:null})
        };
      })(),
      newTask: st.newTask,
      setNewTask: (e) => this.setState({newTask:e.target.value}),
      onNewTaskKey: (e) => { if (e.key === "Enter") this.addWorkTask(); },
      addTask: () => this.addWorkTask(),
      newPriority: st.newPriority,
      newPriorityBg: st.newPriority === "High" ? "var(--warn-soft)" : st.newPriority === "Low" ? "var(--surface-2)" : "var(--accent-faint)",
      newPriorityBorder: st.newPriority === "High" ? "var(--warn-soft)" : st.newPriority === "Low" ? "var(--border)" : "var(--accent-line)",
      newPriorityColor: st.newPriority === "High" ? AMBER : st.newPriority === "Low" ? DIM : "var(--ink)",
      cyclePriority: () => this.setState(prev => ({newPriority:
        prev.newPriority === "High" ? "Medium" : prev.newPriority === "Medium" ? "Low" : "High"})),
      workTasks: allWorkTasks.filter(t => workView === "All tasks" || t.view === workView
          || (workView === "Done" && (st.done[t.id] || t.done))).map(t => {
        const done = st.done[t.id] !== undefined ? st.done[t.id] : !!t.done;
        const statusTint = {"In progress":[LIME,"var(--accent-faint)"], "Review":[AMBER,"var(--warn-soft)"],
          "Not started":[DIM,"var(--track)"], "Done":[GREEN,"var(--ok-soft)"]}[done ? "Done" : t.status] || [DIM,"var(--track)"];
        return {
          title:t.title, who:t.who, priority:t.priority,
          status: done ? "Done" : t.status,
          checkOpacity: done ? "1" : "0", fill: done ? LIME : "transparent",
          ring: done ? LIME : "var(--border-strong)",
          color: done ? FAINT : INK, strike: done ? "line-through" : "none",
          statusStyle: "flex:none;display:flex;align-items:center;gap:7px;padding:5px 12px;border-radius:7px;font-size:12px;"
            + "background:" + statusTint[1] + ";color:" + statusTint[0],
          statusDot: "width:6px;height:6px;border-radius:2px;background:" + statusTint[0],
          prioStyle: "flex:none;display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:7px;font-size:12px;"
            + (t.priority === "High" ? "background:var(--warn-soft);color:" + AMBER
               : t.priority === "Low" ? "background:var(--track);color:" + DIM
               : "background:var(--accent-faint);color:var(--ink)"),
          meta: [
            {label:t.due, icon:"M8 4v3 M16 4v3 M4.5 9.5h15 M6.4 6h11.2A1.9 1.9 0 0 1 19.5 8v10a1.9 1.9 0 0 1-1.9 1.9H6.4A1.9 1.9 0 0 1 4.5 18V8A1.9 1.9 0 0 1 6.4 6Z",
             color: t.late && !done ? RED : DIM},
            {label:t.client, icon:"M4.5 20V6.4A1.4 1.4 0 0 1 5.9 5h6.2a1.4 1.4 0 0 1 1.4 1.4V20 M13.5 10.5h4.6A1.4 1.4 0 0 1 19.5 12v8 M3 20h18", color:DIM},
            {label:t.day, icon:"M7 4.5v3 M17 4.5v3 M4 10h16 M5.6 6.6h12.8A1.6 1.6 0 0 1 20 8.2v10.2a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18.4V8.2a1.6 1.6 0 0 1 1.6-1.6Z", color:DIM},
            {label:t.mins, icon:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7.6V12l3 1.8", color:DIM}
          ],
          toggle: () => this.setState(prev => ({done: Object.assign({}, prev.done, {[t.id]: !done})})),
          start: () => this.setState({timerTask:t.title, timerRunning:true, timerPreset: st.timerPreset || 25})
        };
      }),
      workTasksEmpty: allWorkTasks.filter(t => workView === "All tasks" || t.view === workView).length === 0,
      workViewer: workViewer,
      workApprovals: approvalRows,
      workApprovalsEmpty: approvalRows.length === 0,
      ops: opsModel,
      cal: calModel,
      detail: detailModel,
      builder: builderModel,
      _unusedWorkflows: WORKFLOWS.map(w => ({
        name:w.name, trigger:w.trigger, lastRun:w.lastRun, result:w.result, runSummary:w.runSummary,
        state:w.state,
        stateStyle: "padding:3px 10px;border-radius:var(--r-sm,9px);font-size:11px;"
          + (w.state === "live" ? "background:var(--ok-soft);color:" + GREEN : "background:var(--bad-soft);color:" + RED),
        resultColor: w.resultKind === "ok" ? GREEN : w.resultKind === "warn" ? AMBER : RED,
        actions: w.actions.map(a => ({label:a[0],
          style: "padding:5px 11px;border-radius:var(--r-sm,9px);background:var(--surface-2);font-family:" + MONO + ";font-size:10.5px;"
            + (a[1] === "external" ? "border:1px solid var(--bad-soft);color:" + RED
               : a[1] === "write" ? "border:1px solid var(--warn-soft);color:" + AMBER
               : "border:1px solid var(--border);color:" + BODY)})),
        runs: w.runs.map(r => ({label:r,
          bg: {ok:"var(--accent)", partial:"var(--warn)", failed:"var(--bad)", idle:"var(--track)"}[r]}))
      })),
      schedules: SCHEDULES.map(s => {
        const on = st.scheduleOff[s.id] === undefined ? s.on : !st.scheduleOff[s.id];
        return {name:s.name, cadence:s.cadence, owner:s.owner,
          next: on ? s.next : "Paused",
          tileBg: on ? "var(--accent-faint)" : "var(--track)",
          tileColor: on ? "var(--accent)" : DIM,
          trackBg: on ? "var(--accent)" : "var(--track)",
          knobLeft: on ? "19px" : "3px",
          knobBg: on ? "var(--on-accent)" : DIM,
          toggle: () => this.setState(prev => ({scheduleOff: Object.assign({}, prev.scheduleOff, {[s.id]: on})}))};
      }),
      scheduleWeek: ["MON","TUE","WED","THU","FRI","SAT","SUN"].map((d, i) => {
        const n = [3, 3, 3, 4, 4, 0, 1][i];
        return {label:d, count: n ? String(n) : "—",
          cellStyle: "margin-top:7px;height:44px;border-radius:var(--r-md,14px);display:flex;align-items:center;justify-content:center;"
            + "font-family:" + MONO + ";font-size:13px;"
            + (i === 1 ? "background:var(--accent-fill,var(--accent));color:var(--on-accent);box-shadow:var(--accent-glow,none);font-weight:500"
               : n ? "background:var(--surface-2);border:1px solid var(--border);color:" + BODY
                   : "background:none;border:1px dashed var(--border);color:" + FAINT)};
      }),
      scheduleNext: [
        {name:"Morning briefing", when:"Tomorrow 07:00", dot:LIME},
        {name:"Overdue invoice reminder", when:"Tomorrow 08:00", dot:LIME},
        {name:"Weekly stock check", when:"Thu 09:00", dot:AMBER}
      ],

      /* home widget board */
      workWidgetHint: "TASK QUEUE · " + queueTasks.length + " SHOWN",
      workWidgets: WORK_WIDGETS.map(w => {
        const on = st.workWidget === w.id;
        return {label:w.label, value:w.value, hint:w.hint, icon:ICONS[w.icon],
          tileBg: on ? "var(--accent-soft)" : "var(--surface-2)",
          tileColor: on ? "var(--accent)" : "var(--dim)",
          style: "flex:1 1 190px;min-width:180px;padding:16px 18px 18px;border-radius:var(--card-r,18px);cursor:pointer;"
            + "backdrop-filter:blur(20px) saturate(1.3);box-shadow:var(--card-shadow);"
            + "transition:transform .26s var(--ease),border-color .22s var(--ease);"
            + (on ? "background:var(--surface-2);border:1px solid var(--border-strong)"
                  : "background:var(--surface);border:1px solid var(--border)"),
          open: () => this.setState({workWidget:w.id, queue:w.queue})};
      }),

      /* agents */
      agentQuery: st.agentQuery,
      agentQueryOn: (st.agentQuery || "").length > 0,
      clearAgentQuery: () => this.setState({agentQuery:""}),
      setAgentQuery: (e) => this.setState({agentQuery:e.target.value}),
      agentListHint: agentMatches.length + " AGENTS · " + st.agents.length + " INSTALLED",
      agentListEmpty: agentMatches.length === 0,
      groupName: st.groupNames[activeAgent.id] !== undefined ? st.groupNames[activeAgent.id] : activeAgent.name,
      setGroupName: (e) => { const v = e.target.value, id = activeAgent.id;
        this.setState(prev => ({groupNames: Object.assign({}, prev.groupNames, {[id]: v})})); },
      groupMembers: (activeAgent.members || []).map((mid, i) => {
        const m = AGENT_DEFS.find(a => a.id === mid) || {shape:"crown-pebble", tint:"#191c1f", state:"idle"};
        return {shape:m.shape, tint:m.tint, state:m.state,
          chipStyle: "display:block;flex:none;border-radius:var(--r-sm,9px);" + (i ? "margin-left:-6px" : "")};
      }),
      agentList: agentMatches.map(a => ({
        name: st.groupNames[a.id] !== undefined ? st.groupNames[a.id] : a.name,
        shape:a.shape, tint:a.tint, state:a.state, when:a.when, preview:a.preview,
        isGroup: a.group === true, isSolo: a.group !== true,
        // A fixed -6px overlap: each face keeps 18 of its 24px visible, so the
        // eyes of every member stay readable however many there are.
        stack: (a.members || []).slice(0, 3).map((mid, i) => {
          const m = AGENT_DEFS.find(x => x.id === mid) || {shape:"crown-pebble", tint:"#191c1f", state:"idle"};
          return {shape:m.shape, tint:m.tint, state:m.state,
            style: "display:block;flex:none;border-radius:var(--r-sm,9px);" + (i ? "margin-left:-6px" : "")};
        }),
        rowStyle: "position:relative;display:flex;align-items:flex-start;gap:13px;padding:13px 14px 13px 22px;border-radius:16px;cursor:pointer;"
          + "transition:background .2s var(--ease);"
          + (a.id === st.agentId ? "background:var(--surface-strong)" : "background:none"),
        unread: a.id !== st.agentId && /now|m$|min/.test(String(a.when || "")),
        open: () => this.setState({agentId:a.id})
      })),
      agent: {name: st.groupNames[activeAgent.id] !== undefined ? st.groupNames[activeAgent.id] : activeAgent.name,
              shape:activeAgent.shape, tint:activeAgent.tint, state:activeAgent.state, role:activeAgent.role,
              isGroup: activeAgent.group === true, isSolo: activeAgent.group !== true,
              statusLabel: activeAgent.group
                ? activeAgent.members.length + " agents · " + STATE_LABELS[activeAgent.state]
                : STATE_LABELS[activeAgent.state] || "idle"},
      agentPlaceholder: "Message " + activeAgent.name,
      agentHasDraft: (st.agentDraft || "").trim().length > 0,
      agentPrimaryTitle: (st.agentDraft || "").trim() ? "Send" : "Dictate",
      agentPrimary: () => { if ((st.agentDraft || "").trim()) this.sendToAgent(st.agentDraft.trim()); else this.setState(prev => ({agentMic: !prev.agentMic})); },
      agentPrimaryStyle: "width:30px;height:30px;flex:none;border:0;border-radius:999px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .22s var(--ease),color .22s var(--ease),transform .18s var(--ease);"
        + ((st.agentDraft || "").trim()
            ? "background:var(--accent-fill,var(--accent));color:var(--on-accent);box-shadow:var(--accent-glow,none)"
            : (st.agentMic ? "background:var(--accent-soft);color:var(--accent)" : "background:var(--surface);color:var(--dim)")),
      agentMicStyle: "position:absolute;inset:0;transition:transform .28s var(--ease),opacity .2s var(--ease);"
        + ((st.agentDraft || "").trim() ? "transform:scale(.6) rotate(-20deg);opacity:0" : "transform:none;opacity:1"),
      agentSendStyle: "position:absolute;inset:0;transition:transform .28s var(--ease),opacity .2s var(--ease);"
        + ((st.agentDraft || "").trim() ? "transform:none;opacity:1" : "transform:scale(.6) rotate(20deg);opacity:0"),
      agentThread: activeThread.map((m, i) => {
        const isUser = m.kind === "user";
        // In a group, attribute a run of messages to whichever agent is speaking.
        const from = m.from ? AGENT_DEFS.find(a => a.id === m.from) : null;
        const prevFrom = i > 0 ? activeThread[i-1].from : null;
        return {
          hasSender: !!from && m.from !== prevFrom,
          sender: from ? from.name : "",
          senderShape: from ? from.shape : "crown-pebble", senderTint: from ? from.tint : "#191c1f",
          senderState: from ? from.state : "idle",
          alignItems: isUser ? "flex-end" : "flex-start",
          isStamp: m.kind === "stamp", isRoutine: m.kind === "routine",
          isBubble: m.kind === "user" || m.kind === "agent",
          text:m.text, routine:m.routine || "", hasLines: !!m.lines, lines: m.lines || [],
          wrapStyle: "display:flex;margin-bottom:14px;" + (isUser ? "justify-content:flex-end" : "justify-content:flex-start"),
          bubbleStyle: "padding:10px 15px;font-size:14.5px;line-height:1.45;border-radius:"
            + (isUser ? "20px 20px 4px 20px" : "20px 20px 20px 4px") + ";"
            + (isUser ? "background:var(--accent);color:var(--on-accent)"
                      : "background:var(--surface-strong);color:var(--ink)")
        };
      }),
      agentDraft: st.agentDraft,
      setAgentDraft: (e) => this.setState({agentDraft:e.target.value}),
      onAgentKey: (e) => { if (e.key === "Enter" && st.agentDraft.trim()) this.sendToAgent(st.agentDraft.trim()); },
      sendAgent: () => { if (st.agentDraft.trim()) this.sendToAgent(st.agentDraft.trim()); },

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
        return g + ", Mac"; })(),
      miniSuggestions: [
        {label:"What changed today?", run:() => this.askMini("What changed today?")},
        {label:"What needs my decision?", run:() => this.askMini("What needs my decision?")},
        {label:"Draft a chase for the worst account", run:() => this.askMini("Draft chase emails")}
      ],
      miniWorkSections: (() => {
        const openTasks = WORK_TASKS.filter(t => t.status !== "Done").slice(0, 4);
        const meetingsOpen = (st.miniWorkOpen || "tasks") === "meetings";
        const tasksOpen = (st.miniWorkOpen || "tasks") === "tasks";
        const notifsOpen = st.miniWorkOpen === "notifications";
        const toggle = (key) => () => this.setState(prev => ({miniWorkOpen: prev.miniWorkOpen === key ? null : key}));
        return [
          {num:"01", title:"Meetings", icon:"M8 4v3 M16 4v3 M4.5 9.5h15 M6.4 6h11.2A1.9 1.9 0 0 1 19.5 8v10a1.9 1.9 0 0 1-1.9 1.9H6.4A1.9 1.9 0 0 1 4.5 18V8A1.9 1.9 0 0 1 6.4 6Z",
            statusText:"Clear", statusColor:"var(--faint)", open:meetingsOpen, toggle:toggle("meetings"),
            isEmpty:true, emptyText:"Nothing scheduled.", rows:[],
            hasLink:true, linkLabel:"Full calendar", linkGo: () => this.setState({page:"Work", workSection:"schedules", miniOpen:false}),
            wrapStyle: "background:var(--surface);border:1px solid var(--border);border-radius:var(--card-r,18px);overflow:hidden"},
          {num:"02", title:"Tasks", icon:"M5 6.5h2l1.4 1.4L11 5.5 M5 12.5h2l1.4 1.4 2.6-2.4 M5 18.5h2l1.4 1.4 2.6-2.4 M15 6.5h4 M15 12.5h4 M15 18.5h4",
            statusText:openTasks.length + " open", statusColor:"var(--accent)", open:tasksOpen, toggle:toggle("tasks"),
            isEmpty:openTasks.length === 0, emptyText:"Nothing open.",
            rows: openTasks.map(t => ({isCheck:true, title:t.title,
              hasTag:true, tag:t.priority, tagStyle:"flex:none;padding:2px 9px;border-radius:var(--chip-r,6px);font-size:11px;background:var(--ok-soft);color:var(--ok)"})),
            hasLink:true, linkLabel:"All tasks", linkGo: () => this.setState({page:"Work", workSection:"tasks", miniOpen:false}),
            wrapStyle: "background:var(--surface);border:1px solid var(--border);border-radius:var(--card-r,18px);overflow:hidden"},
          {num:"03", title:"Notifications", icon:"M12 4a5.5 5.5 0 0 0-5.5 5.5v3.2L5 16h14l-1.5-3.3V9.5A5.5 5.5 0 0 0 12 4Z M9.8 19a2.2 2.2 0 0 0 4.4 0",
            statusText:"12 unread", statusColor:"#6ad0f0", open:notifsOpen, toggle:toggle("notifications"),
            isEmpty:false, emptyText:"",
            rows:[{isCheck:false, title:"Xero token expired — reconnect", hasTag:false},
              {isCheck:false, title:"Aoife raised a €14,280 approval", hasTag:false},
              {isCheck:false, title:"3 accounts moved off Standard rate", hasTag:false}],
            hasLink:true, linkLabel:"All notifications", linkGo: () => this.setState({showNotifs:true, miniOpen:false}),
            wrapStyle: "background:var(--surface);border:1px solid var(--border);border-radius:var(--card-r,18px);overflow:hidden"}
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
               context:["Organisations","Tasks","Invoices"], skills:["Search records","Summarise activity","Draft email"], tasks:[]}}),
      draftAgent: {name:st.agentSpec.name, persona:st.agentSpec.persona,
        shape:st.agentSpec.shape, tint:st.agentSpec.tint, state:"working",
        shapeLabel: (FACE_SHAPES.find(s => s[0] === st.agentSpec.shape) || FACE_SHAPES[0])[1]},
      builderHint: st.builderMode === "tune" ? "TRAINED ON YOUR ONTOLOGY · READY" : "NEW AGENT · NOT SAVED YET",
      isTune: st.builderMode === "tune",
      isNewAgent: st.builderMode !== "tune",
      faceTopStyle: st.builderMode === "tune" ? "margin-top:24px" : "",
      syncStats: [
        {value:"14", label:"ENTITY TYPES"},
        {value:"4,820", label:"RECORDS READ"},
        {value:"2m", label:"LAST SYNC"}
      ],
      sysPrompt: this.systemPrompt(),
      setSysPrompt: (e) => this.setState({sysPrompt:e.target.value}),
      sysMeta: "WRITTEN BY THE AGENT",
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
        "Flag anything over €5,000 to me first",
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
      trainTitle: st.training ? "Training" : st.trained ? "Trained on your ontology" : "Train from the ontology",
      trainBody: st.training
        ? TRAIN_PHASES[Math.min(st.trainPhase || 0, TRAIN_PHASES.length - 1)][0]
        : st.trained
          ? "It read the ontology, then wrote its own system prompt. Retrain after the data moves."
          : "It will read the whole ontology, learn how this business words things, then research and write its own system prompt.",
      trainLabel: st.training ? "Training…" : st.trained ? "Retrain" : "Train agent",
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
      saveAgent: () => this.setState(prev => {
        if (prev.builderMode === "tune") return {builderOpen:false};
        const name = prev.agentSpec.name.trim() || "New agent";
        const id = "a" + Date.now();
        return {builderOpen:false, agentId:id,
          agents: [{id, name, initials:prev.agentSpec.initials, bg:prev.agentSpec.bg, role:prev.agentSpec.persona || prev.agentSpec.personality + " · " + prev.agentSpec.answer.toLowerCase(),
            when:"now", preview:"ready when you are.",
            thread:[{kind:"stamp", text:"Just now"},
              {kind:"agent", text: prev.trained
                ? "trained and ready. i read the ontology and wrote my own prompt from it. what should i pick up first?"
                : "created. i have no context yet — train me from the ontology and i'll be useful."}]}].concat(prev.agents)};
      }),
      approvalsEmpty: approvals.length === 0,
      approvalsEmptyTitle: st.approvalFilter === "Decided" ? "Nothing decided yet"
        : st.approvalFilter === "Awaiting others" ? "Nothing waiting on anyone else" : "Nothing waiting on you",
      approvalsEmptyBody: st.approvalFilter === "Decided"
        ? "Decisions stay on the record's activity timeline once made."
        : "Requests appear here as they are raised, with every step and who it sits with.",
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
      showTeam: (st.w - (st.railOpen ? 252 : 68)) >= 1000 || contextNav.length <= 3,
      showTheme: (st.w - (st.railOpen ? 252 : 68)) >= 820 || contextNav.length <= 3,
      tabPad: (st.w - (st.railOpen ? 252 : 68)) >= 1100 ? "0 18px" : (st.w - (st.railOpen ? 252 : 68)) >= 1000 ? "0 12px" : "0 10px",
      _tabs: (() => { const tight = (st.w - (st.railOpen ? 252 : 68)) < 1000 && contextNav.length >= 4;
        contextNav.forEach(t => { t.showCount = !!t.count && !tight; }); return 0; })(),
      tabsLoose: !((st.w - (st.railOpen ? 252 : 68)) < 1000 && contextNav.length >= 4),
      tabsTight: (st.w - (st.railOpen ? 252 : 68)) < 1000 && contextNav.length >= 4,
      tabActiveBg: ((st.w - (st.railOpen ? 252 : 68)) < 1000 && contextNav.length >= 4) ? "var(--surface-2)" : "none",
      searchWrapFlex: (contextNav.length <= 6 && (st.w - (st.railOpen ? 252 : 68) - 12) >= 780) ? "1 1 auto" : "0 0 auto",
      barLabel: st.barOpen ? "Collapse the bar" : "Expand the bar",
      barChevronStyle: "transition:transform .3s var(--ease);transform:rotate(" + (st.barOpen ? "0deg" : "180deg") + ")",
      toggleBar: () => this.setState(prev => ({barOpen: !prev.barOpen})),
      showHint: roomy && st.barOpen,
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
      searchExpanded: contextNav.length <= 6 && (st.w - (st.railOpen ? 252 : 68) - 12) >= 780,
      searchBarStyle: (() => {
        const segs = contextNav.length;
        // No min-width floor: when the sub-nav pill group is wide, the search
        // must be free to shrink rather than overflow its centring parent and
        // slide under the nav.
        const cap = segs <= 2 ? 520 : segs <= 4 ? 440 : 340;
        // A real floor so the label always fits — the sub-nav group is now
        // shrinkable, so this comes out of its slack, not out of an overflow.
        const collapsed = !(segs <= 6 && (st.w - (st.railOpen ? 252 : 68) - 12) >= 780);
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
      notificationFeed, features, results,
      inbox: inboxKeys.map(rowFor),
      inboxTop: openKeys.slice(0,3).map(rowFor),
      inboxFilters: ["All","Approvals","Alerts","Work","Automations"].map(f => ({label:f, style:pillStyle(st.inboxFilter === f), pick:() => this.setState({inboxFilter:f, open:null})})),
      tasks: TASKS.filter(t => t.queue.includes("mine")).map(decorateTask),
      settingsStyle: railStyle(page === "Settings") + ";animation:railIn .42s var(--ease) 300ms both",
      settingsGlyphStyle: glyphStyle(page === "Settings", st.hovered === "__settings"),
      settingsHovered: st.hovered === "__settings",
      // Live: renderVals reads the real clock every render, and a 1s ticker
      // (Home page only) is what makes a render happen when no one is typing.
      approvalsCount: openKeys.length,
      approvalsValue: "48,120",
      approvalsSub: "Oldest open two days · two are past their SLA",
      approvalsSpark: [.34,.46,.4,.58,.52,.72,.64,.92].map((v, i, a) => ({
        style: "width:3px;border-radius:var(--r-sm,9px);height:" + Math.round(v * 30) + "px;background:"
          + (i === a.length - 1 ? "var(--accent)" : "var(--border-strong)")
          + ";opacity:" + (i === a.length - 1 ? 1 : (0.3 + i * 0.06).toFixed(2))
      })),
      closeNotifs: () => this.setState({showNotifs:false}),
      homeEyebrow: (() => {
        const live = st.agents.filter(a => a.state === "working" || a.state === "thinking").length;
        return (live ? live + " AGENTS RUNNING" : "NO AGENTS RUNNING") + " · SYNCED 2 MIN AGO";
      })(),
      homeSubline: "Ask about any record, job or number you can see.",
      approvalsPill: openKeys.length + " APPROVALS · €48,120 HELD",
      showApprovalNote: openKeys.length > 0 && !st.approvalNoteHidden,
      dismissApprovalNote: () => this.setState({approvalNoteHidden:true}),
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
      greetingName: "Mac",
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
      isWork: page === "Work",
      isSettings: page === "Settings",
      admin: adminModel,
      inboxCount: String(openKeys.length),
      inboxEmpty: openKeys.length === 0,
      filteredEmpty: inboxKeys.length === 0,
      queueEmpty: queueTasks.length === 0,
      taskSummary: TASKS.filter(t => t.queue.includes("mine") && st.done[t.id]).length + " of " + queueCounts.mine + " done",
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
        {label:"Which organisations are over their limit?", run:() => this.ask("Which organisations are over their credit limit?")},
        {label:"What is overdue in my work?", run:() => this.ask("Summarise the tasks running late")},
        {label:"What visits are booked this week?", run:() => this.ask("What site visits are booked this week?")}
      ],
      activity: [
        {who:"Aoife Nolan", what:"raised purchase order PO-4471", event:"core.approval.created", when:"18m", dot:LIME},
        {who:"Helios", what:"flagged Dunne & Sons payment behaviour", event:"core.notification.created", when:"2h", dot:AMBER},
        {who:"Tom Walsh", what:"created a depot stock check visit", event:"site-visits.visit.created", when:"Yesterday", dot:NEUTRAL},
        {who:"Overdue reminder", what:"sent 6 of 10 emails", event:"core.automation.failed", when:"08:00", dot:AMBER},
        {who:"Dispatcher", what:"dead-lettered 2 Xero deliveries", event:"core.event.dead", when:"02:16", dot:RED}
      ],
      /* Cards, not rows: each one lands on its own spring, newest first, with
         the status colour carried into a soft glow behind its marker. */
      notifications: notificationFeed.slice(0,5).map((n, i) => ({
        dot:n.dot, text:n.text, when:n.meta, event:n.event,
        cardStyle: "position:relative;flex:none;display:flex;align-items:flex-start;gap:11px;padding:13px 15px;border-radius:var(--r-md,16px);cursor:pointer;"
          + "background:var(--surface);border:1px solid var(--border);"
          + "transition:background .2s var(--ease),border-color .2s var(--ease),transform .22s var(--ease);"
          + "animation:notifCard .62s cubic-bezier(.16,1,.28,1) " + (110 + i * 62) + "ms both",
        washStyle: "position:absolute;left:0;top:0;bottom:0;width:58%;pointer-events:none;border-radius:var(--r-md,16px) 0 0 16px;"
          + "background:linear-gradient(90deg," + n.dot + "14, transparent 78%)",
        dotStyle: "position:relative;width:7px;height:7px;border-radius:50%;flex:none;margin-top:5px;background:" + n.dot
          + ";box-shadow:0 0 10px " + n.dot + ";animation:notifDot .56s cubic-bezier(.16,1,.3,1) " + (200 + i * 62) + "ms both"
      })),
      notifGroups: [["EARLIER TODAY", 0]],
      deployment: [
        {k:"Client", v:"kilbride", font:MONO},
        {k:"App name", v:"Kilbride Group Operations", font:"inherit"},
        {k:"Accent", v:"oklch(0.86 0.19 118)", font:MONO},
        {k:"Terminology", v:"organisation → Merchant", font:"inherit"},
        {k:"Locale", v:"EUR · Europe/Dublin", font:"inherit"},
        {k:"Helios channels", v:"home, whatsapp", font:MONO}
      ],
      roles: [
        {name:"Owner", grants:"all core permissions + site-visits:*", scope:"all", users:"1"},
        {name:"Accounts", grants:"core:organisation:*, core:approval:decide, core:task:*", scope:"all", users:"3"},
        {name:"Installer", grants:"core:task:view, core:task:update, site-visits:visit:*", scope:"own", users:"9"},
        {name:"Counter staff", grants:"core:person:view, core:organisation:view", scope:"location", users:"6"}
      ],
      team: [{i:"AN",bg:"var(--accent)"},{i:"SB",bg:"#9fd6f0"},{i:"TW",bg:"#e6c78a"}],
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
        {label:"Chase the three invoices past 60 days", tag:"CASH", icon:ICONS.insights,
          run: () => this.ask("Chase the three invoices past 60 days")},
        {label:"Why did the Xero sync fail this morning?", tag:"HEALTH", icon:ICONS.health,
          run: () => this.ask("Why did the Xero sync fail this morning?")},
        {label:"Who should cover tomorrow's Ballincollig visit?", tag:"WORK", icon:ICONS.visits,
          run: () => this.ask("Who should cover tomorrow's Ballincollig visit?")}
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
