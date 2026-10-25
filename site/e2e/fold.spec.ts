// Above the fold (author, 2026-10-21): the landing hero's figure title, the page title, the headline (once written)
// and the entry links are on screen at load, at 1440 × 900 and 390 × 844. Runs in two Playwright projects:
// - "production": the prose slots as published (only those the author has written; never a placeholder or TODO);
// - "placeholders" (SITE_PLACEHOLDERS=1): every slot filled, the unwritten ones with placeholder text (a headline of
//   about 80 characters, a two-sentence summary), the written ones with the author's text.
// In both, a shown headline must be above the fold, and a shown summary must follow the entry links. (Until 2026-10-25
// the production project asserted that no slot was shown at all; the author's published headline retired that.)
// The headline's length budget is checked in headline-budget.spec.ts (placeholder build only).
import { expect, test } from "./fixtures";
import { loadLanding } from "./landing-load";

for (const [width, height] of [[1440, 900], [390, 844]] as const) {
  test(`above the fold at ${width}×${height}: the hero's title, the page title, the headline and the entry links`, async ({ page }, info) => {
    await loadLanding(page, width, height);
    const filled = info.project.name === "placeholders";
    const headline = page.locator(".slot-headline"), summary = page.locator(".slot-summary");
    if (filled) {
      await expect(headline, "every slot is filled in the placeholder build").toHaveCount(1);
      await expect(summary).toHaveCount(1);
      if (await headline.evaluate((e) => e.classList.contains("slot-placeholder"))) {
        const text = (await headline.textContent())!.trim();
        expect(text.length, "the placeholder headline is about 80 characters").toBeGreaterThanOrEqual(75);
        expect(text.length).toBeLessThanOrEqual(90);
      }
      if (await summary.evaluate((e) => e.classList.contains("slot-placeholder")))
        expect((await summary.textContent())!.trim().split(/(?<=\.)\s+/).length, "two sentences").toBe(2);
    } else {
      // Production shows only what the author has written: no placeholder, no TODO notes.
      await expect(page.locator("[data-slot].slot-placeholder, [data-slot][data-todo]")).toHaveCount(0);
    }
    // The summary follows the entry links (author, 2026-10-21), wherever it is shown.
    if (await summary.count()) {
      const [links, s] = await Promise.all([".entry-links", ".slot-summary"].map((q) => page.locator(q).boundingBox()));
      expect(s!.y).toBeGreaterThan(links!.y);
    }
    const shown = (await headline.count()) > 0;
    let lowest = 0;
    for (const sel of ["#hero-figure-title", "#landing-title", ".entry-links a", ...(shown ? [".slot-headline"] : [])]) {
      const boxes = await page.locator(sel).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
      expect(boxes.length, sel).toBeGreaterThan(0);
      for (const box of boxes) {
        expect(box.bottom, `${sel} bottom at ${width}×${height}`).toBeLessThanOrEqual(height);
        expect(box.top, sel).toBeGreaterThanOrEqual(0);
        lowest = Math.max(lowest, box.bottom);
      }
    }
    console.log(`above the fold at ${width}×${height} (${info.project.name}${shown ? ", headline shown" : ""}): the lowest of them ends at ${Math.round(lowest)} px`);
  });
}
