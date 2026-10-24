// Three regimes: η_W against Π (log–log) for one sweep arrival speed at a time (author decision, 2026-10-15: η_W,
// because the asymptotes are derived for it). Sweep medians with the 10th–90th percentile band (simulation); the
// Δv → 0 linear response and the asymptotes I: 1 − C₀Π², II: (9/2Π)^(1/3), III: the tail (theory, dashed); the
// crossover Π_T. Every value drawn or printed comes from regimes.json (scripts/export_site_data.py).
import { scaleLog } from "d3-scale";
import { area, line } from "d3-shape";
import tex from "virtual:tex";
import { snapSlider } from "../controls/snap-slider";
import { sourceLink } from "../lib/cite";
import type { Provenance, SiteData } from "../lib/data";
import { frag, h, onFontsLoaded, s, setText } from "../lib/dom";
import { pow10, sig } from "../lib/format";
import { signal } from "../lib/signal";
import { chips, dataTable, LabelPlacer, logAxes, piTick, place, svgPointer, tooltip, type LabelAt } from "./common";

type Curve = { Pi: number[]; eta_W: number[] };
interface Family {
  v_over_vesc: number; Pi_T: number; c0: number; n_runs: number;
  bins: { Pi: number[]; eta_W: number[]; eta_W_p10: number[]; eta_W_p90: number[]; eta: number[]; n: number[] };
  linear: Curve; small: Curve; core: Curve; tail: Curve;
}
export interface RegimesData { provenance: Provenance; selection: string; eta_minus_eta_W_max_abs: number; families: Family[] }

const PI_DOMAIN: [number, number] = [1e-3, 1e7];          // to 10⁷: Π_T reaches 9.6 × 10⁶ (RESEARCH_LOG 2026-10-18)
const ETA_DOMAIN: [number, number] = [1e-5, 2];
const PI_TICKS = Array.from({ length: 11 }, (_, i) => 10 ** (i - 3));
const ETA_TICKS = [1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1];
type Layer = "linear" | "small" | "core" | "tail";
const LAYERS: { id: Layer; cls: string; name: string; label: () => string; at: LabelAt; where: number }[] = [
  { id: "linear", cls: "theory-linear", name: "Δv → 0 response", label: () => "Δv → 0 response", at: { dx: 16, dy: -22, anchor: "start" }, where: 0.55 },
  { id: "small", cls: "theory-I", name: "I", label: () => `I: ${tex.regimeI}`, at: { dx: -14, dy: 26, anchor: "end" }, where: 0.97 },
  { id: "core", cls: "theory-II", name: "II", label: () => `II: ${tex.regimeII}`, at: { dx: 18, dy: -20, anchor: "start" }, where: 0.25 },
  { id: "tail", cls: "theory-III", name: "III", label: () => "III: hyperbolic tail", at: { dx: -18, dy: 22, anchor: "end" }, where: 0.2 },
];
const SOURCE = "results/sweep_nd.parquet";

export function regimes(root: HTMLElement, data: RegimesData, site: SiteData, opt: { figN: number; title: string }): void {
  const uid = `rg${opt.figN}`;
  const fams = data.families;
  // Default: the arrival speed nearest v∞/v_esc = 0.1, whose Π_T falls mid-plot (an interface choice).
  const start = fams.reduce((b, f, i) => (Math.abs(Math.log(f.v_over_vesc / 0.1)) < Math.abs(Math.log(fams[b].v_over_vesc / 0.1)) ? i : b), 0);
  const layers = signal<Set<string>>(new Set(LAYERS.map((l) => l.id)));

  const key = h("div", { class: "prov-key", "aria-label": "Key" },
    h("span", {}, keyGlyph("data-line"), "Simulation"), h("span", {}, keyGlyph("theory-line"), "Theory"));
  const head = h("div", { class: "figure-head" },
    h("h3", { class: "figure-title", id: `${uid}-title` }, h("span", { class: "fig-n" }, `Figure ${opt.figN}`), opt.title), key);
  const vLabel = h("span", {});
  vLabel.append(frag(tex.vRatio));
  const slider = snapSlider({ id: `${uid}-v`, label: vLabel, values: fams.map((f) => f.v_over_vesc), index: start, format: (v) => sig(v, 2) });
  const layerChips = chips("Theory", LAYERS.map((l) => [l.id, h("span", {}, frag(l.label()))]), layers.get(), `${uid}-plot`, (on) => layers.set(on));
  const controls = h("div", { class: "controls" }, slider.el, layerChips);

  const svg = s("svg", { role: "img", "aria-labelledby": `${uid}-title`, "aria-describedby": `${uid}-summary`, id: `${uid}-plot` });
  const overlay = h("div", { class: "overlay", "aria-hidden": "true" });
  const plot = h("div", { class: "plot" }, svg, overlay);
  const tip = tooltip(plot);
  const theoryLink = h("a", { href: `${site.repo.url}/blob/${site.repo.tag}/docs/theory.md#2-exact-energy-bookkeeping`, rel: "noopener" }, "theory.md §2");
  const note = h("p", { class: "figure-note" });
  note.append(frag(tex.etaW), " is the baseline-subtracted energy efficiency. It and ", frag(tex.eta), ", with the exact map between them, are defined in ", theoryLink, ".");
  const summary = h("p", { class: "summary", id: `${uid}-summary` });
  const tables = h("div", {});
  root.append(head, controls, plot, legend(), note, summary, tables);

  let width = 0;
  const redraw = () => tip.redraw(() => draw(width));          // an open tooltip survives (common.tooltip)
  new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width);
    if (w !== width) { width = w; requestAnimationFrame(redraw); }
  }).observe(plot);
  slider.index.subscribe(() => { if (width) redraw(); update(); });
  layers.subscribe(() => width && redraw());
  onFontsLoaded(() => width && requestAnimationFrame(redraw));

  function update(): void {
    const f = fams[slider.index.get()];
    const inRange = f.Pi_T <= PI_DOMAIN[1];
    const selection = data.selection.replace("dv_over_vp", "Δv/v_p");
    setText(summary, `Sweep medians of η_W against Π for v∞/v_esc = ${sig(f.v_over_vesc, 2)} (${f.n_runs} runs: ${selection}), ` +
      `with the 10th to 90th percentile band, the Δv → 0 response and the three asymptotes. ` +
      `The crossover Π_T = ${sig(f.Pi_T, 2)}${inRange ? "" : ", beyond the plotted range"}; C₀ = ${sig(f.c0)}. ` +
      `Across the selection, η and η_W differ by up to ${sig(data.eta_minus_eta_W_max_abs, 2)}.`);
    tables.replaceChildren(binsTable(f), familiesTable());
  }

  function draw(W: number): void {
    if (W < 240) return;
    const narrow = W < 560;
    const labelled = W >= 640;                                      // as the universal curve: below, the legend names the lines
    const f = fams[slider.index.get()];
    const on = layers.get();
    const H = Math.round(narrow ? W * 1.05 : Math.min(560, Math.max(360, W * 0.6)));
    // Two rows above the plot: the y-axis title, then the Π_T label (which can sit anywhere along the top).
    const m = { top: 54, right: narrow ? 12 : 24, bottom: 52, left: narrow ? 44 : 56 };
    const x = scaleLog().domain(PI_DOMAIN).range([m.left, W - m.right]).clamp(true);
    const y = scaleLog().domain(ETA_DOMAIN).range([H - m.bottom, m.top]).clamp(true);
    svg.replaceChildren();
    overlay.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("height", String(H));
    logAxes(svg, x, y, W, H, m, { xTicks: PI_TICKS, yTicks: ETA_TICKS, xFmt: piTick, yFmt: pow10, everyX: narrow ? 2 : 1 });
    const yTitle = h("span", {});
    yTitle.append(frag(tex.etaW), h("span", { class: "annot-text" }, narrow ? "" : "(baseline-subtracted energy efficiency)"));
    place(overlay, yTitle, 0, 4, "start");
    place(overlay, tex.PiDef, (m.left + W - m.right) / 2, H - 22, "middle");

    const inX = (p: number) => p >= PI_DOMAIN[0] && p <= PI_DOMAIN[1];
    const pts = (c: Curve) => c.Pi.map((p, i) => [p, c.eta_W[i]] as [number, number]).filter(([p, e]) => inX(p) && e > 0);
    const path = (p: [number, number][]) => line().x((d) => x(d[0])).y((d) => y(d[1]))(p) ?? "";

    // The other arrival speeds, quietly, for context.
    for (const g of fams) if (g !== f) {
      svg.append(s("path", { class: "context-line", d: path(g.bins.Pi.map((p, i) => [p, g.bins.eta_W[i]] as [number, number]).filter(([p, e]) => inX(p) && e > 0)) }));
    }
    // Π_T: the crossover into the hyperbolic tail.
    if (inX(f.Pi_T)) {
      svg.append(s("line", { class: "ref-line", x1: x(f.Pi_T), x2: x(f.Pi_T), y1: m.top, y2: H - m.bottom }));
      const lab = h("span", {});
      lab.append(frag(tex.PiT), ` = ${sig(f.Pi_T, 2)}`);
      const el = place(overlay, lab, x(f.Pi_T), m.top - 22, "middle", "annot-2-html");
      const half = el.offsetWidth / 2;                              // keep it on the figure at either end
      el.style.left = `${Math.min(W - half, Math.max(half, x(f.Pi_T)))}px`;
    }
    // Sweep medians and the percentile band.
    const b = f.bins;
    const binPts = b.Pi.map((p, i) => ({ p, e: b.eta_W[i], lo: b.eta_W_p10[i], hi: b.eta_W_p90[i] })).filter((d) => inX(d.p) && d.e > 0 && d.lo > 0);
    svg.append(s("path", { class: "band", d: area<typeof binPts[number]>().x((d) => x(d.p)).y0((d) => y(d.lo)).y1((d) => y(d.hi))(binPts) ?? "" }));
    svg.append(s("path", { class: "data-line", d: path(binPts.map((d) => [d.p, d.e])) }));
    for (const d of binPts) svg.append(s("circle", { class: "data-dot", cx: x(d.p), cy: y(d.e), r: 2.2 }));

    // Theory.
    const placer = new LabelPlacer(svg, overlay, plot, W, H - m.bottom);
    for (const l of LAYERS) {
      if (!on.has(l.id)) continue;
      const p = pts(f[l.id]);
      if (p.length < 2) continue;                                   // e.g. the tail beyond the plot
      svg.append(s("path", { class: `theory-line ${l.cls}`, d: path(p) }));
      const at = p[Math.min(p.length - 1, Math.round((p.length - 1) * l.where))];
      if (labelled) placer.add(x(at[0]), y(at[1]), h("span", {}, frag(l.label())), l.at);
    }
    const mid = binPts[Math.round(binPts.length * 0.62)];
    if (mid) {
      const lab = h("span", {});
      lab.append("sweep median, ", frag(tex.vRatio), ` = ${sig(f.v_over_vesc, 2)}`);
      if (labelled) placer.add(x(mid.p), y(mid.e), lab, { dx: -18, dy: 30, anchor: "end" });
    }
    placer.finish();                                                // all or none; the legend names every line

    // Crosshair readout: the nearest bin of the selected arrival speed.
    const hit = s("rect", { class: "hit", x: m.left, y: m.top, width: W - m.left - m.right, height: H - m.top - m.bottom, "aria-hidden": "true" });
    const cross = s("line", { class: "leader", y1: m.top, y2: H - m.bottom, visibility: "hidden" });
    svg.insertBefore(hit, svg.firstChild);
    svg.append(cross);
    hit.addEventListener("pointermove", (ev) => {
      const [mx] = svgPointer(svg, ev);
      const P = x.invert(mx);
      const i = b.Pi.reduce((best, p, k) => (Math.abs(Math.log(p / P)) < Math.abs(Math.log(b.Pi[best] / P)) ? k : best), 0);
      const px = x(b.Pi[i]);
      cross.setAttribute("x1", String(px)); cross.setAttribute("x2", String(px));
      cross.setAttribute("visibility", "visible");
      tip.show(px + 12, y(Math.max(ETA_DOMAIN[0], b.eta_W[i])) - 10, h("div", {},
        h("div", { class: "tt-title" }, `Π = ${sig(b.Pi[i])} (bin mean)`),
        h("dl", {}, h("dt", {}, "η_W, median"), h("dd", {}, sig(b.eta_W[i], 4)),
          h("dt", {}, "η_W, 10th to 90th"), h("dd", {}, `${sig(b.eta_W_p10[i], 3)} to ${sig(b.eta_W_p90[i], 3)}`),
          h("dt", {}, "η, median"), h("dd", {}, sig(b.eta[i], 4)),
          h("dt", {}, "runs"), h("dd", {}, String(b.n[i]))),
        h("div", { class: "tt-source" }, "Data: ", sourceLink(site, SOURCE))));
    });
    hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); tip.hide(); });
  }

  function binsTable(f: Family): HTMLDetailsElement {
    const b = f.bins;
    return dataTable(`Sweep bins for v∞/v_esc = ${sig(f.v_over_vesc, 2)} (bins of a quarter decade; Π is the bin's geometric mean)`,
      ["Π", "η_W median", "η_W 10th", "η_W 90th", "η median", "runs"],
      b.Pi.map((p, i) => [sig(p), sig(b.eta_W[i], 4), sig(b.eta_W_p10[i], 4), sig(b.eta_W_p90[i], 4), sig(b.eta[i], 4), String(b.n[i])]),
      [1, 2, 3, 4, 5], sourceNote(), "Show data: this arrival speed");
  }
  function familiesTable(): HTMLDetailsElement {
    return dataTable("Every sweep arrival speed: the crossover Π_T and the regime-I coefficient C₀ (theory), and the runs selected",
      ["v∞/v_esc", "Π_T", "C₀", "runs"],
      fams.map((g) => [sig(g.v_over_vesc, 3), sig(g.Pi_T, 3), sig(g.c0, 3), String(g.n_runs)]), [1, 2, 3], sourceNote(),
      "Show data: every arrival speed");
  }
  function sourceNote(): Node {
    const n = h("span", {}, "Data: ", sourceLink(site, SOURCE), "; theory: ", sourceLink(site, "src/oberth_atlas/theory.py"));
    return n;
  }
  function legend(): HTMLElement {
    const mk = (draw: SVGElement[]) => s("svg", { width: 22, height: 16, viewBox: "-11 -8 22 16", "aria-hidden": "true" }, ...draw);
    const items: [SVGSVGElement, Node][] = [
      [mk([s("line", { class: "data-line", x1: -10, x2: 10, y1: 0, y2: 0 }), s("circle", { class: "data-dot", r: 2.2 })]),
        document.createTextNode("Sweep median (simulation)")],
      [mk([s("rect", { class: "band", x: -10, y: -4, width: 20, height: 8 })]), document.createTextNode("10th to 90th percentile")],
      [mk([s("line", { class: "context-line", x1: -10, x2: 10, y1: 0, y2: 0 })]), document.createTextNode("Other arrival speeds")],
      ...LAYERS.map((l): [SVGSVGElement, Node] => [mk([s("line", { class: `theory-line ${l.cls}`, x1: -10, x2: 10, y1: 0, y2: 0 })]),
        h("span", {}, frag(l.label()), " (theory)")]),
      [mk([s("line", { class: "ref-line", x1: 0, x2: 0, y1: -7, y2: 7 })]), h("span", {}, frag(tex.PiT), " crossover into the tail")],
    ];
    return h("ul", { class: "legend", "aria-label": "Legend" }, ...items.map(([g, t]) => h("li", {}, g, t)));
  }
}

function keyGlyph(cls: string): SVGSVGElement {
  return s("svg", { width: 22, height: 10, "aria-hidden": "true" }, s("line", { class: cls, x1: 1, x2: 21, y1: 5, y2: 5 }));
}
