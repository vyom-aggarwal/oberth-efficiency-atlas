import { describe, expect, test } from "vitest";
import { parseState, RANGES, serializeState, type ExplorerState } from "./state";

const base: ExplorerState = { Pi: 1, v: 0.1, dv: 0.03, c: 0.3, steering: "prograde", preset: "none" };

describe("explorer URL state", () => {
  test("round trip: serialize then parse gives the state back (to six significant figures)", () => {
    const st: ExplorerState = { Pi: 0.0326485007, v: 0, dv: 0.0242178, c: 2.98361, steering: "inertial", preset: "hibberd" };
    const back = parseState(`?${serializeState(st)}`, base);
    expect(back.steering).toBe("inertial");
    expect(back.preset).toBe("hibberd");
    expect(back.v).toBe(0);
    for (const k of ["Pi", "dv", "c"] as const) expect(back[k] / st[k]).toBeCloseTo(1, 5);
  });
  test("a preset of none is left out of the URL, and a URL with the case but no preset reads back as none", () => {
    expect(serializeState(base)).toBe("Pi=1&v=0.1&dv=0.03&c=0.3&s=prograde");
    const withPreset = { ...base, preset: "hibberd" };
    expect(parseState(`?${serializeState(base)}`, withPreset).preset).toBe("none");
    expect(parseState("", withPreset).preset).toBe("hibberd");                  // an empty query keeps the default
  });
  test("missing or malformed values keep the fallback", () => {
    expect(parseState("", base)).toEqual(base);
    expect(parseState("?Pi=abc&v=&s=sideways&preset=../x", base)).toEqual(base);
  });
  test("out-of-range values clamp to the accepted range", () => {
    const st = parseState("?Pi=1e9&v=-1&dv=5&c=0", base);
    expect(st.Pi).toBe(RANGES.Pi[1]);
    expect(st.v).toBe(RANGES.v[0]);
    expect(st.dv).toBe(RANGES.dv[1]);
    expect(st.c).toBe(RANGES.c[0]);
  });
  test("body × engine preset ids are accepted", () => {
    expect(parseState("?preset=earth.nuclear_thermal", base).preset).toBe("earth.nuclear_thermal");
  });
});
