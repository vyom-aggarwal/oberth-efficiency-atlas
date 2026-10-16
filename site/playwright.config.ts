import { defineConfig } from "@playwright/test";

// Smoke tests and review screenshots. Uses the installed Google Chrome (channel "chrome"), so no browser
// download is needed locally or on GitHub's Ubuntu runners. Screenshots go to ../runs/screens/ (gitignored).
// Two modes:
// - default: the Vite dev server on SITE_PORT (5173), started here;
// - SITE_DIST=<built dir>: no server; e2e/fixtures.ts answers http://site.test/ from the build. Build first with
//   `SITE_SHOW_TODO=1 npx vite build --mode development` to include the unfinished sections and /style/.
const PORT = Number(process.env.SITE_PORT ?? 5173);
const DIST = process.env.SITE_DIST;
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,                // one browser at a time, so the hero's frame-time measurement is not competing
  reporter: [["list"]],
  use: { baseURL: DIST ? "http://site.test/" : `http://localhost:${PORT}/`, channel: "chrome", browserName: "chromium" },
  webServer: DIST ? undefined : {
    command: process.env.SITE_SERVER ?? "npm run dev",
    port: PORT,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
