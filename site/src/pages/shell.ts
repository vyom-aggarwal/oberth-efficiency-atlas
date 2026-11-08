// What every page shares (Phase 9 pass 2, docs/revamp_plan.md §2.4): styles (dark only), the header's current-page
// link, the menu pill and drawer, the closing section's escape leg, the footer's Copy button, and the sticky and fixed
// elements' measurements for scroll padding.
//
// Adapted from Suhas Beemineni's portfolio, https://github.com/suhaslord/portfolio at commit c98c5cc (MIT licence,
// "Copyright (c) 2026 SuahsTheLord"; THIRD_PARTY_NOTICES.md), js/site.js: the menu drawer's open, close and focus
// handling (the keyboard's instant path, the Tab cycle, Escape, focus return). The pill, the escape leg and the rest
// are this project's own (§1.3).
import "katex/dist/katex.min.css";
import "../styles/palette.css";
import "../styles/fonts.css";
import "../styles/base.css";
import "../styles/controls.css";
import "../styles/chart.css";
import "../styles/layout.css";
import "../styles/shell.css";
import { s } from "../lib/dom";

export function initShell(page: "landing" | "research" | "references" | "explorer" | "about" | "notfound"): void {
  for (const a of document.querySelectorAll(`.site-nav a[data-page="${page}"], .menu-pages a[data-page="${page}"]`))
    a.setAttribute("aria-current", "page");

  // Copy buttons (the footer's citation): shown only where the clipboard API exists; the result is announced.
  for (const b of document.querySelectorAll<HTMLButtonElement>("button[data-copy]")) {
    const from = document.querySelector(b.dataset.copy!);
    if (!from || !navigator.clipboard) continue;
    const status = document.createElement("span");
    status.className = "visually-hidden";
    status.setAttribute("aria-live", "polite");
    b.after(status);
    b.hidden = false;
    const label = b.textContent;                    // "Copy", "Copy BibTeX", "Cite": restored after the confirmation
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(from.textContent?.trim() ?? "");
        status.textContent = "Citation copied";
        b.textContent = "Copied";
      } catch {
        status.textContent = "Copying failed";
      }
      setTimeout(() => { b.textContent = label; status.textContent = ""; }, 2000);
    });
  }

  initMenu();
  initEscapeLeg();
  trackSticky();
}

/**
 * The menu: a text pill ("Menu", or "Close" while open) and the drawer. From 900 px the header's links are inline and
 * the pill appears once the header has scrolled out of view; below 900 px it is always there. While the drawer is open
 * the rest of the page is inert, Tab cycles between the pill and the drawer's links, Escape closes it, and focus
 * returns to where it was. Opened or closed from the keyboard (a click with detail 0), it moves without motion.
 */
function initMenu(): void {
  const root = document.documentElement;
  const pill = document.querySelector<HTMLButtonElement>(".menu-pill");
  const drawer = document.getElementById("site-drawer");
  const scrim = document.querySelector<HTMLElement>("[data-menu-scrim]");
  const header = document.querySelector<HTMLElement>(".site-header");
  if (!pill || !drawer || !scrim || !header) return;
  root.classList.add("js-menu");
  pill.hidden = false;
  const background = () => [...document.querySelectorAll<HTMLElement>(".skip-link, .site-header, main, .site-closing")];
  let open = false, returnFocus: HTMLElement | null = null;
  const openMenu = (instant: boolean) => {
    returnFocus = document.activeElement as HTMLElement | null; open = true;
    root.classList.toggle("menu-instant", instant); root.classList.add("menu-open");
    pill.setAttribute("aria-expanded", "true"); pill.textContent = "Close";
    drawer.setAttribute("aria-hidden", "false"); drawer.inert = false;
    background().forEach((el) => { el.inert = true; });
    drawer.querySelector<HTMLAnchorElement>("nav a")?.focus({ preventScroll: true });
  };
  const closeMenu = (instant: boolean, restoreFocus = true) => {
    if (!open) return;
    open = false;
    root.classList.toggle("menu-instant", instant); root.classList.remove("menu-open");
    pill.setAttribute("aria-expanded", "false"); pill.textContent = "Menu";
    drawer.setAttribute("aria-hidden", "true"); drawer.inert = true;
    background().forEach((el) => { el.inert = false; });
    if (restoreFocus) (returnFocus?.isConnected ? returnFocus : pill).focus({ preventScroll: true });
  };
  pill.addEventListener("click", (e) => (open ? closeMenu(e.detail === 0) : openMenu(e.detail === 0)));
  scrim.addEventListener("click", () => closeMenu(false));
  // A link in the drawer closes it first (an in-page link such as Cite then lands on a page that is no longer inert).
  drawer.addEventListener("click", (e) => { if ((e.target as Element).closest("a")) closeMenu(true, false); });
  document.addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") { closeMenu(true); return; }
    if (e.key !== "Tab") return;
    const links = [...drawer.querySelectorAll<HTMLAnchorElement>("a")], first = links[0], last = links[links.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && at === first) { e.preventDefault(); pill.focus(); }
    else if (e.shiftKey && at === pill) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && at === last) { e.preventDefault(); pill.focus(); }
    else if (!e.shiftKey && at === pill) { e.preventDefault(); first.focus(); }
  });
  const onScroll = () => root.classList.toggle("has-scrolled", window.scrollY > header.offsetHeight);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/**
 * The escape leg over the closing section's straight edge: the outgoing leg of a hyperbola (e = 3, from periapsis to
 * 80° of true anomaly), stretched to the band. It draws itself as the band scrolls in (a scroll-driven animation in
 * shell.css), and is drawn whole where that is unsupported or under reduced motion.
 */
function initEscapeLeg(): void {
  const svg = document.querySelector<SVGSVGElement>(".escape-leg");
  if (!svg) return;
  const e = 3, p = 1 + e, nuEnd = (80 * Math.PI) / 180, pts: [number, number][] = [];
  for (let i = 0; i <= 120; i++) {
    const nu = (nuEnd * i) / 120, r = p / (1 + e * Math.cos(nu));
    pts.push([r * Math.sin(nu), r * Math.cos(nu)]);            // along the periapsis velocity, and toward periapsis
  }
  const [xEnd, yEnd] = pts[pts.length - 1];
  const draw = () => {
    const W = Math.round(svg.clientWidth), H = Math.round(svg.clientHeight);
    if (!W || !H) return;
    const X = (x: number) => 0.02 * W + (x / xEnd) * 0.94 * W, Y = (y: number) => H * (0.82 - (0.7 * (1 - y)) / (1 - yEnd));
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.replaceChildren(
      s("path", { class: "leg", pathLength: 1, d: pts.map(([x, y], i) => `${i ? "L" : "M"}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join("") }),
      s("circle", { class: "dot", cx: X(xEnd).toFixed(1), cy: Y(yEnd).toFixed(1), r: 4.5 }));
  };
  new ResizeObserver(draw).observe(svg);
}

/**
 * What covers the top of the viewport (author, 2026-10-26, after PR #1; Phase 9 pass 2): the article's section bar,
 * sticky below 1180 px, and the fixed menu pill. Their boxes are measured, never assumed, and kept current:
 * - --header-h: 0, since the header no longer sticks (Phase 9); the section bar and the side rail stick at the top;
 * - --sticky-top: the lowest bottom of the stuck section bar and the pill, the base of scroll-padding-top, so a link
 *   target, a citation jump or a focused control always lands below them;
 * - --pill-top: on the article below 1180 px, the pill rides up with the header until it sits centred in the section
 *   bar, which keeps room for it at its right end.
 * The section bar counts with its list closed: its title can wrap, but an open list is not a lasting overlay. The pill
 * counts wherever it is shown, even while it waits for the header to scroll away (a jump always scrolls past it).
 */
function trackSticky(): void {
  const root = document.documentElement;
  const bar = document.querySelector<HTMLElement>(".section-nav-mobile");
  const barTitle = bar?.querySelector<HTMLElement>("summary");
  const pill = document.querySelector<HTMLElement>(".menu-pill");
  const PILL_TOP = 25;                                        // the pill's top beside the header (shell.css)
  let barH = 0, pillH = 0, barSticks = false;
  const place = () => {
    if (!pill || pill.hidden) return;
    const top = barSticks ? Math.max(Math.round((barH - pillH) / 2), PILL_TOP - window.scrollY) : PILL_TOP;
    root.style.setProperty("--pill-top", `${top}px`);
  };
  const update = () => {
    barSticks = Boolean(bar && barTitle && getComputedStyle(bar).display !== "none" && getComputedStyle(bar).position === "sticky");
    barH = 0;
    if (barSticks) {
      const cs = getComputedStyle(bar!);
      barH = barTitle!.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
    }
    pillH = pill && !pill.hidden ? pill.offsetHeight : 0;
    // Where it rests: centred in the bar when the bar sticks, else beside the header.
    const pillBottom = pillH ? (barSticks ? Math.round((barH - pillH) / 2) : PILL_TOP) + pillH : 0;
    root.style.setProperty("--header-h", "0px");
    root.style.setProperty("--sticky-top", `${Math.ceil(Math.max(barH, pillBottom))}px`);
    place();
  };
  const ro = new ResizeObserver(update);
  for (const e of [barTitle, pill]) if (e) ro.observe(e);
  window.addEventListener("resize", update);                 // crossing a breakpoint can switch stickiness without a resize
  window.addEventListener("scroll", place, { passive: true });
  update();
}
