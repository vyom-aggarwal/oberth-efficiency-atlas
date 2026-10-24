// Placement of the reader's case on the universal curve (curve.json: the near-parabolic band, the Π²/96 bound, the
// 0.1 % and 1 % thresholds) and on the Δv → 0 theory atlas (presets.json: linear-response η, prograde). The markers are
// the classic explorer's: on the curve, which has no blue, an accent dot on a ring of the panel colour; on the blue
// atlas, where the accent would vanish, an Ink ring on a halo. A case beyond a plot's range sits on its edge, dashed and
// in Critical, and the summary says so.
import { scaleLinear, scaleLog } from "d3-scale";
import { area, line } from "d3-shape";
import tex from "virtual:tex";
import { h, s } from "../lib/dom";
import { lossRel, pow10, sig } from "../lib/format";
import { cssVar, themeShown } from "../lib/theme";
import { logAxes, piTick, place } from "../charts/common";

export interface CurveLite {
  band: { Pi: number[]; lo: (number | null)[]; hi: (number | null)[] };
  bound: { Pi: number[]; loss_rel: number[] };
  thresholds: { level: string; loss_rel: number }[];
}
export interface TheoryAtlas { Pi: number[]; v_over_vesc: number[]; eta: number[][] }

function ring(svg: SVGSVGElement, x: number, y: number, clipped: boolean, kind: "dot" | "circle"): void {
  svg.append(s("g", { class: `case-ring case-${kind}${clipped ? " clipped" : ""}` },
    kind === "dot" ? s("circle", { class: "case-mark", cx: x, cy: y, r: 6 })
      : s("g", {}, s("circle", { class: "case-halo", cx: x, cy: y, r: 8 }), s("circle", { class: "case-mark", cx: x, cy: y, r: 8 }))));
}

/** One small log–log plot box: returns the SVG, the overlay and the plot element, sized to the container. */
function frame(container: HTMLElement): { plot: HTMLElement; svg: SVGSVGElement; overlay: HTMLElement } {
  const svg = s("svg", { "aria-hidden": "true" });
  const overlay = h("div", { class: "overlay", "aria-hidden": "true" });
  const plot = h("div", { class: "plot" }, svg, overlay);
  container.append(plot);
  return { plot, svg, overlay };
}

export function curvePlacement(container: HTMLElement, d: CurveLite): (Pi: number, loss: number | null) => string {
  const { plot, svg, overlay } = frame(container);
  let last: [number, number | null] = [1, null];
  const DOM: [number, number] = [1e-3, 1e5], LDOM: [number, number] = [1e-9, 1.5];
  function draw(): string {
    const W = Math.round(plot.clientWidth);
    if (W < 200) return "";
    const H = Math.round(Math.min(300, Math.max(220, W * 0.62)));
    const m = { top: 30, right: 10, bottom: 44, left: 44 };
    const x = scaleLog().domain(DOM).range([m.left, W - m.right]).clamp(true);
    const y = scaleLog().domain(LDOM).range([H - m.bottom, m.top]).clamp(true);
    svg.replaceChildren(); overlay.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("height", String(H));
    logAxes(svg, x, y, W, H, m, { xTicks: [1e-3, 1e-1, 10, 1e3, 1e5], yTicks: [1e-8, 1e-5, 1e-2], xFmt: piTick, yFmt: pow10 });
    place(overlay, tex.lossRel, 0, 2, "start");
    place(overlay, tex.Pi, (m.left + W - m.right) / 2, H - 20, "middle");
    const bp = d.band.Pi.map((p, i) => [p, d.band.lo[i], d.band.hi[i]] as const).filter(([, a, b]) => a !== null && b !== null) as [number, number, number][];
    svg.append(s("path", { class: "band", d: area<[number, number, number]>().x((p) => x(p[0])).y0((p) => y(p[1])).y1((p) => y(p[2]))(bp) ?? "" }));
    svg.append(s("path", { class: "theory-line", d: line().x((p) => x(p[0])).y((p) => y(p[1]))(d.bound.Pi.map((p, i) => [p, d.bound.loss_rel[i]] as [number, number])) ?? "" }));
    for (const t of d.thresholds) svg.append(s("line", { class: "threshold", x1: m.left, x2: W - m.right, y1: y(t.loss_rel), y2: y(t.loss_rel) }));
    const [Pi, loss] = last;
    if (loss === null || !(loss > 0)) return "Not on the universal curve: the loss is undefined for this case (captured or impact).";
    const clipped = Pi < DOM[0] || Pi > DOM[1] || loss < LDOM[0] || loss > LDOM[1];
    ring(svg, x(Pi), y(loss), clipped, "dot");
    return `On the universal curve: Π = ${sig(Pi)}, loss ${lossRel(loss)} of Δv${clipped ? " (beyond the plot; shown on its edge)" : ""}. ` +
      `The band is for near-parabolic arrivals (Hibberd et al.'s dive).`;
  }
  themeShown.subscribe(() => requestAnimationFrame(draw));
  new ResizeObserver(() => requestAnimationFrame(draw)).observe(plot);
  return (Pi, loss) => { last = [Pi, loss]; return draw(); };
}

export function atlasPlacement(container: HTMLElement, a: TheoryAtlas): (Pi: number, v: number) => string {
  const { plot, svg, overlay } = frame(container);
  let last: [number, number] = [1, 0.1];
  const edges = (c: number[]) => {                         // cell edges on the log grid, midway between centres
    const l = c.map(Math.log10);
    return [l[0] - (l[1] - l[0]) / 2, ...l.slice(1).map((v, i) => (v + l[i]) / 2), l[l.length - 1] + (l[l.length - 1] - l[l.length - 2]) / 2].map((e) => 10 ** e);
  };
  const xe = edges(a.Pi), ye = edges(a.v_over_vesc);
  function draw(): string {
    const W = Math.round(plot.clientWidth);
    if (W < 200) return "";
    const H = Math.round(Math.min(300, Math.max(220, W * 0.62)));
    const m = { top: 30, right: 10, bottom: 44, left: 44 };
    const x = scaleLog().domain([xe[0], xe[xe.length - 1]]).range([m.left, W - m.right]).clamp(true);
    const y = scaleLog().domain([ye[0], ye[ye.length - 1]]).range([H - m.bottom, m.top]).clamp(true);
    svg.replaceChildren(); overlay.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("height", String(H));
    const steps = [0, 1, 2, 3, 4, 5, 6].map((k) => cssVar(`--ramp-${k}`));
    const ramp = scaleLinear<string>().domain(steps.map((_, k) => k / 6)).range(steps).clamp(true);
    const g = s("g", { class: "atlas-cells" });
    a.eta.forEach((row, j) => row.forEach((e, i) => g.append(s("rect", {
      x: x(xe[i]), y: y(ye[j + 1]), width: x(xe[i + 1]) - x(xe[i]) + 0.5, height: y(ye[j]) - y(ye[j + 1]) + 0.5, fill: ramp(e) }))));
    svg.append(g);
    logAxes(svg, x, y, W, H, m, { xTicks: [0.01, 1, 100], yTicks: [0.01, 0.1, 1, 10], xFmt: piTick, yFmt: (t) => sig(t, 1), grid: false });
    place(overlay, tex.vRatio, 0, 2, "start");
    place(overlay, tex.Pi, (m.left + W - m.right) / 2, H - 20, "middle");
    const [Pi, v] = last;
    const clipped = Pi < xe[0] || Pi > xe[xe.length - 1] || v < ye[0] || v > ye[ye.length - 1];
    ring(svg, x(Pi), y(Math.max(v, ye[0])), clipped, "circle");
    return `On the Δv → 0 theory atlas: Π = ${sig(Pi)}, v∞/v_esc = ${sig(v, 3)}${clipped ? " (beyond the atlas; shown on its edge)" : ""}.`;
  }
  themeShown.subscribe(() => requestAnimationFrame(draw));
  new ResizeObserver(() => requestAnimationFrame(draw)).observe(plot);
  return (Pi, v) => { last = [Pi, v]; return draw(); };
}
