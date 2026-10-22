// Open Graph and Twitter-card metadata (author item 8, 2026-10-19): every page carries its own title, description and
// URL, a 1200 × 630 preview image that is served, and a large-image card; the 404 page none.
import { expect, test } from "./fixtures";

for (const [name, path] of [["landing", ""], ["research", "research/"], ["explorer", "explorer/"], ["references", "references/"]]) {
  test(`${name}: Open Graph tags from the page's own title and description, and the image is served`, async ({ page }) => {
    await page.goto(path);
    const meta = (k: string) => page.locator(`meta[property="${k}"], meta[name="${k}"]`).getAttribute("content");
    expect(await meta("og:title")).toBe(await page.title());
    expect(await meta("og:description")).toBe(await page.locator('meta[name="description"]').getAttribute("content"));
    expect(await meta("og:url")).toMatch(new RegExp(`/${path}$`));
    expect(await meta("twitter:card")).toBe("summary_large_image");
    expect(await meta("og:image:width")).toBe("1200");
    expect(await meta("og:image:height")).toBe("630");
    const image = await meta("og:image");
    expect(image).toMatch(/og-image\.png$/);
    const res = await page.goto(new URL(image!, page.url()).href);
    expect(res!.status()).toBe(200);
    expect(res!.headers()["content-type"]).toBe("image/png");
  });
}

test("the 404 page has no social tags", async ({ page }) => {
  await page.goto("404.html");
  await expect(page.locator('meta[property^="og:"]')).toHaveCount(0);
});
