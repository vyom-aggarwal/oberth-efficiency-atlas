// The faintest a·v stroke, measured on screen (Phase 8, the author's fix 6, 2026-10-23: the pale end of the SEP lane
// nearly disappeared in the light preview). On the landing hero's lanes, Figure 7's three panels, the article hero's
// thrust arc (at Π = 368, a long arc) and the explorer's (Jupiter, Hall thruster: a long burn), the last two added
// 2026-10-26 when they too were drawn one path per run, in both themes, at the final frame: the faintest a·v step
// each canvas drew (it records them in data-av-steps), the pixels rendered in
// that step's colour at full strength (within 2 per channel, with a neighbour in it too), and the contrast of their
// mean colour against the surface pixel the canvas painted beneath (sampled from its corner; it must equal the panel's
// colour). Phase 6's thin-mark rule: at least 2:1. The values are written to runs/av_stroke_contrast.json.
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "./fixtures";

interface Measure { canvas: string; theme: string; steps: string; step: number; token: string; rendered: string;
                    pixels: number; surface: string; panel: string; contrast: number }
const results: Measure[] = [];

async function measure(page: Page, selector: string, label: string, theme: string): Promise<Measure[]> {
  return page.evaluate(({ selector, label, theme }) => {
    const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const lum = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const contrast = (a: number[], b: number[]) => { const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
    const hex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const out: Measure[] = [];
    document.querySelectorAll<HTMLCanvasElement>(selector).forEach((cv, ci) => {
      const drawn = (cv.dataset.avSteps ?? "").split(",").filter(Boolean).map(Number);
      if (!drawn.length) return;
      const step = Math.min(...drawn);                                // step 1 is the faint end in both themes
      const token = getComputedStyle(document.documentElement).getPropertyValue(`--av-${step}`).trim();
      const s = rgb(token);
      const { data } = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height);
      const W = cv.width, H = cv.height;
      const is = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= W || y >= H) return false;
        const i = 4 * (y * W + x);
        return Math.abs(data[i] - s[0]) <= 2 && Math.abs(data[i + 1] - s[1]) <= 2 && Math.abs(data[i + 2] - s[2]) <= 2;
      };
      const sum = [0, 0, 0];
      let n = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!is(x, y) || !(is(x - 1, y) || is(x + 1, y) || is(x, y - 1) || is(x, y + 1))) continue;
        const i = 4 * (y * W + x);
        sum[0] += data[i]; sum[1] += data[i + 1]; sum[2] += data[i + 2]; n++;
      }
      const surface = [data[0], data[1], data[2]];
      const panel = getComputedStyle(cv.closest(".figure, .landing-hero, .explorer-view")!).backgroundColor.match(/\d+/g)!.slice(0, 3).map(Number);
      const rendered = n ? sum.map((v) => v / n) : s;
      out.push({ canvas: `${label}${ci ? ` ${ci + 1}` : ""}`, theme, steps: drawn.join(","), step, token, rendered: hex(rendered),
                 pixels: n, surface: hex(surface), panel: hex(panel), contrast: Math.round(contrast(rendered, surface) * 100) / 100 });
    });
    return out;
  }, { selector, label, theme });
}

for (const theme of ["light", "dark"] as const) {
  test(`the faintest a·v stroke on screen is at least 2:1 against its panel (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });         // the final frame: every burn drawn
    await page.goto("");
    await expect(page.locator(".lh-dive")).toHaveAttribute("data-av-steps", /\d/);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const hero = await measure(page, ".lh-dive", "landing hero lanes", theme);
    await page.goto("research/");
    const fig = page.locator("#fig-engines");
    await fig.scrollIntoViewIfNeeded();
    await expect(fig.locator("canvas.engine-canvas").first()).toBeVisible();
    // Run the clock to its end, so each panel shows its whole burn.
    await fig.locator('input[type="range"]').first().evaluate((r: HTMLInputElement) => {
      r.value = r.max; r.dispatchEvent(new Event("input", { bubbles: true }));
    });
    for (const cv of await fig.locator("canvas.engine-canvas").all()) await expect(cv).toHaveAttribute("data-av-steps", /\d/);   // drawn
    await page.waitForTimeout(300);
    const engines = await measure(page, "#fig-engines canvas.engine-canvas", "Figure 7 panel", theme);
    // The article hero at Π = 368 (its slider is log₁₀ Π), where the thrust arc is long rather than a dot.
    await page.locator("#fig-hero").scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>("#hero-pi")!;
      input.value = String(Math.log10(368));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect(page.locator("#fig-hero canvas.hero-canvas")).toHaveAttribute("data-av-steps", /,/);   // a stroke, several steps
    await page.waitForTimeout(300);
    const article = await measure(page, "#fig-hero canvas.hero-canvas", "article hero arc", theme);
    await page.goto("explorer/?preset=jupiter.hall");
    const view = page.locator(".explorer-canvas");
    await expect(view).toHaveAttribute("data-av-steps", /,/);
    // The burn's faint ends lie outside the default view (it records only the steps inside it): zoom out with the
    // view's own key ("−", 0.8× a press) until step 1 is on screen.
    await view.focus();
    for (let n = 0; n < 20 && !/^1(,|$)/.test((await view.getAttribute("data-av-steps")) ?? ""); n++) await page.keyboard.press("-");
    await expect(view, "the faintest step in view").toHaveAttribute("data-av-steps", /^1,/);
    await page.waitForTimeout(300);
    const explorer = await measure(page, ".explorer-canvas", "explorer burn", theme);
    const all = [...hero, ...engines, ...article, ...explorer];
    results.push(...all);
    console.log(`${theme}: ${all.map((m) => `${m.canvas} (steps ${m.steps})`).join("; ")}`);
    expect(all.length, "canvases measured: the landing hero, Figure 7's three panels, the article hero, the explorer").toBe(6);
    for (const m of all) {
      expect(m.surface, `${m.canvas}: the canvas paints its panel's colour`).toBe(m.panel);
      expect(m.pixels, `${m.canvas}: a·v step ${m.step} rendered at full strength`).toBeGreaterThan(0);
      expect(m.contrast, `${m.canvas}: a·v step ${m.step} (${m.rendered}) on ${m.surface}`).toBeGreaterThanOrEqual(2);
    }
  });
}

test.afterAll(() => {
  if (!results.length) return;
  mkdirSync("../runs", { recursive: true });
  writeFileSync("../runs/av_stroke_contrast.json", JSON.stringify(results, null, 1) + "\n");
});
