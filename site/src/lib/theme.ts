// Theme: follows the system setting by default; the reader can pin light or dark.
// The preference is a per-viewer convenience in localStorage (wrapped: storage can be unavailable).
// An inline script in each page's <head> applies it before first paint (no flash).
import { signal } from "./signal";

export type ThemePref = "system" | "light" | "dark";
const KEY = "oberth-theme";

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export const themePref = signal<ThemePref>(read());

const media = window.matchMedia("(prefers-color-scheme: dark)");
/** The theme actually shown (charts drawn on canvas redraw when it changes). */
export const themeShown = signal<"light" | "dark">(resolve(themePref.get()));

function resolve(p: ThemePref): "light" | "dark" {
  return p === "system" ? (media.matches ? "dark" : "light") : p;
}

themePref.subscribe((p) => {
  const root = document.documentElement;
  if (p === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", p);
  try {
    if (p === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, p);
  } catch {
    /* storage unavailable: the choice lasts for this page view */
  }
  themeShown.set(resolve(p));
});
media.addEventListener("change", () => themeShown.set(resolve(themePref.get())));

/** Current value of a CSS custom property (for canvas drawing). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
