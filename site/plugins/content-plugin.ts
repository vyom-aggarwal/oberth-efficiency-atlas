// Build-time page assembly (no client-side Markdown or KaTeX):
// - article sections (/research/) from content/sections.json + content/*.md (front matter `title:`; prose;
//   `<!-- figure -->` marker; `### Figure caption` block). Math ($…$, $$…$$) is rendered by KaTeX; <sup>n</sup>
//   citations link to the references page (/references/#ref-n, Phase 7).
// - A file that still contains "TODO" is omitted from the production build with its navigation entry and its
//   figure (author rule, 2026-10-14); the build prints the hidden sections. The dev server shows such a section
//   with a visible TODO banner.
// - While every article section is TODO, /research/ is left out of the production build and the Research link is
//   not rendered anywhere (author, 2026-10-21: no link to an empty page); see researchIncluded().
// - The reference list, built into /references/ from site.json (always published: it holds no prose).
// - Shared header and footer partials (partials/*.html), filled from the exported data.
// - The classic offline explorer (../explorer/oberth_explorer.html) is served at explorer/classic/.
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import type { Plugin, ResolvedConfig } from "vite";
import { referenceHref, referenceListHTML } from "../src/lib/references";
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

/** Markdown with KaTeX math, and citations linked to the references page under `base`. */
export function renderMarkdown(src: string, base = "/"): string {
  const math: string[] = [];
  const keep = (html: string) => `@@MATH${math.push(html) - 1}@@`;
  let s = src.replace(/\$\$([\s\S]+?)\$\$/g, (_m, t: string) => keep(renderTex(t.trim(), true)));
  s = s.replace(/(^|[^\\$])\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g, (_m, pre: string, t: string) => pre + keep(renderTex(t, false)));
  return md.render(s)
    .replace(/@@MATH(\d+)@@/g, (_m, i: string) => math[Number(i)])
    .replace(/<sup>(\d+)<\/sup>/g, (_m, n: string) => `<sup><a href="${referenceHref(base, n)}" aria-label="reference ${n}">${n}</a></sup>`);
}

export function loadSections(base = "/"): Section[] {
  const reg: { sections: Entry[] } = JSON.parse(readFileSync(CONTENT + "sections.json", "utf8"));
  return reg.sections.map((e) => {
    const raw = readFileSync(CONTENT + e.file, "utf8");
    const { meta, body } = frontMatter(raw);
    const [prose, caption = ""] = body.split(/^###\s+Figure caption\s*$/m);
    const [before, after = ""] = prose.split(/^\s*<!--\s*figure\s*-->\s*$/m);
    return {
      id: e.id, title: meta.title ?? e.id, todo: TODO.test(raw), figure: e.figure,
      before: renderMarkdown(before, base), after: renderMarkdown(after, base), caption: renderMarkdown(caption.trim(), base),
      notes: renderMarkdown(prose, base),          // the caption's notes show in the figure's caption
    };
  });
}

// ---------------------------------------------------------------- landing-page slots (Phase 7)
// The author's prose on the landing page: content/landing/<name>.md, each a TODO note until written. A written slot
// is rendered; an unwritten one is left out of production (the page closes up), shown as its TODO notes in dev, and
// filled with bracketed placeholder text of its target length with SITE_PLACEHOLDERS=1 (development builds only, for
// review screenshots of the finished state).
const LANDING = dir("../content/landing/");
const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
// The headline is about 80 characters and the summary two sentences (author, 2026-10-21): the fold test on the
// placeholder build (e2e/fold.spec.ts) checks that a headline of that length keeps the entry links above the fold.
export const PLACEHOLDERS: Record<string, string> = {
  headline: "[Placeholder headline] Lorem ipsum dolor sit amet, consectetur adipiscing elit sed.",
  summary: `[Placeholder summary, two sentences] ${LOREM} Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip.`,
  "finding-loss": `[Placeholder caption, one or two sentences] ${LOREM}`,
  "finding-missions": `[Placeholder caption, one or two sentences] ${LOREM}`,
  "finding-hibberd": `[Placeholder caption, one or two sentences] ${LOREM}`,
};

/**
 * The headline's length budget, in characters of plain text (author, 2026-10-21). A longer headline can push the entry
 * links below the fold on a phone. e2e/fold.spec.ts measures the longest headline that keeps them above the fold at
 * 390 × 844 and 1440 × 900 and fails if this budget exceeds it; the build reports a written headline over it.
 * Measured 2026-10-21: 114 characters at 390 × 844 (three lines; the binding size) and 365 at 1440 × 900. The budget
 * keeps about one long word in hand, since where a headline wraps depends on its words.
 */
export const HEADLINE_BUDGET = 100;

/** The build's report on the written headline: null within the budget, else a message. */
export function headlineReport(markdown: string, budget = HEADLINE_BUDGET): string | null {
  if (TODO.test(markdown)) return null;
  const text = md.render(frontMatter(markdown).body).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return text.length > budget
    ? `[content] the landing headline is ${text.length} characters, over its budget of ${budget}: on a 390 × 844 screen it can push the entry links below the fold (e2e/fold.spec.ts)`
    : null;
}

export function slotHTML(name: string, mode: { dev: boolean; placeholders: boolean }, base = "/"): string {
  const raw = readFileSync(LANDING + name + ".md", "utf8");
  const todo = TODO.test(raw);
  const open = (cls: string, extra = "") => `<div class="slot slot-${name}${cls}" data-slot="${name}"${extra}>`;
  if (!todo) return `${open("")}${renderMarkdown(frontMatter(raw).body, base)}</div>`;
  if (mode.placeholders) return `${open(" slot-placeholder")}${md.render(PLACEHOLDERS[name] ?? "[Placeholder]")}</div>`;
  if (mode.dev) return `${open(" slot-todo todo-notes", " data-todo")}${renderMarkdown(raw, base)}</div>`;
  return "";
}

/** Is the article section `id` shown in this build (and so a valid link target)? */
export function sectionShown(id: string, command: string): boolean {
  return showTodo(command) || loadSections().some((s) => s.id === id && !s.todo);
}

/** The dev server and SITE_SHOW_TODO=1 builds show unfinished content, with its TODO notes. */
export function showTodo(command: string): boolean {
  return command === "serve" || process.env.SITE_SHOW_TODO === "1";
}

/** The article (/research/) is built, and linked, when unfinished content is shown or a section is published. */
export function researchIncluded(command: string): boolean {
  return showTodo(command) || loadSections().some((s) => !s.todo);
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
    ? `<div class="todo-banner" role="note"><strong>TODO: prose not written yet.</strong> This section is hidden from the production build until its content file (<code>site/content/${esc(s.id)}.md</code>) has no TODO marker. The notes below are the author's checklist.</div>`
    : "";
  const fig = s.figure
    ? `<figure class="figure" id="fig-${s.figure}" data-figure="${s.figure}"${s.figN ? ` data-fig-n="${s.figN}"` : ""}>` +
      `<div class="figure-body"></div>${s.caption ? `<figcaption class="caption${dev && s.todo ? " todo-notes" : ""}">${s.caption}</figcaption>` : ""}</figure>`
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

/** The project citation for the footer, from site.json's copy of CITATION.cff: "Aggarwal, V. (2026). Title (version)
 * [Software]. URL". */
export function citationText(c: { title: string; authors: { given: string; family: string }[]; version?: string | null;
                                  date_released?: string | null; repository: string } | undefined): string {
  if (!c) return "";
  const names = c.authors.map((a) => `${a.family}, ${a.given.split(/\s+/).map((g) => `${g[0]}.`).join(" ")}`).join(", ");
  const year = c.date_released ? ` (${c.date_released.slice(0, 4)})` : "";
  return `${names}${year}. ${c.title}${c.version ? ` (${c.version})` : ""} [Software]. ${c.repository}`;
}

function partial(name: string, base: string): string {
  const site = readData("site.json");
  const methods = readData("methods.json");
  const blob = (f: string) => (site ? `${site.repo.url}/blob/main/${f}` : "#");
  const fill: Record<string, string> = {
    base, repo: site?.repo.url ?? "#", tag: methods?.tag ?? "", tag_commit: methods?.tag_commit ?? "",
    data_git: site?.provenance.git ?? "", tag_url: site ? `${site.repo.url}/tree/${site.repo.tag}` : "#",
    ai_log: blob("docs/ai_use_log.md"),
    author: site?.citation?.authors.map((a: { given: string; family: string }) => `${a.given} ${a.family}`).join(", ") ?? "",
    citation: citationText(site?.citation), licence_code: blob("LICENSE"), licence_content: blob("LICENSE-content.md"),
  };
  return readFileSync(PARTIALS + name, "utf8").replace(/\{\{(\w+)\}\}/g, (_m, k: string) => esc(fill[k] ?? ""));
}

/** A page's path under the site root, from its HTML file: "research/index.html" → "research/", "index.html" → "". */
export function pagePath(file: string, root: string): string {
  return relative(root, file).replace(/\\/g, "/").replace(/(^|\/)index\.html$/, "$1");
}

/**
 * Open Graph and Twitter-card tags for a page, from its own <title> and description (nothing to keep in step).
 * og:image and og:url must be absolute: SITE_URL (the deployed root, set by the Pages workflow from
 * actions/configure-pages) is used when present, else the base path. The 404 page gets none (noindex).
 * The image, public/og-image.png (1200 × 630), is made from the landing page's hero by tools/og-image.mjs.
 */
function socialMeta(html: string, path: string, base: string): string {
  if (/404\.html$/.test(path)) return "";
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "Oberth Efficiency Atlas";
  const desc = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? "";
  const root = (process.env.SITE_URL ?? base).replace(/\/?$/, "/");
  const tag = (attr: string, k: string, v: string) => `    <meta ${attr}="${k}" content="${v}" />\n`;
  return "\n" + tag("property", "og:type", "website") + tag("property", "og:site_name", "Oberth Efficiency Atlas") +
    tag("property", "og:title", title) + tag("property", "og:description", desc) + tag("property", "og:url", root + path) +
    tag("property", "og:image", `${root}og-image.png`) + tag("property", "og:image:width", "1200") +
    tag("property", "og:image:height", "630") +
    tag("property", "og:image:alt", "Three engines flying the same dive around the Sun, each burn drawn beside its path and coloured by the rate of energy gain") +
    tag("name", "twitter:card", "summary_large_image");
}

export function contentPlugin(): Plugin {
  let config: ResolvedConfig;
  let dev = false, placeholders = false;
  return {
    name: "oberth-content",
    configResolved(c) {
      config = c;
      // SITE_SHOW_TODO=1 builds the unfinished sections too (with their TODO banners), for tests and review
      // screenshots of a build; deployed builds never set it.
      dev = showTodo(c.command);
      placeholders = process.env.SITE_PLACEHOLDERS === "1";
      if (placeholders && c.mode !== "development") throw new Error("SITE_PLACEHOLDERS=1 is for development builds only (--mode development)");
    },
    buildStart() {
      const report = headlineReport(readFileSync(LANDING + "headline.md", "utf8"));
      if (report) config.logger.warn(`\n${report}\n`);
      if (dev) return;
      const hidden = loadSections().filter((s) => s.todo).map((s) => s.id);
      config.logger.info(hidden.length
        ? `\n[content] hidden in production (content file still has TODO): ${hidden.join(", ")}\n`
        : "\n[content] all sections shown\n");
      if (!researchIncluded(config.command)) config.logger.info("[content] every article section is TODO: /research/ is not built and not linked\n");
    },
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const base = config.base;
        const research = researchIncluded(config.command);
        let out = html.replace("<!--#header-->", partial("header.html", base)).replace("<!--#footer-->", partial("footer.html", base))
          // The Research link, wherever a page or partial asks for it (<!--#research-link: attrs|label-->), only when
          // the article is built; otherwise nothing at all.
          .replace(/<!--#research-link:([^|>]*?)(?:\|([^>]*?))?-->/g, (_m, attrs: string, label?: string) =>
            research ? `<a href="{{base}}research/"${attrs.trimEnd()}>${label?.trim() || "Research"}</a>` : "")
          .replace(/<li>\s*<\/li>\s*/g, "")             // a list item left empty by a link not rendered
          .replace(/\{\{base\}\}/g, base)               // page links honour the deployed base path
          .replace(/\{\{repo\}\}/g, esc(readData("site.json")?.repo.url ?? "#"));
        out = out.replace("</head>", `${socialMeta(out, pagePath(ctx.filename, config.root), base)}</head>`);
        // Landing page: the author's prose slots, and each finding's link (its article section when shown, else the
        // matching explorer state: <!--#finding-link:section-id|explorer query-->).
        out = out.replace(/<!--#slot:([\w-]+)-->/g, (_m, name: string) => slotHTML(name, { dev, placeholders }, base))
          .replace(/<!--#finding-link:([\w-]+)\|([^>]*?)-->/g, (_m, id: string, query: string) => sectionShown(id, config.command)
            ? `<a class="finding-link" href="${base}research/#${id}">In the research</a>`
            : `<a class="finding-link" href="${base}explorer/?${query}">Open in the explorer</a>`);
        if (out.includes("<!--#references-->")) {
          const site = readData("site.json");
          out = out.replace("<!--#references-->", referenceListHTML(site?.references ?? []));
        }
        if (!out.includes("<!--#sections-->")) return out;
        const kept = keptSections(loadSections(base), dev);
        const hero = kept.find((s) => s.id === "hero");
        const rest = kept.filter((s) => s.id !== "hero");
        const nav = rest.map((s) => `<li><a href="#${s.id}" data-nav="${s.id}">${esc(s.title)}</a></li>`).join("");
        return out
          .replace("<!--#hero-->", hero ? sectionHTML(hero, dev) : `<h1 class="visually-hidden">Research</h1>`)
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
