// Notation (Phase 8, author's fix 3, 2026-10-23): subscripts are typeset (KaTeX, <sub>, SVG tspans, or Unicode
// subscript letters on canvas), never written with an underscore. No text the site displays, nor any accessible name
// or tooltip, contains "_" outside code (<code>, <pre>, <kbd>, <samp>) and URLs. Checked on every page at both widths,
// in the universal curve's second mode, and in every figure's tooltips (each hit target focused in turn). The
// development notes of unwritten sections (TODO banners and checklists, hidden in production) are left out; KaTeX's
// MathML copy of its TeX source is not displayed.
import { expect, test, type Page } from "./fixtures";

const PAGES = ["", "research/", "explorer/", "references/", "404.html"];

async function underscores(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const SKIP = "code, pre, kbd, samp, script, style, noscript, template, .katex-mathml, .slot-todo, .todo-banner, .todo-notes";
    const clean = (t: string) => t.replace(/https?:\/\/\S+/g, "");
    const where = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${typeof el.className === "string" && el.className ? `.${el.className.split(" ")[0]}` : ""}`;
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest(SKIP)) continue;
      const t = clean(n.textContent ?? "");
      if (t.includes("_")) out.push(`${where(el)}: "${t.trim().slice(0, 90)}"`);
    }
    for (const el of document.querySelectorAll("[aria-label], [title], [alt]")) {
      if (el.closest(SKIP)) continue;
      for (const a of ["aria-label", "title", "alt"]) {
        const v = el.getAttribute(a);
        if (v && clean(v).includes("_")) out.push(`${a} of ${where(el)}: "${v.slice(0, 90)}"`);
      }
    }
    return out;
  });
}

/** The text of every tooltip on the page: each figure's hit targets focused in turn. */
async function tooltipTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const plot of document.querySelectorAll<HTMLElement>(".plot")) {
      const tip = plot.querySelector<HTMLElement>(".tooltip");
      if (!tip) continue;
      for (const hit of [...plot.querySelectorAll<SVGElement>("svg .hit")].slice(0, 80)) {
        hit.dispatchEvent(new FocusEvent("focus"));
        (hit as unknown as HTMLElement).focus?.();
        const copy = tip.cloneNode(true) as HTMLElement;              // as on the page: code and KaTeX's MathML left out
        for (const c of copy.querySelectorAll("code, pre, kbd, samp, .katex-mathml")) c.remove();
        out.push(copy.textContent ?? "");
        hit.dispatchEvent(new FocusEvent("blur"));
      }
    }
    return out;
  });
}

for (const path of PAGES) {
  for (const width of [1440, 390]) {
    test(`no underscore in displayed text: ${path || "landing"} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.evaluate(async () => {                               // mount the lazily drawn figures
        for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
      });
      await page.waitForLoadState("networkidle");
      const found = await underscores(page);
      const tips = (await tooltipTexts(page)).filter((t) => t.replace(/https?:\/\/\S+/g, "").includes("_"));
      found.push(...[...new Set(tips)].map((t) => `tooltip: "${t.slice(0, 120)}"`));
      const family = page.locator('#fig-universal-curve .segmented input[value="family"]');
      if (await family.count()) {
        await family.check();
        await page.waitForTimeout(100);
        found.push(...(await underscores(page)).map((t) => `family mode: ${t}`));
      }
      expect([...new Set(found)]).toEqual([]);
    });
  }
}
