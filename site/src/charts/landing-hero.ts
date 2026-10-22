// The landing page's hero (Phase 7, docs/landing_plan.md as approved 2026-10-21): Hibberd et al.'s solar dive flown by
// all three engines in one shared view, with the animation's radial mapping ρ = 1 + log₁₀(r/r_p) drawn sideways (the
// Sun on the left; Figure 7's view turned by 90°, not mirrored). Each burn is drawn on the a·v ramp in its own lane
// beside its path (lanes outward from the path: solid stack, nuclear thermal, SEP-class), so the pinpoint chemical
// burn and the long SEP smear sit side by side; positions along the path are exact, only the offset is schematic.
// Beside it, the energy-gain strip on the same clock (as in Figure 7).
// Motion: one sequence on first load (at most 3 s; once per browser session through sessionStorage; the final frame
// at once under prefers-reduced-motion; any reader input ends it), then the reader scrubs time. Every value comes from
// engines.json and engines.bin (scripts/export_site_data.py), drawn through charts/dive-view.ts.
import tex from "virtual:tex";
import { sourceLink } from "../lib/cite";
import type { SiteData } from "../lib/data";
import { frag, h, onFontsLoaded, s } from "../lib/dom";
import { duration, lossRel, sig } from "../lib/format";
import { cssVar, themeShown } from "../lib/theme";
import { dataTable } from "./common";
import { AV_RANGE, burnColour, clockText, DASH, dashGlyph, dive, drawEnergyStrip, drawRingsAndSun, type DiveCase, type EnginesData } from "./dive-view";

const SWEEP_MS = 2400, LABELS_MS = 2400, DONE_MS = 2800;    // the sequence: sweep the clock, then labels, then done
const SEEN = "oberth-landing-intro";                         // sessionStorage: the sequence has played this session
const RINGS = [3, 10, 30];

export function landingHero(root: HTMLElement, body: HTMLElement, d: EnginesData, buf: ArrayBuffer, site: SiteData,
                            opt: { reducedMotion: boolean }): void {
  const dv = dive(d, buf);
  const { cases, sMax } = dv;
  // Extent of the three paths in ρ units (the view is fitted to it).
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const e of cases) for (let i = 0; i < e.X.length; i++) {
    xMin = Math.min(xMin, e.X[i]); xMax = Math.max(xMax, e.X[i]); yMin = Math.min(yMin, e.Y[i]); yMax = Math.max(yMax, e.Y[i]);
  }
  // Where each engine fires, and the sample its lane label hangs from: the solid stack's burn centre, the end of the
  // nuclear arc, and a point on the SEP lane along the incoming leg (eighty τ before perihelion, where the leg descends
  // toward its end, so the label stays inside the view at every width).
  const burning = cases.map((e) => { const on: number[] = []; e.av.forEach((a, i) => { if (a > 0) on.push(i); }); return on; });
  const labelAt = [burning[0][burning[0].length >> 1] ?? 0, burning[1][burning[1].length - 1] ?? 0, dv.indexAt(-80 * dv.tau)];

  // ---------------------------------------------------------------- DOM
  const canvas = h("canvas", { class: "lh-dive", role: "img", "aria-labelledby": "hero-figure-title", "aria-describedby": "hero-summary" });
  const view = h("div", { class: "lh-view" }, canvas);
  const scrub = h("input", { type: "range", id: "hero-t", min: -sMax, max: sMax, step: (2 * sMax) / 1000, value: sMax,
    "aria-label": "time from perihelion" });
  const clock = h("output", { class: "clock", for: "hero-t" });
  const controls = h("div", { class: "controls lh-controls" }, h("div", { class: "scrub" }, scrub), clock);
  const strip = s("svg", { class: "energy-strip", "aria-hidden": "true" });
  const stripWrap = h("div", { class: "plot strip-plot" }, strip);
  const stripTitle = h("p", { class: "lh-strip-title" }, "Energy gain, as a fraction of the impulsive gain");
  // The engines' key: with each engine's burn, Π and loss where there is room; below 600 px, one line of line styles
  // and short names (the facts are in the data table), so the title and entry links stay above the fold.
  const key = h("ul", { class: "legend lh-key", "aria-label": "Engines" }, ...cases.map((e, i) =>
    h("li", {}, dashGlyph(DASH[i]),
      h("span", {}, h("span", { class: "engine-name" }, `${e.label.name}${e.label.caveat ? "*" : ""}`),
        h("span", { class: "engine-facts" }, ` burn ${duration(e.c.burn_s.value)}, Π = ${sig(e.c.Pi.value)}, loss ${lossRel(e.c.loss_rel.value)} of Δv`)))));
  const keyCompact = h("ul", { class: "legend lh-key-compact", "aria-label": "Engines" },
    ...cases.map((e, i) => h("li", {}, dashGlyph(DASH[i]), e.label.short)), h("li", {}, dashGlyph([], "imp"), "impulsive"));
  const avLabel = h("span", {});
  avLabel.append(frag(tex.av), ` at the engine, W/kg: ${sig(AV_RANGE[0], 1)}`);
  const legend = h("ul", { class: "legend lh-legend", "aria-label": "Legend" },
    h("li", {}, avLabel, h("span", { class: "ramp-bar", "aria-hidden": "true" }), h("span", {}, "10⁸", h("span", { class: "lh-wide" }, " (log scale)"))),
    h("li", {}, "Burns drawn beside their paths", h("span", { class: "lh-wide" }, ": Solid nearest, then Nuclear, then SEP")),
    h("li", { class: "lh-wide" }, dashGlyph([], "imp"), "impulsive burn at perihelion"));
  const caveat = cases.map((e) => e.label.starNote).find(Boolean);
  const note = caveat ? h("p", { class: "lh-note" }, caveat) : null;
  const summary = h("p", { class: "visually-hidden", id: "hero-summary" });
  summary.textContent = `Hibberd et al.'s solar dive flown with three engines of the same Δv, drawn in one view. ` + cases.map((e) =>
    `${e.label.name}: burn ${duration(e.c.burn_s.value)}, Π = ${sig(e.c.Pi.value)}, ${lossRel(e.c.loss_rel.value)} of Δv lost, ` +
    `energy gain ${sig(e.frac[e.frac.length - 1], 3)} of the impulsive gain`).join("; ") + ".";
  const side = h("div", { class: "lh-side" }, controls, stripTitle, stripWrap, key, keyCompact, legend, note ?? "", summary, table());
  body.append(view, side);

  // ---------------------------------------------------------------- time and the sequence
  let s_ = sMax, labels = true, running = false;
  let W = 0, SW = 0;                                         // laid-out widths of the view and the strip (0: not yet)
  scrub.addEventListener("input", () => { if (running) end("done"); s_ = Number(scrub.value); draw(); });
  function end(state: string): void {
    running = false; labels = true; root.dataset.intro = state;
    if (state !== "done") { s_ = sMax; scrub.value = String(sMax); }
    draw();
  }
  function intro(): void {
    running = true; labels = false;
    root.dataset.intro = "running";
    root.dataset.introRuns = String(Number(root.dataset.introRuns ?? 0) + 1);
    const t0 = performance.now();
    const step = (now: number) => {
      if (!running) return;
      const e = now - t0;
      s_ = e < SWEEP_MS ? -sMax + (2 * sMax * e) / SWEEP_MS : sMax;
      labels = e >= LABELS_MS;
      scrub.value = String(s_);
      draw();
      if (e >= DONE_MS) { running = false; root.dataset.intro = "done"; } else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  let seen = false;
  try { seen = sessionStorage.getItem(SEEN) === "1"; if (!seen && !opt.reducedMotion) sessionStorage.setItem(SEEN, "1"); } catch { /* no storage */ }
  if (opt.reducedMotion) end("skipped");
  else if (seen) end("seen");
  else {
    // Any reader input during the sequence ends it on the final frame.
    for (const ev of ["pointerdown", "keydown", "wheel", "touchstart"]) {
      window.addEventListener(ev, () => { if (running) { s_ = sMax; scrub.value = String(sMax); end("done"); } }, { once: true, passive: true });
    }
    intro();
  }

  // ---------------------------------------------------------------- drawing
  new ResizeObserver(() => { W = Math.round(view.clientWidth); SW = Math.round(stripWrap.clientWidth); requestAnimationFrame(draw); }).observe(body);
  themeShown.subscribe(() => requestAnimationFrame(draw));
  onFontsLoaded(() => requestAnimationFrame(draw));

  function draw(): void {
    if (!W) return;
    const k = dv.indexAt(dv.tau * Math.sinh(s_));
    clock.textContent = clockText(dv, s_);
    scrub.setAttribute("aria-valuetext", clock.textContent);
    drawView(k);
    drawEnergyStrip(strip, dv, k, SW, SW < 480 ? 88 : 124, "hero-clip");
    root.dataset.cursor = strip.dataset.cursor ?? "";
  }

  function drawView(k: number): void {
    const narrow = W < 560;
    const lane = narrow ? 4 : 5;                              // px between lanes
    // Room around the paths: the lanes and their labels (the solid stack's label on the left, the SEP label above).
    const pad = { left: narrow ? 58 : 70, right: 8, top: narrow ? 26 : 34, bottom: narrow ? 12 : 18 };
    // The hero's height cap (above the fold: author, 2026-10-21); data-height-cap overrides it for tools/og-image.mjs.
    const cap = Number(root.dataset.heightCap) || (narrow ? 214 : 360);
    const sc = Math.min((W - pad.left - pad.right) / (xMax - xMin), (cap - pad.top - pad.bottom) / (yMax - yMin));
    const H = Math.round((yMax - yMin) * sc + pad.top + pad.bottom);
    // The Sun's centre; the drawing is centred across the view when the view is wider than it needs.
    const ox = pad.left + xMax * sc + Math.max(0, (W - pad.left - pad.right - (xMax - xMin) * sc) / 2), oy = pad.top - yMin * sc;
    const P = (e: DiveCase, i: number): [number, number] => [ox - e.X[i] * sc, oy + e.Y[i] * sc];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = cssVar("--paper"); ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    drawRingsAndSun(ctx, ox, oy, sc, dv.rhoSun, RINGS, [1, 0.04]);
    ctx.restore();
    const rule = cssVar("--rule"), ink = cssVar("--ink"), paper = cssVar("--paper");

    // The outward normal (away from the Sun) at sample i of a path, for its lane.
    const normal = (e: DiveCase, i: number): [number, number] => {
      const a = P(e, Math.max(0, i - 1)), b = P(e, Math.min(e.X.length - 1, i + 1));
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
      const [px, py] = P(e, i);
      return (px - ox) * nx + (py - oy) * ny < 0 ? [-nx, -ny] : [nx, ny];
    };
    const path = (e: DiveCase, from: number, to: number) => {
      ctx.beginPath();
      for (let i = from; i < to; i++) { const [px, py] = P(e, i); if (i === from) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.stroke();
    };
    // Full paths, faint; the paths so far, Ink in each engine's line style.
    ctx.lineWidth = 1; ctx.strokeStyle = rule;
    for (const e of cases) path(e, 0, e.X.length);
    ctx.strokeStyle = ink; ctx.lineWidth = 1.4;
    cases.forEach((e, i) => { ctx.setLineDash(DASH[i]); path(e, 0, Math.min(k, e.X.length)); });
    ctx.setLineDash([]);
    // The burns so far, each in its lane, coloured by a·v. The solid stack's burn is a few samples long: a dot.
    cases.forEach((e, j) => {
      const off = (j + 1) * lane;
      const on = burning[j].filter((i) => i < k);
      if (!on.length) return;
      if (on.length < 12) {
        const i = on[on.length >> 1], [nx, ny] = normal(e, i), [px, py] = P(e, i);
        ctx.fillStyle = burnColour(e.av[i], dv.avScale) ?? ink;
        ctx.beginPath(); ctx.arc(px + nx * off, py + ny * off, 3, 0, 2 * Math.PI); ctx.fill();
        return;
      }
      ctx.lineWidth = 3; ctx.lineCap = "butt";
      for (const i of on) {
        if (i === 0 || !(e.av[i - 1] > 0)) continue;
        const colour = burnColour(e.av[i], dv.avScale);
        if (!colour) continue;
        const [ax, ay] = P(e, i - 1), [bx, by] = P(e, i), [nx, ny] = normal(e, i);
        ctx.strokeStyle = colour;
        ctx.beginPath(); ctx.moveTo(ax + nx * off, ay + ny * off); ctx.lineTo(bx + nx * off, by + ny * off); ctx.stroke();
      }
    });
    // Where each engine is now.
    if (k > 0) for (const e of cases) {
      const [px, py] = P(e, Math.min(k, e.X.length) - 1);
      ctx.fillStyle = ink; ctx.strokeStyle = paper; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 3.5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    }
    // Lane labels, outside the lanes: "Solid", "Nuclear", "SEP*" (short names, as on the hero's narrow Π axis).
    let clipped = 0;
    if (labels) {
      const size = narrow ? 12 : 13;
      ctx.font = `${size}px ${cssVar("--sans-cond") || "sans-serif"}`;
      cases.forEach((e, j) => {
        const i = labelAt[j], [nx, ny] = normal(e, i), [px, py] = P(e, i);
        const r = 3 * lane + 8, lx = px + nx * r, ly = py + ny * r;
        const align = nx < -0.35 ? "right" : nx > 0.35 ? "left" : "center";
        const base = ny < -0.35 ? "bottom" : ny > 0.35 ? "top" : "middle";
        ctx.textAlign = align; ctx.textBaseline = base;
        ctx.lineWidth = 3; ctx.strokeStyle = paper; ctx.strokeText(e.label.short, lx, ly);
        ctx.fillStyle = ink; ctx.fillText(e.label.short, lx, ly);
        // Whether the label fits inside the view (checked by the layout tests: data-labels-clipped = 0).
        const w = ctx.measureText(e.label.short).width;
        const x0 = align === "right" ? lx - w : align === "left" ? lx : lx - w / 2;
        const y0 = base === "bottom" ? ly - size : base === "top" ? ly : ly - size / 2;
        if (x0 < 0 || x0 + w > W || y0 < 0 || y0 + size > H) clipped++;
      });
    }
    canvas.dataset.labelsClipped = String(clipped);
    canvas.dataset.k = String(k);
  }

  function table(): HTMLDetailsElement {
    return dataTable("The three engines on Hibberd et al.'s dive (the animation's runs; loss is the equivalent-Δv loss)",
      ["Engine", "Π", "burn", "loss/Δv", "energy gain / impulsive"],
      cases.map((e) => [e.c.title.value.replace("\n", " "), sig(e.c.Pi.value), duration(e.c.burn_s.value), lossRel(e.c.loss_rel.value),
        sig(e.frac[e.frac.length - 1], 4)]), [1, 2, 3, 4],
      h("span", {}, "Data: ", sourceLink(site, "figures/anim_numbers.json"), ", ", sourceLink(site, "scripts/anim_engines.py")));
  }
}
