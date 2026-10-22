import { describe, expect, test } from "vitest";
import { HEADLINE_BUDGET, headlineReport, PLACEHOLDERS } from "./content-plugin";

describe("the landing headline's length budget (author, 2026-10-21)", () => {
  test("the build reports a written headline over the budget, as plain text, and stays quiet otherwise", () => {
    const long = "word ".repeat(30).trim() + ".";                       // 150 characters
    expect(headlineReport(long, 100)).toMatch(/headline is 150 characters, over its budget of 100/);
    expect(headlineReport("A *short* headline with $\\Pi$.", 100)).toBeNull();
    expect(headlineReport("TODO (author). " + long, 100)).toBeNull();   // not written yet: nothing to report
  });

  test("the placeholder headline is about 80 characters and within the budget", () => {
    expect(PLACEHOLDERS.headline.length).toBeGreaterThanOrEqual(75);
    expect(PLACEHOLDERS.headline.length).toBeLessThanOrEqual(Math.min(90, HEADLINE_BUDGET));
  });
});
