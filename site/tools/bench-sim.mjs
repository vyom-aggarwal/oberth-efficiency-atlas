// Simulator timing for the hero's case (site/public/data/hero.json) across its slider range, Π = 0.001 … 1000.
// Reports the median and worst time of one recorded simulation per Π (node; the browser figure is measured by
// the Playwright hero test). Run: node tools/bench-sim.mjs
import { readFileSync } from "node:fs";
import { fromTargets, simulate } from "../src/sim/oberth-sim.js";

const hero = JSON.parse(readFileSync(new URL("../public/data/hero.json", import.meta.url), "utf8"));
const { v_inf, dv, c } = hero.nd;
const vp = Math.sqrt(v_inf * v_inf + 2);
const pis = Array.from({ length: 25 }, (_, i) => 10 ** (-3 + (6 * i) / 24));
for (let i = 0; i < 3; i++) simulate({ ...fromTargets(1, 0, dv / vp, dv / c), record: true });   // warm up
const rows = pis.map((Pi) => {
  const p = { ...fromTargets(Pi, v_inf / Math.SQRT2, dv / vp, dv / c), record: true };
  const times = [];
  let r;
  for (let k = 0; k < 7; k++) {
    const t0 = performance.now();
    r = simulate(p);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const steps = r.segments.reduce((n, s) => n + s.t.length, 0);
  return { Pi, median: times[3], worst: times[6], steps, eta: r.eta };
});
for (const r of rows) console.log(`Pi ${r.Pi.toExponential(2).padStart(9)}  median ${r.median.toFixed(2).padStart(6)} ms  worst ${r.worst.toFixed(2).padStart(6)} ms  steps ${String(r.steps).padStart(4)}  eta ${r.eta.toFixed(6)}`);
const worst = rows.reduce((a, b) => (b.worst > a.worst ? b : a));
console.log(`worst single simulation: ${worst.worst.toFixed(2)} ms at Pi = ${worst.Pi.toPrecision(3)}; at Pi = 1000: ` +
  `${rows[rows.length - 1].median.toFixed(2)} ms median, ${rows[rows.length - 1].worst.toFixed(2)} ms worst`);
