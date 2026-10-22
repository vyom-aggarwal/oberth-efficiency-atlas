// Above the fold (author, 2026-10-21): the landing hero's figure title, the page title, the headline (once written)
// and the entry links are on screen at load, at 1440 × 900 and 390 × 844. Runs in two Playwright projects:
// - "production": every prose slot empty, as deployed while the author writes;
// - "placeholders" (SITE_PLACEHOLDERS=1): a headline of about 80 characters and a two-sentence summary.
// The headline's length budget is checked in headline-budget.spec.ts (placeholder build only).
import { expect, test } from "./fixtures";
import { loadLanding } from "./landing-load";

for (const [width, height] of [[1440, 900], [390, 844]] as const) {
  test(`above the fold at ${width}×${height}: the hero's title, the page title, the headline and the entry links`, async ({ page }, info) => {
    await loadLanding(page, width, height);
    const filled = info.project.name === "placeholders";
    if (filled) {
      const headline = (await page.locator(".slot-headline").textContent())!.trim();
      expect(headline.length, "the placeholder headline is about 80 characters").toBeGreaterThanOrEqual(75);
      expect(headline.length).toBeLessThanOrEqual(90);
      expect((await page.locator(".slot-summary").textContent())!.trim().split(/(?<=\.)\s+/).length, "two sentences").toBe(2);
      // The summary follows the entry links (author, 2026-10-21).
      const [links, summary] = await Promise.all([".entry-links", ".slot-summary"].map((s) => page.locator(s).boundingBox()));
      expect(summary!.y).toBeGreaterThan(links!.y);
    } else {
      await expect(page.locator("[data-slot]")).toHaveCount(0);                     // the slots are empty here
    }
    let lowest = 0;
    for (const sel of ["#hero-figure-title", "#landing-title", ".entry-links a", ...(filled ? [".slot-headline"] : [])]) {
      const boxes = await page.locator(sel).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
      expect(boxes.length, sel).toBeGreaterThan(0);
      for (const box of boxes) {
        expect(box.bottom, `${sel} bottom at ${width}×${height}`).toBeLessThanOrEqual(height);
        expect(box.top, sel).toBeGreaterThanOrEqual(0);
        lowest = Math.max(lowest, box.bottom);
      }
    }
    console.log(`above the fold at ${width}×${height} (${info.project.name}): the lowest of them ends at ${Math.round(lowest)} px`);
  });
}
