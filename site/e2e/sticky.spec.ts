// The sticky section bar (narrow screens) must not cover what the reader moves to (author, 2026-10-18): a control
// reached with Tab or Shift+Tab, and the heading of a section reached from the section navigation, end fully visible
// below the bar. At 1440 px the navigation is a side rail and nothing is sticky over the content.
import { expect, test, type Page } from "./fixtures";

/** Bottom of the sticky bar (0 where it is not shown) and the viewport height. */
async function band(page: Page): Promise<{ top: number; bottom: number }> {
  return page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>(".section-nav-mobile")!;
    const shown = getComputedStyle(bar).display !== "none";
    return { top: shown ? bar.getBoundingClientRect().bottom : 0, bottom: window.innerHeight };
  });
}
async function expectClear(page: Page, selector: string, what: string): Promise<void> {
  const r = await page.locator(selector).first().boundingBox();
  const b = await band(page);
  expect(r, what).not.toBeNull();
  expect(r!.y, `${what}: top below the bar`).toBeGreaterThanOrEqual(b.top - 0.5);
  expect(r!.y + r!.height, `${what}: bottom on screen`).toBeLessThanOrEqual(b.bottom + 0.5);
}

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("");
      await page.locator("#fig-universal-curve").scrollIntoViewIfNeeded();
      await expect(page.locator("#fig-universal-curve .segmented")).toBeVisible();
      await expect(page.locator("#fig-universal-curve .plot svg .hit[tabindex]").first()).toBeAttached();   // drawn
    });

    test("Tab to the Curves switch while it is under the bar", async ({ page }) => {
      // Focus the control before it (the last case chip) without scrolling, then put the switch at the very top.
      await page.evaluate(() => {
        const chips = document.querySelectorAll<HTMLInputElement>("#fig-universal-curve .chips input");
        chips[chips.length - 1].focus({ preventScroll: true });
        const seg = document.querySelector("#fig-universal-curve .segmented")!;
        window.scrollBy(0, seg.getBoundingClientRect().top - 4);
      });
      await page.keyboard.press("Tab");
      await expect(page.locator("#fig-universal-curve .segmented input:checked")).toBeFocused();
      await expectClear(page, "#fig-universal-curve .segmented", "Curves switch");
    });

    test("Shift+Tab back to the Curves switch from below", async ({ page }) => {
      await page.evaluate(() => {
        const next = document.querySelector<SVGElement>("#fig-universal-curve .plot svg .hit[tabindex]")!;
        next.focus({ preventScroll: true });
        const seg = document.querySelector("#fig-universal-curve .segmented")!;
        window.scrollBy(0, seg.getBoundingClientRect().bottom + 40);   // the switch just above the viewport
      });
      await page.keyboard.press("Shift+Tab");
      await expect(page.locator("#fig-universal-curve .segmented input:checked")).toBeFocused();
      await expectClear(page, "#fig-universal-curve .segmented", "Curves switch");
    });

    test("every section-navigation link leaves its heading visible below the bar", async ({ page }) => {
      const ids = await page.locator(width > 600 ? ".section-nav a" : ".section-nav-mobile a").evaluateAll(
        (as) => as.map((a) => (a as HTMLAnchorElement).hash.slice(1)));
      expect(ids.length).toBeGreaterThan(5);
      for (const id of ids) {
        if (width > 600) await page.locator(`.section-nav a[href$="#${id}"]`).click();
        else {
          await page.locator(".section-nav-mobile summary").click();
          await page.locator(`.section-nav-mobile a[href$="#${id}"]`).click();
        }
        await page.waitForTimeout(400);                     // lazily mounted figures above may change heights
        await expectClear(page, `#${id} > h2`, `heading of #${id}`);
      }
    });
  });
}
