// Case study: Hibberd et al.'s solar Oberth burn. Loss in m/s against the thrust scale (the stack's thrust times
// a factor), from Phase 4's time-centred sweep; the reference burn; the 0.1 % and 1 % loss points. Every value
// drawn or printed comes from case.json (scripts/export_site_data.py: results/phase4.parquet,
// figures/phase4_numbers.json).
import { scaleLog } from "d3-scale";
import { line } from "d3-shape";
import { citation, sourceLink } from "../lib/cite";
import type { Provenance, SiteData, Sourced } from "../lib/data";
import { h, onFontsLoaded, s } from "../lib/dom";
import { duration, lossRel, pow10, sig, speed } from "../lib/format";
import { dataTable, hitTarget, LabelPlacer, logAxes, place, svgPointer, tooltip } from "./common";

interface Threshold { level: string; Pi: Sourced; thrust_scale_divisor: Sourced; a0_m_s2: Sourced; burn_duration_s: Sourced }
export interface CaseData {
  provenance: Provenance; ref: number;
  stack: Record<"m0_kg" | "dv_rocket_m_s" | "hibberd_dv_m_s" | "v_p_km_s" | "tau_s" | "duration_s" | "Pi", Sourced>;
  loss_m_s: { time_centred: Sourced; optimal: Sourced };
  loss_rel: { time_centred: Sourced; optimal: Sourced };
  optimal_offset_s: Sourced;
  thresholds: Threshold[];
  margin_curve: { thrust_scale: number[]; Pi: number[]; loss_rel: number[]; loss_m_s: number[]; data: string };
  sensitivity_m_s: { label: string; time_centred: Sourced }[];
}

const F_TICKS = [1e-4, 1e-3, 1e-2, 1e-1, 1];
const L_TICKS = [0.01, 0.1, 1, 10, 100, 1000, 1e4];
const fScale = (f: number) => (f >= 0.01 ? sig(f, 2).replace(/\.?0+$/, "") : pow10(f));

export function caseStudy(root: HTMLElement, d: CaseData, site: SiteData, opt: { figN: number; title: string }): void {
  const uid = `cs${opt.figN}`;
  const c = d.margin_curve;
  const dv = d.stack.dv_rocket_m_s.value;
  const who = () => citation("Hibberd et al.", d.ref);

  const head = h("div", { class: "figure-head" },
    h("h3", { class: "figure-title", id: `${uid}-title` }, h("span", { class: "fig-n" }, `Figure ${opt.figN}`), opt.title),
    h("div", { class: "prov-key", "aria-label": "Key" }, h("span", {}, keyLine(), "Simulation (Phase 4 sweep)")));
  const svg = s("svg", { role: "img", "aria-labelledby": `${uid}-title`, "aria-describedby": `${uid}-summary`, id: `${uid}-plot` });
  const overlay = h("div", { class: "overlay", "aria-hidden": "true" });
  const plot = h("div", { class: "plot" }, svg, overlay);
  const tip = tooltip(plot);
  const fact = (k: Node | string, v: Node | string) => h("div", {}, h("dt", {}, k), h("dd", {}, v));
  const facts = h("dl", { class: "facts case-facts" },
    fact(h("span", {}, "Burn of ", who(), ", time-centred"), `${speed(d.loss_m_s.time_centred.value)} lost (${lossRel(d.loss_rel.time_centred.value)} of Δv)`),
    fact("Best placement", `${speed(d.loss_m_s.optimal.value)} lost, starting ${sig(-d.optimal_offset_s.value, 3)} s earlier`),
    fact("Burn", `${duration(d.stack.duration_s.value)}; Π = ${sig(d.stack.Pi.value)}; τ = ${duration(d.stack.tau_s.value)}`),
    fact("Δv (rocket equation, this model)", h("span", {}, `${speed(dv, 4)}; `, who(), ` give ${speed(d.stack.hibberd_dv_m_s.value, 4)}`)),
    ...d.thresholds.map((t) => fact(`${t.level.replace("%", " %")} loss`,
      `at 1/${sig(t.thrust_scale_divisor.value, 3)} of the thrust: Π = ${sig(t.Pi.value)}, burn ${duration(t.burn_duration_s.value)}`)));
  const summary = h("p", { class: "summary", id: `${uid}-summary` });
  summary.textContent = `Loss of Hibberd et al.'s solar Oberth burn against its thrust, scaled down from the reference stack (scale 1), ` +
    `with the burn centred on perihelion. At scale 1 the loss is ${speed(d.loss_m_s.time_centred.value)}; it reaches 0.1 % of Δv at ` +
    `1/${sig(d.thresholds[0].thrust_scale_divisor.value, 3)} of the thrust and 1 % at 1/${sig(d.thresholds[1].thrust_scale_divisor.value, 3)}.`;
  root.append(head, plot, legend(), facts, summary, tables());

  let width = 0;
  const redraw = () => draw(width);
  new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width);
    if (w !== width) { width = w; requestAnimationFrame(redraw); }
  }).observe(plot);
  onFontsLoaded(() => width && requestAnimationFrame(redraw));

  function draw(W: number): void {
    if (W < 240) return;
    const narrow = W < 560;
    const H = Math.round(narrow ? W * 0.95 : Math.min(500, Math.max(340, W * 0.5)));
    const m = { top: 34, right: narrow ? 12 : 110, bottom: 52, left: narrow ? 44 : 56 };
    const x = scaleLog().domain([1e-4, 1.6]).range([m.left, W - m.right]).clamp(true);
    // Down to 0.01 m/s: room under the curve for the reference burn's label (the curve ends at 0.099 m/s).
    const y = scaleLog().domain([0.01, 1.5e4]).range([H - m.bottom, m.top]).clamp(true);
    svg.replaceChildren();
    overlay.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("height", String(H));
    tip.hide();
    logAxes(svg, x, y, W, H, m, { xTicks: F_TICKS, yTicks: L_TICKS, xFmt: fScale, yFmt: (t) => (t >= 1 ? String(t) : sig(t, 1)) });
    place(overlay, "loss, m/s", 0, 4, "start");
    place(overlay, h("span", {}, "thrust scale (× the stack's thrust)"), (m.left + W - m.right) / 2, H - 22, "middle");

    // 0.1 % and 1 % of Δv.
    for (const t of d.thresholds) {
      const L = Number(t.level.replace("%", "")) / 100 * dv;
      svg.append(s("line", { class: "threshold", x1: m.left, x2: W - m.right, y1: y(L), y2: y(L) }));
      svg.append(s("text", { class: "annot-2", x: narrow ? m.left + 4 : W - m.right + 6, y: y(L) + (narrow ? -5 : 4) },
        `${t.level.replace("%", " %")} loss`));
    }
    const pts = c.thrust_scale.map((f, i) => [f, c.loss_m_s[i]] as [number, number]);
    svg.append(s("path", { class: "data-line", d: line().x((p) => x(p[0])).y((p) => y(p[1]))(pts) ?? "" }));

    const placer = new LabelPlacer(svg, overlay, plot, W, H - m.bottom);
    const labelled = W >= 640;
    // The reference burn (scale 1).
    const rx = x(1), ry = y(d.loss_m_s.time_centred.value);
    const refG = s("g", {}, s("rect", { class: "mark-sim", x: rx - 5.5, y: ry - 5.5, width: 11, height: 11 }));
    svg.append(refG);
    hitTarget(refG, rx, ry, "reference burn", tip, () => h("div", {},
      h("div", { class: "tt-title" }, h("span", {}, "Reference stack of ", who())),
      h("dl", {}, h("dt", {}, "loss"), h("dd", {}, speed(d.loss_m_s.time_centred.value)), h("dt", {}, "Π"), h("dd", {}, sig(d.stack.Pi.value)),
        h("dt", {}, "burn"), h("dd", {}, duration(d.stack.duration_s.value))),
      h("div", { class: "tt-source" }, "Data: ", sourceLink(site, "figures/phase4_numbers.json"))));
    if (labelled) placer.add(rx, ry, h("span", {}, "reference stack: ", speed(d.loss_m_s.time_centred.value)), { dx: -16, dy: 22, anchor: "end" });
    // Where the loss reaches 0.1 % and 1 %.
    d.thresholds.forEach((t) => {
      const f = 1 / t.thrust_scale_divisor.value, L = Number(t.level.replace("%", "")) / 100 * dv;
      const g = s("g", {}, s("circle", { class: "mark-sim", cx: x(f), cy: y(L), r: 4.5 }));
      svg.append(g);
      hitTarget(g, x(f), y(L), `${t.level} loss`, tip, () => h("div", {},
        h("div", { class: "tt-title" }, `${t.level.replace("%", " %")} loss`),
        h("dl", {}, h("dt", {}, "thrust"), h("dd", {}, `1/${sig(t.thrust_scale_divisor.value, 3)} of the stack's`),
          h("dt", {}, "Π"), h("dd", {}, sig(t.Pi.value)), h("dt", {}, "burn"), h("dd", {}, duration(t.burn_duration_s.value)),
          h("dt", {}, "a₀"), h("dd", {}, `${sig(t.a0_m_s2.value)} m/s²`)),
        h("div", { class: "tt-source" }, "Data: ", sourceLink(site, "figures/phase4_numbers.json"))));
      if (labelled) placer.add(x(f), y(L), h("span", {}, `${t.level.replace("%", " %")} at 1/${sig(t.thrust_scale_divisor.value, 2)} of the thrust`),
        { dx: 16, dy: -22, anchor: "start" });                    // above and to the right: clear of the falling curve
    });
    placer.finish();

    // Crosshair readout along the sweep.
    const hitArea = s("rect", { class: "hit", x: m.left, y: m.top, width: W - m.left - m.right, height: H - m.top - m.bottom, "aria-hidden": "true" });
    const cross = s("line", { class: "leader", y1: m.top, y2: H - m.bottom, visibility: "hidden" });
    svg.insertBefore(hitArea, svg.firstChild);
    svg.append(cross);
    hitArea.addEventListener("pointermove", (ev) => {
      const [mx] = svgPointer(svg, ev);
      const F = x.invert(mx);
      const i = c.thrust_scale.reduce((b, f, k) => (Math.abs(Math.log(f / F)) < Math.abs(Math.log(c.thrust_scale[b] / F)) ? k : b), 0);
      const px = x(c.thrust_scale[i]);
      cross.setAttribute("x1", String(px)); cross.setAttribute("x2", String(px));
      cross.setAttribute("visibility", "visible");
      tip.show(px + 12, y(c.loss_m_s[i]) - 10, h("div", {},
        h("div", { class: "tt-title" }, `thrust × ${sig(c.thrust_scale[i], 2)}`),
        h("dl", {}, h("dt", {}, "loss"), h("dd", {}, speed(c.loss_m_s[i])), h("dt", {}, "loss/Δv"), h("dd", {}, lossRel(c.loss_rel[i])),
          h("dt", {}, "Π"), h("dd", {}, sig(c.Pi[i]))),
        h("div", { class: "tt-source" }, "Data: ", sourceLink(site, c.data))));
    });
    hitArea.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); tip.hide(); });
  }

  function legend(): HTMLElement {
    const mk = (draw: SVGElement[]) => s("svg", { width: 22, height: 16, viewBox: "-11 -8 22 16", "aria-hidden": "true" }, ...draw);
    const items: [SVGSVGElement, Node][] = [
      [mk([s("line", { class: "data-line", x1: -10, x2: 10, y1: 0, y2: 0 })]), document.createTextNode("Loss, burn centred on perihelion (simulation)")],
      [mk([s("rect", { class: "mark-sim", x: -5.5, y: -5.5, width: 11, height: 11 })]), h("span", {}, "Reference stack of ", who())],
      [mk([s("circle", { class: "mark-sim", r: 4.5 })]), document.createTextNode("Thrust at which the loss reaches 0.1 % or 1 % of Δv")],
      [mk([s("line", { class: "threshold", x1: -10, x2: 10, y1: 0, y2: 0 })]), document.createTextNode("0.1 % and 1 % of Δv")],
    ];
    return h("ul", { class: "legend", "aria-label": "Legend" }, ...items.map(([g, t]) => h("li", {}, g, t)));
  }

  function tables(): HTMLElement {
    const curve = dataTable("Loss against thrust scale (Phase 4 sweep, burn centred on perihelion)",
      ["thrust scale", "Π", "loss", "loss/Δv"],
      c.thrust_scale.map((f, i) => [sig(f, 2), sig(c.Pi[i]), speed(c.loss_m_s[i]), lossRel(c.loss_rel[i])]), [1, 2, 3],
      h("span", {}, "Data: ", sourceLink(site, c.data)), "Show data: loss against thrust");
    const sens = dataTable("Sensitivity of the reference loss to the arrival orbit, staging and thrust shape",
      ["Variant", "loss"], d.sensitivity_m_s.map((v) => [v.label, speed(v.time_centred.value)]), [1],
      h("span", {}, "Data: ", sourceLink(site, "figures/phase4_numbers.json")), "Show data: sensitivities");
    return h("div", {}, curve, sens);
  }
}

function keyLine(): SVGSVGElement {
  return s("svg", { width: 22, height: 10, "aria-hidden": "true" }, s("line", { class: "data-line", x1: 1, x2: 21, y1: 5, y2: 5 }));
}
