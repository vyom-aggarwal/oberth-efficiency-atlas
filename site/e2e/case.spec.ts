// Figure 6, the case study: layout at three widths, the marks and their tooltips, the readout and the tables.
import { expect, test, type Page } from "./fixtures";
import { layoutProblems } from "./layout";

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("");
  const fig = page.locator("#fig-case");
  await fig.scrollIntoViewIfNeeded();
  await expect(fig.locator(".plot svg path.data-line")).toBeVisible();
  return fig;
}

for (const width of [390, 768, 1440]) {
  test(`case study: labels clear of each other and of the text at ${width}px`, async ({ page }) => {
    const fig = await open(page, width);
    expect(await layoutProblems(fig)).toEqual([]);
  });
}

test("case study: the reference and the two threshold points are marked and explained on focus", async ({ page }) => {
  const fig = await open(page, 1440);
  await expect(fig.locator(".plot svg .mark-sim")).toHaveCount(3);
  const targets = fig.locator(".plot svg .hit[tabindex]");
  await expect(targets).toHaveCount(3);
  await targets.first().focus();
  await expect(fig.locator(".tooltip")).toBeVisible();
  await expect(fig.locator(".tooltip")).toContainText("Π");
  await expect(fig.locator(".plot .overlay")).toContainText("reference stack");
});

test("case study: the readout follows the pointer along the sweep", async ({ page }) => {
  const fig = await open(page, 1440);
  // A late font load redraws the figure and hides the tooltip: wait for the fonts, and hover again until it shows.
  await page.evaluate(() => document.fonts.ready);
  let nudge = 0;                                    // a repeated hover must move the pointer to fire again
  await expect(async () => {
    const box = (await fig.locator(".plot svg rect.hit").boundingBox())!;   // re-measured: a redraw replaces it
    await fig.locator(".plot svg rect.hit").hover({ position: { x: box.width * 0.3 + (nudge++ % 2), y: box.height * 0.3 }, force: true });
    await expect(fig.locator(".tooltip")).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 8000 });
  await expect(fig.locator(".tooltip")).toContainText("loss/Δv");
});

test("case study: tables of the sweep and of the sensitivities", async ({ page }) => {
  const fig = await open(page, 1440);
  const [curve, sens] = [fig.locator("details.data").nth(0), fig.locator("details.data").nth(1)];
  await curve.locator("summary").click();
  await sens.locator("summary").click();
  expect(await curve.locator("tbody tr").count()).toBeGreaterThan(20);
  expect(await sens.locator("tbody tr").count()).toBeGreaterThan(3);
});
