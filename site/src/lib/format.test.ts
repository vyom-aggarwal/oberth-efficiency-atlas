import { describe, expect, test } from "vitest";
import { decade, duration, lossRel, pow10, sci, sig, speed, superscript } from "./format";

describe("number formatting", () => {
  test("sig: significant figures, plain between 1e-3 and 1e5, typographic minus", () => {
    expect(sig(0.0326485)).toBe("0.0326");
    expect(sig(1.673925)).toBe("1.67");
    expect(sig(368.236)).toBe("368");
    expect(sig(-0.5)).toBe("−0.500");
    expect(sig(0)).toBe("0");
    expect(sig(Number.NaN)).toBe("—");
    expect(sig(1.2e-5)).toBe("1.20 × 10⁻⁵");
  });
  test("sci and superscripts", () => {
    expect(sci(6537888.3, 2)).toBe("6.5 × 10⁶");
    expect(superscript(-12)).toBe("⁻¹²");
  });
  test("decades: plain decimals on the shared Π axis", () => {
    expect([1e-3, 1e-2, 0.1, 1, 10, 100, 1000].map(decade)).toEqual(["0.001", "0.01", "0.1", "1", "10", "100", "1000"]);
    expect(pow10(1000)).toBe("10³");
    expect(pow10(1)).toBe("1");
    expect(pow10(2)).toBe("2.00");
  });
  test("loss, duration and speed", () => {
    expect(lossRel(0.0278663)).toBe("2.79 %");
    expect(lossRel(1.185e-5)).toBe("1.19 × 10⁻⁵");
    expect(duration(210.8)).toBe("3.51 min");
    expect(duration(10807.95)).toBe("3.00 h");
    expect(duration(2377572.66)).toBe("27.5 d");
    expect(speed(244157.36)).toBe("244 km/s");
    expect(speed(0.0991)).toBe("0.0991 m/s");
  });
});
