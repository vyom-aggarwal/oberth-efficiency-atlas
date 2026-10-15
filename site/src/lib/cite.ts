// Citations and source links: "Hibberd et al.¹" (paper-outline numbering) and a link to the data file
// in the repository at the tag (or commit) the export recorded.
import { h } from "./dom";
import type { SiteData } from "./data";

/** Short name plus a superscript reference number linking to the reference list. */
export function citation(label: string, ref: number | null): HTMLElement {
  const el = h("span", { class: "cite" }, label);
  if (ref !== null) el.append(h("sup", {}, h("a", { href: `#ref-${ref}`, "aria-label": `reference ${ref}` }, String(ref))));
  return el;
}

/** A reference-list entry (inline Markdown from docs/paper_outline.md: *italic*, `code`) as safe HTML. */
export function referenceHTML(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\*([^*]+)\*/g, "<i>$1</i>").replace(/`([^`]+)`/g, "<code>$1</code>");
}

/** Link to a source file in the repository (GitHub blob at the recorded ref). */
export function sourceLink(site: SiteData, rel: string): HTMLAnchorElement {
  const ref = site.source_links[rel] ?? site.repo.tag;
  return h("a", { href: `${site.repo.url}/blob/${ref}/${rel}`, rel: "noopener" }, rel.split("/").pop() ?? rel);
}
