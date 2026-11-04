// Above the fold (author, 2026-10-21; Phase 9's brief: "the published headline must stay above the fold at 1440×900 and
// 390×844"). The Phase 9 hero has no entry-link row: the way into the site is the header's navigation (the inline links
// from 900 px, the menu pill below) and the "Findings" cue. So at load, at 1440 × 900 and 390 × 844:
// - the headline (once shown) and the way in are on screen: at 1440 the header's links, the title line and the cue; at
//   390 the menu pill (the headline comes first there, above the dive);
// - at 1440 the headline overlaps neither the dive nor the title line.
// Runs in two Playwright projects:
// - "production": the prose slots as published (only those the author has written; never a placeholder or TODO);
// - "placeholders" (SITE_PLACEHOLDERS=1): every slot filled, the unwritten ones with placeholder text (a headline of
//   about 80 characters), the written ones with the author's text.
// The headline's length budget is checked in headline-budget.spec.ts (placeholder build only).
import { expect, test } from "./fixtures";
import { loadLanding } from "./landing-load";

// Laptop viewports after browser chrome (author, 2026-11-04): 1366 × 650 and 1280 × 720 must keep the headline and the
// header's links fully above the fold; the Findings cue and the title line may fall below there.
const LAPTOP = new Set(["1366×650", "1280×720"]);
for (const [width, height] of [[1440, 900], [1366, 650], [1280, 720], [390, 844]] as const) {
  test(`above the fold at ${width}×${height}: the headline and the way into the site`, async ({ page }, info) => {
    await loadLanding(page, width, height);
    const filled = info.project.name === "placeholders";
    const headline = page.locator(".slot-headline");
    if (filled) {
      await expect(headline, "every slot is filled in the placeholder build").toHaveCount(1);
      if (await headline.evaluate((e) => e.classList.contains("slot-placeholder"))) {
        const text = (await headline.textContent())!.trim();
        expect(text.length, "the placeholder headline is about 80 characters").toBeGreaterThanOrEqual(75);
        expect(text.length).toBeLessThanOrEqual(90);
      }
    } else {
      // Production shows only what the author has written: no placeholder, no TODO notes.
      await expect(page.locator("[data-slot].slot-placeholder, [data-slot][data-todo]")).toHaveCount(0);
    }
    const shown = (await headline.count()) > 0;
    const wide = width >= 900, laptop = LAPTOP.has(`${width}×${height}`);
    const parts = [...(shown ? [".slot-headline"] : []),
      ...(laptop ? [".site-nav a"] : wide ? [".site-nav a", ".band-title", ".band-cue"] : [".menu-pill"])];
    let lowest = 0;
    for (const sel of parts) {
      const boxes = await page.locator(sel).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
      expect(boxes.length, sel).toBeGreaterThan(0);
      for (const box of boxes) {
        expect(box.bottom, `${sel} bottom at ${width}×${height}`).toBeLessThanOrEqual(height);
        expect(box.top, sel).toBeGreaterThanOrEqual(0);
        lowest = Math.max(lowest, box.bottom);
      }
    }
    if (wide && shown) {
      const [h, dive, title] = await Promise.all([".slot-headline", "#landing-hero", ".band-title .line"].map((q) => page.locator(q).first().boundingBox()));
      const apart = (a: typeof h, b: typeof h) => a!.x + a!.width <= b!.x || b!.x + b!.width <= a!.x || a!.y + a!.height <= b!.y || b!.y + b!.height <= a!.y;
      expect(apart(h, dive), "the headline clear of the dive").toBe(true);
      expect(apart(h, title), "the headline clear of the title line").toBe(true);
    }
    const lowHead = shown ? (await headline.boundingBox())!.y + (await headline.boundingBox())!.height : 0;
    console.log(`above the fold at ${width}×${height} (${info.project.name}${shown ? ", headline shown" : ""}): the lowest checked part ends at ` +
      `${Math.round(lowest)} px (margin ${Math.round(height - lowest)} px); the headline at ${Math.round(lowHead)} px (margin ${Math.round(height - lowHead)} px)`);
  });
}
