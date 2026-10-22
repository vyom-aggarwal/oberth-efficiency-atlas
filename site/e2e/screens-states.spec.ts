// Review screenshots of home figures in states the default page does not show (checkpoint 6): the atlas legend with
// inertial steering, a body and the mission samples on; the engines figure below 560 px with another engine chosen.
// Cropped from a full-page capture, as in screens.spec.ts, so the sticky section bar does not cover them. Written to
// runs/screens/.
import { expect, test, type Page } from "./fixtures";

async function crop(page: Page, id: string, file: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  const box = await page.locator(`#${id}`).evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
  });
  await page.screenshot({ path: `../runs/screens/${file}`, fullPage: true, clip: box });
}

for (const width of [1440, 390]) {
  test(`atlas legend, inertial, Venus, mission samples, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.goto("research/");
    const fig = page.locator("#fig-atlas");
    await fig.scrollIntoViewIfNeeded();
    await expect(fig.locator(".plot svg rect.plot-frame")).toBeVisible();
    await fig.locator('.segmented input[name$="-steer"][value="inertial"]').check({ force: true });
    await fig.locator("select").selectOption("venus");
    await fig.locator(".chips label", { hasText: "Mission samples" }).click();
    await expect(fig.locator(".legend-group-title")).toHaveText(["Colour scale", "Fills", "Lines", "Marks"]);
    await crop(page, "fig-atlas", `atlas-states-${width}-light.png`);
  });
}

for (const [engine, file] of [["Nuclear", "nuclear"], ["SEP*", "sep"]]) {
  test(`engines at 390px with ${engine} chosen`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.goto("research/");
    const fig = page.locator("#fig-engines");
    await fig.scrollIntoViewIfNeeded();
    await expect(fig.locator(".engine-switch")).toBeVisible();
    await fig.locator(".engine-switch label", { hasText: engine }).click();
    await crop(page, "fig-engines", `engines-${file}-390-light.png`);
  });
}
