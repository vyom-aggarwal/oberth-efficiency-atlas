// Build-time KaTeX: no KaTeX JavaScript reaches the browser.
// - HTML pages: <x-tex>…</x-tex> (inline) and <x-tex display>…</x-tex> are replaced by KaTeX markup.
// - Scripts: `import tex from "virtual:tex"` gives the rendered HTML of every label in src/math/labels.json,
//   keyed by name (axis titles, legends and readouts use these).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import katex from "katex";
import type { Plugin } from "vite";

export const MACROS: Record<string, string> = {
  "\\vinf": "v_{\\infty}",
  "\\vesc": "v_{\\mathrm{esc}}",
  "\\vp": "v_{p}",
  "\\Rsun": "R_{\\odot}",
};

export function renderTex(tex: string, displayMode = false): string {
  return katex.renderToString(tex, { displayMode, throwOnError: true, strict: "error", macros: { ...MACROS } });
}

const LABELS = fileURLToPath(new URL("../src/math/labels.json", import.meta.url));
const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

export function texPlugin(): Plugin {
  const VIRTUAL = "virtual:tex";
  const RESOLVED = "\0" + VIRTUAL;
  return {
    name: "oberth-tex",
    resolveId(id) {
      return id === VIRTUAL ? RESOLVED : null;
    },
    load(id) {
      if (id !== RESOLVED) return null;
      this.addWatchFile(LABELS);
      const labels: Record<string, string> = JSON.parse(readFileSync(LABELS, "utf8"));
      const out = Object.fromEntries(Object.entries(labels).map(([k, t]) => [k, renderTex(t)]));
      return `export default ${JSON.stringify(out)};`;
    },
    transformIndexHtml(html) {
      return html.replace(/<x-tex( display)?>([\s\S]*?)<\/x-tex>/g, (_m, d, t) => renderTex(decode(t.trim()), !!d));
    },
  };
}
