// Smoke checks of the shared simulator on the hero's case (Hibberd et al.'s dive, one equivalent stage), read from
// the exported data. Agreement with the Python library is tested separately, to |Δη| ≤ 1e-8
// (tests/test_explorer_js.py); these checks catch a broken module or a wrong wiring of the hero's inputs.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { fromTargets, simulate } from "./oberth-sim.js";

const hero = JSON.parse(readFileSync(new URL("../../public/data/hero.json", import.meta.url), "utf8"));
const vp = Math.sqrt(hero.nd.v_inf ** 2 + 2);
const params = (Pi: number) => fromTargets(Pi, hero.nd.v_inf / Math.SQRT2, hero.nd.dv / vp, hero.nd.dv / hero.nd.c);

describe("simulator on the hero case", () => {
  const decades = [1e-3, 1e-2, 0.1, 1, 10, 100, 1000];
  const runs = decades.map((Pi) => simulate(params(Pi)));

  test("the requested Π is the simulated Π", () => {
    runs.forEach((r, i) => expect(r.Pi / decades[i]).toBeCloseTo(1, 9));
  });
  test("a short burn keeps almost all of the impulsive bonus; η falls as Π grows", () => {
    expect(runs[0].eta).toBeGreaterThan(0.99999);
    expect(runs[0].eta).toBeLessThanOrEqual(1);
    for (let i = 1; i < runs.length; i++) expect(runs[i].eta).toBeLessThan(runs[i - 1].eta);
    expect(runs.at(-1)!.eta).toBeGreaterThan(0);
  });
  test("a parabolic arrival is neither captured nor impacted", () => {
    for (const r of runs) { expect(r.captured).toBe(false); expect(r.impacted).toBe(false); }
  });
  test("recording keeps the three segments in time order", () => {
    const r = simulate({ ...params(1), record: true });
    expect(r.segments!.map((s) => s.label)).toEqual(["pre", "burn", "post"]);
    const ends = r.segments!.map((s) => [s.t[0], s.t.at(-1)!]);
    for (let i = 1; i < ends.length; i++) expect(ends[i][0]).toBeCloseTo(ends[i - 1][1], 12);
    expect(r.eta).toBe(simulate(params(1)).eta);
  });
});
