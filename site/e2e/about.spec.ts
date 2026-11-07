// The About page and the 404 page (Phase 9 pass 6, docs/revamp_plan.md §2.4, §2.7), against the test build:
// - About: the design credit in the author's words, linking to the portfolio; the portfolio's MIT notice verbatim (as
//   THIRD_PARTY_NOTICES.md holds it); the citation as the footer gives it and as BibTeX; the audit facts from
//   methods.json; section headings that stick in their column from 900 px; the page marked current in the navigation.
// - 404: the display title, the statement line and the links as outline pills.
import { readFileSync } from "node:fs";
import { citationBibtex, noticeText } from "../plugins/content-plugin";
import { expect, test } from "./fixtures";

const data = (f: string) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), "utf8"));
const NOTICES = readFileSync(new URL("../../THIRD_PARTY_NOTICES.md", import.meta.url), "utf8");

test("About: the design credit, the portfolio's MIT notice verbatim, and the citation in two forms", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("about/");
  await expect(page.locator("h1")).toHaveText("About");
  const credit = page.locator("#design-credit");
  await expect(credit).toHaveText("Design adapted from Suhas Beemineni's portfolio (MIT licence)");
  await expect(credit).toHaveAttribute("href", "https://suhaslord.github.io/portfolio/");
  expect((await page.locator(".licence-text").textContent())!).toBe(noticeText(NOTICES, 1));
  await expect(page.locator("#about-citation")).toHaveText((await page.locator("#citation-text").textContent())!.trim());
  expect((await page.locator("#about-bibtex").textContent())!).toBe(citationBibtex(data("site.json").citation));
  const m = data("methods.json");
  await expect(page.locator("#about-repro")).toContainText(`${m.audit.identical.value} of ${m.audit.outputs.value} outputs reproduced identically`);
  await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveText("About");
  await expect(page.locator(".about-h")).toHaveText(["Citation", "Licences", "Reproducibility", "AI use", "Author"]);
});

for (const [width, sticky] of [[1440, "sticky"], [390, "static"]] as const) {
  test(`About at ${width}px: the section headings are ${sticky}, and nothing scrolls sideways`, async ({ page }) => {
    await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
    await page.goto("about/");
    const headings = page.locator(".about-h");
    for (const pos of await headings.evaluateAll((els) => els.map((e) => getComputedStyle(e).position))) expect(pos).toBe(sticky);
    if (sticky === "sticky") {
      // Scrolled into the licences, its heading stays in view below the menu pill's band, beside its rows.
      await page.locator("#about-licences-h").evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY + 300));
      const [h, pill] = await Promise.all(["#about-licences-h", ".menu-pill"].map((q) => page.locator(q).boundingBox()));
      expect(h!.y).toBeGreaterThanOrEqual(pill!.y + pill!.height);
      expect(h!.x + h!.width).toBeLessThan(pill!.x);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

test("404: the display title, the statement line and the links as outline pills", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("404.html");
  await expect(page.locator("h1")).toHaveText("Page not found");
  const links = page.locator(".link-list a");
  await expect(links).toHaveText(["Home", "Research", "Explorer", "References", "Single-file explorer"]);
  for (const r of await links.evaluateAll((els) => els.map((e) => getComputedStyle(e).borderTopLeftRadius))) expect(parseFloat(r)).toBeGreaterThan(20);
});
