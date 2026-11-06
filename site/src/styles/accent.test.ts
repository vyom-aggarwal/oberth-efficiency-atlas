import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// The author's rule (2026-11-01; docs/revamp_plan.md §2.1): the accent never appears inside a plot area, legend or colour
// scale. Its closest data blue is η step 3 at ΔE 8.3 (2.5 under colour-vision deficiency), so a plot that used it
// could be misread as data. Phase 9 pass 4: no chart module and no chart stylesheet may read --signal or --accent
// (by var() or cssVar()). Controls and focus rings may; they are not plots. The explorer's modules joined in pass 5,
// when its case dot (chart.css) became Ink.
const read = (dir: URL) => readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => ({ file: `${dir.pathname.split("/src/")[1]}${f}`, text: readFileSync(new URL(f, dir), "utf8") }));
const CHARTS = [...read(new URL("../charts/", import.meta.url)), ...read(new URL("../explorer/", import.meta.url))];
const STYLES = ["chart.css"].map((f) => ({ file: `styles/${f}`, text: readFileSync(new URL(f, import.meta.url), "utf8") }));
const ACCENT = /--(?:signal|accent)\b/;

describe("the accent stays out of plots", () => {
  test("the scan sees the chart modules and their stylesheet", () => {
    expect(CHARTS.map((c) => c.file)).toEqual(expect.arrayContaining(["charts/universal-curve.ts", "charts/atlas.ts", "charts/landing-hero.ts",
      "explorer/placement.ts", "explorer/view.ts"]));
    expect(STYLES[0].text).toContain(".case-dot .case-mark { fill: var(--ink);");          // the reader's case, Ink
    expect(STYLES[0].text).toMatch(/\.legend/);
  });
  test("no chart module or chart stylesheet reads --signal or --accent", () => {
    const offenders = [...CHARTS, ...STYLES].flatMap(({ file, text }) =>
      text.split("\n").flatMap((line, i) => (ACCENT.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [])));
    expect(offenders).toEqual([]);
  });
});
