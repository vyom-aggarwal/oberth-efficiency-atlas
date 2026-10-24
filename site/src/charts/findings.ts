// The landing page's three findings (Phase 7, docs/landing_plan.md as approved 2026-10-21): small live figures drawn
// from the exported data, in the article's conventions (simulation solid, theory dashed, thresholds as rules; colour
// only for η on the Slate ramp). Each has a hover or focus readout and a summary for assistive technology; the
// author's caption and the link sit in the HTML (index.html, filled by the content plugin).
//   1. Loss against Π with the 1 % line, and the hero's three engines on it   (curve.json, engines.json)
//   2. Where real missions sit: the η atlas with the mission samples          (atlas.json, missions.json)
//   3. The Hibberd et al. check: loss against thrust scale, the reference burn and the 1 % point (case.json)
import { scaleLinear, scaleLog } from "d3-scale";
import { area, line } from "d3-shape";
import tex from "virtual:tex";
import { citation, sourceLink } from "../lib/cite";
import type { SiteData, Sourced } from "../lib/data";
import { frag, h, onFontsLoaded, s } from "../lib/dom";
import { engineLabel } from "../lib/engine-label";
import { decade, lossRel, pow10, sig, speed } from "../lib/format";
import { cssVar, themeShown } from "../lib/theme";
import { cellStatus, textures, type AtlasData, type MissionsData } from "./atlas";
import type { CaseData } from "./case";
import { hitTarget, LabelPlacer, logAxes, piTick, place, svgPointer, tooltip, type Tooltip } from "./common";
import type { EnginesData } from "./dive-view";
import type { CurveData } from "./universal-curve";

const PI_TICKS = [1e-3, 1e-2, 1e-1, 1, 10, 100, 1000];
const LOSS_TICKS = [1e-8, 1e-6, 1e-4, 1e-2, 1];
const SHAPES = ["circle", "triangle", "square"] as const;    // the three engines, told apart by shape as well as label
const BODY_NAMES: Record<string, string> = { sun: "Sun", venus: "Venus", earth: "Earth", mars: "Mars", jupiter: "Jupiter", saturn: "Saturn" };

/** A small figure frame: SVG and an HTML overlay in a .plot, a tooltip, and a redraw on resize, theme and fonts. */
function frame(body: HTMLElement, label: string, summary: string, draw: (W: number, parts: Parts) => void, canvas = false): void {
  const id = body.closest("figure")!.id;
  const svg = s("svg", { role: "img", "aria-label": label, "aria-describedby": `${id}-summary` });
  const overlay = h("div", { class: "overlay", "aria-hidden": "true" });
  const cv = canvas ? h("canvas", { class: "finding-canvas", "aria-hidden": "true" }) : null;
  const plot = h("div", { class: "plot finding-plot" }, ...(cv ? [cv] : []), svg, overlay);
  const tip = tooltip(plot);
  const sum = h("p", { class: "visually-hidden", id: `${id}-summary` }, summary);
  body.append(plot, sum);
  let width = 0;
  const redraw = () => tip.redraw(() => width && draw(width, { svg, overlay, plot, tip, canvas: cv }));
  new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width);
    if (w !== width) { width = w; requestAnimationFrame(redraw); }
  }).observe(plot);
  onFontsLoaded(() => requestAnimationFrame(redraw));
  themeShown.subscribe(() => requestAnimationFrame(redraw));
}
interface Parts { svg: SVGSVGElement; overlay: HTMLElement; plot: HTMLElement; tip: Tooltip; canvas: HTMLCanvasElement | null }

function reset(p: Parts, W: number, H: number): void {
  p.svg.replaceChildren();
  p.overlay.replaceChildren();
  p.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  p.svg.setAttribute("height", String(H));
}

function marker(shape: (typeof SHAPES)[number], x: number, y: number, r = 5): SVGElement {
  if (shape === "circle") return s("circle", { class: "mark-sim", cx: x, cy: y, r });
  if (shape === "square") return s("rect", { class: "mark-sim", x: x - r, y: y - r, width: 2 * r, height: 2 * r });
  return s("path", { class: "mark-sim", d: `M${x},${y - r * 1.15}L${x + r * 1.1},${y + r * 0.8}L${x - r * 1.1},${y + r * 0.8}Z` });
}
const glyph = (shape: (typeof SHAPES)[number]) => s("svg", { width: 16, height: 14, viewBox: "-8 -7 16 14", "aria-hidden": "true" }, marker(shape, 0, 0, 4.5));
const keyLine = (cls: string) => s("svg", { width: 22, height: 10, "aria-hidden": "true" }, s("line", { class: cls, x1: 1, x2: 21, y1: 5, y2: 5 }));

// ---------------------------------------------------------------- 1. loss against Π

export function lossFinding(body: HTMLElement, d: CurveData, en: EnginesData, site: SiteData): void {
  const one = d.thresholds.find((t) => t.level === "1%")!;
  const engines = en.cases.map((c, i) => ({ c, i, label: engineLabel(c.title.value) }));
  const summary = `Loss as a fraction of Δv against Π, log–log: the band of thrust profiles (simulation) and the Π²/96 ` +
    `leading-order bound (theory). Loss reaches 1 % of Δv at Π = ${sig(one.Pi.value)}. The three engines of the dive: ` +
    engines.map((e) => `${e.label.name}, Π = ${sig(e.c.Pi.value)}, loss ${lossRel(e.c.loss_rel.value)} of Δv`).join("; ") + ".";
  frame(body, "Loss against Π, with the 1 % line", summary, (W, p) => {
    const narrow = W < 420;
    const H = Math.round(Math.min(300, Math.max(230, W * 0.62)));
    const m = { top: 28, right: 12, bottom: 44, left: 44 };
    const x = scaleLog().domain([1e-3, 3e3]).range([m.left, W - m.right]).clamp(true);
    const y = scaleLog().domain([1e-9, 1.5]).range([H - m.bottom, m.top]).clamp(true);
    reset(p, W, H);
    logAxes(p.svg, x, y, W, H, m, { xTicks: PI_TICKS, yTicks: LOSS_TICKS, xFmt: decade, yFmt: pow10, everyX: narrow ? 2 : 1 });
    place(p.overlay, tex.lossRel, 0, 2, "start");
    place(p.overlay, tex.PiDef, (m.left + W - m.right) / 2, H - 20, "middle");
    // The band and the bound.
    const band = d.band.Pi.map((q, i) => [q, d.band.lo[i], d.band.hi[i]] as const)
      .filter(([, lo, hi]) => lo !== null && hi !== null) as [number, number, number][];
    p.svg.append(s("path", { class: "band", d: area<[number, number, number]>().x((v) => x(v[0])).y0((v) => y(v[1])).y1((v) => y(v[2]))(band) ?? "" }));
    for (const k of [1, 2] as const) p.svg.append(s("path", { class: "band-edge", d: line<[number, number, number]>().x((v) => x(v[0])).y((v) => y(v[k]))(band) ?? "" }));
    const bound = d.bound.Pi.map((q, i) => [q, d.bound.loss_rel[i]] as [number, number]);
    p.svg.append(s("path", { class: "theory-line", d: line().x((v) => x(v[0])).y((v) => y(v[1]))(bound) ?? "" }));
    // The 1 % line and where the band reaches it.
    p.svg.append(s("line", { class: "threshold", x1: m.left, x2: W - m.right, y1: y(one.loss_rel), y2: y(one.loss_rel) }),
      s("text", { class: "annot-2", x: m.left + 4, y: y(one.loss_rel) - 5 }, "1 % loss"));
    const tg = s("g", {}, s("circle", { class: "mark-sim", cx: x(one.Pi.value), cy: y(one.loss_rel), r: 3.5 }));
    p.svg.append(tg);
    hitTarget(tg, x(one.Pi.value), y(one.loss_rel), "1 % loss", p.tip, () => h("div", {},
      h("div", { class: "tt-title" }, "Loss reaches 1 % of Δv"), h("dl", {}, h("dt", {}, "Π"), h("dd", {}, sig(one.Pi.value))),
      h("div", { class: "tt-source" }, "Data: ", sourceLink(site, one.Pi.src.split("#")[0]))));
    // The hero's three engines.
    const placer = new LabelPlacer(p.svg, p.overlay, p.plot, W, H - m.bottom);
    engines.forEach((e) => {
      const ex = x(e.c.Pi.value), ey = y(e.c.loss_rel.value);
      const g = s("g", {}, marker(SHAPES[e.i], ex, ey));
      p.svg.append(g);
      hitTarget(g, ex, ey, e.label.name, p.tip, () => h("div", {},
        h("div", { class: "tt-title" }, e.label.name + (e.label.caveat ? ` (${e.label.caveat})` : "")),
        h("dl", {}, h("dt", {}, "Π"), h("dd", {}, sig(e.c.Pi.value)), h("dt", {}, "loss/Δv"), h("dd", {}, lossRel(e.c.loss_rel.value))),
        h("div", { class: "tt-source" }, "Data: ", sourceLink(site, "figures/anim_numbers.json"))));
      placer.add(ex, ey, document.createTextNode(e.label.short), e.i === 2 ? { dx: -12, dy: -14, anchor: "end" } : { dx: 12, dy: -14, anchor: "start" });
    });
    placer.finish();
  });
  body.append(h("ul", { class: "legend finding-legend", "aria-label": "Legend" },
    h("li", {}, s("svg", { width: 22, height: 12, "aria-hidden": "true" }, s("rect", { class: "band", x: 1, y: 2, width: 20, height: 8 })), "Thrust profiles (simulation)"),
    h("li", {}, keyLine("theory-line"), frag(`${tex.bound}`), " (theory)"),
    ...engines.map((e) => h("li", {}, glyph(SHAPES[e.i]), `${e.label.name}${e.label.caveat ? "*" : ""}`))));
}

// ---------------------------------------------------------------- 2. where real missions sit

export function missionsFinding(body: HTMLElement, a: AtlasData, ms: MissionsData, site: SiteData): void {
  const dvs = [...new Set(a.slices.map((x) => x.dv_over_V))].sort((p, q) => p - q);
  const sl = a.slices.find((x) => x.steering === "prograde" && x.dv_over_V === dvs[1])!;   // the atlas figure's default slice
  const ve = sl.v_over_vesc_edges;
  const summary = `The η atlas for prograde steering at Δv/V = ${sig(sl.dv_over_V, 2)}: η over Π and v∞/v_esc from the sweep, ` +
    `with ${ms.Pi.length} mission samples for ${ms.engines.length} engine classes at ${ms.bodies.length} bodies ` +
    `(filled: burn starts inside the body's sphere of influence; open: outside).`;
  frame(body, "Where real missions sit: η over Π and v∞/v_esc, with mission samples", summary, (W, p) => {
    const narrow = W < 420;
    const H = Math.round(Math.min(300, Math.max(230, W * 0.66)));
    const m = { top: 28, right: 12, bottom: 44, left: 44 };
    const x = scaleLog().domain([1e-3, 1e7]).range([m.left, W - m.right]).clamp(true);
    const y = scaleLog().domain([ve[0], ve[ve.length - 1]]).range([H - m.bottom, m.top]);
    reset(p, W, H);
    const cv = p.canvas!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.rect(m.left, m.top, W - m.left - m.right, H - m.top - m.bottom); ctx.clip();
    const steps = [0, 1, 2, 3, 4, 5, 6].map((k) => cssVar(`--ramp-${k}`));
    const ramp = scaleLinear<string>().domain(steps.map((_, k) => k / 6)).range(steps).clamp(true);
    const ink = cssVar("--ink"), paper = cssVar("--bg");
    const pattern = textures(ctx, ink, paper);
    const X = sl.Pi_edges;
    sl.eta.forEach((row, i) => row.forEach((e, k) => {
      const st = cellStatus(sl, i, k);
      ctx.beginPath();
      ctx.moveTo(x(X[i][k]), y(ve[i])); ctx.lineTo(x(X[i][k + 1]), y(ve[i]));
      ctx.lineTo(x(X[i + 1][k + 1]), y(ve[i + 1])); ctx.lineTo(x(X[i + 1][k]), y(ve[i + 1])); ctx.closePath();
      const fill = st === "eta" ? ramp(e as number) : pattern[st];
      ctx.fillStyle = fill; ctx.fill();
      if (st === "eta") { ctx.strokeStyle = fill as string; ctx.lineWidth = 1; ctx.stroke(); }
    }));
    // Thousands of samples on a small plot: small marks, partly transparent, so the cells read beneath the cloud.
    ctx.lineWidth = 0.7; ctx.globalAlpha = 0.55;
    for (let j = 0; j < ms.Pi.length; j++) {
      ctx.beginPath(); ctx.arc(x(ms.Pi[j]), y(ms.v_over_vesc[j]), ms.inside_soi[j] ? 0.9 : 1.3, 0, 2 * Math.PI);
      if (ms.inside_soi[j]) { ctx.fillStyle = ink; ctx.fill(); } else { ctx.strokeStyle = ink; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    logAxes(p.svg, x, y, W, H, m, { xTicks: [1e-3, 1e-1, 10, 1e3, 1e5, 1e7], yTicks: [0.01, 0.1, 1], xFmt: piTick, yFmt: (t) => sig(t, 1),
      everyX: narrow ? 2 : 1, grid: false });
    p.svg.append(s("rect", { class: "plot-frame", x: m.left, y: m.top, width: W - m.left - m.right, height: H - m.top - m.bottom }));
    place(p.overlay, tex.vRatio, 0, 2, "start");
    place(p.overlay, tex.PiDef, (m.left + W - m.right) / 2, H - 20, "middle");
    // Readout: the nearest mission sample within 10 px.
    const hit = s("rect", { class: "hit", x: m.left, y: m.top, width: W - m.left - m.right, height: H - m.top - m.bottom, "aria-hidden": "true" });
    p.svg.insertBefore(hit, p.svg.firstChild);
    hit.addEventListener("pointermove", (ev) => {
      const [mx, my] = svgPointer(p.svg, ev);
      let best = -1, bd = 100;
      for (let j = 0; j < ms.Pi.length; j++) {
        const dd = (x(ms.Pi[j]) - mx) ** 2 + (y(ms.v_over_vesc[j]) - my) ** 2;
        if (dd < bd) { bd = dd; best = j; }
      }
      if (best < 0) { p.tip.hide(); return; }
      p.tip.show(x(ms.Pi[best]) + 10, y(ms.v_over_vesc[best]) - 10, h("div", {},
        h("div", { class: "tt-title" }, `${ms.engine_labels[ms.engines[ms.engine[best]]]} at ${BODY_NAMES[ms.bodies[ms.body[best]]] ?? ms.bodies[ms.body[best]]}`),
        h("dl", {}, h("dt", {}, "Π"), h("dd", {}, sig(ms.Pi[best])), h("dt", {}, "v∞/v_esc"), h("dd", {}, sig(ms.v_over_vesc[best], 2)),
          h("dt", {}, "η"), h("dd", {}, sig(ms.eta[best], 4)), h("dt", {}, "burn starts"), h("dd", {}, ms.inside_soi[best] ? "inside the SOI" : "outside the SOI")),
        h("div", { class: "tt-source" }, "Data: ", sourceLink(site, "results/missions.parquet"))));
    });
    hit.addEventListener("pointerleave", () => p.tip.hide());
    p.plot.dataset.missionPoints = String(ms.Pi.length);
  }, true);
  const dot = (filled: boolean) => s("svg", { width: 14, height: 14, viewBox: "-7 -7 14 14", "aria-hidden": "true" },
    s("circle", { r: 2.4, class: filled ? "mission-dot" : "mission-ring" }));
  const etaLabel = h("span", {});
  etaLabel.append(frag(tex.eta), " (simulation): 0");
  body.append(h("ul", { class: "legend finding-legend", "aria-label": "Legend" },
    h("li", {}, etaLabel, h("span", { class: "ramp-bar eta-bar", "aria-hidden": "true" }), "1"),
    h("li", {}, dot(true), dot(false), "Mission samples: burn starts inside or outside the SOI")));
}

// ---------------------------------------------------------------- 3. the Hibberd et al. check

export function hibberdFinding(body: HTMLElement, d: CaseData, site: SiteData): void {
  const c = d.margin_curve;
  const dv = d.stack.dv_rocket_m_s.value;
  const one = d.thresholds.find((t) => t.level === "1%")!;
  const L1 = 0.01 * dv;
  const summary = `Loss of Hibberd et al.'s solar Oberth burn against its thrust, scaled down from the reference stack (scale 1), ` +
    `burn centred on perihelion (simulation). At scale 1 the loss is ${speed(d.loss_m_s.time_centred.value)}; it reaches 1 % of Δv ` +
    `at 1/${sig(one.thrust_scale_divisor.value, 3)} of the thrust.`;
  frame(body, "The Hibberd et al. check: loss against thrust scale", summary, (W, p) => {
    const H = Math.round(Math.min(300, Math.max(230, W * 0.62)));
    const m = { top: 28, right: 12, bottom: 44, left: 48 };
    const x = scaleLog().domain([1e-4, 1.6]).range([m.left, W - m.right]).clamp(true);
    const y = scaleLog().domain([0.01, 1.5e4]).range([H - m.bottom, m.top]).clamp(true);
    reset(p, W, H);
    logAxes(p.svg, x, y, W, H, m, { xTicks: [1e-4, 1e-3, 1e-2, 1e-1, 1], yTicks: [0.01, 1, 100, 1e4],
      xFmt: (f) => (f >= 0.01 ? sig(f, 2).replace(/\.?0+$/, "") : pow10(f)), yFmt: (t) => (t >= 1 ? String(t) : sig(t, 1)) });
    place(p.overlay, "loss, m/s", 0, 2, "start");
    place(p.overlay, "thrust scale (× the stack's thrust)", (m.left + W - m.right) / 2, H - 20, "middle");
    p.svg.append(s("line", { class: "threshold", x1: m.left, x2: W - m.right, y1: y(L1), y2: y(L1) }),
      s("text", { class: "annot-2", x: W - m.right - 4, y: y(L1) - 5, "text-anchor": "end" }, "1 % of Δv"));
    p.svg.append(s("path", { class: "data-line", d: line().x((v) => x(v[0])).y((v) => y(v[1]))(c.thrust_scale.map((f, i) => [f, c.loss_m_s[i]] as [number, number])) ?? "" }));
    const placer = new LabelPlacer(p.svg, p.overlay, p.plot, W, H - m.bottom);
    // The reference burn (scale 1) and the 1 % point.
    const rx = x(1), ry = y(d.loss_m_s.time_centred.value);
    const rg = s("g", {}, s("rect", { class: "mark-sim", x: rx - 5, y: ry - 5, width: 10, height: 10 }));
    p.svg.append(rg);
    hitTarget(rg, rx, ry, "reference burn", p.tip, () => h("div", {},
      h("div", { class: "tt-title" }, h("span", {}, "Reference stack of ", citation("Hibberd et al.", d.ref))),
      h("dl", {}, h("dt", {}, "loss"), h("dd", {}, speed(d.loss_m_s.time_centred.value)), h("dt", {}, "Π"), h("dd", {}, sig(d.stack.Pi.value))),
      h("div", { class: "tt-source" }, "Data: ", sourceLink(site, "figures/phase4_numbers.json"))));
    placer.add(rx, ry, document.createTextNode(`reference burn: ${speed(d.loss_m_s.time_centred.value)}`), { dx: -12, dy: 18, anchor: "end" });
    const fx = x(1 / one.thrust_scale_divisor.value), fy = y(L1);
    const og = s("g", {}, s("circle", { class: "mark-sim", cx: fx, cy: fy, r: 4.5 }));
    p.svg.append(og);
    hitTarget(og, fx, fy, "1 % loss", p.tip, () => h("div", {},
      h("div", { class: "tt-title" }, "Loss reaches 1 % of Δv"),
      h("dl", {}, h("dt", {}, "thrust"), h("dd", {}, `1/${sig(one.thrust_scale_divisor.value, 3)} of the stack's`), h("dt", {}, "Π"), h("dd", {}, sig(one.Pi.value))),
      h("div", { class: "tt-source" }, "Data: ", sourceLink(site, "figures/phase4_numbers.json"))));
    placer.add(fx, fy, document.createTextNode(`1 % at 1/${sig(one.thrust_scale_divisor.value, 2)} of the thrust`), { dx: 12, dy: -16, anchor: "start" });
    placer.finish();
    // Crosshair readout along the sweep.
    const hit = s("rect", { class: "hit", x: m.left, y: m.top, width: W - m.left - m.right, height: H - m.top - m.bottom, "aria-hidden": "true" });
    const cross = s("line", { class: "leader", y1: m.top, y2: H - m.bottom, visibility: "hidden" });
    p.svg.insertBefore(hit, p.svg.firstChild);
    p.svg.append(cross);
    hit.addEventListener("pointermove", (ev) => {
      const F = x.invert(svgPointer(p.svg, ev)[0]);
      const i = c.thrust_scale.reduce((b, f, k) => (Math.abs(Math.log(f / F)) < Math.abs(Math.log(c.thrust_scale[b] / F)) ? k : b), 0);
      const px = x(c.thrust_scale[i]);
      cross.setAttribute("x1", String(px)); cross.setAttribute("x2", String(px)); cross.setAttribute("visibility", "visible");
      p.tip.show(px + 12, y(c.loss_m_s[i]) - 10, h("div", {},
        h("div", { class: "tt-title" }, `thrust × ${sig(c.thrust_scale[i], 2)}`),
        h("dl", {}, h("dt", {}, "loss"), h("dd", {}, speed(c.loss_m_s[i])), h("dt", {}, "loss/Δv"), h("dd", {}, lossRel(c.loss_rel[i]))),
        h("div", { class: "tt-source" }, "Data: ", sourceLink(site, c.data))));
    });
    hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); p.tip.hide(); });
  });
  body.append(h("ul", { class: "legend finding-legend", "aria-label": "Legend" },
    h("li", {}, keyLine("data-line"), "Loss, burn centred on perihelion (simulation)"),
    h("li", {}, glyph("square"), h("span", {}, "Reference stack of ", citation("Hibberd et al.", d.ref))),
    h("li", {}, glyph("circle"), "Where the loss reaches 1 % of Δv")));
}

export type { Sourced };
