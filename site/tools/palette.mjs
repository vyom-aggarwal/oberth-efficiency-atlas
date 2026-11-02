// Site palette (Phase 9, docs/revamp_plan.md §2.1–2.2): dark only, checked, and written to src/styles/palette.css.
//
// Interface: six named colours, a designed dark equivalent of the reference's palette (§2.1), defined here:
//   Void (the page), Panel (the raised surface), Ink (text, and links, underlined), Quiet (secondary text, control
//   outlines, axis lines), Rule (hairlines and gridlines), and Signal, the accent (fills with an Ink label, focus rings,
//   selection; never text, and never inside a plot area, legend or colour scale: the author's rule, 2026-11-01).
//   Signal is the reference's indigo #455ce9 if it passes every accent job, else the nearest variant that does: the
//   smallest OKLab distance over a fine OKLCH grid around it (author decision 1, 2026-11-01).
//   Axis, the decorative part of a plot frame, sits between Rule and Quiet.
// Data: the classic explorer's dark steps, unchanged (author decision 2, 2026-11-01), read from explorer/app.css so
// they cannot drift from the single-file explorer: ink-2 (simulation curves, the impact hatching), muted (the
// no-reliable-η dots, thresholds), band (the loss band's grey, the classic's axis), sun, critical, ok, and the η ramp
// ramp-0…6 (one blue hue, faint to strong). Derived here (Phase 8, docs/restyle_plan.md §3):
//   av-1…7  the a·v ramp: seven steps interpolated in OKLab along the classic ramp from ramp-2 to ramp-6.
// Checks; exit 1 on any failure:
//   text      Ink >= 7:1, Quiet and critical (warnings) >= 4.5:1, on Void and on Panel (WCAG 1.4.3); a Void label on
//             an Ink button >= 4.5:1;
//   non-text  Quiet (control outlines, axis lines) >= 3:1 (WCAG 1.4.11); Axis between Rule and Quiet in lightness;
//   accent    an Ink label on Signal, and Ink text on a Signal selection, >= 4.5:1; Signal as a focus ring >= 3:1 on
//             Void and on Panel;
//   data      the faintest a·v stroke >= 2:1 on Void and on Panel (thin marks; Phase 6's rule); the η < 0 hatching
//             (critical), the impact hatching (ink-2), the no-reliable-η dots (muted) and the Sun >= 3:1;
//   ramps     OKLab L monotone, adjacent |ΔL| >= 0.06, one hue (spread <= 40°, ramp-0 left out: it is nearly grey);
//   colour    critical against every η step, and the Sun against every a·v step: OKLab ΔE x100 >= 15 for normal
//   vision    vision and >= 8 for the worst colour-vision deficiency (Machado, Oliveira and Fernandes 2009, severity 1,
//             in linear sRGB).
// Reported, not checked: Signal's distance from the data blues, the reason it never enters a plot.
// History: Phase 8 emitted the classic's light and dark themes from explorer/app.css. Phase 9 step 2 checked the dark
// palette in tools/phase9-palette.mjs, folded in here in pass 1 (2026-11-02), when the light theme went.
// Run: node tools/palette.mjs        (writes the CSS; --check verifies without writing)
// Tested by src/styles/palette.test.ts (vitest), which runs the checks and compares palette.css.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------- colour maths (OKLab, Björn Ottosson; WCAG 2)
const decode = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const encode = (v) => { v = Math.min(1, Math.max(0, v)); return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; };
const linRGB = (hex) => [1, 3, 5].map((i) => decode(parseInt(hex.slice(i, i + 2), 16) / 255));
const toHex = (lin) => "#" + lin.map(encode).map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
function oklab(hex) {
  const [r, g, b] = linRGB(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
/** OKLab → linear sRGB, unclipped. */
function linFromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
          -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const fromOklab = (lab) => toHex(linFromOklab(lab));
/** OKLCH → hex, or null when outside the sRGB gamut. */
function fromLch(L, C, h) {
  const rgb = linFromOklab([L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)]);
  return rgb.every((v) => v >= 0 && v <= 1) ? toHex(rgb) : null;
}
const hue = (hex) => { const [, a, b] = oklab(hex); return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360; };
const lch = (hex) => { const [L, a, b] = oklab(hex); return [L, Math.hypot(a, b), hue(hex)]; };
const lum = (hex) => { const [r, g, b] = linRGB(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (x, y) => { const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
export const deltaE = (x, y) => Math.hypot(...oklab(x).map((v, i) => v - oklab(y)[i])) * 100;
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
const simulate = (hex, M) => { const c = linRGB(hex); return toHex(M.map((row) => Math.max(0, row.reduce((s, v, i) => s + v * c[i], 0)))); };
const worstCvd = (x, y) => Math.min(...Object.values(CVD).map((M) => deltaE(simulate(x, M), simulate(y, M))));
/** `n` steps interpolated in OKLab along the piecewise-linear path through `stops`. */
const along = (stops, n) => Array.from({ length: n }, (_, k) => {
  const u = (k / (n - 1)) * (stops.length - 1), i = Math.min(Math.floor(u), stops.length - 2), f = u - i;
  const [p, q] = [oklab(stops[i]), oklab(stops[i + 1])];
  return fromOklab(p.map((v, j) => v + f * (q[j] - v)));
});

// ---------------------------------------------------------------- the interface: six named colours (§2.1)
// From the reference's light palette, as a designed dark equivalent, not an inversion: its deepest preloader black
// becomes the page (Void); its dark contact section the raised surface, which also takes the role of its mid-grey hero
// band (Panel); its near-black ink an off-white (Ink); its mid-grey muted text a light grey that keeps 4.5:1 and
// outlines controls at 3:1 (Quiet); its pale hairline a dark one (Rule).
export const REFERENCE_ACCENT = "#455ce9";     // the reference's --blue (measured 2026-11-01)
const BASE = { void: "#111214", panel: "#1b1c1f", ink: "#ecebe7", quiet: "#a3a4a8", rule: "#2f3135" };
const AXIS = "#3d3f44";                         // the decorative part of a plot frame (Quiet carries the ticked axis lines)
// The accent's jobs, each a contrast floor. It is never text on a surface (links are Ink, underlined), so it has no
// 4.5:1 floor against Void or Panel.
const ACCENT_JOBS = [
  [(a) => contrast(BASE.ink, a), 4.5, "Ink label on an accent button"],
  [(a) => contrast(BASE.ink, a), 4.5, "Ink text on the accent selection background"],
  [(a) => contrast(a, BASE.void), 3, "focus ring on Void"],
  [(a) => contrast(a, BASE.panel), 3, "focus ring on Panel"],
];
const passesAccent = (a) => ACCENT_JOBS.every(([f, need]) => f(a) >= need);
/** The reference's accent if it passes every job; else the nearest variant that does, over an OKLCH grid around it
 *  (lightness ±0.06 in 0.001 steps, chroma ±0.05 in 0.002, hue ±8° in 0.5°), checked on the rounded hex. */
export function nearestAccent(ref = REFERENCE_ACCENT) {
  if (passesAccent(ref)) return ref;
  const [L0, C0, h0] = lch(ref);
  let best = Infinity, out = null;
  for (let i = -60; i <= 60; i++) for (let j = -25; j <= 25; j++) for (let k = -16; k <= 16; k++) {
    const hex = fromLch(L0 + i / 1000, C0 + j / 500, h0 + k / 2);
    if (!hex || !passesAccent(hex)) continue;
    const d = deltaE(hex, ref);
    if (d < best) { best = d; out = hex; }
  }
  if (!out) throw new Error(`no variant of ${ref} passes every accent job`);
  return out;
}

// ---------------------------------------------------------------- the data colours: the classic's dark steps
const CLASSIC_CSS = new URL("../../explorer/app.css", import.meta.url);
/** Each data token and the classic's name for it. */
const FROM_CLASSIC = { "ink-2": "ink-2", muted: "muted", band: "axis", sun: "sun", critical: "critical", ok: "ok",
                       ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((k) => [`ramp-${k}`, `ramp-${k}`])) };
/** @returns {Record<string, string>} the data tokens, read from the classic's dark block */
export function classic(text = readFileSync(CLASSIC_CSS, "utf8")) {
  const dark = text.match(/^:root\[data-theme="dark"\] \{([^}]*)\}/m);
  if (!dark) throw new Error("explorer/app.css: the dark :root[data-theme=\"dark\"] block is missing");
  const out = {};
  for (const [name, theirs] of Object.entries(FROM_CLASSIC)) {
    const m = dark[1].match(new RegExp(`--${theirs}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
    if (!m) throw new Error(`explorer/app.css: no --${theirs} in the dark block`);
    out[name] = m[1].toLowerCase();
  }
  return out;
}

// ---------------------------------------------------------------- the palette
const AV_FROM = 2;                              // the a·v ramp starts at ramp-2 (restyle plan §3)
/** @typedef {Record<string, string> & { ramp: string[], av: string[] }} Palette */
let memo = null;
/** @returns {Palette} */
export function palette() {
  if (memo) return memo;
  const d = classic(), ramp = [0, 1, 2, 3, 4, 5, 6].map((k) => d[`ramp-${k}`]);
  memo = { ...BASE, signal: nearestAccent(), axis: AXIS, ...d, ramp, av: along(ramp.slice(AV_FROM), 7) };
  return memo;
}

// ---------------------------------------------------------------- checks
export function runChecks(P = palette(), log = () => {}) {
  const failures = [];
  const check = (ok, msg) => { log(`${ok ? "pass" : "FAIL"}  ${msg}`); if (!ok) failures.push(msg); };
  const r2 = (v) => v.toFixed(2);
  log(`interface: ${["void", "panel", "ink", "quiet", "rule", "signal", "axis"].map((n) => `${n} ${P[n]}`).join("  ")}`);
  for (const [f, need, job] of ACCENT_JOBS)
    log(`info  the reference's accent ${REFERENCE_ACCENT}, ${job}: ${r2(f(REFERENCE_ACCENT))}:1 (>= ${need})`);
  if (P.signal !== REFERENCE_ACCENT) log(`info  Signal ${P.signal}: ΔE ${deltaE(P.signal, REFERENCE_ACCENT).toFixed(2)} from the reference (OKLab x100; just noticeable at about 2)`);
  for (const s of ["void", "panel"]) {
    for (const [k, need, job] of [["ink", 7, "text"], ["quiet", 4.5, "secondary text"], ["critical", 4.5, "warning text"],
                                  ["quiet", 3, "control outline, axis line"]])
      check(contrast(P[k], P[s]) >= need, `${k} on ${s}: ${r2(contrast(P[k], P[s]))}:1 (>= ${need}, ${job})`);
  }
  check(contrast(P.void, P.ink) >= 4.5, `Void label on an Ink button: ${r2(contrast(P.void, P.ink))}:1 (>= 4.5)`);
  for (const [f, need, job] of ACCENT_JOBS) check(f(P.signal) >= need, `Signal ${P.signal}, ${job}: ${r2(f(P.signal))}:1 (>= ${need})`);
  const L = (hex) => oklab(hex)[0];
  check(L(P.rule) < L(P.axis) && L(P.axis) < L(P.quiet), `Axis ${P.axis} between Rule and Quiet in lightness`);
  log(`info  surfaces: Void→Panel ΔL ${r2((L(P.panel) - L(P.void)) * 100)} (OKLab L x100); Rule on Panel ${r2(contrast(P.rule, P.panel))}:1 (decorative)`);
  for (const s of ["void", "panel"]) {
    check(contrast(P.av[0], P[s]) >= 2, `faintest a·v stroke ${P.av[0]} on ${s}: ${r2(contrast(P.av[0], P[s]))}:1 (>= 2, thin marks)`);
    for (const [k, job] of [["critical", "η < 0 hatching"], ["ink-2", "impact hatching"], ["muted", "no-reliable-η dots"], ["sun", "the Sun"]])
      check(contrast(P[k], P[s]) >= 3, `${job} ${P[k]} on ${s}: ${r2(contrast(P[k], P[s]))}:1 (>= 3)`);
  }
  for (const [name, r] of [["η ramp", P.ramp], ["a·v ramp", P.av]]) {
    const Ls = r.map(L), dL = Ls.slice(1).map((v, i) => Math.abs(v - Ls[i])), dir = Math.sign(Ls[Ls.length - 1] - Ls[0]);
    const hs = (name === "η ramp" ? r.slice(1) : r).map(hue), spread = Math.max(...hs) - Math.min(...hs);
    log(`${name}: ${r.join(" ")}`);
    check(Ls.every((v, i) => i === 0 || Math.sign(v - Ls[i - 1]) === dir), `${name} lightness monotone`);
    check(Math.min(...dL) >= 0.06, `${name} adjacent ΔL >= 0.06 (min ${Math.min(...dL).toFixed(3)})`);
    check(spread <= 40, `${name} one hue (spread ${spread.toFixed(1)}° <= 40°)`);
  }
  const pairs = [...P.ramp.map((h, k) => ["critical", P.critical, `ramp-${k}`, h]), ...P.av.map((h, k) => ["sun", P.sun, `av-${k + 1}`, h])];
  let worstSeen = Infinity, worstPair = "";
  for (const [a, x, b, y] of pairs) {
    const n = deltaE(x, y), w = worstCvd(x, y);
    check(n >= 15 && w >= 8, `${a} vs ${b}: ΔE ${n.toFixed(1)} (>= 15), worst CVD ΔE ${w.toFixed(1)} (>= 8)`);
    if (w < worstSeen) { worstSeen = w; worstPair = `${a} vs ${b}`; }
  }
  log(`info  closest pair under colour-vision deficiency: ${worstPair}, ΔE ${worstSeen.toFixed(1)}`);
  // Signal against the data blues, reported only: an indigo sits close to them, which is why it never appears inside a
  // plot area, legend or colour scale (a test from pass 4 enforces that).
  let minN = Infinity, minC = Infinity, at = "";
  for (const [name, r] of [["η", P.ramp], ["a·v", P.av]]) r.forEach((h, k) => {
    const n = deltaE(P.signal, h);
    if (n < minN) { minN = n; at = `${name} step ${k}`; }
    minC = Math.min(minC, worstCvd(P.signal, h));
  });
  log(`info  Signal vs the data blues: closest ΔE ${minN.toFixed(1)} (${at}), worst colour-vision ΔE ${minC.toFixed(1)}; kept out of every plot`);
  return failures;
}

// ---------------------------------------------------------------- CSS
export function css(P = palette()) {
  const line = (n, v) => `  --${n}: ${v};`;
  return `/* Generated by tools/palette.mjs; do not edit by hand. Phase 9 (docs/revamp_plan.md §2.1–2.2), dark only: six
   interface colours, then the data colours (the classic explorer's dark steps, read from explorer/app.css). */
:root {
  color-scheme: dark;
${["void", "panel", "ink", "quiet", "rule", "signal", "axis"].map((n) => line(n, P[n])).join("\n")}
${["ink-2", "muted", "band", "sun", "critical", "ok"].map((n) => line(n, P[n])).join("\n")}
${P.ramp.map((h, k) => line(`ramp-${k}`, h)).join("\n")}
${P.av.map((h, k) => line(`av-${k + 1}`, h)).join("\n")}
}
`;
}
export const OUT = new URL("../src/styles/palette.css", import.meta.url);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const failures = runChecks(palette(), console.log);
  if (process.argv.includes("--check")) {
    let current = "";
    try { current = readFileSync(OUT, "utf8"); } catch { /* missing */ }
    const same = current.replace(/\r\n/g, "\n") === css();
    console.log(`${same ? "pass" : "FAIL"}  src/styles/palette.css matches the definitions`);
    if (!same) failures.push("palette.css");
  } else {
    writeFileSync(OUT, css());
    console.log("\nwrote src/styles/palette.css");
  }
  if (failures.length) { console.log(`\n${failures.length} failure(s)`); process.exit(1); }
  console.log("\nall checks pass");
}
