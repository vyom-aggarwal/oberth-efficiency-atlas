// The explorer's state, kept in the URL query so a case can be shared: ?Pi=…&v=…&dv=…&c=…&s=prograde&preset=…
// Pi = Π, v = v∞/v_esc, dv = Δv/v_p, c = Δv/c (the four nondimensional targets of fromTargets), s = steering.

export type Steering = "prograde" | "inertial";
export interface ExplorerState { Pi: number; v: number; dv: number; c: number; steering: Steering; preset: string }

/** Accepted ranges (the sliders' ranges; v∞/v_esc may be 0, a parabolic arrival). */
export const RANGES: Record<"Pi" | "v" | "dv" | "c", [number, number]> = {
  Pi: [1e-3, 1e5], v: [0, 10], dv: [1e-3, 1], c: [1e-2, 3],   // Π to 10⁵: electric presets reach 1.6 × 10⁴
};
const PRESET = /^(none|hibberd|[a-z]+\.[a-z_]+)$/;

/** Read a query string; anything missing, malformed or out of range keeps the fallback's value (ranges clamp). */
export function parseState(search: string, fallback: ExplorerState): ExplorerState {
  const q = new URLSearchParams(search);
  const num = (key: keyof typeof RANGES): number => {
    const raw = q.get(key);
    if (raw === null || raw.trim() === "") return fallback[key];
    const v = Number(raw);
    if (!Number.isFinite(v)) return fallback[key];
    const [lo, hi] = RANGES[key];
    return Math.min(hi, Math.max(lo, v));
  };
  const s = q.get("s");
  const preset = q.get("preset");
  return {
    Pi: num("Pi"), v: num("v"), dv: num("dv"), c: num("c"),
    steering: s === "prograde" || s === "inertial" ? s : fallback.steering,
    preset: preset !== null && PRESET.test(preset) ? preset : fallback.preset,
  };
}

/** Six significant figures: enough to reproduce a case, short enough to share. */
const short = (v: number) => String(Number(v.toPrecision(6)));

export function serializeState(st: ExplorerState): string {
  const q = new URLSearchParams({ Pi: short(st.Pi), v: short(st.v), dv: short(st.dv), c: short(st.c), s: st.steering });
  if (st.preset !== "none") q.set("preset", st.preset);
  return q.toString();
}
