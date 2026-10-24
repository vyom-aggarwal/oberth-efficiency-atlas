// Site palette (Phase 8, docs/restyle_plan.md): the classic explorer's colours, checked, and written to
// src/styles/palette.css.
//
// Source: explorer/app.css, the single-file explorer's stylesheet. Its light and dark tokens are read from that file,
// so the site cannot drift from it: bg, panel, ink, ink-2, muted, grid, axis, accent, sun, critical, ok and the
// η ramp ramp-0…6 (one blue hue, faint to strong). Dark mode is the classic's own selected steps, not an inversion.
// Derived here, where the classic has no equivalent (restyle plan §3–4, approved 2026-10-23):
//   link   light: ramp-4 (the accent is 4.30:1 on bg, short of 4.5:1 for text); dark: the accent;
//   av-1…7 the a·v ramp: seven steps interpolated in OKLab along the classic ramp from AV_FROM to ramp-6 (the paper's
//          engines animation colours a·v with this ramp; the faintest steps are too faint for thin marks).
// Checks; exit 1 on any failure:
//   text      ink >= 7:1; ink-2, link and critical >= 4.5:1 (WCAG 1.4.3), on bg and on panel;
//   non-text  muted (control outlines, axis lines) and accent (focus rings, checked controls) >= 3:1 (WCAG 1.4.11);
//   ramps     OKLab L monotone, adjacent |ΔL| >= 0.06, one hue (spread <= 40°, ramp-0 left out: it is nearly grey);
//             the a·v faint end >= 2:1 on bg and on panel (it draws thin marks; Phase 6's rule);
//   colour    critical (η < 0 cells) against every η step: OKLab ΔE x100 >= 15 for normal vision and >= 8 for the worst
//   vision    colour-vision deficiency (Machado, Oliveira and Fernandes 2009, severity 1, in linear sRGB); the sun
//             against every a·v step, the same thresholds.
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
function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return toHex([4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]);
}
const hue = (hex) => { const [, a, b] = oklab(hex); return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360; };
const lum = (hex) => { const [r, g, b] = linRGB(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (x, y) => { const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
const deltaE = (x, y) => Math.hypot(...oklab(x).map((v, i) => v - oklab(y)[i])) * 100;
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

// ---------------------------------------------------------------- the classic's tokens (explorer/app.css)
const CLASSIC_CSS = new URL("../../explorer/app.css", import.meta.url);
const NAMES = ["bg", "panel", "ink", "ink-2", "muted", "grid", "axis", "accent", "sun", "critical", "ok",
               ...[0, 1, 2, 3, 4, 5, 6].map((k) => `ramp-${k}`)];
function tokens(block) {
  const out = {};
  for (const name of NAMES) {
    const m = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
    if (!m) throw new Error(`explorer/app.css: no --${name} in ${block.slice(0, 40)}…`);
    out[name] = m[1].toLowerCase();
  }
  return out;
}
/** @returns {{ light: Record<string, string>, dark: Record<string, string> }} */
export function classic(text = readFileSync(CLASSIC_CSS, "utf8")) {
  const light = text.match(/^:root \{([^}]*)\}/m), dark = text.match(/^:root\[data-theme="dark"\] \{([^}]*)\}/m);
  if (!light || !dark) throw new Error("explorer/app.css: the light :root or the dark :root[data-theme=\"dark\"] block is missing");
  return { light: tokens(light[1]), dark: tokens(dark[1]) };
}

// ---------------------------------------------------------------- derived tokens
const AV_FROM = 2;                            // the a·v ramp starts at ramp-2 (restyle plan §3)
/** @typedef {Record<string, any> & { link: string, ramp: string[], av: string[] }} Theme */
/** @returns {{ light: Theme, dark: Theme }} */
export function themes(c = classic()) {
  /** @type {any} */
  const out = {};
  for (const [mode, t] of Object.entries(c)) {
    const ramp = [0, 1, 2, 3, 4, 5, 6].map((k) => t[`ramp-${k}`]);
    out[mode] = { ...t, link: mode === "light" ? t["ramp-4"] : t.accent, ramp, av: along(ramp.slice(AV_FROM), 7) };
  }
  return out;
}

// ---------------------------------------------------------------- checks
export function runChecks(T = themes(), log = () => {}) {
  const failures = [];
  const check = (ok, msg) => { log(`${ok ? "pass" : "FAIL"}  ${msg}`); if (!ok) failures.push(msg); };
  const r2 = (v) => v.toFixed(2);
  for (const [mode, t] of Object.entries(T)) {
    log(`\n${mode}: ${NAMES.slice(0, 11).map((n) => `${n} ${t[n]}`).join("  ")}  link ${t.link}`);
    for (const s of ["bg", "panel"]) {
      for (const [k, need, job] of [["ink", 7, "text"], ["ink-2", 4.5, "secondary text"], ["link", 4.5, "link text"],
                                    ["critical", 4.5, "warning text"], ["muted", 3, "control outline, axis line"],
                                    ["accent", 3, "focus ring, checked control"]])
        check(contrast(t[k], t[s]) >= need, `${mode} ${k} on ${s} ${r2(contrast(t[k], t[s]))}:1 (>= ${need}, ${job})`);
    }
    for (const [name, r] of [["η ramp", t.ramp], ["a·v ramp", t.av]]) {
      const L = r.map((h) => oklab(h)[0]);
      const dL = L.slice(1).map((v, i) => Math.abs(v - L[i]));
      const dir = Math.sign(L[L.length - 1] - L[0]);
      const hs = (name === "η ramp" ? r.slice(1) : r).map(hue), spread = Math.max(...hs) - Math.min(...hs);
      log(`${mode} ${name}: ${r.join(" ")}`);
      check(L.every((v, i) => i === 0 || Math.sign(v - L[i - 1]) === dir), `${mode} ${name} lightness monotone`);
      check(Math.min(...dL) >= 0.06, `${mode} ${name} adjacent ΔL >= 0.06 (min ${Math.min(...dL).toFixed(3)})`);
      check(spread <= 40, `${mode} ${name} one hue (spread ${spread.toFixed(1)}° <= 40°)`);
    }
    for (const s of ["bg", "panel"])
      check(contrast(t.av[0], t[s]) >= 2, `${mode} a·v faint end ${t.av[0]} on ${s} ${r2(contrast(t.av[0], t[s]))}:1 (>= 2, thin marks)`);
    const pairs = [...t.ramp.map((h, k) => ["critical", t.critical, `ramp-${k}`, h]), ...t.av.map((h, k) => ["sun", t.sun, `av-${k + 1}`, h])];
    let worstNormal = Infinity, worstCvdSeen = Infinity, worstPair = "";
    for (const [a, x, b, y] of pairs) {
      const n = deltaE(x, y), w = worstCvd(x, y);
      check(n >= 15 && w >= 8, `${mode} ${a} vs ${b}: ΔE ${n.toFixed(1)} (>= 15), worst CVD ΔE ${w.toFixed(1)} (>= 8)`);
      if (w < worstCvdSeen) { worstCvdSeen = w; worstPair = `${a} vs ${b}`; }
      worstNormal = Math.min(worstNormal, n);
    }
    log(`${mode} closest pair under colour-vision deficiency: ${worstPair}, ΔE ${worstCvdSeen.toFixed(1)}`);
  }
  return failures;
}

// ---------------------------------------------------------------- CSS
const vars = (t) => [
  ...NAMES.slice(0, 11).map((n) => `  --${n}: ${t[n]};`), `  --link: ${t.link};`,
  ...t.ramp.map((h, k) => `  --ramp-${k}: ${h};`), ...t.av.map((h, k) => `  --av-${k + 1}: ${h};`),
].join("\n");
export function css(T = themes()) {
  return `/* Generated by tools/palette.mjs from explorer/app.css (the classic explorer); do not edit by hand. */
:root {
  color-scheme: light;
${vars(T.light)}
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) {
    color-scheme: dark;
${vars(T.dark).replace(/^/gm, "  ")}
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
${vars(T.dark)}
}
`;
}
export const OUT = new URL("../src/styles/palette.css", import.meta.url);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const failures = runChecks(themes(), console.log);
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
  if (failures.length) process.exit(1);
}
