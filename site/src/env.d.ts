/// <reference types="vite/client" />

declare module "virtual:tex" {
  /** KaTeX HTML for each label in src/math/labels.json, rendered at build time. */
  const tex: Record<string, string>;
  export default tex;
}
