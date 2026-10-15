// Site palette: generated from OKLCH definitions, checked, and written to src/styles/palette.css.
//
// Six named colours (docs/site_plan.md §5): Paper, Ink, Graphite, Rule, and two 7-step ramps:
// Burn (a·v, the rate of orbital-energy gain: the only strong colour on the site) and Slate (η heatmap,
// v∞/v_esc families, the profile band). Dark mode is selected, not inverted: its own steps, with Burn
// anchored bright at high a·v.
// Checks (the dataviz method's ordinal-ramp checks plus WCAG text contrast); exit 1 on any failure:
//   ramps: OKLab L monotone, adjacent |ΔL| >= 0.06, one hue (spread <= 40°), Burn's faint end >= 2:1 on Paper
//          (Burn draws thin marks; Slate's faint end may recede, it only fills heatmap cells);
//   text:  Ink >= 7:1 and Graphite >= 4.5:1 on Paper; Burn vs Slate distinct (OKLab ΔE x100 >= 15 at mid steps).
// Run: node tools/palette.mjs        (writes the CSS; --check to verify without writing)
import { writeFileSync, readFileSync } from "node:fs";

// ---------------------------------------------------------------- colour maths (OKLab, Björn Ottosson)
function oklchToLinear(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
          -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
const encode = (v) => { v = Math.min(1, Math.max(0, v)); return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; };
const decode = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** OKLCH -> hex; chroma is reduced (L and h held) until the colour is inside sRGB. */
function oklch(L, C, h) {
  let c = C;
  while (!inGamut(oklchToLinear(L, c, h)) && c > 0) c -= 0.002;
  return "#" + oklchToLinear(L, Math.max(c, 0), h).map(encode)
    .map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}
const linRGB = (hex) => [1, 3, 5].map((i) => decode(parseInt(hex.slice(i, i + 2), 16) / 255));
function oklab(hex) {
  const [r, g, b] = linRGB(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const hue = (hex) => { const [, a, b] = oklab(hex); return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360; };
const lum = (hex) => { const [r, g, b] = linRGB(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (x, y) => { const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
const deltaE = (x, y) => Math.hypot(...oklab(x).map((v, i) => v - oklab(y)[i])) * 100;

// ---------------------------------------------------------------- definitions
const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const ramp = (Ls, Cs, hs) => Ls.map((L, i) => oklch(L, Cs[i], hs[i]));
const N = 7;
const THEMES = {
  light: {
    paper: oklch(0.985, 0.003, 230), ink: oklch(0.24, 0.025, 255),
    graphite: oklch(0.47, 0.02, 255), rule: oklch(0.89, 0.008, 245),
    burn: ramp(lin(0.765, 0.39, N), [0.12, 0.15, 0.17, 0.175, 0.165, 0.145, 0.12], lin(66, 33, N)),
    slate: ramp(lin(0.95, 0.33, N), lin(0.012, 0.07, N), lin(240, 255, N)),
  },
  dark: {
    paper: oklch(0.225, 0.026, 252), ink: oklch(0.945, 0.008, 245),
    graphite: oklch(0.76, 0.016, 245), rule: oklch(0.36, 0.024, 252),
    burn: ramp(lin(0.475, 0.91, N), [0.12, 0.15, 0.165, 0.165, 0.15, 0.125, 0.095], lin(36, 72, N)),
    slate: ramp(lin(0.30, 0.91, N), lin(0.035, 0.03, N), lin(255, 240, N)),
  },
};

// ---------------------------------------------------------------- checks
const failures = [];
const check = (ok, msg) => { console.log(`${ok ? "pass" : "FAIL"}  ${msg}`); if (!ok) failures.push(msg); };
for (const [mode, t] of Object.entries(THEMES)) {
  console.log(`\n${mode}: paper ${t.paper}  ink ${t.ink}  graphite ${t.graphite}  rule ${t.rule}`);
  check(contrast(t.ink, t.paper) >= 7, `${mode} Ink on Paper ${contrast(t.ink, t.paper).toFixed(2)}:1 (>= 7)`);
  check(contrast(t.graphite, t.paper) >= 4.5, `${mode} Graphite on Paper ${contrast(t.graphite, t.paper).toFixed(2)}:1 (>= 4.5)`);
  for (const name of ["burn", "slate"]) {
    const r = t[name], L = r.map((h) => oklab(h)[0]);
    const dL = L.slice(1).map((v, i) => Math.abs(v - L[i]));
    const mono = L.every((v, i) => i === 0 || Math.sign(v - L[i - 1]) === Math.sign(L[1] - L[0]));
    const hs = r.map(hue), spread = Math.max(...hs) - Math.min(...hs);
    console.log(`${mode} ${name}: ${r.join(" ")}`);
    check(mono, `${mode} ${name} lightness monotone`);
    check(Math.min(...dL) >= 0.06, `${mode} ${name} adjacent ΔL >= 0.06 (min ${Math.min(...dL).toFixed(3)})`);
    check(spread <= 40, `${mode} ${name} one hue (spread ${spread.toFixed(0)}° <= 40°)`);
    if (name === "burn")
      check(contrast(r[0], t.paper) >= 2, `${mode} burn faint end ${contrast(r[0], t.paper).toFixed(2)}:1 on Paper (>= 2)`);
  }
  check(deltaE(t.burn[3], t.slate[3]) >= 15, `${mode} Burn vs Slate mid steps ΔE ${deltaE(t.burn[3], t.slate[3]).toFixed(1)} (>= 15)`);
}

// ---------------------------------------------------------------- CSS
const vars = (t) => [
  `  --paper: ${t.paper};`, `  --ink: ${t.ink};`, `  --graphite: ${t.graphite};`, `  --rule: ${t.rule};`,
  ...t.burn.map((h, i) => `  --burn-${i + 1}: ${h};`), ...t.slate.map((h, i) => `  --slate-${i + 1}: ${h};`),
].join("\n");
const css = `/* Generated by tools/palette.mjs from OKLCH definitions; do not edit by hand. */
:root {
  color-scheme: light;
${vars(THEMES.light)}
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) {
    color-scheme: dark;
${vars(THEMES.dark).replace(/^/gm, "  ")}
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
${vars(THEMES.dark)}
}
`;
const out = new URL("../src/styles/palette.css", import.meta.url);
if (process.argv.includes("--check")) {
  let current = "";
  try { current = readFileSync(out, "utf8"); } catch { /* missing */ }
  check(current.replace(/\r\n/g, "\n") === css, "src/styles/palette.css matches the definitions");
} else {
  writeFileSync(out, css);
  console.log("\nwrote src/styles/palette.css");
}
if (failures.length) process.exit(1);
