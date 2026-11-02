// Theme: dark only (Phase 9, docs/revamp_plan.md §2.1; pass 1, 2026-11-02). The light theme and the reader's switch are
// gone, so nothing changes the colours after load. `themeShown` stays for the canvas charts, which redraw when it
// changes, so the chart modules are unchanged; it never changes now.
import { signal } from "./signal";

/** The theme shown: always dark. */
export const themeShown = signal<"dark">("dark");

/** Current value of a CSS custom property (for canvas drawing), read on `el`: a canvas reads --surface from its panel. */
export function cssVar(name: string, el: Element = document.documentElement): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}
