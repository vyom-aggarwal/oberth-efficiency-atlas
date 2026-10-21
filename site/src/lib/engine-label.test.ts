import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { engineLabel } from "./engine-label";

// The three case titles as exported (site/public/data/engines.json), so a change in the data shows up here.
const titles: string[] = JSON.parse(readFileSync(new URL("../../public/data/engines.json", import.meta.url), "utf-8"))
  .cases.map((c: { title: { value: string } }) => c.title.value);

describe("engine labels from the case titles", () => {
  test("short names: the first word, starred only for the caveat", () => {
    expect(titles.map((t) => engineLabel(t).short)).toEqual(["Solid", "Nuclear", "SEP*"]);
  });

  test("the caveat and its starred note come from the same string; an identifying note is not a caveat", () => {
    const [solid, nuclear, sep] = titles.map(engineLabel);
    expect(sep.note).toBe("(hypothetical at 3.2 R☉)");
    expect(sep.caveat).toBe("hypothetical at 3.2 R☉");
    expect(sep.starNote).toBe("* hypothetical at 3.2 R☉");
    expect(solid.note).toBe("(Hibberd et al. 2026 reference)");
    expect([solid.caveat, solid.starNote, nuclear.note, nuclear.caveat]).toEqual(["", "", "", ""]);
  });

  test("name and details split at the first colon", () => {
    expect(engineLabel("Nuclear thermal: Isp 900 s, a0 = 0.5 m/s²")).toMatchObject(
      { head: "Nuclear thermal: Isp 900 s, a0 = 0.5 m/s²", name: "Nuclear thermal", details: "Isp 900 s, a0 = 0.5 m/s²" });
  });
});
