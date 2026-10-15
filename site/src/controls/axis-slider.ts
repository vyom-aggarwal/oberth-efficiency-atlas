// A log-scale slider drawn as the shared Π axis (docs/site_plan.md principle 4). The native range input is the
// control (keyboard, touch, screen readers); the SVG beneath is the scale, aligned to the thumb's travel.
// Marks (e.g. the three engines of the engines-compared section) are drawn above the scale.
import { h, s } from "../lib/dom";
import { decade, sig } from "../lib/format";
import { signal, type Signal } from "../lib/signal";

export interface Mark { value: number; label: string; detail?: string }
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
    for (let e = Math.ceil(lmin); e <= Math.floor(lmax); e++) {
      const t = 10 ** e;
      svg.append(s("line", { x1: x(t), x2: x(t), y1: 0, y2: 6, stroke: "var(--graphite)" }),
        s("text", { x: x(t), y: 19, "text-anchor": "middle", class: "tick" }, decade(t)));
    }
    // Mark labels: each goes in the first row where it does not overlap a label already placed.
    const rows: [number, number][][] = [[], [], []];
    let used = 0;
    for (const m of o.marks ?? []) {
      const mx = x(m.value);
      const text = s("text", { class: "mark-label", x: mx, y: 0 }, m.label);
      svg.append(s("path", { d: `M${mx},-4 l-4,-7 h8z`, fill: "var(--ink)" }), text);
      const w = text.getComputedTextLength();
      const left = Math.min(Math.max(mx - w / 2, 0), width - w);
      const row = rows.findIndex((r) => r.every(([a, b]) => left + w + 8 < a || left > b + 8));
      const k = row < 0 ? rows.length - 1 : row;
      rows[k].push([left, left + w]);
      used = Math.max(used, k);
      const ty = 36 + 15 * k;
      text.setAttribute("x", String(left));
      text.setAttribute("y", String(ty));
      // A leader broken around the decade labels.
      svg.append(s("path", { d: `M${mx},0 V6 M${mx},23 V${ty - 11}`, stroke: "var(--ink)", "stroke-width": 1, fill: "none" }));
    }
    svg.style.height = `${40 + 15 * used}px`;
  }
  return { el, value };
}
