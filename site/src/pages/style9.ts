// /style-9/: the Phase 9 system for the author's approval (docs/revamp_plan.md §2.11; development builds only), on the
// site's tokens since pass 1 (palette.css, fonts.css, base.css): tokens, type, the controls, the live
// dive with this project's own interactions (§1.3, §2.6), and samples of the article, the explorer and the references
// page in the new system (the styling covers every page: author, 2026-11-02).
//
// Adapted from Suhas Beemineni's portfolio, https://github.com/suhaslord/portfolio at commit c98c5cc (MIT licence,
// "Copyright (c) 2026 SuahsTheLord"; THIRD_PARTY_NOTICES.md), js/site.js: the menu drawer's open, close and focus
// handling (the keyboard's instant path, the Tab cycle, Escape, focus return) and the Lenis settings. The rest is this
// project's own: the flyby preloader, the menu pill, the dive docking beside the findings rows that steer it, the
// title that moves with the dive's clock, and the escape leg over the closing section. The reference's preview,
// magnetic and liquid buttons, curved edges, round menu button and marquee ticker are not used (§1.3).
import "katex/dist/katex.min.css";
import "lenis/dist/lenis.css";
import "../styles/palette.css";
import "../styles/fonts.css";
import "../styles/base.css";
import "../styles/chart.css";
import "../styles/controls.css";
import "../styles/layout.css";
import "../styles/landing.css";
import "../styles/v9/components.css";
import "../styles/article.css";
import "../styles/v9/pages.css";
import "../styles/v9/style9.css";
import Lenis from "lenis";
import { DASH, dashGlyph, dive } from "../charts/dive-view";
import type { HeroControl, Steer } from "../charts/landing-hero";
import { axisSlider } from "../controls/axis-slider";
import { segmented } from "../controls/segmented";
import { loadBinary, loadData, type SiteData } from "../lib/data";
import { h, s } from "../lib/dom";
import { flybyPoint, NU_BURN, nuAt, pathAnomalies, STAGES, stageMark, SUN_R } from "../lib/flyby";
import { sig } from "../lib/format";
import { signal } from "../lib/signal";

const $ = (id: string) => document.getElementById(id)!;
const root = document.documentElement;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const css = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 768px)");   // the reference's test, for Lenis
/** Icons as SVG, not glyphs: no font has to carry them (tests/test_site_fonts.py checks every displayed character). */
const ICONS = { ne: "M4 12L12 4M6 4h6v6", down: "M8 3v10M4 9l4 4 4-4", chev: "M4 6l4 4 4-4" };
const icon = (name: keyof typeof ICONS, size = 16) => s("svg", { width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": "true", class: "icon9" },
  s("path", { d: ICONS[name], fill: "none", stroke: "currentColor", "stroke-width": 1.2, "stroke-linecap": "round", "stroke-linejoin": "round" }));
const link = (cls: string, label: (Node | string)[]) => h("a", { class: cls, href: "#" }, ...label);
const EXPO_OUT = "cubic-bezier(.16,1,.3,1)";

// ---------------------------------------------------------------- smooth scrolling: Lenis, fine pointers only, never under
// reduced motion (author's conditions, 2026-11-01; the reference's settings). Touch and keyboard scrolling stay native.
const lenis = fine.matches && !reduced
  ? new Lenis({ lerp: 0.095, smoothWheel: true, syncTouch: false, anchors: false, autoRaf: true,
                prevent: (node) => Boolean(node.closest?.("[data-lenis-prevent]")) })
  : null;
root.dataset.scroll = lenis ? "lenis" : "native";

// ---------------------------------------------------------------- the preloader: a flyby, drawn (§2.6)
// The flyby of lib/flyby.ts, the Sun on the left as in the hero. A dot flies it from the upper right, quickest through
// perihelion, the burn arc is drawn heavier, and the stages appear at their points in physical order. They stay up, so
// none has to be read in passing. Then the screen fades. From the page's start: the flight 120–1120 ms, a 150 ms hold,
// a 350 ms fade, gone at 1.62 s on time. A late script shortens the flight so the fade ends by 1.8 s; the screen is
// removed when the main thread next runs (the fade itself runs on the compositor), and the inline gate's failsafe
// removes it at 2 s regardless. Any key, click, tap or wheel ends it at once.
const FLY_AT = 120, FLY_MS = 1000, HOLD_MS = 150, FADE_MS = 350, CAP_MS = 2000;
function preloader(): Promise<void> {
  const el = $("preload9"), svg = el.querySelector<SVGSVGElement>("svg")!;
  const now = performance.now();                                  // ms since the page's time origin
  const start = Math.max(now, FLY_AT), fly = Math.min(FLY_MS, CAP_MS - 200 - start - HOLD_MS - FADE_MS);   // 200 ms in hand
  if (!root.classList.contains("preloading") || reduced || fly < 300) { root.classList.remove("preloading"); return Promise.resolve(); }
  // Geometry, fitted to the screen (stage names need room on both sides).
  const W = innerWidth, H = innerHeight, narrow = W < 600;
  const nus = pathAnomalies(), pts = nus.map(flybyPoint);
  let x0 = -SUN_R, x1 = SUN_R, y0 = -SUN_R, y1 = SUN_R;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const mx = narrow ? 92 : 140, my = 56;
  const sc = Math.min((W - 2 * mx) / (x1 - x0), (H - 2 * my) / (y1 - y0), (0.62 * H) / (y1 - y0));
  const ox = W / 2 - ((x0 + x1) / 2) * sc, oy = H / 2 - ((y0 + y1) / 2) * sc;
  const P = ([x, y]: [number, number]) => [ox + x * sc, oy + y * sc];
  const d = (list: [number, number][]) => list.map((p, i) => `${i ? "L" : "M"}${P(p).map((v) => v.toFixed(1)).join(",")}`).join("");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const [sx, sy] = P([0, 0]);
  const flown = s("path", { class: "flown" }), burn = s("path", { class: "burn" }), dot = s("circle", { class: "dot", r: narrow ? 4 : 5 });
  const gap = narrow ? 12 : 16;
  // Each name sits off the path on its convex side, along the normal.
  const marks = STAGES.map(({ name, nu }) => {
    const { p, n: [nx, ny] } = stageMark(nu), [px, py] = P(p);
    const g = s("g", { class: "stage", "data-stage": name }, s("circle", { cx: px, cy: py, r: 2.5 }),
      s("text", { x: px + nx * gap, y: py + ny * gap, "text-anchor": nx < -0.3 ? "end" : nx > 0.3 ? "start" : "middle",
                  "dominant-baseline": ny < -0.3 ? "auto" : ny > 0.3 ? "hanging" : "middle" }, name));
    return { nu, g };
  });
  svg.replaceChildren(s("path", { class: "full", d: d(pts) }), s("circle", { class: "sun", cx: sx, cy: sy, r: SUN_R * sc }),
    burn, flown, ...marks.map((m) => m.g), dot);
  let raf = 0;
  const frame = (t: number) => {
    const nu = nuAt(clamp((t - start) / fly, 0, 1)), here = flybyPoint(nu), upto = nus.filter((v) => v < nu).map(flybyPoint);
    flown.setAttribute("d", d([...upto, here]));
    if (nu > -NU_BURN) burn.setAttribute("d", d([...nus.filter((v) => v > -NU_BURN && v < Math.min(nu, NU_BURN)).map(flybyPoint), flybyPoint(Math.min(nu, NU_BURN))]));
    const [dx, dy] = P(here); dot.setAttribute("cx", dx.toFixed(1)); dot.setAttribute("cy", dy.toFixed(1));
    marks.forEach((m) => m.g.classList.toggle("on", nu >= m.nu - 1e-9));
    if (t < start + fly) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  // The fade, and the hero settling as it clears (content is in place beneath throughout; it only moves 24 px). Their
  // start times are set in page time, not as delays: a delay counts from an animation's first frame, which the rest of
  // this module's set-up holds back.
  const fadeAt = start + fly + HOLD_MS;
  const fade = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: "ease", fill: "forwards" });
  fade.startTime = fadeAt;
  const settle = [$("role9"), $("pill9"), $("marquee9"), document.querySelector<HTMLElement>(".head9")!].map((e, i) => {
    const a = e.animate([{ transform: "translateY(24px)" }, { transform: "none" }], { duration: 700, delay: i * 40, easing: EXPO_OUT, fill: "backwards" });
    a.startTime = fadeAt;
    return a;
  });
  const EVENTS = ["keydown", "pointerdown", "wheel", "touchstart"];
  const skip = () => { cancelAnimationFrame(raf); frame(start + fly); [fade, ...settle].forEach((a) => a.finish()); root.dataset.preloader = "skipped"; };
  EVENTS.forEach((ev) => window.addEventListener(ev, skip, { passive: true, capture: true }));
  root.dataset.preloader = "running";
  root.dataset.preloaderStart = String(Math.round(now));                 // when this script took over (diagnostics)
  root.dataset.preloaderFaded = String(Math.round(fadeAt + FADE_MS));    // when the fade is scheduled to end
  return fade.finished.then(() => {
    EVENTS.forEach((ev) => window.removeEventListener(ev, skip, { capture: true }));
    cancelAnimationFrame(raf);
    root.classList.remove("preloading");
    root.dataset.preloaderMs = String(Math.round(performance.now()));    // from the page's start (tools/style9-shots.mjs)
    if (root.dataset.preloader === "running") root.dataset.preloader = "done";
    fade.cancel();
  });
}
const preloaded = preloader();

// ---------------------------------------------------------------- the menu: a text pill and the drawer
// The pill is this project's (no round button, no morph): it reads "Menu" or "Close". From 900 px the header's links are
// inline and the pill appears once the header has scrolled out of view; below 900 px it is always there. The drawer's
// open, close and focus handling are the reference's (js/site.js setup()).
const pill = document.querySelector<HTMLButtonElement>(".menu9-pill")!, panel = $("menu9"), scrim = $("scrim9");
const background = () => [...document.querySelectorAll<HTMLElement>(".head9, main, .close9")];
let menuOpen = false, returnFocus: HTMLElement | null = null;
function openMenu(instant: boolean): void {
  returnFocus = document.activeElement as HTMLElement | null; menuOpen = true;
  root.classList.toggle("menu-instant", instant); root.classList.add("menu-open");
  pill.setAttribute("aria-expanded", "true"); pill.textContent = "Close";
  panel.setAttribute("aria-hidden", "false"); panel.inert = false;
  background().forEach((el) => { el.inert = true; });
  lenis?.stop();
  panel.querySelector<HTMLAnchorElement>("nav a")?.focus({ preventScroll: true });
}
function closeMenu(instant: boolean, restoreFocus = true): void {
  if (!menuOpen) return;
  menuOpen = false;
  root.classList.toggle("menu-instant", instant); root.classList.remove("menu-open");
  pill.setAttribute("aria-expanded", "false"); pill.textContent = "Menu";
  panel.setAttribute("aria-hidden", "true"); panel.inert = true;
  background().forEach((el) => { el.inert = false; });
  lenis?.start();
  if (restoreFocus) (returnFocus?.isConnected ? returnFocus : pill).focus({ preventScroll: true });
}
// Opened from the keyboard (a click with detail 0), the drawer appears without motion, as in the reference.
pill.addEventListener("click", (e) => (menuOpen ? closeMenu(e.detail === 0) : openMenu(e.detail === 0)));
scrim.addEventListener("click", () => closeMenu(false));
document.addEventListener("keydown", (e) => {
  if (!menuOpen) return;
  if (e.key === "Escape") { closeMenu(true); return; }
  if (e.key !== "Tab") return;
  const links = [...panel.querySelectorAll<HTMLAnchorElement>("a")], first = links[0], lastLink = links[links.length - 1];
  const at = document.activeElement;
  if (e.shiftKey && at === first) { e.preventDefault(); pill.focus(); }
  else if (e.shiftKey && at === pill) { e.preventDefault(); lastLink.focus(); }
  else if (!e.shiftKey && at === lastLink) { e.preventDefault(); pill.focus(); }
  else if (!e.shiftKey && at === pill) { e.preventDefault(); first.focus(); }
});
$("menu9-bottom").prepend(h("a", { href: "#" }, "Source on GitHub", icon("ne", 12)));
const head = document.querySelector<HTMLElement>(".head9")!;
const onScroll = () => root.classList.toggle("has-scrolled", window.scrollY > head.offsetHeight);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// ---------------------------------------------------------------- the title, moving with the dive's clock (§2.6)
// No ticker: the title's offset is the angle the solid stack has swept around the Sun by the dive's clock, as a fraction
// of the whole sweep, times one line's width. It creeps in on approach, rushes through perihelion and slows on escape,
// and it moves only while the clock does: during the dive's intro (under 3 s, once a session) and while the reader
// scrubs. Nothing moves on its own for more than 5 s, so it needs no pause control (WCAG 2.2.2). Still under reduced
// motion, wrapped at display size.
const track = $("marquee9-track");
const line = () => h("span", { class: "line" }, "Oberth Efficiency Atlas —");
track.append(line(), line(), line());
let lineW = 1, sweep: Float64Array | null = null;
new ResizeObserver(() => { lineW = (track.firstElementChild as HTMLElement).getBoundingClientRect().width || 1; }).observe(track.firstElementChild!);
function onFrame(k: number): void {
  if (reduced || !sweep) return;
  const i = clamp(k - 1, 0, sweep.length - 1), f = sweep[i] / sweep[sweep.length - 1];
  track.style.transform = `translate3d(${(-f * lineW).toFixed(1)}px, 0, 0)`;
}
$("foot9").append(h("a", { class: "cue9", href: "#findings9" }, "Findings", h("span", { class: "round9 small", "aria-hidden": "true" }, icon("down"))));
$("role9").prepend(h("span", { class: "rule9", "aria-hidden": "true" }));

// ---------------------------------------------------------------- the findings rows and the docked dive (§2.5)
// From 1100 px wide and 700 px tall the hero's dive is sticky, and as the headline scrolls away it slides from the
// centre into the right-hand column beside the rows (its offset follows the scroll; in one step under reduced motion).
// Pointing at a row or focusing it steers the dive to that finding's state; leaving restores the reader's own clock.
// Each row also opens in place, at every width, to its live figure, the author's caption and its link.
const dockMq = window.matchMedia("(min-width: 1100px) and (min-height: 700px)");
const DOCK_TOP = 96;                                              // the dive's top edge, in the hero and docked
const fig = $("landing-hero"), home = $("dive-home"), dock = $("dock9"), stage = $("stage9"), rowsEl = $("rows9");
let control: HeroControl | null = null, docked = false, dockFrom = 0, dockSpan = 1;
type RowId = "loss" | "missions" | "hibberd";
/** Each finding's state on the dive (the engines lit by index: 0 solid stack, 1 nuclear thermal, 2 SEP-class). Row 02,
 *  the missions on the atlas, has none (author, 2026-11-02): the atlas covers six bodies and the dive one, so pointing
 *  at it or focusing it counts as pointing at nothing, and the dive keeps what the other rows or the reader gave it. */
const STATES: Partial<Record<RowId, (c: HeroControl) => Steer>> = {
  // Figure 01 marks these three engines by Π and loss: every burn, the paths quiet, the clock at the end.
  loss: (c) => ({ s: c.sMax, lit: [0, 1, 2], burns: true }),
  // The case study is Hibberd et al.'s reference stack, the dive's solid stack: just after its burn.
  hibberd: (c) => ({ s: c.afterBurn(0), lit: [0] }),
};
/** The line styles of the engines a row lights, in its category column. */
const GLYPHS: Record<RowId, () => Node[]> = {
  loss: () => DASH.map((dash) => dashGlyph(dash)),
  missions: () => [],
  hibberd: () => [dashGlyph(DASH[0])],
};
const heads = [...rowsEl.querySelectorAll<HTMLButtonElement>(".row9-head")];
const rowOf = (b: HTMLElement) => b.closest("li")!.dataset.row as RowId;
/** The row's button if the row steers the dive, else null. */
const steerable = (el: Element | null) => {
  const b = el?.closest("li")?.querySelector<HTMLButtonElement>(".row9-head") ?? null;
  return b && STATES[rowOf(b)] ? b : null;
};
heads.forEach((b) => b.querySelector(".g")!.append(...GLYPHS[rowOf(b)]()));
function measureDock(): void {
  if (!docked) return;
  const sr = stage.getBoundingClientRect(), dr = dock.getBoundingClientRect(), role = $("role9");
  fig.style.setProperty("--dock-dx", `${(sr.left + sr.width / 2 - (dr.left + dr.width / 2)).toFixed(1)}px`);
  // The slide starts once the headline has cleared the dive's top edge, and takes 30 % of the screen's height.
  dockFrom = role.offsetTop + role.offsetHeight - DOCK_TOP + 16; dockSpan = 0.3 * innerHeight;
  dockProgress();
}
function dockProgress(): void {
  if (!docked) return;
  const p = clamp((window.scrollY - dockFrom) / dockSpan, 0, 1);
  const e = reduced ? (p >= 0.5 ? 1 : 0) : p * p * (3 - 2 * p);
  fig.style.setProperty("--dock", e.toFixed(4));
  root.classList.toggle("dive-docked", e === 1);
}
function placeDive(): void {
  docked = dockMq.matches;
  (docked ? dock : home).append(fig);
  root.classList.toggle("is-docked", docked);
  heads.forEach((b) => { if (docked && steerable(b)) b.setAttribute("aria-describedby", `row9-${rowOf(b)}-steer`); else b.removeAttribute("aria-describedby"); });
  if (docked) measureDock(); else { fig.style.removeProperty("--dock"); root.classList.remove("dive-docked"); steerTo(null); }
}
window.addEventListener("scroll", dockProgress, { passive: true });
new ResizeObserver(measureDock).observe(stage);
dockMq.addEventListener("change", placeDive);
preloaded.then(measureDock);
// Steering: the row pointed at, else the focused row, else the open one, else none.
let hovered: HTMLButtonElement | null = null, focused: HTMLButtonElement | null = null, opened: HTMLButtonElement | null = null;
let steered: HTMLButtonElement | null = null;
function steerTo(b: HTMLButtonElement | null): void {
  if (b === steered) return;
  steered = b;
  rowsEl.classList.toggle("has-active", Boolean(b));
  heads.forEach((x) => x.closest("li")!.classList.toggle("is-active", x === b));
  if (control) control.steer(b ? STATES[rowOf(b)]!(control) : null);
}
const update = () => steerTo(docked ? (hovered ?? focused ?? opened) : null);
rowsEl.addEventListener("pointerover", (e) => {
  if (e.pointerType === "touch") return;
  hovered = steerable(e.target as Element); update();
});
rowsEl.addEventListener("pointerleave", () => { hovered = null; update(); });
rowsEl.addEventListener("focusin", (e) => { focused = steerable(e.target as Element); update(); });
rowsEl.addEventListener("focusout", (e) => { if (!rowsEl.contains(e.relatedTarget as Node | null)) { focused = null; update(); } });
// Opening in place: one row at a time; each figure is drawn the first time its row opens.
const mounted = new Set<RowId>();
let mountFigure: (id: RowId, body: HTMLElement) => void = () => {};
heads.forEach((b) => b.addEventListener("click", () => {
  const open = b.getAttribute("aria-expanded") !== "true";
  for (const x of heads) {
    const on = open && x === b;
    x.setAttribute("aria-expanded", String(on));
    $(x.getAttribute("aria-controls")!).hidden = !on;
    x.closest("li")!.classList.toggle("is-open", on);
  }
  opened = open ? steerable(b) : null;
  if (open && !mounted.has(rowOf(b))) { mounted.add(rowOf(b)); mountFigure(rowOf(b), $(b.getAttribute("aria-controls")!).querySelector<HTMLElement>(".finding-body")!); }
  update();
  requestAnimationFrame(measureDock);
}));
placeDive();

// ---------------------------------------------------------------- colour: the six named colours, and the data colours
const NAMED: [string, string, string][] = [
  ["Void", "--void", "Page background; the preloader; the dive's window"],
  ["Panel", "--panel", "The hero band, figure panels, the menu drawer, the closing section"],
  ["Ink", "--ink", "Text and links (underlined); the main round button"],
  ["Quiet", "--quiet", "Secondary text; control outlines, axis lines"],
  ["Rule", "--rule", "Hairlines and gridlines"],
  ["Signal", "--signal", "Accent fills (the call to action), focus rings, selection. Never text, never in a plot"],
];
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
$("swatches9").append(...NAMED.map(([name, v, role]) => {
  const hex = css(v), onVoid = contrast(hex, css("--void")), onPanel = contrast(hex, css("--panel"));
  const note = name === "Signal" ? `Ink label ${sig(contrast(css("--ink"), hex), 3)}:1; ring ${sig(onVoid, 3)}:1 on Void, ${sig(onPanel, 3)}:1 on Panel`
    : `${sig(onVoid, 3)}:1 on Void, ${sig(onPanel, 3)}:1 on Panel`;
  return h("div", { class: "swatch9" }, h("div", { class: "chip9", style: `background: var(${v})` }),
    h("div", { class: "name9" }, name), h("div", { class: "eyebrow9" }, `${hex}  ${role}`), h("div", { class: "eyebrow9 mono9" }, note));
}));
const strip = (label: string, vars: string[]) => h("div", { class: "strip9" }, h("span", { class: "eyebrow9" }, label),
  h("div", { class: "steps9" }, ...vars.map((v) => h("span", { style: `background: var(${v})`, title: `${v} ${css(v)}` }))));
$("datastrip9").append(
  strip("η ramp", [0, 1, 2, 3, 4, 5, 6].map((k) => `--ramp-${k}`)),
  strip("a·v ramp", [1, 2, 3, 4, 5, 6, 7].map((k) => `--av-${k}`)),
  h("div", { class: "strip9" }, h("span", { class: "eyebrow9" }, "textures"), h("div", { class: "tex9" },
    h("span", { class: "hatch-neg" }, "η < 0"), h("span", { class: "hatch-imp" }, "impact"), h("span", { class: "dots-unr" }, "no reliable η"))));

// ---------------------------------------------------------------- type
const SPEC: [string, string, string][] = [
  ["Title (DM Sans 400, tracking −0.025 em)", "spec-marquee", "Oberth Efficiency Atlas —"],
  ["Display: section titles, the closing line", "spec-display", "01  Findings"],
  ["Figure: key results (IBM Plex Mono)", "spec-figure", "135,720"],
  ["Statement: the headline, the summary", "spec-statement", "Sphinx of black quartz, judge my vow: η, Π, Δ, τ"],
  ["Figure titles (DM Sans 600)", "spec-h3", "Figure 2  Loss as a fraction of Δv against Π"],
  ["Prose (18 px, line height 1.6, 66 ch)", "spec-prose", "Type specimen. Lining figures 0123456789 in running text; Greek from Commissioner behind DM Sans: η, Π, Δ, τ, μ, ε, λ, ξ, ρ, δ; signs from the fallbacks: ∝, ☉, ₚ, ⁻, →. The quick brown fox jumps over the lazy dog."],
  ["Interface (15 px)", "spec-ui", "Controls, navigation and readouts 0123456789"],
  ["Small: eyebrows, labels, captions (13 px, Quiet)", "spec-small", "Data: hero_numbers.json; scope: five engines, six bodies"],
  ["Ticks and readouts (IBM Plex Mono 11 px; Greek from Fira Mono)", "spec-tick", "0.001 0.01 0.1 1 10 100 1000  η = 0.999991  Π = 0.0326  10⁻⁵"],
];
$("specimens9").append(...SPEC.map(([meta, cls, text]) => h("div", { class: "spec9" }, h("div", { class: "eyebrow9" }, meta),
  h("div", { class: cls }, text))));
for (const el of document.querySelectorAll<HTMLElement>(".spec9")) {
  const sample = el.lastElementChild as HTMLElement;
  el.firstElementChild!.append(`, ${Math.round(parseFloat(getComputedStyle(sample).fontSize))} px`);
}

// ---------------------------------------------------------------- controls: plain states, no pull and no fill (§1.3)
const steering = signal<"prograde" | "inertial">("prograde");
const sel = h("select", { class: "select9", "aria-label": "Preset" }, h("option", {}, "Hibberd et al.'s solar dive"), h("option", {}, "Jupiter, Hall thruster"));
const slider = axisSlider({ id: "pi9", label: "Π", min: 1e-3, max: 1e3, value: 0.0326,
  marks: [{ value: 0.0326, label: "Solid" }, { value: 1.67, label: "Nuclear" }, { value: 368, label: "SEP*" }], format: (v) => sig(v) });
$("controls9-body").append(
  h("div", { class: "row9" }, link("round9", ["Read the research"]), link("round9 accent", ["Open the explorer"]),
    link("pill9", ["The full research", h("sup", {}, "7")]), link("pill9", ["Source on GitHub", icon("ne", 12)])),
  h("div", { class: "row9" }, segmented("steer9", "Steering", [["prograde", "prograde"], ["inertial", "inertial"]], steering), sel),
  h("div", { class: "slider9" }, slider.el));

// ---------------------------------------------------------------- the closing section: the escape leg (§2.6)
// Over the band's straight top edge, the outgoing leg of a hyperbola (e = 3, from perihelion to 80° of true anomaly),
// stretched to the band's width: it leaves low on the left and climbs out to the right, the opening's approach
// answered by an escape. Where scroll-driven animation is supported it draws itself as the band scrolls in; elsewhere,
// and under reduced motion, it is drawn whole.
const escape = $("escape9") as unknown as SVGSVGElement;
function drawEscape(): void {
  const W = Math.round(escape.clientWidth), H = Math.round(escape.clientHeight);
  if (!W || !H) return;
  const e = 3, p = 1 + e, nuEnd = (80 * Math.PI) / 180, pts: [number, number][] = [];
  for (let i = 0; i <= 120; i++) {
    const nu = (nuEnd * i) / 120, r = p / (1 + e * Math.cos(nu));
    pts.push([r * Math.sin(nu), r * Math.cos(nu)]);            // along the periapsis velocity, and toward periapsis
  }
  const xEnd = pts[120][0], yEnd = pts[120][1];
  const X = (x: number) => 0.02 * W + (x / xEnd) * 0.94 * W, Y = (y: number) => H * (0.82 - 0.7 * (1 - y) / (1 - yEnd));
  escape.setAttribute("viewBox", `0 0 ${W} ${H}`);
  escape.replaceChildren(
    s("path", { class: "leg", pathLength: 1, d: pts.map(([x, y], i) => `${i ? "L" : "M"}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join("") }),
    s("circle", { class: "dot", cx: X(xEnd).toFixed(1), cy: Y(yEnd).toFixed(1), r: 4.5 }));
}
new ResizeObserver(drawEscape).observe(escape);
$("cta9").append(link("round9 accent", ["Open the explorer"]));
$("links9").append(link("pill9", ["Research"]), link("pill9", ["Source on GitHub", icon("ne", 12)]), link("pill9", ["Classic explorer"]));
$("flinks9").append(h("a", { href: "#" }, "Source"), h("a", { href: "#" }, "About and licences"), h("a", { href: "#" }, "Cite"));

// ---------------------------------------------------------------- the article sample: its section marked current
for (const a of document.querySelectorAll<HTMLAnchorElement>(".article9 [data-nav]")) {
  if (a.dataset.nav === "universal-curve") a.setAttribute("aria-current", "true");
  a.addEventListener("click", (e) => e.preventDefault());           // the other sections are not on this page
}

// ---------------------------------------------------------------- data: the dive (drawn beneath the preloader; its intro
// starts as it clears), the pill, the fine print, the findings' figures, Figure 2 and the explorer
(async () => {
  const [{ landingHero }, site, engines] = await Promise.all([
    import("../charts/landing-hero"), loadData<SiteData>("site.json"), loadData<any>("engines.json")]);
  $("pill9").append(h("span", {}, "Hibberd et al.'s dive,", h("br"), `perihelion ${engines.units.r_p_over_R_sun.value} R☉`), h("span", { class: "sun9", "aria-hidden": "true" }));
  $("tag9").textContent = site.repo.tag;
  $("data9").textContent = site.provenance.git;
  const buf = await loadBinary(engines.binary);
  // The angle the solid stack has swept around the Sun, sample by sample (the radial mapping keeps angles).
  const solid = dive(engines, buf).cases[0];
  sweep = new Float64Array(solid.X.length);
  for (let i = 1; i < solid.X.length; i++) {
    let da = Math.atan2(solid.Y[i], solid.X[i]) - Math.atan2(solid.Y[i - 1], solid.X[i - 1]);
    da -= 2 * Math.PI * Math.round(da / (2 * Math.PI));
    sweep[i] = sweep[i - 1] + Math.abs(da);
  }
  control = landingHero(fig, fig.querySelector<HTMLElement>(".landing-hero-body")!, engines, buf, site,
    { reducedMotion: reduced, start: preloaded, onFrame });
  steered = null; update();
  mountFigure = (id, body) => {
    const load = async () => {
      const f = await import("../charts/findings");
      if (id === "loss") f.lossFinding(body, await loadData<any>("curve.json"), engines, site);
      else if (id === "missions") { const [atlas, missions] = await Promise.all([loadData<any>("atlas.json"), loadData<any>("missions.json")]); f.missionsFinding(body, atlas, missions, site); }
      else f.hibberdFinding(body, await loadData<any>("case.json"), site);
    };
    load().catch((err) => console.error(err));
  };
  for (const b of heads) if (b.getAttribute("aria-expanded") === "true" && !mounted.has(rowOf(b))) {
    mounted.add(rowOf(b)); mountFigure(rowOf(b), $(b.getAttribute("aria-controls")!).querySelector<HTMLElement>(".finding-body")!);
  }
  // Figure 2 and the explorer, each when it nears the viewport and never before the preloader has gone (their set-up
  // would hold up its frames), as the article loads its figures.
  await preloaded;
  const near = (el: Element, run: () => Promise<void>) => {
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect(); run().catch((err) => console.error(err));
    }, { rootMargin: "600px 0px" });
    io.observe(el);
  };
  const fig2 = document.querySelector<HTMLElement>(".article9 figure[data-figure='universal-curve']");
  if (fig2) near(fig2, async () => {
    const [{ universalCurve }, curve] = await Promise.all([import("../charts/universal-curve"), loadData<any>("curve.json")]);
    universalCurve(fig2.querySelector<HTMLElement>(".figure-body")!, curve, site, { figN: Number(fig2.dataset.figN ?? 0), title: "Loss as a fraction of Δv against Π" });
  });
  const ex = document.querySelector<HTMLElement>("[data-explorer]")!;
  near(ex, async () => {
    const [{ explorer }, presets, hero, curve] = await Promise.all([import("../explorer/explorer"), loadData<any>("presets.json"),
      loadData<any>("hero.json"), loadData<any>("curve.json")]);
    explorer(ex, { presets, hero, curve });
  });
})().catch((err) => console.error(err));
