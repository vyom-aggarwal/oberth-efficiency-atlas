// Pieces shared by the home figures: log axes, HTML annotations (KaTeX), collision-free on-plot labels, the
// tooltip and its hit targets, and the "Show data" table. Layout only: no data and no numbers live here.
import type { ScaleLogarithmic } from "d3-scale";
import { frag, h, s } from "../lib/dom";
import { decade, pow10 } from "../lib/format";

export type Box = { left: number; top: number; right: number; bottom: number };
export type Margins = { top: number; right: number; bottom: number; left: number };
export type Anchor = "start" | "middle" | "end";
type Scale = ScaleLogarithmic<number, number>;

/** An HTML annotation (trusted build-time KaTeX markup, or a node) at (x, y) in plot px. */
export function place(layer: HTMLElement, content: string | Node, x: number, y: number, anchor: Anchor, cls = ""): HTMLElement {
  const el = h("div", { class: `annot-html ${cls}` });
  el.append(typeof content === "string" ? frag(content) : content);
  layer.append(el);
  position(el, x, y, anchor);
  return el;
}

export function position(el: HTMLElement, x: number, y: number, anchor: Anchor): void {
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.transform = anchor === "end" ? "translateX(-100%)" : anchor === "middle" ? "translateX(-50%)" : "";
}

/** Π tick labels: plain decimals over the shared decades (0.001 … 1000, principle 4), powers of ten beyond. */
export const piTick = (t: number): string => (t >= 1e-3 && t <= 1e3 ? decade(t) : pow10(t));

/** Gridlines, axis lines, ticks and tick labels for log axes. `everyX` labels every n-th x tick (narrow plots). */
export function logAxes(svg: SVGSVGElement, x: Scale, y: Scale, W: number, H: number, m: Margins,
                        o: { xTicks: number[]; yTicks: number[]; xFmt: (t: number) => string; yFmt: (t: number) => string; everyX?: number }): void {
  const g = s("g");
  for (const t of o.xTicks) g.append(s("line", { class: "gridline", x1: x(t), x2: x(t), y1: m.top, y2: H - m.bottom }));
  for (const t of o.yTicks) g.append(s("line", { class: "gridline", x1: m.left, x2: W - m.right, y1: y(t), y2: y(t) }));
  const ax = s("g", { class: "axis" },
    s("line", { x1: m.left, x2: W - m.right, y1: H - m.bottom, y2: H - m.bottom }),
    s("line", { x1: m.left, x2: m.left, y1: m.top, y2: H - m.bottom }));
  o.xTicks.forEach((t, i) => {
    ax.append(s("line", { x1: x(t), x2: x(t), y1: H - m.bottom, y2: H - m.bottom + 5 }));
    if (i % (o.everyX ?? 1) === 0) ax.append(s("text", { x: x(t), y: H - m.bottom + 19, "text-anchor": "middle" }, o.xFmt(t)));
  });
  for (const t of o.yTicks) {
    ax.append(s("line", { x1: m.left - 5, x2: m.left, y1: y(t), y2: y(t) }),
      s("text", { x: m.left - 8, y: y(t) + 4, "text-anchor": "end" }, o.yFmt(t)));
  }
  svg.append(g, ax);
}

/** Preferred label offset from its mark, in px, and the side the text extends to. */
export interface LabelAt { dx: number; dy: number; anchor: "start" | "end" }

/**
 * On-plot labels with leaders. Labels are queued while the figure is drawn and placed by finish(), once every mark
 * and line exists, in the order queued. Each goes at its preferred offset if that overlaps nothing already drawn
 * (annotations, SVG text, marks, and points every 6 px along the lines named by `lines`); otherwise at the first
 * clear one of its mirror images or of those further out. All or none: if any label finds no clear place, every
 * label is removed and the figure's legend names the marks at that width.
 */
export class LabelPlacer {
  private queued: (() => void)[] = [];
  private placed: Element[] = [];
  private allClear = true;
  private lineBoxes: Box[] | null = null;
  constructor(private svg: SVGSVGElement, private overlay: HTMLElement, private plot: HTMLElement,
              private W: number, private bottom: number,
              private lines = "path.band-edge, path.theory-line, path.sim-line, path.data-line") {}

  add(px: number, py: number, content: Node, pref: LabelAt): void {
    this.queued.push(() => this.put(px, py, content, pref));
  }

  /** Places the queued labels; returns whether they are shown. */
  finish(): boolean {
    for (const run of this.queued) run();
    if (!this.allClear) for (const e of this.placed) e.remove();
    return this.allClear;
  }

  private put(px: number, py: number, content: Node, pref: LabelAt): void {
    const el = h("div", { class: "annot-html" }, content);
    const taken = this.obstacles();
    this.overlay.append(el);
    const w = el.offsetWidth, hh = el.offsetHeight;
    const box = (a: LabelAt): Box => {
      const left = px + a.dx + (a.anchor === "end" ? -3 - w : 3), top = py + a.dy + (a.dy < 0 ? -hh : 2);
      return { left, top, right: left + w, bottom: top + hh };
    };
    // Overlap (px²) with what is drawn, padded by 4 px across and 2 px up and down; leaving the plot counts too.
    const cost = (b: Box) => {
      const out = Math.max(0, -b.left) + Math.max(0, b.right - this.W) + Math.max(0, -b.top) + Math.max(0, b.bottom - this.bottom);
      return out * 1e4 + taken.reduce((sum, t) =>
        sum + Math.max(0, Math.min(b.right + 4, t.right) - Math.max(b.left - 4, t.left)) *
              Math.max(0, Math.min(b.bottom + 2, t.bottom) - Math.max(b.top - 2, t.top)), 0);
    };
    const flip = (a: "start" | "end") => (a === "end" ? "start" : "end");
    const tries: LabelAt[] = [];
    for (const k of [1, 1.6, 2.2, 3]) for (const sx of [1, 2]) for (const [fx, fy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]])
      tries.push({ dx: pref.dx * fx * sx, dy: pref.dy * fy * k, anchor: fx > 0 ? pref.anchor : flip(pref.anchor) });
    const costs = tries.map((a) => cost(box(a)));
    const clear = costs.findIndex((c) => c === 0);
    if (clear < 0) this.allClear = false;
    const at = tries[clear >= 0 ? clear : costs.indexOf(Math.min(...costs))];
    const lx = px + at.dx, ly = py + at.dy;
    const leader = s("path", { class: "leader", d: `M${px + Math.sign(at.dx) * 6},${py + Math.sign(at.dy) * 6} L${lx},${ly}` });
    this.svg.append(leader);
    position(el, lx + (at.anchor === "end" ? -3 : 3), at.dy < 0 ? ly - hh : ly + 2, at.anchor);
    this.placed.push(el, leader);
  }

  /** Boxes (plot px) a new label must not cover. SVG user units are plot px: the viewBox is the plot's size. */
  private obstacles(): Box[] {
    const o = this.plot.getBoundingClientRect();
    this.lineBoxes ??= [...this.svg.querySelectorAll<SVGPathElement>(this.lines)].flatMap((p) => {
      const n = p.getTotalLength(), out: Box[] = [];
      for (let l = 0; l <= n; l += 6) {
        const q = p.getPointAtLength(l);
        out.push({ left: q.x - 1.5, top: q.y - 1.5, right: q.x + 1.5, bottom: q.y + 1.5 });
      }
      return out;
    });
    return [...this.overlay.children, ...this.svg.querySelectorAll("text, .mark-sim, .mark-pub, .range-box")].map((e) => {
      const r = e.getBoundingClientRect();
      return { left: r.left - o.left, top: r.top - o.top, right: r.right - o.left, bottom: r.bottom - o.top };
    }).concat(this.lineBoxes);
  }
}

/** The figure's tooltip (Paper, Graphite edge), positioned inside the plot. */
export function tooltip(plot: HTMLElement): { el: HTMLElement; show: (px: number, py: number, content: Node) => void; hide: () => void } {
  const el = h("div", { class: "tooltip", role: "status", hidden: true });
  plot.append(el);
  return {
    el,
    show(px, py, content) {
      el.replaceChildren(content);
      el.hidden = false;
      const W = plot.clientWidth, w = el.offsetWidth, hgt = el.offsetHeight;
      el.style.left = `${Math.max(0, Math.min(px, W - w))}px`;
      el.style.top = `${Math.max(0, py - hgt)}px`;
    },
    hide() { el.hidden = true; },
  };
}

/** A focusable hit target over a mark: hover or focus shows `content` in the tooltip; Escape hides it. */
export function hitTarget(gr: SVGGElement, cx: number, cy: number, name: string, tip: ReturnType<typeof tooltip>,
                          content: () => Node): void {
  const target = s("circle", { class: "hit", cx, cy, r: 16, tabindex: 0, role: "button", "aria-label": `${name}: details` });
  const ring = s("circle", { class: "focus-ring", cx, cy, r: 12 });
  gr.append(target, ring);
  const show = () => { gr.classList.add("hover"); tip.show(cx + 16, cy - 8, content()); };
  const hide = () => { gr.classList.remove("hover"); tip.hide(); };
  target.addEventListener("pointerenter", show);
  target.addEventListener("pointerleave", hide);
  target.addEventListener("focus", show);
  target.addEventListener("blur", hide);
  target.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
}

/** Pointer position in the SVG's user units (plot px). */
export function svgPointer(svg: SVGSVGElement, ev: PointerEvent): [number, number] {
  const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
  return [((ev.clientX - r.left) * vb.width) / r.width, ((ev.clientY - r.top) * vb.height) / r.height];
}

/** "Show data": a table of the plotted values. Cells in `numeric` columns are right-aligned tabular figures. */
export function dataTable(caption: string, head: string[], rows: (string | Node)[][], numeric: number[] = [],
                          note?: Node, toggle = "Show data"): HTMLDetailsElement {
  const tr = (cells: (string | Node)[]) => h("tr", {}, ...cells.map((c, j) =>
    j === 0 ? h("th", { scope: "row" }, c) : h("td", numeric.includes(j) ? { class: "num" } : {}, c)));
  return h("details", { class: "data" }, h("summary", {}, toggle),
    h("div", { class: "table-scroll" }, h("table", { class: "data-table" },
      h("caption", {}, caption),
      h("thead", {}, h("tr", {}, ...head.map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", {}, ...rows.map(tr)))),
    note ? h("p", { class: "table-note" }, note) : null);
}

/** A row of checkboxes ("chips"); `onChange` receives the set of checked ids. */
export function chips(legend: string, items: [string, Node | string][], checked: Set<string>, controls: string,
                      onChange: (on: Set<string>) => void): HTMLFieldSetElement {
  const set = new Set(checked);
  const fs = h("fieldset", { class: "chips" }, h("legend", {}, legend));
  for (const [id, label] of items) {
    const input = h("input", { type: "checkbox", checked: set.has(id), "aria-controls": controls });
    input.addEventListener("change", () => {
      if (input.checked) set.add(id); else set.delete(id);
      onChange(new Set(set));
    });
    fs.append(h("label", { class: "chip" }, input, label));
  }
  return fs;
}

/** Radio buttons drawn as a segmented control. */
export function segmented<T extends string>(name: string, legend: string, items: [T, string][], value: T,
                                            onChange: (v: T) => void): HTMLFieldSetElement {
  const fs = h("fieldset", { class: "segmented" }, h("legend", {}, legend));
  for (const [val, text] of items) {
    const input = h("input", { type: "radio", name, value: val, checked: val === value });
    input.addEventListener("change", () => input.checked && onChange(val));
    fs.append(h("label", {}, input, text));
  }
  return fs;
}
