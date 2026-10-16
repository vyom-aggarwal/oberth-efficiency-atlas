// A log-scale slider drawn as the shared Π axis (docs/site_plan.md principle 4). The native range input is the
// control (keyboard, touch, screen readers); the SVG beneath is the scale, aligned to the thumb's travel.
// Marks (e.g. the three engines of the engines-compared section) are drawn above the scale.
import { h, s } from "../lib/dom";
import { decade, sig } from "../lib/format";
import { signal, type Signal } from "../lib/signal";

/** A mark on the scale: filled (an engine) or hollow (a threshold); `detail` becomes its hover title. */
export interface Mark { value: number; label: string; detail?: string; kind?: "engine" | "threshold" }
export interface AxisSliderOptions {
  id: string;
  label: Node | string;
  min: number;                 // positive; the slider is linear in log10
  max: number;
  value: number;
  marks?: Mark[];
  zones?: { from: number; to: number; label: string }[];
  /** Formats the value for aria-valuetext and the number field. */
  format?: (v: number) => string;
}

const THUMB = 18;              // px; matches controls.css
const ROW = 17;                // px between mark-label rows: 1.2 × the 14 px label size

export function axisSlider(o: AxisSliderOptions): { el: HTMLElement; value: Signal<number> } {
  const value = signal(o.value);
  const fmt = o.format ?? ((v: number) => sig(v));
  const lmin = Math.log10(o.min), lmax = Math.log10(o.max);
  const range = h("input", { type: "range", id: o.id, min: lmin, max: lmax, step: 0.001, value: Math.log10(o.value) });
  const number = h("input", { class: "number", type: "text", inputmode: "decimal", "aria-label": "exact value",
    spellcheck: "false", autocomplete: "off" });
  const svg = s("svg", { "aria-hidden": "true" });
  const track = h("div", { class: "track" }, range, svg);
  const el = h("div", { class: "axis-slider" }, h("label", { class: "slider-label", for: o.id }, o.label), track, number);

  range.addEventListener("input", () => value.set(10 ** Number(range.value)));
  number.addEventListener("change", () => {
    const v = Number(number.value.replace("−", "-").replace(/\s/g, ""));
    if (Number.isFinite(v) && v > 0) value.set(Math.min(o.max, Math.max(o.min, v)));
    else number.value = fmt(value.get());
  });
  value.subscribe((v) => {
    const lv = Math.log10(v);
    if (Math.abs(Number(range.value) - lv) > 5e-4) range.value = String(lv);
    range.setAttribute("aria-valuetext", fmt(v));
    if (document.activeElement !== number) number.value = fmt(v);
  });

  let width = 0;
  // Redraw in the next frame: drawing changes the scale's height, which must not happen inside the observer.
  new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width);
    if (w !== width) { width = w; requestAnimationFrame(drawScale); }
  }).observe(track);

  function drawScale(): void {
    const x = (v: number) => THUMB / 2 + ((Math.log10(v) - lmin) / (lmax - lmin)) * (width - THUMB);
    svg.replaceChildren();                       // no viewBox: SVG user units are CSS pixels
    for (const z of o.zones ?? []) {
      svg.append(s("line", { x1: x(z.from), x2: x(z.to), y1: 3, y2: 3, stroke: "var(--graphite)", "stroke-width": 3 }),
        s("text", { class: "annot-2", x: x(z.from) + 2, y: 32 }, z.label));
    }
    // A tick at every decade; on a narrow scale, a label at every second one (the ends always labelled).
    const every = (width - THUMB) / (lmax - lmin) < 48 ? 2 : 1;
    for (let e = Math.ceil(lmin); e <= Math.floor(lmax); e++) {
      const t = 10 ** e;
      svg.append(s("line", { x1: x(t), x2: x(t), y1: 0, y2: 6, stroke: "var(--graphite)" }));
      if ((e - Math.ceil(lmin)) % every) continue;
      // The end labels align with the scale's ends instead of centring past them.
      const anchor = x(t) < 24 ? "start" : x(t) > width - 24 ? "end" : "middle";
      const tx = anchor === "start" ? 0 : anchor === "end" ? width : x(t);
      svg.append(s("text", { x: tx, y: 19, "text-anchor": anchor, class: "tick" }, decade(t)));
    }
    // Mark labels, centred under their mark and clamped to the scale. A label may carry a line break ("\n"): it is
    // set on one line when that fits the scale, else on two. Left to right, each label takes the first free row (or
    // pair of rows).
    const rows: [number, number][][] = [[], [], [], [], []];
    const free = (k: number, a: number, b: number) => rows[k].every(([p, q]) => b + 10 < p || a > q + 10);
    let used = 0;
    for (const m of [...(o.marks ?? [])].sort((a, b) => a.value - b.value)) {
      const mx = x(m.value);
      const hollow = m.kind === "threshold";
      const parts = m.label.split("\n");
      const text = s("text", { class: hollow ? "mark-label hollow" : "mark-label", x: 0, y: 0 }, parts.join(" "));
      const tri = s("path", { d: `M${mx},-4 l-4,-7 h8z`, fill: hollow ? "var(--paper)" : "var(--ink)",
                             stroke: hollow ? "var(--graphite)" : "none", "stroke-width": 1.2 });
      svg.append(tri, text);
      let w = text.getComputedTextLength();
      let lines: SVGTSpanElement[] = [];
      if (parts.length > 1 && w > width - 4) {
        text.textContent = "";
        lines = parts.map((p) => s("tspan", {}, p));
        text.append(...lines);
        w = Math.max(...lines.map((t) => t.getComputedTextLength()));
      }
      if (m.detail) { tri.append(s("title", {}, m.detail)); text.append(s("title", {}, m.detail)); }
      const n = Math.max(1, lines.length);
      const left = Math.max(0, Math.min(mx - w / 2, width - w));
      let k = 0;
      while (k + n < rows.length && !Array.from({ length: n }, (_, j) => free(k + j, left, left + w)).every(Boolean)) k++;
      for (let j = 0; j < n; j++) rows[k + j].push([left, left + w]);
      used = Math.max(used, k + n - 1);
      text.setAttribute("x", String(left));
      text.setAttribute("y", String(36 + ROW * k));
      lines.forEach((t, j) => { t.setAttribute("x", String(left)); if (j) t.setAttribute("dy", String(ROW)); });
    }
    svg.style.height = `${40 + ROW * used}px`;
  }
  return { el, value };
}
