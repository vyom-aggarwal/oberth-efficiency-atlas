// Phase 9 pass 3 review screenshots of the landing page (the author's list, 2026-11-02), at 1440 × 900 and 390 × 844:
// the preloader mid-flight, the hero, the docked dive with each findings row hovered (1440 only: below 1100 px there is
// no dock), a row opened in place, reduced motion, and the full page. Served from a built site directory through a
// route handler, as e2e/fixtures.ts does (no server). Prints the preloader's measured times.
// Run in site/, after the test build (SITE_SHOW_TODO=1 npx vite build --mode development --outDir dist-test):
//   node tools/landing-shots.mjs [dist-test]        → ../docs/screens/phase-9-pass-3/
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const DIST = resolve(process.argv[2] ?? "dist-test");
const OUT = new URL("../../docs/screens/phase-9-pass-3/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const file = (name) => new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".bin": "application/octet-stream", ".png": "image/png" };
const SIZES = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } };
const browser = await chromium.launch({ channel: "chrome" });

async function context(w, { seen = true, reducedMotion = "no-preference" } = {}) {
  const ctx = await browser.newContext({ viewport: SIZES[w], deviceScaleFactor: 1, reducedMotion });
  await ctx.route("http://site.test/**", (route) => {
    let p = join(DIST, decodeURIComponent(new URL(route.request().url()).pathname));
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
    if (!existsSync(p)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(p)] ?? "application/octet-stream", body: readFileSync(p) });
  });
  // A session that has seen the preloader and the dive's intro (both read sessionStorage).
  if (seen) await ctx.addInitScript(() => { sessionStorage.setItem("oberth-preloaded", "1"); sessionStorage.setItem("oberth-landing-intro", "1"); });
  return ctx;
}
async function landing(ctx) {
  const page = await ctx.newPage();
  await page.goto("http://site.test/");
  await page.waitForSelector("#landing-hero[data-intro='seen'], #landing-hero[data-intro='skipped'], #landing-hero[data-intro='done']", { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  return page;
}
const scrollTo = (page, sel, y = 0) => page.evaluate(([s, y]) => { const e = document.querySelector(s); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - y); }, [sel, y]);

for (const w of [1440, 390]) {
  // The preloader mid-flight, timed from the page's start as its own schedule is (0.75 s: the dot near perihelion).
  {
    const ctx = await context(w, { seen: false }), page = await ctx.newPage();
    await page.goto("http://site.test/", { waitUntil: "commit" });
    await page.waitForFunction(() => performance.now() >= 750 && document.querySelector(".flyby .dot"), null, { polling: 16, timeout: 10000 });
    await page.screenshot({ path: file(`landing-${w}-preloader-flight.png`) });
    await page.waitForFunction(() => !document.documentElement.classList.contains("preloading"), null, { timeout: 10000 });
    const t = await page.evaluate(() => ({ ...document.documentElement.dataset }));
    console.log(`${w}: preloader script ${t.preloaderStart} ms, faded ${t.preloaderFaded} ms, removed ${t.preloaderMs} ms`);
    await ctx.close();
  }
  // The hero (the intro already seen: its final frame), and the full page with every row closed.
  {
    const ctx = await context(w), page = await landing(ctx);
    await page.screenshot({ path: file(`landing-${w}-hero.png`) });
    await page.screenshot({ path: file(`landing-${w}.png`), fullPage: true });
    await ctx.close();
  }
  // At 1440: the dive docked beside the rows, each row hovered in turn (row 02 leaves the dive as it is). Then a row
  // opened in place, at both widths.
  {
    const ctx = await context(w), page = await landing(ctx);
    await scrollTo(page, "#findings-title", w === 1440 ? 120 : 24);
    await page.waitForTimeout(500);
    if (w === 1440) {
      for (const [i, id] of [[0, "loss"], [1, "missions"], [2, "hibberd"]]) {
        const box = await page.locator(".row-head").nth(i).boundingBox();
        await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5, { steps: 6 });
        await page.waitForTimeout(900);
        console.log(`${w}: row ${id} hovered, data-steer = ${await page.locator("#landing-hero").getAttribute("data-steer")}`);
        await page.screenshot({ path: file(`landing-${w}-hover-${String(i + 1).padStart(2, "0")}.png`) });
      }
      await page.mouse.move(5, 5);
      await page.waitForTimeout(600);
    }
    await page.locator(".row-head").first().click();
    await page.waitForSelector("#finding-loss svg[role=img]", { timeout: 20000 });
    await page.waitForTimeout(500);
    await scrollTo(page, "#rows", w === 1440 ? 24 : 80);                  // below the menu pill at 390
    await page.waitForTimeout(300);
    await page.screenshot({ path: file(`landing-${w}-row-open.png`) });
    await ctx.close();
  }
  // Reduced motion: no preloader, no intro, the title still and wrapped; the hero, then the full page.
  {
    const ctx = await context(w, { seen: false, reducedMotion: "reduce" }), page = await landing(ctx);
    await page.screenshot({ path: file(`landing-${w}-reduced.png`) });
    await page.screenshot({ path: file(`landing-${w}-reduced-full.png`), fullPage: true });
    await ctx.close();
  }
}
await browser.close();
