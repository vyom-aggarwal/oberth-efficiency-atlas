// Figure 4, the atlas: layout for every slice at three widths, the controls (steering, Δv/V, body, layers), the
// readout and the table.
import { expect, test, type Page } from "./fixtures";
import { layoutProblems } from "./layout";

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("");
  const fig = page.locator("#fig-atlas");
  await fig.scrollIntoViewIfNeeded();
  await expect(fig.locator(".plot svg rect.plot-frame")).toBeVisible();
  return fig;
}
const choose = (fig: ReturnType<Page["locator"]>, group: string, value: string) =>
  fig.locator(`.segmented input[name$="-${group}"][value="${value}"]`).check({ force: true });

for (const width of [390, 768, 1440]) {
  test(`atlas: labels clear of each other and of the text, every slice, at ${width}px`, async ({ page }) => {
    const fig = await open(page, width);
    for (const steer of ["prograde", "inertial"]) for (const dv of ["0", "1", "2"]) {
      await choose(fig, "steer", steer);
      await choose(fig, "dv", dv);
      await page.waitForTimeout(60);
      expect(await layoutProblems(fig), `${width}px, ${steer}, slice ${dv}`).toEqual([]);
    }
  });
}

test("atlas: the guide and contour labels are drawn above the plot at 1440px", async ({ page }) => {
  const fig = await open(page, 1440);
  await expect(fig.locator(".plot .overlay .contour-label")).toHaveCount(3);
  expect(await fig.locator(".plot .overlay .guide-label").count()).toBeGreaterThan(0);
});

test("atlas: steering and slice change the summary; inertial slices show impact boundaries", async ({ page }) => {
  const fig = await open(page, 1440);
  const before = await fig.locator(".summary").textContent();
  await expect(fig.locator(".plot svg path.impact-line")).toHaveCount(0);
  await choose(fig, "steer", "inertial");
  await expect(fig.locator(".summary")).not.toHaveText(before!);
  expect(await fig.locator(".plot svg path.impact-line").count()).toBeGreaterThan(0);
  await expect(fig.locator(".summary")).toContainText("inertial");
});

test("atlas: a body washes the cells outside its sphere of influence and hides the guides", async ({ page }) => {
  const fig = await open(page, 1440);
  expect(await fig.locator(".plot svg path.guide-line").count()).toBeGreaterThan(0);
  await fig.locator("select").selectOption("venus");
  await expect(fig.locator(".summary")).toContainText("Venus's sphere of influence");
  await expect(fig.locator(".plot svg path.guide-line")).toHaveCount(0);
});

test("atlas: the mission-sample layer draws the samples, filtered by body", async ({ page }) => {
  const fig = await open(page, 1440);
  const plot = fig.locator(".plot");
  await expect(plot).toHaveAttribute("data-mission-points", "0");
  await fig.locator(".chips label", { hasText: "Mission samples" }).click();
  const all = Number(await plot.getAttribute("data-mission-points"));
  expect(all).toBeGreaterThan(1000);
  await fig.locator("select").selectOption("jupiter");
  const one = Number(await plot.getAttribute("data-mission-points"));
  expect(one).toBeGreaterThan(0);
  expect(one).toBeLessThan(all);
});

test("atlas: the readout names the cell under the pointer", async ({ page }) => {
  const fig = await open(page, 1440);
  const box = (await fig.locator(".plot svg rect.hit").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  const tip = fig.locator(".tooltip");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Sweep cell");
  await expect(tip).toContainText("burn starts at");
});

test("atlas: the table lists every cell of the slice when opened", async ({ page }) => {
  const fig = await open(page, 1440);
  await fig.locator("details.data summary").click();
  const n = Number(await fig.locator(".plot").getAttribute("data-cells"));
  await expect(fig.locator("details.data tbody tr")).toHaveCount(n);
});
