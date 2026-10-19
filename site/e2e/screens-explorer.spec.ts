// Review screenshots of the explorer in states the default page does not show: a burn starting outside the sphere
// of influence (Earth, Hall thruster) and an impact (Jupiter, gridded ion, inertial). Written to runs/screens/.
import { expect, test } from "./fixtures";

const CASES = [["soi", "?preset=earth.hall"], ["impact", "?preset=jupiter.gridded_ion&s=inertial"]] as const;
for (const [name, query] of CASES) {
  for (const width of [1440, 390]) {
    test(`explorer ${name} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
      await page.goto(`explorer/${query}`);
      await expect(page.locator(`.warning-${name}`)).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);
      await page.screenshot({ path: `../runs/screens/explorer-${name}-${width}-light.png`, fullPage: true });
    });
  }
}
