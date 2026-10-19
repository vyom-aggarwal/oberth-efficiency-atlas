// The explorer: URL state both ways, presets with SI readouts, warnings (impact, sphere of influence), the view's
// zoom and pan (wheel, keys, drag, reset), placement on both plots, and layout at 390 and 1440 px.
import { expect, test, type Page } from "./fixtures";
import { layoutProblems } from "./layout";

async function open(page: Page, query = "", width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`explorer/${query}`);
  await expect(page.locator("#ex-eta")).not.toHaveText("");
  return page;
}
const setNumber = async (page: Page, id: string, value: string) => {
  const field = page.locator(`#${id}`).locator("xpath=ancestor::div[contains(@class,'axis-slider')]").locator("input.number");
  await field.fill(value);
  await field.press("Enter");
};

test("explorer: the default is Hibberd et al.'s preset, with SI readouts, and the URL records it", async ({ page }) => {
  await open(page);
  await expect(page.locator("#ex-preset")).toHaveValue("hibberd");
  await expect(page.locator("#ex-preset-note")).toContainText("parabolic arrival");
  await expect(page.locator("#ex-loss-si")).toContainText("m/s");
  await expect.poll(() => page.url()).toContain("preset=hibberd");
});

test("explorer: a case in the URL sets the inputs, and editing an input updates the URL", async ({ page }) => {
  await open(page, "?Pi=2&v=0.3&dv=0.05&c=0.5&s=inertial");
  await expect(page.locator("#ex-preset")).toHaveValue("none");
  await expect(page.locator(".segmented input[value='inertial']")).toBeChecked();
  await expect(page.locator("#ex-pi-out")).toHaveText("2.00");
  await expect(page.locator("#ex-burn")).toHaveCount(0);           // no body: no SI readouts
  const eta = await page.locator("#ex-eta").textContent();
  await setNumber(page, "ex-pi", "20");
  await expect(page.locator("#ex-pi-out")).toHaveText("20.0");
  await expect(page.locator("#ex-eta")).not.toHaveText(eta!);
  await expect.poll(() => new URL(page.url()).searchParams.get("Pi")).toBe("20");
  await expect.poll(() => new URL(page.url()).searchParams.get("s")).toBe("inertial");
});

test("explorer: an electric preset at Earth warns that the burn starts outside the sphere of influence", async ({ page }) => {
  await open(page);
  await page.locator("#ex-preset").selectOption("earth.hall");
  await expect(page.locator(".warning-soi")).toContainText("outside Earth's sphere of influence");
  await expect(page.locator(".warning-soi svg.warn-icon")).toHaveCount(1);       // an icon and text, not colour alone
  await expect.poll(() => page.url()).toContain("preset=earth.hall");
});

test("explorer: an impacting case says so, and η is undefined", async ({ page }) => {
  await open(page, "?preset=jupiter.gridded_ion&s=inertial");                  // a preset and no inputs: the preset's
  await expect(page.locator("#ex-preset")).toHaveValue("jupiter.gridded_ion");
  await expect(page.locator(".warning-impact")).toContainText("Jupiter's surface");
  await expect(page.locator("#ex-eta")).toHaveText("undefined (impact)");
});

test("explorer: the view zooms with the wheel and keys, pans by dragging, and resets", async ({ page }) => {
  await open(page);
  const canvas = page.locator("canvas.explorer-canvas");
  await expect(canvas).toHaveAttribute("data-zoom", "1.000");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => Number(await canvas.getAttribute("data-zoom"))).toBeGreaterThan(1.2);
  await canvas.focus();
  await page.keyboard.press("0");
  await expect(canvas).toHaveAttribute("data-zoom", "1.000");
  await page.keyboard.press("+");
  await expect(canvas).toHaveAttribute("data-zoom", "1.250");
  const centre = await canvas.getAttribute("data-centre");
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 260, box.y + 240, { steps: 5 });
  await page.mouse.up();
  expect(await canvas.getAttribute("data-centre")).not.toBe(centre);
  await page.getByRole("button", { name: "Reset view" }).click();
  await expect(canvas).toHaveAttribute("data-zoom", "1.000");
});

test("explorer: the case is placed on the universal curve and on the theory atlas", async ({ page }) => {
  await open(page, "?Pi=1&v=0.1&dv=0.03&c=0.3&s=prograde");
  await expect(page.locator(".explorer-placement .case-ring")).toHaveCount(2);
  await expect(page.locator(".explorer-placement .summary").first()).toContainText("Π = 1");
  await expect(page.locator(".explorer-placement .case-ring.clipped")).toHaveCount(0);
});

for (const width of [390, 1440]) {
  test(`explorer: placement plots clear of overlaps, and no sideways scrolling, at ${width}px`, async ({ page }) => {
    await open(page, "", width);
    for (const fig of await page.locator(".explorer-place-fig").all()) expect(await layoutProblems(fig)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await expect(page.locator("a", { hasText: "single-file explorer" })).toHaveAttribute("href", /explorer\/classic\/$/);
  });
}
