import { defineConfig } from "@playwright/test";
import type { SiteOptions } from "./e2e/fixtures";

// Smoke tests and review screenshots. Uses the installed Google Chrome (channel "chrome"), so no browser
// download is needed locally or on GitHub's Ubuntu runners. Screenshots go to ../runs/screens/ (gitignored).
// Two modes:
// - default: the Vite dev server on SITE_PORT (5173), started here;
// - SITE_DIST=<built dir>: no server; e2e/fixtures.ts answers http://site.test/ from the build. Build first with
//   `SITE_SHOW_TODO=1 npx vite build --mode development` to include the unfinished sections and /style/.
const PORT = Number(process.env.SITE_PORT ?? 5173);
const DIST = process.env.SITE_DIST;
// The production build (Phase 7): SITE_DIST_PROD=<dir>, built with BASE_PATH=SITE_BASE (default the project path, as
// on GitHub Pages) and without unfinished content; e2e/prod.spec.ts runs against it, the other specs against SITE_DIST.
const PROD = process.env.SITE_DIST_PROD;
const PROD_BASE = process.env.SITE_BASE ?? "/oberth-efficiency-atlas/";
export default defineConfig<SiteOptions>({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,                // one browser at a time, so the hero's frame-time measurement is not competing
  reporter: [["list"]],
  use: { baseURL: DIST ? "http://site.test/" : `http://localhost:${PORT}/`, channel: "chrome", browserName: "chromium" },
  projects: [
    { name: "site", testIgnore: /prod\.spec\.ts$/ },
    ...(PROD ? [{ name: "production", testMatch: /prod\.spec\.ts$/,
                  use: { siteDist: PROD, siteBase: PROD_BASE, baseURL: `http://site.test${PROD_BASE}` } }] : []),
  ],
  webServer: DIST ? undefined : {
    command: process.env.SITE_SERVER ?? "npm run dev",
    port: PORT,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
