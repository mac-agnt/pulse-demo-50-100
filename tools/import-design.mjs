// Re-imports a Claude Design export (.dc.html) into this app:
//   node tools/import-design.mjs "path/to/Pulse v5 Harbour.dc.html"
// Regenerates src/views, src/styles/pulse.css, src/styles/interactions.css,
// src/logic/data.js and src/logic/PulseLogic.js. AgentFace is hand-written and left alone.
// Hand edits to generated files are overwritten, so commit before running.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFragment } from "parse5";
import * as acorn from "acorn";

const srcFile = process.argv[2];
if (!srcFile) { console.error("usage: node tools/import-design.mjs <design.dc.html>"); process.exit(1); }
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const src = fs.readFileSync(srcFile, "utf8");
const open = /<x-dc(?:\s[^>]*)?>/.exec(src);
const tplRaw = src.slice(open.index + open[0].length, src.lastIndexOf("</x-dc>"));
const helmetEnd = tplRaw.indexOf("</helmet>");
const helmet = helmetEnd >= 0 ? tplRaw.slice(0, helmetEnd + 9) : "";
let body = helmetEnd >= 0 ? tplRaw.slice(helmetEnd + 9) : tplRaw;
// Design fix: the work viewer's fixed wrapper was never closed, which nested every later overlay
// (agent builder, new record, palette, background gallery) inside it. Close it, and keep the
// background gallery inside the themed root.
function patch(re, rep) { const n = body.replace(re, rep); if (n === body) console.warn("design fix no longer applies (check the markup): " + re); body = n; }
patch(/(<\/span>\n<\/sc-if>\n<\/div>\n<\/div>\n)(<\/sc-if>\n\n<sc-if value="\{\{ builderOpen \}\}")/, "$1</div>\n$2");
patch(/<\/sc-if>\n<\/div>\n(\s*<sc-if value="\{\{ bgGallery\.open \}\}")/, "</sc-if>\n$1");
body = body.replace(/\s*$/, "\n</div>\n");

// --- helpers mirroring dc-runtime ------------------------------------------
const kebabToCamel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function cssToObj(css) {
  const o = {};
  for (const decl of css.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    o[prop.startsWith("--") ? prop : kebabToCamel(prop)] = decl.slice(i + 1).trim();
  }
  return o;
}
function importantify(css) {
  const decls = []; let start = 0, depth = 0, quote = "";
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = ""; }
    else if (c === "'" || c === '"') quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === ";" && depth === 0) { decls.push(css.slice(start, i)); start = i + 1; }
  }
  decls.push(css.slice(start));
  return decls.map(d => d.trim()).filter(Boolean).map(d => /!\s*important$/i.test(d) ? d : d + " !important").join(";");
}

// --- expressions -------------------------------------------------------------
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*/;
function expr(raw, scope) {
  const e = raw.trim();
  if (e === "true" || e === "false" || e === "null" || e === "undefined") return e;
  if (/^-?\d+(\.\d+)?$/.test(e)) return e;
  if (/^(['"]).*\1$/.test(e)) return JSON.stringify(e.slice(1, -1));
  if (e[0] === "!") return "!" + expr(e.slice(1), scope);
  const head = e.match(IDENT);
  if (!head) throw new Error("bad expr " + raw);
  let out = scope.has(head[0]) ? scope.get(head[0]) : "v." + head[0];
  let rest = e.slice(head[0].length);
  while (rest) {
    const m = rest.match(/^\.([A-Za-z_$][A-Za-z0-9_$]*|\d+)/);
    if (!m) throw new Error("unsupported expr " + raw);
    out += /^\d/.test(m[1]) ? "?.[" + m[1] + "]" : "?." + m[1];
    rest = rest.slice(m[0].length);
  }
  return out;
}
const splitInterp = s => s.split(/\{\{([\s\S]+?)\}\}/g);
function attrExpr(raw, scope) {
  const whole = raw.match(/^\s*\{\{([\s\S]+?)\}\}\s*$/);
  if (whole) return { dyn: true, code: expr(whole[1], scope) };
  if (raw.includes("{{")) {
    const parts = splitInterp(raw).map((p, i) => i & 1 ? expr(p, scope) : JSON.stringify(p)).filter(p => p !== '""');
    return { dyn: true, code: "cat(" + parts.join(", ") + ")" };
  }
  return { dyn: false, code: JSON.stringify(raw), raw };
}

// --- static interaction classes (style-hover / -active / -focus) -------------
const pseudoRules = new Map();
function staticPseudo(kind, css) {
  const k = kind + "|" + css;
  if (!pseudoRules.has(k)) {
    const cls = "ix" + pseudoRules.size.toString(36);
    const pe = kind === "before" || kind === "after";
    pseudoRules.set(k, { cls, rule: "." + cls + (pe ? "::" : ":") + kind + "{" + (pe ? css : importantify(css)) + "}" });
  }
  return pseudoRules.get(k).cls;
}

// --- JSX emit ----------------------------------------------------------------
const ATTR_MAP = { class: "className", for: "htmlFor", spellcheck: "spellCheck", tabindex: "tabIndex", readonly: "readOnly",
  maxlength: "maxLength", autofocus: "autoFocus", crossorigin: "crossOrigin", "xlink:href": "xlinkHref", colspan: "colSpan", rowspan: "rowSpan" };
const BOOL_ATTRS = new Set(["disabled", "checked", "autoFocus", "readOnly", "multiple", "hidden"]);
const TABLE_TAGS = new Set(["table", "thead", "tbody", "tfoot", "tr"]);
const usesAgentFace = { v: false };

function propName(k) {
  if (ATTR_MAP[k]) return ATTR_MAP[k];
  if (k.startsWith("data-") || k.startsWith("aria-")) return k;
  if (k.includes("-")) return kebabToCamel(k);
  return k;
}

let loopN = 0;
function emitChildren(nodes, scope, ind, parentTag, ctx) {
  const out = [];
  for (const n of nodes) {
    const s = emitNode(n, scope, ind, parentTag, ctx);
    if (s) out.push(s);
  }
  return out;
}

function emitNode(n, scope, ind, parentTag, ctx) {
  const pad = "  ".repeat(ind);
  if (n.type === "comment") return null;
  if (n.type === "text") {
    const txt = n.data;
    if (!txt.includes("{{")) {
      if (!txt.trim() && !txt.includes(" ")) return null;
      if (!txt.trim() && TABLE_TAGS.has(parentTag)) return null;
      return pad + "{" + JSON.stringify(txt) + "}";
    }
    return splitInterp(txt).map((p, i) => {
      if (i & 1) return pad + "{txt(" + expr(p, scope) + ")}";
      if (!p) return null;
      return pad + "{" + JSON.stringify(p) + "}";
    }).filter(Boolean).join("\n");
  }
  if (n.type !== "tag" && n.type !== "script" && n.type !== "style") return null;
  const tag = n.name;
  const a = n.attribs || {};

  if (tag === "sc-if") {
    const cond = attrExpr(a.value || "", scope).code;
    // Page-sized blocks become their own view component.
    if (ctx.extract && ctx.depthInLoop === 0 && ctx.extract(n, cond, scope)) {
      return pad + "{" + cond + " && <" + ctx.extract(n, cond, scope) + " v={v} />}";
    }
    const kids = emitChildren(n.children, scope, ind + 2, parentTag, ctx);
    if (!kids.length) return null;
    return pad + "{" + cond + " && (\n" + pad + "  <>\n" + kids.join("\n") + "\n" + pad + "  </>\n" + pad + ")}";
  }
  if (tag === "sc-for") {
    const list = attrExpr(a.list || "", scope).code;
    const as = a.as || "item";
    const id = loopN++;
    const itemVar = as.replace(/[^A-Za-z0-9_$]/g, "_") + (scope.has(as) ? "_" + id : "");
    const idxVar = "i" + id;
    const sub = new Map(scope);
    sub.set(as, itemVar);
    sub.set("$index", idxVar);
    const kids = emitChildren(n.children, sub, ind + 2, parentTag, { ...ctx, depthInLoop: ctx.depthInLoop + 1 });
    return pad + "{arr(" + list + ").map((" + itemVar + ": any, " + idxVar + ": number) => (\n"
      + pad + "  <Fragment key={" + idxVar + "}>\n" + kids.join("\n") + "\n" + pad + "  </Fragment>\n" + pad + "))}";
  }
  if (tag === "dc-import") {
    usesAgentFace.v = true;
    const props = [];
    for (const [k, raw] of Object.entries(a)) {
      if (k === "name" || k === "hint-size") continue;
      const ae = attrExpr(raw, scope);
      if (k === "style") { props.push("hostStyle={" + (ae.dyn ? ae.code : JSON.stringify(cssToObj(raw))) + "}"); continue; }
      const nm = k.includes("-") ? kebabToCamel(k) : k;
      props.push(nm + "={" + ae.code + "}");
    }
    if (a.name !== "AgentFace") throw new Error("unknown import " + a.name);
    return pad + "<AgentFace " + props.join(" ") + " />";
  }

  const props = [];
  const classes = [];
  for (const [k, raw] of Object.entries(a)) {
    if (k.startsWith("hint-")) continue;
    if (k.startsWith("style-")) {
      const kind = k.slice(6);
      if (raw.includes("{{")) classes.push("pc(" + JSON.stringify(kind) + ", " + attrExpr(raw, scope).code + ")");
      else classes.push(JSON.stringify(staticPseudo(kind, raw)));
      continue;
    }
    const name = propName(k);
    const ae = attrExpr(raw, scope);
    if (name === "className") { classes.unshift(ae.code); continue; }
    if (name === "style") {
      props.push("style={" + (ae.dyn ? "css(" + ae.code + ")" : JSON.stringify(cssToObj(raw))) + "}");
      continue;
    }
    if ((name === "value" || name === "checked") && ae.dyn) {
      props.push(name + "={" + ae.code + (name === "checked" ? " ?? false" : " ?? \"\"") + "}");
      continue;
    }
    if (!ae.dyn && raw === "" && BOOL_ATTRS.has(name)) { props.push(name); continue; }
    if (!ae.dyn && /^\d+$/.test(raw) && ["rows", "cols", "tabIndex", "size", "maxLength", "colSpan", "rowSpan"].includes(name)) { props.push(name + "={" + raw + "}"); continue; }
    props.push(name + "=" + (ae.dyn ? "{" + ae.code + "}" : (/^[^"\\{}<>&\n]*$/.test(raw) ? JSON.stringify(raw) : "{" + ae.code + "}")));
  }
  if (classes.length === 1 && !classes[0].startsWith("pc(") && !classes[0].startsWith("v.") && !classes[0].startsWith("cat(")) {
    props.unshift("className=" + (/^"[^"\\]*"$/.test(classes[0]) ? classes[0] : "{" + classes[0] + "}"));
  } else if (classes.length) props.unshift("className={cx(" + classes.join(", ") + ")}");

  const kids = emitChildren(n.children || [], scope, ind + 1, tag, ctx);
  const openTag = pad + "<" + tag + (props.length ? " " + props.join(" ") : "");
  if (!kids.length) return openTag + " />";
  return openTag + ">\n" + kids.join("\n") + "\n" + pad + "</" + tag + ">";
}

// --- split into view files --------------------------------------------------
// Mirror dc-runtime's encodeCase so the browser-grade parser keeps camelCase attrs and raw table tags.
const CAMEL = "sc-camel-";
const RAW_WRAP = { select: "sc-raw-select", table: "sc-raw-table", tbody: "sc-raw-tbody", thead: "sc-raw-thead", tfoot: "sc-raw-tfoot", tr: "sc-raw-tr", td: "sc-raw-td", th: "sc-raw-th", caption: "sc-raw-caption" };
const RAW_UNWRAP = Object.fromEntries(Object.entries(RAW_WRAP).map(([k, v]) => [v, k]));
function encodeCase(html) {
  html = html.replace(/<(x-import|dc-import)((?:[^>"']|"[^"]*"|'[^']*')*)\/>/gi, (_, t, a) => "<" + t + a + "></" + t + ">");
  html = html.replace(/(\s)([a-z]+[A-Z][A-Za-z0-9]*)(\s*=)/g, (_, sp, name, eq) => sp + CAMEL + name.replace(/[A-Z]/g, c => "-" + c.toLowerCase()) + eq);
  for (const [real, alias] of Object.entries(RAW_WRAP)) html = html.replace(new RegExp("(</?)" + real + "(?=[\\s>])", "gi"), "$1" + alias);
  return html;
}
function norm(n) {
  const loc = n.sourceCodeLocation;
  const base = { startIndex: loc ? loc.startOffset : 0, endIndex: loc ? loc.endOffset : 0 };
  if (n.nodeName === "#text") return { ...base, type: "text", data: n.value };
  if (n.nodeName === "#comment") return { ...base, type: "comment" };
  const attribs = {};
  for (const at of n.attrs || []) {
    let k = at.prefix ? at.prefix + ":" + at.name : at.name;
    if (k.startsWith(CAMEL)) k = kebabToCamel(k.slice(CAMEL.length));
    attribs[k] = at.value;
  }
  const kids = (n.nodeName === "template" ? n.content.childNodes : n.childNodes) || [];
  return { ...base, type: "tag", name: RAW_UNWRAP[n.tagName] || n.tagName, attribs, children: kids.map(norm) };
}
const doc = { children: parseFragment(encodeCase(body), { sourceCodeLocationInfo: true }).childNodes.map(norm) };

function lineSpan(n) { return n.endIndex - n.startIndex; }
const pascal = s => s.replace(/^!/, "Not ").replace(/(^|[^A-Za-z0-9])([a-z])/g, (_, __, c) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, "")
  .replace(/^V/, "").replace(/^(.)/, c => c.toUpperCase());

const views = []; // {name, code}
const RENAME = { KpiBackdropOn: "KpiBackdrop", Dashboard: "DashboardKpiBand", Dashboard2: "Dashboard", ThreadOpen: "HomeThread",
  ShowRail: "HomeWidgetRail", WorkIsSchedules: "WorkSchedules", RecIsFiles: "RecordsFiles", RecIsOntology: "RecordsOntology",
  AdminPanelPeopleAddOpen: "PeopleAddPanel", AdminPanelIsPeople: "PeoplePanel", MiniOpen: "HeliosMini", WorkViewerOpen: "WorkViewer",
  AgentBuilder: "AgentStudioNewHero", AgentTune: "AgentStudioTuneHero", AgentTune2: "AgentStudioPrompt", AgentBuilder2: "AgentStudioTraining", BuilderOpen: "AgentStudio", NewRecOpen: "NewRecordDialog", PaletteOpen: "CommandPalette",
  BgGalleryOpen: "BackgroundGallery" };
const OVERLAYS = new Set(["HeliosMini", "WorkViewer", "AgentStudio", "AgentStudioNewHero", "AgentStudioTuneHero", "AgentStudioPrompt", "AgentStudioTraining", "NewRecordDialog", "CommandPalette", "BackgroundGallery"]);
const folderOf = n => n === "AppShell" ? "" : OVERLAYS.has(n) ? "overlays" : "pages";
const usedNames = new Map();
const PAGE_NAMES = { isAgents: "Agents", isDashboard: "Dashboard", isChat: "Home", isWork: "Work", isRecords: "Records",
  isActivity: "Activity", isSettings: "Settings", isTune: "AgentTune", isNewAgent: "AgentBuilder" };

function makeExtractor(minChars) {
  const seen = new Map();
  return function extract(n, cond, scope) {
    if (seen.has(n)) return seen.get(n);
    const key = cond.replace(/^!?v\./, "").split("?.")[0];
    if (lineSpan(n) < (PAGE_NAMES[key] ? 3000 : minChars)) { seen.set(n, null); return null; }
    let base = PAGE_NAMES[key] || pascal(cond.replace(/\?\./g, " ").replace(/^v\./, "").replace(/^!v\./, "!"));
    const cnt = (usedNames.get(base) || 0) + 1;
    usedNames.set(base, cnt);
    const raw = base + (cnt > 1 ? cnt : "");
    const name = RENAME[raw] || raw;
    seen.set(n, name);
    const kids = emitChildren(n.children, scope, 3, "div", { extract, depthInLoop: 0 });
    views.push({ name, code: kids.join("\n") });
    return name;
  };
}
const extract = makeExtractor(6000);
const rootKids = emitChildren(doc.children, new Map(), 2, "div", { extract, depthInLoop: 0 });

fs.rmSync(path.join(outDir, "views"), { recursive: true, force: true });
for (const f of ["", "pages", "overlays"]) fs.mkdirSync(path.join(outDir, "views", f), { recursive: true });
function fileFor(name, code, isRoot) {
  const imports = new Set(["Fragment"]);
  const helpers = ["arr", "cat", "css", "cx", "pc", "txt"].filter(h => new RegExp("\\b" + h + "\\(").test(code));
  const kids = views.filter(v => v.name !== name && new RegExp("<" + v.name + " ").test(code)).map(v => v.name);
  const lines = [];
  lines.push('import { ' + [...imports].join(", ") + ' } from "react";');
  const up = folderOf(name) ? "../../" : "../";
  if (helpers.length) lines.push('import { ' + helpers.join(", ") + ' } from "' + up + 'runtime/template";');
  if (/<AgentFace /.test(code)) lines.push('import AgentFace from "' + up + 'components/AgentFace";');
  for (const k of kids) {
    const rel = path.relative(path.join("v", folderOf(name)), path.join("v", folderOf(k), k)).replace(/\\/g, "/");
    lines.push('import ' + k + ' from "' + (rel.startsWith(".") ? rel : "./" + rel) + '";');
  }
  lines.push("", "type Props = { v: any };", "");
  lines.push("export default function " + name + "({ v }: Props) {");
  const body = code.trim() ? code : "";
  if (!/\bFragment\b/.test(body)) lines[0] = lines[0].replace("{ Fragment }", "").replace("import  from \"react\";", "");
  lines.push("  return (", "    <>", body, "    </>", "  );", "}", "");
  return lines.filter((l, i) => !(i === 0 && l === "")).join("\n").replace(/^import\s+from "react";\n/, "");
}
views.push({ name: "AppShell", code: rootKids.join("\n") });
for (const vw of views) fs.writeFileSync(path.join(outDir, "views", folderOf(vw.name), vw.name + ".tsx"), fileFor(vw.name, vw.code));

fs.writeFileSync(path.join(outDir, "styles", "interactions.css"),
  "/* Hover / active / focus states from the design's style-hover, style-active and style-focus attributes. */\n"
  + [...pseudoRules.values()].map(r => r.rule).join("\n") + "\n");
const styleBody = helmet.includes("<style>") ? helmet.slice(helmet.indexOf("<style>") + 7, helmet.lastIndexOf("</style>")) : "";
fs.writeFileSync(path.join(outDir, "styles", "pulse.css"), "/* Pulse design tokens, themes and animations (from the Harbour design). */\n" + styleBody.trim() + "\n");

// --- logic: data constants + the behaviour class ------------------------------
const scriptOpen = src.indexOf("data-dc-script");
const script = src.slice(src.indexOf(">", scriptOpen) + 1, src.lastIndexOf("</script>"));
const clsAt = script.indexOf("class Component extends DCLogic {");
const data = script.slice(0, clsAt), cls = script.slice(clsAt);
const names = [];
for (const n of acorn.parse(data, { ecmaVersion: "latest" }).body) {
  if (n.type === "VariableDeclaration") for (const d of n.declarations) names.push(d.id.name);
  else if (n.type === "FunctionDeclaration" || n.type === "ClassDeclaration") names.push(n.id.name);
}
const used = names.filter(n => new RegExp("(?<![\\w$.])" + n.replace(/\$/g, "\\$") + "(?![\\w$])").test(cls));
fs.writeFileSync(path.join(outDir, "logic", "data.js"),
  "/* Demo data and pure helpers for the Pulse prototype (Kilbride Group). */\n\n" + data.trim() + "\n\nexport {\n  " + names.join(",\n  ") + "\n};\n");
fs.writeFileSync(path.join(outDir, "logic", "PulseLogic.js"),
  'import React from "react";\nimport { DCLogic } from "../runtime/logic";\nimport {\n  ' + used.join(",\n  ") + '\n} from "./data";\n\n'
  + "/* All state and behaviour for Pulse. renderVals() returns the flat object the views render from. */\n"
  + cls.replace("class Component extends DCLogic {", "export default class PulseLogic extends DCLogic {").trim() + "\n");
console.log("views:", views.map(v => v.name).join(", "));
