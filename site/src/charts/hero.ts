// The hero: one live flyby of Hibberd et al.'s solar dive (hero.json), simulated by the validated JS simulator
// on every change of the burn duration Π (at most one simulation per animation frame). The thrust arc is
// coloured by a·v, the rate of orbital-energy gain (Burn ramp); the dashed exit is the impulsive burn of the
// same Δv at periapsis. Π is set by dragging along the path (pointer) or with the Π slider (keyboard, touch).
// One orchestrated moment on first view; none with prefers-reduced-motion.
import tex from "virtual:tex";
import { fromTargets, simulate, type SimResult } from "../sim/oberth-sim.js";
import { flybyPath, impulsivePath, type Pt } from "../sim/paths";
import { axisSlider, type Mark } from "../controls/axis-slider";
import { citation, sourceLink } from "../lib/cite";
import type { SiteData, Sourced } from "../lib/data";
import { frag, h, onFontsLoaded } from "../lib/dom";
import { engineLabel } from "../lib/engine-label";
import { duration, sig, speed } from "../lib/format";
import { cssVar, themeShown } from "../lib/theme";

export interface HeroData {
  geometry: { r_p_over_R_sun: Sourced; arrival: string; arrival_sensitivity_m_s: { parabolic: Sourced; reference: Sourced } };
  propulsion: { dv_m_s: Sourced; c_km_s: Sourced; stage: Sourced<string> };
  reference: { Pi: Sourced; tau_s: Sourced; burn_s: Sourced };
  units: { V_m_s: number; time_s: number; av_W_per_kg: number };
  nd: { v_inf: number; dv: number; c: number };
  marks: { id: string; title: Sourced<string>; Pi: Sourced }[];
  thresholds: { level: string; loss_rel: number; Pi: Sourced }[];
}

const PI_MIN = 1e-3, PI_MAX = 1e3;                 // the slider's range: the shared Π axis's decades
const EXTEND = 16;                                  // coast added beyond the simulated window, in time units
const INTRO_MS = { draw: 800, ignite: 1000, exit: 600 };


export function hero(root: HTMLElement, d: HeroData, site: SiteData, opt: { figN: number; reducedMotion: boolean }): void {
  const vp = Math.sqrt(d.nd.v_inf ** 2 + 2);
  const tau = 1 / vp;
  const dvOverC = d.nd.dv / d.nd.c;
  const params = (Pi: number) => ({ ...fromTargets(Pi, d.nd.v_inf / Math.SQRT2, d.nd.dv / vp, dvOverC), record: true });
  const hibberd = { label: "Hibberd et al.", ref: site.references.find((r) => r.text.includes("Hibberd"))?.n ?? null };
  const startPi = d.thresholds.find((t) => t.level === "1%")?.Pi.value ?? d.reference.Pi.value;

  // a·v colour scale: from the weakest burn on the slider (Π max) to the strongest (Π min), at periapsis.
  const a0 = (Pi: number) => params(Pi).a0;
  const avLo = Math.log10(a0(PI_MAX) * vp), avHi = Math.log10(a0(PI_MIN) * vp);

  // ---------------------------------------------------------------- DOM
  const canvas = h("canvas", { class: "hero-canvas", role: "img", "aria-describedby": "hero-summary" });
  const overlay = h("div", { class: "overlay", "aria-hidden": "true" });
  const stage = h("div", { class: "hero-stage" }, canvas, overlay);
  const marks: Mark[] = [
    ...d.marks.map((m): Mark => {
      // The label keeps a caveat note, e.g. "(hypothetical at 3.2 R☉)", and leaves an identifying note (the
      // reference) to the hover title.
      const e = engineLabel(m.title.value);
      return { value: m.Pi.value, label: e.caveat ? `${e.name}\n${e.note}` : e.name, kind: "engine",
               // Narrow track: "Solid stack" → "Solid", "SEP-class" → "SEP*", the asterisk explained under the
               // slider from the same caveat string (author, 2026-10-19: the caveat stays visible).
               short: e.short, note: e.starNote || undefined,
               detail: `${e.head.replace(":", ",")}${e.note ? " " + e.note : ""}: Π = ${sig(m.Pi.value)} on this dive` };
    }),
    ...d.thresholds.map((t): Mark => ({ value: t.Pi.value, label: t.level.replace("%", " %"), kind: "threshold",
      detail: `Hibberd et al.'s staged stack reaches ${t.level.replace("%", " %")} loss at Π = ${sig(t.Pi.value)}` })),
  ];
  const piLabel = h("span", {});
  piLabel.append(frag(tex.Pi));
  const slider = axisSlider({ id: "hero-pi", label: piLabel, min: PI_MIN, max: PI_MAX, value: startPi, marks, format: (v) => sig(v) });
  slider.el.classList.add("hero-slider");
  const legend = heroLegend();
  const facts = fixedParameters();
  const summary = h("p", { class: "summary", id: "hero-summary" });
  const table = h("div", {});
  root.append(stage, slider.el, legend, facts, summary, table);

  // ---------------------------------------------------------------- state and the frame loop
  let Pi = startPi, simulatedPi = NaN, result: SimResult | null = null;
  let finite: { pre: Pt[]; burn: Pt[]; post: Pt[] } = { pre: [], burn: [], post: [] };
  let impulsive: Pt[] = [];                          // computed once, below (after the path helpers)
  let reveal = Infinity;                            // intro: path drawn up to this time
  let annotAlpha = 1;
  let frameWorst = 0, frames = 0;
  let pending = false;
  let introRunning = false, introSetting = false;    // the orchestrated moment (below)

  function request(): void {
    if (pending) return;
    pending = true;
    requestAnimationFrame(frame);
  }
  function frame(): void {
    pending = false;
    const t0 = performance.now();
    const sim = Pi !== simulatedPi;
    if (sim) {                                       // one simulation per frame at most
      result = simulate(params(Pi));
      finite = pathFrom(result);
      simulatedPi = Pi;
      updateText();
    }
    draw();
    const dt = performance.now() - t0;
    frames++;
    frameWorst = Math.max(frameWorst, dt);
    if (frameLog.length < 5000) frameLog.push({ ms: dt, sim, Pi });
    root.dataset.frames = String(frames);
    root.dataset.frameWorstMs = frameWorst.toFixed(2);
  }
  // Test hooks (tests/e2e): per-frame cost, and screen positions on the path for dragging.
  const frameLog: { ms: number; sim: boolean; Pi: number }[] = [];
  Object.assign(root, {
    __heroFrames: frameLog,
    __heroProbe: {
      arcEnds: () => (finite.burn.length ? [finite.burn[0], finite.burn[finite.burn.length - 1]].map((p) => ({ x: sx(p), y: sy(p) })) : []),
      /** Screen point on the outgoing path at time t (nondimensional, from periapsis). */
      pathAt: (t: number) => {
        const pts = [...finite.burn, ...finite.post];
        const p = pts.find((q) => q.t >= t) ?? pts[pts.length - 1];
        return { x: sx(p), y: sy(p) };
      },
      tau,
    },
  });

  slider.value.subscribe((v) => {
    if (introSetting) return;                        // the intro moving the slider is not reader input
    Pi = v;
    if (introRunning) endIntro();
    request();
  });
  themeShown.subscribe(() => requestAnimationFrame(() => draw()));
  onFontsLoaded(() => requestAnimationFrame(() => draw()));         // annotations are clamped by their measured size
  let width = 0;
  new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width);
    if (w !== width) { width = w; requestAnimationFrame(() => { size(); draw(); }); }
  }).observe(stage);

  // ---------------------------------------------------------------- geometry: world (r_p) → screen
  let W = 0, H = 0, dpr = 1, scale = 1, U = 7, wTop = -4, wBot = 1.7;
  function size(): void {
    W = stage.clientWidth;
    const narrow = W < 640;
    H = Math.round(narrow ? W * 1.08 : Math.min(560, Math.max(360, W * 0.42)));
    U = narrow ? 2.9 : 7.2;
    scale = W / (2 * U);
    wBot = 1 + 56 / scale;                           // 56 px under periapsis for the Π note, at every width
    wTop = wBot - H / scale;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.height = `${H}px`;
    stage.style.height = `${H}px`;
  }
  // Periapsis points down: screen x = y_sim, screen y = x_sim (so the trajectory is a U around the Sun).
  const sx = (p: { x: number; y: number }) => (p.y + U) * scale;
  const sy = (p: { x: number; y: number }) => (p.x - wTop) * scale;

  // ---------------------------------------------------------------- paths (shared with the explorer: sim/paths.ts)
  const pathFrom = (r: SimResult) => flybyPath(r, params(Pi).a0, EXTEND);
  const impulsive_ = () => impulsivePath(vp, d.nd.dv, EXTEND + 6);

  // ---------------------------------------------------------------- drawing
  function rampColour(av: number): string {
    const u = Math.min(1, Math.max(0, (Math.log10(av) - avLo) / (avHi - avLo)));
    return cssVar(`--burn-${1 + Math.round(u * 6)}`);
  }
  function stroke(ctx: CanvasRenderingContext2D, pts: Pt[], until: number): void {
    ctx.beginPath();
    let started = false;
    for (const p of pts) {
      if (p.t > until) break;
      if (!started) { ctx.moveTo(sx(p), sy(p)); started = true; } else ctx.lineTo(sx(p), sy(p));
    }
    ctx.stroke();
  }
  function draw(): void {
    if (!W) size();
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = cssVar("--paper");
    ctx.fillRect(0, 0, W, H);
    const ink = cssVar("--ink"), graphite = cssVar("--graphite"), rule = cssVar("--rule");
    const origin = { x: 0, y: 0 };
    // Periapsis distance (dotted) and the Sun (radius r_p / (r_p/R☉)).
    ctx.setLineDash([2, 4]); ctx.strokeStyle = rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sx(origin), sy(origin), scale, 0, 2 * Math.PI); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = rule; ctx.strokeStyle = graphite;
    ctx.beginPath(); ctx.arc(sx(origin), sy(origin), scale / d.geometry.r_p_over_R_sun.value, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    // Impulsive exit (dashed) and the finite path (solid Ink).
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = graphite; ctx.lineWidth = 1.5; ctx.setLineDash([7, 5]);
    if (reveal > 0) stroke(ctx, impulsive, reveal);
    ctx.setLineDash([]);
    ctx.strokeStyle = ink; ctx.lineWidth = 1.6;
    stroke(ctx, finite.pre, reveal);
    stroke(ctx, finite.post, reveal);
    // Thrust arc, coloured by a·v; a burn shorter than a few pixels is drawn as a dot at periapsis.
    const narrow = W < 640;
    const arcW = narrow ? 4.5 : 6;
    const b = finite.burn.filter((p) => p.t <= reveal);
    const span = b.length > 1 ? Math.hypot(sx(b[0]) - sx(b[b.length - 1]), sy(b[0]) - sy(b[b.length - 1])) : 0;
    if (!b.length) {
      // Nothing of the burn revealed yet (the intro's first phase).
    } else if (span < arcW) {
      ctx.fillStyle = rampColour(b[0].av!);
      ctx.beginPath(); ctx.arc(sx({ x: 1, y: 0 }), sy({ x: 1, y: 0 }), arcW * 0.75, 0, 2 * Math.PI); ctx.fill();
    } else {
      ctx.lineWidth = arcW;
      for (let i = 0; i + 1 < b.length; i++) {
        ctx.strokeStyle = rampColour(b[i].av!);
        ctx.beginPath(); ctx.moveTo(sx(b[i]), sy(b[i])); ctx.lineTo(sx(b[i + 1]), sy(b[i + 1])); ctx.stroke();
      }
      // Drag handles at the arc's ends (pointer devices).
      if (!narrow) for (const p of [b[0], b[b.length - 1]]) {
        ctx.fillStyle = ink; ctx.strokeStyle = cssVar("--paper"); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx(p), sy(p), 4.5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      }
    }
    annotate();
  }

  // ---------------------------------------------------------------- annotations (HTML, on the data)
  /** Screen point where the (revealed) outgoing branch crosses height y, or null. */
  function branchAt(pts: Pt[], y: number): { x: number; y: number } | null {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      if (b.t > reveal) return null;
      const ya = sy(a), yb = sy(b);
      if ((ya - y) * (yb - y) <= 0 && ya !== yb) {
        const u = (y - ya) / (yb - ya);
        return { x: sx(a) + u * (sx(b) - sx(a)), y };
      }
    }
    return null;
  }
  function annotate(): void {
    overlay.replaceChildren();
    if (!result) return;
    const narrow = W < 640;
    const peri = { x: 1, y: 0 };
    const burnS = Pi * tau * d.units.time_s;
    const piNote = h("div", { class: "annot-html hero-note" });
    piNote.append(frag(tex.Pi), ` = ${sig(Pi)}, `, h("span", {}, narrow ? `burn ${duration(burnS)}` : `a burn of ${duration(burnS)} centred on periapsis`));
    place(piNote, sx(peri), sy(peri) + 22, "middle");
    // η sits inside the U, level with the outgoing branch a third of the way down, with a short leader to it. Where
    // that point is off the canvas (narrow screens: the branches leave by the sides), it goes at the top centre,
    // inside the U, which is empty there.
    const at = branchAt(finite.post, H * 0.34);
    const onBranch = !narrow && at !== null && at.x < W - 8;
    const pathDrawn = reveal >= finite.post[finite.post.length - 1].t;      // the intro has finished drawing it
    if (annotAlpha > 0 && (onBranch || pathDrawn)) {
      const etaNote = h("div", { class: "annot-html hero-note hero-eta", style: `opacity:${annotAlpha}` });
      etaNote.append(frag(tex.eta), ` = ${sig(result.eta, 4)}`, h("span", { class: "annot-text" }, narrow ? "of the bonus kept" : "of the impulsive bonus kept"));
      if (onBranch) {
        place(etaNote, at!.x - 22, at!.y - 11, "end");
        const ctx = canvas.getContext("2d")!;
        ctx.globalAlpha = annotAlpha;
        ctx.strokeStyle = cssVar("--graphite"); ctx.lineWidth = 1; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(at!.x - 18, at!.y); ctx.lineTo(at!.x - 5, at!.y); ctx.stroke();
        ctx.globalAlpha = 1;
      } else place(etaNote, W / 2, 10, "middle");
    }
    const sunNote = h("div", { class: "annot-html annot-2-html" }, "Sun");
    place(sunNote, sx({ x: 0, y: 0 }), sy({ x: 0, y: 0 }) - 9, "middle");
  }
  /** Place an annotation at (x, y) with the given horizontal anchor, kept wholly inside the canvas. */
  function place(el: HTMLElement, x: number, y: number, anchor: "start" | "middle" | "end"): void {
    overlay.append(el);
    const w = el.offsetWidth, hh = el.offsetHeight;
    const left = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
    el.style.left = `${Math.max(2, Math.min(W - w - 2, left))}px`;
    el.style.top = `${Math.max(2, Math.min(H - hh - 2, y))}px`;
  }

  // ---------------------------------------------------------------- drag along the path (pointer)
  let dragging = false;
  function nearestBurnTime(ev: PointerEvent): number | null {
    const r = canvas.getBoundingClientRect();
    const mx = ev.clientX - r.left, my = ev.clientY - r.top;
    let best: Pt | null = null, bestD = Infinity;
    for (const p of [...finite.pre, ...finite.burn, ...finite.post]) {
      const dd = Math.hypot(sx(p) - mx, sy(p) - my);
      if (dd < bestD) { bestD = dd; best = p; }
    }
    return best && bestD < 22 ? best.t : null;
  }
  canvas.addEventListener("pointerdown", (ev) => {
    const t = nearestBurnTime(ev);
    if (t === null) return;
    dragging = true;
    canvas.setPointerCapture(ev.pointerId);
    ev.preventDefault();
    slider.value.set(Math.min(PI_MAX, Math.max(PI_MIN, (2 * Math.abs(t)) / tau)));
  });
  canvas.addEventListener("pointermove", (ev) => {
    const near = nearestBurnTime(ev) !== null;
    canvas.style.cursor = dragging ? "grabbing" : near ? "grab" : "default";
    if (!dragging) return;
    const t = nearestBurnTime(ev);
    if (t !== null) slider.value.set(Math.min(PI_MAX, Math.max(PI_MIN, (2 * Math.abs(t)) / tau)));
  });
  const stop = () => { dragging = false; };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);

  // ---------------------------------------------------------------- text: summary and data table
  // The table is built once; only the current burn's cells change (η at the marks is simulated once).
  const curPi = h("td", { class: "num" }), curEta = h("td", { class: "num" });
  table.append(dataTable());
  function updateText(): void {
    if (!result) return;
    const burnS = Pi * tau * d.units.time_s;
    summary.textContent = `Live simulation of ${hibberd.label}'s solar dive with one equivalent stage. ` +
      `At Π = ${sig(Pi)} (a burn of ${duration(burnS)}), the finite burn keeps η = ${sig(result.eta, 4)} of the impulsive ` +
      `Oberth bonus. Marked on the Π axis: ${d.marks.map((m) => `${m.title.value.split(":")[0]} at Π = ${sig(m.Pi.value)}`).join(", ")}.`;
    canvas.setAttribute("aria-label", `Trajectory of the flyby with the burn at Π = ${sig(Pi)}; η = ${sig(result.eta, 4)}`);
    curPi.textContent = sig(Pi);
    curEta.textContent = sig(result.eta, 4);
  }
  function dataTable(): HTMLDetailsElement {
    // η here is always this case's single equivalent stage, evaluated at each mark's Π, not the marked engine's own η
    // (that engine has its own exhaust velocity); the row names say whose Π it is.
    const rows: HTMLElement[] = [h("tr", {}, h("th", { scope: "row" }, "Current burn"), curPi, curEta)];
    for (const m of d.marks) rows.push(h("tr", {}, h("th", { scope: "row" }, `Π of ${m.title.value.replace("\n", " ").replace(": ", " (")})`),
      h("td", { class: "num" }, sig(m.Pi.value)), h("td", { class: "num" }, sig(simulate({ ...params(m.Pi.value), record: false }).eta, 4))));
    for (const t of d.thresholds) rows.push(h("tr", {}, h("th", { scope: "row" }, `Π at which ${hibberd.label}'s staged stack reaches ${t.level.replace("%", " %")} loss`),
      h("td", { class: "num" }, sig(t.Pi.value)), h("td", { class: "num" }, sig(simulate({ ...params(t.Pi.value), record: false }).eta, 4))));
    return h("details", { class: "data" }, h("summary", {}, "Show data"),
      h("div", { class: "table-scroll" }, h("table", { class: "data-table" },
        h("caption", {}, "η of this case (one equivalent stage, live simulation) at the current Π and at each marked Π"),
        h("thead", {}, h("tr", {}, ...["Point on the Π axis", "Π", "η (this case)"].map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", {}, ...rows))),
      h("p", { class: "table-note" }, "Data: ", sourceLink(site, "figures/anim_numbers.json"), ", ", sourceLink(site, "figures/phase4_numbers.json")));
  }
  function heroLegend(): HTMLElement {
    const bar = h("span", { class: "ramp-bar", "aria-hidden": "true" });
    const lo = 10 ** avLo * d.units.av_W_per_kg, hi = 10 ** avHi * d.units.av_W_per_kg;
    const avLabel = h("span", {});
    avLabel.append(frag(tex.av), " at periapsis, W/kg:");
    return h("ul", { class: "legend hero-legend", "aria-label": "Legend" },
      h("li", {}, avLabel, h("span", { class: "num" }, sig(lo, 2)), bar, h("span", { class: "num" }, sig(hi, 2))),
      h("li", {}, h("span", { class: "line-key solid", "aria-hidden": "true" }), "finite burn"),
      h("li", {}, h("span", { class: "line-key dashed", "aria-hidden": "true" }), "impulsive burn of the same Δv at periapsis"));
  }
  function fixedParameters(): HTMLElement {
    const row = (k: string, v: Node | string) => h("div", {}, h("dt", {}, k), h("dd", {}, v));
    const caseName = h("span", {}, citation(`${hibberd.label}’s solar dive`, hibberd.ref));
    const rp = h("span", {}, `${sig(d.geometry.r_p_over_R_sun.value, 2)} `);
    rp.append(frag(tex.Rsun));
    return h("dl", { class: "facts hero-facts" },
      row("Case", caseName),
      row("Periapsis", rp),
      row("Δv", speed(d.propulsion.dv_m_s.value)),
      row("Propulsion", `one equivalent constant-thrust stage; exhaust velocity ${sig(d.propulsion.c_km_s.value, 3)} km/s, that of the ${d.propulsion.stage.value}`),
      row("Arrival", `parabolic (approximation; changing the arrival orbit moves the staged loss from ${speed(d.geometry.arrival_sensitivity_m_s.reference.value)} to ${speed(d.geometry.arrival_sensitivity_m_s.parabolic.value)})`),
      row("Steering", "prograde, burn centred on periapsis"));
  }

  // ---------------------------------------------------------------- the one orchestrated moment
  function endIntro(): void {
    introRunning = false;
    reveal = Infinity;
    annotAlpha = 1;
    root.dataset.intro = "done";
  }
  function intro(): void {
    root.dataset.intro = "running";
    root.dataset.introRuns = String(Number(root.dataset.introRuns ?? 0) + 1);
    // Simulate the starting case once, then reveal: incoming branch, ignition and spread, exits and η.
    result = simulate(params(PI_MIN));
    finite = pathFrom(result);
    const tStart = finite.pre[0].t, tEnd = finite.post[finite.post.length - 1].t;
    introRunning = true;
    const t0 = performance.now();
    const step = () => {
      if (!introRunning) { request(); return; }
      const e = performance.now() - t0;
      const { draw: a, ignite: b, exit: c } = INTRO_MS;
      if (e < a) { reveal = tStart + (0 - tStart) * ease(e / a); annotAlpha = 0; }
      else if (e < a + b) {
        const u = ease((e - a) / b);
        Pi = 10 ** (Math.log10(PI_MIN) + u * (Math.log10(startPi) - Math.log10(PI_MIN)));
        introSetting = true;                          // keep the slider in step without ending the intro
        slider.value.set(Pi);
        introSetting = false;
        reveal = finite.burn.length ? finite.burn[finite.burn.length - 1].t : 0;
        annotAlpha = 0;
      } else if (e < a + b + c) {
        const u = ease((e - a - b) / c);
        reveal = finite.burn[finite.burn.length - 1].t + u * (tEnd - finite.burn[finite.burn.length - 1].t);
        annotAlpha = u;
      } else { endIntro(); request(); return; }
      if (Pi !== simulatedPi) { result = simulate(params(Pi)); finite = pathFrom(result); simulatedPi = Pi; updateText(); }
      draw();
      requestAnimationFrame(step);           // one simulation per frame, as in the reader-driven loop
    };
    requestAnimationFrame(step);
  }
  const ease = (u: number) => 1 - (1 - u) ** 3;

  impulsive = impulsive_();
  size();
  if (opt.reducedMotion) { root.dataset.intro = "skipped"; request(); }
  else {
    // Any reader input during the intro (a key, scrolling, a pointer anywhere on the page) ends it at once.
    for (const ev of ["pointerdown", "keydown", "wheel", "touchstart"]) {
      window.addEventListener(ev, () => { if (introRunning) { endIntro(); request(); } }, { once: true, passive: true });
    }
    intro();
  }
}
