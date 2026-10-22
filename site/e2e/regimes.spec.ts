// Figure 3, three regimes (η_W, author decision 2026-10-15): layout at three widths and three arrival speeds, the
// arrival-speed slider, the theory toggles, the readout and the link to where η and η_W are defined.
import { expect, test, type Page } from "./fixtures";
import { layoutProblems } from "./layout";

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("research/");
  const fig = page.locator("#fig-regimes");
  await fig.scrollIntoViewIfNeeded();
  await expect(fig.locator(".plot svg path.data-line")).toBeVisible();
  return fig;
}
async function setIndex(page: Page, i: number) {
  await page.evaluate((k) => {
    const r = document.querySelector<HTMLInputElement>("#fig-regimes .snap-slider input")!;
    r.value = String(k);
    r.dispatchEvent(new Event("input", { bubbles: true }));
  }, i);
  await page.waitForTimeout(120);
}

for (const width of [390, 768, 1440]) {
  test(`regimes: labels clear of each other and of the text at ${width}px`, async ({ page }) => {
    const fig = await open(page, width);
    for (const i of [0, 6, 14]) {
      await setIndex(page, i);
      expect(await layoutProblems(fig), `${width}px, arrival speed ${i}`).toEqual([]);
    }
  });
}

test("regimes: the slider steps through the 15 sweep arrival speeds and moves Π_T", async ({ page }) => {
  const fig = await open(page, 1440);
  const slider = fig.locator(".snap-slider input");
  await expect(slider).toHaveAttribute("max", "14");
  await setIndex(page, 14);
  const fast = await fig.locator(".snap-value").textContent();
  const refFast = await fig.locator(".plot svg line.ref-line").getAttribute("x1");
  const summaryFast = await fig.locator(".summary").textContent();
  await slider.focus();
  await page.keyboard.press("Home");                              // keyboard: the slowest arrival
  await expect(fig.locator(".snap-value")).not.toHaveText(fast!);
  await expect(fig.locator(".summary")).not.toHaveText(summaryFast!);
  await setIndex(page, 10);
  expect(await fig.locator(".plot svg line.ref-line").getAttribute("x1")).not.toBe(refFast);
});

test("regimes: theory layers toggle, and the legend names every line", async ({ page }) => {
  const fig = await open(page, 1440);
  await setIndex(page, 10);
  const count = () => fig.locator(".plot svg path.theory-line").count();
  const all = await count();
  expect(all).toBeGreaterThanOrEqual(3);
  await fig.locator(".chips label", { hasText: "Δv → 0" }).click();
  expect(await count()).toBe(all - 1);
  await expect(fig.locator("ul.legend li")).toHaveCount(8);
});

test("regimes: the readout gives the nearest bin's η_W and η", async ({ page }) => {
  const fig = await open(page, 1440);
  await fig.locator(".plot svg rect.hit").hover();
  const tip = fig.locator(".tooltip");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("η_W, median");
  await expect(tip).toContainText("η, median");
});

test("regimes: plots η_W, named in full, with a link to where η and η_W are defined", async ({ page }) => {
  const fig = await open(page, 1440);
  await expect(fig.locator(".plot .overlay")).toContainText("baseline-subtracted energy efficiency");
  const link = fig.locator(".figure-note a");
  await expect(link).toHaveAttribute("href", /docs\/theory\.md#2-exact-energy-bookkeeping$/);
});
