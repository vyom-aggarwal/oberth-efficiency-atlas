// Burn timing: the thrust-acceleration profile of a constant-thrust rocket burn for a chosen λ = Δv/c, with the
// time midpoint, the Δv-weighted mean x̄ and the half-Δv point x_½, and the closed-form timing results (theory).
// Every value drawn or printed comes from timing.json (scripts/export_site_data.py: optimize.py and theory.py
// evaluated unchanged; Phase 3's values for comparison).
import { scaleLinear } from "d3-scale";
import { area, line } from "d3-shape";
import tex from "virtual:tex";
import { snapSlider } from "../controls/snap-slider";
import { sourceLink } from "../lib/cite";
import type { Provenance, SiteData, Sourced } from "../lib/data";
import { frag, h, onFontsLoaded, s } from "../lib/dom";
import { sig } from "../lib/format";
import { dataTable, logAxes, place } from "./common";

interface Row {
  lam: number; x_centroid: number; x_median: number; delta_opt: number; delta_half: number;
  half_rule_capture: number; recovered_fraction_dv0: number; profile: number[];
}
interface Check { lam: number; recovered_fraction_dv0: Sourced; x_centroid: Sourced; x_median: Sourced; half_rule_capture: Sourced }
export interface TimingData { provenance: Provenance; x: number[]; rows: Row[]; phase3_checks: Check[] }

const pct = (v: number, n = 3) => `${sig(100 * v, n)} %`;

export function timing(root: HTMLElement, data: TimingData, site: SiteData, opt: { figN: number; title: string }): void {
  const uid = `tm${opt.figN}`;
  const rows = data.rows;
  // Default λ = 1 (an exported row; an interface choice). The colour scale spans every row, so colours compare.
  const start = rows.reduce((b, r, i) => (Math.abs(Math.log(r.lam)) < Math.abs(Math.log(rows[b].lam)) ? i : b), 0);
  const all = rows.flatMap((r) => r.profile);
  const fLo = Math.log(Math.min(...all)), fHi = Math.log(Math.max(...all));
  const yMax = Math.max(...all) * 1.08;

  const head = h("div", { class: "figure-head" },
    h("h3", { class: "figure-title", id: `${uid}-title` }, h("span", { class: "fig-n" }, `Figure ${opt.figN}`), opt.title),
    h("div", { class: "prov-key", "aria-label": "Key" }, h("span", {}, "Theory: closed forms")));
  const lamLabel = h("span", {});
  lamLabel.append(frag(tex.dvOverC));
  const slider = snapSlider({ id: `${uid}-lam`, label: lamLabel, values: rows.map((r) => r.lam), index: start, format: (v) => sig(v, 3) });
  const controls = h("div", { class: "controls" }, slider.el);
  const svg = s("svg", { role: "img", "aria-labelledby": `${uid}-title`, "aria-describedby": `${uid}-summary`, id: `${uid}-plot` });
  const overlay = h("div", { class: "overlay", "aria-hidden": "true" });
  const plot = h("div", { class: "plot" }, svg, overlay);
  const facts = h("dl", { class: "facts timing-facts", "aria-live": "polite" });
  const summary = h("p", { class: "summary", id: `${uid}-summary` });
  root.append(head, controls, plot, legend(), facts, summary, table());

  let width = 0;
  const redraw = () => draw(width);
  new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width);
    if (w !== width) { width = w; requestAnimationFrame(redraw); }
  }).observe(plot);
  slider.index.subscribe(() => { if (width) redraw(); update(); });
  onFontsLoaded(() => width && requestAnimationFrame(redraw));

  function update(): void {
    const r = rows[slider.index.get()];
    const fact = (k: Node | string, v: string) => h("div", {}, h("dt", {}, k), h("dd", {}, v));
    const lab = (t: string, text: string) => { const e = h("span", {}); e.append(frag(t), ` ${text}`); return e; };
    facts.replaceChildren(
      fact(lab(tex.xBar, "Δv-weighted mean time"), sig(r.x_centroid, 4)),
      fact(lab(tex.xHalf, "half the Δv delivered"), sig(r.x_median, 4)),
      fact(lab(tex.deltaStar, "best midpoint offset, in burn durations"), sig(r.delta_opt, 3)),
      fact("Half-Δv rule's offset", sig(r.delta_half, 3)),
      fact("Share of the best retiming gain the half-Δv rule captures", pct(r.half_rule_capture, 4)),
      fact("Share of the centred burn's deficit 1 − η that the best retiming recovers (small Π, Δv → 0)", pct(r.recovered_fraction_dv0)));
    const p = r.profile;
    summary.textContent = `For Δv/c = ${sig(r.lam, 3)}, the thrust acceleration rises from ${sig(p[0], 3)} to ${sig(p[p.length - 1], 3)} ` +
      `times its burn average as propellant is spent. Half the Δv is delivered at x = ${sig(r.x_median, 4)} and the Δv-weighted mean ` +
      `time is x̄ = ${sig(r.x_centroid, 4)}, so the best burn starts earlier by ${sig(-r.delta_opt, 3)} burn durations; putting ` +
      `periapsis at the half-Δv point captures ${pct(r.half_rule_capture, 4)} of that gain.`;
  }

  function draw(W: number): void {
    if (W < 240) return;
    const narrow = W < 560;
    const r = rows[slider.index.get()];
    const labelled = W >= 640;
    const ROWS = 3, ROW = 20;                                       // label rows above the plot (labelled widths)
    const H = Math.round((narrow ? W * 0.8 : Math.min(420, Math.max(300, W * 0.42))) + (labelled ? ROWS * ROW : 0));
    const m = { top: 34 + (labelled ? ROWS * ROW : 0), right: narrow ? 12 : 24, bottom: 52, left: narrow ? 40 : 52 };
    const x = scaleLinear().domain([0, 1]).range([m.left, W - m.right]);
    const y = scaleLinear().domain([0, yMax]).range([H - m.bottom, m.top]).nice();
    svg.replaceChildren();
    overlay.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("height", String(H));
    logAxes(svg, x, y, W, H, m, { xTicks: [0, 0.25, 0.5, 0.75, 1], yTicks: y.ticks(narrow ? 4 : 6),
      xFmt: (t) => sig(t, 2), yFmt: (t) => String(t) });
    place(overlay, tex.aOverMean, 0, 4, "start");
    const xTitle = h("span", {});
    xTitle.append(frag(tex.xDef), h("span", { class: "annot-text" }, "(time since ignition, in burn durations)"));
    place(overlay, xTitle, (m.left + W - m.right) / 2, H - 22, "middle");

    // The profile, filled with the Burn ramp by its value (log scale over every λ, so colours compare between λ).
    const gid = `${uid}-ramp`;
    const grad = s("linearGradient", { id: gid, x1: 0, x2: 1, y1: 0, y2: 0 });
    data.x.forEach((xx, i) => {
      const u = (Math.log(r.profile[i]) - fLo) / (fHi - fLo);
      grad.append(s("stop", { offset: xx, style: `stop-color: var(--burn-${1 + Math.round(u * 6)})` }));
    });
    svg.append(s("defs", {}, grad));
    const pts = data.x.map((xx, i) => [xx, r.profile[i]] as [number, number]);
    svg.append(s("path", { class: "profile-fill", fill: `url(#${gid})`, d: area().x((d) => x(d[0])).y0(y(0)).y1((d) => y(d[1]))(pts) ?? "" }),
      s("path", { class: "profile-line", d: line().x((d) => x(d[0])).y((d) => y(d[1]))(pts) ?? "" }));

    // The time midpoint, the Δv-weighted mean and the half-Δv point. For every λ, ½ < x̄ < x_½, so the labels stack
    // above the plot without crossing: x_½ on the top row to the right of its line, x̄ below it to the left, the
    // midpoint lowest to the left; each line reaches up to its own row only. Narrower plots: the legend names them.
    const marks: { cls: string; v: number; label: Node; row: number; anchor: "start" | "end" }[] = [
      { cls: "mark-mid", v: 0.5, label: document.createTextNode("time midpoint"), row: 2, anchor: "end" },
      { cls: "mark-xbar", v: r.x_centroid, label: frag(`${tex.xBar} Δv-weighted mean`), row: 1, anchor: "end" },
      { cls: "mark-xhalf", v: r.x_median, label: frag(`${tex.xHalf} half the Δv`), row: 0, anchor: "start" },
    ];
    for (const k of marks) {
      const rowY = 34 + k.row * ROW + ROW / 2;
      svg.append(s("line", { class: `timing-mark ${k.cls}`, x1: x(k.v), x2: x(k.v), y1: labelled ? rowY : m.top, y2: H - m.bottom }));
      if (labelled) place(overlay, h("span", {}, k.label), x(k.v) + (k.anchor === "start" ? 5 : -5), rowY - 9, k.anchor);
    }
  }

  function table(): HTMLDetailsElement {
    const checked = new Map(data.phase3_checks.map((c) => [c.lam, c]));
    const note = h("span", {}, "Closed forms: ", sourceLink(site, "src/oberth_atlas/optimize.py"), ", ", sourceLink(site, "src/oberth_atlas/theory.py"),
      ". Rows marked * are also in ", sourceLink(site, "figures/phase3_numbers.json"), ", with the same values.");
    return dataTable("Burn-timing closed forms for every Δv/c (x in burn durations; offsets of the burn midpoint from periapsis)",
      ["Δv/c", "x̄", "x½", "δ*", "half-Δv δ", "half-Δv share", "recovered (Δv → 0)"],
      rows.map((r) => {
        const c = checked.get(r.lam);
        const same = c && c.x_centroid.value === r.x_centroid && c.x_median.value === r.x_median &&
          c.half_rule_capture.value === r.half_rule_capture && c.recovered_fraction_dv0.value === r.recovered_fraction_dv0;
        return [`${sig(r.lam, 3)}${same ? " *" : ""}`, sig(r.x_centroid, 4), sig(r.x_median, 4), sig(r.delta_opt, 3), sig(r.delta_half, 3),
          pct(r.half_rule_capture, 4), pct(r.recovered_fraction_dv0)];
      }), [1, 2, 3, 4, 5, 6], note);
  }

  function legend(): HTMLElement {
    const mk = (draw: SVGElement[]) => s("svg", { width: 22, height: 16, viewBox: "-11 -8 22 16", "aria-hidden": "true" }, ...draw);
    const v = (cls: string) => mk([s("line", { class: `timing-mark ${cls}`, x1: 0, x2: 0, y1: -7, y2: 7 })]);
    const ramp = h("span", { class: "ramp-bar", "aria-hidden": "true" });
    const items: [Node, Node][] = [
      [ramp, h("span", {}, "Thrust acceleration (colour: its value, on one scale for every Δv/c)")],
      [v("mark-mid"), document.createTextNode("Time midpoint")],
      [v("mark-xbar"), h("span", {}, frag(tex.xBar), " Δv-weighted mean time")],
      [v("mark-xhalf"), h("span", {}, frag(tex.xHalf), " half the Δv delivered")],
    ];
    return h("ul", { class: "legend", "aria-label": "Legend" }, ...items.map(([g, t]) => h("li", {}, g, t)));
  }
}
