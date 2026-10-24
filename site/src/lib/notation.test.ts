import { describe, expect, test } from "vitest";
import { hasNotation, parts, plain } from "./notation";

describe("notation: typeset indices, never an underscore", () => {
  test("every index in a string, sub and super, braced or not", () => {
    expect(parts("τ = r_p/v_p = 1.79 h")).toEqual([
      { text: "τ = r" }, { text: "p", index: "sub" }, { text: "/v" }, { text: "p", index: "sub" }, { text: " = 1.79 h" }]);
    expect(parts("thrust ∝ r^−1.5, placed at Π_eff")).toEqual([
      { text: "thrust ∝ r" }, { text: "−1.5", index: "sup" }, { text: ", placed at Π" }, { text: "eff", index: "sub" }]);
    expect(parts("η_{W} median")).toEqual([{ text: "η" }, { text: "W", index: "sub" }, { text: " median" }]);
  });
  test("only a lone letter takes an index: file and code names are left alone", () => {
    for (const t of ["anim_numbers.json", "scripts/export_site_data.py", "j2_numbers.json", "r_burn_start", "a0 = 3.3e-3"])
      expect(parts(t).some((p) => p.index), t).toBe(false);
    expect(hasNotation("r_burn_start")).toBe(false);
    expect(hasNotation("v∞/v_esc")).toBe(true);
    expect(hasNotation("v∞/v_esc")).toBe(true);                     // the test regex keeps no state between calls
  });
  test("file names in running text become code", () => {
    expect(parts("prograde, Δv/v_p < 0.03 (scripts/fig_regimes.py)")).toEqual([
      { text: "prograde, Δv/v" }, { text: "p", index: "sub" }, { text: " < 0.03 (" },
      { text: "scripts/fig_regimes.py", code: true }, { text: ")" }]);
    expect(hasNotation("Data: anim_numbers.json")).toBe(true);
    expect(hasNotation("3.51 min, et al. 1.0")).toBe(false);
  });
  test("plain text: Unicode indices where every character has one, else the index after a space", () => {
    expect(plain("τ = r_p/v_p")).toBe("τ = rₚ/vₚ");
    expect(plain("η over Π and v∞/v_esc")).toBe("η over Π and v∞/v esc");
    expect(plain("Π_T")).toBe("Π T");
    expect(plain("r^−1.5")).toBe("r^−1.5");
    expect(plain("m/s^2")).toBe("m/s²");
  });
});
