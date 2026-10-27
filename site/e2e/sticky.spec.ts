// Sticky elements must not cover what the reader moves to (author, 2026-10-18; extended 2026-10-26 after PR #1 made the
// site header sticky). The header sticks from 900 px; the article's section bar sticks below 1180 px (a side rail
// above that), below the header where both stick. At 390, 768, 1024 (both sticky) and 1440 px:
// - the header never overlaps the section bar or the rail;
// - a control reached with Tab or Shift+Tab (the Curves switch, and "By arrival speed" chosen with the arrow keys), the
//   heading of a section reached from the section navigation, and a reference reached from a citation link all end
//   fully visible below every sticky element in view.
import { expect, test, type Page } from "./fixtures";

const STICKY = [".site-header", ".section-nav-mobile", ".section-nav"];

/** The band at the top of the viewport that stuck elements cover (their lowest bottom), and the viewport height. */
async function band(page: Page): Promise<{ top: number; bottom: number }> {
  return page.evaluate((sel) => {
    let top = 0;
    for (const e of document.querySelectorAll<HTMLElement>(sel.join(", "))) {
      const cs = getComputedStyle(e), r = e.getBoundingClientRect();
      if (cs.display === "none" || cs.position !== "sticky" || r.bottom <= 0) continue;
      const stuckAt = parseFloat(cs.top) || 0;
      if (r.top <= stuckAt + 1 && e.matches(".site-header, .section-nav-mobile")) top = Math.max(top, r.bottom);
    }
    return { top, bottom: window.innerHeight };
  }, STICKY);
}
async function expectClear(page: Page, selector: string, what: string): Promise<void> {
  const r = await page.locator(selector).first().boundingBox();
  const b = await band(page);
  expect(r, what).not.toBeNull();
  expect(r!.y, `${what}: top below the sticky elements (${Math.round(b.top)} px)`).toBeGreaterThanOrEqual(b.top - 0.5);
  expect(r!.y + r!.height, `${what}: bottom on screen`).toBeLessThanOrEqual(b.bottom + 0.5);
}
/** Overlaps between the header and the section bar or rail, as shown now. */
async function overlaps(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const shown = (s: string) => {
      const e = document.querySelector<HTMLElement>(s);
      if (!e || getComputedStyle(e).display === "none") return null;
      const r = e.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight ? r : null;
    };
    const header = shown(".site-header"), out: string[] = [];
    if (!header) return out;
    for (const s of [".section-nav-mobile", ".section-nav"]) {
      const r = shown(s);
      if (r && r.top < header.bottom - 0.5 && header.top < r.bottom - 0.5)
        out.push(`${s} (${Math.round(r.top)}–${Math.round(r.bottom)}) overlaps the header (${Math.round(header.top)}–${Math.round(header.bottom)})`);
    }
    return out;
  });
}

for (const width of [390, 768, 1024, 1440]) {
  test.describe(`${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("research/");
      await page.locator("#fig-universal-curve").scrollIntoViewIfNeeded();
      await expect(page.locator("#fig-universal-curve .segmented")).toBeVisible();
      await expect(page.locator("#fig-universal-curve .plot svg .hit[tabindex]").first()).toBeAttached();   // drawn
    });

    test("the header never overlaps the section bar or the rail", async ({ page }) => {
      const sticks = await page.evaluate(() => getComputedStyle(document.querySelector(".site-header")!).position);
      expect(sticks, "the header sticks from 900 px only").toBe(width >= 900 ? "sticky" : "relative");
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (const y of [0, 600, 1500, 3000, height / 2, height - 1200]) {
        await page.evaluate((v) => window.scrollTo(0, v), y);
        await page.waitForTimeout(60);
        expect(await overlaps(page), `scrolled to ${Math.round(y)}`).toEqual([]);
      }
    });

    test("Tab to the Curves switch while it is under the sticky elements, then choose By arrival speed", async ({ page }) => {
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
      await page.keyboard.press("ArrowRight");
      const family = page.locator('#fig-universal-curve .segmented input[value="family"]');
      await expect(family).toBeFocused();
      await expect(family).toBeChecked();
      await expectClear(page, '#fig-universal-curve .segmented label:has(input[value="family"])', "By arrival speed");
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

    test("every section-navigation link leaves its heading visible below the sticky elements", async ({ page }) => {
      const rail = width >= 1180;
      const ids = await page.locator(rail ? ".section-nav a" : ".section-nav-mobile a").evaluateAll(
        (as) => as.map((a) => (a as HTMLAnchorElement).hash.slice(1)));
      expect(ids.length).toBeGreaterThan(5);
      for (const id of ids) {
        if (rail) await page.locator(`.section-nav a[href$="#${id}"]`).click();
        else {
          await page.locator(".section-nav-mobile summary").click();
          await page.locator(`.section-nav-mobile a[href$="#${id}"]`).click();
        }
        await page.waitForTimeout(400);                     // lazily mounted figures above may change heights
        await expectClear(page, `#${id} > h2`, `heading of #${id}`);
        expect(await overlaps(page), `after #${id}`).toEqual([]);
      }
    });

    test("a citation link lands its reference fully visible below the sticky elements", async ({ page }) => {
      const cite = page.locator('#fig-universal-curve a[href*="references/#ref-"]').first();
      const hash = new URL((await cite.getAttribute("href"))!, "http://site.test/research/").hash;
      await cite.click();
      await page.waitForURL(/\/references\/#ref-\d+$/);
      await page.waitForTimeout(300);
      await expectClear(page, hash, `reference ${hash}`);
    });
  });
}
