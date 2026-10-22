// The pages and what they share (Phase 7 routes): the theme switch and the narrow-screen menu, the article's section
// navigation at /research/, the references page and its anchors, citations that resolve to it, the legacy
// /#ref-n redirect, and the classic explorer route. Runs against a build that keeps the unfinished sections.
import { expect, test } from "./fixtures";

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

test("site navigation: Research, Explorer, References, Source; the current page is marked", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [path, current] of [["research/", "Research"], ["explorer/", "Explorer"], ["references/", "References"]]) {
    await page.goto(path);
    await expect(page.locator(".site-nav a")).toHaveText(["Research", "Explorer", "References", "Source"]);
    await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveText(current);
  }
});

test("the article: section navigation marks the section in view, and figures load when reached", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("research/");
  await page.locator(".section-nav a[data-nav='universal-curve']").click();
  await expect(page.locator(".section-nav a[data-nav='universal-curve']")).toHaveAttribute("aria-current", "true");
  await expect(page.locator("#fig-universal-curve svg[role=img]")).toBeVisible();
  await expect(page.locator("#fig-universal-curve .figure-title")).toContainText(/Figure \d/);
  await expect(page.locator(".section-nav a[data-nav='references']")).toHaveCount(0);   // its own page now
});

test("references: a numbered list with stable anchors, ref-1 to ref-n in order", async ({ page }) => {
  await page.goto("references/");
  const ids = await page.locator("ol.references > li").evaluateAll((els) => els.map((e) => e.id));
  expect(ids.length).toBeGreaterThan(0);
  expect(ids).toEqual(ids.map((_, i) => `ref-${i + 1}`));
  await expect(page.locator("#ref-1")).toContainText("Hibberd");
});

test("every citation link on the site resolves to an existing anchor on the references page", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("references/");
  const anchors = new Set(await page.locator("ol.references > li").evaluateAll((els) => els.map((e) => e.id)));
  const found: string[] = [];
  for (const path of ["", "research/", "explorer/", "references/"]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    // Mount every lazily loaded figure, so its citations are in the page.
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    });
    await page.waitForLoadState("networkidle");
    const hrefs = await page.locator('a[href*="#ref-"]').evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href));
    for (const href of hrefs) {
      const u = new URL(href);
      expect(u.pathname, `${path}: ${href}`).toMatch(/\/references\/$/);
      expect(anchors.has(u.hash.slice(1)), `${path}: ${href}`).toBe(true);
      found.push(href);
    }
  }
  expect(found.length, "citations found on the site").toBeGreaterThan(5);
});

test("an old link to the reference list on / goes to the references page", async ({ page }) => {
  await page.goto("#ref-3");
  await expect(page).toHaveURL(/\/references\/#ref-3$/);
  await expect(page.locator("#ref-3")).toBeVisible();
});

test("the classic explorer is served at explorer/classic/", async ({ page }) => {
  const res = await page.goto("explorer/classic/");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/Oberth/);
});
