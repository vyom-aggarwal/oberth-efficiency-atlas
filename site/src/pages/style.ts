// /style/: the design reference page (development only; docs/site_plan.md §7, checkpoint 1).
import "katex/dist/katex.min.css";
import "../styles/palette.css";
import "../styles/fonts.css";
import "../styles/base.css";
import "../styles/controls.css";
import "../styles/chart.css";
import "../styles/layout.css";

import { universalCurve, type CurveData } from "../charts/universal-curve";
import { axisSlider } from "../controls/axis-slider";
import { segmented } from "../controls/segmented";
import { referenceHTML } from "../lib/cite";
import { loadData, type SiteData } from "../lib/data";
import { h, s } from "../lib/dom";
import { sig } from "../lib/format";
import { signal } from "../lib/signal";
import { themePref, themeShown, cssVar, type ThemePref } from "../lib/theme";

const $ = (id: string) => document.getElementById(id)!;

// Theme switch (header).
$("theme-switch").append(segmented<ThemePref>("theme", "Theme", [["system", "System"], ["light", "Light"], ["dark", "Dark"]], themePref));

// ---------------------------------------------------------------- colour (values read from the generated tokens)
const NAMED: [string, string, string][] = [
  ["Paper", "--paper", "Page and chart surface"],
  ["Ink", "--ink", "Text, axes, trajectories, simulation marks, links, focus"],
  ["Graphite", "--graphite", "Secondary text, ticks, theory lines, control edges"],
  ["Rule", "--rule", "Gridlines and quiet dividers"],
];
const RAMPS: [string, string, string][] = [
  ["Burn", "burn", "The rate of orbital-energy gain a·v, and nothing else: thrust arcs, the timing profile, engine panels."],
  ["Slate", "slate", "Magnitudes that are not thrust: the η heatmap, the arrival-speed family, the thrust-profile band."],
];

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

function drawColour(): void {
  $("swatches").replaceChildren(...NAMED.map(([name, v, role]) => h("div", { class: "swatch" },
    h("div", { class: "chip-color", style: `background: var(${v})` }), h("div", { class: "name" }, name),
    h("div", { class: "role" }, role), h("div", { class: "hex" }, cssVar(v)))));
  $("ramps").replaceChildren(...RAMPS.flatMap(([name, v, role]) => [
    h("div", { class: "ramp", role: "img", "aria-label": `${name} ramp, 7 steps: ${[1, 2, 3, 4, 5, 6, 7].map((i) => cssVar(`--${v}-${i}`)).join(", ")}` },
      h("div", { class: "ramp-name" }, name),
      ...[1, 2, 3, 4, 5, 6, 7].map((i) => h("div", { class: "step", style: `background: var(--${v}-${i})`, title: cssVar(`--${v}-${i}`) })),
      h("div", {}), ...[1, 2, 3, 4, 5, 6, 7].map((i) => h("div", { class: "step-n" }, String(i)))),
    h("p", { class: "ramp-role" }, role)]));
  const paper = cssVar("--paper");
  $("checks").textContent = `Contrast on Paper, computed from the tokens: Ink ${sig(contrast(cssVar("--ink"), paper))}:1, ` +
    `Graphite ${sig(contrast(cssVar("--graphite"), paper))}:1, Burn step 1 ${sig(contrast(cssVar("--burn-1"), paper))}:1. ` +
    `The full checks run in tools/palette.mjs.`;
}
themeShown.subscribe(() => requestAnimationFrame(drawColour));

// Type specimen sizes, read from the computed style.
for (const meta of document.querySelectorAll<HTMLElement>(".specimen .meta")) {
  const sample = meta.nextElementSibling as HTMLElement;
  meta.append(`, ${Math.round(parseFloat(getComputedStyle(sample).fontSize))} px`);
}

// ---------------------------------------------------------------- data-driven parts
const [site, curve] = await Promise.all([loadData<SiteData>("site.json"), loadData<CurveData>("curve.json")]);
$("repo-link").setAttribute("href", site.repo.url);
universalCurve($("fig-curve"), curve, site, { figN: 2, title: "The universal curve" });

$("references").append(...site.references.map((r) => h("li", { id: `ref-${r.n}`, value: r.n, html: referenceHTML(r.text) })));

// Controls specimen: the hero's Π slider, with the three engines of the dive marked (values from curve.json).
const engines = curve.cases.filter((c) => c.Pi && ["hibberd", "ntp", "sep"].includes(c.id));
const names: Record<string, string> = { hibberd: "solid stack", ntp: "nuclear thermal", sep: "SEP-class" };
const slider = axisSlider({
  id: "pi-slider", label: "Π", min: 1e-3, max: 1e3, value: engines[1].Pi!.value,
  marks: engines.map((c) => ({ value: c.Pi!.value, label: names[c.id] })),
  format: (v) => sig(v),
});
const out = h("span", { class: "readout" }, h("span", { class: "k" }, "Selected"), h("output", { for: "pi-slider" }));
slider.value.subscribe((v) => (out.querySelector("output")!.textContent = `Π = ${sig(v)}`));
$("ctl-slider").append(slider.el, out);

const steering = signal<"prograde" | "inertial">("prograde");
$("ctl-steering").append(h("span", { class: "control-label", id: "steer-l" }, "Steering"),
  segmented("steering", "Steering", [["prograde", "Prograde"], ["inertial", "Inertial"]], steering));

const select = h("select", { class: "select", "aria-label": "Case" }, ...curve.cases.map((c) => h("option", { value: c.id }, c.label)));
const copy = h("button", { class: "button", type: "button" }, "Copy link");
copy.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(location.href); copy.textContent = "Link copied"; } catch { copy.textContent = "Copy failed"; }
  setTimeout(() => (copy.textContent = "Copy link"), 1600);
});
$("ctl-select").append(h("span", { class: "control-label" }, "Case"), select, " ", copy);

const icon = s("svg", { width: 16, height: 16, viewBox: "0 0 16 16", "aria-hidden": "true" },
  s("path", { d: "M8 1.5 15 14.5H1z", fill: "none", stroke: "var(--ink)", "stroke-width": 1.5, "stroke-linejoin": "round" }),
  s("path", { d: "M8 6v4M8 11.6v.4", stroke: "var(--ink)", "stroke-width": 1.5, "stroke-linecap": "round" }));
$("ctl-warn").append(h("div", { class: "note-warn", role: "note" }, icon,
  h("span", {}, h("strong", {}, "Impact. "), "The trajectory passes below the body's surface, so η is not defined for this case.")));
