// Phase 9, step 2 (docs/revamp_plan.md): the proposed dark interface palette, checked, with the data colours (which do
// not change) re-checked on the new surfaces. Folded into tools/palette.mjs in pass 1 once the plan is approved.
// Revised 2026-11-01 for the author's decisions: the reference's indigo accent, or its nearest passing variant.
// Run (in site/): node tools/phase9-palette.mjs        exit 1 on any failure.
import { contrast, themes } from "./palette.mjs";

// ---------------------------------------------------------------- colour maths (as palette.mjs: OKLab, Machado 2009)
const decode = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const encode = (v) => { v = Math.min(1, Math.max(0, v)); return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; };
const lin = (hex) => [1, 3, 5].map((i) => decode(parseInt(hex.slice(i, i + 2), 16) / 255));
const toHex = (l) => "#" + l.map(encode).map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
function oklab(hex) {
  const [r, g, b] = lin(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const dE = (x, y) => Math.hypot(...oklab(x).map((v, i) => v - oklab(y)[i])) * 100;
/** OKLCH → hex, or null when outside the sRGB gamut. */
function fromLch(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3,
        s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
               -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return rgb.every((v) => v >= 0 && v <= 1) ? toHex(rgb) : null;
}
const lch = (hex) => { const [L, a, b] = oklab(hex); return [L, Math.hypot(a, b), hue(hex)]; };
const hue = (hex) => { const [, a, b] = oklab(hex); return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360; };
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
const sim = (hex, M) => { const c = lin(hex); return toHex(M.map((row) => Math.max(0, row.reduce((s, v, i) => s + v * c[i], 0)))); };
const worst = (x, y) => Math.min(...Object.values(CVD).map((M) => dE(sim(x, M), sim(y, M))));

// ---------------------------------------------------------------- the proposed interface palette (named roles)
// Six named colours, derived from the reference's light palette as a designed dark equivalent, not an inversion: its
// deepest preloader black becomes the page (Void); its dark contact section the raised surface, which also takes the
// role of its mid-grey hero band (Panel: the hero stage, figure panels, the menu drawer); its near-black ink an
// off-white (Ink); its mid-grey muted text a light grey that keeps 4.5:1 and outlines controls at 3:1 (Quiet); its pale
// hairline a dark one (Rule). The accent (Signal) is the reference's indigo (author decision 1, 2026-11-01), or the
// nearest variant that passes every accent check below.
// History (docs/revamp_plan.md §2.1): the step-2 draft used an electric violet, #c27bff, to stay clear of the data
// blues; the author chose the indigo instead, with the rule that the accent never appears inside a plot area, legend or
// colour scale. That rule replaces the old "accent vs every data blue" check (the distance is now reported only).
const REFERENCE_ACCENT = "#455ce9";    // the reference's --blue (measurements.json, 2026-11-01)
const BASE = {
  void: "#111214",     // page background
  panel: "#1b1c1f",    // raised surface: the hero stage, figure panels, cards, the menu drawer
  ink: "#ecebe7",      // text, and link text (underlined): the accent is never text
  quiet: "#a3a4a8",    // secondary text (captions, labels, notes); control outlines and axis lines
  rule: "#2f3135",     // hairlines and gridlines (decorative)
};

const failures = [];
const check = (ok, msg) => { console.log(`${ok ? "pass" : "FAIL"}  ${msg}`); if (!ok) failures.push(msg); };
const r2 = (v) => v.toFixed(2);
const surfaces = ["void", "panel"];

// The accent's jobs, each a contrast floor (WCAG 2.2: 1.4.3 text, 1.4.11 non-text). It is never text on a surface (link
// text is Ink, underlined), so it has no 4.5:1 floor against Void or Panel.
const ACCENT_JOBS = [
  [(a) => contrast(BASE.ink, a), 4.5, "Ink label on an accent button"],
  [(a) => contrast(BASE.ink, a), 4.5, "Ink text on the accent selection background"],
  [(a) => contrast(a, BASE.void), 3, "focus ring and open menu button on Void"],
  [(a) => contrast(a, BASE.panel), 3, "focus ring on Panel"],
];
const passes = (a) => ACCENT_JOBS.every(([f, need]) => f(a) >= need);
console.log(`the reference's accent ${REFERENCE_ACCENT}:`);
for (const [f, need, job] of ACCENT_JOBS)
  console.log(`  ${f(REFERENCE_ACCENT) >= need ? "ok  " : "fails"}  ${job}: ${r2(f(REFERENCE_ACCENT))}:1 (>= ${need})`);
// The nearest variant that passes every job: the smallest OKLab distance over a fine OKLCH grid around it (lightness
// ±0.06 in 0.001 steps, chroma ±0.05 in 0.002, hue ±8° in 0.5°), checked on the rounded hex.
let accent = REFERENCE_ACCENT;
if (!passes(REFERENCE_ACCENT)) {
  const [L0, C0, h0] = lch(REFERENCE_ACCENT);
  let best = Infinity;
  for (let dL = -0.06; dL <= 0.06; dL += 0.001) for (let dC = -0.05; dC <= 0.05; dC += 0.002) for (let dh = -8; dh <= 8; dh += 0.5) {
    const hex = fromLch(L0 + dL, C0 + dC, h0 + dh);
    if (!hex || !passes(hex)) continue;
    const d = dE(hex, REFERENCE_ACCENT);
    if (d < best) { best = d; accent = hex; }
  }
  console.log(`  nearest variant that passes: ${accent}, ΔE ${best.toFixed(2)} from the reference (OKLab x100; a just-noticeable`
              + ` difference is about 2)`);
}
export const UI = { ...BASE, signal: accent };

console.log("\ninterface palette:", Object.entries(UI).map(([k, v]) => `${k} ${v}`).join("  "));
for (const s of surfaces) {
  for (const [k, need, job] of [["ink", 7, "text"], ["quiet", 4.5, "secondary text"], ["quiet", 3, "control outline, axis line"]])
    check(contrast(UI[k], UI[s]) >= need, `${k} on ${s}: ${r2(contrast(UI[k], UI[s]))}:1 (>= ${need}, ${job})`);
}
for (const [f, need, job] of ACCENT_JOBS) check(f(UI.signal) >= need, `accent ${UI.signal}, ${job}: ${r2(f(UI.signal))}:1 (>= ${need})`);
check(contrast(UI.void, UI.ink) >= 4.5, `Void label on an Ink button: ${r2(contrast(UI.void, UI.ink))}:1 (>= 4.5)`);
console.log(`info  surfaces step: void→panel ΔL ${r2((oklab(UI.panel)[0] - oklab(UI.void)[0]) * 100)} (OKLab L x100); rule on panel ${r2(contrast(UI.rule, UI.panel))}:1 (decorative)`);

// ---------------------------------------------------------------- the data colours (unchanged), on the new surfaces
const D = themes().dark;                       // the classic's dark steps: η ramp, a·v ramp, critical, ink-2, muted, sun
console.log(`\ndata colours (the classic's dark theme, unchanged): η ramp ${D.ramp.join(" ")}; a·v ${D.av.join(" ")}; critical ${D.critical}; sun ${D.sun}`);
for (const s of ["void", "panel"]) {
  check(contrast(D.av[0], UI[s]) >= 2, `faintest a·v stroke ${D.av[0]} on ${s}: ${r2(contrast(D.av[0], UI[s]))}:1 (>= 2, thin marks)`);
  check(contrast(D.critical, UI[s]) >= 3, `η < 0 hatching ${D.critical} on ${s}: ${r2(contrast(D.critical, UI[s]))}:1 (>= 3)`);
  check(contrast(D["ink-2"], UI[s]) >= 3, `impact hatching ${D["ink-2"]} on ${s}: ${r2(contrast(D["ink-2"], UI[s]))}:1 (>= 3)`);
  check(contrast(D.muted, UI[s]) >= 3, `no-reliable-η dots ${D.muted} on ${s}: ${r2(contrast(D.muted, UI[s]))}:1 (>= 3)`);
  check(contrast(D.sun, UI[s]) >= 3, `the Sun ${D.sun} on ${s}: ${r2(contrast(D.sun, UI[s]))}:1 (>= 3)`);
}

// Ramps: lightness monotone, adjacent steps >= 0.06 (unchanged, re-run for completeness).
for (const [name, r] of [["η ramp", D.ramp], ["a·v ramp", D.av]]) {
  const L = r.map((h) => oklab(h)[0]), dL = L.slice(1).map((v, i) => v - L[i]);
  check(dL.every((d) => d > 0) && Math.min(...dL) >= 0.06, `${name} lightness monotone, min step ${Math.min(...dL).toFixed(3)} (>= 0.06)`);
}
// The accent against the blue data ramps, reported only: an indigo sits close to them, which is why the accent never
// appears inside a plot area, legend or colour scale (author rule, 2026-11-01; enforced by a test from pass 4).
let minN = Infinity, minC = Infinity, at = "";
for (const [name, r] of [["η", D.ramp], ["a·v", D.av]]) r.forEach((h, k) => {
  const n = dE(UI.signal, h), c = worst(UI.signal, h);
  if (n < minN) { minN = n; at = `${name} step ${k}`; }
  minC = Math.min(minC, c);
});
console.log(`info  accent vs data blues: closest ΔE ${minN.toFixed(1)} (${at}), worst colour-vision ΔE ${minC.toFixed(1)}; kept out of every plot`);
console.log(`info  hues (OKLab): accent ${hue(UI.signal).toFixed(0)}°, η ramp mid ${hue(D.ramp[3]).toFixed(0)}°`);
// Critical against the η ramp (decision 3 of Phase 8): unchanged colours, re-checked.
const cr = Math.min(...D.ramp.map((h) => worst(D.critical, h)));
check(cr >= 8, `critical vs every η step, worst colour-vision ΔE ${cr.toFixed(1)} (>= 8)`);
if (failures.length) { console.log(`\n${failures.length} failure(s)`); process.exit(1); }
console.log("\nall checks pass");
