// Figure 7, engines compared: still at load (the final frame), the scrub control and play, the strip's layout, and
// the Limitations facts that follow it on the page.
import { expect, test, type Page } from "./fixtures";
import { layoutProblems } from "./layout";

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("");
  const fig = page.locator("#fig-engines");
  await fig.scrollIntoViewIfNeeded();
  await expect(fig.locator("canvas.engine-canvas")).toHaveCount(3);
  await expect(fig.locator(".clock")).not.toHaveText("");
  return fig;
}

for (const width of [390, 768, 1440]) {
  test(`engines: the strip's text is clear at ${width}px`, async ({ page }) => {
    const fig = await open(page, width);
    expect(await layoutProblems(fig)).toEqual([]);
  });
}

test("engines: still at load on the final frame; scrubbing moves the clock and the strip's cursor", async ({ page }) => {
  const fig = await open(page, 1440);
  await page.waitForTimeout(400);
  const clock = await fig.locator(".clock").textContent();
  expect(clock).toMatch(/^t = \+/);                                // after perihelion: the end of the window
  await page.waitForTimeout(400);
  expect(await fig.locator(".clock").textContent()).toBe(clock);   // nothing moves on its own
  const cursor = await fig.locator(".energy-strip").getAttribute("data-cursor");
  await fig.locator(".scrub input").focus();
  await page.keyboard.press("Home");
  await expect(fig.locator(".clock")).toHaveText(/^t = −/);
  expect(await fig.locator(".energy-strip").getAttribute("data-cursor")).not.toBe(cursor);
});

test("engines: play runs the clock and pause stops it", async ({ page }) => {
  const fig = await open(page, 1440);
  const play = fig.locator("button.play");
  await play.click();
  await expect(play).toHaveAttribute("aria-pressed", "true");
  const a = await fig.locator(".clock").textContent();
  await page.waitForTimeout(500);
  const b = await fig.locator(".clock").textContent();
  expect(b).not.toBe(a);
  await play.click();
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(300);
  const c = await fig.locator(".clock").textContent();
  await page.waitForTimeout(300);
  expect(await fig.locator(".clock").textContent()).toBe(c);
});

test("engines: captions carry Π, burn and loss; the SEP caveat stays in its caption", async ({ page }) => {
  const fig = await open(page, 1440);
  await expect(fig.locator(".engine-cap")).toHaveCount(3);
  await expect(fig.locator(".engine-cap").nth(2)).toContainText("hypothetical at 3.2 R☉");
  for (let i = 0; i < 3; i++) await expect(fig.locator(".engine-cap").nth(i)).toContainText("Π =");
});

test("limitations: the J2 facts, with their source", async ({ page }) => {
  await page.goto("");
  const box = page.locator("#fig-limitations");
  await box.scrollIntoViewIfNeeded();
  await expect(box.locator("dl.facts")).toContainText("J2 oblateness");
  await expect(box.locator("a")).toHaveAttribute("href", /figures\/j2_numbers\.json$/);
});
