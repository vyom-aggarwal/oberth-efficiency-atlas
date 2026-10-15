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

export function initShell(page: "home" | "explorer" | "notfound" | "style"): void {
  const sw = document.querySelector<HTMLElement>("[data-theme-switch]");
  sw?.append(segmented<ThemePref>("theme", "Theme", [["system", "System"], ["light", "Light"], ["dark", "Dark"]], themePref));

  document.querySelector(`.site-nav a[data-page="${page}"]`)?.setAttribute("aria-current", "page");

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
}
