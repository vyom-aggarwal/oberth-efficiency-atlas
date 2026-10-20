// Build-time page assembly (no client-side Markdown or KaTeX):
// - home sections from content/sections.json + content/*.md (front matter `title:`; prose; `<!-- figure -->`
//   marker; `### Figure caption` block). Math ($…$, $$…$$) is rendered by KaTeX; <sup>n</sup> citations link to
//   the reference list.
// - A file that still contains "TODO" is omitted from the production build with its navigation entry and its
//   figure (author rule, 2026-10-14); the build prints the hidden sections. The dev server shows such a section
//   with a visible TODO banner.
// - Shared header and footer partials (partials/*.html), filled from the exported data.
// - The classic offline explorer (../explorer/oberth_explorer.html) is served at explorer/classic/.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import type { Plugin, ResolvedConfig } from "vite";
import { renderTex } from "./tex-plugin";

const dir = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const CONTENT = dir("../content/");
const PARTIALS = dir("../partials/");
const DATA = dir("../public/data/");
const CLASSIC = dir("../../explorer/oberth_explorer.html");
const TODO = /\bTODO\b/;
// Figures that carry a number ("Figure n"), in page order; data blocks (methods, references) do not.
const NUMBERED = new Set(["hero", "universal-curve", "regimes", "atlas", "timing", "case", "engines"]);

interface Entry { id: string; file: string; figure?: string }
export interface Section {
  id: string; title: string; todo: boolean; figure?: string; figN?: number;
  before: string; after: string; caption: string; notes: string;
}

const md = new MarkdownIt({ html: true, typographer: true, linkify: false });

function frontMatter(src: string): { meta: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return { meta: {}, body: src };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return { meta, body: src.slice(m[0].length) };
}

/** Markdown with KaTeX math and linked citations. */
export function renderMarkdown(src: string): string {
  const math: string[] = [];
  const keep = (html: string) => `@@MATH${math.push(html) - 1}@@`;
  let s = src.replace(/\$\$([\s\S]+?)\$\$/g, (_m, t: string) => keep(renderTex(t.trim(), true)));
  s = s.replace(/(^|[^\\$])\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g, (_m, pre: string, t: string) => pre + keep(renderTex(t, false)));
  return md.render(s)
    .replace(/@@MATH(\d+)@@/g, (_m, i: string) => math[Number(i)])
    .replace(/<sup>(\d+)<\/sup>/g, '<sup><a href="#ref-$1" aria-label="reference $1">$1</a></sup>');
}

export function loadSections(): Section[] {
  const reg: { sections: Entry[] } = JSON.parse(readFileSync(CONTENT + "sections.json", "utf8"));
  return reg.sections.map((e) => {
    const raw = readFileSync(CONTENT + e.file, "utf8");
    const { meta, body } = frontMatter(raw);
    const [prose, caption = ""] = body.split(/^###\s+Figure caption\s*$/m);
    const [before, after = ""] = prose.split(/^\s*<!--\s*figure\s*-->\s*$/m);
    return {
      id: e.id, title: meta.title ?? e.id, todo: TODO.test(raw), figure: e.figure,
      before: renderMarkdown(before), after: renderMarkdown(after), caption: renderMarkdown(caption.trim()),
      notes: renderMarkdown(prose),                // the caption's notes show in the figure's caption
    };
  });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Kept sections (all in dev, only finished ones in production), with figure numbers assigned in page order. */
export function keptSections(all: Section[], dev: boolean): Section[] {
  const kept = all.filter((s) => dev || !s.todo);
  let n = 0;
  for (const s of kept) if (s.figure && NUMBERED.has(s.figure)) s.figN = ++n;
  return kept;
}

function sectionHTML(s: Section, dev: boolean): string {
  const banner = dev && s.todo
    ? `<div class="todo-banner" role="note"><strong>TODO: prose not written yet.</strong> This section is hidden from the production build until its content file (site/content/${esc(s.id)}.md) has no TODO marker. The notes below are the author's checklist.</div>`
    : "";
  const fig = s.figure
    ? `<figure class="figure" id="fig-${s.figure}" data-figure="${s.figure}"${s.figN ? ` data-fig-n="${s.figN}"` : ""}>` +
      `<div class="figure-body"></div>${s.caption ? `<figcaption class="caption">${s.caption}</figcaption>` : ""}</figure>`
    : "";
  const before = dev && s.todo ? `<div class="prose todo-notes">${s.notes}</div>` : s.before ? `<div class="prose">${s.before}</div>` : "";
  const after = !(dev && s.todo) && s.after.trim() ? `<div class="prose">${s.after}</div>` : "";
  if (s.id === "hero") {
    return `<section class="hero" id="hero" aria-labelledby="hero-title" data-section>` +
      `<h1 id="hero-title">${esc(s.title)}</h1>${banner}${before}${fig}${after}</section>`;
  }
  return `<section class="section" id="${s.id}" aria-labelledby="h-${s.id}" data-section>` +
    `<h2 id="h-${s.id}">${esc(s.title)}</h2>${banner}${before}${fig}${after}</section>`;
}

function readData(name: string): any {
  const p = DATA + name;
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

function partial(name: string, base: string): string {
  const site = readData("site.json");
  const methods = readData("methods.json");
  const fill: Record<string, string> = {
    base, repo: site?.repo.url ?? "#", tag: methods?.tag ?? "", tag_commit: methods?.tag_commit ?? "",
    data_git: site?.provenance.git ?? "", tag_url: site ? `${site.repo.url}/tree/${site.repo.tag}` : "#",
    ai_log: site ? `${site.repo.url}/blob/main/docs/ai_use_log.md` : "#",
  };
  return readFileSync(PARTIALS + name, "utf8").replace(/\{\{(\w+)\}\}/g, (_m, k: string) => esc(fill[k] ?? ""));
}

/**
 * Open Graph and Twitter-card tags for a page, from its own <title> and description (nothing to keep in step).
 * og:image and og:url must be absolute: SITE_URL (the deployed root, set by the Pages workflow from
 * actions/configure-pages) is used when present, else the base path. The 404 page gets none (noindex).
 * The image, public/og-image.png (1200 × 630), is made from the hero by tools/og-image.mjs.
 */
function socialMeta(html: string, file: string, base: string): string {
  if (/404\.html$/.test(file)) return "";
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "Oberth Efficiency Atlas";
  const desc = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? "";
  const root = (process.env.SITE_URL ?? base).replace(/\/?$/, "/");
  const path = /[\\/]explorer[\\/]index\.html$/.test(file) ? "explorer/" : "";
  const tag = (attr: string, k: string, v: string) => `    <meta ${attr}="${k}" content="${v}" />\n`;
  return "\n" + tag("property", "og:type", "website") + tag("property", "og:site_name", "Oberth Efficiency Atlas") +
    tag("property", "og:title", title) + tag("property", "og:description", desc) + tag("property", "og:url", root + path) +
    tag("property", "og:image", `${root}og-image.png`) + tag("property", "og:image:width", "1200") +
    tag("property", "og:image:height", "630") +
    tag("property", "og:image:alt", "A flyby trajectory bending around the Sun, with the burn arc coloured by the rate of energy gain") +
    tag("name", "twitter:card", "summary_large_image");
}

export function contentPlugin(): Plugin {
  let config: ResolvedConfig;
  let dev = false;
  return {
    name: "oberth-content",
    configResolved(c) {
      config = c;
      // SITE_SHOW_TODO=1 builds the unfinished sections too (with their TODO banners), for tests and review
      // screenshots of a build; deployed builds never set it.
      dev = c.command === "serve" || process.env.SITE_SHOW_TODO === "1";
    },
    buildStart() {
      if (dev) return;
      const hidden = loadSections().filter((s) => s.todo).map((s) => s.id);
      config.logger.info(hidden.length
        ? `\n[content] hidden in production (content file still has TODO): ${hidden.join(", ")}\n`
        : "\n[content] all sections shown\n");
    },
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const base = config.base;
        let out = html.replace("<!--#header-->", partial("header.html", base)).replace("<!--#footer-->", partial("footer.html", base))
          .replace(/\{\{base\}\}/g, base);             // page links honour the deployed base path
        out = out.replace("</head>", `${socialMeta(out, ctx.filename, base)}</head>`);
        if (!out.includes("<!--#sections-->")) return out;
        const kept = keptSections(loadSections(), dev);
        const hero = kept.find((s) => s.id === "hero");
        const rest = kept.filter((s) => s.id !== "hero");
        const nav = rest.map((s) => `<li><a href="#${s.id}" data-nav="${s.id}">${esc(s.title)}</a></li>`).join("");
        return out
          .replace("<!--#hero-->", hero ? sectionHTML(hero, dev) : `<h1 class="visually-hidden">Oberth Efficiency Atlas</h1>`)
          .replace("<!--#sections-->", rest.map((s) => sectionHTML(s, dev)).join("\n"))
          .replace(/<!--#section-nav-->/g, nav);
      },
    },
    configureServer(server) {
      server.watcher.add([CONTENT, PARTIALS]);
      server.watcher.on("change", (f) => {
        if (f.startsWith(CONTENT.slice(0, -1)) || f.startsWith(PARTIALS.slice(0, -1))) server.ws.send({ type: "full-reload" });
      });
      // The classic explorer, as the production build will serve it.
      server.middlewares.use((req, res, next) => {
        if (req.url && /\/explorer\/classic\/?(index\.html)?$/.test(req.url.split("?")[0])) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(readFileSync(CLASSIC));
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "explorer/classic/index.html", source: readFileSync(CLASSIC) });
    },
  };
}
