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

test("engines below 560 px: one panel at a time; switching engine keeps the clock, and the strip keeps all three", async ({ page }) => {
  const fig = await open(page, 390);
  await expect(fig.locator(".engine-switch")).toBeVisible();
  await expect(fig.locator(".engine-panel:visible")).toHaveCount(1);
  await expect(fig.locator(".engine-panel:visible .engine-name")).toHaveText(/Solid stack/);
  await page.evaluate(() => {                                         // part way through the dive
    const r = document.querySelector<HTMLInputElement>("#fig-engines .scrub input")!;
    r.value = String(Number(r.min) * 0.3);
    r.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const clock = await fig.locator(".clock").textContent();
  expect(clock).toMatch(/^t = −/);
  await fig.locator(".engine-switch label", { hasText: "Nuclear" }).click();
  await expect(fig.locator(".engine-panel:visible .engine-name")).toHaveText(/Nuclear thermal/);
  await expect(fig.locator(".clock")).toHaveText(clock!);
  await fig.locator(".engine-switch label", { hasText: "SEP*" }).click();
  await expect(fig.locator(".engine-panel:visible .engine-note")).toContainText("hypothetical at 3.2 R☉");
  await expect(fig.locator(".clock")).toHaveText(clock!);
  await expect(fig.locator(".energy-strip path.strip-line:not(.faint)")).toHaveCount(3);
});

test("engines below 560 px: the switch uses the hero's short names; the SEP panel explains the star (author, 2026-10-20)", async ({ page }) => {
  const fig = await open(page, 390);
  const labels = fig.locator(".engine-switch label");
  await expect(labels).toHaveText(["Solid", "Nuclear", "SEP*"]);
  // The radios keep the full names for assistive technology.
  await expect(fig.getByRole("radio", { name: "SEP-class" })).toHaveCount(1);
  await expect(fig.getByRole("radio", { name: "Solid stack" })).toBeChecked();
  // The star's note sits on the SEP panel itself, visible when that panel is shown; one row each label.
  await labels.filter({ hasText: "SEP*" }).click();
  await expect(fig.locator(".engine-panel:visible .engine-note")).toHaveText("* hypothetical at 3.2 R☉");
  await expect(fig.locator(".engine-panel:visible .engine-note")).toBeVisible();
  const heights = await labels.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(Math.max(...heights) - Math.min(...heights), "every switch label on one line").toBeLessThan(2);
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await layoutProblems(fig), `${width}px`).toEqual([]);
  }
});

test("engines at 1440 px: three panels side by side, no switch; the SEP caveat in its own words", async ({ page }) => {
  const fig = await open(page, 1440);
  await expect(fig.locator(".engine-switch")).toBeHidden();
  await expect(fig.locator(".engine-panel:visible")).toHaveCount(3);
  await expect(fig.locator(".engine-cap").nth(2).locator(".engine-note")).toHaveText("(hypothetical at 3.2 R☉)");
});

test("limitations: the J2 facts, with their source", async ({ page }) => {
  await page.goto("");
  const box = page.locator("#fig-limitations");
  await box.scrollIntoViewIfNeeded();
  await expect(box.locator("dl.facts")).toContainText("J2 oblateness");
  await expect(box.locator("a")).toHaveAttribute("href", /figures\/j2_numbers\.json$/);
});
