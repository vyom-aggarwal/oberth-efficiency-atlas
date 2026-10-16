// Interaction smoke test for the style page's figure and controls: hover and keyboard focus show a tooltip
// with the citation and a data-file link; a case toggle removes its mark; the slider updates its readout.
import { expect, test } from "./fixtures";

test("universal curve and controls respond", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("style/");
  const hib = page.getByRole("button", { name: "Hibberd et al.: details" });
  await hib.hover();
  const tip = page.locator(".tooltip");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Hibberd et al.");
  await expect(tip.getByRole("link", { name: "phase4_numbers.json" })).toHaveAttribute("href", /\/blob\/v1\.0-analysis\/figures\/phase4_numbers\.json$/);
  await page.locator("#fig-curve").screenshot({ path: "../runs/screens/style-tooltip-1440-light.png" });

  // Keyboard: focus the nuclear-thermal mark (Hibberd's dive flown by another engine).
  await page.getByRole("button", { name: /dive flown with nuclear thermal: details$/ }).focus();
  await expect(tip).toContainText("flown with nuclear thermal");

  // The SEP-class point carries the animation's caveat in its label, tooltip and data table.
  const sep = page.getByRole("button", { name: /flown with SEP-class \(hypothetical at .* R☉\): details$/ });
  await sep.focus();
  await expect(tip).toContainText("(hypothetical at");
  await expect(page.locator("#fig-curve .data-table")).toContainText("(hypothetical at");

  // The band's label quotes its measured spread.
  await expect(page.locator("#fig-curve .legend")).toContainText(/spread ≤ \d/);

  // Toggle a case off: its mark disappears.
  await page.locator(".chip", { hasText: "SEP-class" }).locator("input").uncheck();
  await expect(sep).toHaveCount(0);

  // Slider: keyboard moves the value and the readout follows.
  const out = page.locator("output[for=pi-slider]");
  const before = await out.textContent();
  await page.locator("#pi-slider").focus();
  for (let i = 0; i < 50; i++) await page.keyboard.press("ArrowRight");
  await expect(out).not.toHaveText(before ?? "");
});
