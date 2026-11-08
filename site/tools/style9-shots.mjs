// Phase 9 step 2 screenshots of the development-only style page (docs/revamp_plan.md §2.11), for the author's review,
// at 1440 × 900 and 390 × 844: the flyby preloader (in flight, then every stage up), the hero mid-intro and final, the
// dive docking and steered by the findings rows (pointer and keyboard), a row open in place, the menu, the closing
// section's escape leg, reduced motion, the article, explorer and references samples, and the full page.
// Run in site/ with the dev server up (npm run dev):  node tools/style9-shots.mjs   → ../docs/screens/phase-9-style/
// Also prints the preloader's measured length and the dive intro's, from page attributes.
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.STYLE9_URL ?? "http://localhost:5173/style-9/";
const OUT = new URL("../../docs/screens/phase-9-style/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const file = (name) => new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SIZES = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } };
const browser = await chromium.launch({ channel: "chrome" });
const context = (w, extra = {}) => browser.newContext({ viewport: SIZES[w], deviceScaleFactor: 1, ...extra });
const settled = "#landing-hero[data-intro='done'], #landing-hero[data-intro='skipped'], #landing-hero[data-intro='seen']";
/** A page whose session has already seen the preloader and the intro (both read sessionStorage). */
async function seen(w, extra) {
  const ctx = await context(w, extra);
  await ctx.addInitScript(() => { sessionStorage.setItem("oberth-preloaded", "1"); sessionStorage.setItem("oberth-landing-intro", "1"); });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForSelector(settled, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}
/** Figure 2 and the explorer mount when they near the viewport: pass them once, then return to the top. */
async function mountAll(page) {
  for (const sel of [".article9 figure.figure", "[data-explorer]"]) { await page.locator(sel).scrollIntoViewIfNeeded(); await page.waitForTimeout(300); }
  await page.waitForSelector(".article9 .figure svg", { timeout: 20000 });
  await page.waitForSelector(".explorer-readouts dl", { timeout: 20000 });
  await page.evaluate(() => window.scrollTo(0, 0));
}
/** Scroll so an element's top sits at y (Lenis is off in headless runs: no fine hover pointer). */
const scrollTo = (page, sel, y = 0) => page.evaluate(([s, y]) => { const e = document.querySelector(s); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - y); }, [sel, y]);

for (const w of [1440, 390]) {
  // The preloader, timed from the page's start as its own timing is: in flight at 0.75 s, every stage up at 1.2 s; then
  // the hero 1.2 s into its intro, and its final frame.
  {
    const ctx = await context(w), page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForFunction(() => document.documentElement.dataset.preloader === "running", null, { timeout: 20000 });
    await page.waitForFunction(() => performance.now() > 750, null, { polling: 10 });
    await page.screenshot({ path: file(`style-9-${w}-preloader-flight.png`) });
    await page.waitForFunction(() => performance.now() > 1200, null, { polling: 10 });
    await page.screenshot({ path: file(`style-9-${w}-preloader-stages.png`) });
    await page.waitForSelector("#landing-hero[data-intro='running']", { timeout: 10000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: file(`style-9-${w}-hero-intro.png`) });
    await page.waitForSelector("#landing-hero[data-intro='done']", { timeout: 10000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: file(`style-9-${w}-hero.png`) });
    await ctx.close();
  }
  // Their lengths, in page time, from a session that takes no screenshots (a capture stalls the page's frames).
  {
    const ctx = await context(w), page = await ctx.newPage();
    await ctx.addInitScript(() => {
      window.__intro = {};
      new MutationObserver((ms) => ms.forEach((m) => { const v = m.target.dataset?.intro; if (v && !(v in window.__intro)) window.__intro[v] = performance.now(); }))
        .observe(document, { subtree: true, attributes: true, attributeFilter: ["data-intro"] });
    });
    await page.goto(BASE);
    await page.waitForSelector("#landing-hero[data-intro='done']", { timeout: 20000 });
    const { pre, start, faded, intro } = await page.evaluate(() => ({ pre: document.documentElement.dataset.preloaderMs,
      start: document.documentElement.dataset.preloaderStart, faded: document.documentElement.dataset.preloaderFaded, intro: window.__intro }));
    console.log(`${w}: preloader script from ${start} ms, faded by ${faded} ms, removed ${pre} ms after the page's start; ` +
      `dive intro ${Math.round(intro.done - intro.running)} ms`);
    await ctx.close();
  }
  // Menu open: at 1440 from the pill after scrolling (it waits until the header has gone); at 390 from the top.
  {
    const { ctx, page } = await seen(w);
    if (w === 1440) { await page.evaluate(() => window.scrollTo(0, 400)); await page.waitForTimeout(400); }
    await page.click(".menu9-pill");
    await page.waitForTimeout(700);
    await page.screenshot({ path: file(`style-9-${w}-menu.png`) });
    await ctx.close();
  }
  // Findings. At 1440: the dive mid-slide, then docked and steered by the pointer (row 3) and by keyboard focus (row 1),
  // then row 1 open in place. At 390 (no dock): row 1 open in place.
  {
    const { ctx, page } = await seen(w);
    if (w === 1440) {
      const from = await page.evaluate(() => { const r = document.getElementById("role9"); return r.offsetTop + r.offsetHeight - 96 + 16; });
      await page.evaluate((y) => window.scrollTo(0, y + 0.15 * innerHeight), from);
      await page.waitForTimeout(300);
      await page.screenshot({ path: file("style-9-1440-dock-slide.png") });
      await scrollTo(page, "#findings9-title", 120);
      await page.waitForTimeout(400);
      const row = page.locator(".row9-head").nth(2), box = await row.boundingBox();
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5, { steps: 6 });
      await page.waitForTimeout(900);
      await page.screenshot({ path: file("style-9-1440-steer-hover.png") });
      await page.mouse.move(5, 5);
      await page.waitForTimeout(700);
      // Row 02 does not steer (author, 2026-11-02), so keyboard focus reaches row 01 from it.
      await page.locator(".row9-head").nth(1).focus();
      await page.keyboard.press("Shift+Tab");
      await page.waitForTimeout(900);
      await page.screenshot({ path: file("style-9-1440-steer-focus.png") });
      await page.keyboard.press("Enter");
      await page.mouse.move(box.x + box.width * 0.3, 60);
    } else {
      await scrollTo(page, "#findings9-title", 24);
      await page.locator(".row9-head").nth(0).click();
    }
    await page.waitForSelector("#pv9-1 svg", { timeout: 10000 });
    await page.waitForTimeout(900);
    await scrollTo(page, ".rows9", w === 1440 ? 140 : 24);
    await page.waitForTimeout(400);
    await page.screenshot({ path: file(`style-9-${w}-row-open.png`) });
    await ctx.close();
  }
  // The closing section, its escape leg drawn as it scrolls in.
  {
    const { ctx, page } = await seen(w);
    await mountAll(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(600);
    await page.screenshot({ path: file(`style-9-${w}-closing.png`) });
    await ctx.close();
  }
  // The article, explorer and references samples, each section whole; at 1440 also Figure 2 with a tooltip open.
  {
    const { ctx, page } = await seen(w);
    await mountAll(page);
    for (const [id, name] of [["article9", "article"], ["explorer9", "explorer"], ["refs9", "references"]]) {
      const sec = page.locator(`section[aria-labelledby='${id}']`);
      await sec.scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      await sec.screenshot({ path: file(`style-9-${w}-${name}.png`) });
    }
    if (w === 1440) {
      const fig = page.locator(".article9 figure.figure");
      await fig.scrollIntoViewIfNeeded();
      const hit = page.locator(".article9 .hit").first(), hb = await hit.boundingBox();
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2, { steps: 4 });
      await page.waitForTimeout(500);
      await fig.screenshot({ path: file("style-9-1440-article-tooltip.png") });
    }
    await ctx.close();
  }
  // Reduced motion: no preloader, the title still and wrapped, no intro, the dive moved in one step.
  {
    const ctx = await context(w, { reducedMotion: "reduce" }), page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForSelector("#landing-hero[data-intro='skipped']", { timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: file(`style-9-${w}-reduced.png`), fullPage: w === 390 });    // 390: the title is below the fold
    await ctx.close();
  }
  // The full page (the preloader already seen).
  {
    const { ctx, page } = await seen(w);
    await mountAll(page);
    await page.waitForTimeout(800);
    await page.screenshot({ path: file(`style-9-${w}.png`), fullPage: true });
    await ctx.close();
  }
}
await browser.close();
