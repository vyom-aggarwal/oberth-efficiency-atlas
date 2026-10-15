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
import { frag, h, s } from "../lib/dom";
import { decade, lossRel, pow10, sig, speed } from "../lib/format";
import { signal } from "../lib/signal";

type Detail = Sourced<string> | { template: string; fields: Record<string, Sourced<number | string>> };
interface Case {
  id: string; label: string; ref: number | null; kind: "published" | "simulation" | "published-range";
  detail: Detail; data: string;
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
  band: { Pi: number[]; lo: (number | null)[]; hi: (number | null)[]; profiles: string[]; data: string };
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
const FAMILY_STEPS = [3, 4, 5, 6, 7];              // Slate steps, faint → strong as v∞/v_esc grows

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
  const tip = h("div", { class: "tooltip", role: "status", hidden: true });
  const plot = h("div", { class: "plot" }, svg, overlay, tip);
  const summary = h("p", { class: "summary", id: `${uid}-summary` });
  const table = dataTable(data, site);
  root.append(head, controls, plot, legend(data), summary, table);
  summary.textContent = summaryText(data);

  // ---------------------------------------------------------------- drawing
  let width = 0;
  const redraw = () => draw(width);
  new ResizeObserver(([entry]) => {
    const w = Math.round(entry.contentRect.width);
    if (w !== width) { width = w; redraw(); }
  }).observe(plot);
  shown.subscribe(() => width && redraw());
  mode.subscribe(() => width && redraw());

  function draw(W: number): void {
    if (W < 240) return;                           // not laid out yet (or hidden)
    const narrow = W < 560;
    const H = Math.round(narrow ? W * 1.05 : Math.min(560, Math.max(360, W * 0.6)));
    const m = { top: 34, right: narrow ? 12 : 104, bottom: 52, left: narrow ? 44 : 56 };
    const x = scaleLog().domain(PI_DOMAIN).range([m.left, W - m.right]).clamp(true);
    const y = scaleLog().domain(LOSS_DOMAIN).range([H - m.bottom, m.top]).clamp(true);
    svg.replaceChildren();
    overlay.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("height", String(H));
    hideTip();

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
      const lx = narrow ? m.left + 4 : W - m.right + 6;
      svg.append(s("text", { class: "annot-2", x: lx, y: y(t.loss_rel) + (narrow ? -5 : 4), "text-anchor": "start" },
        `${t.level.replace("%", " %")} loss`));
      svg.append(s("circle", { cx: x(t.Pi.value), cy: y(t.loss_rel), r: 3.5, class: "mark-sim" }));
      // Alternate sides so the two notes clear the bound's label and the case labels.
      if (!narrow) svg.append(s("text", { class: "annot-2", x: x(t.Pi.value) + (i % 2 ? -8 : 8), y: y(t.loss_rel) + (i % 2 ? -7 : 17),
        "text-anchor": i % 2 ? "end" : "start" }, `Π = ${sig(t.Pi.value)}`));
    }

    // Band (thrust-profile spread) and the leading-order bound.
    const bandPts = data.band.Pi.map((p, i) => [p, data.band.lo[i], data.band.hi[i]] as const)
      .filter(([, lo, hi]) => lo !== null && hi !== null) as [number, number, number][];
    if (mode.get() === "band") {
      svg.append(s("path", { class: "band", d: area<[number, number, number]>().x((d) => x(d[0])).y0((d) => y(d[1])).y1((d) => y(d[2]))(bandPts) ?? "" }));
      for (const k of [1, 2] as const) svg.append(s("path", { class: "band-edge", d: line<[number, number, number]>().x((d) => x(d[0])).y((d) => y(d[k]))(bandPts) ?? "" }));
      if (!narrow) {
        const hiAt = interpLog(bandPts, BAND_LABEL_AT_PI, 2);
        label("band", x(BAND_LABEL_AT_PI), y(hiAt), document.createTextNode(`Band: ${data.band.profiles.length} thrust profiles`));
      }
    } else {
      data.arrival_family.curves.forEach((c, i) => {
        const pts = c.median.Pi.map((p, j) => [p, c.median.loss_rel[j]] as [number, number]);
        svg.append(s("path", { class: "sim-line", style: `stroke: var(--slate-${FAMILY_STEPS[i]})`, d: line().x((d) => x(d[0])).y((d) => y(d[1]))(pts) ?? "" }));
        const last = pts[pts.length - 1];
        if (!narrow) svg.append(s("text", { class: "annot-2", x: x(last[0]) + 6, y: y(last[1]) + 4 }, sig(c.v_over_vesc, 2)));
      });
      place(overlay, `${tex.vRatio}`, narrow ? m.left + 4 : W - m.right + 6, m.top - 4, "start", narrow ? "" : "family-key");
    }
    const bound = data.bound.Pi.map((p, i) => [p, data.bound.loss_rel[i]] as [number, number]);
    svg.append(s("path", { class: "theory-line", d: line().x((d) => x(d[0])).y((d) => y(d[1]))(bound) ?? "" }));
    const bAt = bound[Math.round(bound.length * 0.62)];
    const bx = x(bAt[0]), by = y(bAt[1]);
    if (!narrow) {
      svg.append(s("path", { class: "leader", d: `M${bx},${by} l-22,-26` }));
      place(overlay, `${tex.bound} <span class="annot-text">leading-order bound</span>`, bx - 24, by - 46, "end");
    }

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
        if (!narrow) label(r.id.startsWith("electric") ? "electric" : r.id.startsWith("nuclear") ? "nuclear" : r.id,
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
        hit(gr, cx, cy, c.label, () => caseTip(c, site));
        if (!narrow) label(c.id, x(b), y(lo), citation(c.label, c.ref));
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
      hit(gr, px, py, c.label, () => caseTip(c, site));
      if (!narrow) label(c.id, px, py, citation(c.label, c.ref));
    }

    // Crosshair readout along the band (pointer; the data table carries the same values for keyboard users).
    const area_ = s("rect", { class: "hit", x: m.left, y: m.top, width: W - m.left - m.right, height: H - m.top - m.bottom, "aria-hidden": "true" });
    const cross = s("line", { class: "leader", y1: m.top, y2: H - m.bottom, visibility: "hidden" });
    svg.insertBefore(area_, svg.firstChild);
    svg.append(cross);
    area_.addEventListener("pointermove", (ev) => {
      const [mx] = pointer(ev);
      const P = x.invert(mx);
      cross.setAttribute("x1", String(mx)); cross.setAttribute("x2", String(mx));
      cross.setAttribute("visibility", "visible");
      const lo = interpLog(bandPts, P, 1), hi = interpLog(bandPts, P, 2);
      showTip(mx + 12, y(Math.max(1e-9, hi || 1e-9)) - 10, h("div", {},
        h("div", { class: "tt-title" }, `Π = ${sig(P)}`),
        h("dl", {}, h("dt", {}, "Band, loss/Δv"), h("dd", {}, Number.isFinite(lo) ? `${lossRel(lo)} to ${lossRel(hi)}` : "—"),
          h("dt", {}, "Bound Π²/96"), h("dd", {}, P <= 10 ? lossRel((P * P) / 96) : "—")),
        h("div", { class: "tt-source" }, "Data: ", sourceLink(site, data.bound.data), ", ", sourceLink(site, "results/phase4.parquet"))));
    });
    area_.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); hideTip(); });

    function label(id: string, px: number, py: number, content: Node): void {
      const at = LABEL_AT[id] ?? { dx: 14, dy: -14, anchor: "start" as const };
      const lx = px + at.dx, ly = py + at.dy;
      svg.append(s("path", { class: "leader", d: `M${px + Math.sign(at.dx) * 6},${py + Math.sign(at.dy) * 6} L${lx},${ly}` }));
      const el = h("div", { class: "annot-html" }, content);
      overlay.append(el);
      position(el, lx + (at.anchor === "end" ? -3 : 3), ly + (at.dy < 0 ? -18 : 2), at.anchor);
    }
    function hit(gr: SVGGElement, cx: number, cy: number, name: string, content: () => HTMLElement): void {
      const target = s("circle", { class: "hit", cx, cy, r: 16, tabindex: 0, role: "button", "aria-label": `${name}: details` });
      const ring = s("circle", { class: "focus-ring", cx, cy, r: 12 });
      gr.append(target, ring);
      const show = () => { gr.classList.add("hover"); showTip(cx + 16, cy - 8, content()); };
      const hide = () => { gr.classList.remove("hover"); hideTip(); };
      target.addEventListener("pointerenter", show);
      target.addEventListener("pointerleave", hide);
      target.addEventListener("focus", show);
      target.addEventListener("blur", hide);
      target.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
    }
  }

  function showTip(px: number, py: number, content: HTMLElement): void {
    tip.replaceChildren(content);
    tip.hidden = false;
    const W = plot.clientWidth, w = tip.offsetWidth, hgt = tip.offsetHeight;
    tip.style.left = `${Math.max(0, Math.min(px, W - w))}px`;
    tip.style.top = `${Math.max(0, py - hgt)}px`;
  }
  function hideTip(): void { tip.hidden = true; }
  function pointer(ev: PointerEvent): [number, number] {
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return [((ev.clientX - r.left) * vb.width) / r.width, ((ev.clientY - r.top) * vb.height) / r.height];
  }
}

// ---------------------------------------------------------------- pieces

const ordinal = (n: number) => `${n}${[11, 12, 13].includes(n % 100) ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
const pct = ([a, b]: [number, number]) => `${ordinal(a)} to ${ordinal(b)} percentile`;

function glyph(kind: "solid" | "dashed" | "hollow"): SVGSVGElement {
  const g = s("svg", { width: 22, height: 10, "aria-hidden": "true" });
  if (kind === "hollow") g.append(s("circle", { cx: 11, cy: 5, r: 4, class: "mark-pub", "stroke-width": 1.5 }));
  else g.append(s("line", { x1: 1, x2: 21, y1: 5, y2: 5, stroke: kind === "solid" ? "var(--ink)" : "var(--graphite)",
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
    items.push([g, citation(c.label, c.ref)]);
  }
  items.push([mk([s("line", { class: "range-bar", x1: -10, x2: 10, y1: 0, y2: 0 }), s("circle", { class: "mark-sim", r: 4 })]),
    document.createTextNode(`Mission samples at the Sun: median, ${pct(d.ranges[0].percentiles)}`)]);
  items.push([mk([s("rect", { class: "band", x: -10, y: -3, width: 20, height: 6 }), s("line", { class: "band-edge", x1: -10, x2: 10, y1: -3, y2: -3 }),
    s("line", { class: "band-edge", x1: -10, x2: 10, y1: 3, y2: 3 })]), document.createTextNode(`Band: ${d.band.profiles.length} thrust profiles (simulation)`)]);
  const boundLabel = h("span", {});
  boundLabel.append(frag(tex.bound), " leading-order bound (theory)");
  items.push([mk([s("line", { class: "theory-line", x1: -10, x2: 10, y1: 0, y2: 0 })]), boundLabel]);
  items.push([mk([s("line", { class: "threshold", x1: -10, x2: 10, y1: 0, y2: 0 })]),
    document.createTextNode(d.thresholds.map((t) => t.level.replace("%", " %")).join(" and ") + " loss")]);
  return h("ul", { class: "legend", "aria-label": "Legend" }, ...items.map(([g, t]) => h("li", {}, g, t)));
}

function place(layer: HTMLElement, html: string, x: number, y: number, anchor: "start" | "middle" | "end", cls = ""): HTMLElement {
  const el = h("div", { class: `annot-html ${cls}` });
  el.append(frag(html));
  layer.append(el);
  position(el, x, y, anchor);
  return el;
}

function position(el: HTMLElement, x: number, y: number, anchor: "start" | "middle" | "end"): void {
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.transform = anchor === "end" ? "translateX(-100%)" : anchor === "middle" ? "translateX(-50%)" : "";
}

function interpLog(pts: [number, number, number][], P: number, k: 1 | 2): number {
  if (P < pts[0][0] || P > pts[pts.length - 1][0]) return NaN;
  let i = 1;
  while (i < pts.length - 1 && pts[i][0] < P) i++;
  const [a, b] = [pts[i - 1], pts[i]];
  const t = (Math.log(P) - Math.log(a[0])) / (Math.log(b[0]) - Math.log(a[0]));
  return Math.exp(Math.log(a[k]) + t * (Math.log(b[k]) - Math.log(a[k])));
}

function caseTip(c: Case, site: SiteData): HTMLElement {
  const rows: [string, string][] = [];
  if (c.Pi) rows.push(["Π", sig(c.Pi.value)]);
  if (c.Pi_range) rows.push(["Π_eff", `${sig(c.Pi_range.value[0])} to ${sig(c.Pi_range.value[1])}`]);
  if (c.loss_rel) rows.push(["loss/Δv", lossRel(c.loss_rel.value)]);
  if (c.loss_rel_range) rows.push(["loss/Δv", `${lossRel(c.loss_rel_range.value[0])} to ${lossRel(c.loss_rel_range.value[1])}`]);
  if (c.loss_m_s) rows.push(["loss", speed(c.loss_m_s.value)]);
  return h("div", {},
    h("div", { class: "tt-title" }, citation(c.label, c.ref)),
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
    rows.push(h("tr", {}, h("th", { scope: "row" }, citation(c.label, c.ref)), h("td", {}, c.kind === "simulation" ? "simulation" : "published"),
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
    ? `${c.label} at Π = ${sig(c.Pi.value)} (loss ${lossRel(c.loss_rel!.value)} of Δv)`
    : `${c.label} at an effective Π of ${sig(c.Pi_range!.value[0])} to ${sig(c.Pi_range!.value[1])}`);
  return `Log–log plot of finite-burn loss as a fraction of Δv against Π. The band of thrust profiles reaches ` +
    `${t1.level.replace("%", " %")} loss at Π = ${sig(t1.Pi.value)} and ${t2.level.replace("%", " %")} at Π = ${sig(t2.Pi.value)}. ` +
    `The dashed line is the leading-order bound Π²/96. Cases: ${parts.join("; ")}.`;
}
