// Engines compared: Hibberd et al.'s dive flown by three engines (scripts/anim_engines.py's own trajectories). Three
// top-down panels with the animation's radial mapping ρ = 1 + log₁₀(r/r_p), the burn coloured by a·v; one
// play/scrub control on the animation's asinh-stretched clock, t = τ sinh s; an energy-gain strip on a symlog time
// axis (linear within ±τ), with the impulsive step. Still at load (the final frame); moves only when played or
// scrubbed. Every value comes from engines.json and engines.bin (scripts/export_site_data.py); the data, mapping,
// colours and strip are shared with the landing page's hero (charts/dive-view.ts).
import tex from "virtual:tex";
import { sourceLink } from "../lib/cite";
import type { SiteData } from "../lib/data";
import { frag, h, onFontsLoaded, s } from "../lib/dom";
import { duration, lossRel, sig } from "../lib/format";
import { cssVar, themeShown } from "../lib/theme";
import { dataTable, segmented } from "./common";
import { AV_RANGE, burnColour, clockText, DASH, dashGlyph, dive, drawEnergyStrip, drawRingsAndSun, type DiveCase, type EnginesData } from "./dive-view";

export type { EnginesData } from "./dive-view";

const RHO_MAX = 1 + Math.log10(60);                        // the animation's panel extent
const PLAY_MS = 12000;                                      // one pass of the stretched clock

export function engines(root: HTMLElement, d: EnginesData, buf: ArrayBuffer, site: SiteData, opt: { figN: number; title: string }): void {
  const uid = `en${opt.figN}`;
  const dv = dive(d, buf);
  const { cases, tau, sMax } = dv;

  // ---------------------------------------------------------------- frame
  const head = h("div", { class: "figure-head" },
    h("h3", { class: "figure-title", id: `${uid}-title` }, h("span", { class: "fig-n" }, `Figure ${opt.figN}`), opt.title),
    h("div", { class: "prov-key", "aria-label": "Key" }, h("span", {}, "Simulation (the animation's trajectories)")));
  const play = h("button", { class: "button play", type: "button", "aria-pressed": "false" }, "Play");
  const scrub = h("input", { type: "range", id: `${uid}-t`, min: -sMax, max: sMax, step: (2 * sMax) / 1000, value: sMax,
    "aria-label": "time from perihelion" });
  const clock = h("output", { class: "clock", for: `${uid}-t` });
  // Below 560 px (author, 2026-10-19): one panel at a time, chosen here; the clock, the scrub control and the
  // three-engine strip are shared, so switching keeps the time and the comparison. The switch uses the hero's short
  // names (author, 2026-10-20), with the full names for assistive technology.
  let one = 0, single = false;
  const pick = segmented(`${uid}-engine`, "Engine", cases.map((k, i) => [String(i), k.label.short, k.label.name] as [string, string, string]), "0", (v) => {
    one = Number(v);
    layout();
    requestAnimationFrame(frame);
  });
  const engineSwitch = h("div", { class: "engine-switch", hidden: true }, h("span", { class: "control-label" }, "Engine"), pick);
  const controls = h("div", { class: "controls engine-controls" }, engineSwitch, play, h("div", { class: "scrub" }, scrub), clock);
  const panels = cases.map((k) => {
    const canvas = h("canvas", { class: "engine-canvas", "aria-hidden": "true" });
    const { name, details, note } = k.label;
    // The note; with the switch shown, a caveat reads "* hypothetical at 3.2 R☉", explaining the switch's "SEP*".
    const noteEl = note ? h("span", { class: "engine-note" }, note) : null;
    const cap = h("figcaption", { class: "engine-cap" },
      h("span", {}, h("span", { class: "engine-name" }, name), details ? ` ${details}` : ""), noteEl,
      h("span", { class: "engine-facts" }, `burn ${duration(k.c.burn_s.value)}, Π = ${sig(k.c.Pi.value)}, loss ${lossRel(k.c.loss_rel.value)} of Δv`));
    return { canvas, noteEl, el: h("figure", { class: "engine-panel" }, canvas, cap) };
  });
  const grid = h("div", { class: "engine-grid", role: "img", "aria-labelledby": `${uid}-title`, "aria-describedby": `${uid}-summary` },
    ...panels.map((p) => p.el));
  const strip = s("svg", { class: "energy-strip", "aria-hidden": "true" });
  const stripWrap = h("div", { class: "plot strip-plot" }, strip);
  const avLabel = h("span", {});
  avLabel.append(frag(tex.av), ` at the engine, W/kg: ${sig(AV_RANGE[0], 1)}`);
  const legend = h("ul", { class: "legend", "aria-label": "Legend" },
    h("li", {}, avLabel, h("span", { class: "ramp-bar", "aria-hidden": "true" }), "10⁸ (log scale)"),
    h("li", {}, ...DASH.map((dash, i) => h("span", { class: "dash-key" }, dashGlyph(dash), cases[i].label.name))),
    h("li", {}, dashGlyph([], "imp"), "impulsive burn at perihelion"));
  const summary = h("p", { class: "summary", id: `${uid}-summary` });
  summary.textContent = `Hibberd et al.'s solar dive flown with three engines of the same Δv. ` + cases.map((k) =>
    `${k.label.name}: burn ${duration(k.c.burn_s.value)}, Π = ${sig(k.c.Pi.value)}, ` +
    `${lossRel(k.c.loss_rel.value)} of Δv lost, energy gain ${sig(k.frac[k.frac.length - 1], 3)} of the impulsive gain`).join("; ") + ".";
  root.append(head, controls, grid, stripWrap, legend, summary, table());

  // ---------------------------------------------------------------- time
  let s_ = sMax;                                             // the final frame at load: complete and still
  let playing = false, startAt = 0, startS = -sMax;
  const tNow = () => tau * Math.sinh(s_);
  scrub.addEventListener("input", () => { stop(); s_ = Number(scrub.value); frame(); });
  play.addEventListener("click", () => (playing ? stop() : start()));
  function start(): void {
    if (s_ >= sMax - 1e-9) s_ = -sMax;                       // from the beginning after the end
    playing = true; startAt = performance.now(); startS = s_;
    play.textContent = "Pause"; play.setAttribute("aria-pressed", "true");
    requestAnimationFrame(tick);
  }
  function stop(): void {
    playing = false; play.textContent = "Play"; play.setAttribute("aria-pressed", "false");
  }
  function tick(now: number): void {
    if (!playing) return;
    s_ = Math.min(sMax, startS + ((now - startAt) / PLAY_MS) * 2 * sMax);
    scrub.value = String(s_);
    frame();
    if (s_ >= sMax) stop(); else requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- drawing
  let side = 0, W = 0;
  function layout(): void {
    single = grid.clientWidth < 560;
    engineSwitch.hidden = !single;
    panels.forEach((p, i) => {
      p.el.hidden = single && i !== one;
      const { note, starNote } = cases[i].label;
      if (p.noteEl) p.noteEl.textContent = single && starNote ? starNote : note;
    });
    side = Math.round(panels.find((p) => !p.el.hidden)!.el.clientWidth);
  }
  new ResizeObserver(() => {
    layout();
    W = Math.round(stripWrap.clientWidth);
    requestAnimationFrame(frame);
  }).observe(grid);
  themeShown.subscribe(() => requestAnimationFrame(frame));
  onFontsLoaded(() => requestAnimationFrame(frame));

  function frame(): void {
    if (!side) return;
    const k = dv.indexAt(tNow());
    clock.textContent = clockText(dv, s_);
    scrub.setAttribute("aria-valuetext", clock.textContent);
    panels.forEach((p, i) => { if (!p.el.hidden) drawPanel(p.canvas, cases[i], k); });
    drawEnergyStrip(strip, dv, k, W, 150, `${uid}-clip`);
  }

  function drawPanel(canvas: HTMLCanvasElement, e: DiveCase, k: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(side * dpr); canvas.height = Math.round(side * dpr);
    canvas.style.width = `${side}px`; canvas.style.height = `${side}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sc = side / (2 * RHO_MAX), cx = side / 2, cy = side / 2;
    // Periapsis points down, as in the hero: screen x = y_sim, screen y = x_sim.
    const P = (i: number): [number, number] => [cx + e.Y[i] * sc, cy + e.X[i] * sc];
    ctx.fillStyle = cssVar("--bg"); ctx.fillRect(0, 0, side, side);
    drawRingsAndSun(ctx, cx, cy, sc, dv.rhoSun);
    const rule = cssVar("--grid"), ink = cssVar("--ink");
    // The full path, faint; the path so far, Ink; the burn so far, coloured by a·v.
    const path = (from: number, to: number) => { ctx.beginPath(); for (let i = from; i < to; i++) { const [px, py] = P(i); if (i === from) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke(); };
    ctx.strokeStyle = rule; ctx.lineWidth = 1; path(0, e.X.length);
    ctx.strokeStyle = ink; ctx.lineWidth = 1.4; path(0, k);
    ctx.lineWidth = 4; ctx.lineCap = "round";
    for (let i = 1; i < k; i++) {
      if (!(e.av[i - 1] > 0)) continue;
      const colour = burnColour(e.av[i], dv.avScale);
      if (!colour) continue;
      ctx.strokeStyle = colour;
      const [ax, ay] = P(i - 1), [bx, by] = P(i);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    if (k > 0) {
      const [px, py] = P(Math.min(k, e.X.length) - 1);
      ctx.fillStyle = ink; ctx.strokeStyle = cssVar("--bg"); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 4.5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    }
  }

  function table(): HTMLDetailsElement {
    return dataTable("The three engines on Hibberd et al.'s dive (the animation's runs; loss is the equivalent-Δv loss)",
      ["Engine", "Π", "burn", "loss/Δv", "energy gain / impulsive"],
      cases.map((e) => [e.c.title.value.replace("\n", " "), sig(e.c.Pi.value), duration(e.c.burn_s.value), lossRel(e.c.loss_rel.value),
        sig(e.frac[e.frac.length - 1], 4)]), [1, 2, 3, 4],
      h("span", {}, "Data: ", sourceLink(site, "figures/anim_numbers.json"), ", ", sourceLink(site, "scripts/anim_engines.py")));
  }
}
