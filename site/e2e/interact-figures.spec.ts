// Interaction smoke test on the article's own figures (moved in Phase 9 from the Phase 6 style page /style/, which is
// retired; author, 2026-11-06): on the universal curve, hover and keyboard focus show a tooltip with the citation and a
// data-file link; the SEP-class point carries its caveat in its tooltip and the data table; the band's label quotes its
// measured spread; a case toggle removes its mark. On the hero, the Π slider moves from the keyboard and its number
// field follows.
import { expect, test } from "./fixtures";

test("the universal curve: tooltips by pointer and keyboard, the SEP caveat, the band's spread, a case toggle", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("research/");
  const fig = page.locator("#fig-universal-curve");
  await fig.scrollIntoViewIfNeeded();
  const hib = fig.getByRole("button", { name: "Hibberd et al.: details" });
  await hib.hover();
  const tip = fig.locator(".tooltip");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Hibberd et al.");
  await expect(tip.getByRole("link", { name: "phase4_numbers.json" })).toHaveAttribute("href", /\/blob\/v1\.0-analysis\/figures\/phase4_numbers\.json$/);

  // Keyboard: focus the nuclear-thermal mark (Hibberd's dive flown by another engine).
  await fig.getByRole("button", { name: /dive flown with nuclear thermal: details$/ }).focus();
  await expect(tip).toContainText("flown with nuclear thermal");

  // The SEP-class point carries the animation's caveat in its tooltip and the data table.
  const sep = fig.getByRole("button", { name: /flown with SEP-class \(hypothetical at .* R☉\): details$/ });
  await sep.focus();
  await expect(tip).toContainText("(hypothetical at");
  await expect(fig.locator(".data-table")).toContainText("(hypothetical at");

  // The band's label quotes its measured spread.
  await expect(fig.locator(".legend")).toContainText(/spread ≤ \d/);

  // Toggle a case off: its mark disappears.
  await fig.locator(".chip", { hasText: "SEP-class" }).locator("input").uncheck();
  await expect(sep).toHaveCount(0);
});

test("the hero's Π slider moves from the keyboard, and its number field follows", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("research/");
  const slider = page.locator("#hero-pi"), field = page.locator("#fig-hero .hero-slider .number");
  await expect(field).toHaveValue(/\d/);
  const before = await field.inputValue();
  await slider.focus();
  for (let i = 0; i < 50; i++) await page.keyboard.press("ArrowRight");
  await expect(field).not.toHaveValue(before);
});
