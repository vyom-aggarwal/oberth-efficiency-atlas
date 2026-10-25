// Text inside figure panels at phone widths (Phase 8, the author's fix 2, 2026-10-23: at 390 px the hero strip's axis
// title ran to the panel edge). At 360 and 390 px, on every page with figures, every piece of text inside a panel
// (.figure, .finding, .landing-hero, .explorer-view, .explorer-place-fig) stays inside the panel's padding box: SVG
// text (tick labels, axis titles, annotations), HTML text (titles, keys, legends, notes, captions, controls) and the
// KaTeX overlays. On-plot text (SVG text and HTML annotations) overlaps no other on-plot text in the same panel.
// Canvas labels report their own fit (data-labels-clipped). Scrollable tables are left out: they scroll by design.
import { expect, test, type Page } from "./fixtures";

const PAGES = ["", "research/", "explorer/"];
const PANELS = ".figure, .finding, .landing-hero, .explorer-view, .explorer-place-fig";

async function problems(page: Page): Promise<string[]> {
  return page.evaluate((sel) => {
    const SKIP = ".table-scroll, select, option, .visually-hidden, .tooltip, .katex-mathml, script, style";
    const out: string[] = [];
    const name = (t: string) => `"${t.trim().replace(/\s+/g, " ").slice(0, 40)}"`;
    const hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    document.querySelectorAll<HTMLElement>(sel).forEach((panel, pi) => {
      const r = panel.getBoundingClientRect();
      if (!r.width || !r.height) return;                               // not shown (e.g. an unmounted figure)
      const cs = getComputedStyle(panel);
      const box = { left: r.left + parseFloat(cs.paddingLeft), right: r.right - parseFloat(cs.paddingRight),
                    top: r.top + parseFloat(cs.paddingTop), bottom: r.bottom - parseFloat(cs.paddingBottom) };
      const where = `${panel.id || panel.className.split(" ")[0]}#${pi}`;
      const inside = (b: DOMRect, what: string) => {
        if (b.left < box.left - 1 || b.right > box.right + 1 || b.top < box.top - 1 || b.bottom > box.bottom + 1)
          out.push(`${where}: ${what} reaches past the panel's padding (${Math.round(b.left - box.left)}, ${Math.round(box.right - b.right)} px)`);
      };
      // HTML text, run by run (SVG text is measured per element below).
      const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      const hidden = (el: Element) => {                               // inside a closed disclosure (not its summary)
        const d = el.closest("details");
        return !!d && !d.open && !el.closest("summary");
      };
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || el.closest(SKIP) || el.closest("svg") || hidden(el) || !(n.textContent ?? "").trim()) continue;
        range.selectNodeContents(n);
        for (const b of range.getClientRects()) if (b.width > 0 && b.height > 0) inside(b, `text ${name(n.textContent ?? "")}`);
      }
      // On-plot text: SVG text elements and HTML annotations.
      const plotText = [...panel.querySelectorAll<Element>("svg text, .annot-html")]
        .filter((e) => !e.closest(SKIP))
        .map((e) => ({ e, b: e.getBoundingClientRect() }))
        .filter(({ b }) => b.width > 0 && b.height > 0);
      plotText.forEach(({ e, b }, i) => {
        if (e.tagName.toLowerCase() === "text") inside(b, `SVG text ${name(e.textContent ?? "")}`);
        for (const o of plotText.slice(i + 1)) {
          if (e.contains(o.e) || o.e.contains(e)) continue;
          if (hit(b, o.b)) out.push(`${where}: ${name(e.textContent ?? "")} overlaps ${name(o.e.textContent ?? "")}`);
        }
      });
      for (const c of panel.querySelectorAll<HTMLCanvasElement>("canvas[data-labels-clipped]"))
        if (c.dataset.labelsClipped !== "0") out.push(`${where}: ${c.dataset.labelsClipped} canvas label(s) clipped`);
    });
    return out;
  }, PANELS);
}

for (const path of PAGES) {
  for (const width of [360, 390]) {
    test(`text stays inside its figure panel: ${path || "landing"} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.evaluate(async () => {                               // mount the lazily drawn figures
        for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
      });
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);                                // redraws after the fonts load
      expect(await page.locator(PANELS).count(), "panels on the page").toBeGreaterThan(0);
      expect(await problems(page)).toEqual([]);
    });
  }
}
