// The production build, served under the project base path as on GitHub Pages (project "production" in
// playwright.config.ts; SITE_DIST_PROD=<dir>, built with BASE_PATH). Phase 7, author 2026-10-21:
// - the Research link and /research/ exist only once an article section is published (the landing page never links
//   to an empty page); the expectation follows the content files, so it stays right when the author publishes;
// - every link on the landing page that stays on the site resolves under the base path;
// - no console errors on the always-published pages.
import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";

const content = (f: string) => readFileSync(new URL(`../content/${f}`, import.meta.url), "utf8");
const sections: { file: string }[] = JSON.parse(content("sections.json")).sections;
const published = sections.some((s) => !/\bTODO\b/.test(content(s.file)));

test(`the Research link and /research/ ${published ? "exist (a section is published)" : "do not exist (every section is TODO)"}`, async ({ page }) => {
  for (const path of ["", "explorer/", "references/"]) {
    await page.goto(path);
    await expect(page.locator('.site-nav a[data-page="research"]'), path || "landing").toHaveCount(published ? 1 : 0);
    await expect(page.locator('a[href$="/research/"]'), path || "landing").toHaveCount(published ? (path === "" ? 2 : 1) : 0);
  }
  const res = await page.goto("research/");
  expect(res!.status()).toBe(published ? 200 : 404);
});

test("every link on the landing page that stays on the site resolves under the base path", async ({ page, siteBase }) => {
  await page.goto("");
  const hrefs = [...new Set(await page.locator("a[href]").evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href)))]
    .filter((h) => new URL(h).host === "site.test");
  expect(hrefs.length).toBeGreaterThan(3);
  for (const href of hrefs) {
    const u = new URL(href);
    expect(u.pathname, href).toMatch(new RegExp(`^${siteBase}`));
    const res = await page.goto(u.origin + u.pathname);
    expect(res!.status(), href).toBe(200);
    if (u.hash) await expect(page.locator(u.hash), href).toHaveCount(1);
  }
});

for (const path of ["", "references/", "explorer/", "404.html"]) {
  test(`no console errors: ${path || "landing"}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
}
