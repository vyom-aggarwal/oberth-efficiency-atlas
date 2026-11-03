// The landing headline's length budget (author, 2026-10-21; re-measured for the Phase 9 hero), on the placeholder build
// (Playwright project "placeholders"), where the headline slot exists: lengthen the headline a word at a time and record
// the longest that still fits, at 1440 × 900 and 390 × 844. It fits while it stays above the fold, and at 1440 (where it
// sits beside the dive) while it also stays clear of the dive and of the title line below it (fold.spec.ts checks the
// same at load). The build's HEADLINE_BUDGET (plugins/content-plugin.ts; the build reports a written headline over it)
// must not exceed that.
import { HEADLINE_BUDGET, PLACEHOLDERS } from "../plugins/content-plugin";
import { expect, test } from "./fixtures";
import { loadLanding } from "./landing-load";

const LOREM = "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua " +
  "Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat";
const WORDS = `${LOREM} ${LOREM} ${LOREM} ${LOREM}`.split(" ");

for (const [width, height] of [[1440, 900], [390, 844]] as const) {
  test(`the headline budget at ${width}×${height} is within the longest headline that fits the hero`, async ({ page }) => {
    await loadLanding(page, width, height);
    const longest = await page.evaluate(({ words, wide }) => {
      const p = document.querySelector<HTMLElement>(".slot-headline p")!;
      const dive = document.getElementById("landing-hero")!, title = document.querySelector(".band-title .line")!;
      const clear = (a: DOMRect, b: DOMRect) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
      let best = 0;
      for (let n = 1; n <= words.length; n++) {
        const text = `${words.slice(0, n).join(" ")}.`;
        p.textContent = text;
        const r = p.getBoundingClientRect();
        if (r.bottom > window.innerHeight) break;
        if (wide && !(clear(r, dive.getBoundingClientRect()) && clear(r, title.getBoundingClientRect()))) break;
        best = text.length;
      }
      return best;
    }, { words: WORDS, wide: width >= 900 });
    console.log(`headline budget at ${width}×${height}: the longest headline that fits is ${longest} characters; the budget is ${HEADLINE_BUDGET}`);
    expect(longest, "the probe ran out of words before the headline stopped fitting").toBeLessThan(WORDS.join(" ").length);
    expect(HEADLINE_BUDGET).toBeLessThanOrEqual(longest);
    expect(PLACEHOLDERS.headline.length, "the placeholder headline is within the budget").toBeLessThanOrEqual(HEADLINE_BUDGET);
  });
}
