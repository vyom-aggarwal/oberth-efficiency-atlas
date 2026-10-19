// Explorer presets: body × engine cases from presets.json (configs/atlas/presets.yaml envelopes; constants.py
// bodies) and Hibberd et al.'s dive from hero.json. A preset fills the four nondimensional inputs and keeps its
// body's scales, for SI readouts and the sphere-of-influence check. Each value is the geometric middle of its
// envelope (RESEARCH_LOG 2026-10-18, checkpoint 5 design).

export interface Body { name: string; gm: number; radius: number; soi: number | null; rp_over_R: number[] | null;
  altitude_km: number[] | null; v_inf_km_s: number[] }
export interface Engine { label: string; isp_s: number[]; a0_m_s2: number[]; note?: string }
export interface PresetsData { bodies: Record<string, Body>; engines: Record<string, Engine>; g0: number; dv_km_s: number[] }
export interface HeroCase {
  geometry: { r_p_over_R_sun: { value: number }; arrival_sensitivity_m_s: { parabolic: { value: number }; reference: { value: number } } };
  reference: { Pi: { value: number } };
  units: { V_m_s: number; time_s: number };
  nd: { v_inf: number; dv: number; c: number };
}

/** The body's scales for one preset (SI). */
export interface Scales { body: string; name: string; r_p: number; R: number; V: number; soi: number | null }
export interface Preset {
  id: string; label: string; group: string;
  inputs: { Pi: number; v: number; dv: number; c: number };
  scales: Scales;
  note?: string;
}

export const BODY_ORDER = ["sun", "venus", "earth", "mars", "jupiter", "saturn"];
export const ENGINE_ORDER = ["solid", "hydrolox", "methalox_vac", "nuclear_thermal", "hall", "gridded_ion"];
const mid = (r: number[]) => Math.sqrt(r[0] * r[r.length - 1]);

export function buildPresets(p: PresetsData, hero: HeroCase): Preset[] {
  const out: Preset[] = [];
  // Hibberd et al.'s dive: the hero's case (one equivalent stage, parabolic arrival).
  const sun = p.bodies.sun;
  const vpH = Math.sqrt(hero.nd.v_inf ** 2 + 2);
  out.push({
    id: "hibberd", group: "Published case", label: "Hibberd et al.'s solar dive (approximated)",
    inputs: { Pi: hero.reference.Pi.value, v: hero.nd.v_inf / Math.SQRT2, dv: hero.nd.dv / vpH, c: hero.nd.dv / hero.nd.c },
    scales: { body: "sun", name: "Sun", r_p: hero.geometry.r_p_over_R_sun.value * sun.radius, R: sun.radius, V: hero.units.V_m_s, soi: null },
    note: `Approximated as a parabolic arrival with one equivalent stage; changing the arrival orbit moves Phase 4's loss from ` +
      `${hero.geometry.arrival_sensitivity_m_s.reference.value.toPrecision(3)} to ${hero.geometry.arrival_sensitivity_m_s.parabolic.value.toPrecision(3)} m/s.`,
  });
  for (const b of BODY_ORDER) {
    const B = p.bodies[b];
    if (!B) continue;
    const r_p = B.rp_over_R ? mid(B.rp_over_R) * B.radius : B.radius + 1e3 * mid(B.altitude_km!);
    const V = Math.sqrt(B.gm / r_p);
    const vInf = 1e3 * mid(B.v_inf_km_s);
    const vp = Math.sqrt(vInf ** 2 + 2 * V * V);
    const dv = 1e3 * mid(p.dv_km_s);
    for (const e of ENGINE_ORDER) {
      const E = p.engines[e];
      if (!E) continue;
      const c = mid(E.isp_s) * p.g0, a0 = mid(E.a0_m_s2);
      const tb = (c / a0) * -Math.expm1(-dv / c);
      out.push({
        id: `${b}.${e}`, group: B.name, label: `${B.name}, ${E.label}`,
        inputs: { Pi: (tb * vp) / r_p, v: vInf / (Math.SQRT2 * V), dv: dv / vp, c: dv / c },
        scales: { body: b, name: B.name, r_p, R: B.radius, V, soi: B.soi },
      });
    }
  }
  return out;
}
