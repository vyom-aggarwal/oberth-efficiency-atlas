// The social preview image, public/og-image.png (1200 × 630): the hero's live flyby as the site draws it (light
// theme, the intro skipped), taken from a build with Playwright's own Chrome. No server: requests to
// http://site.test/ are answered from the build directory, as in e2e/fixtures.ts.
// Run (in site/), after a test build:
//   SITE_SHOW_TODO=1 npx vite build --mode development --outDir dist-test --emptyOutDir
//   node tools/og-image.mjs [dist-test]
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const DIST = resolve(process.argv[2] ?? "dist-test");
const OUT = fileURLToPath(new URL("../public/og-image.png", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".png": "image/png" };

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1, colorScheme: "light", reducedMotion: "reduce" });
await page.route("http://site.test/**", async (route) => {
  let file = join(DIST, decodeURIComponent(new URL(route.request().url()).pathname));
  if (file.endsWith("/") || file.endsWith("\\") || (existsSync(file) && statSync(file).isDirectory())) file = join(file, "index.html");
  if (!existsSync(file)) return route.fulfill({ status: 404, body: "" });
  await route.fulfill({ status: 200, contentType: TYPES[extname(file)] ?? "application/octet-stream", body: readFileSync(file) });
});
await page.goto("http://site.test/");
await page.locator(".hero-canvas").waitFor();
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
// Only the hero's drawing (trajectory, Sun, burn arc, η and Π annotations) on Paper, centred in 1200 × 630; the
// card's text comes from og:title and og:description.
await page.addStyleTag({ content: "body * { visibility: hidden !important; } .hero-stage, .hero-stage * { visibility: visible !important; }" });
const stage = await page.locator(".hero-stage").evaluate((e) => {
  const r = e.getBoundingClientRect();
  return { top: r.top + window.scrollY, height: r.height };
});
const y = Math.max(0, stage.top - (630 - stage.height) / 2);
await page.screenshot({ path: OUT, fullPage: true, clip: { x: 0, y, width: 1200, height: 630 } });
await browser.close();
console.log(`wrote ${OUT} (1200 × 630)`);
