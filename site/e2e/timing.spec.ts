// Figure 5, burn timing: layout at three widths and three values of Δv/c, the slider, the readouts and the table.
import { expect, test, type Page } from "./fixtures";
import { layoutProblems } from "./layout";

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("");
  const fig = page.locator("#fig-timing");
  await fig.scrollIntoViewIfNeeded();
  await expect(fig.locator(".plot svg path.profile-line")).toBeVisible();
  return fig;
}
async function setIndex(page: Page, i: number) {
  await page.evaluate((k) => {
    const r = document.querySelector<HTMLInputElement>("#fig-timing .snap-slider input")!;
    r.value = String(k);
    r.dispatchEvent(new Event("input", { bubbles: true }));
  }, i);
  await page.waitForTimeout(120);
}

for (const width of [390, 768, 1440]) {
  test(`timing: labels clear of each other and of the text at ${width}px`, async ({ page }) => {
    const fig = await open(page, width);
    const max = Number(await fig.locator(".snap-slider input").getAttribute("max"));
    for (const i of [0, 34, max]) {
      await setIndex(page, i);
      expect(await layoutProblems(fig), `${width}px, row ${i}`).toEqual([]);
    }
  });
}

test("timing: the slider changes the profile, the marks and the readouts", async ({ page }) => {
  const fig = await open(page, 1440);
  await expect(fig.locator(".plot svg linearGradient stop")).toHaveCount(51);
  await expect(fig.locator(".timing-facts > div")).toHaveCount(6);
  const before = { facts: await fig.locator(".timing-facts").textContent(), d: await fig.locator(".plot path.profile-line").getAttribute("d"),
                   xbar: await fig.locator(".plot line.mark-xbar").getAttribute("x1") };
  await fig.locator(".snap-slider input").focus();
  await page.keyboard.press("End");                               // the largest Δv/c
  await expect(fig.locator(".timing-facts")).not.toHaveText(before.facts!);
  expect(await fig.locator(".plot path.profile-line").getAttribute("d")).not.toBe(before.d);
  expect(Number(await fig.locator(".plot line.mark-xbar").getAttribute("x1"))).toBeGreaterThan(Number(before.xbar));   // x̄ moves later
});

test("timing: the three marks are labelled on the plot at 1440px for every Δv/c", async ({ page }) => {
  const fig = await open(page, 1440);
  const max = Number(await fig.locator(".snap-slider input").getAttribute("max"));
  for (const i of [0, 34, max]) {
    await setIndex(page, i);
    const text = await fig.locator(".plot .overlay").textContent();
    for (const t of ["time midpoint", "Δv-weighted mean", "half the Δv"]) expect(text, `row ${i}`).toContain(t);
  }
});

test("timing: the table lists every row and marks the Phase 3 values", async ({ page }) => {
  const fig = await open(page, 1440);
  await fig.locator("details.data summary").click();
  const n = Number(await fig.locator(".snap-slider input").getAttribute("max")) + 1;
  await expect(fig.locator("details.data tbody tr")).toHaveCount(n);
  await expect(fig.locator("details.data tbody th", { hasText: "*" })).toHaveCount(3);
});
