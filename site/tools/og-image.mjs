// The social preview image, public/og-image.png (1200 × 630): the landing page's hero (Phase 7, author 2026-10-21),
// Hibberd et al.'s dive flown by all three engines with each burn in its lane on the a·v ramp, as the site draws it
// (light theme, the final frame), taken from a build with Playwright's own Chrome. No server: requests to
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
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".png": "image/png",
  ".bin": "application/octet-stream" };

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1, colorScheme: "light", reducedMotion: "reduce" });
await page.route("http://site.test/**", async (route) => {
  let file = join(DIST, decodeURIComponent(new URL(route.request().url()).pathname));
  if (file.endsWith("/") || file.endsWith("\\") || (existsSync(file) && statSync(file).isDirectory())) file = join(file, "index.html");
  if (!existsSync(file)) return route.fulfill({ status: 404, body: "" });
  await route.fulfill({ status: 200, contentType: TYPES[extname(file)] ?? "application/octet-stream", body: readFileSync(file) });
});
await page.goto("http://site.test/");
await page.locator(".lh-dive").waitFor();
await page.evaluate(() => document.fonts.ready);
// Only the dive (paths, Sun, rings, the lanes and their labels) on Paper, as large as the card allows; the card's text
// comes from og:title and og:description.
await page.evaluate(() => { document.getElementById("landing-hero").dataset.heightCap = "590"; });
await page.addStyleTag({ content: ".landing-hero-body { grid-template-columns: minmax(0, 1fr) !important; } .lh-side { display: none !important; }" +
  " body * { visibility: hidden !important; } .lh-dive { visibility: visible !important; }" });
await page.waitForTimeout(400);                                   // the hero redraws on resize
const box = await page.locator(".lh-dive").evaluate((e) => {
  const r = e.getBoundingClientRect();
  return { top: r.top + window.scrollY, height: r.height, width: r.width, left: r.left };
});
const y = Math.max(0, box.top - (630 - box.height) / 2);
await page.screenshot({ path: OUT, fullPage: true, clip: { x: 0, y, width: 1200, height: 630 } });
await browser.close();
console.log(`wrote ${OUT} (1200 × 630; the dive ${Math.round(box.width)} × ${Math.round(box.height)})`);
