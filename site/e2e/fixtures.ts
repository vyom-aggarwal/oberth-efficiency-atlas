// Shared Playwright fixture. With SITE_DIST set (a built site directory), every request to http://site.test/ is
// answered from that directory by Playwright itself, so the tests need no local server socket (useful where
// loopback networking is unavailable, and it tests the build exactly as deployed). Without SITE_DIST the tests
// use the dev server that playwright.config.ts starts.
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { test as base } from "@playwright/test";

const DIST = process.env.SITE_DIST ? resolve(process.env.SITE_DIST) : null;
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".bin": "application/octet-stream",
  ".png": "image/png",
};

export const test = base.extend({
  page: async ({ page }, use) => {
    if (DIST) {
      await page.route("http://site.test/**", async (route) => {
        let path = decodeURIComponent(new URL(route.request().url()).pathname);
        let file = join(DIST, path);
        if (path.endsWith("/") || (existsSync(file) && statSync(file).isDirectory())) file = join(file, "index.html");
        if (!existsSync(file)) {
          await route.fulfill({ status: 404, contentType: TYPES[".html"], body: readFileSync(join(DIST, "404.html")) });
          return;
        }
        await route.fulfill({ status: 200, contentType: TYPES[extname(file)] ?? "application/octet-stream", body: readFileSync(file) });
      });
    }
    await use(page);
  },
});
export { expect } from "@playwright/test";
export type { Page } from "@playwright/test";
