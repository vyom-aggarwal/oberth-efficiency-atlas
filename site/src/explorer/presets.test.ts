// Presets from the exported data: the Hibberd preset reproduces the hero's case, and a body × engine preset follows
// the definitions (Π = t_b v_p / r_p with t_b from the rocket equation).
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { buildPresets } from "./presets";

const load = (f: string) => JSON.parse(readFileSync(new URL(`../../public/data/${f}`, import.meta.url), "utf8"));
const presets = buildPresets(load("presets.json"), load("hero.json"));

describe("explorer presets", () => {
  test("Hibberd et al.'s dive: the hero's Π, a parabolic arrival, and V from r_p = 3.2 R☉", () => {
    const hero = load("hero.json"), p = load("presets.json");
    const h = presets.find((x) => x.id === "hibberd")!;
    expect(h.inputs.Pi).toBe(hero.reference.Pi.value);
    expect(h.inputs.v).toBe(0);
    expect(h.scales.V / Math.sqrt(p.bodies.sun.gm / h.scales.r_p)).toBeCloseTo(1, 9);
  });
  test("every body × engine pair is offered, with inputs inside the sliders' ranges or close to them", () => {
    expect(presets.length).toBe(1 + 6 * 6);
    for (const x of presets) {
      expect(x.inputs.Pi).toBeGreaterThan(0);
      expect(x.inputs.dv).toBeGreaterThan(0);
      expect(x.inputs.c).toBeGreaterThan(0);
      expect(x.inputs.v).toBeGreaterThanOrEqual(0);
    }
  });
  test("a body preset: Π = t_b v_p / r_p and Δv/c = Δv / (Isp g0)", () => {
    const p = load("presets.json");
    const x = presets.find((q) => q.id === "earth.hydrolox")!;
    const E = p.engines.hydrolox, c = Math.sqrt(E.isp_s[0] * E.isp_s[1]) * p.g0;
    const dv = 1e3 * Math.sqrt(p.dv_km_s[0] * p.dv_km_s[1]);
    expect(x.inputs.c).toBeCloseTo(dv / c, 12);
    const vp = dv / x.inputs.dv;
    const tb = (c / Math.sqrt(E.a0_m_s2[0] * E.a0_m_s2[1])) * -Math.expm1(-dv / c);
    expect(x.inputs.Pi).toBeCloseTo((tb * vp) / x.scales.r_p, 12);
  });
});
