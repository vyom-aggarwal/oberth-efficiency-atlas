// The pages and what they share (Phase 7 routes): dark only (Phase 9) and the narrow-screen menu, the article's section
// navigation at /research/, the references page and its anchors, citations that resolve to it, the legacy
// /#ref-n redirect, and the classic explorer route. Runs against a build that keeps the unfinished sections.
import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";

const CLASSIC = new URL("../../explorer/oberth_explorer.html", import.meta.url);

test("dark only: every page is dark under a light system setting, with no theme switch (Phase 9)", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  for (const path of ["", "research/", "explorer/", "references/", "about/", "404.html"]) {
    await page.goto(path);
    const { scheme, bg, theme } = await page.evaluate(() => ({
      scheme: getComputedStyle(document.documentElement).colorScheme, bg: getComputedStyle(document.body).backgroundColor,
      theme: document.documentElement.getAttribute("data-theme") }));
    expect([path, scheme, bg, theme]).toEqual([path, "dark", "rgb(17, 18, 20)", null]);    // Void, #111214
    await expect(page.locator(".theme-switch, [data-theme-switch]")).toHaveCount(0);
  }
});

test("the menu pill opens the drawer: focus moves in, Tab cycles, Escape closes and returns focus (Phase 9)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("explorer/");
  const pill = page.locator(".menu-pill"), drawer = page.locator("#site-drawer");
  const inert = () => page.evaluate(() => document.querySelector("main")!.inert);
  await expect(pill).toBeVisible();
  await expect(pill).toHaveText("Menu");
  await expect(page.locator(".site-nav")).toBeHidden();               // below 900 px the links are in the drawer
  await expect(drawer).toBeHidden();
  await pill.focus();
  await page.keyboard.press("Enter");                                // from the keyboard: no motion
  await expect(pill).toHaveAttribute("aria-expanded", "true");
  await expect(pill).toHaveText("Close");
  await expect(drawer).toBeVisible();
  await expect(drawer.locator("nav a").first()).toBeFocused();
  await expect(drawer.locator('a[aria-current="page"]')).toHaveText("Explorer");
  expect(await inert()).toBe(true);
  await page.keyboard.press("Shift+Tab");                            // the Tab cycle: first link → pill → last link → pill
  await expect(pill).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(drawer.locator("a").last()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(pill).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(pill).toHaveAttribute("aria-expanded", "false");
  await expect(drawer).toBeHidden();
  await expect(pill).toBeFocused();                                  // focus returns where it was
  expect(await inert()).toBe(false);
  // A pointer opens it too, and the scrim closes it.
  await pill.click();
  await expect(drawer).toBeVisible();
  await page.locator("[data-menu-scrim]").click({ position: { x: 10, y: 400 } });
  await expect(pill).toHaveAttribute("aria-expanded", "false");
});

test("from 900 px the header's links are inline and the pill waits until the header has scrolled away", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("references/");
  await expect(page.locator(".site-nav")).toBeVisible();
  await expect(page.locator(".menu-pill")).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect(page.locator(".menu-pill")).toBeVisible();
});

test("site navigation: Research, Explorer, References, About; the current page is marked", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [path, current] of [["research/", "Research"], ["explorer/", "Explorer"], ["references/", "References"], ["about/", "About"]]) {
    await page.goto(path);
    await expect(page.locator(".site-nav a")).toHaveText(["Research", "Explorer", "References", "About"]);
    await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveText(current);
    await expect(page.locator('.menu-pages a[aria-current="page"]')).toHaveText(current);
  }
});

test("every page ends with the closing section and the footer: the explorer, the research, the source, the citation", async ({ page }) => {
  for (const path of ["", "research/", "references/", "404.html"]) {
    await page.goto(path);
    const closing = page.locator(".site-closing");
    await expect(closing.locator(".closing-cta"), path).toHaveText("Open the explorer");
    await expect(closing.locator(".closing-links a")).toHaveText(["Research", "Source on GitHub", "Classic explorer"]);
    await expect(closing.locator(".escape-leg path.leg")).toHaveCount(1);
    await expect(closing.locator("#cite .citation-text")).not.toBeEmpty();
  }
  await page.goto("explorer/");
  await expect(page.locator(".site-closing .closing-cta")).toBeHidden();   // the explorer does not send the reader to itself
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

test("the classic explorer is served at explorer/classic/, byte for byte", async ({ page }) => {
  const res = await page.goto("explorer/classic/");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/Oberth/);
  // Phase 9: the offline fallback stays byte-identical (tests/test_site_data.py pins the file itself).
  expect((await res!.body()).equals(readFileSync(CLASSIC))).toBe(true);
});
