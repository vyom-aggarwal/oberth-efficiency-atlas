// Shared Playwright fixture. With a built site directory (option siteDist, from SITE_DIST or SITE_DIST_PROD in
// playwright.config.ts), every request to http://site.test/ is answered from that directory by Playwright itself, so
// the tests need no local server socket (useful where loopback networking is unavailable, and it tests the build
// exactly as deployed). siteBase is the base path the build was made for ("/" for the test build; the project path
// for the production build, as on GitHub Pages); a request outside it gets the 404 page, as GitHub Pages would.
// Without a build the tests use the dev server that playwright.config.ts starts.
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { test as base } from "@playwright/test";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".bin": "application/octet-stream",
  ".png": "image/png",
};

// siteOrigin is where the build is served: http://site.test by default; a test that needs a secure context (the
// clipboard API) serves it at http://localhost instead, still answered by the route handler, with no server.
export interface SiteOptions { siteDist: string | undefined; siteBase: string; siteOrigin: string }

export const test = base.extend<SiteOptions>({
  siteDist: [process.env.SITE_DIST, { option: true }],
  siteBase: ["/", { option: true }],
  siteOrigin: ["http://site.test", { option: true }],
  page: async ({ page, siteDist, siteBase, siteOrigin }, use) => {
    if (siteDist) {
      const dist = resolve(siteDist);
      const notFound = () => ({ status: 404, contentType: TYPES[".html"], body: readFileSync(join(dist, "404.html")) });
      await page.route(`${siteOrigin}/**`, async (route) => {
        const full = decodeURIComponent(new URL(route.request().url()).pathname);
        if (!full.startsWith(siteBase)) return route.fulfill(notFound());
        const path = "/" + full.slice(siteBase.length);
        let file = join(dist, path);
        if (path.endsWith("/") || (existsSync(file) && statSync(file).isDirectory())) file = join(file, "index.html");
        if (!existsSync(file)) return route.fulfill(notFound());
        await route.fulfill({ status: 200, contentType: TYPES[extname(file)] ?? "application/octet-stream", body: readFileSync(file) });
      });
    }
    await use(page);
  },
});
export { expect } from "@playwright/test";
export type { Locator, Page } from "@playwright/test";
