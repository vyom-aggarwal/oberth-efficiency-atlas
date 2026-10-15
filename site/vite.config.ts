import { resolve } from "node:path";
import { defineConfig } from "vite";
import { texPlugin } from "./plugins/tex-plugin";

// Base path: "/" locally; the Pages workflow sets BASE_PATH to "/<repo-name>/" (from actions/configure-pages),
// so a repository rename does not break the deployed site.
const base = process.env.BASE_PATH ?? "/";

export default defineConfig(({ command, mode }) => {
  // /style/ is a design reference for development only: served by the dev server, never built for production.
  const pages: Record<string, string> = { main: resolve(__dirname, "index.html") };
  if (command === "serve" || mode === "development") pages.style = resolve(__dirname, "style/index.html");
  return {
    base,
    plugins: [texPlugin()],
    build: {
      target: "es2022",
      rollupOptions: { input: pages },
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  };
});
