import { defineConfig } from "vitest/config";

// Unit tests only: src/**/*.test.ts and plugins/*.test.ts (the build plugins' pure functions), in node, without the
// site's build plugins applied. The Playwright specs in e2e/ run with `npm run e2e` (vitest's default glob would
// collect them too and fail).
export default defineConfig({
  test: { include: ["src/**/*.test.ts", "plugins/*.test.ts"], environment: "node" },
});
