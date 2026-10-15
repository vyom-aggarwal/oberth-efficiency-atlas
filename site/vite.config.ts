import { resolve } from "node:path";
import { defineConfig } from "vite";
import { contentPlugin } from "./plugins/content-plugin";
import { texPlugin } from "./plugins/tex-plugin";

// Base path: "/" locally; the Pages workflow sets BASE_PATH to "/<repo-name>/" (from actions/configure-pages),
// so a repository rename does not break the deployed site.
const base = process.env.BASE_PATH ?? "/";

export default defineConfig(({ command, mode }) => {
  const pages: Record<string, string> = {
    main: resolve(__dirname, "index.html"),
    explorer: resolve(__dirname, "explorer/index.html"),
    notfound: resolve(__dirname, "404.html"),
  };
  // /style/ is a design reference for development only: served by the dev server, never built for production.
  if (command === "serve" || mode === "development") pages.style = resolve(__dirname, "style/index.html");
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
