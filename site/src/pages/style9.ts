// /style-9/: the Phase 9 system for the author's approval (docs/revamp_plan.md §2.11; development builds only). Uses
// the new token sheet alone, so the rest of the site is untouched until pass 1: tokens, type, one data figure (the
// live three-engine dive), the controls, and one motion example (the marquee with its pause control).
import "katex/dist/katex.min.css";
import "../styles/v9/tokens.css";
import "../styles/chart.css";
import "../styles/landing.css";
import "../styles/v9/components.css";
import "../styles/v9/style9.css";
import { axisSlider } from "../controls/axis-slider";
import { segmented } from "../controls/segmented";
import { loadBinary, loadData, type SiteData } from "../lib/data";
import { h, s } from "../lib/dom";
import { sig } from "../lib/format";
import { signal } from "../lib/signal";

const $ = (id: string) => document.getElementById(id)!;
/** Icons as SVG, not glyphs: no font has to carry them (tests/test_site_fonts.py checks every displayed character). */
const ICONS = { pause: "M5 3v10M11 3v10", play: "M5 3l8 5-8 5z", ne: "M4 12L12 4M6 4h6v6", down: "M8 3v10M4 9l4 4 4-4" };
const icon = (name: keyof typeof ICONS) => s("svg", { width: 16, height: 16, viewBox: "0 0 16 16", "aria-hidden": "true", class: "icon9" },
  s("path", { d: ICONS[name], fill: name === "play" ? "currentColor" : "none", stroke: "currentColor", "stroke-width": 1.5,
              "stroke-linecap": "round", "stroke-linejoin": "round" }));
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = window.matchMedia("(pointer: fine)").matches;

// ---------------------------------------------------------------- the menu: drawer, focus trap, Escape, focus return
const fab = document.querySelector<HTMLButtonElement>(".menu-fab")!;
const drawer = $("drawer9"), veil = $("veil9");
const links = () => [...drawer.querySelectorAll<HTMLAnchorElement>("a")];
function setMenu(open: boolean): void {
  fab.setAttribute("aria-expanded", String(open));
  fab.setAttribute("aria-label", open ? "Close the menu" : "Menu");
  drawer.classList.toggle("open", open); veil.classList.toggle("open", open);
  drawer.setAttribute("aria-hidden", String(!open));
  if (open) links()[0].focus(); else fab.focus();
}
fab.addEventListener("click", () => setMenu(fab.getAttribute("aria-expanded") !== "true"));
// From 900 px the header's links are inline: the round button waits until the header has scrolled away (below 900 px
// it is always there, as the only way to the menu). While away it is hidden from the keyboard too.
const wide = window.matchMedia("(min-width: 900px)");
let headerInView = true;
const placeFab = () => { if (wide.matches && headerInView && fab.getAttribute("aria-expanded") !== "true") fab.setAttribute("data-away", ""); else fab.removeAttribute("data-away"); };
new IntersectionObserver(([e]) => { headerInView = e.isIntersecting; placeFab(); }).observe(document.querySelector(".head9")!);
wide.addEventListener("change", placeFab);
veil.addEventListener("click", () => setMenu(false));
document.addEventListener("keydown", (e) => {
  if (fab.getAttribute("aria-expanded") !== "true") return;
  if (e.key === "Escape") { e.preventDefault(); setMenu(false); return; }
  if (e.key !== "Tab") return;
  const ring: HTMLElement[] = [fab, ...links()], i = ring.indexOf(document.activeElement as HTMLElement);
  e.preventDefault();
  ring[(i + (e.shiftKey ? ring.length - 1 : 1)) % ring.length].focus();
});

// ---------------------------------------------------------------- the marquee (the motion example)
// The formulas never break inside (no-break spaces around "="), so a wrapped line keeps each one whole.
const line = () => h("span", { class: "line" }, "Oberth Efficiency Atlas — Π = t_b/τ — η = B_fin/B_imp —");
$("marquee9-track").append(line(), line());
const marquee = $("marquee9"), pause = $("pause9");
pause.append(icon("pause"));
let userPaused = false;
const setPaused = () => marquee.classList.toggle("paused", userPaused || !inView);
let inView = true;
new IntersectionObserver(([e]) => { inView = e.isIntersecting; setPaused(); }).observe(marquee);
pause.addEventListener("click", () => {
  userPaused = !userPaused;
  pause.setAttribute("aria-pressed", String(userPaused));
  pause.setAttribute("aria-label", userPaused ? "Play the moving title" : "Pause the moving title");
  pause.replaceChildren(icon(userPaused ? "play" : "pause"));
  setPaused();
});

// ---------------------------------------------------------------- colour: the six named colours, and the data colours
const NAMED: [string, string, string][] = [
  ["Void", "--void", "Page background; the closing section"],
  ["Panel", "--panel", "The hero band, figure panels, cards, the menu drawer"],
  ["Ink", "--ink", "Text"],
  ["Quiet", "--quiet", "Secondary text; control outlines, axis lines"],
  ["Rule", "--rule", "Hairlines and gridlines"],
  ["Signal", "--signal", "Round buttons, focus rings, links, the reader's case off blue data"],
];
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
$("swatches9").append(...NAMED.map(([name, v, role]) => {
  const hex = css(v), onVoid = contrast(hex, css("--void")), onPanel = contrast(hex, css("--panel"));
  return h("div", { class: "swatch9" }, h("div", { class: "chip9", style: `background: var(${v})` }),
    h("div", { class: "name9" }, name), h("div", { class: "eyebrow9" }, `${hex}  ${role}`),
    h("div", { class: "eyebrow9 mono9" }, `${sig(onVoid, 3)}:1 on Void, ${sig(onPanel, 3)}:1 on Panel`));
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
  ["Marquee (Commissioner 400, tracking −0.035 em)", "spec-marquee", "Oberth Atlas — Π"],
  ["Display: section titles, the closing line", "spec-display", "01  Findings"],
  ["Figure: key results (Fira Mono)", "spec-figure", "135,720"],
  ["Statement: the headline, the summary, findings rows", "spec-statement", "Sphinx of black quartz, judge my vow: η, Π, Δ, τ"],
  ["Figure titles (Commissioner 600)", "spec-h3", "Figure 2  Loss as a fraction of Δv against Π"],
  ["Prose (18 px, line height 1.6, 66 ch)", "spec-prose", "Type specimen. Lining figures 0123456789 in running text; Greek in the text face: η, Π, Δ, τ, μ, ε, λ, ξ, ρ, δ; symbols from the fallback: ∝, ☉, ₚ. The quick brown fox jumps over the lazy dog."],
  ["Interface (15 px)", "spec-ui", "Controls, navigation and readouts 0123456789"],
  ["Small: eyebrows, labels, captions (13 px, Quiet)", "spec-small", "Data: hero_numbers.json; scope: five engines, six bodies"],
  ["Ticks and readouts (Fira Mono 11 px)", "spec-tick", "0.001 0.01 0.1 1 10 100 1000  η = 0.999991  10⁻⁵"],
];
$("specimens9").append(...SPEC.map(([meta, cls, text]) => h("div", { class: "spec9" }, h("div", { class: "eyebrow9" }, meta),
  h("div", { class: cls }, text))));
for (const s of document.querySelectorAll<HTMLElement>(".spec9")) {
  const sample = s.lastElementChild as HTMLElement;
  s.firstElementChild!.append(`, ${Math.round(parseFloat(getComputedStyle(sample).fontSize))} px`);
}

// ---------------------------------------------------------------- controls
const magnetic = (el: HTMLElement) => {
  if (!fine || reduced) return;                         // a pointer-only enhancement: touch and reduced motion get none
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${Math.max(-8, Math.min(8, dx * 0.15))}px, ${Math.max(-8, Math.min(8, dy * 0.15))}px)`;
  });
  el.addEventListener("pointerleave", () => { el.style.transform = ""; });
};
const primary = h("a", { class: "round9 magnetic", href: "#" }, "Open the explorer");
magnetic(primary);
const steering = signal<"prograde" | "inertial">("prograde");
const sel = h("select", { class: "select9", "aria-label": "Preset" }, h("option", {}, "Hibberd et al.'s solar dive"), h("option", {}, "Jupiter, Hall thruster"));
const slider = axisSlider({ id: "pi9", label: "Π", min: 1e-3, max: 1e3, value: 0.0326,
  marks: [{ value: 0.0326, label: "Solid" }, { value: 1.67, label: "Nuclear" }, { value: 368, label: "SEP*" }], format: (v) => sig(v) });
$("controls9-body").append(
  h("div", { class: "row9" }, primary, h("button", { class: "round9 outline", type: "button", "aria-label": "Findings, below" }, icon("down")),
    h("a", { class: "pill9", href: "#" }, "The full research", h("sup", {}, "7")), h("a", { class: "pill9", href: "#" }, "Source on GitHub", icon("ne")),
    h("a", { class: "pill9 small", href: "#" }, "Cite")),
  h("div", { class: "row9" }, segmented("steer9", "Steering", [["prograde", "prograde"], ["inertial", "inertial"]], steering), sel),
  h("div", { class: "slider9" }, slider.el));
const ROWS: [string, string, string][] = [["01", "Loss against Π", "universal curve"], ["02", "Where real missions sit", "atlas"],
  ["03", "The Hibberd et al. check", "case study"]];
$("rows9").append(...ROWS.map(([n, t, c]) => h("li", {}, h("a", { href: "#" }, h("span", { class: "n" }, n), h("span", { class: "t" }, t),
  h("span", { class: "c" }, c), h("span", { class: "arrow", "aria-hidden": "true" }, icon("ne"))))));

// ---------------------------------------------------------------- the data figure: the live dive
(async () => {
  const [{ landingHero }, site, data] = await Promise.all([
    import("../charts/landing-hero"), loadData<SiteData>("site.json"), loadData<any>("engines.json")]);
  const buf = await loadBinary(data.binary);
  const root = $("landing-hero");
  landingHero(root, root.querySelector<HTMLElement>(".landing-hero-body")!, data, buf, site, { reducedMotion: reduced });
})().catch((err) => console.error(err));
