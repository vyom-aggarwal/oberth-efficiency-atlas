// The landing preloader's flyby (Phase 9, docs/revamp_plan.md §2.6): one hyperbola, e = 1.5, in the dive's radial
// mapping ρ = 1 + log₁₀(r/r_p), the Sun at its focus, the burn arc centred on periapsis, and the five stages at their true
// anomalies in physical order (author, 2026-11-02: a centred burn ignites before periapsis). Pure geometry and timing,
// shared by the page that draws it and flyby.test.ts, which asserts that every stage sits at its physical point on the
// drawn path (author, 2026-11-02).

const DEG = Math.PI / 180;
export const ECC = 1.5;
/** The drawn path spans ν ∈ [−NU_MAX, NU_MAX]. */
export const NU_MAX = 125 * DEG;
/** The burn arc: ±NU_BURN about periapsis, so the burn's midpoint in time is periapsis (a centred burn). */
export const NU_BURN = 35 * DEG;
/** The Sun's radius in ρ units. */
export const SUN_R = 0.42;

export interface Stage { name: string; nu: number }
/** The stages in the order the flight meets them; Ignition and Cutoff are the burn arc's ends. */
export const STAGES: readonly Stage[] = [
  { name: "Approach", nu: -110 * DEG }, { name: "Ignition", nu: -NU_BURN }, { name: "Periapsis", nu: 0 },
  { name: "Cutoff", nu: NU_BURN }, { name: "Escape", nu: 110 * DEG },
];

/** r/r_p at true anomaly ν (the conic r = p/(1 + e cos ν), with r_p = p/(1 + e)). */
export function radius(nu: number): number { return (1 + ECC) / (1 + ECC * Math.cos(nu)); }

/** A point at true anomaly ν, in ρ units: the Sun at the origin, periapsis to its left, and the incoming leg at y < 0
 *  (up on a screen, where y grows downward). */
export function flybyPoint(nu: number): [number, number] {
  const rho = 1 + Math.log10(radius(nu));
  return [-rho * Math.cos(nu), rho * Math.sin(nu)];
}

/** The hyperbolic mean anomaly at ν: Kepler's time from periapsis, in the orbit's own time unit. */
export function meanAnomaly(nu: number): number {
  const H = 2 * Math.atanh(Math.sqrt((ECC - 1) / (ECC + 1)) * Math.tan(nu / 2));
  return ECC * Math.sinh(H) - H;
}

const M_MAX = meanAnomaly(NU_MAX);
/** The flight's progress u ∈ [0, 1] at ν: half Kepler's time, half uniform in angle, so the dot visibly speeds through
 *  periapsis without the turn vanishing in two frames. Increasing in ν, and u(−ν) = 1 − u(ν). */
export function progress(nu: number): number { return 0.25 * (meanAnomaly(nu) / M_MAX + 1) + 0.25 * (nu / NU_MAX + 1); }

/** ν at progress u (the inverse of progress, by bisection). */
export function nuAt(u: number): number {
  if (u <= 0) return -NU_MAX;
  if (u >= 1) return NU_MAX;
  let lo = -NU_MAX, hi = NU_MAX;
  for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (progress(m) <= u) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

/** The true anomalies at which the path is drawn: n + 1 samples from −NU_MAX to NU_MAX, every stage among them. */
export function pathAnomalies(n = 240): number[] {
  const nus = Array.from({ length: n + 1 }, (_, i) => -NU_MAX + (2 * NU_MAX * i) / n);
  return [...new Set([...nus, ...STAGES.map((st) => st.nu)])].sort((a, b) => a - b);
}

/** Where a stage's name hangs: its point on the path, and the unit normal on the path's convex side (far out the path
 *  runs almost radially, so a radial offset would put the name on the line). */
export function stageMark(nu: number): { p: [number, number]; n: [number, number] } {
  const p = flybyPoint(nu), a = flybyPoint(nu - 0.05), b = flybyPoint(nu + 0.05);
  const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty);
  const cx = a[0] + b[0] - 2 * p[0], cy = a[1] + b[1] - 2 * p[1];   // toward the centre of curvature
  let n: [number, number] = [-ty / tl, tx / tl];
  if (n[0] * cx + n[1] * cy > 0) n = [-n[0], -n[1]];
  return { p, n };
}
