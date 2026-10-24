// Minimal DOM helpers (no framework; docs/site_plan.md §3). Strings are typeset as they are appended (notation.ts):
// "v_esc" becomes v<sub>esc</sub> in HTML and a shifted tspan in SVG text; accessible names take the plain form.
import { hasNotation, plain, typeset } from "./notation";

type Attrs = Record<string, string | number | boolean | null | undefined | EventListener>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  setAttrs(el, attrs);
  append(el, children);
  return el;
}

const SVG_NS = "http://www.w3.org/2000/svg";
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  setAttrs(el, attrs);
  append(el, children);
  return el;
}

function setAttrs(el: Element, attrs: Attrs): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
    else if (k === "html") (el as HTMLElement).innerHTML = String(v);
    else el.setAttribute(k, v === true ? "" : TEXT_ATTRS.has(k) ? plain(String(v)) : String(v));
  }
}

const TEXT_ATTRS = new Set(["aria-label", "title", "alt"]);
const CODE = new Set(["CODE", "PRE", "KBD", "SAMP", "code", "pre", "kbd", "samp"]);

function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (typeof c !== "string") el.append(c);
    else if (CODE.has(el.tagName) || !hasNotation(c)) el.append(document.createTextNode(c));
    else el.append(...typeset(c, el.namespaceURI === SVG_NS));
  }
}

/** Replaces an element's content with a string, typeset as `h` does (for summaries rebuilt on redraw). */
export function setText(el: Element, text: string): void {
  el.replaceChildren();
  append(el, [text]);
}

/** Calls `fn` each time web fonts finish loading: text measured before that used the fallback font's widths. */
export function onFontsLoaded(fn: () => void): void {
  if (!("fonts" in document)) return;
  document.fonts.addEventListener("loadingdone", () => fn());
  void document.fonts.ready.then(() => fn());
}

/** An HTML fragment from trusted, build-time markup (KaTeX output). */
export function frag(html: string): DocumentFragment {
  const t = document.createElement("template");
  t.innerHTML = html;
  return t.content;
}
