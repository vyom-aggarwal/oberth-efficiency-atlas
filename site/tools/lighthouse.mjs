// Lighthouse 13.5.0 (docs/site_plan.md §3) on the built site served by `vite preview`: the home page and the
// explorer, mobile and desktop. The build keeps the unfinished sections (SITE_SHOW_TODO=1), so the audit sees the
// full pages with every figure. Reports go to ../runs/lighthouse/; the scores are printed and, in GitHub Actions,
// written to the job summary.
//
// Gate (author, 2026-10-19; CI is the record): accessibility, best practices and SEO must each be at least 0.90 on
// both pages, mobile and desktop, or the run exits 1. Performance is reported, not enforced: shared CI runners make
// it noisy (LH_MIN_PERFORMANCE=0.9 enforces it too, for a run on a quiet machine).
// Writes runs/lighthouse/summary.json (scores, Lighthouse and Chrome versions, date), the file to send back.
//
// Needs local sockets (the preview server and Chrome's debugging port), so it cannot run where loopback is blocked
// (as in the assistant's sandbox, 2026-10-18); run it from a normal shell or in CI.
// Run (in site/):  npm run lighthouse
// Dependencies are resolved as of package.json config.npmBefore (the 14-day rule), through npm_config_before.
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const OUT = fileURLToPath(new URL("../../runs/lighthouse/", import.meta.url));
const PORT = 4174;
const PAGES = [["home", ""], ["explorer", "explorer/"]];
const FACTORS = ["mobile", "desktop"];
const CATS = ["performance", "accessibility", "best-practices", "seo"];
const GATED = ["accessibility", "best-practices", "seo"];          // each ≥ 0.90 on every page and form factor
const FLOOR = 0.9;

// Lighthouse runs as an awaited child process, never a synchronous one: the preview server lives in this process,
// and a synchronous call would block its event loop, so Chrome's navigation would wait until it timed out (the first
// CI runs, 2026-10-21: "Target closed" after 10 min 43 s).
// On Windows npx.cmd needs a shell, which would split an argument at its spaces (--chrome-flags), so those are quoted.
function run(cmd, args, env) {
  const win = process.platform === "win32";
  const argv = win ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, argv, { stdio: "inherit", shell: win, env });
    child.on("error", reject);
    child.on("exit", (code, signal) => (code === 0 ? resolve()
      : reject(new Error(`${cmd} ${args.slice(0, 3).join(" ")} … exited with ${code ?? signal}`))));
  });
}

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
      await run(process.platform === "win32" ? "npx.cmd" : "npx", args, { ...process.env, npm_config_before: pkg.config.npmBefore });
      const report = JSON.parse(readFileSync(`${out}.report.json`, "utf8"));
      rows.push({ page: name, form: ff, lighthouse: report.lighthouseVersion, chrome: report.environment?.hostUserAgent ?? "",
        ...Object.fromEntries(CATS.map((c) => [c, report.categories[c]?.score ?? null])) });
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

const perfFloor = Number(process.env.LH_MIN_PERFORMANCE ?? NaN);
const failures = rows.flatMap((r) => [
  ...GATED.filter((c) => r[c] === null || r[c] < FLOOR).map((c) => `${r.page} (${r.form}): ${c} ${pct(r[c])} < ${100 * FLOOR}`),
  ...(Number.isFinite(perfFloor) && (r.performance === null || r.performance < perfFloor)
    ? [`${r.page} (${r.form}): performance ${pct(r.performance)} < ${100 * perfFloor}`] : []),
]);
writeFileSync(`${OUT}summary.json`, JSON.stringify({ date: new Date().toISOString(), gate: { categories: GATED, floor: FLOOR },
  performance_enforced: Number.isFinite(perfFloor) ? perfFloor : false, pass: failures.length === 0, failures, rows }, null, 1));
console.log(`Summary: runs/lighthouse/summary.json`);
if (failures.length) {
  console.error(`Lighthouse gate failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
