// /style-9/: the Phase 9 system for the author's approval (docs/revamp_plan.md §2.11; development builds only). Uses
// the new token sheet alone, so the rest of the site is untouched until pass 1: tokens, type, one data figure (the
// live three-engine dive), the controls, and the motion (preloader, menu, marquee, magnetic buttons, preview rows).
//
// Adapted from Suhas Beemineni's portfolio, https://github.com/suhaslord/portfolio at commit c98c5cc (MIT licence,
// "Copyright (c) 2026 SuahsTheLord"; THIRD_PARTY_NOTICES.md): js/site.js (the preloader's timeline in reveal(), the
// menu's open, close and focus handling, the name marquee's ticker, the has-scrolled threshold, the Lenis settings) and
// js/motion.js (spring(), the magnetic controls, the work-row preview). GSAP timelines are rewritten as CSS transitions
// and the Web Animations API with the same durations and equivalent easings; the springs are the reference's own code.
// Changes for this project: our preloader words, our marquee line, keyboard focus showing the preview, the menu button
// leaving the tab order while hidden, a pause control on the marquee, and the live mini figures as previews.
import "katex/dist/katex.min.css";
import "lenis/dist/lenis.css";
import "../styles/v9/tokens.css";
import "../styles/chart.css";
import "../styles/landing.css";
import "../styles/v9/components.css";
import "../styles/v9/style9.css";
import Lenis from "lenis";
import { axisSlider } from "../controls/axis-slider";
import { segmented } from "../controls/segmented";
import { loadBinary, loadData, type SiteData } from "../lib/data";
import { h, s } from "../lib/dom";
import { sig } from "../lib/format";
import { signal } from "../lib/signal";

const $ = (id: string) => document.getElementById(id)!;
const root = document.documentElement;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const css = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 768px)");   // the reference's test
/** Icons as SVG, not glyphs: no font has to carry them (tests/test_site_fonts.py checks every displayed character). */
const ICONS = { pause: "M5 3v10M11 3v10", play: "M5 3l8 5-8 5z", ne: "M4 12L12 4M6 4h6v6", se: "M4 4l8 8M12 6v6H6", down: "M8 3v10M4 9l4 4 4-4" };
const icon = (name: keyof typeof ICONS, size = 16) => s("svg", { width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": "true", class: "icon9" },
  s("path", { d: ICONS[name], fill: name === "play" ? "currentColor" : "none", stroke: "currentColor", "stroke-width": 1.2,
              "stroke-linecap": "round", "stroke-linejoin": "round" }));
/** A liquid button or link: the fill that rises on hover or focus, and the label above it. */
const liquid = (tag: "a" | "button", cls: string, label: (Node | string)[], attrs: Record<string, string> = {}) =>
  h(tag, { class: `${cls} liquid`, ...(tag === "a" ? { href: "#" } : { type: "button" }), ...attrs },
    h("span", { class: "fill", "aria-hidden": "true" }), h("span", { class: "label" }, ...label));
// GSAP's eases as cubic Béziers (power2/3/4 are the quad/cubic/quart curves; expo as usually approximated).
const EASE = { p2InOut: "cubic-bezier(.455,.03,.515,.955)", p3InOut: "cubic-bezier(.645,.045,.355,1)", expoInOut: "cubic-bezier(.87,0,.13,1)",
               expoOut: "cubic-bezier(.16,1,.3,1)", p3Out: "cubic-bezier(.215,.61,.355,1)" };

// ---------------------------------------------------------------- one clock for every follower (the reference's ticker)
const tickers = new Set<(ms: number) => void>();
let last = performance.now();
const loop = (now: number) => { const ms = Math.min(now - last, 64); last = now; tickers.forEach((f) => f(ms)); requestAnimationFrame(loop); };
requestAnimationFrame(loop);

/** A critically damped follower (js/motion.js spring(), unchanged). */
function spring(value = 0, stiffness = 360, damping = 34) {
  let position = value, velocity = 0;
  return {
    get value() { return position; },
    get velocity() { return velocity; },
    snap(next: number) { position = next; velocity = 0; },
    step(target: number, seconds: number) {
      const time = clamp(seconds, 0, 0.064), steps = Math.max(1, Math.ceil(time * 120)), dt = time / steps;
      for (let i = 0; i < steps; i++) {
        velocity += ((target - position) * stiffness - velocity * damping) * dt;
        position += velocity * dt;
      }
      if (Math.abs(target - position) < 0.005 && Math.abs(velocity) < 0.025) { position = target; velocity = 0; }
      return position;
    },
  };
}
type Spring = ReturnType<typeof spring>;

// ---------------------------------------------------------------- smooth scrolling: Lenis, fine pointers only, never under
// reduced motion (author's conditions, 2026-11-01; the reference's settings). Touch and keyboard scrolling stay native.
const lenis = fine.matches && !reduced
  ? new Lenis({ lerp: 0.095, smoothWheel: true, syncTouch: false, anchors: false, autoRaf: true,
                prevent: (node) => Boolean(node.closest?.("[data-lenis-prevent]")) })
  : null;
root.dataset.scroll = lenis ? "lenis" : "native";

// ---------------------------------------------------------------- the preloader (js/site.js reveal(), the greeting)
// The words are the stages of a powered flyby (proposed, for the author to approve). Timing, from the page's start (the
// curtain is painted with the page): a word every 110 ms after the first 180 ms, the last at 620 ms, held to 0.8 s; then
// the word lifts away and the curtain rises with its curved edge, 950 ms: done at 1.75 s. If this script runs late, the
// sequence joins at the word that is due and the lift shortens, so the curtain is gone by 2 s from the page's start in
// every case (the author's cap); the inline gate's failsafe removes it at 2 s regardless. Any key, click, tap or wheel
// ends it at once.
const WORDS = ["Approach", "Periapsis", "Ignition", "Burn", "Cutoff", "Escape"];
const WORD_AT = WORDS.map((_, i) => (i === 0 ? 0 : 180 + (i - 1) * 110));
const LIFT_AT = 800, LIFT_MS = 950, CAP_MS = 2000;
function preloader(): Promise<void> {
  const el = $("preload9");
  const now = performance.now();                                  // ms since the page's time origin
  const lift = Math.max(now, LIFT_AT), dur = Math.min(LIFT_MS, CAP_MS - lift);
  if (!root.classList.contains("preloading") || reduced || dur < 250) { root.classList.remove("preloading"); return Promise.resolve(); }
  const word = el.querySelector<HTMLElement>(".word")!, curve = el.querySelector<HTMLElement>(".curve")!;
  word.textContent = WORDS[WORD_AT.filter((t) => t <= now).length - 1];
  const timers = WORDS.map((w, i) => (WORD_AT[i] > now ? window.setTimeout(() => { word.textContent = w; }, WORD_AT[i] - now) : 0));
  const k = dur / LIFT_MS, d = lift - now;                        // the lift's scale (1 on time) and its delay from now
  const at = (duration: number, delay: number, easing: string, fill: FillMode = "forwards") => ({ duration: duration * k, delay: d + delay * k, easing, fill });
  const curtain = el.animate([{ transform: "none" }, { transform: "translateY(-115%)" }], at(LIFT_MS, 0, EASE.expoInOut));
  const anims = [curtain,
    word.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-45px)" }], at(500, 0, EASE.p2InOut)),
    curve.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], at(850, 100, EASE.p3InOut)),
    // The hero settles as the curtain clears (content is visible throughout; it only moves into place).
    ...[$("role9"), $("pill9")].map((e, i) => e.animate([{ transform: "translateY(110px)" }, { transform: "none" }], at(1300, 140 + i * 55, EASE.expoOut, "backwards"))),
    $("marquee9").animate([{ transform: "translateY(180px)" }, { transform: "none" }], at(1500, 180, EASE.expoOut, "backwards")),
    document.querySelector<HTMLElement>(".head9")!.animate([{ transform: "translateY(-18px)", opacity: 0 }, { transform: "none", opacity: 1 }],
      at(800, 240, EASE.p3Out, "backwards")),
  ];
  const EVENTS = ["keydown", "pointerdown", "wheel", "touchstart"];
  const skip = () => { timers.forEach(clearTimeout); anims.forEach((a) => a.finish()); root.dataset.preloader = "skipped"; };
  EVENTS.forEach((ev) => window.addEventListener(ev, skip, { passive: true, capture: true }));
  root.dataset.preloader = "running";
  return curtain.finished.then(() => {
    EVENTS.forEach((ev) => window.removeEventListener(ev, skip, { capture: true }));
    root.classList.remove("preloading");
    root.dataset.preloaderMs = String(Math.round(performance.now()));    // from the page's start (tools/style9-shots.mjs)
    if (root.dataset.preloader === "running") root.dataset.preloader = "done";
    curtain.cancel();
  });
}
const preloaded = preloader();

// ---------------------------------------------------------------- the menu (js/site.js setup(): toggle, panel, scrim)
const toggle = document.querySelector<HTMLButtonElement>(".menu9-toggle")!, panel = $("menu9"), scrim = $("scrim9");
const background = () => [...document.querySelectorAll<HTMLElement>(".head9, main, .close9")];
let menuOpen = false, returnFocus: HTMLElement | null = null;
function openMenu(instant: boolean): void {
  returnFocus = document.activeElement as HTMLElement | null; menuOpen = true;
  root.classList.toggle("menu-instant", instant); root.classList.add("menu-open");
  toggle.setAttribute("aria-expanded", "true"); toggle.setAttribute("aria-label", "Close navigation");
  panel.setAttribute("aria-hidden", "false"); panel.inert = false;
  background().forEach((el) => { el.inert = true; });
  lenis?.stop();
  panel.querySelector<HTMLAnchorElement>("nav a")?.focus({ preventScroll: true });
}
function closeMenu(instant: boolean, restoreFocus = true): void {
  if (!menuOpen) return;
  menuOpen = false;
  root.classList.toggle("menu-instant", instant); root.classList.remove("menu-open");
  toggle.setAttribute("aria-expanded", "false"); toggle.setAttribute("aria-label", "Open navigation");
  panel.setAttribute("aria-hidden", "true"); panel.inert = true;
  background().forEach((el) => { el.inert = false; });
  lenis?.start();
  if (restoreFocus) (returnFocus?.isConnected ? returnFocus : toggle).focus({ preventScroll: true });
}
// Opened from the keyboard (a click with detail 0), the menu appears without motion, as in the reference.
toggle.addEventListener("click", (e) => (menuOpen ? closeMenu(e.detail === 0) : openMenu(e.detail === 0)));
scrim.addEventListener("click", () => closeMenu(false));
document.addEventListener("keydown", (e) => {
  if (!menuOpen) return;
  if (e.key === "Escape") { closeMenu(true); return; }
  if (e.key !== "Tab") return;
  const links = [...panel.querySelectorAll<HTMLAnchorElement>("a")], first = links[0], lastLink = links[links.length - 1];
  const at = document.activeElement;
  if (e.shiftKey && at === first) { e.preventDefault(); toggle.focus(); }
  else if (e.shiftKey && at === toggle) { e.preventDefault(); lastLink.focus(); }
  else if (!e.shiftKey && at === lastLink) { e.preventDefault(); toggle.focus(); }
  else if (!e.shiftKey && at === toggle) { e.preventDefault(); first.focus(); }
});
$("menu9-bottom").prepend(h("a", { href: "#" }, "Source on GitHub", icon("ne", 12)));
// The round button appears once 42 % of the hero has scrolled away (wide screens; below 900 px it is always there).
const hero = document.querySelector<HTMLElement>(".hero9")!;
const onScroll = () => root.classList.toggle("has-scrolled", window.scrollY > hero.offsetHeight * 0.42);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// ---------------------------------------------------------------- the marquee (js/site.js, .name-track ticker)
// The title alone (author decision 5). It drifts at 55 px/s, turns with the scroll direction and leans with its speed
// (Lenis's velocity); it stops off screen, on the pause control (WCAG 2.2.2), and entirely under reduced motion.
const track = $("marquee9-track");
const line = () => h("span", { class: "line" }, "Oberth Efficiency Atlas —");
track.append(line(), line(), line());
const pause = liquid("button", "round9 small pause9", [icon("pause")], { "aria-pressed": "false", "aria-label": "Pause the moving title" });
let paused = false;
pause.addEventListener("click", () => {
  paused = !paused;
  pause.setAttribute("aria-pressed", String(paused));
  pause.setAttribute("aria-label", paused ? "Play the moving title" : "Pause the moving title");
  pause.querySelector(".label")!.replaceChildren(icon(paused ? "play" : "pause"));
});
$("foot9").append(pause, h("a", { class: "cue9", href: "#findings9" }, "Findings",
  h("span", { class: "round9 small liquid", "aria-hidden": "true" }, h("span", { class: "fill" }), h("span", { class: "label" }, icon("down")))));
if (!reduced) {
  let width = 1, position = 0, direction = 1, speed = 1, velocity = 1, skew = 0, skewTarget = 0, visible = true;
  const first = track.firstElementChild as HTMLElement;
  const measure = () => { width = first.getBoundingClientRect().width || 1; };
  new ResizeObserver(measure).observe(first); measure();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
  lenis?.on("scroll", (l: Lenis) => {
    const v = l.velocity;
    if (Math.abs(v) > 0.04) direction = v > 0 ? 1 : -1;
    speed = 1 + Math.min(Math.abs(v) * 0.04, 2);
    skewTarget = clamp(v * -0.065, -2.5, 2.5);
  });
  tickers.add((ms) => {
    if (!visible || paused || document.hidden) return;
    const dt = Math.min(ms, 50);
    velocity += (direction * speed - velocity) * (1 - Math.exp(-dt / 160));
    position = (position + velocity * dt * 0.055 + width) % width;
    skew += (skewTarget - skew) * (1 - Math.exp(-dt / 180)); skewTarget *= Math.exp(-dt / 220); speed += (1 - speed) * (1 - Math.exp(-dt / 260));
    track.style.transform = `translate3d(${-position}px, 0, 0) skewX(${skew}deg)`;
  });
}

// ---------------------------------------------------------------- colour: the six named colours, and the data colours
const NAMED: [string, string, string][] = [
  ["Void", "--void", "Page background; the preloader; the dive's window"],
  ["Panel", "--panel", "The hero band, figure panels, the menu drawer, the closing section"],
  ["Ink", "--ink", "Text and links (underlined); the main round button"],
  ["Quiet", "--quiet", "Secondary text; control outlines, axis lines"],
  ["Rule", "--rule", "Hairlines and gridlines"],
  ["Signal", "--signal", "Accent fills, the open menu button, focus rings, selection. Never text, never in a plot"],
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
  ["Marquee (DM Sans 400, tracking −0.025 em)", "spec-marquee", "Oberth Efficiency Atlas —"],
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

// ---------------------------------------------------------------- controls
const steering = signal<"prograde" | "inertial">("prograde");
const sel = h("select", { class: "select9", "aria-label": "Preset" }, h("option", {}, "Hibberd et al.'s solar dive"), h("option", {}, "Jupiter, Hall thruster"));
const slider = axisSlider({ id: "pi9", label: "Π", min: 1e-3, max: 1e3, value: 0.0326,
  marks: [{ value: 0.0326, label: "Solid" }, { value: 1.67, label: "Nuclear" }, { value: 368, label: "SEP*" }], format: (v) => sig(v) });
$("controls9-body").append(
  h("div", { class: "row9" }, liquid("a", "round9 magnetic", ["Read the research"]), liquid("a", "round9 accent magnetic", ["Open the explorer"]),
    liquid("a", "pill9 magnetic", ["The full research", h("sup", {}, "7")]), liquid("a", "pill9 magnetic", ["Source on GitHub", icon("ne", 12)])),
  h("div", { class: "row9" }, segmented("steer9", "Steering", [["prograde", "prograde"], ["inertial", "inertial"]], steering), sel),
  h("div", { class: "slider9" }, slider.el));

// ---------------------------------------------------------------- findings rows and their preview (js/motion.js)
const ROWS: [string, string, string][] = [["01", "Loss against Π", "universal curve"], ["02", "Where real missions sit", "atlas"],
  ["03", "The Hibberd et al. check", "case study"]];
const rows = ROWS.map(([n, t, c]) => h("a", { href: "#" }, h("span", { class: "n" }, n), h("span", { class: "t" }, t), h("span", { class: "c" }, c)));
$("rows9").append(...rows.map((a) => h("li", {}, a)));
const panes = ROWS.map(() => h("div", { class: "finding-body" }));
$("rail9").append(...panes.map((b, i) => h("figure", { class: "pane", id: `pv9-${i + 1}` }, b)));
{
  const box = $("preview9"), rail = $("rail9"), badge = $("badge9");
  let active: HTMLAnchorElement | null = null, known = false, dirty = false, rendering = false, byFocus = false, halfW = 180, halfH = 180;
  const pointer = { x: 0, y: 0 };
  const photo = { x: spring(), y: spring() }, button = { x: spring(0, 600, 44), y: spring(0, 600, 44) }, angle: Spring = spring(0, 180, 25);
  const measure = () => { halfW = box.offsetWidth / 2; halfH = box.offsetHeight / 2; };
  new ResizeObserver(measure).observe(box); measure();
  const target = () => ({ x: clamp(pointer.x, halfW + 18, innerWidth - halfW - 18), y: clamp(pointer.y, halfH + 18, innerHeight - halfH - 18) });
  const place = (x: number, y: number, r = 0) => { box.style.transform = `translate(${x - halfW}px, ${y - halfH}px) rotate(${r}deg)`; };
  const placeBadge = (x: number, y: number) => { badge.style.transform = `translate(${x}px, ${y}px)`; };
  const hide = () => {
    if (!active) return;
    active.classList.remove("is-active"); active = null; rendering = false;
    box.classList.remove("is-visible", "by-focus"); badge.classList.remove("is-visible");
  };
  const show = (row: HTMLAnchorElement, at?: { x: number; y: number }) => {
    if (!fine.matches) return;
    const i = rows.indexOf(row);
    if (active !== row) { active?.classList.remove("is-active"); active = row; row.classList.add("is-active"); }
    if (!rendering) {
      const t = at ?? target();
      photo.x.snap(t.x); photo.y.snap(t.y); button.x.snap(pointer.x); button.y.snap(pointer.y); angle.snap(0);
      place(t.x, t.y); placeBadge(pointer.x, pointer.y);
      rail.style.transition = "none"; rail.style.transform = `translateY(${-100 * i}%)`; void rail.offsetHeight; rail.style.transition = "";
    } else rail.style.transform = `translateY(${-100 * i}%)`;
    rendering = true;
    box.classList.add("is-visible"); box.classList.toggle("by-focus", byFocus); badge.classList.toggle("is-visible", !byFocus);
  };
  const sample = () => {
    if (!known) return;
    const row = document.elementFromPoint(pointer.x, pointer.y)?.closest<HTMLAnchorElement>(".rows9 a");
    if (row && !menuOpen && !root.classList.contains("preloading")) show(row); else hide();
  };
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") { known = false; hide(); return; }
    if (byFocus) { byFocus = false; hide(); }
    known = true; pointer.x = e.clientX; pointer.y = e.clientY; dirty = true;
  });
  document.addEventListener("pointerout", (e) => { if (!e.relatedTarget) { known = false; hide(); } });
  document.addEventListener("keydown", () => { known = false; if (!byFocus) hide(); });
  window.addEventListener("scroll", () => { dirty = true; }, { passive: true });
  window.addEventListener("blur", () => { known = false; hide(); });
  // Keyboard focus places the preview beside the row, still (an addition: the reference hides it on any key).
  for (const row of rows) {
    row.addEventListener("focus", () => {
      if (!row.matches(":focus-visible")) return;
      const r = row.getBoundingClientRect();
      byFocus = true; rendering = false;
      show(row, { x: clamp(r.left + r.width * 0.62, halfW + 18, innerWidth - halfW - 18), y: clamp(r.top + r.height / 2, halfH + 18, innerHeight - halfH - 18) });
    });
    row.addEventListener("blur", () => { if (byFocus) { byFocus = false; hide(); } });
  }
  tickers.add((ms) => {
    if (document.hidden) return;
    if (dirty) { dirty = false; sample(); }
    if (!rendering || byFocus) return;
    const sec = ms / 1000, t = target();
    const x = photo.x.step(t.x, sec), y = photo.y.step(t.y, sec);
    place(x, y, angle.step(clamp(photo.x.velocity * 0.004, -2.8, 2.8), sec));
    placeBadge(button.x.step(pointer.x, sec), button.y.step(pointer.y, sec));
  });
}

// ---------------------------------------------------------------- the closing section and footer
$("cta9").append(liquid("a", "round9 accent magnetic", ["Open the explorer"], { "data-magnet": ".45" }));
$("links9").append(liquid("a", "pill9 on-accent magnetic", ["Research"]), liquid("a", "pill9 on-accent magnetic", ["Source on GitHub", icon("ne", 12)]),
  liquid("a", "pill9 on-accent magnetic", ["Classic explorer"]));
$("flinks9").append(h("a", { href: "#" }, "Source"), h("a", { href: "#" }, "About and licences"), h("a", { href: "#" }, "Cite"));
$("role9").prepend(icon("se", 22));

// ---------------------------------------------------------------- magnetic controls (js/motion.js, .magnetic)
// Fine pointers only, never under reduced motion; the label follows at half the pull. Any key, blur or touch resets.
if (fine.matches && !reduced) {
  type State = { el: HTMLElement; text: HTMLElement | null; hovered: boolean; px: number; py: number; x: Spring; y: Spring; tx: Spring; ty: Spring };
  const moving = new Set<State>();
  for (const el of document.querySelectorAll<HTMLElement>(".magnetic")) {
    const st: State = { el, text: el.querySelector<HTMLElement>(".label"), hovered: false, px: 0, py: 0,
                        x: spring(0, 600, 44), y: spring(0, 600, 44), tx: spring(0, 460, 38), ty: spring(0, 460, 38) };
    const aim = (e: PointerEvent) => { if (e.pointerType === "touch") return; st.hovered = true; st.px = e.clientX; st.py = e.clientY; moving.add(st); };
    el.addEventListener("pointerenter", aim); el.addEventListener("pointermove", aim);
    el.addEventListener("pointerleave", () => { st.hovered = false; moving.add(st); });
  }
  const reset = () => {
    moving.forEach((st) => {
      st.hovered = false; [st.x, st.y, st.tx, st.ty].forEach((a) => a.snap(0));
      st.el.style.translate = ""; if (st.text) st.text.style.translate = "";
    });
    moving.clear();
  };
  document.addEventListener("keydown", reset); window.addEventListener("blur", reset);
  document.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch") reset(); });
  tickers.add((ms) => {
    if (!moving.size || document.hidden) return;
    const sec = ms / 1000;
    moving.forEach((st) => {
      let x = 0, y = 0;
      if (st.hovered) {
        if (!st.el.matches(":hover")) st.hovered = false;
        else {
          const r = st.el.getBoundingClientRect();
          const strength = st.el.dataset.magnet ? Number(st.el.dataset.magnet) * r.width : st.el.classList.contains("round9") ? 100 : 28;
          // The box already carries the pull: take it out, so the pull does not feed on itself.
          x = clamp((st.px - r.left + st.x.value) / r.width - 0.5, -0.5, 0.5) * strength;
          y = clamp((st.py - r.top + st.y.value) / r.height - 0.5, -0.5, 0.5) * strength;
        }
      }
      st.el.style.translate = `${st.x.step(x, sec)}px ${st.y.step(y, sec)}px`;
      if (st.text) st.text.style.translate = `${st.tx.step(x * 0.5, sec)}px ${st.ty.step(y * 0.5, sec)}px`;
      if (!st.hovered && [st.x, st.y, st.tx, st.ty].every((a) => a.value === 0 && a.velocity === 0)) moving.delete(st);
    });
  });
}

// ---------------------------------------------------------------- data: the dive (drawn beneath the preloader; its intro
// starts as the curtain clears), the pill, the previews and the fine print
(async () => {
  const [{ landingHero }, site, engines] = await Promise.all([
    import("../charts/landing-hero"), loadData<SiteData>("site.json"), loadData<any>("engines.json")]);
  const pill = $("pill9");
  pill.append(h("span", {}, "Hibberd et al.'s dive,", h("br"), `perihelion ${engines.units.r_p_over_R_sun.value} R☉`), h("span", { class: "sun9", "aria-hidden": "true" }));
  $("tag9").textContent = site.repo.tag;
  $("data9").textContent = site.provenance.git;
  const buf = await loadBinary(engines.binary);
  const fig = $("landing-hero");
  landingHero(fig, fig.querySelector<HTMLElement>(".landing-hero-body")!, engines, buf, site, { reducedMotion: reduced, start: preloaded });
  const [f, curve, atlas, missions, cas] = await Promise.all([import("../charts/findings"), loadData<any>("curve.json"),
    loadData<any>("atlas.json"), loadData<any>("missions.json"), loadData<any>("case.json")]);
  f.lossFinding(panes[0], curve, engines, site);
  f.missionsFinding(panes[1], atlas, missions, site);
  f.hibberdFinding(panes[2], cas, site);
})().catch((err) => console.error(err));
