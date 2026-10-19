// Drawing paths for a simulated flyby (shared by the hero and the explorer): the recorded segments as dense points
// (cubic Hermite between integrator steps, using the recorded velocities), extended by a two-body coast beyond the
// simulated window, and the impulsive exit. Nondimensional units, as the simulator: μ = r_p = 1.
import { integrate, type SimResult } from "./oberth-sim.js";

export type Pt = { x: number; y: number; t: number; av?: number };
export interface FlybyPath { pre: Pt[]; burn: Pt[]; post: Pt[] }

function coastRhs(_t: number, y: number[], out: number[]): void {
  const r2 = y[0] * y[0] + y[1] * y[1];
  const k = -1 / (r2 * Math.sqrt(r2));
  out[0] = y[2]; out[1] = y[3]; out[2] = k * y[0]; out[3] = k * y[1]; out[4] = 0;
}
const COAST = { rtol: 1e-9, atol: 1e-9, maxSteps: 2e5, record: true, rImpact: 0 };

/** Dense points between recorded states [x, y, vx, vy, m]; `withAv` gives a·v at each point (burn segments). */
export function hermite(ts: number[], ys: number[][], withAv?: (y: number[]) => number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < ts.length; i++) {
    const [t0, t1] = [ts[i], ts[i + 1]], [a, b] = [ys[i], ys[i + 1]], hh = t1 - t0;
    const n = Math.max(1, Math.min(24, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 40)));
    for (let k = 0; k < n; k++) {
      const s = k / n, s2 = s * s, s3 = s2 * s;
      const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
      const x = h00 * a[0] + h10 * hh * a[2] + h01 * b[0] + h11 * hh * b[2];
      const y = h00 * a[1] + h10 * hh * a[3] + h01 * b[1] + h11 * hh * b[3];
      const yi = a.map((v, j) => v + (b[j] - v) * s);
      out.push({ x, y, t: t0 + s * hh, av: withAv ? withAv(yi) : undefined });
    }
  }
  const last = ys[ys.length - 1];
  out.push({ x: last[0], y: last[1], t: ts[ts.length - 1], av: withAv ? withAv(last) : undefined });
  return out;
}

/**
 * The recorded flyby with `extend` time units of coast added before and after; a₀ gives a·v = (a₀/m)|v| on the burn.
 * An impact ends the recording early (no post-burn segment, or no burn): the path ends where it does, with no coast
 * added after it.
 */
export function flybyPath(r: SimResult, a0: number, extend: number): FlybyPath {
  const seg = (label: string) => r.segments!.find((s) => s.label === label && s.t.length > 0);
  const pre = seg("pre"), burn = seg("burn"), post = seg("post");
  const av = (y: number[]) => (a0 / y[4]) * Math.hypot(y[2], y[3]);
  const out: FlybyPath = { pre: [], burn: [], post: [] };
  if (pre) {
    const back = integrate(coastRhs, pre.t[0], pre.t[0] - extend, pre.y[0], COAST);
    out.pre = [...hermite([...back.t].reverse(), [...back.y].reverse()), ...hermite(pre.t, pre.y)];
  }
  if (burn) out.burn = hermite(burn.t, burn.y, av);
  if (post) {
    out.post = hermite(post.t, post.y);
    if (!r.impacted) {
      const fwd = integrate(coastRhs, post.t[post.t.length - 1], post.t[post.t.length - 1] + extend, post.y[post.y.length - 1], COAST);
      out.post.push(...hermite(fwd.t, fwd.y));
    }
  }
  return out;
}

/** The impulsive exit: Δv added at periapsis (speed v_p), coasting for `duration` time units. */
export function impulsivePath(vp: number, dv: number, duration: number): Pt[] {
  const fwd = integrate(coastRhs, 0, duration, [1, 0, 0, vp + dv, 1], COAST);
  return hermite(fwd.t, fwd.y);
}
