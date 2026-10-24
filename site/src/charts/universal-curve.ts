// The universal curve: loss/Δv against Π (log–log).
// Layers: thrust-profile band (simulation), Π²/96 leading-order bound (theory, dashed), 0.1 % and 1 % loss
// thresholds, cases (published: hollow; simulation: solid), mission-sample ranges, and the arrival-speed
// family (sweep medians). Every number drawn or printed comes from curve.json (scripts/export_site_data.py).
import { scaleLog } from "d3-scale";
import { area, line } from "d3-shape";
import tex from "virtual:tex";
import { citation, sourceLink } from "../lib/cite";
import type { Provenance, SiteData, Sourced } from "../lib/data";
import { fillTemplate } from "../lib/data";
import { frag, h, onFontsLoaded, s } from "../lib/dom";
import { decade, lossRel, pow10, sig, speed } from "../lib/format";
import { signal } from "../lib/signal";
import { hitTarget, LabelPlacer, place, svgPointer, tooltip } from "./common";

type Detail = Sourced<string> | { template: string; fields: Record<string, Sourced<number | string>> };
interface Case {
  id: string; label: string; ref: number | null; kind: "published" | "simulation" | "published-range";
  detail: Detail; data: string; dive_of?: string;
  Pi?: Sourced; loss_rel?: Sourced; loss_m_s?: Sourced;
  Pi_range?: Sourced<number[]>; loss_rel_range?: Sourced<number[]>;
}
interface Range { id: string; label: string; n: Sourced; percentiles: [number, number]; Pi: Sourced<number[]>; loss_rel: Sourced<number[]>; data: string }
interface FamilyCurve {
  v_over_vesc: number; k: Sourced; coeff: Sourced; Pi_at_1pct: Sourced; n_runs: Sourced;
  median: { Pi: number[]; loss_rel: number[]; n: number[] };
}
export interface CurveData {
  provenance: Provenance;
  band: { Pi: number[]; lo: (number | null)[]; hi: (number | null)[]; profiles: string[]; data: string;
          spread: { max_over_min: number; at_Pi: number } };
  bound: { Pi: number[]; loss_rel: number[]; statement: Sourced<string>; max_ratio_Pi_le_1: Sourced; data: string };
  thresholds: { level: string; loss_rel: number; Pi: Sourced }[];
  cases: Case[];
  ranges: Range[];
  arrival_family: { curves: FamilyCurve[]; data: string; selection: { n_runs: Sourced } };
}

// Shared Π axis (docs/site_plan.md principle 4): decades labelled 0.001 … 1000 in every figure.
const PI_DOMAIN: [number, number] = [1e-3, 3e3];
const LOSS_DOMAIN: [number, number] = [1e-9, 1.5];
const PI_TICKS = [1e-3, 1e-2, 1e-1, 1, 10, 100, 1000];
const LOSS_TICKS = [1e-8, 1e-6, 1e-4, 1e-2, 1];
const FAMILY_STEPS = [2, 3, 4, 5, 6];              // η-ramp steps, faint → strong as v∞/v_esc grows

// Label placement (layout, not data): offset from the marker in px, and text anchor.
const LABEL_AT: Record<string, { dx: number; dy: number; anchor: "start" | "end" }> = {
  hibberd: { dx: -18, dy: -34, anchor: "end" },
  ntp: { dx: 22, dy: 28, anchor: "start" },
  sep: { dx: -22, dy: 30, anchor: "end" },
  maraqten: { dx: 26, dy: 26, anchor: "start" },
  chemical: { dx: 16, dy: 26, anchor: "start" },
  nuclear: { dx: 18, dy: 30, anchor: "start" },
  electric: { dx: 16, dy: 44, anchor: "start" },
  band: { dx: 44, dy: 78, anchor: "start" },
  bound: { dx: -22, dy: -26, anchor: "end" },
};
const BAND_LABEL_AT_PI = 3;                        // where the band's label points (layout)

export interface UniversalCurveOptions { figN: number; title: string }

export function universalCurve(root: HTMLElement, data: CurveData, site: SiteData, opt: UniversalCurveOptions): void {
  const shown = signal<Set<string>>(new Set([...data.cases.map((c) => c.id), "ranges"]));
  const mode = signal<"band" | "family">("band");
  const uid = `uc${opt.figN}`;

  // ---------------------------------------------------------------- frame
  const key = h("div", { class: "prov-key", "aria-label": "Key" },
    h("span", {}, glyph("solid"), "Simulation"),
    h("span", {}, glyph("dashed"), "Theory, leading order"),
    h("span", {}, glyph("hollow"), "Published"));
  const head = h("div", { class: "figure-head" },
    h("h3", { class: "figure-title", id: `${uid}-title` }, h("span", { class: "fig-n" }, `Figure ${opt.figN}`), opt.title), key);

  const chips = h("fieldset", { class: "chips" }, h("legend", {}, "Cases"));
  const items: [string, Node][] = [
    ...data.cases.map((c): [string, Node] => [c.id, citation(c.label, c.ref)]),
    ["ranges", document.createTextNode("Mission samples")],
  ];
  for (const [id, label] of items) {
    const input = h("input", { type: "checkbox", checked: true, "aria-controls": `${uid}-plot` });
    input.addEventListener("change", () => {
      const next = new Set(shown.get());
      if (input.checked) next.add(id); else next.delete(id);
      shown.set(next);
    });
    chips.append(h("label", { class: "chip" }, input, label));
  }
  const seg = h("fieldset", { class: "segmented" }, h("legend", {}, "Arrival speed"));
  for (const [val, text] of [["band", "Near-parabolic band"], ["family", "By arrival speed"]] as const) {
    const input = h("input", { type: "radio", name: `${uid}-mode`, value: val, checked: val === "band" });
    input.addEventListener("change", () => input.checked && mode.set(val));
    seg.append(h("label", {}, input, text));
  }
  const controls = h("div", { class: "controls" }, chips, h("span", {},
    h("span", { class: "control-label", id: `${uid}-seg` }, "Curves"), seg));
  seg.setAttribute("aria-labelledby", `${uid}-seg`);

  const svg = s("svg", { role: "img", "aria-labelledby": `${uid}-title`, "aria-describedby": `${uid}-summary`, id: `${uid}-plot` });
  const overlay = h("div", { class: "overlay", "aria-hidden": "true" });
  const plot = h("div", { class: "plot" }, svg, overlay);
  const tip = tooltip(plot);
  const summary = h("p", { class: "summary", id: `${uid}-summary` });
  const table = dataTable(data, site);
  root.append(head, controls, plot, legend(data), summary, table);
  summary.textContent = summaryText(data);

  // ---------------------------------------------------------------- drawing
  let width = 0;
  const redraw = () => tip.redraw(() => draw(width));          // an open tooltip survives (common.tooltip)
  new ResizeObserver(([entry]) => {
    const w = Math.round(entry.contentRect.width);
    if (w !== width) { width = w; requestAnimationFrame(redraw); }   // never resize inside the observer
  }).observe(plot);
  shown.subscribe(() => width && redraw());
  mode.subscribe(() => width && redraw());
  onFontsLoaded(() => width && requestAnimationFrame(redraw));      // labels are placed by their measured size

  function draw(W: number): void {
    if (W < 240) return;                           // not laid out yet (or hidden)
    const narrow = W < 560;
    const labelled = W >= 640;                     // on-plot labels; a narrower plot relies on the legend below it
    const family = mode.get() === "family";
    const H = Math.round(narrow ? W * 1.05 : Math.min(560, Math.max(360, W * 0.6)));
    // The right margin holds the threshold labels, and in family mode the curves' v∞/v_esc labels.
    const m = { top: 34, right: narrow ? (family ? 58 : 12) : 104, bottom: 52, left: narrow ? 44 : 56 };
    const x = scaleLog().domain(PI_DOMAIN).range([m.left, W - m.right]).clamp(true);
    const y = scaleLog().domain(LOSS_DOMAIN).range([H - m.bottom, m.top]).clamp(true);
    svg.replaceChildren();
    overlay.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("height", String(H));
    // On-plot labels go on once every mark and line is drawn, in the order queued (band, bound, samples, cases); all
    // or none (common.ts).
    const placer = new LabelPlacer(svg, overlay, plot, W, H - m.bottom);
    const label = (id: string, px: number, py: number, content: Node) =>
      placer.add(px, py, content, LABEL_AT[id] ?? { dx: 14, dy: -14, anchor: "start" });

    // Grid and axes.
    const g = s("g");
    for (const t of PI_TICKS) g.append(s("line", { class: "gridline", x1: x(t), x2: x(t), y1: m.top, y2: H - m.bottom }));
    for (const t of LOSS_TICKS) g.append(s("line", { class: "gridline", x1: m.left, x2: W - m.right, y1: y(t), y2: y(t) }));
    const ax = s("g", { class: "axis" },
      s("line", { x1: m.left, x2: W - m.right, y1: H - m.bottom, y2: H - m.bottom }),
      s("line", { x1: m.left, x2: m.left, y1: m.top, y2: H - m.bottom }));
    for (const t of PI_TICKS) {
      ax.append(s("line", { x1: x(t), x2: x(t), y1: H - m.bottom, y2: H - m.bottom + 5 }),
        s("text", { x: x(t), y: H - m.bottom + 19, "text-anchor": "middle" }, decade(t)));
    }
    for (const t of LOSS_TICKS) {
      ax.append(s("line", { x1: m.left - 5, x2: m.left, y1: y(t), y2: y(t) }),
        s("text", { x: m.left - 8, y: y(t) + 4, "text-anchor": "end" }, pow10(t)));
    }
    svg.append(g, ax);
    place(overlay, tex.lossRel, 0, 4, "start");
    place(overlay, tex.PiDef, (m.left + W - m.right) / 2, H - 22, "middle");

    // Thresholds (0.1 %, 1 %) and where the band crosses them.
    for (const [i, t] of data.thresholds.entries()) {
      svg.append(s("line", { class: "threshold", x1: m.left, x2: W - m.right, y1: y(t.loss_rel), y2: y(t.loss_rel) }));
      // In the right margin, unless the plot is narrow or the margin holds the family's v∞/v_esc labels: then on the
      // line at the left, where the curves are far below.
      const inside = narrow || family;
      const lx = inside ? m.left + 4 : W - m.right + 6;
      svg.append(s("text", { class: "annot-2", x: lx, y: y(t.loss_rel) + (inside ? -5 : 4), "text-anchor": "start" },
        `${t.level.replace("%", " %")} loss`));
      svg.append(s("circle", { cx: x(t.Pi.value), cy: y(t.loss_rel), r: 3.5, class: "mark-sim" }));
      // Alternate sides so the two notes clear the bound's label and the case labels.
      if (labelled) svg.append(s("text", { class: "annot-2", x: x(t.Pi.value) + (i % 2 ? -8 : 8), y: y(t.loss_rel) + (i % 2 ? -7 : 17),
        "text-anchor": i % 2 ? "end" : "start" }, `Π = ${sig(t.Pi.value)}`));
    }

    // Band (thrust-profile spread) and the leading-order bound.
    const bandPts = data.band.Pi.map((p, i) => [p, data.band.lo[i], data.band.hi[i]] as const)
      .filter(([, lo, hi]) => lo !== null && hi !== null) as [number, number, number][];
    if (!family) {
      svg.append(s("path", { class: "band", d: area<[number, number, number]>().x((d) => x(d[0])).y0((d) => y(d[1])).y1((d) => y(d[2]))(bandPts) ?? "" }));
      for (const k of [1, 2] as const) svg.append(s("path", { class: "band-edge", d: line<[number, number, number]>().x((d) => x(d[0])).y((d) => y(d[k]))(bandPts) ?? "" }));
      if (labelled) {
        const hiAt = interpLog(bandPts, BAND_LABEL_AT_PI, 2);
        label("band", x(BAND_LABEL_AT_PI), y(hiAt), document.createTextNode(bandLabel(data)));
      }
    } else {
      const ends: { x: number; y: number; text: string }[] = [];
      data.arrival_family.curves.forEach((c, i) => {
        const pts = c.median.Pi.map((p, j) => [p, c.median.loss_rel[j]] as [number, number]);
        svg.append(s("path", { class: "sim-line", style: `stroke: var(--ramp-${FAMILY_STEPS[i]})`, d: line().x((d) => x(d[0])).y((d) => y(d[1]))(pts) ?? "" }));
        const last = pts[pts.length - 1];
        ends.push({ x: x(last[0]), y: y(last[1]), text: sig(c.v_over_vesc, 2) });
      });
      // Each curve's v∞/v_esc in the right margin, level with its end, spread to at least a line apart (the
      // slow-arrival curves end close together), with a leader when moved; the key heads the column.
      ends.sort((a, b) => a.y - b.y);
      let prev = m.top - 17;
      const at = ends.map((e) => (prev = Math.max(e.y, prev + 17)));   // 17 px: 1.2 × the 14 px label size
      ends.forEach((e, i) => {
        const tx = W - m.right + 12;
        svg.append(s("path", { class: "leader", d: `M${e.x + 2},${e.y} L${tx - 2},${at[i]}` }),
          s("text", { class: "annot-2", x: tx, y: at[i] + 4 }, e.text));
      });
      const key = place(overlay, `${tex.vRatio}`, W - 2, 0, "end", "family-key");
      key.style.top = `${Math.max(0, at[0] - 8 - key.offsetHeight)}px`;
    }
    const bound = data.bound.Pi.map((p, i) => [p, data.bound.loss_rel[i]] as [number, number]);
    svg.append(s("path", { class: "theory-line", d: line().x((d) => x(d[0])).y((d) => y(d[1]))(bound) ?? "" }));
    const bAt = bound[Math.round(bound.length * 0.62)];
    const bx = x(bAt[0]), by = y(bAt[1]);
    if (labelled) label("bound", bx, by, frag(`${tex.bound} <span class="annot-text">leading-order bound</span>`));

    // Mission-sample ranges (p10–p90 in Π and in loss, median marked), drawn quietly in Graphite.
    if (shown.get().has("ranges")) {
      for (const r of data.ranges) {
        const [p0, pm, p1] = r.Pi.value, [l0, lm, l1] = r.loss_rel.value;
        const cap = 4;
        const gr = s("g", { class: "range" },
          s("line", { class: "range-bar", x1: x(p0), x2: x(p1), y1: y(lm), y2: y(lm) }),
          s("line", { class: "range-bar", x1: x(p0), x2: x(p0), y1: y(lm) - cap, y2: y(lm) + cap }),
          s("line", { class: "range-bar", x1: x(p1), x2: x(p1), y1: y(lm) - cap, y2: y(lm) + cap }),
          s("line", { class: "range-bar", x1: x(pm), x2: x(pm), y1: y(l0), y2: y(l1) }),
          s("line", { class: "range-bar", x1: x(pm) - cap, x2: x(pm) + cap, y1: y(l0), y2: y(l0) }),
          s("line", { class: "range-bar", x1: x(pm) - cap, x2: x(pm) + cap, y1: y(l1), y2: y(l1) }),
          s("circle", { class: "mark-sim", cx: x(pm), cy: y(lm), r: 4 }));
        svg.append(gr);
        hit(gr, x(pm), y(lm), `${r.label}: mission samples`, () => rangeTip(r, site));
        if (labelled) label(r.id.startsWith("electric") ? "electric" : r.id.startsWith("nuclear") ? "nuclear" : r.id,
          x(pm), y(lm), document.createTextNode(`${r.label}, mission samples`));
      }
    }

    // Cases.
    for (const c of data.cases) {
      if (!shown.get().has(c.id)) continue;
      if (c.Pi_range && c.loss_rel_range) {
        const [a, b] = c.Pi_range.value, [lo, hi] = c.loss_rel_range.value;
        const rect = s("rect", { class: "range-box", x: x(a), y: y(hi), width: x(b) - x(a), height: y(lo) - y(hi) });
        const gr = s("g", {}, rect);
        svg.append(gr);
        const cx = (x(a) + x(b)) / 2, cy = (y(lo) + y(hi)) / 2;
        hit(gr, cx, cy, caseLabelText(c, data.cases), () => caseTip(c, data.cases, site));
        if (labelled) label(c.id, x(b), y(lo), caseLabel(c, data.cases, true));
        continue;
      }
      const px = x(c.Pi!.value), py = y(c.loss_rel!.value);
      const mark = c.kind === "published"
        ? s("circle", { class: "mark-pub", cx: px, cy: py, r: 6 })
        : c.id === "ntp"
          ? s("path", { class: "mark-sim", d: `M${px},${py - 7} l7,7 l-7,7 l-7,-7z` })
          : s("rect", { class: "mark-sim", x: px - 5.5, y: py - 5.5, width: 11, height: 11 });
      const gr = s("g", {}, mark);
      svg.append(gr);
      hit(gr, px, py, caseLabelText(c, data.cases), () => caseTip(c, data.cases, site));
      if (labelled) label(c.id, px, py, caseLabel(c, data.cases, true));
    }
    placer.finish();                              // if any label found no clear place, the legend alone names the marks

    // Crosshair readout along the band (pointer; the data table carries the same values for keyboard users).
    const area_ = s("rect", { class: "hit", x: m.left, y: m.top, width: W - m.left - m.right, height: H - m.top - m.bottom, "aria-hidden": "true" });
    const cross = s("line", { class: "leader", y1: m.top, y2: H - m.bottom, visibility: "hidden" });
    svg.insertBefore(area_, svg.firstChild);
    svg.append(cross);
    area_.addEventListener("pointermove", (ev) => {
      const [mx] = svgPointer(svg, ev);
      const P = x.invert(mx);
      cross.setAttribute("x1", String(mx)); cross.setAttribute("x2", String(mx));
      cross.setAttribute("visibility", "visible");
      const lo = interpLog(bandPts, P, 1), hi = interpLog(bandPts, P, 2);
      tip.show(mx + 12, y(Math.max(1e-9, hi || 1e-9)) - 10, h("div", {},
        h("div", { class: "tt-title" }, `Π = ${sig(P)}`),
        h("dl", {}, h("dt", {}, "Band, loss/Δv"), h("dd", {}, Number.isFinite(lo) ? `${lossRel(lo)} to ${lossRel(hi)}` : "—"),
          h("dt", {}, "Bound Π²/96"), h("dd", {}, P <= 10 ? lossRel((P * P) / 96) : "—")),
        h("div", { class: "tt-source" }, "Data: ", sourceLink(site, data.bound.data), ", ", sourceLink(site, "results/phase4.parquet"))));
    });
    area_.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); tip.hide(); });
    function hit(gr: SVGGElement, cx: number, cy: number, name: string, content: () => HTMLElement): void {
      hitTarget(gr, cx, cy, name, tip, content);
    }
  }
}

// ---------------------------------------------------------------- pieces

const ordinal = (n: number) => `${n}${[11, 12, 13].includes(n % 100) ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
const pct = ([a, b]: [number, number]) => `${ordinal(a)} to ${ordinal(b)} percentile`;

// Cases that are Hibberd's dive flown by other engines are labelled as such (author, 2026-10-15), with the
// caveat line of the animation's own case title, e.g. "(hypothetical at 3.2 R☉)".
const engineName = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
function caveat(c: Case): string {
  const second = fillTemplate(c.detail).split("\n")[1] ?? "";
  return second.startsWith("(") ? second : "";
}
/** The case's display label; `lines` breaks it for on-plot use. */
function caseLabel(c: Case, all: Case[], lines = false): HTMLElement {
  const el = h("span", {});
  const owner = c.dive_of ? all.find((o) => o.id === c.dive_of) : undefined;
  if (!owner) {
    el.append(citation(c.label, c.ref));
    return el;
  }
  const brk = () => (lines ? h("br") : document.createTextNode(" "));
  el.append(citation(`${owner.label}’s dive`, owner.ref), brk(), `flown with ${engineName(c.label)}`);
  if (caveat(c)) el.append(brk(), caveat(c));
  return el;
}
function caseLabelText(c: Case, all: Case[]): string {
  const owner = c.dive_of ? all.find((o) => o.id === c.dive_of) : undefined;
  if (!owner) return c.label;
  return `${owner.label}’s dive flown with ${engineName(c.label)}${caveat(c) ? ` ${caveat(c)}` : ""}`;
}

function glyph(kind: "solid" | "dashed" | "hollow"): SVGSVGElement {
  const g = s("svg", { width: 22, height: 10, "aria-hidden": "true" });
  if (kind === "hollow") g.append(s("circle", { cx: 11, cy: 5, r: 4, class: "mark-pub", "stroke-width": 1.5 }));
  else g.append(s("line", { x1: 1, x2: 21, y1: 5, y2: 5, stroke: kind === "solid" ? "var(--ink)" : "var(--ink-2)",
    "stroke-width": 2, "stroke-dasharray": kind === "dashed" ? "5 3" : null }));
  return g;
}

/** Legend of every mark in the figure (always present; on narrow screens it replaces the on-plot labels). */
function legend(d: CurveData): HTMLElement {
  const mk = (draw: SVGElement[]) => s("svg", { width: 22, height: 16, viewBox: "-11 -8 22 16", "aria-hidden": "true" }, ...draw);
  const items: [SVGSVGElement, Node][] = [];
  for (const c of d.cases) {
    const g = c.kind === "published" ? mk([s("circle", { class: "mark-pub", r: 5 })])
      : c.Pi_range ? mk([s("rect", { class: "range-box", x: -8, y: -5, width: 16, height: 10 })])
        : c.id === "ntp" ? mk([s("path", { class: "mark-sim", d: "M0,-7 l7,7 l-7,7 l-7,-7z" })])
          : mk([s("rect", { class: "mark-sim", x: -5.5, y: -5.5, width: 11, height: 11 })]);
    items.push([g, caseLabel(c, d.cases)]);
  }
  items.push([mk([s("line", { class: "range-bar", x1: -10, x2: 10, y1: 0, y2: 0 }), s("circle", { class: "mark-sim", r: 4 })]),
    document.createTextNode(`Mission samples at the Sun: median, ${pct(d.ranges[0].percentiles)}`)]);
  items.push([mk([s("rect", { class: "band", x: -10, y: -3, width: 20, height: 6 }), s("line", { class: "band-edge", x1: -10, x2: 10, y1: -3, y2: -3 }),
    s("line", { class: "band-edge", x1: -10, x2: 10, y1: 3, y2: 3 })]), document.createTextNode(`${bandLabel(d)} (simulation)`)]);
  const boundLabel = h("span", {});
  boundLabel.append(frag(tex.bound), " leading-order bound (theory)");
  items.push([mk([s("line", { class: "theory-line", x1: -10, x2: 10, y1: 0, y2: 0 })]), boundLabel]);
  items.push([mk([s("line", { class: "threshold", x1: -10, x2: 10, y1: 0, y2: 0 })]),
    document.createTextNode(d.thresholds.map((t) => t.level.replace("%", " %")).join(" and ") + " loss")]);
  return h("ul", { class: "legend", "aria-label": "Legend" }, ...items.map(([g, t]) => h("li", {}, g, t)));
}

function interpLog(pts: [number, number, number][], P: number, k: 1 | 2): number {
  if (P < pts[0][0] || P > pts[pts.length - 1][0]) return NaN;
  let i = 1;
  while (i < pts.length - 1 && pts[i][0] < P) i++;
  const [a, b] = [pts[i - 1], pts[i]];
  const t = (Math.log(P) - Math.log(a[0])) / (Math.log(b[0]) - Math.log(a[0]));
  return Math.exp(Math.log(a[k]) + t * (Math.log(b[k]) - Math.log(a[k])));
}

/** "Band: 3 thrust profiles, spread ≤ 7.5 %": the profile count and the measured max/min over the plotted range. */
function bandLabel(d: CurveData): string {
  return `Band: ${d.band.profiles.length} thrust profiles, spread ≤ ${sig(100 * (d.band.spread.max_over_min - 1), 2)} %`;
}

function caseTip(c: Case, all: Case[], site: SiteData): HTMLElement {
  const rows: [string, string][] = [];
  if (c.Pi) rows.push(["Π", sig(c.Pi.value)]);
  if (c.Pi_range) rows.push(["Π_eff", `${sig(c.Pi_range.value[0])} to ${sig(c.Pi_range.value[1])}`]);
  if (c.loss_rel) rows.push(["loss/Δv", lossRel(c.loss_rel.value)]);
  if (c.loss_rel_range) rows.push(["loss/Δv", `${lossRel(c.loss_rel_range.value[0])} to ${lossRel(c.loss_rel_range.value[1])}`]);
  if (c.loss_m_s) rows.push(["loss", speed(c.loss_m_s.value)]);
  return h("div", {},
    h("div", { class: "tt-title" }, caseLabel(c, all)),
    h("div", { class: "tt-detail" }, fillTemplate(c.detail)),
    h("dl", {}, ...rows.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])),
    h("div", { class: "tt-source" }, "Source: ", c.ref !== null ? citation(c.label, c.ref) : "this project (simulation)"),
    h("div", { class: "tt-source" }, "Data: ", sourceLink(site, c.data)));
}

function rangeTip(r: Range, site: SiteData): HTMLElement {
  const [p0, pm, p1] = r.Pi.value, [l0, lm, l1] = r.loss_rel.value;
  return h("div", {},
    h("div", { class: "tt-title" }, `${r.label}: mission samples at the Sun`),
    h("div", { class: "tt-detail" }, `${r.n.value} samples; median, with bars from the ${pct(r.percentiles)}`),
    h("dl", {}, h("dt", {}, "Π"), h("dd", {}, `${sig(pm)} (${sig(p0)} to ${sig(p1)})`),
      h("dt", {}, "loss/Δv"), h("dd", {}, `${lossRel(lm)} (${lossRel(l0)} to ${lossRel(l1)})`)),
    h("div", { class: "tt-source" }, "Source: this project (simulation)"),
    h("div", { class: "tt-source" }, "Data: ", sourceLink(site, r.data)));
}

function dataTable(d: CurveData, site: SiteData): HTMLDetailsElement {
  const rows: Node[] = [];
  for (const c of d.cases) {
    const Pi = c.Pi ? sig(c.Pi.value) : `${sig(c.Pi_range!.value[0])} to ${sig(c.Pi_range!.value[1])}`;
    const L = c.loss_rel ? lossRel(c.loss_rel.value) : `${lossRel(c.loss_rel_range!.value[0])} to ${lossRel(c.loss_rel_range!.value[1])}`;
    rows.push(h("tr", {}, h("th", { scope: "row" }, caseLabel(c, d.cases)), h("td", {}, c.kind === "simulation" ? "simulation" : "published"),
      h("td", { class: "num" }, Pi), h("td", { class: "num" }, L), h("td", { class: "num" }, c.loss_m_s ? speed(c.loss_m_s.value) : ""),
      h("td", {}, sourceLink(site, c.data))));
  }
  for (const r of d.ranges) {
    rows.push(h("tr", {}, h("th", { scope: "row" }, `${r.label}, mission samples (median; ${pct(r.percentiles)})`), h("td", {}, "simulation"),
      h("td", { class: "num" }, `${sig(r.Pi.value[1])} (${sig(r.Pi.value[0])} to ${sig(r.Pi.value[2])})`),
      h("td", { class: "num" }, `${lossRel(r.loss_rel.value[1])} (${lossRel(r.loss_rel.value[0])} to ${lossRel(r.loss_rel.value[2])})`),
      h("td", {}, ""), h("td", {}, sourceLink(site, r.data))));
  }
  for (const t of d.thresholds) {
    rows.push(h("tr", {}, h("th", { scope: "row" }, `Band reaches ${t.level.replace("%", " %")} loss`), h("td", {}, "simulation"),
      h("td", { class: "num" }, sig(t.Pi.value)), h("td", { class: "num" }, lossRel(t.loss_rel)), h("td", {}, ""),
      h("td", {}, sourceLink(site, t.Pi.src.split("#")[0]))));
  }
  return h("details", { class: "data" }, h("summary", {}, "Show data"),
    h("div", { class: "table-scroll" }, h("table", { class: "data-table" },
      h("caption", {}, "Values plotted in this figure, with their sources"),
      h("thead", {}, h("tr", {}, ...["Case", "Kind", "Π", "loss/Δv", "Loss", "Data"].map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", {}, ...rows))));
}

function summaryText(d: CurveData): string {
  const [t1, t2] = d.thresholds;
  const parts = d.cases.map((c) => c.Pi
    ? `${caseLabelText(c, d.cases)} at Π = ${sig(c.Pi.value)} (loss ${lossRel(c.loss_rel!.value)} of Δv)`
    : `${caseLabelText(c, d.cases)} at an effective Π of ${sig(c.Pi_range!.value[0])} to ${sig(c.Pi_range!.value[1])}`);
  const sp = d.band.spread;
  return `Log–log plot of finite-burn loss as a fraction of Δv against Π. The band of ${d.band.profiles.length} thrust ` +
    `profiles is ${sig(100 * (sp.max_over_min - 1), 2)} % wide at most (max/min ${sig(sp.max_over_min, 4)} at Π = ${sig(sp.at_Pi)}). ` +
    `It reaches ${t1.level.replace("%", " %")} loss at Π = ${sig(t1.Pi.value)} and ${t2.level.replace("%", " %")} at Π = ${sig(t2.Pi.value)}. ` +
    `The dashed line is the leading-order bound Π²/96. Cases: ${parts.join("; ")}.`;
}
