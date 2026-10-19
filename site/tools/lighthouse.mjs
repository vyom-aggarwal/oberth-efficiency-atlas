// Lighthouse 13.5.0 (docs/site_plan.md §3) on the built site served by `vite preview`: the home page and the
// explorer, mobile and desktop. The build keeps the unfinished sections (SITE_SHOW_TODO=1), so the audit sees the
// full pages with every figure. Reports go to ../runs/lighthouse/; the scores are printed and, in GitHub Actions,
// written to the job summary.
//
// Needs local sockets (the preview server and Chrome's debugging port), so it cannot run where loopback is blocked
// (as in the assistant's sandbox, 2026-10-18); run it from a normal shell or in CI.
// Run (in site/):  npm run lighthouse
//   LH_MIN_PERFORMANCE=0.9  fail if any performance score is below 0.9 (the author's font-revisit threshold)
// Dependencies are resolved as of package.json config.npmBefore (the 14-day rule), through npm_config_before.
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const OUT = fileURLToPath(new URL("../../runs/lighthouse/", import.meta.url));
const PORT = 4174;
const PAGES = [["home", ""], ["explorer", "explorer/"]];
const FACTORS = ["mobile", "desktop"];
const CATS = ["performance", "accessibility", "best-practices", "seo"];

mkdirSync(OUT, { recursive: true });
process.env.SITE_SHOW_TODO = "1";
await build({ logLevel: "warn", build: { outDir: "dist-lh", emptyOutDir: true } });
const server = await preview({ build: { outDir: "dist-lh" }, preview: { port: PORT, strictPort: true } });

const rows = [];
try {
  for (const [name, path] of PAGES) {
    for (const ff of FACTORS) {
      const out = `${OUT}${name}-${ff}`;
      const args = ["--yes", "lighthouse@13.5.0", `http://localhost:${PORT}/${path}`, "--output=json", "--output=html",
        `--output-path=${out}`, "--quiet", "--chrome-flags=--headless=new --no-sandbox", ...(ff === "desktop" ? ["--preset=desktop"] : [])];
      execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", args, {
        stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, npm_config_before: pkg.config.npmBefore } });
      const report = JSON.parse(readFileSync(`${out}.report.json`, "utf8"));
      rows.push({ page: name, form: ff, ...Object.fromEntries(CATS.map((c) => [c, report.categories[c]?.score ?? null])) });
    }
  }
} finally {
  await new Promise((r) => server.httpServer.close(r));
}

const pct = (v) => (v === null ? "—" : String(Math.round(100 * v)));
const table = ["| page | form | " + CATS.join(" | ") + " |", "|---|---|" + CATS.map(() => "---|").join(""),
  ...rows.map((r) => `| ${r.page} | ${r.form} | ${CATS.map((c) => pct(r[c])).join(" | ")} |`)].join("\n");
console.log(`\nLighthouse 13.5.0 scores (reports in runs/lighthouse/):\n${table}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Lighthouse\n\n${table}\n`);

const floor = Number(process.env.LH_MIN_PERFORMANCE ?? NaN);
const low = rows.filter((r) => Number.isFinite(floor) && r.performance !== null && r.performance < floor);
if (low.length) {
  console.error(`Performance below ${floor}: ${low.map((r) => `${r.page} (${r.form})`).join(", ")}`);
  process.exit(1);
}
