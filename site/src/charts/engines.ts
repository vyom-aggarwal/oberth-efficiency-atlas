// Engines compared: Hibberd et al.'s dive flown by three engines (scripts/anim_engines.py's own trajectories). Three
// top-down panels with the animation's radial mapping ρ = 1 + log₁₀(r/r_p), the burn coloured by a·v; one
// play/scrub control on the animation's asinh-stretched clock, t = τ sinh s; an energy-gain strip on a symlog time
// axis (linear within ±τ), with the impulsive step. Still at load (the final frame); moves only when played or
// scrubbed. Every value comes from engines.json and engines.bin (scripts/export_site_data.py).
import tex from "virtual:tex";
import { sourceLink } from "../lib/cite";
import type { Provenance, SiteData, Sourced } from "../lib/data";
import { frag, h, onFontsLoaded, s } from "../lib/dom";
import { duration, lossRel, sig } from "../lib/format";
import { cssVar, themeShown } from "../lib/theme";
import { dataTable } from "./common";

interface ArrayRef { name: string; offset: number; length: number }
interface EngineCase {
  id: string; title: Sourced<string>; Pi: Sourced; loss_rel: Sourced; burn_s: Sourced;
  arrays: ArrayRef[]; sim_Pi: number; sim_loss_rel: number;
}
export interface EnginesData {
  provenance: Provenance; binary: string; dtype: string; stride: number;
  units: { time_s: number; length_m: number; av_W_per_kg: number; tau: number; window_tau: number; r_p_over_R_sun: Sourced };
  time: ArrayRef; cases: EngineCase[];
}

const AV_RANGE: [number, number] = [1e2, 1e8];             // W/kg, as the animation's colour scale
const RHO_MAX = 1 + Math.log10(60);                        // the animation's panel extent
const RINGS = [1, 3, 10, 30];                              // r/r_p circles, as the animation
const DASH = [[], [6, 2], [1.5, 1.5]];                     // the animation's line styles, one per engine
const PLAY_MS = 12000;                                      // one pass of the stretched clock

export function engines(root: HTMLElement, d: EnginesData, buf: ArrayBuffer, site: SiteData, opt: { figN: number; title: string }): void {
  const uid = `en${opt.figN}`;
  const arr = (r: ArrayRef) => new Float32Array(buf, r.offset, r.length);
  const t = arr(d.time);
  const cases = d.cases.map((c) => {
    const get = (k: string) => arr(c.arrays.find((a) => a.name === `${c.id}.${k}`)!);
    const x = get("x"), y = get("y"), av = get("av"), frac = get("energy_fraction");
    // The animation's radial mapping, computed once.
    const X = new Float32Array(x.length), Y = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) {
      const r = Math.hypot(x[i], y[i]), rho = 1 + Math.log10(r);
      X[i] = (rho * x[i]) / r; Y[i] = (rho * y[i]) / r;
    }
    const [name, note = ""] = c.title.value.split("\n");
    return { c, X, Y, av, frac, name, note };
  });
  const { tau, window_tau, time_s, av_W_per_kg } = d.units;
  const sMax = Math.asinh(window_tau);
  const rhoSun = 1 + Math.log10(1 / d.units.r_p_over_R_sun.value);

  // ---------------------------------------------------------------- frame
  const head = h("div", { class: "figure-head" },
    h("h3", { class: "figure-title", id: `${uid}-title` }, h("span", { class: "fig-n" }, `Figure ${opt.figN}`), opt.title),
    h("div", { class: "prov-key", "aria-label": "Key" }, h("span", {}, "Simulation (the animation's trajectories)")));
  const play = h("button", { class: "button play", type: "button", "aria-pressed": "false" }, "Play");
  const scrub = h("input", { type: "range", id: `${uid}-t`, min: -sMax, max: sMax, step: (2 * sMax) / 1000, value: sMax,
    "aria-label": "time from perihelion" });
  const clock = h("output", { class: "clock", for: `${uid}-t` });
  const controls = h("div", { class: "controls engine-controls" }, play, h("div", { class: "scrub" }, scrub), clock);
  const panels = cases.map((k) => {
    const canvas = h("canvas", { class: "engine-canvas", "aria-hidden": "true" });
    const [short, rest = ""] = k.name.split(": ");
    const cap = h("figcaption", { class: "engine-cap" },
      h("span", {}, h("span", { class: "engine-name" }, short), rest ? ` ${rest}` : ""), k.note ? h("span", { class: "engine-note" }, k.note) : null,
      h("span", { class: "engine-facts" }, `burn ${duration(k.c.burn_s.value)}, Π = ${sig(k.c.Pi.value)}, loss ${lossRel(k.c.loss_rel.value)} of Δv`));
    return { canvas, el: h("figure", { class: "engine-panel" }, canvas, cap) };
  });
  const grid = h("div", { class: "engine-grid", role: "img", "aria-labelledby": `${uid}-title`, "aria-describedby": `${uid}-summary` },
    ...panels.map((p) => p.el));
  const strip = s("svg", { class: "energy-strip", "aria-hidden": "true" });
  const stripWrap = h("div", { class: "plot strip-plot" }, strip);
  const avLabel = h("span", {});
  avLabel.append(frag(tex.av), ` at the engine, W/kg: ${sig(AV_RANGE[0], 1)}`);
  const legend = h("ul", { class: "legend", "aria-label": "Legend" },
    h("li", {}, avLabel, h("span", { class: "ramp-bar", "aria-hidden": "true" }), "10⁸ (log scale)"),
    h("li", {}, ...DASH.map((dash, i) => h("span", { class: "dash-key" }, dashGlyph(dash), cases[i].name.split(":")[0]))),
    h("li", {}, dashGlyph([], "imp"), "impulsive burn at perihelion"));
  const summary = h("p", { class: "summary", id: `${uid}-summary` });
  summary.textContent = `Hibberd et al.'s solar dive flown with three engines of the same Δv. ` + cases.map((k) =>
    `${k.name.split(":")[0]}: burn ${duration(k.c.burn_s.value)}, Π = ${sig(k.c.Pi.value)}, ` +
    `${lossRel(k.c.loss_rel.value)} of Δv lost, energy gain ${sig(k.frac[k.frac.length - 1], 3)} of the impulsive gain`).join("; ") + ".";
  root.append(head, controls, grid, stripWrap, legend, summary, table());

  // ---------------------------------------------------------------- time
  let s_ = sMax;                                             // the final frame at load: complete and still
  let playing = false, startAt = 0, startS = -sMax;
  const tNow = () => tau * Math.sinh(s_);
  const indexAt = (tv: number) => { let lo = 0, hi = t.length; while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] < tv) lo = m + 1; else hi = m; } return lo; };
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
  new ResizeObserver(() => {
    side = Math.round(panels[0].canvas.parentElement!.clientWidth);
    W = Math.round(stripWrap.clientWidth);
    requestAnimationFrame(frame);
  }).observe(grid);
  themeShown.subscribe(() => requestAnimationFrame(frame));
  onFontsLoaded(() => requestAnimationFrame(frame));

  function frame(): void {
    if (!side) return;
    const k = indexAt(tNow());
    const hours = (tNow() * time_s) / 3600;
    clock.textContent = `t = ${hours >= 0 ? "+" : "−"}${sig(Math.abs(hours), 3)} h from perihelion`;
    scrub.setAttribute("aria-valuetext", clock.textContent);
    panels.forEach((p, i) => drawPanel(p.canvas, cases[i], k));
    drawStrip(k);
  }

  function drawPanel(canvas: HTMLCanvasElement, e: (typeof cases)[number], k: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(side * dpr); canvas.height = Math.round(side * dpr);
    canvas.style.width = `${side}px`; canvas.style.height = `${side}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sc = side / (2 * RHO_MAX), cx = side / 2, cy = side / 2;
    // Periapsis points down, as in the hero: screen x = y_sim, screen y = x_sim.
    const P = (i: number): [number, number] => [cx + e.Y[i] * sc, cy + e.X[i] * sc];
    ctx.fillStyle = cssVar("--paper"); ctx.fillRect(0, 0, side, side);
    const rule = cssVar("--rule"), graphite = cssVar("--graphite"), ink = cssVar("--ink");
    ctx.strokeStyle = rule; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    ctx.font = `11px ${cssVar("--sans-cond") || "sans-serif"}`; ctx.fillStyle = graphite;
    for (const r of RINGS) {
      const rho = (1 + Math.log10(r)) * sc;
      ctx.beginPath(); ctx.arc(cx, cy, rho, 0, 2 * Math.PI); ctx.stroke();
      ctx.fillText(r === 1 ? "rₚ" : `${r} rₚ`, cx + rho * 0.72 + 2, cy + rho * 0.72);
    }
    ctx.setLineDash([]);
    ctx.fillStyle = rule; ctx.strokeStyle = graphite;
    ctx.beginPath(); ctx.arc(cx, cy, rhoSun * sc, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    // The full path, faint; the path so far, Ink; the burn so far, coloured by a·v.
    const path = (from: number, to: number) => { ctx.beginPath(); for (let i = from; i < to; i++) { const [px, py] = P(i); if (i === from) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke(); };
    ctx.strokeStyle = rule; ctx.lineWidth = 1; path(0, e.X.length);
    ctx.strokeStyle = ink; ctx.lineWidth = 1.4; path(0, k);
    ctx.lineWidth = 4; ctx.lineCap = "round";
    const lo = Math.log10(AV_RANGE[0]), hi = Math.log10(AV_RANGE[1]);
    for (let i = 1; i < k; i++) {
      if (!(e.av[i] > 0 && e.av[i - 1] > 0)) continue;
      const u = Math.min(1, Math.max(0, (Math.log10(e.av[i] * av_W_per_kg) - lo) / (hi - lo)));
      ctx.strokeStyle = cssVar(`--burn-${1 + Math.round(u * 6)}`);
      const [ax, ay] = P(i - 1), [bx, by] = P(i);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    if (k > 0) {
      const [px, py] = P(Math.min(k, e.X.length) - 1);
      ctx.fillStyle = ink; ctx.strokeStyle = cssVar("--paper"); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 4.5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    }
  }

  // The energy strip: symlog time (linear within ±τ, as the animation), energy gain / impulsive gain.
  function drawStrip(k: number): void {
    if (W < 200) return;
    const H = 150, m = { top: 10, right: 12, bottom: 34, left: 44 };
    const sl = (u: number) => Math.sign(u) * (Math.abs(u) <= 1 ? Math.abs(u) : 1 + Math.log10(Math.abs(u)));
    const L = sl(window_tau);
    const x = (tv: number) => m.left + ((sl(tv / tau) + L) / (2 * L)) * (W - m.left - m.right);
    const y = (f: number) => H - m.bottom - (f / 1.08) * (H - m.top - m.bottom);
    strip.replaceChildren();
    strip.setAttribute("viewBox", `0 0 ${W} ${H}`);
    strip.setAttribute("height", String(H));
    const ax = s("g", { class: "axis" }, s("line", { x1: m.left, x2: W - m.right, y1: y(0), y2: y(0) }), s("line", { x1: m.left, x2: m.left, y1: m.top, y2: y(0) }));
    const ticks = [-100, -10, -1, 0, 1, 10, 100];
    for (const u of ticks) {
      const tx = x(u * tau);
      ax.append(s("line", { x1: tx, x2: tx, y1: y(0), y2: y(0) + 4 }));
      if (W >= 480 || Math.abs(u) !== 10) ax.append(s("text", { x: tx, y: y(0) + 16, "text-anchor": "middle" }, u === 0 ? "0" : `${u > 0 ? "" : "−"}${Math.abs(u) === 1 ? "" : Math.abs(u)}τ`));
    }
    for (const f of [0, 0.5, 1]) ax.append(s("line", { x1: m.left - 4, x2: m.left, y1: y(f), y2: y(f) }),
      s("text", { x: m.left - 7, y: y(f) + 4, "text-anchor": "end" }, String(f)));
    ax.append(s("text", { x: (m.left + W - m.right) / 2, y: H - 3, "text-anchor": "middle" }, `time from perihelion (τ = r_p/v_p = ${duration(tau * time_s)})`));
    strip.append(ax);
    // The impulsive step at perihelion.
    strip.append(s("path", { class: "imp-step", d: `M${x(-window_tau * tau)},${y(0)}H${x(0)}V${y(1)}H${x(window_tau * tau)}` }));
    const lineD = (e: (typeof cases)[number]) => {
      let dd = "";
      for (let i = 0; i < t.length; i += 2) dd += `${i ? "L" : "M"}${x(t[i]).toFixed(1)},${y(e.frac[i]).toFixed(1)}`;
      return dd;
    };
    const clipId = `${uid}-clip`;
    const now = k > 0 ? x(t[Math.min(k, t.length) - 1]) : m.left;
    strip.append(s("defs", {}, s("clipPath", { id: clipId }, s("rect", { x: 0, y: 0, width: Math.max(0, now), height: H }))));
    cases.forEach((e, i) => {
      const dash = DASH[i].join(" ") || null;
      strip.append(s("path", { class: "strip-line faint", d: lineD(e), "stroke-dasharray": dash }),
        s("path", { class: "strip-line", d: lineD(e), "stroke-dasharray": dash, "clip-path": `url(#${clipId})` }));
    });
    strip.append(s("line", { class: "strip-cursor", x1: now, x2: now, y1: m.top, y2: y(0) }));
    strip.dataset.cursor = now.toFixed(1);
  }

  function table(): HTMLDetailsElement {
    return dataTable("The three engines on Hibberd et al.'s dive (the animation's runs; loss is the equivalent-Δv loss)",
      ["Engine", "Π", "burn", "loss/Δv", "energy gain / impulsive"],
      cases.map((e) => [e.c.title.value.replace("\n", " "), sig(e.c.Pi.value), duration(e.c.burn_s.value), lossRel(e.c.loss_rel.value),
        sig(e.frac[e.frac.length - 1], 4)]), [1, 2, 3, 4],
      h("span", {}, "Data: ", sourceLink(site, "figures/anim_numbers.json"), ", ", sourceLink(site, "scripts/anim_engines.py")));
  }
}

function dashGlyph(dash: number[], cls = ""): SVGSVGElement {
  return s("svg", { width: 26, height: 10, "aria-hidden": "true" },
    s("line", { class: cls === "imp" ? "imp-step" : "strip-line", x1: 1, x2: 25, y1: 5, y2: 5, "stroke-dasharray": dash.join(" ") || null }));
}
