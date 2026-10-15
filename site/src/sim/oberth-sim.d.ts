// Types for the shared simulator module (oberth-sim.js). Nondimensional units: μ = r_p = 1, V = sqrt(μ/r_p).

export const R_FLOOR: number;

export interface SimParams {
  /** Hyperbolic excess speed (0 for a parabolic arrival). */
  v_inf: number;
  dv: number;
  /** Exhaust velocity. */
  c: number;
  /** Initial thrust acceleration. */
  a0: number;
  steering?: "prograde" | "inertial";
  /** Burn midpoint relative to the unperturbed periapsis passage. */
  offset?: number;
  rtol?: number;
  atol?: number;
  maxSteps?: number;
  /** Keep the integrated path (segments). */
  record?: boolean;
  impactRadius?: number;
}

export interface Segment {
  label: "pre" | "burn" | "post";
  burn: boolean;
  /** Step times. */
  t: number[];
  /** State at each step: [x, y, vx, vy, m]. */
  y: number[][];
}

export interface SimResult {
  Pi: number;
  t_b: number;
  v_p: number;
  impacted: boolean;
  captured: boolean;
  r_min: number;
  eps_out: number;
  v_inf_out: number;
  v_inf_imp: number;
  b_imp: number;
  eta: number;
  dv_eq: number;
  loss_rel: number;
  segments?: Segment[];
}

export function simulate(p: SimParams): SimResult;
export function fromTargets(Pi: number, vOverVesc: number, dvOverVp: number, dvOverC: number): SimParams;
export function integrate(
  f: (t: number, y: number[], out: number[]) => void, t0: number, t1: number, y0: number[], opt: Record<string, unknown>,
): { t: number[]; y: number[][]; f: number[][]; yEnd: number[]; tEnd: number; impacted: boolean };
