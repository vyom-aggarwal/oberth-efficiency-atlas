// The universal curve on the home page: annotations and SVG text stay inside the plot and do not overlap, in both
// curve modes. A plot narrower than 640 px has no on-plot case labels (the legend names the marks), but still has
// the thresholds and, in family mode, each curve's v∞/v_esc.
import { expect, test } from "./fixtures";

// Where the plot has no labels (author, 2026-10-18: accepted at 640–900 px of plot), the legend names the marks:
// it sits directly under the plot, and its markers differ by shape (geometry, dash, filled or hollow), not only
// by colour.
for (const width of [390, 768, 1440]) {
  test(`the legend sits under the plot and its markers differ by shape at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("research/");
    const fig = page.locator("#fig-universal-curve");
    await fig.scrollIntoViewIfNeeded();
    await expect(fig.locator(".plot svg path.band")).toBeVisible();
    const r = await fig.evaluate((root) => {
      const plot = root.querySelector(".plot")!, legend = plot.nextElementSibling!;
      const geometry = ["d", "r", "x", "y", "width", "height", "x1", "x2", "y1", "y2"];
      const shape = (svg: SVGSVGElement) => [...svg.children].map((c) => {
        const cs = getComputedStyle(c);
        return [c.tagName, ...geometry.map((a) => c.getAttribute(a) ?? ""), cs.strokeDasharray,
                cs.fill === "none" || cs.fill === getComputedStyle(document.body).backgroundColor ? "hollow" : "filled"].join(":");
      }).join("|");
      const items = [...legend.querySelectorAll("li")].map((li) => ({ name: li.textContent!.trim().slice(0, 30), shape: shape(li.querySelector("svg")!) }));
      return { isLegend: legend.matches("ul.legend"), gap: legend.getBoundingClientRect().top - plot.getBoundingClientRect().bottom, items };
    });
    expect(r.isLegend, "the element after the plot is the legend").toBe(true);
    expect(r.gap).toBeGreaterThanOrEqual(0);
    expect(r.gap).toBeLessThanOrEqual(24);
    expect(r.items.length, "4 cases, mission samples, band, bound, thresholds").toBe(8);
    if (process.env.SHOW_SHAPES) console.log(JSON.stringify(r.items, null, 1));
    const dupes = r.items.filter((a, i) => r.items.some((b, j) => j !== i && b.shape === a.shape)).map((a) => a.name);
    expect(dupes, "legend items with the same marker shape").toEqual([]);
  });
}

for (const width of [390, 600, 768, 1024, 1440]) {
  test(`universal-curve annotations do not collide at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("research/");
    const fig = page.locator("#fig-universal-curve");
    await fig.scrollIntoViewIfNeeded();
    await expect(fig.locator(".plot svg path.band")).toBeVisible();
    for (const mode of ["band", "family"]) {
      await fig.locator(`.segmented input[value="${mode}"]`).check({ force: true });
      await page.waitForTimeout(100);
      const problems = await fig.evaluate((root) => {
        const plot = root.querySelector(".plot")!.getBoundingClientRect();
        const name = (e: Element) => (e.textContent ?? "").trim().slice(0, 30);
        const annots = [...root.querySelectorAll(".plot .overlay .annot-html")];
        const texts = [...root.querySelectorAll(".plot svg text")];
        const out: string[] = [];
        const hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        annots.forEach((a, i) => {
          const r = a.getBoundingClientRect();
          if (r.left < plot.left - 1 || r.right > plot.right + 1 || r.top < plot.top - 1 || r.bottom > plot.bottom + 1)
            out.push(`"${name(a)}" leaves the plot`);
          for (const b of annots.slice(i + 1)) if (hit(r, b.getBoundingClientRect())) out.push(`"${name(a)}" overlaps "${name(b)}"`);
          for (const t of texts) if (hit(r, t.getBoundingClientRect())) out.push(`"${name(a)}" overlaps text "${name(t)}"`);
          for (const k of root.querySelectorAll(".plot svg :is(.mark-sim, .mark-pub, .range-box)"))
            if (hit(r, k.getBoundingClientRect())) out.push(`"${name(a)}" covers a mark`);
        });
        texts.forEach((a, i) => {
          for (const b of texts.slice(i + 1)) if (hit(a.getBoundingClientRect(), b.getBoundingClientRect())) out.push(`text "${name(a)}" overlaps "${name(b)}"`);
        });
        return out;
      });
      expect(problems, `${width}px, ${mode}`).toEqual([]);
    }
  });
}
