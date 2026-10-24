import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { classic, css, OUT, runChecks, themes } from "../../tools/palette.mjs";

// The site palette is the classic explorer's (Phase 8, docs/restyle_plan.md), checked by tools/palette.mjs.
describe("site palette", () => {
  test("every check passes: contrast, ramps, the a·v faint end, colour-vision distinctness", () => {
    expect(runChecks()).toEqual([]);
  });
  test("palette.css is generated from the definitions (run `npm run palette` after a change)", () => {
    expect(readFileSync(OUT, "utf8").replace(/\r\n/g, "\n")).toBe(css());
  });
  test("the tokens are the classic explorer's, read from explorer/app.css", () => {
    const c = classic(), t = themes();
    expect(t.light.bg).toBe("#fcfcfb");
    expect(t.dark.panel).toBe("#1b1b19");
    for (const mode of ["light", "dark"] as const) {
      for (const [k, v] of Object.entries(c[mode])) expect(t[mode][k as keyof (typeof t)["light"]]).toBe(v);
    }
  });
  test("links: ramp-4 in light (the accent is short of 4.5:1 for text), the accent in dark", () => {
    const t = themes();
    expect(t.light.link).toBe(t.light["ramp-4"]);
    expect(t.dark.link).toBe(t.dark.accent);
  });
});
