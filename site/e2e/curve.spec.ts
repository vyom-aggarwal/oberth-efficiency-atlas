// The universal curve on the home page: annotations and SVG text stay inside the plot and do not overlap, in both
// curve modes. A plot narrower than 640 px has no on-plot case labels (the legend names the marks), but still has
// the thresholds and, in family mode, each curve's v∞/v_esc.
import { expect, test } from "./fixtures";

for (const width of [390, 600, 768, 1024, 1440]) {
  test(`universal-curve annotations do not collide at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("");
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
