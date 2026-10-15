// 14-day package rule: every package in package-lock.json, transitive dependencies included, must have
// been published on or before config.npmBefore, and npmBefore must be at least 14 days before
// config.npmLockedOn (the day the lockfile was written). Queries the npm registry.
// Run: node tools/check-package-age.mjs   (exit 1 on any violation)
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const before = new Date(pkg.config.npmBefore + "T00:00:00Z");
const lockedOn = new Date(pkg.config.npmLockedOn + "T00:00:00Z");
const DAY = 86400e3;

const entries = Object.entries(lock.packages)
  .filter(([path, p]) => path.startsWith("node_modules/") && p.version && !p.link)
  .map(([path, p]) => ({ name: path.slice(path.lastIndexOf("node_modules/") + 13), version: p.version }));
const unique = [...new Map(entries.map((e) => [`${e.name}@${e.version}`, e])).values()];

async function published({ name, version }) {
  const res = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const doc = await res.json();
  return new Date(doc.time[version]);
}

const bad = [];
let newest = null;
for (let i = 0; i < unique.length; i += 16) {
  const batch = unique.slice(i, i + 16);
  const times = await Promise.all(batch.map(published));
  batch.forEach((e, j) => {
    const t = times[j];
    if (!newest || t > newest.t) newest = { ...e, t };
    if (!(t < before)) bad.push(`${e.name}@${e.version} published ${t.toISOString()}`);
  });
}
const gapDays = (lockedOn - before) / DAY;
console.log(`${unique.length} locked packages; newest ${newest.name}@${newest.version} ` +
  `(${newest.t.toISOString().slice(0, 10)}); cutoff ${pkg.config.npmBefore}, locked on ${pkg.config.npmLockedOn} ` +
  `(${gapDays} days apart)`);
if (gapDays < 14) bad.push(`npmBefore is only ${gapDays} days before npmLockedOn (need >= 14)`);
if (bad.length) {
  console.error("14-day rule violations:\n  " + bad.join("\n  "));
  process.exit(1);
}
console.log("14-day rule: ok");
