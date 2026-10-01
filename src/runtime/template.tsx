import { isValidElement, type CSSProperties, type ReactNode } from "react";

/* Small helpers the views use to render the design's bindings.
   They match how the Claude Design prototype rendered, so output is identical. */

/** A list binding: anything that is not an array renders nothing. */
export function arr(list: unknown): any[] {
  return Array.isArray(list) ? list : [];
}

/** String interpolation inside an attribute: missing values become "". */
export function cat(...parts: unknown[]): string {
  return parts.map((p) => (p ?? "") as string).join("");
}

export function cx(...classes: unknown[]): string | undefined {
  const out = classes.filter(Boolean).join(" ");
  return out || undefined;
}

const kebabToCamel = (s: string) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

const cssCache = new Map<string, CSSProperties>();

/** Inline style from a CSS declaration string (or pass an object through). */
export function css(style: unknown): CSSProperties | undefined {
  if (style == null) return undefined;
  if (typeof style !== "string") return style as CSSProperties;
  const hit = cssCache.get(style);
  if (hit) return hit;
  const o: Record<string, string> = {};
  for (const decl of style.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    o[prop.startsWith("--") ? prop : kebabToCamel(prop)] = decl.slice(i + 1).trim();
  }
  if (cssCache.size > 4000) cssCache.clear();
  cssCache.set(style, o);
  return o;
}

/** A `{{ value }}` inside text. Primitives are wrapped in a span, as the prototype did. */
export function txt(v: unknown): ReactNode {
  if (v === undefined || v === null || typeof v === "boolean") return null;
  if (isValidElement(v) || Array.isArray(v)) return v as ReactNode;
  return <span className="sc-interp">{String(v)}</span>;
}

/* Hover / active / focus styles whose CSS depends on data. Static ones live in
   styles/interactions.css; these are generated once per distinct rule. */
function importantify(style: string): string {
  const decls: string[] = [];
  let start = 0, depth = 0, quote = "";
  for (let i = 0; i < style.length; i++) {
    const c = style[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === "'" || c === '"') quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === ";" && depth === 0) {
      decls.push(style.slice(start, i));
      start = i + 1;
    }
  }
  decls.push(style.slice(start));
  return decls
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => (/!\s*important$/i.test(d) ? d : d + " !important"))
    .join(";");
}

let sheet: CSSStyleSheet | null = null;
const pseudoCache = new Map<string, string>();
let pseudoN = 0;

export function pc(kind: string, style: string): string {
  const key = kind + "|" + style;
  const hit = pseudoCache.get(key);
  if (hit) return hit;
  if (!sheet) {
    const el = document.createElement("style");
    el.setAttribute("data-pulse-dynamic", "");
    document.head.appendChild(el);
    sheet = el.sheet!;
  }
  const cls = "ixd" + (pseudoN++).toString(36);
  const element = kind === "before" || kind === "after";
  const sel = "." + cls + (element ? "::" : ":") + kind;
  try {
    sheet.insertRule(sel + "{" + (element ? style : importantify(style)) + "}", sheet.cssRules.length);
  } catch {
    /* an invalid rule simply has no effect, as in a stylesheet */
  }
  pseudoCache.set(key, cls);
  return cls;
}
