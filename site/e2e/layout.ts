// Layout checks shared by the figure specs: inside a figure's .plot, HTML annotations and SVG text stay inside the
// plot and overlap neither each other nor (for annotations) the data marks.
import type { Locator } from "./fixtures";

export async function layoutProblems(fig: Locator): Promise<string[]> {
  return fig.evaluate((root) => {
    const plot = root.querySelector(".plot")!.getBoundingClientRect();
    const name = (e: Element) => (e.textContent ?? "").trim().slice(0, 30);
    const annots = [...root.querySelectorAll(".plot .overlay .annot-html")];
    const texts = [...root.querySelectorAll(".plot svg text")];
    const marks = [...root.querySelectorAll(".plot svg :is(.mark-sim, .mark-pub, .range-box)")];
    const out: string[] = [];
    const hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const inside = (r: DOMRect) => r.left >= plot.left - 1 && r.right <= plot.right + 1 && r.top >= plot.top - 1 && r.bottom <= plot.bottom + 1;
    annots.forEach((a, i) => {
      const r = a.getBoundingClientRect();
      if (!inside(r)) out.push(`"${name(a)}" leaves the plot`);
      for (const b of annots.slice(i + 1)) if (hit(r, b.getBoundingClientRect())) out.push(`"${name(a)}" overlaps "${name(b)}"`);
      for (const t of texts) if (hit(r, t.getBoundingClientRect())) out.push(`"${name(a)}" overlaps text "${name(t)}"`);
      for (const k of marks) if (hit(r, k.getBoundingClientRect())) out.push(`"${name(a)}" covers a mark`);
    });
    texts.forEach((a, i) => {
      const r = a.getBoundingClientRect();
      if (!inside(r)) out.push(`text "${name(a)}" leaves the plot`);
      for (const b of texts.slice(i + 1)) if (hit(r, b.getBoundingClientRect())) out.push(`text "${name(a)}" overlaps "${name(b)}"`);
    });
    return out;
  });
}
