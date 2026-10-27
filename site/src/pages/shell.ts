// What every page shares: styles, the theme switch, the narrow-screen menu, and the current-page link.
import "katex/dist/katex.min.css";
import "../styles/palette.css";
import "../styles/fonts.css";
import "../styles/base.css";
import "../styles/controls.css";
import "../styles/chart.css";
import "../styles/layout.css";

import { segmented } from "../controls/segmented";
import { themePref, type ThemePref } from "../lib/theme";

export function initShell(page: "landing" | "research" | "references" | "explorer" | "notfound" | "style"): void {
  const sw = document.querySelector<HTMLElement>("[data-theme-switch]");
  sw?.append(segmented<ThemePref>("theme", "Theme", [["system", "System"], ["light", "Light"], ["dark", "Dark"]], themePref));

  document.querySelector(`.site-nav a[data-page="${page}"]`)?.setAttribute("aria-current", "page");

  // Copy buttons (the footer's citation): shown only where the clipboard API exists; the result is announced.
  for (const b of document.querySelectorAll<HTMLButtonElement>("button[data-copy]")) {
    const from = document.querySelector(b.dataset.copy!);
    if (!from || !navigator.clipboard) continue;
    const status = document.createElement("span");
    status.className = "visually-hidden";
    status.setAttribute("aria-live", "polite");
    b.after(status);
    b.hidden = false;
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(from.textContent?.trim() ?? "");
        status.textContent = "Citation copied";
        b.textContent = "Copied";
      } catch {
        status.textContent = "Copying failed";
      }
      setTimeout(() => { b.textContent = "Copy"; status.textContent = ""; }, 2000);
    });
  }

  // Narrow screens: the menu folds behind a button (without JavaScript it simply stays open).
  const button = document.querySelector<HTMLButtonElement>(".menu-button");
  const menu = document.getElementById("site-menu");
  if (button && menu) {
    button.hidden = false;
    document.documentElement.classList.add("js-menu");
    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(open));
      menu.classList.toggle("open", open);
    });
    // Escape closes the open menu, from the button or from inside the menu.
    button.closest(".site-header")?.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Escape" && button.getAttribute("aria-expanded") === "true") {
        button.click();
        button.focus();
      }
    });
  }

  trackSticky();
}

/**
 * The sticky elements over the content (author, 2026-10-26, after PR #1): the site header from 900 px and the article's
 * section bar below 1180 px. Their heights are measured, never assumed, and kept current on resize:
 * - --header-h: the header's height where it sticks, else 0; the section bar and the side rail stick below it;
 * - --sticky-top: the header's and the section bar's heights together, the base of scroll-padding-top, so a link
 *   target, a citation jump or a focused control always lands below them.
 * The section bar counts with its list closed: its title can wrap, but an open list is not a lasting overlay.
 */
function trackSticky(): void {
  const root = document.documentElement;
  const header = document.querySelector<HTMLElement>(".site-header");
  const bar = document.querySelector<HTMLElement>(".section-nav-mobile");
  const barTitle = bar?.querySelector<HTMLElement>("summary");
  const update = () => {
    const sticks = (e: HTMLElement) => { const cs = getComputedStyle(e); return cs.display !== "none" && cs.position === "sticky"; };
    const headerH = header && sticks(header) ? header.offsetHeight : 0;
    let barH = 0;
    if (bar && barTitle && sticks(bar)) {
      const cs = getComputedStyle(bar);
      barH = barTitle.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
    }
    root.style.setProperty("--header-h", `${Math.ceil(headerH)}px`);
    root.style.setProperty("--sticky-top", `${Math.ceil(headerH + barH)}px`);
  };
  const ro = new ResizeObserver(update);
  for (const e of [header, barTitle]) if (e) ro.observe(e);
  window.addEventListener("resize", update);                 // crossing a breakpoint can switch stickiness without a resize
  update();
}
