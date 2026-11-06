import { resolve } from "node:path";
import { defineConfig } from "vite";
import { contentPlugin, researchIncluded } from "./plugins/content-plugin";
import { texPlugin } from "./plugins/tex-plugin";

// Base path: "/" locally; the Pages workflow sets BASE_PATH to "/<repo-name>/" (from actions/configure-pages),
// so a repository rename does not break the deployed site.
const base = process.env.BASE_PATH ?? "/";

export default defineConfig(({ command, mode }) => {
  // Phase 7: / is the landing page; the article is /research/, built only while it has a published section (or
  // when unfinished content is shown); the reference list is /references/, always built.
  const pages: Record<string, string> = {
    main: resolve(__dirname, "index.html"),
    references: resolve(__dirname, "references/index.html"),
    explorer: resolve(__dirname, "explorer/index.html"),
    about: resolve(__dirname, "about/index.html"),
    notfound: resolve(__dirname, "404.html"),
  };
  if (researchIncluded(command)) pages.research = resolve(__dirname, "research/index.html");
  // /style-9/: the Phase 9 design reference (docs/revamp_plan.md §2.11), development only. (The Phase 6 /style/ page was
  // retired on 2026-11-06; its interaction test moved to e2e/interact-figures.spec.ts.)
  if (command === "serve" || mode === "development") pages.style9 = resolve(__dirname, "style-9/index.html");
  return {
    base,
    plugins: [texPlugin(), contentPlugin()],
    build: {
      target: "es2022",
      rollupOptions: { input: pages },
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  };
});
