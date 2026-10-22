// An open tooltip survives a redraw (author, 2026-10-19). Figures redraw when web fonts finish loading (and on
// resize or a theme change), which replaces their hit targets; the tooltip must stay open, opened by the pointer or
// by keyboard focus. The redraw is triggered here exactly as the browser does it: a "loadingdone" event on
// document.fonts.
import { expect, test, type Page } from "./fixtures";

async function open(page: Page, id: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("research/");
  const fig = page.locator(`#${id}`);
  await fig.scrollIntoViewIfNeeded();
  await expect(fig.locator(".plot svg .hit").first()).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
  return fig;
}
const fontsLoaded = async (page: Page) => {
  await page.evaluate(() => document.fonts.dispatchEvent(new Event("loadingdone")));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));   // the redraw
};

for (const id of ["fig-universal-curve", "fig-regimes", "fig-case", "fig-atlas"]) {
  test(`${id}: a tooltip opened by the pointer stays open across a font-load redraw`, async ({ page }) => {
    const fig = await open(page, id);
    await fig.locator(".plot svg rect.hit").first().hover();
    const tip = fig.locator(".tooltip");
    await expect(tip).toBeVisible();
    const before = await tip.textContent();
    const frame = await fig.locator(".plot svg").evaluate((s) => s.firstElementChild);
    await fontsLoaded(page);
    expect(await fig.locator(".plot svg").evaluate((s, old) => s.firstElementChild !== old, frame)).toBe(true);   // it redrew
    await expect(tip).toBeVisible();
    await expect(tip).toHaveText(before!);
  });
}

test("a tooltip opened by keyboard focus stays open, with focus on the same mark, across a font-load redraw", async ({ page }) => {
  const fig = await open(page, "fig-universal-curve");
  const target = fig.locator(".plot svg .hit[tabindex]").first();
  const name = await target.getAttribute("aria-label");
  await target.focus();
  const tip = fig.locator(".tooltip");
  await expect(tip).toBeVisible();
  await fontsLoaded(page);
  await expect(tip).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe(name);
});
