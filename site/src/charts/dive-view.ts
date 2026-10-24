// Hibberd et al.'s dive flown by three engines (scripts/anim_engines.py's own trajectories, from engines.json and
// engines.bin): the data, the animation's radial mapping ρ = 1 + log₁₀(r/r_p), the a·v colouring, the
// asinh-stretched clock t = τ sinh s, and the energy-gain strip. Shared by Figure 7 (charts/engines.ts) and the landing
// page's hero (charts/landing-hero.ts, Phase 7), so both draw the same thing the same way.
import type { Provenance, Sourced } from "../lib/data";
import { s } from "../lib/dom";
import { engineLabel, type EngineLabel } from "../lib/engine-label";
import { duration, sig } from "../lib/format";
import { cssVar } from "../lib/theme";

export interface ArrayRef { name: string; offset: number; length: number }
export interface EngineCase {
  id: string; title: Sourced<string>; Pi: Sourced; loss_rel: Sourced; burn_s: Sourced;
  arrays: ArrayRef[]; sim_Pi: number; sim_loss_rel: number;
}
export interface EnginesData {
  provenance: Provenance; binary: string; dtype: string; stride: number;
  units: { time_s: number; length_m: number; av_W_per_kg: number; tau: number; window_tau: number; r_p_over_R_sun: Sourced };
  time: ArrayRef; cases: EngineCase[];
}

export const AV_RANGE: [number, number] = [1e2, 1e8];      // W/kg, as the animation's colour scale
export const RINGS = [1, 3, 10, 30];                       // r/r_p circles, as the animation
export const DASH = [[], [6, 2], [1.5, 1.5]];              // the animation's line styles, one per engine

export interface DiveCase {
  c: EngineCase; label: EngineLabel;
  X: Float32Array; Y: Float32Array;                        // the radial mapping of x, y (ρ units)
  av: Float32Array; frac: Float32Array;                    // a·v (nondimensional) and energy gain / impulsive gain
}
export interface Dive {
  t: Float32Array; cases: DiveCase[];
  tau: number; windowTau: number; timeS: number; avScale: number;
  sMax: number;                                            // the stretched clock runs over s ∈ [−sMax, sMax]
  rhoSun: number;                                          // the Sun's radius in ρ units
  /** The first sample at or after time tv (nondimensional). */
  indexAt(tv: number): number;
}

export function dive(d: EnginesData, buf: ArrayBuffer): Dive {
  const arr = (r: ArrayRef) => new Float32Array(buf, r.offset, r.length);
  const t = arr(d.time);
  const cases = d.cases.map((c): DiveCase => {
    const get = (k: string) => arr(c.arrays.find((a) => a.name === `${c.id}.${k}`)!);
    const x = get("x"), y = get("y");
    const X = new Float32Array(x.length), Y = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) {
      const r = Math.hypot(x[i], y[i]), rho = 1 + Math.log10(r);
      X[i] = (rho * x[i]) / r; Y[i] = (rho * y[i]) / r;
    }
    return { c, label: engineLabel(c.title.value), X, Y, av: get("av"), frac: get("energy_fraction") };
  });
  const { tau, window_tau, time_s, av_W_per_kg } = d.units;
  return {
    t, cases, tau, windowTau: window_tau, timeS: time_s, avScale: av_W_per_kg,
    sMax: Math.asinh(window_tau), rhoSun: 1 + Math.log10(1 / d.units.r_p_over_R_sun.value),
    indexAt(tv) { let lo = 0, hi = t.length; while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] < tv) lo = m + 1; else hi = m; } return lo; },
  };
}

/** The clock's reading at stretched time s, e.g. "t = −413 h from perihelion". */
export function clockText(dv: Dive, sv: number): string {
  const hours = (dv.tau * Math.sinh(sv) * dv.timeS) / 3600;
  return `t = ${hours >= 0 ? "+" : "−"}${sig(Math.abs(hours), 3)} h from perihelion`;
}

/** The Burn-ramp colour for a·v (nondimensional), on the animation's log scale; null where the engine is off. */
export function burnColour(av: number, avScale: number): string | null {
  if (!(av > 0)) return null;
  const lo = Math.log10(AV_RANGE[0]), hi = Math.log10(AV_RANGE[1]);
  const u = Math.min(1, Math.max(0, (Math.log10(av * avScale) - lo) / (hi - lo)));
  return cssVar(`--av-${1 + Math.round(u * 6)}`);
}

/**
 * The r/r_p rings (dashed Rule, Graphite labels) and the Sun, centred at (cx, cy), sc pixels per ρ unit. Each ring's
 * label sits at (cx + fx·ρ + 2, cy + fy·ρ), fx and fy from `at` (Figure 7: 0.72, 0.72, lower right).
 */
export function drawRingsAndSun(ctx: CanvasRenderingContext2D, cx: number, cy: number, sc: number, rhoSun: number,
                                rings = RINGS, at: [number, number] = [0.72, 0.72]): void {
  const rule = cssVar("--grid"), graphite = cssVar("--ink-2");
  ctx.strokeStyle = rule; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
  ctx.font = `11px ${cssVar("--sans-cond") || "sans-serif"}`; ctx.fillStyle = graphite;
  for (const r of rings) {
    const rho = (1 + Math.log10(r)) * sc;
    ctx.beginPath(); ctx.arc(cx, cy, rho, 0, 2 * Math.PI); ctx.stroke();
    ctx.fillText(r === 1 ? "rₚ" : `${r} rₚ`, cx + rho * at[0] + 2, cy + rho * at[1]);
  }
  ctx.setLineDash([]);
  ctx.fillStyle = rule; ctx.strokeStyle = graphite;
  ctx.beginPath(); ctx.arc(cx, cy, rhoSun * sc, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
}

/**
 * The energy strip: symlog time (linear within ±τ, as the animation) against energy gain / impulsive gain, the three
 * engines in their line styles, the impulsive step, and a cursor at sample k (the part after it faint).
 */
export function drawEnergyStrip(strip: SVGSVGElement, dv: Dive, k: number, W: number, H: number, clipId: string): void {
  if (W < 200) return;
  const { t, tau, windowTau, timeS } = dv;
  const m = { top: 10, right: 12, bottom: 34, left: 44 };
  const sl = (u: number) => Math.sign(u) * (Math.abs(u) <= 1 ? Math.abs(u) : 1 + Math.log10(Math.abs(u)));
  const L = sl(windowTau);
  const x = (tv: number) => m.left + ((sl(tv / tau) + L) / (2 * L)) * (W - m.left - m.right);
  const y = (f: number) => H - m.bottom - (f / 1.08) * (H - m.top - m.bottom);
  strip.replaceChildren();
  strip.setAttribute("viewBox", `0 0 ${W} ${H}`);
  strip.setAttribute("height", String(H));
  const ax = s("g", { class: "axis" }, s("line", { x1: m.left, x2: W - m.right, y1: y(0), y2: y(0) }), s("line", { x1: m.left, x2: m.left, y1: m.top, y2: y(0) }));
  for (const u of [-100, -10, -1, 0, 1, 10, 100]) {
    const tx = x(u * tau);
    ax.append(s("line", { x1: tx, x2: tx, y1: y(0), y2: y(0) + 4 }));
    if (W >= 480 || Math.abs(u) !== 10) ax.append(s("text", { x: tx, y: y(0) + 16, "text-anchor": "middle" }, u === 0 ? "0" : `${u > 0 ? "" : "−"}${Math.abs(u) === 1 ? "" : Math.abs(u)}τ`));
  }
  for (const f of [0, 0.5, 1]) ax.append(s("line", { x1: m.left - 4, x2: m.left, y1: y(f), y2: y(f) }),
    s("text", { x: m.left - 7, y: y(f) + 4, "text-anchor": "end" }, String(f)));
  ax.append(s("text", { x: (m.left + W - m.right) / 2, y: H - 3, "text-anchor": "middle" }, `time from perihelion (τ = r_p/v_p = ${duration(tau * timeS)})`));
  strip.append(ax);
  // The impulsive step at perihelion.
  strip.append(s("path", { class: "imp-step", d: `M${x(-windowTau * tau)},${y(0)}H${x(0)}V${y(1)}H${x(windowTau * tau)}` }));
  const lineD = (e: DiveCase) => {
    let dd = "";
    for (let i = 0; i < t.length; i += 2) dd += `${i ? "L" : "M"}${x(t[i]).toFixed(1)},${y(e.frac[i]).toFixed(1)}`;
    return dd;
  };
  const now = k > 0 ? x(t[Math.min(k, t.length) - 1]) : m.left;
  strip.append(s("defs", {}, s("clipPath", { id: clipId }, s("rect", { x: 0, y: 0, width: Math.max(0, now), height: H }))));
  dv.cases.forEach((e, i) => {
    const dash = DASH[i].join(" ") || null;
    strip.append(s("path", { class: "strip-line faint", d: lineD(e), "stroke-dasharray": dash }),
      s("path", { class: "strip-line", d: lineD(e), "stroke-dasharray": dash, "clip-path": `url(#${clipId})` }));
  });
  strip.append(s("line", { class: "strip-cursor", x1: now, x2: now, y1: m.top, y2: y(0) }));
  strip.dataset.cursor = now.toFixed(1);
}

/** A line-style key glyph: an engine's dash pattern, or the impulsive step ("imp"). */
export function dashGlyph(dash: number[], cls = ""): SVGSVGElement {
  return s("svg", { width: 26, height: 10, "aria-hidden": "true" },
    s("line", { class: cls === "imp" ? "imp-step" : "strip-line", x1: 1, x2: 25, y1: 5, y2: 5, "stroke-dasharray": dash.join(" ") || null }));
}
