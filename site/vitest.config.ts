import { defineConfig } from "vitest/config";

// Unit tests only: src/**/*.test.ts, in node, without the site's build plugins. The Playwright specs in e2e/ run
// with `npm run e2e` (vitest's default glob would collect them too and fail).
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
