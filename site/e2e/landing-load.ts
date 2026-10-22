// Shared by the fold specs: load the landing page at a size, with the hero drawn at its real size (a canvas is
// 300 × 150 until its first draw, which would make the page look shorter than it is) and the fonts loaded.
import { expect, type Page } from "./fixtures";

export async function loadLanding(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("");
  await expect(page.locator(".lh-dive")).toHaveAttribute("data-k", /^\d+$/);
  await page.evaluate(() => document.fonts.ready);
}
