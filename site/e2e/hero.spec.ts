// The hero: layout (no clipped annotations at any width or Π), the intro (once; skipped under reduced motion),
// dragging along the path, and browser frame time while dragging (simulation plus drawing).
// Frame-time target (author, 2026-10-16): p95 under 16 ms on the development laptop; HERO_P95_MS overrides it.
import { writeFileSync, mkdirSync } from "node:fs";
import { expect, test, type Page } from "./fixtures";

const P95_TARGET = Number(process.env.HERO_P95_MS ?? 16);

async function setPi(page: Page, Pi: number): Promise<void> {
  await page.evaluate((v) => {
    const input = document.querySelector<HTMLInputElement>("#hero-pi")!;
    input.value = String(Math.log10(v));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, Pi);
}

test("annotations and slider labels stay inside the figure at every width and Π", async ({ page }) => {
  test.setTimeout(120_000);
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("");
    await page.waitForSelector(".hero-canvas");
    for (const Pi of [0.001, 0.0326, 0.976, 1.67, 30, 368, 1000]) {
      await setPi(page, Pi);
      await page.waitForTimeout(80);
      const problems = await page.evaluate(() => {
        const out: string[] = [];
        const stage = document.querySelector(".hero-stage")!.getBoundingClientRect();
        for (const el of document.querySelectorAll(".hero-stage .annot-html")) {
          const r = el.getBoundingClientRect();
          if (r.left < stage.left - 0.5 || r.right > stage.right + 0.5 || r.top < stage.top - 0.5 || r.bottom > stage.bottom + 0.5)
            out.push(`annotation "${el.textContent!.trim().slice(0, 40)}" at [${Math.round(r.left - stage.left)}, ${Math.round(r.right - stage.left)}] of ${Math.round(stage.width)}`);
        }
        const svg = document.querySelector(".hero-slider svg")!.getBoundingClientRect();
        for (const t of document.querySelectorAll(".hero-slider svg text")) {
          const r = t.getBoundingClientRect();
          if (r.left < svg.left - 0.5 || r.right > svg.right + 0.5) out.push(`slider label "${t.textContent!.trim()}"`);
        }
        if (document.documentElement.scrollWidth > document.documentElement.clientWidth) out.push("page scrolls sideways");
        return out;
      });
      expect(problems, `${width}px, Π = ${Pi}`).toEqual([]);
    }
  }
});

test("the intro runs once and ends at the reader's first input", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("");
  const hero = page.locator("#fig-hero .figure-body");
  await expect(hero).toHaveAttribute("data-intro", "running");
  await expect(hero).toHaveAttribute("data-intro", "done", { timeout: 5000 });
  await page.mouse.wheel(0, 2000);                         // scroll away and back: no second run
  await page.mouse.wheel(0, -2000);
  await page.waitForTimeout(500);
  await expect(hero).toHaveAttribute("data-intro-runs", "1");

  await page.reload();
  await expect(hero).toHaveAttribute("data-intro", "running");
  await page.keyboard.press("Tab");                        // any input ends it at once
  await expect(hero).toHaveAttribute("data-intro", "done", { timeout: 500 });
});

test("the intro is skipped under prefers-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("");
  const hero = page.locator("#fig-hero .figure-body");
  await expect(hero).toHaveAttribute("data-intro", "skipped");
  await expect(page.locator("#hero-summary")).toContainText("keeps η =");
  expect(await hero.getAttribute("data-intro-runs")).toBeNull();
});

test("the data table says η is this case's, at each marked Π", async ({ page }) => {
  await page.goto("");
  const table = page.locator("#fig-hero .data-table");
  await expect(table.locator("caption")).toContainText("one equivalent stage");
  await expect(table).toContainText("Π of Nuclear thermal (Isp 900 s");
  await expect(table).toContainText("(hypothetical at 3.2 R☉)");
  const eta = await table.locator("tbody tr td:last-child").allTextContents();
  expect(eta.length).toBe(6);                                // current burn, three engines, two thresholds
  for (const v of eta) expect(Number(v)).toBeGreaterThan(0);
});

test("dragging along the path sets Π; frame time while dragging", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("");
  await page.waitForSelector(".hero-canvas");
  await page.locator(".hero-canvas").scrollIntoViewIfNeeded();       // pointer events need it on screen
  await page.waitForTimeout(100);
  const canvas = await page.locator(".hero-canvas").boundingBox();
  const body = page.locator("#fig-hero .figure-body");
  const probe = (expr: string) => body.evaluate((el, e) => {
    const p = (el as any).__heroProbe;
    return new Function("p", `return ${e}`)(p);
  }, expr);
  const piBefore = await page.locator("#hero-pi").inputValue();
  await page.evaluate(() => { (document.querySelector("#fig-hero .figure-body") as any).__heroFrames.length = 0; });

  // Grab the burn's later end and drag it out along the outgoing path, then back.
  const tau = (await probe("p.tau")) as number;
  const [, end] = (await probe("p.arcEnds()")) as { x: number; y: number }[];
  await page.mouse.move(canvas!.x + end.x, canvas!.y + end.y);
  await page.mouse.down();
  const ts = Array.from({ length: 60 }, (_, i) => 0.4 * tau * 10 ** (i / 25));        // Π ≈ 0.8 … 200 and back
  for (const t of [...ts, ...ts.slice().reverse()]) {
    const pt = (await probe(`p.pathAt(${t})`)) as { x: number; y: number };
    await page.mouse.move(canvas!.x + pt.x, canvas!.y + pt.y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  expect(await page.locator("#hero-pi").inputValue()).not.toBe(piBefore);

  // The full slider range, one change per frame (the top, Π = 1000, is the costliest simulation).
  await page.evaluate(async () => {
    const input = document.querySelector<HTMLInputElement>("#hero-pi")!;
    for (let i = 0; i <= 120; i++) {
      input.value = String(-3 + (6 * i) / 120);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
  });

  const frames = (await body.evaluate((el) => (el as any).__heroFrames)) as { ms: number; sim: boolean; Pi: number }[];
  const sim = frames.filter((f) => f.sim).map((f) => f.ms).sort((a, b) => a - b);
  const q = (p: number) => sim[Math.min(sim.length - 1, Math.floor(p * sim.length))];
  const atTop = frames.filter((f) => f.sim && f.Pi > 500).map((f) => f.ms);
  const stats = { frames_with_simulation: sim.length, p50_ms: q(0.5), p95_ms: q(0.95), max_ms: sim[sim.length - 1],
                  max_ms_at_Pi_above_500: Math.max(...atTop), target_p95_ms: P95_TARGET };
  console.log("hero frame time (simulation + drawing):", JSON.stringify(stats));
  mkdirSync("../runs", { recursive: true });
  writeFileSync("../runs/hero_frame_times.json", JSON.stringify(stats, null, 1));
  expect(sim.length).toBeGreaterThan(60);
  expect(stats.p95_ms).toBeLessThan(P95_TARGET);
});
