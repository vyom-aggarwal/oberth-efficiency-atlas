// The landing page's flyby preloader (Phase 9, docs/revamp_plan.md §2.6; the author's checks, 2026-11-02):
// - on the test build ("site" project): every stage's mark sits on the drawn path (in its stroke), and the marks switch
//   on in physical order, Approach, Ignition, Periapsis, Cutoff, Escape (Ignition before Periapsis: a centred burn). It
//   plays once a session, never under reduced motion or with a #fragment, and a key press ends it. src/lib/flyby.test.ts
//   checks the geometry itself.
// - on the production build ("production" project): it is gone by 2.0 s from navigation start. Enforced locally;
//   report-only in CI (PRELOADER_CAP=report), as the hero frame time is, with the numbers in the job summary.
import { appendFileSync } from "node:fs";
import { expect, test, type Page } from "./fixtures";

test.use({ preloader: true });
const CAP_MS = 2000;
const STAGES = ["Approach", "Ignition", "Periapsis", "Cutoff", "Escape"];

/** Watch the page from its first instant: when the preloader shows and goes, and when each stage first switches on (all
 *  in page time, from navigation start). */
async function watch(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as any;
    w.__pre = { shown: false, gone: null as number | null, stages: [] as { name: string; t: number }[] };
    new MutationObserver((records) => {
      for (const m of records) {
        const el = m.target as Element;
        if (el === document.documentElement) {
          const on = el.classList.contains("preloading");
          if (on) w.__pre.shown = true;
          else if (w.__pre.shown && w.__pre.gone === null) w.__pre.gone = performance.now();
        } else if (el.matches?.(".flyby g.stage.on")) {
          const name = (el as SVGGElement).dataset.stage!;
          if (!w.__pre.stages.some((s: { name: string }) => s.name === name)) w.__pre.stages.push({ name, t: performance.now() });
        }
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] });
  });
}
const result = (page: Page) => page.evaluate(() => (window as any).__pre as { shown: boolean; gone: number | null; stages: { name: string; t: number }[] });

test("every stage's mark is on the drawn path, and the marks switch on in physical order", async ({ page }, info) => {
  test.skip(info.project.name !== "site", "the test build");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await watch(page);
  await page.goto("", { waitUntil: "commit" });
  await page.waitForSelector(".flyby g.stage", { state: "attached" });
  const onPath = await page.evaluate(() => {
    const full = document.querySelector<SVGPathElement>(".flyby path.full")!;
    return [...document.querySelectorAll<SVGGElement>(".flyby g.stage")].map((g) => {
      const c = g.querySelector("circle")!;
      return [g.dataset.stage, full.isPointInStroke(new DOMPoint(Number(c.getAttribute("cx")), Number(c.getAttribute("cy"))))];
    });
  });
  expect(onPath).toEqual(STAGES.map((n) => [n, true]));
  await page.waitForFunction(() => (window as any).__pre.gone !== null, null, { timeout: 5000 });
  const r = await result(page);
  expect(r.stages.map((s) => s.name), "the order the marks switch on").toEqual(STAGES);
  // Never earlier than the stage before. Two may share a frame when a slow machine drops frames (Ignition and Periapsis
  // did once, under the full suite); src/lib/flyby.test.ts proves the strict order of their times.
  for (let i = 1; i < r.stages.length; i++) expect(r.stages[i].t, `${r.stages[i].name} not before ${r.stages[i - 1].name}`).toBeGreaterThanOrEqual(r.stages[i - 1].t);
  // The burn arc is drawn heavier, from Ignition to Cutoff.
  await expect(page.locator(".flyby path.burn")).toHaveAttribute("d", /^M/);
});

test("it plays once a session, never under reduced motion or with a #fragment, and a key ends it", async ({ page }, info) => {
  test.skip(info.project.name !== "site", "the test build");
  await page.setViewportSize({ width: 1440, height: 900 });
  await watch(page);
  // A key press ends it at once.
  await page.goto("", { waitUntil: "commit" });
  await page.waitForFunction(() => document.documentElement.dataset.preloader === "running");
  await page.keyboard.press("Shift");
  await page.waitForFunction(() => !document.documentElement.classList.contains("preloading"), null, { timeout: 1000 });
  expect(await page.evaluate(() => document.documentElement.dataset.preloader)).toBe("skipped");
  // The same session: not again.
  await page.reload();
  await page.waitForLoadState("load");
  expect((await result(page)).shown, "a second load in the session").toBe(false);
  // A fresh session (storage cleared) arriving with a #fragment, then one under reduced motion: not at all.
  await page.goto("references/");
  await page.evaluate(() => sessionStorage.clear());
  await page.goto("#findings");
  await page.waitForLoadState("load");
  expect((await result(page)).shown, "with a #fragment").toBe(false);
  await page.evaluate(() => sessionStorage.clear());
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("");
  await page.waitForLoadState("load");
  expect((await result(page)).shown, "under reduced motion").toBe(false);
  expect(await page.evaluate(() => sessionStorage.getItem("oberth-preloaded")), "nor is it marked as seen").toBeNull();
});

test("on the production build it is gone by 2.0 s from navigation start", async ({ page }, info) => {
  test.skip(info.project.name !== "production", "the production build");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await watch(page);
  const runs: number[] = [];
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    if (runs.length) await page.evaluate(() => sessionStorage.clear());      // a fresh session for each size
    await page.goto("");
    await page.waitForFunction(() => (window as any).__pre.gone !== null || performance.now() > 4000, null, { timeout: 8000 });
    const r = await result(page);
    expect(r.shown, `the preloader played at ${width} px`).toBe(true);
    runs.push(Math.round(r.gone ?? Infinity));
  }
  const worst = Math.max(...runs);
  console.log(`preloader gone at ${runs.join(" and ")} ms from navigation start (1440, 390); the cap is ${CAP_MS} ms`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, "## Landing preloader, production build\n\n" +
      `Gone at ${runs.join(" ms and ")} ms from navigation start (1440 × 900, 390 × 844); the cap is ${CAP_MS} ms` +
      `${process.env.PRELOADER_CAP === "report" ? " (report only in CI)" : ""}.\n\n`);
  }
  if (process.env.PRELOADER_CAP !== "report") expect(worst, "gone by 2.0 s from navigation start").toBeLessThanOrEqual(CAP_MS);
});
