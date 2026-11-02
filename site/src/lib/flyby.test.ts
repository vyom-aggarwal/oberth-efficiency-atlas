import { describe, expect, test } from "vitest";
import { ECC, flybyPoint, meanAnomaly, NU_BURN, NU_MAX, nuAt, pathAnomalies, progress, radius, STAGES, stageMark } from "./flyby";

// The author's check (2026-11-02): the preloader's stage labels sit at physically correct points on the drawn path,
// with Ignition before Periapsis on a centred burn.
const nu = (name: string) => STAGES.find((st) => st.name === name)!.nu;

describe("the preloader's flyby", () => {
  test("the stages, in the order the flight meets them", () => {
    expect(STAGES.map((st) => st.name)).toEqual(["Approach", "Ignition", "Periapsis", "Cutoff", "Escape"]);
    for (let i = 1; i < STAGES.length; i++) {
      expect(STAGES[i].nu).toBeGreaterThan(STAGES[i - 1].nu);
      expect(progress(STAGES[i].nu)).toBeGreaterThan(progress(STAGES[i - 1].nu));
    }
    expect(nu("Ignition")).toBeLessThan(nu("Periapsis"));
    expect(Math.abs(nu("Approach"))).toBeLessThan(NU_MAX);
    expect(Math.abs(nu("Escape"))).toBeLessThan(NU_MAX);
  });

  test("the burn is centred: Ignition and Cutoff are the burn arc's ends, equal Kepler times either side of periapsis", () => {
    expect(nu("Ignition")).toBe(-NU_BURN);
    expect(nu("Cutoff")).toBe(NU_BURN);
    expect(meanAnomaly(nu("Periapsis"))).toBe(0);
    expect(meanAnomaly(nu("Ignition"))).toBeLessThan(0);
    expect(meanAnomaly(nu("Ignition")) + meanAnomaly(nu("Cutoff"))).toBeCloseTo(0, 12);
    expect(progress(nu("Periapsis"))).toBeCloseTo(0.5, 12);
    expect(progress(nu("Ignition")) + progress(nu("Cutoff"))).toBeCloseTo(1, 12);
  });

  test("Periapsis is the path's closest point to the Sun, at r = r_p", () => {
    const rho = (p: [number, number]) => Math.hypot(p[0], p[1]);
    const nus = pathAnomalies();
    const closest = nus.reduce((best, v) => (rho(flybyPoint(v)) < rho(flybyPoint(best)) ? v : best));
    expect(closest).toBe(nu("Periapsis"));
    expect(radius(nu("Periapsis"))).toBe(1);
    expect(rho(flybyPoint(nu("Periapsis")))).toBe(1);
    // Every other stage is farther out, symmetric pairs equally far (a conic is symmetric about its apse line).
    expect(radius(nu("Ignition"))).toBeGreaterThan(1);
    expect(radius(nu("Ignition"))).toBeCloseTo(radius(nu("Cutoff")), 12);
    expect(radius(nu("Approach"))).toBeCloseTo(radius(nu("Escape")), 12);
  });

  test("each stage's mark is a vertex of the drawn path, at its true anomaly on the conic", () => {
    const nus = pathAnomalies();
    for (const st of STAGES) {
      expect(nus).toContain(st.nu);
      const { p } = stageMark(st.nu);
      const r = (1 + ECC) / (1 + ECC * Math.cos(st.nu));       // the conic, independently of flyby.ts
      const rho = 1 + Math.log10(r);
      expect(p[0]).toBeCloseTo(-rho * Math.cos(st.nu), 12);
      expect(p[1]).toBeCloseTo(rho * Math.sin(st.nu), 12);
    }
  });

  test("the incoming leg (Approach, Ignition) is drawn above the apse line, the outgoing (Cutoff, Escape) below", () => {
    for (const name of ["Approach", "Ignition"]) expect(flybyPoint(nu(name))[1]).toBeLessThan(0);
    for (const name of ["Cutoff", "Escape"]) expect(flybyPoint(nu(name))[1]).toBeGreaterThan(0);
  });

  test("the dot reaches each stage in order: nuAt inverts progress", () => {
    for (const st of STAGES) expect(nuAt(progress(st.nu))).toBeCloseTo(st.nu, 9);
    expect(nuAt(0)).toBe(-NU_MAX);
    expect(nuAt(1)).toBe(NU_MAX);
    expect(nuAt(progress(nu("Ignition")) - 1e-6)).toBeLessThan(nu("Ignition"));
  });

  test("each name sits off the path along the normal, on the convex side", () => {
    for (const st of STAGES) {
      const { p, n } = stageMark(st.nu), a = flybyPoint(st.nu - 0.01), b = flybyPoint(st.nu + 0.01);
      expect(Math.hypot(n[0], n[1])).toBeCloseTo(1, 12);
      expect(Math.abs(n[0] * (b[0] - a[0]) + n[1] * (b[1] - a[1])) / Math.hypot(b[0] - a[0], b[1] - a[1])).toBeLessThan(1e-3);
      expect(n[0] * (a[0] + b[0] - 2 * p[0]) + n[1] * (a[1] + b[1] - 2 * p[1])).toBeLessThan(0);
    }
  });
});
