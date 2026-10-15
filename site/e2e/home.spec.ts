// Home-page smoke test: the theme switch, the narrow-screen menu, the section navigation, a lazily loaded figure,
// and the classic explorer route. Runs against the dev server (every section shown, with TODO banners).
import { expect, test } from "@playwright/test";

test("theme switch pins a theme and returns to the system setting", async ({ page }) => {
  await page.goto("");
  await page.locator(".theme-switch label", { hasText: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");     // remembered
  await page.locator(".theme-switch label", { hasText: "System" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});

test("narrow screens fold the site links behind a menu button", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("");
  const button = page.getByRole("button", { name: "Menu" });
  await expect(button).toBeVisible();
  await expect(page.locator(".site-nav")).toBeHidden();
  await button.click();
  await expect(page.locator(".site-nav")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".site-nav")).toBeHidden();
});

test("section navigation marks the section in view, and figures load when reached", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("");
  await page.locator(".section-nav a[data-nav='universal-curve']").click();
  await expect(page.locator(".section-nav a[data-nav='universal-curve']")).toHaveAttribute("aria-current", "true");
  await expect(page.locator("#fig-universal-curve svg[role=img]")).toBeVisible();
  await expect(page.locator("#fig-universal-curve .figure-title")).toContainText(/Figure \d/);
  await page.locator(".section-nav a[data-nav='references']").click();
  await expect(page.locator("#ref-1")).toContainText("Hibberd");
});

test("the classic explorer is served at explorer/classic/", async ({ page }) => {
  const res = await page.goto("explorer/classic/");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/Oberth/);
});
