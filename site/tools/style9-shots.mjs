// Phase 9 step 2 screenshots of the development-only style page (docs/revamp_plan.md §2.11), for the author's review:
// the preloader (a word, then the curtain lifting), the hero's final frame, the menu open, a findings row's hover
// preview and its keyboard-focus twin, reduced motion, and the full page, at 1440 × 900 and 390 × 844.
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
/** A page whose session has already seen the preloader (the inline gate reads this before the first paint). */
async function seen(w, extra) {
  const ctx = await context(w, extra);
  await ctx.addInitScript(() => sessionStorage.setItem("oberth-preloaded", "1"));
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForSelector("#landing-hero[data-intro='done'], #landing-hero[data-intro='skipped'], #landing-hero[data-intro='seen']", { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}

for (const w of [1440, 390]) {
  // The preloader, timed from the page's start as its own timing is (a word at 0.45 s, the curtain lifting at 1.5 s).
  {
    const ctx = await context(w), page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForFunction(() => document.documentElement.dataset.preloader === "running", null, { timeout: 20000 });
    await page.waitForFunction(() => performance.now() > 450, null, { polling: 10 });
    await page.screenshot({ path: file(`style-9-${w}-preloader-word.png`) });
    await page.waitForFunction(() => performance.now() > 1500, null, { polling: 10 });
    await page.screenshot({ path: file(`style-9-${w}-preloader-lift.png`) });
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
    const { pre, intro } = await page.evaluate(() => ({ pre: document.documentElement.dataset.preloaderMs, intro: window.__intro }));
    console.log(`${w}: preloader gone ${pre} ms after the page's start; dive intro ${Math.round(intro.done - intro.running)} ms`);
    await ctx.close();
  }
  // Menu open: at 1440 from the round button after scrolling (it waits off screen until then); at 390 from the top.
  {
    const { ctx, page } = await seen(w);
    if (w === 1440) { await page.mouse.wheel(0, 700); await page.waitForTimeout(1200); }
    await page.click(".menu9-toggle");
    await page.waitForTimeout(1100);
    await page.screenshot({ path: file(`style-9-${w}-menu.png`) });
    await ctx.close();
  }
  // Reduced motion: no preloader, the title still and wrapped, no pause control.
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
    await page.waitForTimeout(800);
    await page.screenshot({ path: file(`style-9-${w}.png`), fullPage: true });
    await ctx.close();
  }
}

// The findings preview at 1440: following the pointer over row 2, and placed beside row 3 by keyboard focus.
{
  const { ctx, page } = await seen(1440);
  await page.locator("#findings9").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  const row = page.locator(".rows9 a").nth(1);
  const box = await row.boundingBox();
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.3);
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5, { steps: 12 });
  await page.waitForTimeout(1300);
  await page.screenshot({ path: file("style-9-1440-hover-preview.png") });
  await page.mouse.move(5, 5);
  await page.locator(".rows9 a").nth(1).focus();
  await page.keyboard.press("Tab");
  await page.waitForTimeout(900);
  await page.screenshot({ path: file("style-9-1440-focus-preview.png") });
  await ctx.close();
}
await browser.close();
