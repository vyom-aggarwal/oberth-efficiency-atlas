// Review screenshots: every page at 1440 and 390 px wide, in both themes, with no console errors and no
// sideways scrolling. Images are written to runs/screens/ for review (gitignored).
import { expect, test } from "./fixtures";

// Pages to capture ("" is the home page). /style/ exists only on the dev server.
const PAGES = (process.env.SCREEN_PAGES ?? ",explorer/,404.html,style/").split(",");
const WIDTHS = [1440, 390];
const THEMES = ["light", "dark"] as const;
const OUT = "../runs/screens";

for (const path of PAGES) {
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      test(`${path} at ${width}px, ${theme}`, async ({ page }) => {
        const errors: string[] = [];
        page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
        page.on("pageerror", (e) => errors.push(String(e)));
        await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, "no sideways scrolling of the page body").toBeLessThanOrEqual(0);
        const name = `${path.replace(/\/$/, "").replace(/\//g, "_") || "home"}-${width}-${theme}.png`;
        await page.screenshot({ path: `${OUT}/${name}`, fullPage: true });
        expect(errors, "console errors").toEqual([]);
      });
    }
  }
}
