import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { classic, contrast, css, deltaE, nearestAccent, OUT, palette, REFERENCE_ACCENT, runChecks } from "../../tools/palette.mjs";

// The site palette (Phase 9, docs/revamp_plan.md §2.1–2.2): six interface colours and the classic explorer's dark data
// steps, dark only, checked by tools/palette.mjs.
describe("site palette", () => {
  test("every check passes: contrast, the accent's jobs, ramps, the a·v faint end, colour-vision distinctness", () => {
    expect(runChecks()).toEqual([]);
  });
  test("palette.css is generated from the definitions (run `npm run palette` after a change), dark only", () => {
    const text = readFileSync(OUT, "utf8").replace(/\r\n/g, "\n");
    expect(text).toBe(css());
    expect(text).toContain("color-scheme: dark;");
    expect(text).not.toMatch(/light|data-theme|prefers-color-scheme/);
  });
  test("the data colours are the classic explorer's dark steps, read from explorer/app.css", () => {
    const c = classic(), p = palette();
    for (const [k, v] of Object.entries(c)) expect(p[k]).toBe(v);
    expect(p.ramp).toEqual([0, 1, 2, 3, 4, 5, 6].map((k) => c[`ramp-${k}`]));
    expect(p.av[0]).toBe(c["ramp-2"]);
    expect(p.av[6]).toBe(c["ramp-6"]);
  });
  test("the accent: the reference's indigo fails an Ink label, so Signal is its nearest passing variant (author decision 1)", () => {
    expect(contrast("#ecebe7", REFERENCE_ACCENT)).toBeLessThan(4.5);
    expect(nearestAccent()).toBe("#445be8");
    expect(palette().signal).toBe("#445be8");
    expect(deltaE(palette().signal, REFERENCE_ACCENT)).toBeLessThan(0.5);
  });
});
