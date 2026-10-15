import { defineConfig } from "@playwright/test";

// Smoke tests and review screenshots. Uses the installed Google Chrome (channel "chrome"), so no browser
// download is needed locally or on GitHub's Ubuntu runners. Screenshots go to ../runs/screens/ (gitignored).
const PORT = Number(process.env.SITE_PORT ?? 5173);
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, channel: "chrome", browserName: "chromium" },
  webServer: {
    command: process.env.SITE_SERVER ?? "npm run dev",
    port: PORT,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
